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
router.post('/', async (req, res, next) => {
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

async function login(req, res) {
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
    return res.status(401).json({ success: false, error: 'Account is inactive or archived. Contact administrator.' });
  }

  // Non-blocking async password verification (prevents event-loop latency)
  const ok = await bcrypt.compare(password, user.password);
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

async function changePassword(req, res) {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
  }
  const user = getUserById.get(req.session.user.id);
  const ok = await bcrypt.compare(current_password, user.password);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(new_password, 10);
  updatePassword.run(hash, user.id);
  res.json({ success: true, message: 'Password updated successfully' });
}

async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, error: 'Email or username is required' });
  }

  const query = email.trim();
  const user = db.prepare(`SELECT * FROM users WHERE email = ? OR username = ?`).get(query, query);

  if (!user || !user.is_active || !user.email) {
    return res.json({
      success: true,
      message: 'Password reset link sent to your registered email.'
    });
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
  // Send email asynchronously without blocking HTTP response latency
  sendMail(emailData).then(sent => {
    console.log(`[auth] Password reset requested for ${user.username} (${user.email}). Mail sent: ${sent}`);
  }).catch(err => {
    console.error(`[auth] Failed to dispatch password reset email:`, err.message);
  });

  res.json({
    success: true,
    message: 'Password reset link sent to your registered email.',
    devToken: !config.EMAIL_USER ? token : undefined
  });
}

function verifyResetToken(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Reset token is required' });
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

async function resetPasswordWithToken(req, res) {
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

  // Non-blocking async password hash
  const hash = await bcrypt.hash(new_password, 10);
  updatePassword.run(hash, user.id);

  db.prepare(`
    INSERT INTO audit_logs (action, performed_by, target_user, details, created_at)
    VALUES ('PASSWORD_RESET_COMPLETED', ?, ?, 'Password reset via token', datetime('now'))
  `).run(user.username, user.username);

  res.json({ success: true, message: 'Password updated successfully.' });
}

module.exports = router;
