require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Servir arquivos estáticos (HTML/CSS/JS) a partir da raiz do projeto
app.use(express.static(path.join(__dirname)));

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'natrip',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('MySQL connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('MySQL connection error:', err);
  });

// Initialize database tables
(async () => {
  try {
    const connection = await pool.getConnection();
    
    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        cpf VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50),
        referralCode VARCHAR(20),
        source VARCHAR(255),
        referredBy VARCHAR(20),
        INDEX idx_email (email),
        INDEX idx_referralCode (referralCode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create trips table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        city VARCHAR(255),
        date VARCHAR(50),
        category VARCHAR(100),
        seats INT,
        departureTime VARCHAR(50),
        returnTime VARCHAR(50),
        description TEXT,
        points TEXT,
        price DECIMAL(10,2),
        coverImage VARCHAR(500),
        createdBy VARCHAR(255),
        createdAt VARCHAR(50),
        INDEX idx_date (date),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create banners table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255),
        subtitle VARCHAR(255),
        category VARCHAR(100),
        image VARCHAR(500),
        link VARCHAR(500),
        orderIndex INT,
        createdBy VARCHAR(255),
        createdAt VARCHAR(50),
        INDEX idx_order (orderIndex)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create admin user if it doesn't exist
    const adminEmail = 'admin@natrip.local';
    const adminPass = 'capela9797@';
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
    
    if (rows.length === 0) {
      const hash = bcrypt.hashSync(adminPass, 10);
      await connection.query(
        'INSERT INTO users (name, cpf, phone, email, password, role) VALUES (?,?,?,?,?,?)',
        ['Admin', '00000000000', '0000000000', adminEmail, hash, 'admin']
      );
      console.log('Admin user created');
    }
    
    connection.release();
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
})();

// trips endpoints
app.get('/api/trips', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id,city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt FROM trips ORDER BY date');
    const parsed = (rows||[]).map(r => {
      try {
        r.points = r.points ? JSON.parse(r.points) : [];
      } catch(e) {
        if (typeof r.points === 'string' && r.points.trim()) {
          r.points = r.points.split(/\r?\n|,/) .map(s=>s.trim()).filter(Boolean);
        } else r.points = [];
      }
      return r;
    });
    res.json(parsed);
  } catch (err) {
    console.error('Error fetching trips:', err);
    res.status(500).json({ error: 'Erro ao ler viagens' });
  }
});

// upsert array of trips: insert new or update existing by id
app.post('/api/trips/upsert', async (req, res) => {
  const trips = Array.isArray(req.body.trips) ? req.body.trips : [];
  if (trips.length === 0) return res.json({ ok: true });
  
  try {
    for (const t of trips) {
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
        await pool.query(
          'UPDATE trips SET city=?, date=?, category=?, seats=?, departureTime=?, returnTime=?, description=?, points=?, price=?, coverImage=?, createdBy=?, createdAt=? WHERE id=?',
          [t.city||'', t.date||'', category, t.seats||0, dep, ret, desc, pointsVal, price, cover, t.createdBy||'', t.createdAt||'', t.id]
        );
      } else {
        await pool.query(
          'INSERT INTO trips (city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [t.city||'', t.date||'', category, t.seats||0, dep, ret, desc, pointsVal, price, cover, t.createdBy||'', t.createdAt||'']
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error upserting trips:', err);
    res.status(500).json({ error: 'Erro ao salvar viagens' });
  }
});

app.post('/api/trips/delete', async (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  
  try {
    await pool.query('DELETE FROM trips WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting trip:', err);
    res.status(500).json({ error: 'Erro ao deletar viagem' });
  }
});

// banners endpoints
app.get('/api/banners', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id,title,subtitle,category,image,link,orderIndex,createdBy,createdAt FROM banners ORDER BY COALESCE(orderIndex,0), id');
    res.json(rows || []);
  } catch (err) {
    console.error('Error fetching banners:', err);
    res.status(500).json({ error: 'Erro ao ler banners' });
  }
});

app.post('/api/banners/upsert', async (req, res) => {
  const banners = Array.isArray(req.body.banners) ? req.body.banners : [];
  if (banners.length === 0) return res.json({ ok: true });
  
  try {
    for (const b of banners) {
      const title = b.title || '';
      const subtitle = b.subtitle || '';
      const category = b.category || '';
      const image = b.image || '';
      const link = b.link || '';
      const orderIndex = (typeof b.orderIndex !== 'undefined' && b.orderIndex !== null) ? parseInt(b.orderIndex,10) : null;
      const createdBy = b.createdBy || '';
      const createdAt = b.createdAt || new Date().toISOString();
      
      if (b.id) {
        await pool.query(
          'UPDATE banners SET title=?, subtitle=?, category=?, image=?, link=?, orderIndex=?, createdBy=?, createdAt=? WHERE id=?',
          [title, subtitle, category, image, link, orderIndex, createdBy, createdAt, b.id]
        );
      } else {
        await pool.query(
          'INSERT INTO banners (title,subtitle,category,image,link,orderIndex,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?)',
          [title, subtitle, category, image, link, orderIndex, createdBy, createdAt]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error upserting banners:', err);
    res.status(500).json({ error: 'Erro ao salvar banners' });
  }
});

app.post('/api/banners/delete', async (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  
  try {
    await pool.query('DELETE FROM banners WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ error: 'Erro ao deletar banner' });
  }
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

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id,name,cpf,phone,email,role FROM users');
    res.json(rows.map(r => sanitizeUser(r)));
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Erro ao ler usuários' });
  }
});

app.post('/api/signup', async (req, res) => {
  const { name, cpf, phone, email, password, source, referredBy } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  
  try {
    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, cpf, phone, email, password, role, source, referredBy) VALUES (?,?,?,?,?,?,?,?)',
      [name || '', cpf || '', phone || '', email.toLowerCase(), hash, 'user', source || '', referredBy || '']
    );
    
    const [rows] = await pool.query(
      'SELECT id,name,cpf,phone,email,role FROM users WHERE id = ?',
      [result.insertId]
    );
    
    res.json(sanitizeUser(rows[0]));
  } catch (err) {
    console.error('Error signing up:', err);
    res.status(400).json({ error: 'Não foi possível criar usuário (talvez e-mail já exista)' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    }
    
    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password || '')) {
      return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    }
    
    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Erro no login' });
  }
});

// Upsert array of users (used by client-side sync). This will insert or update records by email.
app.post('/api/users/upsert', async (req, res) => {
  const users = Array.isArray(req.body.users) ? req.body.users : [];
  if (users.length === 0) return res.json({ ok: true });
  
  try {
    for (const u of users) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      
      const [existing] = await pool.query('SELECT id,password FROM users WHERE email = ?', [email]);
      const passwd = (u.password || '');
      
      if (existing.length > 0) {
        // update (if password provided, hash it)
        let updateSql = 'UPDATE users SET name=?, cpf=?, phone=?, role=?';
        const params = [u.name||'', u.cpf||'', u.phone||'', u.role||'user'];
        if (passwd) {
          const h = bcrypt.hashSync(passwd, 10);
          updateSql += ', password=?'; 
          params.push(h);
        }
        updateSql += ' WHERE email=?'; 
        params.push(email);
        await pool.query(updateSql, params);
      } else {
        const h = passwd ? bcrypt.hashSync(passwd, 10) : bcrypt.hashSync('pwd'+Date.now(), 10);
        await pool.query(
          'INSERT IGNORE INTO users (name,cpf,phone,email,password,role) VALUES (?,?,?,?,?,?)',
          [u.name||'', u.cpf||'', u.phone||'', email, h, u.role||'user']
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error upserting users:', err);
    res.status(500).json({ error: 'Erro ao salvar usuários' });
  }
});

// Generate random referral code (8 characters: letters and numbers)
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0,O,1,I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get or create referral code for user
app.get('/api/referral-code', async (req, res) => {
  const { email } = req.query;
  console.log('Referral code request for email:', email);
  if (!email) return res.status(400).json({ error: 'email obrigatório' });
  
  try {
    const [rows] = await pool.query('SELECT referralCode FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (rows.length === 0) {
      console.log('User not found:', email);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const user = rows[0];
    console.log('User found, referralCode:', user.referralCode);
    
    // If user already has a referral code, return it
    if (user.referralCode) {
      return res.json({ referralCode: user.referralCode });
    }
    
    // Generate new code and save it
    const newCode = generateReferralCode();
    console.log('Generating new code:', newCode);
    
    await pool.query('UPDATE users SET referralCode = ? WHERE email = ?', [newCode, email.toLowerCase()]);
    console.log('Code saved successfully');
    res.json({ referralCode: newCode });
  } catch (err) {
    console.error('Error managing referral code:', err);
    res.status(500).json({ error: 'Erro ao gerar código de convite' });
  }
});

// Get users referred by a specific referral code
app.get('/api/referrals', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email obrigatório' });
  
  try {
    // First get the user's referral code
    const [userRows] = await pool.query('SELECT referralCode FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (userRows.length === 0 || !userRows[0].referralCode) {
      return res.json({ count: 0, referrals: [] });
    }
    
    // Then find all users who signed up with this referral code
    const [referralRows] = await pool.query('SELECT name, email, id FROM users WHERE referredBy = ?', [userRows[0].referralCode]);
    
    res.json({
      count: referralRows.length,
      referrals: referralRows.map(r => ({ id: r.id, name: r.name, email: r.email }))
    });
  } catch (err) {
    console.error('Error fetching referrals:', err);
    res.status(500).json({ error: 'Erro ao buscar convidados' });
  }
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
