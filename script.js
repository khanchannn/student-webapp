// Insecure OWASP training server (DO NOT USE IN PRODUCTION)
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const multer = require('multer'); // for unrestricted upload (no filter)
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// ===== Database (adjust to your local settings) =====
const pool = new Pool({
  user: 'webapp_user',
  host: '127.0.0.1',
  database: 'webapp',
  password: '123456',
  port: 5432,
});

// ===== Middleware =====
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ======== Simple auth helper ========
// cookie parser (rất đơn giản, không an toàn - intentionally insecure)
const parseCookies = (cookieHeader = '') =>
  Object.fromEntries(
    cookieHeader
      .split(';')
      .map(v => v.trim())
      .filter(Boolean)
      .map(kv => {
        const i = kv.indexOf('=');
        return i === -1
          ? [kv, '']
          : [kv.slice(0, i), decodeURIComponent(kv.slice(i + 1))];
      })
  );

// Middleware kiểm tra đăng nhập
function requireLogin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies.auth) {
    return res.redirect('/login.html');
  }
  next();
}

// ===== User Registration =====
app.post('/register', async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Thiếu username hoặc password' });
  }
  try {
    const checkSql = `SELECT id FROM users WHERE username='${username}' LIMIT 1;`;
    const check = await pool.query(checkSql);
    if (check.rows && check.rows.length) {
      return res.status(409).json({ error: 'Tên người dùng đã tồn tại' });
    }
    const insertSql = `INSERT INTO users (username, password)
                       VALUES ('${username}', '${password}') RETURNING id;`;
    const result = await pool.query(insertSql);
    if (result.rows && result.rows.length) {
      return res.json({ ok: true });
    }
    return res.status(500).json({ error: 'Không thể tạo người dùng' });
  } catch (e) {
    console.error('POST /register', e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// ===== Broken Auth: plaintext passwords + weak cookie =====
app.post('/login', async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  try {
    // INTENTIONALLY vulnerable SQLi via string concat
    const sql = `SELECT id, username, password FROM users WHERE username='${username}' LIMIT 1;`;
    const result = await pool.query(sql);
    const user = result.rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // set trivial cookie "auth=username" (no HttpOnly/SameSite/Secure)
    res.setHeader('Set-Cookie', `auth=${encodeURIComponent(user.username)}; Path=/`);
    return res.json({ ok: true, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error('POST /login', e);
    res.status(500).json({ error: 'Login error' });
  }
});

// Optional: whoami
app.get('/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  res.json({ auth: cookies.auth || null });
});

// ===== Students CRUD (IDOR + SQLi) =====
app.get('/students', requireLogin, async (req, res) => {
  const { search = '', branch = '', semester = '', sortBy = 'id', order = 'asc' } = req.query;
  let sql = `SELECT id, name, branch, semester FROM student`;
  const conds = [];
  if (search) conds.push(`(name ILIKE '%${search}%' OR branch ILIKE '%${search}%')`);
  if (branch) conds.push(`branch='${branch}'`);
  if (semester) conds.push(`semester=${semester}`);
  if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
  sql += ` ORDER BY ${sortBy} ${order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'};`;

  try {
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    console.error('GET /students', e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/students', requireLogin, async (req, res) => {
  const { name = '', branch = '', semester = '' } = req.body || {};
  const sql = `INSERT INTO student (name, branch, semester)
               VALUES ('${name}', '${branch}', ${semester})
               RETURNING id, name, branch, semester;`;
  try {
    const { rows } = await pool.query(sql);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('POST /students', e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/students/:id', requireLogin, async (req, res) => {
  const id = req.params.id;
  const { name, branch, semester } = req.body || {};
  const fields = [];
  if (name !== undefined) fields.push(`name='${name}'`);
  if (branch !== undefined) fields.push(`branch='${branch}'`);
  if (semester !== undefined) fields.push(`semester=${semester}`);
  if (!fields.length) return res.status(400).json({ error: 'No fields' });

  const sql = `UPDATE student SET ${fields.join(', ')} WHERE id=${id} RETURNING id, name, branch, semester;`;
  try {
    const { rows } = await pool.query(sql);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('PUT /students/:id', e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/students/:id', requireLogin, async (req, res) => {
  const id = req.params.id;
  const sql = `DELETE FROM student WHERE id=${id};`;
  try {
    const r = await pool.query(sql);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /students/:id', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// ===== Unrestricted File Upload =====
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

app.post('/upload', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ ok: true, file: req.file.originalname, path: `/uploads/${req.file.originalname}` });
});

app.use('/uploads', express.static(uploadsDir));

app.get('/files', requireLogin, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Cannot read uploads' });
    res.json(files);
  });
});

// =============================
// ROUTES FOR PAGES (LOGIN-FIRST FLOW)
// =============================
app.get('/', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies.auth) {
    return res.redirect('/login.html');
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (_, res) =>
  res.sendFile(path.join(__dirname, 'login.html'))
);

app.get('/upload.html', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies.auth) {
    return res.redirect('/login.html');
  }
  return res.sendFile(path.join(__dirname, 'upload.html'));
});

// ⚠️ Đưa static route xuống cuối để không override redirect
app.use(express.static(path.join(__dirname)));

// ===== Start =====
app.listen(port, () => {
  console.log(`Insecure training app running on http://localhost:${port}`);
});
