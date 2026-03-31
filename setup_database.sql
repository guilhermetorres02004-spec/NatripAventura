-- Script SQL para criar o banco de dados NatripAventura no MySQL
-- Execute este script antes de iniciar o servidor

-- Criar o banco de dados
CREATE DATABASE IF NOT EXISTS natrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usar o banco de dados
USE natrip;

-- As tabelas serão criadas automaticamente pelo servidor Node.js
-- Este arquivo é apenas para criar o banco de dados inicial

-- Se você quiser criar as tabelas manualmente, descomente o código abaixo:

/*
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
*/
