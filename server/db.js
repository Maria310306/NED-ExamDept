'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'examportal.db');

// Make sure the data/ folder exists (SQLite needs the directory to already exist)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations for existing databases before executing full schema
(function migrateUsersTable() {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (tableCheck) {
    const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!columns.includes('email')) {
      db.exec("ALTER TABLE users ADD COLUMN email TEXT");
    }
    if (!columns.includes('archived_at')) {
      db.exec("ALTER TABLE users ADD COLUMN archived_at TEXT NULL");
    }
    if (!columns.includes('archived_by')) {
      db.exec("ALTER TABLE users ADD COLUMN archived_by TEXT NULL");
    }
    if (!columns.includes('reset_token')) {
      db.exec("ALTER TABLE users ADD COLUMN reset_token TEXT NULL");
    }
    if (!columns.includes('reset_expires')) {
      db.exec("ALTER TABLE users ADD COLUMN reset_expires TEXT NULL");
    }
    if (!columns.includes('plain_password')) {
      db.exec("ALTER TABLE users ADD COLUMN plain_password TEXT NULL");
    }
  }
})();

(function migrateRequestsTable() {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'").get();
  if (tableCheck) {
    const columns = db.prepare("PRAGMA table_info(requests)").all().map(c => c.name);
    if (!columns.includes('courier_address')) {
      db.exec("ALTER TABLE requests ADD COLUMN courier_address TEXT NULL");
    }
  }
})();

// Apply schema (idempotent — CREATE TABLE IF NOT EXISTS & CREATE INDEX IF NOT EXISTS)
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

module.exports = db;
