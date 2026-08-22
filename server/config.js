'use strict';

require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  ENV: process.env.APP_ENV || process.env.ENV || 'development',
  APP_URL: process.env.APP_URL || null,          // set for cross-origin deployments; leave unset when serving the frontend from this same server
  SESSION_SECRET: process.env.SESSION_SECRET || 'examportal-dev-secret-change-me',
  DB_PATH: process.env.DB_PATH || null,          // defaults to ./data/examportal.db, see db.js
};
