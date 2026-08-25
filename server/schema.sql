-- ═══════════════════════════════════════════════════════
--  ExamPortal — SQLite Database Schema
--  University Document Request Management System
--  (Ported from MySQL schema.sql — same tables, columns, and
--   relationships. SQLite has no native ENUM, so those columns
--   use TEXT with a CHECK constraint instead.)
-- ═══════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── USERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    email       TEXT UNIQUE,            -- NEDUET email (@cloud.neduet.edu.pk or @neduet.edu.pk)
    password    TEXT NOT NULL,          -- bcrypt hash
    full_name   TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'data-entry'
                    CHECK (role IN ('data-entry','department','admin')),
    dept        TEXT NULL,              -- only for role=department
    is_active   INTEGER NOT NULL DEFAULT 1,
    archived_at TEXT NULL,
    archived_by TEXT NULL,
    reset_token TEXT NULL,
    reset_expires TEXT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- ── REQUEST ID SERIAL ──────────────────────────────────
-- Stores one row per calendar date to generate YYMMDD/NNN ids
CREATE TABLE IF NOT EXISTS request_serial (
    serial_date TEXT NOT NULL PRIMARY KEY,   -- YYMMDD
    last_num    INTEGER NOT NULL DEFAULT 0
);

-- ── REQUESTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
    id                  TEXT PRIMARY KEY,   -- e.g. 260411/001
    -- Student info
    student_name        TEXT NOT NULL,
    roll_number         TEXT NOT NULL,
    dept                TEXT NOT NULL,               -- Section routed to
    discipline          TEXT NOT NULL,
    cnic                TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT NOT NULL,
    -- Document
    doc_key             TEXT NOT NULL,
    doc_label           TEXT NOT NULL,
    programme_level     TEXT NOT NULL CHECK (programme_level IN ('ug','pg')),
    delivery            TEXT NOT NULL CHECK (delivery IN ('Normal','Urgent')),
    copies              INTEGER NOT NULL DEFAULT 1,
    courier             TEXT NOT NULL DEFAULT 'none',
    courier_address     TEXT NULL,
    email_copies        INTEGER NOT NULL DEFAULT 0,
    fee                 REAL NOT NULL DEFAULT 0,
    -- Routing
    routed_to           TEXT NOT NULL,
    current_holder      TEXT NOT NULL,
    -- Status & audit
    status              TEXT NOT NULL DEFAULT 'Pending',
    operator            TEXT NOT NULL,
    submitted_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NULL,
    updated_by          TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_req_status    ON requests(status);
CREATE INDEX IF NOT EXISTS idx_req_dept      ON requests(dept);
CREATE INDEX IF NOT EXISTS idx_req_current   ON requests(current_holder);
CREATE INDEX IF NOT EXISTS idx_req_submitted ON requests(submitted_at);
CREATE INDEX IF NOT EXISTS idx_req_delivery  ON requests(delivery);

-- ── VERIFICATION DETAILS ───────────────────────────────
-- Sub-rows for doc_key = 'verification'
CREATE TABLE IF NOT EXISTS verification_details (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id   TEXT NOT NULL,
    doc_key      TEXT NOT NULL,   -- verifyDegree, verifyProv, verifyMarks, verifyTrans
    doc_name     TEXT NOT NULL,
    original_ct  INTEGER NOT NULL DEFAULT 0,
    photocopy_ct INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vd_req ON verification_details(request_id);

-- ── TRANSFER LOG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfer_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id     TEXT NOT NULL,
    from_dept      TEXT NOT NULL,
    to_dept        TEXT NOT NULL,
    by_user        TEXT NOT NULL,
    note           TEXT NULL,
    transferred_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tl_req  ON transfer_log(request_id);
CREATE INDEX IF NOT EXISTS idx_tl_from ON transfer_log(from_dept);
CREATE INDEX IF NOT EXISTS idx_tl_to   ON transfer_log(to_dept);

-- ── DATABASE BACKUPS LOG ───────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,
    filepath      TEXT NOT NULL,
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL CHECK (status IN ('success','failed')),
    error_message TEXT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);

-- ── AUDIT LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    action       TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    target_user  TEXT NULL,
    details      TEXT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

