require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();

// CORS configuration - allow all origins in development, configure for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*')
    : '*',
  credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Servir arquivos estáticos (HTML/CSS/JS) a partir da raiz do projeto
app.use(express.static(path.join(__dirname)));

// PostgreSQL connection pool
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  connectionTimeoutMillis: 10000,
};

console.log('Database configuration:', {
  hasConnectionString: !!process.env.DATABASE_URL,
  ssl: dbConfig.ssl,
  env: process.env.NODE_ENV
});

const pool = new Pool(dbConfig);

// Test database connection with retry
let dbConnected = false;
async function testDbConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('✓ PostgreSQL connected successfully');
      console.log('  Server time:', result.rows[0].now);
      dbConnected = true;
      client.release();
      return true;
    } catch (err) {
      console.error(`✗ PostgreSQL connection error (attempt ${i + 1}/${retries}):`, err.message);
      console.error('  Error code:', err.code);
      if (i < retries - 1) {
        console.log('Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  console.error('❌ CRITICAL: Failed to connect to PostgreSQL after', retries, 'attempts');
  console.error('   Please verify:');
  console.error('   1. DATABASE_URL environment variable is set correctly');
  console.error('   2. PostgreSQL server is running and accessible');
  console.error('   3. Network/firewall is not blocking the connection');
  return false;
}

testDbConnection();

// Initialize database tables
(async () => {
  try {
    const client = await pool.connect();
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        cpf VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50),
        referralCode VARCHAR(20),
        source VARCHAR(255),
        referredBy VARCHAR(20)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_referralCode ON users(referralCode)`);

    // Create trips table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        city VARCHAR(255),
        date VARCHAR(50),
        category VARCHAR(100),
        seats INTEGER,
        departureTime VARCHAR(50),
        returnTime VARCHAR(50),
        description TEXT,
        points TEXT,
        price DECIMAL(10,2),
        coverImage VARCHAR(500),
        createdBy VARCHAR(255),
        createdAt VARCHAR(50)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trips_category ON trips(category)`);

    // Create banners table
    await client.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        subtitle VARCHAR(255),
        category VARCHAR(100),
        image VARCHAR(500),
        link VARCHAR(500),
        orderIndex INTEGER,
        createdBy VARCHAR(255),
        createdAt VARCHAR(50)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(orderIndex)`);

    // Create admin user if it doesn't exist
    const adminEmail = 'admin@natrip.local';
    const adminPass = 'capela9797@';
    const result = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (result.rows.length === 0) {
      const hash = bcrypt.hashSync(adminPass, 10);
      await client.query(
        'INSERT INTO users (name, cpf, phone, email, password, role) VALUES ($1, $2, $3, $4, $5, $6)',
        ['Admin', '00000000000', '0000000000', adminEmail, hash, 'admin']
      );
      console.log('Admin user created');
    }
    
    client.release();
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
})();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.2.0',
      dbType: 'PostgreSQL'
    });
  } catch (err) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
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
    const result = await pool.query('SELECT id,name,cpf,phone,email,role FROM users');
    res.json(result.rows.map(r => sanitizeUser(r)));
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
    const result = await pool.query(
      'INSERT INTO users (name, cpf, phone, email, password, role, source, referredBy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [name || '', cpf || '', phone || '', email.toLowerCase(), hash, 'user', source || '', referredBy || '']
    );
    
    const userResult = await pool.query(
      'SELECT id,name,cpf,phone,email,role FROM users WHERE id = $1',
      [result.rows[0].id]
    );
    
    res.json(sanitizeUser(userResult.rows[0]));
  } catch (err) {
    console.error('Error signing up:', err);
    res.status(400).json({ error: 'Não foi possível criar usuário (talvez e-mail já exista)' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  console.log('Login attempt for:', email);
  
  if (!email || !password) {
    console.log('Login failed: missing credentials');
    return res.status(400).json({ error: 'email e password obrigatórios' });
  }
  
  try {
    // Test database connection first
    let client;
    try {
      client = await pool.connect();
      client.release();
    } catch (dbErr) {
      console.error('Database connection failed:', dbErr.message);
      console.error('Error code:', dbErr.code);
      return res.status(503).json({ 
        error: 'Banco de dados indisponível. Verifique a configuração do PostgreSQL.',
        details: process.env.NODE_ENV === 'production' ? 'Database unavailable' : dbErr.message
      });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    console.log('Users found:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('Login failed: user not found');
      return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    }
    
    const user = result.rows[0];
    const passwordMatch = bcrypt.compareSync(password, user.password || '');
    console.log('Password match:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Login failed: invalid password');
      return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    }
    
    console.log('Login successful for:', email);
    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('Error logging in:', err.message);
    console.error('Error code:', err.code);
    console.error('Full error:', err);
    res.status(500).json({ 
      error: 'Erro no login', 
      details: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    });
  }
});

// Upsert array of users
app.post('/api/users/upsert', async (req, res) => {
  const users = Array.isArray(req.body.users) ? req.body.users : [];
  if (users.length === 0) return res.json({ ok: true });
  
  try {
    for (const u of users) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      
      const existing = await pool.query('SELECT id,password FROM users WHERE email = $1', [email]);
      const passwd = (u.password || '');
      
      if (existing.rows.length > 0) {
        // update
        if (passwd) {
          const h = bcrypt.hashSync(passwd, 10);
          await pool.query(
            'UPDATE users SET name=$1, cpf=$2, phone=$3, role=$4, password=$5 WHERE email=$6',
            [u.name||'', u.cpf||'', u.phone||'', u.role||'user', h, email]
          );
        } else {
          await pool.query(
            'UPDATE users SET name=$1, cpf=$2, phone=$3, role=$4 WHERE email=$5',
            [u.name||'', u.cpf||'', u.phone||'', u.role||'user', email]
          );
        }
      } else {
        const h = passwd ? bcrypt.hashSync(passwd, 10) : bcrypt.hashSync('pwd'+Date.now(), 10);
        await pool.query(
          'INSERT INTO users (name,cpf,phone,email,password,role) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING',
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

// trips endpoints
app.get('/api/trips', async (req, res) => {
  try {
    const result = await pool.query('SELECT id,city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt FROM trips ORDER BY date');
    const parsed = (result.rows||[]).map(r => {
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
          'UPDATE trips SET city=$1, date=$2, category=$3, seats=$4, departureTime=$5, returnTime=$6, description=$7, points=$8, price=$9, coverImage=$10, createdBy=$11, createdAt=$12 WHERE id=$13',
          [t.city||'', t.date||'', category, t.seats||0, dep, ret, desc, pointsVal, price, cover, t.createdBy||'', t.createdAt||'', t.id]
        );
      } else {
        await pool.query(
          'INSERT INTO trips (city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
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
    await pool.query('DELETE FROM trips WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting trip:', err);
    res.status(500).json({ error: 'Erro ao deletar viagem' });
  }
});

// banners endpoints
app.get('/api/banners', async (req, res) => {
  try {
    const result = await pool.query('SELECT id,title,subtitle,category,image,link,orderIndex,createdBy,createdAt FROM banners ORDER BY COALESCE(orderIndex,0), id');
    res.json(result.rows || []);
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
          'UPDATE banners SET title=$1, subtitle=$2, category=$3, image=$4, link=$5, orderIndex=$6, createdBy=$7, createdAt=$8 WHERE id=$9',
          [title, subtitle, category, image, link, orderIndex, createdBy, createdAt, b.id]
        );
      } else {
        await pool.query(
          'INSERT INTO banners (title,subtitle,category,image,link,orderIndex,createdBy,createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
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
    await pool.query('DELETE FROM banners WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ error: 'Erro ao deletar banner' });
  }
});

// Generate random referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
    const result = await pool.query('SELECT referralCode FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      console.log('User not found:', email);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const user = result.rows[0];
    console.log('User found, referralCode:', user.referralcode);
    
    if (user.referralcode) {
      return res.json({ referralCode: user.referralcode });
    }
    
    const newCode = generateReferralCode();
    console.log('Generating new code:', newCode);
    
    await pool.query('UPDATE users SET referralCode = $1 WHERE email = $2', [newCode, email.toLowerCase()]);
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
    const userResult = await pool.query('SELECT referralCode FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (userResult.rows.length === 0 || !userResult.rows[0].referralcode) {
      return res.json({ count: 0, referrals: [] });
    }
    
    const referralResult = await pool.query('SELECT name, email, id FROM users WHERE referredBy = $1', [userResult.rows[0].referralcode]);
    
    res.json({
      count: referralResult.rows.length,
      referrals: referralResult.rows.map(r => ({ id: r.id, name: r.name, email: r.email }))
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
