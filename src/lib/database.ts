import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'joelink.db');
const dbDirectory = path.dirname(dbPath);

fs.mkdirSync(dbDirectory, { recursive: true });

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'customer',
    password TEXT,
    wallet_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    image TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    credentials TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'all',
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (count.count > 0) return;

  const adminPasswordHash = bcrypt.hashSync('admin', 12);
  const customerPasswordHash = bcrypt.hashSync('customer123', 12);

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, role, password, wallet_balance, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'user_1',
    'Admin',
    'admin@joelink.test',
    'admin',
    adminPasswordHash,
    2500,
    new Date().toISOString(),
  );

  insertUser.run(
    'user_2',
    'Customer',
    'customer@joelink.test',
    'customer',
    customerPasswordHash,
    0,
    new Date().toISOString(),
  );

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, price, description, category, image, stock, featured, credentials)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProduct.run(
    '1',
    'Smartphone X',
    799,
    'Flagship device with premium camera and storage.',
    'Phones',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
    24,
    1,
    JSON.stringify({ username: 'demo', password: 'demo123' }),
  );

  insertProduct.run(
    '2',
    'Wireless Headset',
    199,
    'Immersive sound and active noise cancellation.',
    'Audio',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    18,
    1,
    JSON.stringify({ username: 'audio', password: 'demo123' }),
  );
}

seedDatabase();
