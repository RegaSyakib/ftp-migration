const cron = require('node-cron');
const ingestionService = require('./ingestionService');

class CronService {
  constructor() {
    this.task = null;
    this.isProcessing = false;
  }

  /**
   * Menjalankan cron job untuk memantau folder file masuk secara berkala
   * @param {string} [schedule='*\/10 * * * * *'] - Format cron (default: setiap 10 detik)
   */
  start(schedule = process.env.CRON_SCHEDULE || '*/10 * * * * *') {
    if (this.task) {
      console.log('[Cron] Scheduler sudah berjalan.');
      return;
    }

    console.log(`[Cron] Memulai watcher scheduler dengan pola: "${schedule}"`);
    this.task = cron.schedule(schedule, async () => {
      // Mencegah job berjalan tumpang tindih jika proses sebelumnya belum selesai
      if (this.isProcessing) {
        console.log('[Cron] Proses sebelumnya masih berjalan, iterasi ini dilewati...');
        return;
      }

      this.isProcessing = true;
      try {
        await ingestionService.processIncomingDirectory();
      } catch (err) {
        console.error('[Cron Error] Terjadi kesalahan pada siklus ingest:', err.message);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  /**
   * Menghentikan cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[Cron] Scheduler dihentikan.');
    }
  }
}

module.exports = new CronService();

