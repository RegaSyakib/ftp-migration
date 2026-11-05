const fs = require('fs');
const path = require('path');
const { parseZrxFile } = require('../utils/parser');
const { saveMeasurements } = require('./measurementService');

/**
 * Service untuk memproses file .zrx dari folder incoming,
 * menyimpannya ke database, dan memancarkan event Socket.IO untuk data baru.
 */
class IngestionService {
  constructor(options = {}) {
    this.incomingDir = options.incomingDir || path.resolve(__dirname, '../../storage/ftp_simulator/incoming');
    this.processedDir = options.processedDir || path.resolve(__dirname, '../../storage/ftp_simulator/processed');
    this.failedDir = options.failedDir || path.resolve(__dirname, '../../storage/ftp_simulator/failed');
    this.io = options.io || null;

    this.ensureDirectories();
  }

  /**
   * Set instance Socket.IO setelah server terinisialisasi
   * @param {Object} io 
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Pastikan folder storage sudah dibuat
   */
  ensureDirectories() {
    [this.incomingDir, this.processedDir, this.failedDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Pindahkan file ke folder tujuan dengan penamaan yang aman jika ada file bernama sama
   * @param {string} sourcePath 
   * @param {string} targetDir 
   * @returns {string} Target path baru
   */
  moveFile(sourcePath, targetDir) {
    const filename = path.basename(sourcePath);
    let targetPath = path.join(targetDir, filename);

    // Jika file sudah ada di folder tujuan, tambahkan timestamp unix
    if (fs.existsSync(targetPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const timestamp = Date.now();
      targetPath = path.join(targetDir, `${base}_${timestamp}${ext}`);
    }

    fs.renameSync(sourcePath, targetPath);
    return targetPath;
  }

  /**
   * Memproses satu file .zrx tertentu
   * @param {string} filePath 
   * @returns {Promise<Object>}
   */
  async processFile(filePath) {
    const filename = path.basename(filePath);
    console.log(`\n[Ingestion] Memproses file: ${filename}`);

    try {
      // 1. Parsing isi file .zrx
      const parseResult = parseZrxFile(filePath);
      console.log(`[Ingestion] Berhasil parse ${parseResult.totalRecords} record dari ${filename}`);

      if (parseResult.totalRecords === 0) {
        console.warn(`[Ingestion] File ${filename} tidak memiliki baris pengukuran valid.`);
        this.moveFile(filePath, this.processedDir);
        return {
          filename,
          success: true,
          total: 0,
          inserted: 0,
          duplicates: 0,
        };
      }

      // 2. Simpan ke PostgreSQL dengan duplicate handling (ON CONFLICT DO NOTHING)
      const insertResult = await saveMeasurements(parseResult.data);
      console.log(`[Ingestion] Hasil DB: ${insertResult.inserted} baru, ${insertResult.duplicates} duplikat (diabaikan)`);

      // 3. Pancarkan event Socket.IO HANYA untuk data yang benar-benar baru
      if (this.io && insertResult.insertedRecords.length > 0) {
        console.log(`[Realtime] Mengirim ${insertResult.insertedRecords.length} event "new_measurement" via Socket.IO...`);
        insertResult.insertedRecords.forEach((record) => {
          this.io.emit('new_measurement', {
            id_logger: record.id_logger,
            channel: record.channel,
            recorded_at: record.recorded_at,
            value: Number(record.value),
            unit: record.unit,
            created_at: record.created_at,
          });
        });
      }

      // 4. Pindahkan file yang sudah diproses ke folder processed/
      const finalPath = this.moveFile(filePath, this.processedDir);
      console.log(`[Ingestion] File dipindahkan ke: ${path.basename(finalPath)}`);

      return {
        filename,
        success: true,
        total: insertResult.total,
        inserted: insertResult.inserted,
        duplicates: insertResult.duplicates,
      };

    } catch (err) {
      console.error(`[Ingestion Error] Gagal memproses file ${filename}:`, err.message);
      try {
        this.moveFile(filePath, this.failedDir);
      } catch (moveErr) {
        console.error(`[Ingestion Error] Gagal memindahkan file gagal:`, moveErr.message);
      }
      return {
        filename,
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Scan folder incoming dan proses seluruh file .zrx yang ada
   * @returns {Promise<Array<Object>>}
   */
  async processIncomingDirectory() {
    this.ensureDirectories();
    const files = fs.readdirSync(this.incomingDir);
    
    // Filter hanya file berekstensi .zrx atau mengandung .zrx
    const zrxFiles = files.filter(f => f.toLowerCase().endsWith('.zrx') && !f.startsWith('.tmp'));

    if (zrxFiles.length === 0) {
      return [];
    }

    console.log(`[Ingestion] Ditemukan ${zrxFiles.length} file .zrx di folder incoming.`);
    const results = [];

    for (const filename of zrxFiles) {
      const fullPath = path.join(this.incomingDir, filename);
      const res = await this.processFile(fullPath);
      results.push(res);
    }

    return results;
  }
}

module.exports = new IngestionService();

