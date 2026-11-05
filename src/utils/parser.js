const fs = require('fs');
const path = require('path');

/**
 * Konversi timestamp format YYYYMMDDHHmmss ke format SQL timestamp YYYY-MM-DD HH:mm:ss
 * Contoh: '20260413202022' -> '2026-04-13 20:20:22'
 * @param {string} rawTimestamp 
 * @returns {string|null}
 */
function parseTimestamp(rawTimestamp) {
  if (!rawTimestamp || rawTimestamp.length !== 14 || !/^\d{14}$/.test(rawTimestamp)) {
    return null;
  }

  const year = rawTimestamp.substring(0, 4);
  const month = rawTimestamp.substring(4, 6);
  const day = rawTimestamp.substring(6, 8);
  const hour = rawTimestamp.substring(8, 10);
  const minute = rawTimestamp.substring(10, 12);
  const second = rawTimestamp.substring(12, 14);

  // Validasi nilai kalender dasar
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const h = parseInt(hour, 10);
  const min = parseInt(minute, 10);
  const s = parseInt(second, 10);

  if (m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) {
    return null;
  }

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Parser file format .zrx logger
 * Mendukung multi-logger dan multi-channel dalam satu file.
 * 
 * Format header:
 * #REXCHANGE<id_logger>_<channel>|*|
 * ##CDASA<id_logger>|*|CDASANAME<name>|*|
 * ##CCHANNEL<channel>|*|CCHANNELNO<no>|*|CUNIT<unit>|*|
 * 
 * Format data:
 * <YYYYMMDDHHmmss>\t<value>
 * 
 * @param {string} content - Konten teks file .zrx
 * @param {string} [filename] - Nama file (opsional untuk konteks log)
 * @returns {Object} { data: Array, summary: Object, errors: Array }
 */
function parseZrxContent(content, filename = 'unknown') {
  if (typeof content !== 'string') {
    throw new Error('Konten file harus bertipe string.');
  }

  const lines = content.split(/\r?\n/);
  const records = [];
  const errors = [];
  const blockStats = [];

  // Konteks blok aktif saat membaca baris demi baris
  let currentLogger = null;
  let currentChannel = null;
  let currentUnit = null;
  let currentBlockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();

    // Lewati baris kosong
    if (!line) {
      continue;
    }

    // 1. Deteksi Awal Blok Baru: #REXCHANGE<id_logger>_<channel>|*|
    if (line.startsWith('#REXCHANGE')) {
      // Simpan statistik blok sebelumnya jika ada
      if (currentLogger && currentChannel) {
        blockStats.push({
          id_logger: currentLogger,
          channel: currentChannel,
          unit: currentUnit,
          count: currentBlockCount,
        });
      }

      // Reset untuk blok baru
      currentLogger = null;
      currentChannel = null;
      currentUnit = null;
      currentBlockCount = 0;

      // Regex ekstrak logger dan channel dari #REXCHANGEUCL11112_CH01|*|
      const rexMatch = line.match(/^#REXCHANGE([A-Za-z0-9]+)_([A-Za-z0-9]+)/i);
      if (rexMatch) {
        currentLogger = rexMatch[1].trim();
        currentChannel = rexMatch[2].trim();
      } else {
        errors.push({
          line: lineNumber,
          content: line,
          message: 'Format header #REXCHANGE tidak valid.',
        });
      }
      continue;
    }

    // 2. Deteksi Header Unit & Metadata: ##CCHANNEL...CUNIT<unit>|*|
    if (line.startsWith('##CCHANNEL') || line.includes('CUNIT')) {
      // Regex ekstrak nilai unit dari CUNIT<unit>|*|
      const unitMatch = line.match(/CUNIT([^|*]+)/i);
      if (unitMatch) {
        currentUnit = unitMatch[1].trim();
      }

      // Fallback channel dari CCHANNEL jika belum dapat
      if (!currentChannel) {
        const chMatch = line.match(/##CCHANNEL([A-Za-z0-9]+)/i);
        if (chMatch) {
          currentChannel = chMatch[1].trim();
        }
      }
      continue;
    }

    // 3. Deteksi Header CDASA (info tambahan logger)
    if (line.startsWith('##CDASA')) {
      // Jika logger belum terdeteksi dari #REXCHANGE, ambil dari sini
      if (!currentLogger) {
        const dasaMatch = line.match(/^##CDASA([A-Za-z0-9]+)/i);
        if (dasaMatch) {
          currentLogger = dasaMatch[1].trim();
        }
      }
      continue;
    }

    // 4. Baris Data Pengukuran: <timestamp 14 digit> <spasi/tab> <nilai numeric>
    // Contoh: 20260413202022	0.10
    const dataMatch = line.match(/^(\d{14})\s+([-+]?[0-9]*\.?[0-9]+)$/);
    if (dataMatch) {
      if (!currentLogger || !currentChannel) {
        errors.push({
          line: lineNumber,
          content: line,
          message: 'Baris data ditemukan sebelum header logger/channel diinisialisasi.',
        });
        continue;
      }

      const rawTimestamp = dataMatch[1];
      const rawValue = dataMatch[2];

      const recorded_at = parseTimestamp(rawTimestamp);
      if (!recorded_at) {
        errors.push({
          line: lineNumber,
          content: line,
          message: `Nilai timestamp tidak valid: "${rawTimestamp}".`,
        });
        continue;
      }

      const value = parseFloat(rawValue);
      if (isNaN(value)) {
        errors.push({
          line: lineNumber,
          content: line,
          message: `Nilai pengukuran bukan angka: "${rawValue}".`,
        });
        continue;
      }

      records.push({
        id_logger: currentLogger,
        channel: currentChannel,
        recorded_at,
        value,
        unit: currentUnit || null,
      });

      currentBlockCount++;
      continue;
    }

    // Baris tidak dikenali (jika ada komentar lain atau baris rusak)
    if (!line.startsWith('#')) {
      errors.push({
        line: lineNumber,
        content: line,
        message: 'Baris tidak sesuai format header maupun data pengukuran.',
      });
    }
  }

  // Simpan statistik blok terakhir
  if (currentLogger && currentChannel) {
    blockStats.push({
      id_logger: currentLogger,
      channel: currentChannel,
      unit: currentUnit,
      count: currentBlockCount,
    });
  }

  return {
    filename,
    totalRecords: records.length,
    summary: {
      totalBlocks: blockStats.length,
      blocks: blockStats,
      totalErrors: errors.length,
    },
    data: records,
    errors,
  };
}

/**
 * Membaca dan mem-parsing file .zrx langsung dari path file lokal
 * @param {string} filePath - Absolute atau relative path ke file .zrx
 * @returns {Object}
 */
function parseZrxFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File tidak ditemukan di path: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const filename = path.basename(resolvedPath);
  return parseZrxContent(content, filename);
}

module.exports = {
  parseTimestamp,
  parseZrxContent,
  parseZrxFile,
};

