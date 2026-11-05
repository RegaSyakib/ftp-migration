const { pool } = require('../config/db');

async function testDatabaseConnection() {
  console.log('='.repeat(50));
  console.log('   TEST KONEKSI DATABASE POSTGRESQL');
  console.log('='.repeat(50));
  console.log(`Target Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
  console.log(`Database   : ${process.env.DB_NAME || 'ftp_migration'}`);
  console.log(`User       : ${process.env.DB_USER || 'postgres'}`);
  const hasPassword = Boolean(process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim().length > 0);
  console.log(`Password   : ${hasPassword ? '[TERSEDIA DI .ENV]' : '[KOSONG / BELUM DIISI]'}`);
  console.log('-'.repeat(50));

  if (!hasPassword) {
    console.error('\n' + '!'.repeat(50));
    console.error('PERINGATAN: Variabel DB_PASSWORD di file .env masih kosong!');
    console.error('PostgreSQL memerlukan password akun postgres Anda.');
    console.error('Silakan buka file .env dan isi baris:');
    console.error('DB_PASSWORD=password_postgres_anda');
    console.error('!'.repeat(50) + '\n');
    process.exit(1);
  }

  let client;
  try {
    console.log('[1/3] Menghubungkan ke PostgreSQL...');
    client = await pool.connect();
    console.log('  -> BERHASIL terhubung ke PostgreSQL!');

    console.log('\n[2/3] Memeriksa versi database...');
    const versionRes = await client.query('SELECT version(), current_database(), current_user, NOW() as server_time;');
    const row = versionRes.rows[0];
    console.log(`  -> Server Time : ${row.server_time}`);
    console.log(`  -> Current DB  : ${row.current_database}`);
    console.log(`  -> Current User: ${row.current_user}`);
    console.log(`  -> Version     : ${row.version.split(' on ')[0]}`);

    console.log('\n[3/3] Memeriksa struktur tabel "arr_ftp"...');
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'arr_ftp';
    `);

    if (tableRes.rows.length === 0) {
      console.warn('  [PERINGATAN] Tabel "arr_ftp" belum ditemukan di schema public.');
      console.warn('  Pastikan tabel sudah dibuat di database "' + (process.env.DB_NAME || 'ftp_migration') + '".');
    } else {
      console.log('  -> Tabel "arr_ftp" DITEMUKAN.');

      // Cek kolom tabel
      const columnsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'arr_ftp'
        ORDER BY ordinal_position;
      `);
      console.log('\n  Daftar Kolom:');
      columnsRes.rows.forEach(col => {
        console.log(`   - ${col.column_name.padEnd(15)} : ${col.data_type.padEnd(20)} (Nullable: ${col.is_nullable})`);
      });

      // Cek Constraints (Primary Key & Unique Constraint)
      const constraintRes = await client.query(`
        SELECT 
          conname AS constraint_name,
          contype AS constraint_type,
          pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        WHERE conrelid = 'arr_ftp'::regclass;
      `);

      console.log('\n  Daftar Constraint:');
      if (constraintRes.rows.length === 0) {
        console.warn('   [PERINGATAN] Belum ada constraint (PK/Unique) pada tabel "arr_ftp".');
      } else {
        constraintRes.rows.forEach(con => {
          const typeMap = { p: 'PRIMARY KEY', u: 'UNIQUE', f: 'FOREIGN KEY', c: 'CHECK' };
          const typeName = typeMap[con.constraint_type] || con.constraint_type;
          console.log(`   - [${typeName}] ${con.constraint_name} -> ${con.definition}`);
        });
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('STATUS: KONEKSI & DATABASE SIAP DIGUNAKAN (PHASE 1 SELESAI)');
    console.log('='.repeat(50));

  } catch (err) {
    console.error('\n' + '!'.repeat(50));
    console.error('ERROR: Gagal terhubung ke database PostgreSQL.');
    console.error(`Detail error: ${err.message || err}`);
    if (err.code) console.error(`Error Code  : ${err.code}`);

    if (err.code === '28P01') {
      console.error('\n[Solusi]: Password PostgreSQL salah.');
      console.error('Silakan buka file .env dan isi DB_PASSWORD dengan password user postgres Anda.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('\n[Solusi]: PostgreSQL service tidak aktif atau port salah.');
      console.error('Pastikan service PostgreSQL berjalan di Windows Services dan port sesuai (default 5432).');
    } else if (err.code === '3D000') {
      console.error(`\n[Solusi]: Database "${process.env.DB_NAME}" tidak ditemukan.`);
      console.error('Pastikan database tersebut sudah dibuat di pgAdmin 4.');
    }
    console.error('!'.repeat(50));
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

testDatabaseConnection();
