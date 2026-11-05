const fs = require('fs');
const path = require('path');

/**
 * Helper untuk format angka 2 digit
 */
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Menghasilkan file .zrx dengan timestamp baru dan variasi data pengukuran
 * @param {string} targetDir - Folder tujuan penyimpanan file
 * @param {string} [idLogger='UCL11112']
 * @returns {string} Path file yang dibuat
 */
function generateMockZrxFile(targetDir, idLogger = 'UCL11112') {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const now = new Date();
  const fileTimestamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const filename = `${idLogger}_${fileTimestamp}.zrx`;
  const filePath = path.join(targetDir, filename);

  const lines = [];

  // Channel 1: CH01 (mm)
  lines.push('');
  lines.push(`#REXCHANGE${idLogger}_CH01|*|`);
  lines.push(`##CDASA${idLogger.replace(/\D/g, '') || '11112'}|*|CDASANAMEUNILOGCOM|*|`);
  lines.push(`##CCHANNELCH01|*|CCHANNELNO01|*|CUNITmm|*|`);

  for (let i = 5; i >= 1; i--) {
    const t = new Date(now.getTime() - i * 30 * 1000); // interval 30 detik
    const tsStr = `${t.getFullYear()}${pad2(t.getMonth() + 1)}${pad2(t.getDate())}${pad2(t.getHours())}${pad2(t.getMinutes())}${pad2(t.getSeconds())}`;
    const val = (Math.random() * 0.5 + 0.1).toFixed(2);
    lines.push(`${tsStr}\t${val}`);
  }

  // Channel 2: CH02 (mm/min)
  lines.push('');
  lines.push(`#REXCHANGE${idLogger}_CH02|*|`);
  lines.push(`##CDASA${idLogger.replace(/\D/g, '') || '11112'}|*|CDASANAMEUNILOGCOM|*|`);
  lines.push(`##CCHANNELCH02|*|CCHANNELNO02|*|CUNITmm/min|*|`);

  for (let i = 5; i >= 1; i--) {
    const t = new Date(now.getTime() - i * 30 * 1000);
    const tsStr = `${t.getFullYear()}${pad2(t.getMonth() + 1)}${pad2(t.getDate())}${pad2(t.getHours())}${pad2(t.getMinutes())}${pad2(t.getSeconds())}`;
    const val = (Math.random() * 1.2 + 0.2).toFixed(2);
    lines.push(`${tsStr}\t${val}`);
  }

  lines.push('');

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return filePath;
}

if (require.main === module) {
  const defaultDir = path.resolve(__dirname, '../../storage/ftp_simulator/incoming');
  const created = generateMockZrxFile(defaultDir);
  console.log(`[Mock Generator] Berhasil membuat file: ${path.basename(created)} di ${defaultDir}`);
}

module.exports = { generateMockZrxFile };

