'use strict';

/*
  Seeds the default users with password "password" (bcrypt-hashed + stored plain for Admin view).
  Each gets a placeholder @neduet.pk email.
*/

const bcrypt = require('bcryptjs');
const db = require('./db');

const DEFAULT_PASSWORD = 'password';
const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

const users = [
  { username: 'counter',  email: 'counter@neduet.pk',  full_name: 'Counter Operator', role: 'data-entry', dept: null },
  { username: 'result',   email: 'result@neduet.pk',   full_name: 'Result Section',   role: 'department', dept: 'Result Section' },
  { username: 'degree',   email: 'degree@neduet.pk',   full_name: 'Degree Section',   role: 'department', dept: 'Degree Section' },
  { username: 'external', email: 'external@neduet.pk', full_name: 'External Section', role: 'department', dept: 'External Section' },
  { username: 'masters',  email: 'masters@neduet.pk',  full_name: 'Masters Section',  role: 'department', dept: 'Masters Section' },
  { username: 'admin',    email: 'admin@neduet.pk',    full_name: 'Super Admin',      role: 'admin',      dept: null },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, plain_password, full_name, role, dept)
  VALUES (@username, @email, @password, @plain_password, @full_name, @role, @dept)
`);

const tx = db.transaction((rows) => {
  for (const u of rows) insert.run({ ...u, password: hash, plain_password: DEFAULT_PASSWORD });
});

tx(users);

// Also populate plain_password for existing seed users if missing
db.prepare(`UPDATE users SET plain_password = 'password' WHERE plain_password IS NULL OR plain_password = ''`).run();

console.log(`Seed complete. Default users ready (password: "${DEFAULT_PASSWORD}"):`);
users.forEach(u => console.log(`  - ${u.username}  (${u.role}${u.dept ? ', ' + u.dept : ''}) — ${u.email}`));
