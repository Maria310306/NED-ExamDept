'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const db = require('./db');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const insertBackupRow = db.prepare(`
  INSERT INTO backups (filename, filepath, size_bytes, status, error_message, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
`);

function timestampForFilename() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Creates a live, consistent backup of the database using SQLite's Online
 * Backup API (via better-sqlite3's db.backup()) — safe to run while the
 * server is actively being used, no downtime or locking required.
 */
async function createBackup() {
  const filename = `examportal-${timestampForFilename()}.db`;
  const filepath = path.join(BACKUP_DIR, filename);

  try {
    await db.backup(filepath);

    // The live database runs in WAL mode, and db.backup() preserves that
    // setting in the copy — which then needs a -wal/-shm sidecar to open
    // cleanly and can cause "database is locked" when attached later for
    // a restore. Converting the backup to plain rollback-journal mode
    // makes it a fully self-contained single file, safe to attach anytime.
    const backupConn = new Database(filepath);
    backupConn.pragma('journal_mode = DELETE');
    backupConn.close();

    const sizeBytes = fs.statSync(filepath).size;
    const info = insertBackupRow.run(filename, filepath, sizeBytes, 'success', null);
    const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(info.lastInsertRowid);
    return { success: true, backup: row };
  } catch (err) {
    insertBackupRow.run(filename, filepath, 0, 'failed', err.message);
    return { success: false, error: err.message };
  }
}

// Tables holding actual application data — restored from the backup.
// `backups` and `audit_logs` are intentionally NOT restored, so the
// history of backups/actions taken remains intact across a restore.
const DATA_TABLES = ['users', 'requests', 'verification_details', 'transfer_log', 'request_serial'];

/**
 * Restores application data from a previously created backup file.
 * Uses SQLite's ATTACH DATABASE to copy table contents from the backup
 * file into the live database inside a single transaction — this works
 * without restarting the server or closing the live connection.
 */
async function restoreBackup(backupId) {
  const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
  if (!row) throw new Error('Backup not found');
  if (row.status !== 'success') throw new Error('Cannot restore from a failed backup');
  if (!fs.existsSync(row.filepath)) throw new Error('Backup file no longer exists on disk');

  const escapedPath = row.filepath.replace(/'/g, "''");

  // Note: ATTACH DATABASE cannot run inside an active transaction (SQLite
  // rejects it), so attach/detach happen outside db.transaction() — only
  // the actual table copy is wrapped, so a failure partway through still
  // rolls back cleanly.
  db.pragma('foreign_keys = OFF');
  db.exec(`ATTACH DATABASE '${escapedPath}' AS restoresrc`);
  try {
    const copyAll = db.transaction(() => {
      for (const table of DATA_TABLES) {
        db.exec(`DELETE FROM main.${table}`);
        db.exec(`INSERT INTO main.${table} SELECT * FROM restoresrc.${table}`);
      }
    });
    copyAll();
  } finally {
    db.exec('DETACH DATABASE restoresrc');
    db.pragma('foreign_keys = ON');
  }

  return { filename: row.filename };
}

/**
 * Ensures at least one successful backup exists for "today" (local server
 * date). Called once at startup and then checked hourly — this is what
 * makes backups happen automatically every day without any manual action.
 */
async function ensureDailyBackup() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartSql = todayStart.toISOString().slice(0, 19).replace('T', ' ');

  const existing = db.prepare(`
    SELECT id FROM backups WHERE status = 'success' AND created_at >= ? LIMIT 1
  `).get(todayStartSql);

  if (existing) return; // already have one for today

  console.log('[backup] No backup found for today — creating one now...');
  const result = await createBackup();
  if (result.success) {
    console.log('[backup] Daily backup created:', result.backup.filename);
  } else {
    console.error('[backup] Daily backup FAILED:', result.error);
  }
}

module.exports = { createBackup, restoreBackup, ensureDailyBackup, BACKUP_DIR };
