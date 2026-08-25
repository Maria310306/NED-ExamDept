'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const db = require('./db');
const config = require('./config');

// Make sure default users exist on first run (safe to call every start — INSERT OR IGNORE)
require('./seed');

const authRoutes = require('./routes/auth');
const requestsRoutes = require('./routes/requests');
const usersRoutes = require('./routes/users');
const backupsRoutes = require('./routes/backups');
const { ensureDailyBackup } = require('./backupService');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// CORS — only needed if the frontend is hosted on a different origin
// than this API. Leave APP_URL unset when serving the frontend from
// this same server (the default setup).
if (config.APP_URL) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.APP_URL);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.use(session({
  store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
  name: 'examportal.sid',
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── API ──
app.use('/api/auth.php', authRoutes);
app.use('/api/requests.php', requestsRoutes);
app.use('/api/users.php', usersRoutes);
app.use('/api/backups.php', backupsRoutes);

// ── Frontend (index.html / styles.css / app.js) ──
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

app.listen(config.PORT, () => {
  console.log(`ExamPortal running at http://localhost:${config.PORT}  (env: ${config.ENV})`);

  // Daily backups: check once at startup, then every hour — whichever check
  // finds no successful backup yet for "today" creates one automatically.
  ensureDailyBackup().catch(err => console.error('[backup] Startup backup check failed:', err.message));
  setInterval(() => {
    ensureDailyBackup().catch(err => console.error('[backup] Hourly backup check failed:', err.message));
  }, 60 * 60 * 1000);
});
