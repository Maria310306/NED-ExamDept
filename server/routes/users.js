'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole } = require('../authGuards');

const router = express.Router();
router.use(requireRole('admin'));

const VALID_ROLES = ['data-entry', 'department', 'admin'];

function publicUser(u) {
  return {
    id: u.id, username: u.username, full_name: u.full_name,
    role: u.role, dept: u.dept || '', is_active: !!u.is_active,
    created_at: u.created_at, updated_at: u.updated_at,
  };
}

// GET ?action=list
router.get('/', (req, res, next) => {
  if (req.query.action !== 'list') return next();
  const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  res.json({ success: true, users: rows.map(publicUser) });
});

// POST ?action=create  { username, password, full_name, role, dept }
router.post('/', (req, res, next) => {
  if (req.query.action !== 'create') return next();
  const { username, password, full_name, role, dept } = req.body || {};
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ success: false, error: 'username, password, full_name, and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }
  if (role === 'department' && !dept) {
    return res.status(400).json({ success: false, error: 'dept is required for department-role users' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ success: false, error: 'Username already exists' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(`
    INSERT INTO users (username, password, full_name, role, dept) VALUES (?, ?, ?, ?, ?)
  `).run(username, hash, full_name, role, role === 'department' ? dept : null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success: true, user: publicUser(user) });
});

// POST ?action=update  { id, full_name, role, dept, is_active }
router.post('/', (req, res, next) => {
  if (req.query.action !== 'update') return next();
  const { id, full_name, role, dept, is_active } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'id is required' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      role = COALESCE(?, role),
      dept = ?,
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    full_name ?? null,
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
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare(`UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, id);
  res.json({ success: true });
});

// DELETE ?action=delete&id=...
router.delete('/', (req, res, next) => {
  if (req.query.action !== 'delete') return next();
  const id = req.query.id;
  if (!id) return res.status(400).json({ success: false, error: 'id is required' });
  if (String(id) === String(req.session.user.id)) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own account while logged in' });
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true });
});

router.use((req, res) => res.status(400).json({ success: false, error: 'Unknown action' }));

module.exports = router;
