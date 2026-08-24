'use strict';

const path = require('path');
const fs = require('fs');
const db = require('./db');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Ensure backup folder exists
fs.mkdirSync(BACKUP_DIR, { recursive: true });

/**
 * Creates a database backup file using SQLite WAL-safe backup or file copy.
 * @returns {Promise<{success: boolean, backup?: object, error?: string}>}
 */
async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `examportal_backup_${timestamp}.db`;
  const targetPath = path.join(BACKUP_DIR, filename);

  try {
    // Uses better-sqlite3 native backup API if available, or synchronous safe backup
    if (typeof db.backup === 'function') {
      await db.backup(targetPath);
    } else {
      // Fallback: WAL checkpoint then copy
      db.pragma('wal_checkpoint(TRUNCATE)');
      const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'examportal.db');
      fs.copyFileSync(dbPath, targetPath);
    }

    const stats = fs.statSync(targetPath);
    const sizeBytes = stats.size;

    const stmt = db.prepare(`
      INSERT INTO backups (filename, filepath, size_bytes, status, created_at)
      VALUES (?, ?, ?, 'success', datetime('now'))
    `);
    const info = stmt.run(filename, targetPath, sizeBytes);

    const backupRecord = db.prepare('SELECT * FROM backups WHERE id = ?').get(info.lastInsertRowid);
    console.log('[backupService] Backup created successfully:', filename, `(${sizeBytes} bytes)`);

    // Clean up old backups based on retention policy
    cleanOldBackups();

    return { success: true, backup: backupRecord };
  } catch (err) {
    console.error('[backupService] Backup failed:', err.message);
    try {
      db.prepare(`
        INSERT INTO backups (filename, filepath, size_bytes, status, error_message, created_at)
        VALUES (?, ?, 0, 'failed', ?, datetime('now'))
      `).run(filename, targetPath, err.message);
    } catch (dbErr) {
      console.error('[backupService] Failed to record backup failure in DB:', dbErr.message);
    }
    return { success: false, error: err.message };
  }
}

/**
 * Clean up backups older than RETENTION_DAYS
 */
function cleanOldBackups() {
  try {
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * DAY_IN_MS).toISOString();
    const oldBackups = db.prepare("SELECT * FROM backups WHERE created_at < ?").all(cutoffDate);

    for (const b of oldBackups) {
      if (b.filepath && fs.existsSync(b.filepath)) {
        try {
          fs.unlinkSync(b.filepath);
          console.log('[backupService] Pruned old backup file:', b.filename);
        } catch (e) {
          console.error('[backupService] Failed to delete backup file:', b.filename, e.message);
        }
      }
      db.prepare("DELETE FROM backups WHERE id = ?").run(b.id);
    }
  } catch (err) {
    console.error('[backupService] Error during backup cleanup:', err.message);
  }
}

/**
 * Restores the database from a specified backup file.
 * @param {number} backupId
 */
async function restoreBackup(backupId) {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND status = 'success'").get(backupId);
  if (!backup) {
    throw new Error('Backup record not found or backup was unsuccessful');
  }

  if (!fs.existsSync(backup.filepath)) {
    throw new Error(`Backup file does not exist on disk: ${backup.filename}`);
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'examportal.db');
  
  // Perform checkpoint before restore
  db.pragma('wal_checkpoint(TRUNCATE)');
  
  // Copy backup file over active DB
  fs.copyFileSync(backup.filepath, dbPath);
  
  console.log('[backupService] Database restored successfully from backup:', backup.filename);
  return { success: true, filename: backup.filename };
}

/**
 * Initializes automatic daily scheduler.
 */
function initScheduler() {
  // Check if a backup ran today; if not, run one immediately, then schedule every 24h
  const lastBackup = db.prepare("SELECT created_at FROM backups WHERE status = 'success' ORDER BY id DESC LIMIT 1").get();
  let delay = 0;

  if (lastBackup && lastBackup.created_at) {
    const lastTime = new Date(lastBackup.created_at.replace(' ', 'T') + 'Z').getTime();
    const elapsed = Date.now() - lastTime;
    if (elapsed >= DAY_IN_MS) {
      createBackup();
      delay = DAY_IN_MS;
    } else {
      delay = DAY_IN_MS - elapsed;
    }
  } else {
    // First run
    createBackup();
    delay = DAY_IN_MS;
  }

  // Schedule recurring daily backup
  setTimeout(() => {
    createBackup();
    setInterval(createBackup, DAY_IN_MS);
  }, delay);

  console.log('[backupService] Automatic daily database backup service initialized.');
}

module.exports = {
  createBackup,
  cleanOldBackups,
  restoreBackup,
  initScheduler,
};
