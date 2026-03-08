-- Script SQL para PostgreSQL
-- O servidor Node.js criará estas tabelas automaticamente
-- Este arquivo é apenas para referência ou criação manual

-- Criar as tabelas
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
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referralCode ON users(referralCode);

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
);

CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_category ON trips(category);

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
);

CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(orderIndex);

-- O usuário admin é criado automaticamente pelo servidor
-- Email: admin@natrip.local
-- Senha: capela9797@
