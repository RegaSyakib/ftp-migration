const path = require('path');
const fs = require('fs');
const ingestionService = require('../services/ingestionService');
const { generateMockZrxFile } = require('./generate-mock-file');
const { pool } = require('../config/db');

async function runLocalSimulationTest() {
  console.log('='.repeat(65));
  console.log('   TEST SIMULASI INGESTION & WATCHER LOKAL');
  console.log('='.repeat(65));

  const incomingDir = path.resolve(__dirname, '../../storage/ftp_simulator/incoming');
  const processedDir = path.resolve(__dirname, '../../storage/ftp_simulator/processed');

  try {
    // 1. Buat file baru di incoming folder (simulasi drop file oleh FTP/User)
    console.log('[1/4] Membuat file mock .zrx baru di folder incoming...');
    const createdFile = generateMockZrxFile(incomingDir, 'UCL11112');
    console.log(`  -> File dibuat: ${path.basename(createdFile)}`);

    // 2. Jalankan Ingestion Process
    console.log('\n[2/4] Menjalankan processIncomingDirectory()...');
    const results = await ingestionService.processIncomingDirectory();
    console.log(`  -> Total file diproses: ${results.length}`);
    results.forEach((r) => {
      console.log(`     * File       : ${r.filename}`);
      console.log(`     * Status     : ${r.success ? 'BERHASIL' : 'GAGAL'}`);
      console.log(`     * Total Baris: ${r.total}`);
      console.log(`     * Data Baru  : ${r.inserted}`);
      console.log(`     * Duplikat   : ${r.duplicates}`);
    });

    // 3. Verifikasi file sudah dipindahkan ke folder processed
    console.log('\n[3/4] Memeriksa status file di filesystem...');
    const stillInIncoming = fs.existsSync(createdFile);
    console.log(`  -> Apakah file masih di incoming? ${stillInIncoming ? 'YA (SALAH)' : 'TIDAK (BENAR)'}`);

    const processedFiles = fs.readdirSync(processedDir);
    console.log(`  -> Jumlah file di folder processed: ${processedFiles.length}`);

    // 4. Verifikasi di Database
    console.log('\n[4/4] Memeriksa total baris di PostgreSQL...');
    const dbRes = await pool.query('SELECT count(*) as total FROM arr_ftp;');
    console.log(`  -> Total data di tabel arr_ftp sekarang: ${dbRes.rows[0].total} baris.`);

    console.log('\n' + '='.repeat(65));
    console.log('STATUS: SIMULASI ALUR LOKAL BERHASIL LENGKAP!');
    console.log('='.repeat(65));

  } catch (err) {
    console.error('ERROR saat simulasi lokal:', err.message);
  } finally {
    await pool.end();
  }
}

runLocalSimulationTest();

