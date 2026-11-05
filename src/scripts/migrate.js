const { pool } = require('../config/db');

async function runMigration() {
  console.log('='.repeat(60));
  console.log('   MIGRATION: CEK & TAMBAH UNIQUE CONSTRAINT');
  console.log('='.repeat(60));

  let client;
  try {
    client = await pool.connect();

    // Periksa apakah constraint unik sudah ada
    const checkRes = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'arr_ftp'::regclass 
        AND contype = 'u'
        AND conname = 'uq_arr_ftp_logger_channel_recorded';
    `);

    if (checkRes.rows.length > 0) {
      console.log('-> Constraint "uq_arr_ftp_logger_channel_recorded" sudah ada.');
    } else {
      console.log('-> Menambahkan constraint UNIQUE (id_logger, channel, recorded_at)...');
      await client.query(`
        ALTER TABLE arr_ftp 
        ADD CONSTRAINT uq_arr_ftp_logger_channel_recorded 
        UNIQUE (id_logger, channel, recorded_at);
      `);
      console.log('-> BERHASIL! Constraint unik berhasil ditambahkan ke tabel arr_ftp.');
    }

    console.log('='.repeat(60));
  } catch (err) {
    console.error('ERROR saat menjalankan migrasi:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();

