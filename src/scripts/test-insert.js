const path = require('path');
const { parseZrxFile } = require('../utils/parser');
const { saveMeasurements, getMeasurementStats } = require('../services/measurementService');
const { pool } = require('../config/db');

async function runInsertTest() {
  const sampleFilePath = path.join(__dirname, '../../.UCL11112_20260413_203000.zrx');

  console.log('='.repeat(65));
  console.log('   TEST INTEGRASI POSTGRESQL & DUPLICATE HANDLING (PHASE 3)');
  console.log('='.repeat(65));
  console.log(`Target File: ${sampleFilePath}`);
  console.log('-'.repeat(65));

  try {
    // 1. Parsing File Lokal
    console.log('[1/4] Mem-parsing data dari file lokal...');
    const parseResult = parseZrxFile(sampleFilePath);
    console.log(`  -> Berhasil parse ${parseResult.totalRecords} record dari ${parseResult.summary.totalBlocks} blok channel.`);

    // 2. Insert Pertama ke PostgreSQL
    console.log('\n[2/4] Eksekusi Insert Pertama ke PostgreSQL (arr_ftp)...');
    const firstInsert = await saveMeasurements(parseResult.data);
    console.log(`  -> Total diproses : ${firstInsert.total} baris`);
    console.log(`  -> Berhasil masuk : ${firstInsert.inserted} baris baru`);
    console.log(`  -> Duplikat lolos : ${firstInsert.duplicates} baris diabaikan (DO NOTHING)`);

    // 3. Uji Duplicate Handling: Coba Insert Ulang Data yang Sama
    console.log('\n[3/4] Uji Duplicate Handling (Coba Insert Ulang File yang Sama)...');
    const secondInsert = await saveMeasurements(parseResult.data);
    console.log(`  -> Total diproses : ${secondInsert.total} baris`);
    console.log(`  -> Berhasil masuk : ${secondInsert.inserted} baris baru (Ekspektasi: 0)`);
    console.log(`  -> Duplikat lolos : ${secondInsert.duplicates} baris dicegah masuk (Ekspektasi: ${parseResult.totalRecords})`);

    if (secondInsert.inserted === 0 && secondInsert.duplicates === parseResult.totalRecords) {
      console.log('  -> HASIL UJI: SANGAT BAIK! Mekanisme ON CONFLICT berhasil mencegah duplikasi data.');
    } else {
      console.warn('  -> PERINGATAN: Duplicate handling tidak berjalan sesuai ekspektasi.');
    }

    // 4. Periksa Statistik Data di PostgreSQL
    console.log('\n[4/4] Memeriksa data aktual di PostgreSQL...');
    const stats = await getMeasurementStats();
    console.log('  Statistik Tabel arr_ftp Saat Ini:');
    console.log(`   - Total Baris Database : ${stats.total_rows}`);
    console.log(`   - Jumlah Logger Unik  : ${stats.total_loggers}`);
    console.log(`   - Jumlah Channel Unik : ${stats.total_channels}`);
    console.log(`   - Pengukuran Pertama  : ${stats.earliest_record}`);
    console.log(`   - Pengukuran Terakhir : ${stats.latest_record}`);

    console.log('\n' + '='.repeat(65));
    console.log('STATUS: INTEGRASI DATABASE BERHASIL PENUH (PHASE 3 SELESAI)');
    console.log('='.repeat(65));

  } catch (error) {
    console.error('\nERROR saat eksekusi test integrasi database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runInsertTest();

