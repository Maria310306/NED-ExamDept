'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole } = require('../authGuards');

const router = express.Router();
router.use(requireRole('admin'));

const VALID_ROLES = ['data-entry', 'department', 'admin'];

function isValidNiduetEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Validates @cloud.neduet.edu.pk or @neduet.edu.pk
  return /^[a-zA-Z0-9._%+-]+@(cloud\.)?neduet\.edu\.pk$/i.test(email.trim());
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email || '',
    full_name: u.full_name,
    role: u.role,
    dept: u.dept || '',
    is_active: !!u.is_active,
    archived_at: u.archived_at || null,
    archived_by: u.archived_by || null,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

// GET ?action=list  (&status=active|archived|all)
router.get('/', (req, res, next) => {
  if (req.query.action !== 'list') return next();
  const statusFilter = req.query.status || 'active';

  let rows;
  if (statusFilter === 'archived') {
    rows = db.prepare('SELECT * FROM users WHERE is_active = 0 ORDER BY archived_at DESC, id DESC').all();
  } else if (statusFilter === 'all') {
    rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  } else {
    rows = db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY id ASC').all();
  }

  res.json({ success: true, users: rows.map(publicUser) });
});

// POST ?action=create  { username, email, password, full_name, role, dept }
router.post('/', (req, res, next) => {
  if (req.query.action !== 'create') return next();
  const { username, email, password, full_name, role, dept } = req.body || {};

  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({ success: false, error: 'username, email, password, full_name, and role are required' });
  }

  if (!isValidNiduetEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid NIDUET email address. Email must end with @cloud.neduet.edu.pk or @neduet.edu.pk' });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  if (role === 'department' && !dept) {
    return res.status(400).json({ success: false, error: 'dept is required for department-role users' });
  }

  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(String(username).trim());
  if (existingUsername) {
    return res.status(409).json({ success: false, error: 'Username already exists' });
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).trim());
  if (existingEmail) {
    return res.status(409).json({ success: false, error: 'Email already registered to another user' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(`
    INSERT INTO users (username, email, password, full_name, role, dept, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).run(
    String(username).trim(),
    String(email).trim(),
    hash,
    String(full_name).trim(),
    role,
    role === 'department' ? dept : null
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  // Log in audit log
  db.prepare(`
    INSERT INTO audit_logs (action, performed_by, target_user, details, created_at)
    VALUES ('USER_CREATED', ?, ?, ?, datetime('now'))
  `).run(req.session.user.username, user.username, `Role: ${user.role}, Email: ${user.email}`);

  res.json({ success: true, user: publicUser(user) });
});

// POST ?action=update  { id, full_name, email, role, dept, is_active }
router.post('/', (req, res, next) => {
  if (req.query.action !== 'update') return next();
  const { id, full_name, email, role, dept, is_active } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'id is required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (email && email !== user.email) {
    if (!isValidNiduetEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid NIDUET email address' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered to another user' });
    }
  }

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      email = COALESCE(?, email),
      role = COALESCE(?, role),
      dept = ?,
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    full_name ? String(full_name).trim() : null,
    email ? String(email).trim() : null,
    role ?? null,
    (role || user.role) === 'department' ? (dept ?? user.dept) : null,
    typeof is_active === 'boolean' ? (is_active ? 1 : 0) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ success: true, user: publicUser(updated) });
});

// POST ?action=reset_password  { id, new_password }
router.post('/', (req, res, next) => {
  if (req.query.action !== 'reset_password') return next();
  const { id, new_password } = req.body || {};
  if (!id || !new_password) return res.status(400).json({ success: false, error: 'id and new_password are required' });
  if (String(new_password).length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare(`UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, id);

  db.prepare(`
    INSERT INTO audit_logs (action, performed_by, target_user, details, created_at)
    VALUES ('ADMIN_RESET_PASSWORD', ?, ?, 'Admin reset password directly', datetime('now'))
  `).run(req.session.user.username, user.username);

  res.json({ success: true });
});

// POST ?action=archive  { id, admin_password }  (Replaces hard delete)
router.post('/', (req, res, next) => {
  if (req.query.action !== 'archive' && req.query.action !== 'delete') return next();
  const { id, admin_password } = req.body || {};
  const userId = id || req.query.id;

  if (!userId) return res.status(400).json({ success: false, error: 'User id is required' });
  if (!admin_password) {
    return res.status(400).json({ success: false, error: 'Admin password confirmation is required' });
  }

  if (String(userId) === String(req.session.user.id)) {
    return res.status(400).json({ success: false, error: 'You cannot archive your own account while logged in' });
  }

  // Backend Admin password verification
  const currentAdmin = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.user.id);
  if (!currentAdmin || !bcrypt.compareSync(admin_password, currentAdmin.password)) {
    return res.status(401).json({ success: false, error: 'Incorrect Admin password' });
  }

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

  // Soft delete / Archive user
  db.prepare(`
    UPDATE users SET
      is_active = 0,
      archived_at = datetime('now'),
      archived_by = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(req.session.user.username, userId);

  // Record audit log
  db.prepare(`
    INSERT INTO audit_logs (action, performed_by, target_user, details, created_at)
    VALUES ('USER_ARCHIVED', ?, ?, ?, datetime('now'))
  `).run(req.session.user.username, targetUser.username, `Archived user ID ${userId}`);

  res.json({ success: true, message: `User ${targetUser.username} archived successfully.` });
});

// POST ?action=restore  { id, admin_password }
router.post('/', (req, res, next) => {
  if (req.query.action !== 'restore') return next();
  const { id, admin_password } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'User id is required' });
  if (!admin_password) {
    return res.status(400).json({ success: false, error: 'Admin password confirmation is required' });
  }

  // Backend Admin password verification
  const currentAdmin = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.user.id);
  if (!currentAdmin || !bcrypt.compareSync(admin_password, currentAdmin.password)) {
    return res.status(401).json({ success: false, error: 'Incorrect Admin password' });
  }

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

  // Restore user
  db.prepare(`
    UPDATE users SET
      is_active = 1,
      archived_at = NULL,
      archived_by = NULL,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  // Record audit log
  db.prepare(`
    INSERT INTO audit_logs (action, performed_by, target_user, details, created_at)
    VALUES ('USER_RESTORED', ?, ?, ?, datetime('now'))
  `).run(req.session.user.username, targetUser.username, `Restored user ID ${id}`);

  res.json({ success: true, message: `User ${targetUser.username} restored successfully.` });
});

router.use((req, res) => res.status(400).json({ success: false, error: 'Unknown action' }));

module.exports = router;
