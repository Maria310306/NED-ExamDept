'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole } = require('../authGuards');
const { createBackup, restoreBackup } = require('../backupService');

const router = express.Router();
router.use(requireRole('admin'));

// GET ?action=list
router.get('/', (req, res, next) => {
  if (req.query.action !== 'list') return next();
  const rows = db.prepare('SELECT * FROM backups ORDER BY id DESC').all();
  res.json({ success: true, backups: rows });
});

// POST ?action=trigger
router.post('/', async (req, res, next) => {
  if (req.query.action !== 'trigger') return next();
  const result = await createBackup();
  if (result.success) {
    db.prepare(`
      INSERT INTO audit_logs (action, performed_by, details, created_at)
      VALUES ('BACKUP_TRIGGERED', ?, ?, datetime('now'))
    `).run(req.session.user.username, `Manual backup triggered: ${result.backup.filename}`);
    return res.json({ success: true, backup: result.backup });
  } else {
    return res.status(500).json({ success: false, error: result.error });
  }
});

// POST ?action=restore  { backup_id, admin_password }
router.post('/', async (req, res, next) => {
  if (req.query.action !== 'restore') return next();
  const { backup_id, admin_password } = req.body || {};
  if (!backup_id || !admin_password) {
    return res.status(400).json({ success: false, error: 'backup_id and admin_password are required' });
  }

  const adminUser = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.user.id);
  const ok = await bcrypt.compare(admin_password, adminUser ? adminUser.password : '');
  if (!adminUser || !ok) {
    return res.status(401).json({ success: false, error: 'Incorrect Admin password' });
  }

  try {
    const result = await restoreBackup(Number(backup_id));
    db.prepare(`
      INSERT INTO audit_logs (action, performed_by, details, created_at)
      VALUES ('BACKUP_RESTORED', ?, ?, datetime('now'))
    `).run(req.session.user.username, `Database restored from backup #${backup_id}: ${result.filename}`);
    return res.json({ success: true, filename: result.filename });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.use((req, res) => res.status(400).json({ success: false, error: 'Unknown action' }));

module.exports = router;
