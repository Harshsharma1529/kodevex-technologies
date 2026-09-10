require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const fs = require("fs");
const dbDir = path.join(ROOT, "data");

// Create data folder before opening database
fs.mkdirSync(dbDir, { recursive: true });

// Open SQLite database
const db = new Database(path.join(dbDir, "kodevex.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','employee')),
  job_title TEXT DEFAULT 'Employee',
  department TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_ids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','used')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY(project_id, user_id),
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to INTEGER,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','submitted','completed')),
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Remote',
  type TEXT NOT NULL DEFAULT 'Full-Time' CHECK(type IN ('Full-Time','Part-Time','Contract','Internship','Remote')),
  experience TEXT DEFAULT '1-3 years',
  salary TEXT DEFAULT 'Competitive',
  description TEXT NOT NULL,
  requirements TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  candidate_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  resume_url TEXT NOT NULL,
  cover_note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','shortlisted','rejected','hired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
`);

function seedJobs() {
  try {
    const count = db.prepare("SELECT COUNT(*) AS c FROM jobs").get().c;
    if (count === 0) {
      const insert = db.prepare(`
        INSERT INTO jobs (title, department, location, type, experience, salary, description, requirements, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `);
      insert.run(
        "Full Stack Engineer (Node.js / React)",
        "Engineering",
        "Remote",
        "Full-Time",
        "2-4 years",
        "₹7 - 12 LPA",
        "Join our engineering team building scalable SaaS web platforms, automated client portals, and resilient REST APIs. You will own features from architecture to deployment.",
        "• Strong proficiency with JavaScript, Node.js, Express, and modern React\n• Solid understanding of relational databases (SQLite / PostgreSQL)\n• Experience with RESTful APIs, Git workflows, and deployment\n• High attention to software security and code quality"
      );
      insert.run(
        "AI & Automation Developer (Python / LLMs)",
        "AI & Automation",
        "Remote",
        "Full-Time",
        "1-3 years",
        "₹6 - 11 LPA",
        "Build modern AI agents, document processing pipelines, and workflow automations integrating LLM models, LangChain, and third-party APIs.",
        "• Proficiency in Python and modern API automation\n• Hands-on experience with LLMs, prompt engineering, and embeddings\n• Familiarity with Webhooks, async programming, and vector databases\n• Passion for experimenting with cutting-edge AI technologies"
      );
      insert.run(
        "UI / UX Product Designer",
        "Design",
        "Remote",
        "Full-Time",
        "2+ years",
        "₹5 - 9 LPA",
        "Design clean, intuitive, and modern digital interfaces for our web platforms, mobile experiences, and client products.",
        "• Deep mastery of Figma, wireframing, and interactive design systems\n• Strong grasp of modern web aesthetics, typography, and micro-interactions\n• Proven portfolio of responsive web applications and dashboards\n• Clear communication and collaboration skills with engineering"
      );
      insert.run(
        "Frontend Web Developer (React / Next.js)",
        "Engineering",
        "Remote",
        "Full-Time",
        "1-3 years",
        "₹5 - 8 LPA",
        "Build fluid, accessible, high-performance web applications using modern React, CSS animations, and TypeScript.",
        "• Strong proficiency in modern JavaScript, React, CSS3, and HTML5\n• Experience crafting responsive user interfaces with attention to detail\n• Familiarity with state management, API integration, and performance optimization"
      );
    }
  } catch (err) {
    console.error("Jobs seed error:", err);
  }
}
seedJobs();

function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@kodevex.local").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeThisImmediately!";
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare(`
      INSERT INTO users (name,email,password_hash,role,job_title,department)
      VALUES (?,?,?,?,?,?)
    `).run("KODEVEX Admin", email, hash, "admin", "Administrator", "Management");
    console.log(`Admin created: ${email}`);
  }
}
seedAdmin();

function clean(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, employeeId: user.employee_id, name: user.name,
    email: user.email, role: user.role, jobTitle: user.job_title,
    department: user.department, avatarUrl: user.avatar_url, status: user.status
  };
}
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.db", dir: dbDir }),
  secret: process.env.SESSION_SECRET || "dev-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use(express.static(path.join(ROOT, "public")));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Authentication required." });
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(req.session.userId);
  if (!user) {
    req.session.destroy(() => { });
    return res.status(401).json({ error: "Session expired." });
  }
  req.user = user;
  next();
}
function requireEmployee(req, res, next) {
  requireAuth(req, res, () => {
    if (!["employee", "admin"].includes(req.user.role)) return res.status(403).json({ error: "Employee access required." });
    next();
  });
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    next();
  });
}

function notify(userId, title, message) {
  if (!userId) return;
  db.prepare("INSERT INTO notifications (user_id,title,message) VALUES (?,?,?)")
    .run(userId, title, message);
}

async function sendResetEmail(email, resetUrl) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`Password reset link for ${email}: ${resetUrl}`);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "KODEVEX Technologies password reset",
    text: `Reset your password using this link: ${resetUrl}`
  });
  return true;
}

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND status='active'").get(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/signup", (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  const employeeId = clean(req.body.employeeId, 50).toUpperCase();

  if (!name || !email || !employeeId || password.length < 8)
    return res.status(400).json({ error: "Name, email, Employee ID and an 8+ character password are required." });

  const validId = db.prepare("SELECT * FROM employee_ids WHERE code=? AND status='active'").get(employeeId);
  if (!validId) return res.status(400).json({ error: "Invalid or unavailable Employee ID." });

  if (db.prepare("SELECT id FROM users WHERE email=? OR employee_id=?").get(email, employeeId))
    return res.status(409).json({ error: "An account already exists with this email or Employee ID." });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(`
    INSERT INTO users (employee_id,name,email,password_hash,role,job_title)
    VALUES (?,?,?,?, 'employee','Employee')
  `).run(employeeId, name, email, hash);

  db.prepare("UPDATE employee_ids SET status='used' WHERE id=?").run(validId.id);
  req.session.userId = info.lastInsertRowid;
  notify(info.lastInsertRowid, "Welcome to KODEVEX", "Your employee account is ready.");
  res.status(201).json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid)) });
});

app.post("/api/auth/signin", (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || user.status !== "active" || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Invalid email or password." });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/signout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email=? AND status='active'").get(email);
  // Do not reveal whether an email exists.
  if (!user) return res.json({ message: "If the account exists, a reset link has been generated." });

  const token = makeToken();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES (?,?,?)")
    .run(user.id, hashToken(token), expires);

  const url = `${process.env.APP_URL || `http://localhost:${PORT}`}/reset-password.html?token=${token}`;
  try {
    const mailed = await sendResetEmail(email, url);
    res.json({ message: mailed ? "Check your email for the reset link." : "Reset link generated. In development, check the server console." });
  } catch {
    res.status(500).json({ error: "Unable to send reset email. Check SMTP configuration." });
  }
});

app.post("/api/auth/reset-password", (req, res) => {
  const token = clean(req.body.token, 200);
  const password = String(req.body.password || "");
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const reset = db.prepare(`
    SELECT * FROM password_resets
    WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(hashToken(token));

  if (!reset) return res.status(400).json({ error: "Reset link is invalid or expired." });

  const hash = bcrypt.hashSync(password, 12);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, reset.user_id);
  db.prepare("UPDATE password_resets SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(reset.id);
  res.json({ message: "Password updated successfully." });
});

app.get("/api/employee/dashboard", requireEmployee, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, COUNT(DISTINCT t.id) AS task_count,
      SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS completed_count
    FROM projects p
    JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=?
    LEFT JOIN tasks t ON t.project_id=p.id
    GROUP BY p.id ORDER BY p.id DESC
  `).all(req.user.id);

  const tasks = db.prepare(`
    SELECT t.*, p.name AS project_name
    FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
    WHERE t.assigned_to=? ORDER BY
      CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END, t.deadline ASC
  `).all(req.user.id);

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 10
  `).all(req.user.id);

  res.json({ user: publicUser(req.user), projects, tasks, notifications });
});

app.patch("/api/employee/profile", requireEmployee, (req, res) => {
  const name = clean(req.body.name, 100);
  const jobTitle = clean(req.body.jobTitle, 100);
  const department = clean(req.body.department, 100);
  if (!name) return res.status(400).json({ error: "Name is required." });
  db.prepare("UPDATE users SET name=?, job_title=?, department=? WHERE id=?")
    .run(name, jobTitle, department, req.user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)) });
});

app.patch("/api/employee/tasks/:id", requireEmployee, (req, res) => {
  const id = Number(req.params.id);
  const status = clean(req.body.status, 30);
  if (!["pending", "in_progress", "submitted", "completed"].includes(status))
    return res.status(400).json({ error: "Invalid status." });

  const task = db.prepare("SELECT * FROM tasks WHERE id=? AND assigned_to=?").get(id, req.user.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  db.prepare("UPDATE tasks SET status=? WHERE id=?").run(status, id);
  notify(req.user.id, "Task updated", `Task "${task.title}" is now ${status.replace("_", " ")}.`);
  res.json({ ok: true });
});

app.post("/api/employee/tasks/:id/submissions", requireEmployee, (req, res) => {
  const id = Number(req.params.id);
  const note = clean(req.body.note, 3000);
  const task = db.prepare("SELECT * FROM tasks WHERE id=? AND assigned_to=?").get(id, req.user.id);
  if (!task) return res.status(404).json({ error: "Task not found." });
  if (!note) return res.status(400).json({ error: "Submission note is required." });

  db.prepare("INSERT INTO submissions (task_id,user_id,note) VALUES (?,?,?)").run(id, req.user.id, note);
  db.prepare("UPDATE tasks SET status='submitted' WHERE id=?").run(id);
  const admins = db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all();
  admins.forEach(a => notify(a.id, "New task submission", `${req.user.name} submitted work for "${task.title}".`));
  res.json({ ok: true });
});

app.get("/api/employee/tasks/:id/submissions", requireEmployee, (req, res) => {
  const id = Number(req.params.id);
  const submissions = db.prepare("SELECT * FROM submissions WHERE task_id=? AND user_id=? ORDER BY id DESC").all(id, req.user.id);
  res.json({ submissions });
});

app.patch("/api/employee/notifications/:id/read", requireEmployee, (req, res) => {
  db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?")
    .run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

/* ADMIN */
app.get("/api/admin/overview", requireAdmin, (req, res) => {
  const stats = {
    employees: db.prepare("SELECT COUNT(*) c FROM users WHERE role='employee' AND status='active'").get().c,
    projects: db.prepare("SELECT COUNT(*) c FROM projects").get().c,
    pendingTasks: db.prepare("SELECT COUNT(*) c FROM tasks WHERE status IN ('pending','in_progress','submitted')").get().c,
    completedTasks: db.prepare("SELECT COUNT(*) c FROM tasks WHERE status='completed'").get().c
  };
  const recent = db.prepare(`
    SELECT s.*, u.name AS employee_name, t.title AS task_title, p.name AS project_name
    FROM submissions s
    JOIN users u ON u.id=s.user_id
    JOIN tasks t ON t.id=s.task_id
    LEFT JOIN projects p ON p.id=t.project_id
    ORDER BY s.id DESC LIMIT 8
  `).all();
  res.json({ stats, recent });
});

app.get("/api/admin/employees", requireAdmin, (req, res) => {
  const employees = db.prepare(`
    SELECT u.id,u.employee_id,u.name,u.email,u.role,u.job_title,u.department,u.status,u.created_at,
      COUNT(DISTINCT pm.project_id) AS project_count,
      COUNT(DISTINCT t.id) AS task_count,
      SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS completed_count
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id=u.id
    LEFT JOIN tasks t ON t.assigned_to=u.id
    WHERE u.id != ?
    GROUP BY u.id ORDER BY u.id DESC
  `).all(req.user.id);
  const employeeIds = db.prepare("SELECT * FROM employee_ids ORDER BY id DESC").all();
  res.json({ employees, employeeIds });
});

app.post("/api/admin/employee-ids", requireAdmin, (req, res) => {
  let code = clean(req.body.code, 50).toUpperCase();
  if (!code) return res.status(400).json({ error: "Employee ID is required." });
  if (db.prepare("SELECT id FROM employee_ids WHERE code=?").get(code))
    return res.status(409).json({ error: "Employee ID already exists." });
  db.prepare("INSERT INTO employee_ids (code) VALUES (?)").run(code);
  res.status(201).json({ ok: true });
});

app.patch("/api/admin/employee-ids/:id", requireAdmin, (req, res) => {
  const status = clean(req.body.status, 20);
  if (!["active", "disabled"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  db.prepare("UPDATE employee_ids SET status=? WHERE id=? AND status!='used'").run(status, Number(req.params.id));
  res.json({ ok: true });
});

app.patch("/api/admin/employees/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = clean(req.body.status, 20);
  const name = clean(req.body.name, 100);
  const jobTitle = clean(req.body.jobTitle, 100);
  const department = clean(req.body.department, 100);
  const role = clean(req.body.role, 20);
  if (!["active", "disabled"].includes(status) || !name) return res.status(400).json({ error: "Invalid employee data." });

  const targetRole = ["admin", "employee"].includes(role) && id !== req.user.id ? role : undefined;

  if (targetRole) {
    db.prepare("UPDATE users SET name=?,job_title=?,department=?,status=?,role=? WHERE id=?")
      .run(name, jobTitle, department, status, targetRole, id);
    notify(id, "Permissions Updated", `Your role has been set to ${targetRole === 'admin' ? 'Administrator' : 'Employee'}.`);
  } else {
    db.prepare("UPDATE users SET name=?,job_title=?,department=?,status=? WHERE id=?")
      .run(name, jobTitle, department, status, id);
  }
  res.json({ ok: true });
});

app.patch("/api/admin/employees/:id/role", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const role = clean(req.body.role, 20);
  if (!["admin", "employee"].includes(role)) {
    return res.status(400).json({ error: "Invalid role specified." });
  }
  if (id === req.user.id) {
    return res.status(400).json({ error: "You cannot modify your own role." });
  }
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!user) return res.status(404).json({ error: "User not found." });

  db.prepare("UPDATE users SET role=? WHERE id=?").run(role, id);
  notify(id, "Permissions Updated", `You have been granted ${role === 'admin' ? 'Administrator' : 'Employee'} privileges.`);
  res.json({ ok: true, role });
});

app.get("/api/admin/projects", requireAdmin, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT pm.user_id) AS member_count,
      COUNT(DISTINCT t.id) AS task_count,
      SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS completed_count
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id=p.id
    LEFT JOIN tasks t ON t.project_id=p.id
    GROUP BY p.id ORDER BY p.id DESC
  `).all();
  res.json({ projects });
});

app.post("/api/admin/projects", requireAdmin, (req, res) => {
  const name = clean(req.body.name, 150);
  const description = clean(req.body.description, 2000);
  const startDate = clean(req.body.startDate, 20) || null;
  const dueDate = clean(req.body.dueDate, 20) || null;
  if (!name) return res.status(400).json({ error: "Project name is required." });
  const result = db.prepare("INSERT INTO projects (name,description,start_date,due_date) VALUES (?,?,?,?)")
    .run(name, description, startDate, dueDate);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.patch("/api/admin/projects/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const name = clean(req.body.name, 150);
  const description = clean(req.body.description, 2000);
  const status = clean(req.body.status, 30);
  const startDate = clean(req.body.startDate, 20) || null;
  const dueDate = clean(req.body.dueDate, 20) || null;
  if (!name) return res.status(400).json({ error: "Project name is required." });
  db.prepare("UPDATE projects SET name=?,description=?,status=?,start_date=?,due_date=? WHERE id=?")
    .run(name, description, status, startDate, dueDate, id);
  res.json({ ok: true });
});

app.delete("/api/admin/projects/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM projects WHERE id=?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/admin/projects/:id/members", requireAdmin, (req, res) => {
  const members = db.prepare(`
    SELECT u.id,u.employee_id,u.name,u.email FROM users u
    JOIN project_members pm ON pm.user_id=u.id
    WHERE pm.project_id=? AND u.role='employee'
  `).all(Number(req.params.id));
  res.json({ members });
});

app.post("/api/admin/projects/:id/members", requireAdmin, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = Number(req.body.userId);
  const employee = db.prepare("SELECT * FROM users WHERE id=? AND role='employee' AND status='active'").get(userId);
  if (!employee) return res.status(400).json({ error: "Employee not found." });
  db.prepare("INSERT OR IGNORE INTO project_members (project_id,user_id) VALUES (?,?)").run(projectId, userId);
  notify(userId, "Project assigned", `You were added to project #${projectId}.`);
  res.json({ ok: true });
});

app.delete("/api/admin/projects/:id/members/:userId", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM project_members WHERE project_id=? AND user_id=?")
    .run(Number(req.params.id), Number(req.params.userId));
  res.json({ ok: true });
});

app.get("/api/admin/tasks", requireAdmin, (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, p.name AS project_name, u.name AS employee_name, u.employee_id
    FROM tasks t
    LEFT JOIN projects p ON p.id=t.project_id
    LEFT JOIN users u ON u.id=t.assigned_to
    ORDER BY t.id DESC
  `).all();
  res.json({ tasks });
});

app.post("/api/admin/tasks", requireAdmin, (req, res) => {
  const title = clean(req.body.title, 180);
  const description = clean(req.body.description, 2500);
  const projectId = Number(req.body.projectId) || null;
  const assignedTo = Number(req.body.assignedTo) || null;
  const priority = clean(req.body.priority, 20);
  const deadline = clean(req.body.deadline, 30) || null;
  if (!title || !["low", "medium", "high", "urgent"].includes(priority))
    return res.status(400).json({ error: "Valid title and priority are required." });

  const result = db.prepare(`
    INSERT INTO tasks (project_id,title,description,assigned_to,priority,deadline)
    VALUES (?,?,?,?,?,?)
  `).run(projectId, title, description, assignedTo, priority, deadline);

  if (assignedTo) notify(assignedTo, "New task assigned", `You have been assigned "${title}".`);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.patch("/api/admin/tasks/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const title = clean(req.body.title, 180);
  const description = clean(req.body.description, 2500);
  const projectId = Number(req.body.projectId) || null;
  const assignedTo = Number(req.body.assignedTo) || null;
  const priority = clean(req.body.priority, 20);
  const status = clean(req.body.status, 30);
  const deadline = clean(req.body.deadline, 30) || null;
  if (!title || !["low", "medium", "high", "urgent"].includes(priority) ||
    !["pending", "in_progress", "submitted", "completed"].includes(status))
    return res.status(400).json({ error: "Invalid task data." });

  const old = db.prepare("SELECT * FROM tasks WHERE id=?").get(id);
  db.prepare(`
    UPDATE tasks SET project_id=?,title=?,description=?,assigned_to=?,priority=?,status=?,deadline=?
    WHERE id=?
  `).run(projectId, title, description, assignedTo, priority, status, deadline, id);

  if (assignedTo && (!old || old.assigned_to !== assignedTo))
    notify(assignedTo, "Task assigned", `You have been assigned "${title}".`);
  res.json({ ok: true });
});

app.delete("/api/admin/tasks/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id=?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/admin/submissions", requireAdmin, (req, res) => {
  const submissions = db.prepare(`
    SELECT s.*, u.name AS employee_name, u.employee_id, t.title AS task_title,
      p.name AS project_name
    FROM submissions s
    JOIN users u ON u.id=s.user_id
    JOIN tasks t ON t.id=s.task_id
    LEFT JOIN projects p ON p.id=t.project_id
    ORDER BY s.id DESC
  `).all();
  res.json({ submissions });
});

app.patch("/api/admin/submissions/:id", requireAdmin, (req, res) => {
  const status = clean(req.body.status, 30);
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid submission status." });
  const sub = db.prepare("SELECT * FROM submissions WHERE id=?").get(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: "Submission not found." });
  db.prepare("UPDATE submissions SET status=? WHERE id=?").run(status, sub.id);
  db.prepare("UPDATE tasks SET status=? WHERE id=?").run(status === "approved" ? "completed" : "in_progress", sub.task_id);
  notify(sub.user_id, "Submission reviewed", `Your submission was ${status}.`);
  res.json({ ok: true });
});

app.get("/api/admin/employees/:id/tasks", requireAdmin, (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE assigned_to=? ORDER BY id DESC").all(Number(req.params.id));
  res.json({ tasks });
});

// ---- CAREERS & JOBS (PUBLIC) ----
app.get("/api/jobs", (req, res) => {
  const dept = clean(req.query.dept, 50);
  const type = clean(req.query.type, 50);
  let query = "SELECT * FROM jobs WHERE status='active'";
  const params = [];
  if (dept && dept !== "all") {
    query += " AND department = ?";
    params.push(dept);
  }
  if (type && type !== "all") {
    query += " AND type = ?";
    params.push(type);
  }
  query += " ORDER BY id DESC";
  const jobs = db.prepare(query).all(...params);
  res.json({ jobs });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id=? AND status='active'").get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: "Job opening not found." });
  res.json({ job });
});

app.post("/api/jobs/:id/apply", (req, res) => {
  const jobId = Number(req.params.id);
  const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(jobId);
  if (!job || job.status !== "active") {
    return res.status(400).json({ error: "This job position is no longer accepting applications." });
  }

  const name = clean(req.body.name, 120);
  const email = clean(req.body.email, 120).toLowerCase();
  const phone = clean(req.body.phone, 30);
  const resumeUrl = clean(req.body.resumeUrl, 1000);
  const coverNote = clean(req.body.coverNote, 3000);

  if (!name || !email || !resumeUrl) {
    return res.status(400).json({ error: "Please provide your name, email, and resume/portfolio link." });
  }

  const result = db.prepare(`
    INSERT INTO job_applications (job_id, candidate_name, email, phone, resume_url, cover_note, status)
    VALUES (?, ?, ?, ?, ?, ?, 'new')
  `).run(jobId, name, email, phone, resumeUrl, coverNote);

  // Notify admins
  const admins = db.prepare("SELECT id FROM users WHERE role='admin'").all();
  admins.forEach(a => {
    notify(a.id, "New Job Application", `${name} applied for "${job.title}".`);
  });

  res.status(201).json({ ok: true, applicationId: result.lastInsertRowid });
});

// ---- CAREERS & JOBS (ADMIN) ----
app.get("/api/admin/jobs", requireAdmin, (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, COUNT(ja.id) AS applicant_count
    FROM jobs j
    LEFT JOIN job_applications ja ON ja.job_id=j.id
    GROUP BY j.id
    ORDER BY j.id DESC
  `).all();
  res.json({ jobs });
});

app.post("/api/admin/jobs", requireAdmin, (req, res) => {
  const title = clean(req.body.title, 180);
  const department = clean(req.body.department, 80) || "Engineering";
  const location = clean(req.body.location, 80) || "Remote";
  const type = clean(req.body.type, 40) || "Full-Time";
  const experience = clean(req.body.experience, 60) || "1-3 years";
  const salary = clean(req.body.salary, 80) || "Competitive";
  const description = clean(req.body.description, 5000);
  const requirements = clean(req.body.requirements, 5000);
  const status = clean(req.body.status, 20) || "active";

  if (!title || !description) return res.status(400).json({ error: "Job title and description are required." });

  const result = db.prepare(`
    INSERT INTO jobs (title, department, location, type, experience, salary, description, requirements, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, department, location, type, experience, salary, description, requirements, status);

  res.status(201).json({ id: result.lastInsertRowid });
});

app.patch("/api/admin/jobs/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const title = clean(req.body.title, 180);
  const department = clean(req.body.department, 80);
  const location = clean(req.body.location, 80);
  const type = clean(req.body.type, 40);
  const experience = clean(req.body.experience, 60);
  const salary = clean(req.body.salary, 80);
  const description = clean(req.body.description, 5000);
  const requirements = clean(req.body.requirements, 5000);
  const status = clean(req.body.status, 20);

  db.prepare(`
    UPDATE jobs SET title=?, department=?, location=?, type=?, experience=?, salary=?, description=?, requirements=?, status=?
    WHERE id=?
  `).run(title, department, location, type, experience, salary, description, requirements, status, id);

  res.json({ ok: true });
});

app.delete("/api/admin/jobs/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM jobs WHERE id=?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/admin/job-applications", requireAdmin, (req, res) => {
  const applications = db.prepare(`
    SELECT ja.*, j.title AS job_title, j.department AS job_department
    FROM job_applications ja
    JOIN jobs j ON j.id=ja.job_id
    ORDER BY ja.id DESC
  `).all();
  res.json({ applications });
});

app.patch("/api/admin/job-applications/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = clean(req.body.status, 30);
  if (!["new", "reviewed", "shortlisted", "rejected", "hired"].includes(status)) {
    return res.status(400).json({ error: "Invalid application status." });
  }
  db.prepare("UPDATE job_applications SET status=? WHERE id=?").run(status, id);
  res.json({ ok: true });
});

app.get("/careers", (req, res) => res.sendFile(path.join(ROOT, "public", "careers.html")));
app.get("/careers.html", (req, res) => res.sendFile(path.join(ROOT, "public", "careers.html")));
app.get("/employee", (req, res) => res.sendFile(path.join(ROOT, "public", "employee.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(ROOT, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));

app.listen(PORT, () => console.log(`KODEVEX running on http://localhost:${PORT}`));
