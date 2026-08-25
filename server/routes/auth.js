'use strict';

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../authGuards');
const { sendMail } = require('../mailer');
const { passwordResetEmailTemplate } = require('../emailTemplates');
const config = require('../config');

const router = express.Router();

const getUserByUsernameOrEmail = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const updatePassword = db.prepare(`UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, updated_at = datetime('now') WHERE id = ?`);

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email || '',
    full_name: u.full_name,
    role: u.role,
    dept: u.dept || ''
  };
}

// POST actions
router.post('/', (req, res, next) => {
  if (req.query.action === 'login') return login(req, res);
  if (req.query.action === 'logout') return logout(req, res);
  if (req.query.action === 'change_password') return requireAuth(req, res, () => changePassword(req, res));
  if (req.query.action === 'forgot_password') return forgotPassword(req, res);
  if (req.query.action === 'reset_password_with_token') return resetPasswordWithToken(req, res);
  next();
});

// GET actions
router.get('/', (req, res, next) => {
  if (req.query.action === 'me') return me(req, res);
  if (req.query.action === 'verify_reset_token') return verifyResetToken(req, res);
  next();
});

function login(req, res) {
  const { username, password, role, dept } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username/Email and password are required' });
  }

  const query = String(username).trim();
  const user = getUserByUsernameOrEmail.get(query, query);
  
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username/email or password' });
  }

  if (!user.is_active) {
    return res.status(401).json({ success: false, error: 'Account has been archived or deactivated. Please contact administrator.' });
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid username/email or password' });
  }

  if (role && user.role !== role) {
    return res.status(401).json({ success: false, error: 'Invalid role selected for this account' });
  }
  if (user.role === 'department' && dept && user.dept !== dept) {
    return res.status(401).json({ success: false, error: 'Selected section does not match this account' });
  }

  req.session.user = publicUser(user);
  res.json({ success: true, user: req.session.user });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('examportal.sid');
    res.json({ success: true });
  });
}

function me(req, res) {
  if (req.session && req.session.user) {
    const fresh = getUserById.get(req.session.user.id);
    if (!fresh || !fresh.is_active) {
      req.session.destroy(() => {});
      return res.json({ success: false });
    }
    req.session.user = publicUser(fresh);
    return res.json({ success: true, user: req.session.user });
  }
  res.json({ success: false });
}

function changePassword(req, res) {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
  }
  const user = getUserById.get(req.session.user.id);
  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(new_password, 12);
  updatePassword.run(hash, user.id);
  res.json({ success: true });
}

async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, error: 'Email address is required' });
  }

  const query = email.trim();
  const user = db.prepare(`SELECT * FROM users WHERE email = ? OR username = ?`).get(query, query);

  if (!user || !user.is_active) {
    // For security, present the same message so email enumeration is minimized,
    // but return success true so user knows request was handled.
    return res.json({
      success: true,
      message: 'If a matching active account was found, a password reset link has been sent to the registered email.'
    });
  }

  if (!user.email) {
    return res.status(400).json({ success: false, error: 'No email address registered for this account. Contact admin.' });
  }

  // 30-second resend cooldown: a token issued in the last 30s means the
  // previous reset_expires timestamp (issued 1 hour before it expires) is
  // less than 30s old.
  if (user.reset_token && user.reset_expires) {
    const issuedAtMs = new Date(user.reset_expires).getTime() - 60 * 60 * 1000;
    const secondsSinceIssued = (Date.now() - issuedAtMs) / 1000;
    if (secondsSinceIssued < 30) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${Math.ceil(30 - secondsSinceIssued)}s before requesting another reset email.`,
        retryAfterSeconds: Math.ceil(30 - secondsSinceIssued),
      });
    }
  }

  // Generate secure token (32 bytes hex)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiration

  db.prepare(`
    UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?
  `).run(token, expiresAt, user.id);

  // Construct reset URL
  const baseUrl = config.APP_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl}/#reset-password?token=${token}`;

  const emailData = passwordResetEmailTemplate(user, resetUrl);
  const sent = await sendMail(emailData);

  console.log(`[auth] Password reset requested for ${user.username} (${user.email}). Token: ${token}, Mail Sent: ${sent}`);

  res.json({
    success: true,
    message: 'A password reset link has been sent to your registered email address.',
    // Return token in response if SMTP is not configured so developer/admin can easily test reset flow
    devToken: !config.EMAIL_USER ? token : undefined
  });
}

function verifyResetToken(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required' });
  }

  const user = db.prepare(`
    SELECT id, username, email, reset_expires FROM users WHERE reset_token = ?
  `).get(token);

  if (!user) {
    return res.status(400).json({ success: false, error: 'Invalid or expired password reset token' });
  }

  const expiresTime = new Date(user.reset_expires).getTime();
  if (isNaN(expiresTime) || Date.now() > expiresTime) {
    return res.status(400).json({ success: false, error: 'Password reset token has expired. Please request a new link.' });
  }

  res.json({
    success: true,
    username: user.username,
    email: user.email
  });
}

function resetPasswordWithToken(req, res) {
  const { token, new_password } = req.body || {};
  if (!token || !new_password) {
    return res.status(400).json({ success: false, error: 'Token and new password are required' });
  }

  if (String(new_password).length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }

  const user = db.prepare(`
    SELECT id, username, reset_expires FROM users WHERE reset_token = ?
  `).get(token);

  if (!user) {
    return res.status(400).json({ success: false, error: 'Invalid or expired password reset token' });
  }

  const expiresTime = new Date(user.reset_expires).getTime();
  if (isNaN(expiresTime) || Date.now() > expiresTime) {
    return res.status(400).json({ success: false, error: 'Password reset token has expired. Please request a new link.' });
  }

  const hash = bcrypt.hashSync(new_password, 12);
  updatePassword.run(hash, user.id);

  db.prepare(`
    INSERT INTO audit_logs (action, performed_by, target_user, details, created_at)
    VALUES ('PASSWORD_RESET_COMPLETED', ?, ?, 'Password reset via email token', datetime('now'))
  `).run(user.username, user.username);

  res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
}

module.exports = router;
