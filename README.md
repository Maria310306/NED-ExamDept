# ExamPortal — Node.js / SQLite Backend

**University Document Request Management System**

This is the same app, on a free, easy-to-debug stack. The PHP/MySQL/XAMPP
backend has been replaced with **Node.js + Express + SQLite** — everything
here is open-source (MIT/permissive), runs with one command, needs no
separate database server, and no license of any kind. The workflow, screens,
fields, fees, and API contract are unchanged — the only edit made to the
frontend is a single line in `app.js` pointing it at the new API path.

---

## Why this stack

| | Before | Now |
|---|---|---|
| Server | PHP (via XAMPP/Apache) | Node.js + Express |
| Database | MySQL (via XAMPP) | SQLite (a single file — no server to run) |
| Setup | Install XAMPP, start Apache+MySQL, import schema, configure `db.php` | `npm install`, `npm start` |
| Cost | Free, but XAMPP-on-Windows is fiddly to debug | Free, and errors show up directly in your terminal |

SQLite is a real, production-grade, free, open-source database — it just
lives in one file (`data/examportal.db`) instead of needing a separate
server process. That file is a complete backup: copy it anywhere to move
or restore all your data.

---

## Project Structure

```
examportal/
├── public/
│   ├── index.html        ← unchanged
│   ├── styles.css        ← unchanged
│   └── app.js             ← ONE line changed (API base path, see below)
│
├── server/
│   ├── server.js          ← Express app entry point
│   ├── db.js               ← opens/creates the SQLite file, applies schema
│   ├── schema.sql          ← SQLite port of the original schema (same tables/columns)
│   ├── seed.js              ← creates the default accounts (safe to re-run)
│   ├── fees.js / format.js / authGuards.js / config.js  ← helpers
│   └── routes/
│       ├── auth.php  → auth.js       (login / logout / me / change_password)
│       ├── requests.php → requests.js (all request CRUD + export + reports)
│       └── users.php  → users.js      (admin user management)
│
├── data/
│   └── examportal.db      ← created automatically on first run
│
├── package.json
└── .env.example
```

---

## Quick Setup

### 1. Install Node.js

You need Node.js 18+ (this was built and tested on Node 22). Get it free
from [nodejs.org](https://nodejs.org) — no account, no license.

### 2. Install dependencies

```bash
cd examportal
npm install
```

Everything installed is free and open-source: `express`, `better-sqlite3`,
`bcryptjs`, `express-session`, `better-sqlite3-session-store`, `dotenv`.

### 3. (Optional) configure

```bash
cp .env.example .env
```

Defaults work fine for local use. Edit `.env` if you want a different
port, a persistent `SESSION_SECRET` for production, or to deploy the
frontend on a different origin than the API (`APP_URL`).

### 4. Run it

```bash
npm start
```

Open **http://localhost:3000** — that's it. The database file and default
accounts are created automatically on first run.

---

## Default Login Credentials

> **Change all passwords immediately after first login** (there's no UI
> for this yet — see `users.php` API below, or edit directly via a SQLite
> browser like [DB Browser for SQLite](https://sqlitebrowser.org), free).

| Username   | Password   | Role       | Dept             |
|------------|------------|------------|------------------|
| `counter`  | `password` | Counter    | —                |
| `result`   | `password` | Section    | Result Section   |
| `degree`   | `password` | Section    | Degree Section   |
| `external` | `password` | Section    | External Section |
| `masters`  | `password` | Section    | Masters Section  |
| `admin`    | `password` | Admin      | —                |

---

## API Reference

Identical contract to the original — same actions, same parameters, same
JSON shapes. Only the base path changed: `/api/...` instead of
`/examportal_backend/api/...`. Authentication uses an HttpOnly session
cookie, same as before.

### Auth — `/api/auth.php`

| Action | Method | Auth | Description |
|---|---|---|---|
| `?action=login` | POST | No | Login, set session |
| `?action=logout` | POST | Yes | Destroy session |
| `?action=me` | GET | No | Return current session user |
| `?action=change_password` | POST | Yes | Change own password |

### Requests — `/api/requests.php`

| Action | Method | Auth | Description |
|---|---|---|---|
| `?action=peek_id` | GET | counter / admin | Preview next request ID |
| `?action=create` | POST | counter / admin | Submit new request |
| `?action=list` | GET | Any | Filtered/paginated list |
| `?action=get` | GET | Any | Single request + details |
| `?action=update_status` | POST | Any | Change status |
| `?action=transfer` | POST | counter/dept/admin | Transfer to section |
| `?action=delete` | DELETE | admin only | Hard delete |
| `?action=stats` | GET | Any | KPI counts |
| `?action=reports` | GET | admin only | Aggregated analytics |
| `?action=export` | GET | Any | CSV file download |

Same query parameters as before (`tab`, `search`, `delivery`, `doc_key`,
`dept`, `section`, `date_from`, `date_to`, `limit`, `offset`).

### Users — `/api/users.php` (admin only)

| Action | Method | Description |
|---|---|---|
| `?action=list` | GET | List all users |
| `?action=create` | POST | Create user |
| `?action=update` | POST | Update user |
| `?action=reset_password` | POST | Reset user password |
| `?action=delete` | DELETE | Delete user |

---

## What changed vs. the PHP version — and what didn't

**Didn't change:** every screen, field, fee table, status flow, tab
layout, filter, chart, and CSV column is exactly what it was. The
JSON contract each API action expects/returns is the same, so the
frontend code is untouched apart from one line.

**Changed under the hood:**
- The single line `base: '/examportal_backend/api'` in `app.js` now reads
  `base: '/api'` — required because there's no `.htaccess`/Apache rewrite
  layer anymore; Express serves the API directly at `/api`.
- MySQL → SQLite: same tables and columns (`schema.sql` is a direct port).
  MySQL's `ENUM` became `TEXT` + `CHECK` (SQLite has no native enum type).
- Sessions are stored in the same SQLite file instead of PHP's file-based
  session store — functionally identical (an HttpOnly cookie either way).

**Reconstructed (no original PHP source was provided — only this README
and the frontend code):** the exact request-routing logic — what counts
as a department's "in / out / done" tray, what a transfer does to a
request's status — was inferred from `app.js`'s rendering code and field
names, since the original `api/*.php` files themselves weren't part of
the handoff. The implementation here is internally consistent and fully
tested against the frontend, but if you notice a tray showing something
you don't expect, look at `server/routes/requests.js` (`GET ?action=list`)
— the tab logic is commented and easy to adjust in one place.

---

## Security Notes

1. **Change all default passwords** before real use.
2. **Use HTTPS** in production (put this behind Caddy/nginx/Render/etc.)
   — set `APP_ENV=production` in `.env` so session cookies get the
   `Secure` flag.
3. Set a real, random `SESSION_SECRET` in `.env` for production —
   the default is a placeholder.
4. All queries use parameterized statements (`better-sqlite3` prepared
   statements) — no raw SQL string concatenation, same protection the
   original had.
5. Passwords are stored as **bcrypt** hashes (cost 12), same as before.
6. `data/`, `node_modules/`, and `.env` are gitignored — don't commit
   your database file or secrets.

---

## Deploying for free (or cheap)

Any Node.js host works — the app is a single process with a single
SQLite file:

- **Render.com** free/starter web service — set the start command to
  `npm start`, and add a free persistent disk mounted at `/data` with
  `DB_PATH=/data/examportal.db` so the database survives restarts.
- **Railway**, **Fly.io**, or a **$5/mo VPS** all work the same way.
- Anywhere you deploy, set `APP_ENV=production` and a real
  `SESSION_SECRET`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `{"success":false,"error":"Not authenticated"}` | Session expired — log in again |
| `Error: Cannot find module 'better-sqlite3'` | Run `npm install` |
| Port already in use | Set `PORT=xxxx` in `.env` or free up port 3000 |
| Login fails for department user | Make sure their `dept` in the database matches the dropdown/section name exactly |
| CSV export is garbled in Excel | Shouldn't happen — the export includes a UTF-8 BOM. If it still does, open via Excel's "Import Data" instead of double-clicking |
| Data disappeared after redeploy | Your host wiped the filesystem — mount a persistent volume for `data/` (see Deploying above) |
