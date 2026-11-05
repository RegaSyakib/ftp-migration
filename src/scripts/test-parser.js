const path = require('path');
const { parseZrxFile } = require('../utils/parser');

function runParserTest() {
  const sampleFilePath = path.join(__dirname, '../../.UCL11112_20260413_203000.zrx');

  console.log('='.repeat(60));
  console.log('   TEST LOCAL PARSER FILE .ZRX (PHASE 2)');
  console.log('='.repeat(60));
  console.log(`Target File: ${sampleFilePath}`);
  console.log('-'.repeat(60));

  try {
    const result = parseZrxFile(sampleFilePath);

    console.log(`[Hasil Parsing File: ${result.filename}]`);
    console.log(`Total Pengukuran Terambil: ${result.totalRecords} record`);
    console.log(`Total Blok Channel        : ${result.summary.totalBlocks}`);
    console.log(`Total Error Baris         : ${result.summary.totalErrors}`);

    console.log('\nRincian Blok Channel yang Ditemukan:');
    result.summary.blocks.forEach((block, idx) => {
      console.log(`  Blok ${idx + 1}: Logger = ${block.id_logger} | Channel = ${block.channel} | Unit = ${block.unit} | Jumlah = ${block.count} record`);
    });

    console.log('\nSample Output Data (5 Record Pertama):');
    console.log(JSON.stringify(result.data.slice(0, 5), null, 2));

    console.log('\nSample Output Data (Transisi ke Channel Berikutnya):');
    const ch2Index = result.data.findIndex(r => r.channel === 'CH02');
    if (ch2Index !== -1) {
      console.log(JSON.stringify(result.data.slice(ch2Index, ch2Index + 3), null, 2));
    }

    if (result.errors.length > 0) {
      console.warn('\nCatatan Error/Peringatan:');
      console.warn(JSON.stringify(result.errors, null, 2));
    }

    console.log('\n' + '='.repeat(60));
    console.log('STATUS: PARSER BERHASIL DIEKSEKUSI (PHASE 2 SELESAI)');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nERROR saat mem-parsing file:', error.message);
    process.exit(1);
  }
}

runParserTest();

