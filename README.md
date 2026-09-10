# KODEVEX TECHNOLOGIES

Full-stack company website + employee portal + private admin panel.

## Stack
- Node.js + Express
- SQLite + better-sqlite3
- Server-side sessions
- bcrypt password hashing
- Helmet security headers
- Vanilla HTML/CSS/JS for a lightweight, responsive UI

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Change `SESSION_SECRET` and `ADMIN_PASSWORD`.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`.

The database is created automatically in `data/kodevex.db`.

## First admin
The first startup creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
There is **no public admin registration**.

## Employee registration
An admin creates/activates an Employee ID from the Admin panel. Only active, unused Employee IDs can be used for employee registration.

## Password reset
If SMTP variables are configured, reset emails are sent through Nodemailer. In development without SMTP, the reset link is printed to the server console.

## Production checklist
- Use HTTPS.
- Set a strong random SESSION_SECRET.
- Set a production admin password.
- Configure SMTP.
- Put the app behind a reverse proxy.
- Back up the SQLite database or migrate to PostgreSQL for larger deployments.
- Restrict server/database filesystem permissions.
