'use strict';

require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  ENV: process.env.APP_ENV || process.env.ENV || 'development',
  APP_URL: process.env.APP_URL || null,          // set for cross-origin deployments; leave unset when serving the frontend from this same server
  SESSION_SECRET: process.env.SESSION_SECRET || 'examportal-dev-secret-change-me',
  DB_PATH: process.env.DB_PATH || null,          // defaults to ./data/examportal.db, see db.js

  // Email notifications (see server/mailer.js). Leave EMAIL_USER/EMAIL_PASS
  // unset to run with email sending disabled — everything else still works.
  EMAIL_USER: process.env.EMAIL_USER || null,
  EMAIL_PASS: process.env.EMAIL_PASS || null,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'ExamPortal — University Examination Department',
  UNIVERSITY_NAME: process.env.UNIVERSITY_NAME || 'University Examination Department',
  ADMIN_RECOVERY_KEY: process.env.ADMIN_RECOVERY_KEY || 'NED-ADMIN-RECOVERY-2026',
};
