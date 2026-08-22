'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../authGuards');

const router = express.Router();

const getUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const updatePassword = db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?');

function publicUser(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role, dept: u.dept || '' };
}

// POST ?action=login  { username, password, role, dept }
router.post('/', (req, res, next) => {
  if (req.query.action === 'login') return login(req, res);
  if (req.query.action === 'logout') return logout(req, res);
  if (req.query.action === 'change_password') return requireAuth(req, res, () => changePassword(req, res));
  next();
});

// GET ?action=me
router.get('/', (req, res, next) => {
  if (req.query.action === 'me') return me(req, res);
  next();
});

function login(req, res) {
  const { username, password, role, dept } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const user = getUserByUsername.get(String(username).trim());
  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
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
    // Re-read to catch admin-side changes (role/dept/active) since login
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

module.exports = router;
