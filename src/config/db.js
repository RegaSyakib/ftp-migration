const { Pool } = require('pg');
require('dotenv').config();

// Konfigurasi Pool PostgreSQL dari Environment Variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'ftp_migration',
  max: 10, // Maksimal 10 koneksi simultan dalam pool
  idleTimeoutMillis: 30000, // Tutup client yang menganggur setelah 30 detik
  connectionTimeoutMillis: 5000, // Timeout koneksi jika tidak merespons dalam 5 detik
});

// Listener error tak terduga pada client yang sedang idle
pool.on('error', (err) => {
  console.error('[DB Pool Error] Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};

