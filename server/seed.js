'use strict';

/*
  Seeds the same default users the original schema.sql shipped with:
  counter / result / degree / external / masters / admin — all with
  password "password" (bcrypt-hashed here at seed time).

  Safe to re-run: uses INSERT OR IGNORE, so it never overwrites
  existing accounts or passwords that have already been changed.
*/

const bcrypt = require('bcryptjs');
const db = require('./db');

const DEFAULT_PASSWORD = 'password';
const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 12);

const users = [
  { username: 'counter',  email: 'counter@cloud.neduet.edu.pk',  full_name: 'Counter Operator', role: 'data-entry', dept: null },
  { username: 'result',   email: 'result@cloud.neduet.edu.pk',   full_name: 'Result Section',   role: 'department', dept: 'Result Section' },
  { username: 'degree',   email: 'degree@cloud.neduet.edu.pk',   full_name: 'Degree Section',   role: 'department', dept: 'Degree Section' },
  { username: 'external', email: 'external@cloud.neduet.edu.pk', full_name: 'External Section', role: 'department', dept: 'External Section' },
  { username: 'masters',  email: 'masters@cloud.neduet.edu.pk',  full_name: 'Masters Section',  role: 'department', dept: 'Masters Section' },
  { username: 'admin',    email: 'admin@cloud.neduet.edu.pk',    full_name: 'Super Admin',      role: 'admin',      dept: null },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, full_name, role, dept)
  VALUES (@username, @email, @password, @full_name, @role, @dept)
`);

const updateEmailIfNull = db.prepare(`
  UPDATE users SET email = @email WHERE username = @username AND (email IS NULL OR email = '')
`);

const tx = db.transaction((rows) => {
  for (const u of rows) {
    insert.run({ ...u, password: hash });
    updateEmailIfNull.run({ username: u.username, email: u.email });
  }
});

tx(users);

console.log(`Seed complete. Default users ready (password: "${DEFAULT_PASSWORD}"):`);
users.forEach(u => console.log(`  - ${u.username}  (${u.role}${u.dept ? ', ' + u.dept : ''})`));
console.log('\nChange these passwords before real use — see README.');
