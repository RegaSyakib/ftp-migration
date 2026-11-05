# FTP Data Logger Migration & Realtime System

Sistem backend Node.js untuk migrasi otomatis file log format `.zrx` ke database PostgreSQL 18, dilengkapi pencegahan duplikasi data (*idempotency*) dan *realtime broadcast* ke frontend menggunakan Socket.IO.

---

## 📁 Struktur Folder & File

```text
ftp-migration/
├── public/
│   └── index.html           # Web Dashboard monitor live (Socket.IO & statistik)
├── src/
│   ├── config/
│   │   └── db.js            # Koneksi PostgreSQL Connection Pool (pg.Pool)
│   ├── scripts/
│   │   ├── test-db.js       # Script uji koneksi DB & verifikasi skema tabel
│   │   ├── test-parser.js   # Script uji parser file .zrx lokal
│   │   ├── test-insert.js   # Script uji batch insert & duplicate prevention
│   │   ├── test-simulation.js # Script uji alur simulasi watcher & ingestion
│   │   ├── migrate.js       # Script migrasi penambahan UNIQUE constraint
│   │   └── generate-mock-file.js # Generator file mock .zrx dengan data baru
│   ├── services/
│   │   ├── measurementService.js # Query database, transaksi batch & statistik
│   │   ├── ingestionService.js   # Orkestrator parsing, simpan DB & Socket.IO
│   │   └── cronService.js        # Scheduler otomatis pemantau file masuk
│   ├── utils/
│   │   └── parser.js        # Parser file .zrx (multi-logger & multi-channel)
│   └── index.js             # Entry point server Express API & Socket.IO
├── storage/
│   └── ftp_simulator/
│       ├── incoming/        # Folder penampung file .zrx masuk (simulasi FTP)
│       ├── processed/       # Arsip file yang sukses diproses
│       └── failed/          # Arsip file yang rusak/gagal diproses
├── .env                     # Konfigurasi credential lokal (rahasia)
├── .env.example             # Template konfigurasi environment yang aman
├── .gitignore               # Mencegah .env dan file data klien ter-commit
└── package.json             # Dependensi dan npm scripts
```

---

## ⚡ Fitur Utama

1. **Parser Multi-Logger & Multi-Channel (`src/utils/parser.js`)**
   - Mendeteksi blok `#REXCHANGE`, `##CDASA`, dan `##CCHANNEL...CUNIT`.
   - Mengonversi format timestamp `YYYYMMDDHHmmss` ke format SQL `YYYY-MM-DD HH:mm:ss`.
   - Mendukung berbagai macam satuan (misal: `mm`, `mm/min`) dalam satu file yang sama.

2. **Pencegahan Duplikasi / Idempotensi (`src/services/measurementService.js`)**
   - Menggunakan mekanisme PostgreSQL `INSERT ... ON CONFLICT (id_logger, channel, recorded_at) DO NOTHING`.
   - File yang sama dapat diproses berulang kali tanpa risiko duplikasi data di tabel `arr_ftp`.

3. **Batch Insert & Database Transaction**
   - Memproses ribuan data dalam potongan (*batch*) dan dibungkus dalam transaksi `BEGIN` ... `COMMIT` / `ROLLBACK` demi efisiensi dan integritas data.

4. **Automasi Watcher / Scheduler (`src/services/cronService.js`)**
   - Memantau folder file masuk secara berkala (default per 10 detik).
   - Memiliki *mutex lock* (`isProcessing`) untuk mencegah tumpah-tindih eksekusi.

5. **Broadcast Realtime via Socket.IO (`new_measurement`)**
   - Mengirim event realtime ke frontend **hanya untuk data yang benar-benar baru** tersimpan di database.

6. **Web Dashboard Interaktif (`public/index.html`)**
   - Memantau koneksi Socket.IO secara live.
   - Menampilkan metrik data dan tabel live feed.
   - Memiliki tombol instan untuk menguji simulasi alur data.

7. **REST API (`src/index.js`)**
   - `GET /health` : Status kesehatan aplikasi.
   - `GET /api/stats` : Statistik tabel dan jumlah logger/channel.
   - `GET /api/measurements` : Riwayat data dengan filter `id_logger` dan `channel`.
   - `POST /api/simulate-fresh` : Trigger pembuatan file baru untuk uji realtime.
   - `POST /api/simulate-drop` : Trigger uji file asli untuk uji pencegahan duplikat.

---

## 🚀 Perintah Terminal (NPM Scripts)

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server Express, Socket.IO, dan Cron Watcher |
| `npm run test:db` | Menguji koneksi database & integritas kolom/constraint |
| `npm run test:parser` | Menguji parser dengan file contoh `.zrx` |
| `npm run test:insert` | Menguji batch insert & mekanisme *duplicate handling* |
| `npm run test:sim` | Menjalankan simulasi penuh alur *incoming* &rarr; *processed* |

