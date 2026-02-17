const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Servir arquivos estáticos (HTML/CSS/JS) a partir da raiz do projeto
app.use(express.static(path.join(__dirname)));

const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'users.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('DB open error:', err);
  console.log('SQLite DB opened at', DB_PATH);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      cpf TEXT,
      phone TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  // create trips table for admin-managed trips
  db.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT,
      date TEXT,
      category TEXT,
      seats INTEGER,
      departureTime TEXT,
      returnTime TEXT,
      description TEXT,
      points TEXT,
      price REAL,
      coverImage TEXT,
      createdBy TEXT,
      createdAt TEXT
    )
  `);

  // create banners table for admin-managed banners
  db.run(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      subtitle TEXT,
      category TEXT,
      image TEXT,
      link TEXT,
      orderIndex INTEGER,
      createdBy TEXT,
      createdAt TEXT
    )
  `);

  // Ensure backward-compat: add missing columns if DB existed before
  db.all("PRAGMA table_info('trips')", (err, cols) => {
    if (err || !Array.isArray(cols)) return;
    const names = cols.map(c => c.name);
    const checks = [];
    if (!names.includes('departureTime')) checks.push("ALTER TABLE trips ADD COLUMN departureTime TEXT");
    if (!names.includes('returnTime')) checks.push("ALTER TABLE trips ADD COLUMN returnTime TEXT");
    if (!names.includes('description')) checks.push("ALTER TABLE trips ADD COLUMN description TEXT");
    if (!names.includes('points')) checks.push("ALTER TABLE trips ADD COLUMN points TEXT");
    if (!names.includes('price')) checks.push("ALTER TABLE trips ADD COLUMN price REAL");
    if (!names.includes('coverImage')) checks.push("ALTER TABLE trips ADD COLUMN coverImage TEXT");
    if (!names.includes('category')) checks.push("ALTER TABLE trips ADD COLUMN category TEXT");
    checks.forEach(sql => db.run(sql, () => {}));
  });

  // ensure admin user exists
  const adminEmail = 'admin@natrip.local';
  const adminPass = 'capela9797@';
  db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
    if (err) return console.warn('admin check err', err);
    if (!row) {
      const hash = bcrypt.hashSync(adminPass, 10);
      db.run('INSERT INTO users (name, cpf, phone, email, password, role) VALUES (?,?,?,?,?,?)',
        ['Admin', '00000000000', '0000000000', adminEmail, hash, 'admin'], (e) => {
          if (e) console.warn('could not create admin', e);
          else console.log('admin user created');
        });
    }
  });
});

// trips endpoints
app.get('/api/trips', (req, res) => {
  db.all('SELECT id,city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt FROM trips ORDER BY date', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler viagens' });
    const parsed = (rows||[]).map(r => {
      try {
        r.points = r.points ? JSON.parse(r.points) : [];
      } catch(e) {
        // if it's a plain string, convert to array by splitting newlines/commas
        if (typeof r.points === 'string' && r.points.trim()) {
          r.points = r.points.split(/\r?\n|,/) .map(s=>s.trim()).filter(Boolean);
        } else r.points = [];
      }
      return r;
    });
    res.json(parsed);
  });
});

// upsert array of trips: insert new or update existing by id
app.post('/api/trips/upsert', (req, res) => {
  const trips = Array.isArray(req.body.trips) ? req.body.trips : [];
  if (trips.length === 0) return res.json({ ok: true });
  const tasks = trips.map(t => new Promise((resolve) => {
    const dep = t.departureTime || t.departure || '';
    const ret = t.returnTime || t.return || '';
    const desc = t.description || t.desc || '';
    const category = t.category || '';
    const cover = t.coverImage || '';
    let pointsVal = '';
    if (Array.isArray(t.points)) pointsVal = JSON.stringify(t.points);
    else if (typeof t.points === 'string') pointsVal = t.points;
    else pointsVal = '';
    const price = (typeof t.price !== 'undefined' && t.price !== null && t.price !== '') ? parseFloat(t.price) : null;
    if (t.id) {
      db.run('UPDATE trips SET city=?, date=?, category=?, seats=?, departureTime=?, returnTime=?, description=?, points=?, price=?, coverImage=?, createdBy=?, createdAt=? WHERE id=?', [t.city||'', t.date||'', category, t.seats||0, dep, ret, desc, pointsVal, price, cover, t.createdBy||'', t.createdAt||'', t.id], () => resolve());
    } else {
      db.run('INSERT INTO trips (city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [t.city||'', t.date||'', category, t.seats||0, dep, ret, desc, pointsVal, price, cover, t.createdBy||'', t.createdAt||''], () => resolve());
    }
  }));
  Promise.all(tasks).then(() => res.json({ ok: true }));
});

app.post('/api/trips/delete', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  db.run('DELETE FROM trips WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao deletar viagem' });
    res.json({ ok: true });
  });
});

// banners endpoints
app.get('/api/banners', (req, res) => {
  db.all('SELECT id,title,subtitle,category,image,link,orderIndex,createdBy,createdAt FROM banners ORDER BY COALESCE(orderIndex,0), id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler banners' });
    res.json(rows || []);
  });
});

app.post('/api/banners/upsert', (req, res) => {
  const banners = Array.isArray(req.body.banners) ? req.body.banners : [];
  if (banners.length === 0) return res.json({ ok: true });
  const tasks = banners.map(b => new Promise((resolve) => {
    const title = b.title || '';
    const subtitle = b.subtitle || '';
    const category = b.category || '';
    const image = b.image || '';
    const link = b.link || '';
    const orderIndex = (typeof b.orderIndex !== 'undefined' && b.orderIndex !== null) ? parseInt(b.orderIndex,10) : null;
    const createdBy = b.createdBy || '';
    const createdAt = b.createdAt || new Date().toISOString();
    if (b.id) {
      db.run('UPDATE banners SET title=?, subtitle=?, category=?, image=?, link=?, orderIndex=?, createdBy=?, createdAt=? WHERE id=?', [title, subtitle, category, image, link, orderIndex, createdBy, createdAt, b.id], () => resolve());
    } else {
      db.run('INSERT INTO banners (title,subtitle,category,image,link,orderIndex,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?)', [title, subtitle, category, image, link, orderIndex, createdBy, createdAt], () => resolve());
    }
  }));
  Promise.all(tasks).then(() => res.json({ ok: true }));
});

app.post('/api/banners/delete', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  db.run('DELETE FROM banners WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao deletar banner' });
    res.json({ ok: true });
  });
});

function sanitizeUser(u) {
  if (!u) return u;
  return {
    id: u.id,
    name: u.name,
    cpf: u.cpf,
    phone: u.phone,
    email: u.email,
    role: u.role || 'user'
  };
}

app.get('/api/users', (req, res) => {
  db.all('SELECT id,name,cpf,phone,email,role FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler usuários' });
    res.json(rows.map(r => sanitizeUser(r)));
  });
});

app.post('/api/signup', (req, res) => {
  const { name, cpf, phone, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name, cpf, phone, email, password, role) VALUES (?,?,?,?,?,?)',
    [name || '', cpf || '', phone || '', email.toLowerCase(), hash, 'user'], function (err) {
      if (err) {
        return res.status(400).json({ error: 'Não foi possível criar usuário (talvez e-mail já exista)' });
      }
      db.get('SELECT id,name,cpf,phone,email,role FROM users WHERE id = ?', [this.lastID], (e, row) => {
        if (e) return res.status(500).json({ error: 'Erro após criar usuário' });
        res.json(sanitizeUser(row));
      });
    });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    if (!bcrypt.compareSync(password, row.password || '')) return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    res.json(sanitizeUser(row));
  });
});

// Upsert array of users (used by client-side sync). This will insert or update records by email.
app.post('/api/users/upsert', (req, res) => {
  const users = Array.isArray(req.body.users) ? req.body.users : [];
  if (users.length === 0) return res.json({ ok: true });
  const tasks = users.map(u => new Promise((resolve) => {
    const email = (u.email || '').toLowerCase();
    if (!email) return resolve();
    db.get('SELECT id,password FROM users WHERE email = ?', [email], (err, existing) => {
      const passwd = (u.password || '');
      const process = () => {
        if (existing) {
          // update (if password provided, hash it)
          let updateSql = 'UPDATE users SET name=?, cpf=?, phone=?, role=?';
          const params = [u.name||'', u.cpf||'', u.phone||'', u.role||'user'];
          if (passwd) {
            const h = bcrypt.hashSync(passwd, 10);
            updateSql += ', password=?'; params.push(h);
          }
          updateSql += ' WHERE email=?'; params.push(email);
          db.run(updateSql, params, () => resolve());
        } else {
          const h = passwd ? bcrypt.hashSync(passwd, 10) : bcrypt.hashSync('pwd'+Date.now(), 10);
          db.run('INSERT OR IGNORE INTO users (name,cpf,phone,email,password,role) VALUES (?,?,?,?,?,?)',
            [u.name||'', u.cpf||'', u.phone||'', email, h, u.role||'user'], () => resolve());
        }
      };
      process();
    });
  }));

  Promise.all(tasks).then(() => res.json({ ok: true }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Backend running on port', PORT));

// --- PayPal server-side helpers and endpoints ---
function getPayPalBase() {
  return (process.env.PAYPAL_MODE === 'live') ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_SECRET || '';
  if (!client || !secret) throw new Error('PayPal credentials not configured');
  const tokenUrl = `${getPayPalBase()}/v1/oauth2/token`;
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${client}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>'');
    throw new Error('PayPal token error: ' + resp.status + ' ' + txt);
  }
  const data = await resp.json();
  return data.access_token;
}

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const amount = (req.body && req.body.amount) ? String(req.body.amount) : null;
    if (!amount) return res.status(400).json({ error: 'amount obrigatório' });
    const token = await getPayPalAccessToken();
    const url = `${getPayPalBase()}/v2/checkout/orders`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'BRL', value: amount } }] })
    });
    const body = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: 'Erro criando ordem', details: body });
    res.json({ id: body.id, order: body });
  } catch (e) {
    console.error('paypal create-order err', e.message || e);
    res.status(500).json({ error: 'Erro interno ao criar ordem PayPal' });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const orderID = req.body && req.body.orderID;
    if (!orderID) return res.status(400).json({ error: 'orderID obrigatório' });
    const token = await getPayPalAccessToken();
    const url = `${getPayPalBase()}/v2/checkout/orders/${orderID}/capture`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const body = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: 'Erro capturando ordem', details: body });
    res.json(body);
  } catch (e) {
    console.error('paypal capture-order err', e.message || e);
    res.status(500).json({ error: 'Erro interno ao capturar ordem PayPal' });
  }
});
