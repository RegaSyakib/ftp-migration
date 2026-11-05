const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
require('dotenv').config();

const { query } = require('./config/db');
const ingestionService = require('./services/ingestionService');
const cronService = require('./services/cronService');
const { getMeasurementStats } = require('./services/measurementService');
const { generateMockZrxFile } = require('./scripts/generate-mock-file');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Hubungkan Socket.IO ke Ingestion Service
ingestionService.setSocketIO(io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client terhubung: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client terputus: ${socket.id}`);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Database check
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as server_time, current_database() as database, current_user as user;');
    res.json({
      status: 'success',
      message: 'PostgreSQL connection is healthy',
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to database',
      error: error.message,
    });
  }
});

// Measurement Stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getMeasurementStats();
    res.json({
      status: 'success',
      data: stats,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Measurement History with Filters
app.get('/api/measurements', async (req, res) => {
  try {
    const { id_logger, channel, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (id_logger) {
      conditions.push(`id_logger = $${paramIndex++}`);
      params.push(id_logger);
    }

    if (channel) {
      conditions.push(`channel = $${paramIndex++}`);
      params.push(channel);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.min(parseInt(limit, 10) || 50, 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(safeLimit, safeOffset);
    const sql = `
      SELECT id, id_logger, channel, recorded_at, value, unit, created_at
      FROM arr_ftp
      ${whereClause}
      ORDER BY recorded_at DESC, channel ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const result = await query(sql, params);
    res.json({
      status: 'success',
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Endpoint Simulasi: Buat file .zrx baru dengan data segar (Fresh Data)
app.post('/api/simulate-fresh', (req, res) => {
  try {
    const incomingDir = path.resolve(__dirname, '../storage/ftp_simulator/incoming');
    const createdPath = generateMockZrxFile(incomingDir, req.body.id_logger || 'UCL11112');
    res.json({
      status: 'success',
      message: 'File .zrx baru dengan data segar berhasil dibuat di folder incoming.',
      filename: path.basename(createdPath),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Endpoint Simulasi: Salin sample file ke folder incoming
app.post('/api/simulate-drop', (req, res) => {
  try {
    const sampleSource = path.resolve(__dirname, '../.UCL11112_20260413_203000.zrx');
    const incomingDir = path.resolve(__dirname, '../storage/ftp_simulator/incoming');

    if (!fs.existsSync(sampleSource)) {
      return res.status(404).json({ status: 'error', message: 'Sample file .zrx tidak ditemukan.' });
    }

    if (!fs.existsSync(incomingDir)) {
      fs.mkdirSync(incomingDir, { recursive: true });
    }

    const targetFile = path.join(incomingDir, `simulated_${Date.now()}.zrx`);
    fs.copyFileSync(sampleSource, targetFile);

    res.json({
      status: 'success',
      message: `File simulasi berhasil disalin ke incoming folder. Menunggu cron memproses...`,
      filename: path.basename(targetFile),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Jalankan Server & Cron Job
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 [Server] Backend berjalan di http://localhost:${PORT}`);
    console.log(`📊 [Dashboard] Buka monitor realtime di http://localhost:${PORT}`);
    console.log(`==================================================\n`);

    // Mulai cron watcher setiap 10 detik
    cronService.start('*/10 * * * * *');
  });
}

module.exports = { app, server };
