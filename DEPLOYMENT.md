# ExamPortal — Deployment Guide
 
This guide covers two different ways to put ExamPortal into real use:
 
- **A) Hosted online** — reachable from any browser, over the internet.
- **B) Local install** — handed over on a USB drive and run on the
  department's own machine, reachable only on the local network (or just
  that one machine).
Pick whichever matches what the department actually needs. Both are
covered in full below.
 
---
 
## Part 1 — Choosing where to host (Option A)
 
ExamPortal is a small Node.js application with a SQLite database — a
single file (`data/examportal.db`) that must **persist** between
restarts and deployments. This one requirement rules out most "free"
hosting tiers, which typically wipe the filesystem on every redeploy or
after a period of inactivity.
 
| Option | Approx. Cost | Notes |
|---|---|---|
| **Render.com** (Starter plan) | ~$7/month | Easiest setup. Connect a GitHub repo, add a small persistent disk mounted at `/data`, deploy. Good documentation, minimal server administration needed. |
| **Railway.app** | Usage-based, similarly priced | Comparable ease of use, offers persistent volumes. |
| **A basic VPS** (DigitalOcean, Hetzner, Linode) | ~$5/month | Full control — you SSH in, install Node, run the app yourself (see Part 3 for how to keep it running). More setup work, but nothing hidden or dependent on a platform's policies. |
 
**Recommendation:** for a university department tool, a small VPS is the
most transparent and cheapest long-term option, and everything running
on it is fully within your control. Render is the better choice if
you'd rather not do any server administration at all.
 
Whichever you choose, you will need:
- A domain name (optional but recommended) pointed at the server
- **HTTPS** set up (Render/Railway handle this automatically; on a VPS,
  a free tool like [Caddy](https://caddyserver.com) or
  [Certbot](https://certbot.eff.org) can set this up in a few minutes)
- The `.env` values described in Part 4, with `APP_ENV=production`
---
 
## Part 2 — Local install via USB (Option B)
 
This is the process for handing the department a working copy on a USB
drive, to be installed directly on their own machine (assumed to have
internet access at least once, to install dependencies).
 
### What goes on the USB
 
Copy the whole project folder **except**:
- `node_modules/` — this contains a native component (`better-sqlite3`)
  that's compiled specifically for one operating system. A copy built on
  your machine will not run on theirs. It gets rebuilt fresh on their
  machine in Step 2 below.
- `data/` — they should start with a fresh, empty database.
- `.env` — contains your own secrets; they need their own (Step 3).
### Installation steps on the target machine
 
**Step 1 — Copy files and install Node.js**
Copy the project folder anywhere on the target machine (e.g.
`C:\ExamPortal`). If Node.js isn't already installed, install it free
from [nodejs.org](https://nodejs.org) (the LTS version).
 
**Step 2 — Install dependencies**
Open a terminal in the project folder and run:
```
npm install
```
This must be run once, connected to the internet, on the actual machine
that will run the app — this is what makes `better-sqlite3` and every
other dependency work correctly on that specific machine.
 
**Step 3 — Create a real `.env` file**
Copy `.env.example` to `.env`, then edit it with real values. See Part 4
below for exactly what each value should be.
 
**Step 4 — First run**
```
npm start
```
This creates `data/examportal.db` and the default accounts automatically.
Confirm it starts without errors, then open a browser to
`http://localhost:3000` (or whatever `PORT` you set) to confirm it loads.
 
**Step 5 — Change every default password immediately**
Log in as `admin` and change the password for every seeded account
before anyone else uses the system. These default accounts and
passwords should never be left as-is on a machine real staff will use.
 
**Step 6 — Keep it running permanently**
Running `npm start` in a terminal window means the app stops the moment
that window is closed, or the computer restarts. Use a process manager
so it runs continuously in the background and restarts automatically:
 
```
npm install -g pm2
pm2 start server/server.js --name examportal
pm2 startup
pm2 save
```
 
`pm2 startup` configures the machine to launch `examportal` automatically
on boot; `pm2 save` remembers this across restarts. From then on, the
department doesn't need to open a terminal at all — the app is always
running in the background.
 
*(On Windows, an alternative to `pm2` is [NSSM](https://nssm.cc), which
registers the app as a proper Windows Service.)*
 
---
 
## Part 3 — Backups (applies to both options)
 
The entire database is one file: `data/examportal.db`. Back it up the
same way you'd back up any important file — for example, a scheduled
task that copies it to another drive or cloud storage daily. There's no
database server or export process required; copying that file **is** a
complete backup, and copying a backup file back into place **is** a
complete restore.
 
---
 
## Part 4 — Environment variables (`.env`) reference
 
This is what needs to be set, and why, when moving from a development
setup to a real one:
 
| Variable | Development (current) | What to set for real use |
|---|---|---|
| `SESSION_SECRET` | Placeholder value | **Must** be changed to a long, random, unique string. This secures login sessions — anyone who knows this value could forge a login. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `APP_ENV` | unset / `development` | See the HTTPS note below — this is not a simple "always set to production." |
| `PORT` | `3000` | Set to whatever port fits your setup (`3000` is fine for local use behind a router/firewall; a VPS/hosting platform may expect a specific port). |
| `EMAIL_USER` / `EMAIL_PASS` | Your own test Gmail + App Password | The university's real sending email address once available, with its own Gmail App Password. Can be left unset for now — the app works fine without it, it just won't send emails until these are set. |
| `DB_PATH` | Default (`./data/examportal.db`) | Leave as default for a local install. For hosted options with a separate persistent disk (Render, etc.), point this at that disk's mount path. |
| `APP_URL` | unset | Only needed if the frontend and backend are hosted on two different domains/origins. For the normal setup (this server serves both), leave unset. |
 
### Important: the HTTPS / `APP_ENV=production` gotcha
 
Setting `APP_ENV=production` makes the login cookie `Secure`, which
means browsers will **only send it over HTTPS** — never plain HTTP.
 
- **If the deployment has real HTTPS** (a domain with an SSL certificate,
  or a hosting platform that provides HTTPS automatically) → set
  `APP_ENV=production`.
- **If it's running on a local machine or local network without HTTPS**
  (e.g. accessed as `http://192.168.x.x:3000` on campus) → **leave
  `APP_ENV` unset or set to `development`**, even though it's "in real
  use." Setting it to `production` here would silently break logins —
  the cookie would never actually reach the browser, and staff would
  appear to log in successfully but immediately get logged back out.
If in doubt: check the address bar. If it starts with `https://`, use
`production`. If it starts with `http://`, don't.
 
---
 
## Pre-launch checklist
 
- [ ] `SESSION_SECRET` changed to a real random value
- [ ] `APP_ENV` set correctly per the HTTPS note above
- [ ] Every default account password changed
- [ ] `EMAIL_USER` / `EMAIL_PASS` set (once the university's official
      email is ready), or intentionally left unset for now
- [ ] A backup routine in place for `data/examportal.db`
- [ ] The app is running under `pm2` (or equivalent) so it survives a
      restart or crash
 