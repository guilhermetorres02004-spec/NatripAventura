require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const app = express();

// CORS configuration
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

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// ============================================================================
// DATABASE CONFIGURATION - Auto-detect PostgreSQL or SQLite
// ============================================================================

const USE_POSTGRES = !!process.env.DATABASE_URL;
console.log('🗄️  Database mode:', USE_POSTGRES ? 'PostgreSQL (Production)' : 'SQLite (Development)');

let db;

if (USE_POSTGRES) {
  // ========== POSTGRESQL (Production - Render) ==========
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    connectionTimeoutMillis: 10000,
  });

  // PostgreSQL wrapper to match SQLite interface
  db = {
    query: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        client.release();
        return result.rows;
      } catch (err) {
        client.release();
        throw err;
      }
    },
    run: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        client.release();
        return { lastID: result.rows[0]?.id, changes: result.rowCount };
      } catch (err) {
        client.release();
        throw err;
      }
    },
    get: async (sql, params = []) => {
      const rows = await db.query(sql, params);
      return rows[0] || null;
    },
    all: async (sql, params = []) => {
      return await db.query(sql, params);
    },
    close: () => pool.end()
  };

  // Test connection
  (async () => {
    try {
      const result = await db.query('SELECT NOW()');
      console.log('✓ PostgreSQL connected successfully');
      console.log('  Server time:', result[0].now);
    } catch (err) {
      console.error('✗ PostgreSQL connection error:', err.message);
    }
  })();

} else {
  // ========== SQLITE (Development - Local) ==========
  const sqlite3 = require('sqlite3').verbose();
  const fs = require('fs');
  
  const DB_DIR = path.join(__dirname, 'db');
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const DB_PATH = path.join(DB_DIR, 'natrip.db');

  const sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('SQLite error:', err);
    else console.log('✓ SQLite database opened at', DB_PATH);
  });

  // SQLite wrapper
  db = {
    query: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    },
    run: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    },
    all: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    },
    close: () => sqliteDb.close()
  };
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

(async () => {
  try {
    if (USE_POSTGRES) {
      // PostgreSQL schema
      await db.run(`
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
      await db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_users_referralCode ON users(referralCode)`);

      await db.run(`
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
      await db.run(`CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_trips_category ON trips(category)`);

      await db.run(`
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
      await db.run(`CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(orderIndex)`);

      await db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          category VARCHAR(100),
          stock INTEGER DEFAULT 0,
          price DECIMAL(10,2),
          image TEXT,
          createdBy VARCHAR(255),
          createdAt VARCHAR(50)
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_products_createdAt ON products(createdAt)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
      try {
        await db.run('ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100)');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN IF NOT EXISTS createdBy VARCHAR(255)');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN IF NOT EXISTS createdAt VARCHAR(50)');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)');
      } catch (e) {}

      await db.run(`
        CREATE TABLE IF NOT EXISTS payment_orders (
          id SERIAL PRIMARY KEY,
          orderToken VARCHAR(80) UNIQUE,
          provider VARCHAR(60),
          providerPaymentId VARCHAR(120),
          status VARCHAR(40),
          amountSubtotal DECIMAL(10,2),
          shippingAmount DECIMAL(10,2),
          amountTotal DECIMAL(10,2),
          checkoutData TEXT,
          deliveryData TEXT,
          paymentData TEXT,
          stockDecremented BOOLEAN DEFAULT FALSE,
          createdAt VARCHAR(50),
          updatedAt VARCHAR(50)
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_payment_orders_token ON payment_orders(orderToken)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status)`);
      try {
        await db.run('ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS paymentData TEXT');
      } catch (e) {}

    } else {
      // SQLite schema
      await db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          cpf TEXT,
          phone TEXT,
          email TEXT UNIQUE,
          password TEXT,
          role TEXT,
          referralCode TEXT,
          source TEXT,
          referredBy TEXT
        )
      `);

      await db.run(`
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

      await db.run(`
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

      await db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          category TEXT,
          stock INTEGER DEFAULT 0,
          price REAL,
          image TEXT,
          createdBy TEXT,
          createdAt TEXT
        )
      `);
      try {
        await db.run('ALTER TABLE products ADD COLUMN category TEXT');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN createdBy TEXT');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN createdAt TEXT');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN image TEXT');
      } catch (e) {}
      try {
        await db.run('ALTER TABLE products ADD COLUMN price REAL');
      } catch (e) {}

      await db.run(`
        CREATE TABLE IF NOT EXISTS payment_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          orderToken TEXT UNIQUE,
          provider TEXT,
          providerPaymentId TEXT,
          status TEXT,
          amountSubtotal REAL,
          shippingAmount REAL,
          amountTotal REAL,
          checkoutData TEXT,
          deliveryData TEXT,
          paymentData TEXT,
          stockDecremented INTEGER DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);
      try {
        await db.run('ALTER TABLE payment_orders ADD COLUMN paymentData TEXT');
      } catch (e) {}
    }

    // Create admin user
    const adminEmail = 'admin@natrip.local';
    const adminPass = 'capela9797@';
    const existingAdmin = await db.get(
      USE_POSTGRES ? 'SELECT id FROM users WHERE email = $1' : 'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );
    
    if (!existingAdmin) {
      const hash = bcrypt.hashSync(adminPass, 10);
      if (USE_POSTGRES) {
        await db.run(
          'INSERT INTO users (name, cpf, phone, email, password, role) VALUES ($1, $2, $3, $4, $5, $6)',
          ['Admin', '00000000000', '0000000000', adminEmail, hash, 'admin']
        );
      } else {
        await db.run(
          'INSERT INTO users (name, cpf, phone, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
          ['Admin', '00000000000', '0000000000', adminEmail, hash, 'admin']
        );
      }
      console.log('Admin user created');
    }
    
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
})();

// Helper to convert SQL based on database type
const SQL = (pgSql, sqliteSql) => USE_POSTGRES ? pgSql : sqliteSql;
const PARAM = (index) => USE_POSTGRES ? `$${index}` : '?';

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query(SQL('SELECT 1', 'SELECT 1'));
    res.json({ 
      status: 'ok', 
      database: 'connected',
      dbType: USE_POSTGRES ? 'PostgreSQL' : 'SQLite',
      timestamp: new Date().toISOString(),
      version: '1.2.0'
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

// Users
app.get('/api/users', async (req, res) => {
  try {
    const rows = await db.all('SELECT id,name,cpf,phone,email,role FROM users');
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
    
    if (USE_POSTGRES) {
      const result = await db.run(
        'INSERT INTO users (name, cpf, phone, email, password, role, source, referredBy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [name || '', cpf || '', phone || '', email.toLowerCase(), hash, 'user', source || '', referredBy || '']
      );
      const user = await db.get('SELECT id,name,cpf,phone,email,role FROM users WHERE id = $1', [result.lastID]);
      res.json(sanitizeUser(user));
    } else {
      const result = await db.run(
        'INSERT INTO users (name, cpf, phone, email, password, role, source, referredBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name || '', cpf || '', phone || '', email.toLowerCase(), hash, 'user', source || '', referredBy || '']
      );
      const user = await db.get('SELECT id,name,cpf,phone,email,role FROM users WHERE id = ?', [result.lastID]);
      res.json(sanitizeUser(user));
    }
  } catch (err) {
    console.error('Error signing up:', err);
    res.status(400).json({ error: 'Não foi possível criar usuário (talvez e-mail já exista)' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  console.log('Login attempt for:', email);
  
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
  
  try {
    const user = await db.get(
      SQL('SELECT * FROM users WHERE email = $1', 'SELECT * FROM users WHERE email = ?'),
      [email.toLowerCase()]
    );
    
    if (!user) {
      console.log('Login failed: user not found');
      return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    }
    
    const passwordMatch = bcrypt.compareSync(password, user.password || '');
    
    if (!passwordMatch) {
      console.log('Login failed: invalid password');
      return res.status(400).json({ error: 'E-mail ou senha inválidos' });
    }
    
    console.log('Login successful for:', email);
    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Erro no login' });
  }
});

// Trips
app.get('/api/trips', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM trips ORDER BY date');
    const parsed = rows.map(r => {
      try {
        r.points = r.points ? JSON.parse(r.points) : [];
      } catch(e) {
        if (typeof r.points === 'string' && r.points.trim()) {
          r.points = r.points.split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean);
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
      const values = [
        t.city||'', t.date||'', t.category||'', t.seats||0,
        t.departureTime||'', t.returnTime||'', t.description||'',
        Array.isArray(t.points) ? JSON.stringify(t.points) : (t.points||''),
        t.price||null, t.coverImage||'', t.createdBy||'', t.createdAt||''
      ];
      
      if (t.id) {
        await db.run(
          SQL(
            'UPDATE trips SET city=$1, date=$2, category=$3, seats=$4, departureTime=$5, returnTime=$6, description=$7, points=$8, price=$9, coverImage=$10, createdBy=$11, createdAt=$12 WHERE id=$13',
            'UPDATE trips SET city=?, date=?, category=?, seats=?, departureTime=?, returnTime=?, description=?, points=?, price=?, coverImage=?, createdBy=?, createdAt=? WHERE id=?'
          ),
          [...values, t.id]
        );
      } else {
        await db.run(
          SQL(
            'INSERT INTO trips (city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
            'INSERT INTO trips (city,date,category,seats,departureTime,returnTime,description,points,price,coverImage,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
          ),
          values
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
    await db.run(SQL('DELETE FROM trips WHERE id = $1', 'DELETE FROM trips WHERE id = ?'), [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting trip:', err);
    res.status(500).json({ error: 'Erro ao deletar viagem' });
  }
});

// Banners
app.get('/api/banners', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM banners ORDER BY COALESCE(orderIndex,0), id');
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
      const values = [
        b.title||'', b.subtitle||'', b.category||'', b.image||'', b.link||'',
        b.orderIndex||null, b.createdBy||'', b.createdAt||new Date().toISOString()
      ];
      
      if (b.id) {
        await db.run(
          SQL(
            'UPDATE banners SET title=$1, subtitle=$2, category=$3, image=$4, link=$5, orderIndex=$6, createdBy=$7, createdAt=$8 WHERE id=$9',
            'UPDATE banners SET title=?, subtitle=?, category=?, image=?, link=?, orderIndex=?, createdBy=?, createdAt=? WHERE id=?'
          ),
          [...values, b.id]
        );
      } else {
        await db.run(
          SQL(
            'INSERT INTO banners (title,subtitle,category,image,link,orderIndex,createdBy,createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            'INSERT INTO banners (title,subtitle,category,image,link,orderIndex,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?)'
          ),
          values
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
    await db.run(SQL('DELETE FROM banners WHERE id = $1', 'DELETE FROM banners WHERE id = ?'), [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ error: 'Erro ao deletar banner' });
  }
});

// Products
const ALLOWED_PRODUCT_CATEGORIES = new Set([
  'camisas (masculino)',
  'camisas (feminina)',
  'calcas (masculino)',
  'calcas (feminina)',
  'outros...'
]);

function normalizeProductCategory(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'camisas (masculino)') return 'camisas (masculino)';
  if (text === 'camisas (feminina)') return 'camisas (feminina)';
  if (text === 'calcas (masculino)') return 'calcas (masculino)';
  if (text === 'calcas (feminina)') return 'calcas (feminina)';
  if (text === 'outros...') return 'outros...';
  return '';
}

function normalizeProductStock(value) {
  const stock = Number(value);
  if (!Number.isFinite(stock)) return 0;
  const stockInt = Math.trunc(stock);
  if (stockInt < 0) return 0;
  return stockInt;
}

function parseMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function normalizePaymentStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'paid' || text === 'approved' || text === 'completed') return 'paid';
  if (text === 'failed' || text === 'cancelled' || text === 'canceled') return 'failed';
  return 'pending';
}

function normalizeMercadoPagoStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'approved') return 'paid';
  if (text === 'rejected' || text === 'cancelled' || text === 'cancelled_by_user' || text === 'charged_back') return 'failed';
  return 'pending';
}

function isTruthyStockDecremented(value) {
  return value === true || value === 1 || String(value || '').toLowerCase() === 'true';
}

function parseJsonSafe(value, fallback = {}) {
  try {
    return JSON.parse(value || '{}') || fallback;
  } catch (e) {
    return fallback;
  }
}

function getMercadoPagoAccessToken() {
  return String(process.env.MP_ACCESS_TOKEN || '').trim();
}

function getMercadoPagoWebhookToken() {
  return String(process.env.MP_WEBHOOK_TOKEN || '').trim();
}

async function mercadoPagoRequest(pathname, options = {}) {
  const token = getMercadoPagoAccessToken();
  if (!token) throw new Error('Mercado Pago não configurado: defina MP_ACCESS_TOKEN');

  const url = `https://api.mercadopago.com${pathname}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body?.message || body?.error || `Mercado Pago HTTP ${response.status}`;
    throw new Error(msg);
  }
  return body;
}

async function fetchMercadoPagoPayment(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) throw new Error('paymentId do Mercado Pago é obrigatório');
  return await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(id)}`, { method: 'GET' });
}

function extractPixDataFromMercadoPago(paymentData) {
  const tx = paymentData?.point_of_interaction?.transaction_data || {};
  return {
    qrCode: tx.qr_code || '',
    qrCodeBase64: tx.qr_code_base64 || '',
    ticketUrl: tx.ticket_url || ''
  };
}

function getCheckoutStockItems(checkoutItem) {
  if (!checkoutItem) return [];
  if (checkoutItem.source === 'cart' && Array.isArray(checkoutItem.items)) {
    return checkoutItem.items
      .map(item => ({ id: Number(item?.id), qty: normalizeProductStock(item?.qty || 1) || 1 }))
      .filter(item => Number.isInteger(item.id) && item.id > 0 && item.qty > 0);
  }

  const id = Number(checkoutItem.productId || checkoutItem.id);
  if (Number.isInteger(id) && id > 0) {
    return [{ id, qty: normalizeProductStock(checkoutItem.qty || 1) || 1 }];
  }

  return [];
}

async function decrementProductStockItems(items) {
  for (const item of items) {
    const id = Number(item?.id);
    const qty = normalizeProductStock(item?.qty || 1);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('id de produto inválido');
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error('quantidade inválida');
    }

    const result = await db.run(
      SQL(
        'UPDATE products SET stock = COALESCE(stock,0) - $1 WHERE id = $2 AND COALESCE(stock,0) >= $1',
        'UPDATE products SET stock = COALESCE(stock,0) - ? WHERE id = ? AND COALESCE(stock,0) >= ?'
      ),
      USE_POSTGRES ? [qty, id] : [qty, id, qty]
    );

    if (!result || !result.changes) {
      throw new Error('Estoque insuficiente para finalizar a compra');
    }
  }
}

async function updatePaymentOrderStatus(order, nextStatus, providerPaymentId, paymentData = null) {
  const nowIso = new Date().toISOString();
  const orderToken = order.ordertoken || order.orderToken;
  let stockDecremented = isTruthyStockDecremented(order.stockdecremented ?? order.stockDecremented);

  if (nextStatus === 'paid' && !stockDecremented) {
    const checkoutRaw = order.checkoutdata || order.checkoutData || '{}';
    const checkoutData = parseJsonSafe(checkoutRaw, {});
    const stockItems = getCheckoutStockItems(checkoutData);
    if (stockItems.length) {
      await decrementProductStockItems(stockItems);
    }
    stockDecremented = true;
  }

  const finalProviderPaymentId = String(providerPaymentId || order.providerpaymentid || order.providerPaymentId || '').trim();
  const currentPaymentData = parseJsonSafe(order.paymentdata || order.paymentData || '{}', {});
  const mergedPaymentData = paymentData ? { ...currentPaymentData, ...paymentData } : currentPaymentData;

  await db.run(
    SQL(
      'UPDATE payment_orders SET status = $1, providerPaymentId = $2, paymentData = $3, stockDecremented = $4, updatedAt = $5 WHERE orderToken = $6',
      'UPDATE payment_orders SET status = ?, providerPaymentId = ?, paymentData = ?, stockDecremented = ?, updatedAt = ? WHERE orderToken = ?'
    ),
    [
      nextStatus,
      finalProviderPaymentId,
      JSON.stringify(mergedPaymentData),
      USE_POSTGRES ? stockDecremented : (stockDecremented ? 1 : 0),
      nowIso,
      orderToken
    ]
  );

  return { status: nextStatus, stockDecremented, paymentData: mergedPaymentData, providerPaymentId: finalProviderPaymentId };
}

function sanitizeProduct(p) {
  if (!p) return p;
  const category = normalizeProductCategory(p.category);
  return {
    id: p.id,
    name: p.name || '',
    category,
    stock: normalizeProductStock(p.stock),
    price: Number(p.price || 0),
    img: p.image || '',
    image: p.image || '',
    createdBy: p.createdby || p.createdBy || '',
    createdAt: p.createdat || p.createdAt || ''
  };
}

app.get('/api/products', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM products ORDER BY COALESCE(createdAt,\'\') DESC, id DESC');
    res.json((rows || []).map(sanitizeProduct));
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Erro ao ler produtos' });
  }
});

app.post('/api/products/upsert', async (req, res) => {
  const products = Array.isArray(req.body.products) ? req.body.products : [];
  if (products.length === 0) return res.json({ ok: true });

  try {
    for (const p of products) {
      const category = normalizeProductCategory(p.category);
      if (!ALLOWED_PRODUCT_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'Categoria de produto inválida' });
      }

      const values = [
        p.name || '',
        category,
        normalizeProductStock(p.stock),
        Number(p.price || 0),
        p.image || p.img || '',
        p.createdBy || '',
        p.createdAt || new Date().toISOString()
      ];

      if (p.id) {
        await db.run(
          SQL(
            'UPDATE products SET name=$1, category=$2, stock=$3, price=$4, image=$5, createdBy=$6, createdAt=$7 WHERE id=$8',
            'UPDATE products SET name=?, category=?, stock=?, price=?, image=?, createdBy=?, createdAt=? WHERE id=?'
          ),
          [...values, p.id]
        );
      } else {
        await db.run(
          SQL(
            'INSERT INTO products (name,category,stock,price,image,createdBy,createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            'INSERT INTO products (name,category,stock,price,image,createdBy,createdAt) VALUES (?,?,?,?,?,?,?)'
          ),
          values
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error upserting products:', err);
    res.status(500).json({ error: 'Erro ao salvar produtos' });
  }
});

app.post('/api/products/delete', async (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  try {
    await db.run(SQL('DELETE FROM products WHERE id = $1', 'DELETE FROM products WHERE id = ?'), [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Erro ao deletar produto' });
  }
});

app.post('/api/products/decrement-stock', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.json({ ok: true });

  try {
    await decrementProductStockItems(items);

    res.json({ ok: true });
  } catch (err) {
    console.error('Error decrementing product stock:', err);
    if (String(err.message || '').includes('Estoque insuficiente')) {
      return res.status(409).json({ error: err.message });
    }
    if (String(err.message || '').includes('inválido')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erro ao baixar estoque dos produtos' });
  }
});

app.post('/api/payments/create-order', async (req, res) => {
  try {
    const checkoutItem = req.body?.checkoutItem || null;
    const deliveryData = req.body?.deliveryData || {};
    const shippingValue = parseMoney(req.body?.shippingValue || 0);
    const provider = String(req.body?.provider || 'mercadopago').trim().toLowerCase() || 'mercadopago';

    if (!checkoutItem) return res.status(400).json({ error: 'checkoutItem obrigatório' });

    const subtotal = parseMoney(checkoutItem.totalValue || 0);
    const total = parseMoney(subtotal + shippingValue);
    const orderToken = randomUUID();
    const nowIso = new Date().toISOString();
    let providerPaymentId = '';
    let paymentData = {};
    let status = 'pending';

    if (provider === 'mercadopago') {
      const payerEmail = String(
        req.body?.payerEmail ||
        deliveryData?.email ||
        checkoutItem?.email ||
        'comprador@natrip.local'
      ).trim().toLowerCase();

      const webhookToken = getMercadoPagoWebhookToken();
      const notificationBase = process.env.PUBLIC_WEBHOOK_BASE_URL || process.env.PUBLIC_BASE_URL || '';
      const notificationUrl = notificationBase
        ? `${notificationBase.replace(/\/$/, '')}/api/payments/webhook/mercadopago${webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : ''}`
        : undefined;

      const mpBody = {
        transaction_amount: total,
        description: `Natrip Pedido ${orderToken}`,
        payment_method_id: 'pix',
        external_reference: orderToken,
        payer: { email: payerEmail },
        metadata: { orderToken }
      };
      if (notificationUrl) mpBody.notification_url = notificationUrl;

      const mpPayment = await mercadoPagoRequest('/v1/payments', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': orderToken },
        body: JSON.stringify(mpBody)
      });

      providerPaymentId = String(mpPayment?.id || '').trim();
      status = normalizeMercadoPagoStatus(mpPayment?.status);
      paymentData = {
        ...extractPixDataFromMercadoPago(mpPayment),
        mpStatus: String(mpPayment?.status || 'pending'),
        raw: mpPayment
      };
    }

    await db.run(
      SQL(
        'INSERT INTO payment_orders (orderToken,provider,providerPaymentId,status,amountSubtotal,shippingAmount,amountTotal,checkoutData,deliveryData,paymentData,stockDecremented,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        'INSERT INTO payment_orders (orderToken,provider,providerPaymentId,status,amountSubtotal,shippingAmount,amountTotal,checkoutData,deliveryData,paymentData,stockDecremented,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ),
      [
        orderToken,
        provider,
        providerPaymentId,
        status,
        subtotal,
        shippingValue,
        total,
        JSON.stringify(checkoutItem || {}),
        JSON.stringify(deliveryData || {}),
        JSON.stringify(paymentData || {}),
        USE_POSTGRES ? false : 0,
        nowIso,
        nowIso
      ]
    );

    res.json({
      ok: true,
      orderToken,
      status,
      pix: {
        key: paymentData.qrCode || process.env.PIX_KEY || 'natripaventura@gmail.com',
        qrCodeImage: paymentData.qrCodeBase64 ? `data:image/png;base64,${paymentData.qrCodeBase64}` : '/img/pix-qrcode.png',
        ticketUrl: paymentData.ticketUrl || ''
      },
      amounts: { subtotal, shipping: shippingValue, total }
    });
  } catch (err) {
    console.error('Error creating payment order:', err);
    if (String(err.message || '').includes('Mercado Pago não configurado')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erro ao criar pedido de pagamento' });
  }
});

app.get('/api/payments/status', async (req, res) => {
  const orderToken = String(req.query?.orderToken || '').trim();
  if (!orderToken) return res.status(400).json({ error: 'orderToken obrigatório' });

  try {
    const order = await db.get(
      SQL('SELECT * FROM payment_orders WHERE orderToken = $1', 'SELECT * FROM payment_orders WHERE orderToken = ?'),
      [orderToken]
    );

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    let normalizedStatus = normalizePaymentStatus(order.status);
    let providerPaymentId = order.providerpaymentid || order.providerPaymentId || '';
    let paymentData = parseJsonSafe(order.paymentdata || order.paymentData || '{}', {});

    if ((order.provider || '').toLowerCase() === 'mercadopago' && normalizedStatus !== 'paid' && providerPaymentId) {
      try {
        const mpPayment = await fetchMercadoPagoPayment(providerPaymentId);
        const nextStatus = normalizeMercadoPagoStatus(mpPayment?.status);
        const updateResult = await updatePaymentOrderStatus(
          order,
          nextStatus,
          providerPaymentId,
          { ...extractPixDataFromMercadoPago(mpPayment), mpStatus: String(mpPayment?.status || '') }
        );
        normalizedStatus = updateResult.status;
        paymentData = updateResult.paymentData;
      } catch (syncErr) {
        console.warn('Mercado Pago status sync warning:', syncErr.message || syncErr);
      }
    }

    res.json({
      ok: true,
      orderToken,
      status: normalizedStatus,
      provider: order.provider || 'hybrid',
      providerPaymentId,
      amounts: {
        subtotal: parseMoney(order.amountsubtotal || order.amountSubtotal || 0),
        shipping: parseMoney(order.shippingamount || order.shippingAmount || 0),
        total: parseMoney(order.amounttotal || order.amountTotal || 0)
      },
      pix: {
        key: paymentData?.qrCode || process.env.PIX_KEY || 'natripaventura@gmail.com',
        qrCodeImage: paymentData?.qrCodeBase64 ? `data:image/png;base64,${paymentData.qrCodeBase64}` : '/img/pix-qrcode.png',
        ticketUrl: paymentData?.ticketUrl || ''
      },
      updatedAt: order.updatedat || order.updatedAt || ''
    });
  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ error: 'Erro ao consultar status de pagamento' });
  }
});

app.get('/api/payments/confirmed', async (req, res) => {
  try {
    const rows = await db.all(
      SQL(
        'SELECT * FROM payment_orders WHERE status = $1 ORDER BY COALESCE(updatedAt, createdAt) DESC, id DESC',
        'SELECT * FROM payment_orders WHERE status = ? ORDER BY COALESCE(updatedAt, createdAt) DESC, id DESC'
      ),
      ['paid']
    );

    const result = (rows || []).map(order => {
      const checkoutData = parseJsonSafe(order.checkoutdata || order.checkoutData || '{}', {});
      const deliveryData = parseJsonSafe(order.deliverydata || order.deliveryData || '{}', {});
      const paymentData = parseJsonSafe(order.paymentdata || order.paymentData || '{}', {});

      const items = Array.isArray(checkoutData.items)
        ? checkoutData.items.map(item => ({
            id: Number(item?.id || 0),
            name: item?.name || 'Produto',
            qty: normalizeProductStock(item?.qty || 1) || 1,
            unitPrice: parseMoney(item?.price || item?.unitPrice || 0)
          }))
        : [{
            id: Number(checkoutData.productId || checkoutData.id || 0),
            name: checkoutData.name || 'Produto',
            qty: normalizeProductStock(checkoutData.qty || 1) || 1,
            unitPrice: parseMoney(checkoutData.unitPrice || checkoutData.price || 0)
          }];

      return {
        id: order.id,
        orderToken: order.ordertoken || order.orderToken,
        status: normalizePaymentStatus(order.status),
        provider: order.provider || 'mercadopago',
        providerPaymentId: order.providerpaymentid || order.providerPaymentId || '',
        buyer: {
          name: deliveryData.name || checkoutData.name || 'Cliente',
          email: checkoutData.email || deliveryData.email || '',
          phone: deliveryData.phone || ''
        },
        delivery: {
          cep: deliveryData.cep || '',
          street: deliveryData.street || '',
          number: deliveryData.number || '',
          complement: deliveryData.complement || '',
          neighborhood: deliveryData.neighborhood || '',
          city: deliveryData.city || '',
          state: deliveryData.state || ''
        },
        amounts: {
          subtotal: parseMoney(order.amountsubtotal || order.amountSubtotal || 0),
          shipping: parseMoney(order.shippingamount || order.shippingAmount || 0),
          total: parseMoney(order.amounttotal || order.amountTotal || 0)
        },
        items,
        pix: {
          ticketUrl: paymentData.ticketUrl || '',
          mpStatus: paymentData.mpStatus || ''
        },
        createdAt: order.createdat || order.createdAt || '',
        updatedAt: order.updatedat || order.updatedAt || ''
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching confirmed payments:', err);
    res.status(500).json({ error: 'Erro ao buscar notificações de compras confirmadas' });
  }
});

app.post('/api/payments/webhook/hybrid', async (req, res) => {
  const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  if (expectedSecret) {
    const incomingSecret = String(req.headers['x-webhook-secret'] || '');
    if (!incomingSecret || incomingSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Webhook não autorizado' });
    }
  }

  const orderToken = String(req.body?.orderToken || '').trim();
  if (!orderToken) return res.status(400).json({ error: 'orderToken obrigatório' });

  const nextStatus = normalizePaymentStatus(req.body?.status);
  const providerPaymentId = String(req.body?.providerPaymentId || '').trim();
  try {
    const order = await db.get(
      SQL('SELECT * FROM payment_orders WHERE orderToken = $1', 'SELECT * FROM payment_orders WHERE orderToken = ?'),
      [orderToken]
    );
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    const currentStatus = normalizePaymentStatus(order.status);
    const updated = await updatePaymentOrderStatus(order, nextStatus, providerPaymentId);

    res.json({ ok: true, orderToken, previousStatus: currentStatus, status: updated.status, stockDecremented: updated.stockDecremented });
  } catch (err) {
    console.error('Error processing payment webhook:', err);
    if (String(err.message || '').includes('Estoque insuficiente')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erro ao processar webhook de pagamento' });
  }
});

async function processMercadoPagoWebhook(req, res) {
  const expectedToken = getMercadoPagoWebhookToken();
  if (expectedToken) {
    const token = String(req.query?.token || '').trim();
    if (!token || token !== expectedToken) {
      return res.status(401).json({ error: 'Webhook do Mercado Pago não autorizado' });
    }
  }

  const body = req.body || {};
  const type = String(body?.type || body?.topic || req.query?.type || req.query?.topic || '').toLowerCase();
  const paymentId = String(
    body?.data?.id || body?.id || req.query?.id || req.query?.['data.id'] || ''
  ).trim();

  if (type && !String(type).includes('payment')) {
    return res.json({ ok: true, ignored: true, reason: 'Tipo não relacionado a pagamento' });
  }
  if (!paymentId) return res.status(400).json({ error: 'payment id não informado no webhook' });

  try {
    const mpPayment = await fetchMercadoPagoPayment(paymentId);
    const orderToken = String(mpPayment?.external_reference || mpPayment?.metadata?.orderToken || '').trim();
    if (!orderToken) return res.status(400).json({ error: 'Pedido sem external_reference no Mercado Pago' });

    const order = await db.get(
      SQL('SELECT * FROM payment_orders WHERE orderToken = $1', 'SELECT * FROM payment_orders WHERE orderToken = ?'),
      [orderToken]
    );
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado para o webhook' });

    const nextStatus = normalizeMercadoPagoStatus(mpPayment?.status);
    const updated = await updatePaymentOrderStatus(
      order,
      nextStatus,
      paymentId,
      { ...extractPixDataFromMercadoPago(mpPayment), mpStatus: String(mpPayment?.status || '') }
    );

    res.json({ ok: true, provider: 'mercadopago', orderToken, paymentId, status: updated.status, stockDecremented: updated.stockDecremented });
  } catch (err) {
    console.error('Error processing Mercado Pago webhook:', err);
    if (String(err.message || '').includes('Estoque insuficiente')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erro ao processar webhook Mercado Pago' });
  }
}

app.post('/api/payments/webhook/mercadopago', processMercadoPagoWebhook);
app.get('/api/payments/webhook/mercadopago', processMercadoPagoWebhook);

// Referrals
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

app.get('/api/referral-code', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email obrigatório' });
  
  try {
    const user = await db.get(
      SQL('SELECT referralCode FROM users WHERE email = $1', 'SELECT referralCode FROM users WHERE email = ?'),
      [email.toLowerCase()]
    );
    
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    
    const code = user.referralcode || user.referralCode;
    if (code) return res.json({ referralCode: code });
    
    const newCode = generateReferralCode();
    await db.run(
      SQL('UPDATE users SET referralCode = $1 WHERE email = $2', 'UPDATE users SET referralCode = ? WHERE email = ?'),
      [newCode, email.toLowerCase()]
    );
    res.json({ referralCode: newCode });
  } catch (err) {
    console.error('Error managing referral code:', err);
    res.status(500).json({ error: 'Erro ao gerar código de convite' });
  }
});

app.get('/api/referrals', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email obrigatório' });
  
  try {
    const user = await db.get(
      SQL('SELECT referralCode FROM users WHERE email = $1', 'SELECT referralCode FROM users WHERE email = ?'),
      [email.toLowerCase()]
    );
    
    const code = user?.referralcode || user?.referralCode;
    if (!code) return res.json({ count: 0, referrals: [] });
    
    const referrals = await db.all(
      SQL('SELECT name, email, id FROM users WHERE referredBy = $1', 'SELECT name, email, id FROM users WHERE referredBy = ?'),
      [code]
    );
    
    res.json({
      count: referrals.length,
      referrals: referrals.map(r => ({ id: r.id, name: r.name, email: r.email }))
    });
  } catch (err) {
    console.error('Error fetching referrals:', err);
    res.status(500).json({ error: 'Erro ao buscar convidados' });
  }
});

// Users upsert
app.post('/api/users/upsert', async (req, res) => {
  const users = Array.isArray(req.body.users) ? req.body.users : [];
  if (users.length === 0) return res.json({ ok: true });
  
  try {
    for (const u of users) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      
      const existing = await db.get(
        SQL('SELECT id FROM users WHERE email = $1', 'SELECT id FROM users WHERE email = ?'),
        [email]
      );
      
      const hash = u.password ? bcrypt.hashSync(u.password, 10) : bcrypt.hashSync('pwd'+Date.now(), 10);
      
      if (existing) {
        await db.run(
          SQL(
            'UPDATE users SET name=$1, cpf=$2, phone=$3, role=$4, password=$5 WHERE email=$6',
            'UPDATE users SET name=?, cpf=?, phone=?, role=?, password=? WHERE email=?'
          ),
          [u.name||'', u.cpf||'', u.phone||'', u.role||'user', hash, email]
        );
      } else {
        await db.run(
          SQL(
            'INSERT INTO users (name,cpf,phone,email,password,role) VALUES ($1,$2,$3,$4,$5,$6)',
            'INSERT OR IGNORE INTO users (name,cpf,phone,email,password,role) VALUES (?,?,?,?,?,?)'
          ),
          [u.name||'', u.cpf||'', u.phone||'', email, hash, u.role||'user']
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error upserting users:', err);
    res.status(500).json({ error: 'Erro ao salvar usuários' });
  }
});

// PayPal endpoints
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
  if (!resp.ok) throw new Error('PayPal token error');
  const data = await resp.json();
  return data.access_token;
}

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const amount = String(req.body?.amount || '');
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
    console.error('paypal create-order err', e.message);
    res.status(500).json({ error: 'Erro interno ao criar ordem PayPal' });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const orderID = req.body?.orderID;
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
    console.error('paypal capture-order err', e.message);
    res.status(500).json({ error: 'Erro interno ao capturar ordem PayPal' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Backend running on port', PORT);
  console.log('📝 Database:', USE_POSTGRES ? 'PostgreSQL (Production)' : 'SQLite (Development)');
  console.log('🔗 Environment:', process.env.NODE_ENV || 'development');
});
