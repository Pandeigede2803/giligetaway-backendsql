:::writing{variant=“standard” id=“55321”}

🚨 Backend Focus Shift – CPU Spike on Dashboard Load

📌 Current Observation
	•	MySQL container stable saat idle:
	•	CPU: ~1%
	•	RAM: ~613MB (31%)
	•	Namun saat buka dashboard pertama kali:
	•	CPU spike hingga 120%+
	•	Sebelumnya menyebabkan MySQL crash (OOM)
⸻

💣 Core Problem (Updated Diagnosis)

❗ Not a constant load issue

👉 Ini adalah BURST LOAD problem

Saat dashboard dibuka:
	•	Banyak API dipanggil bersamaan
	•	Backend hit MySQL paralel
	•	Query berat dieksekusi bersamaan

⸻

🔥 Root Causes (Highly Likely)

1. Parallel API Calls

Frontend / backend memanggil banyak endpoint secara bersamaan:
	•	bookings
	•	stats
	•	seat availability
	•	agents
	•	transactions

⸻

2. Heavy Queries

Query kemungkinan:
	•	JOIN multiple tables
	•	aggregation (COUNT, SUM)
	•	seat availability calculation

⸻

3. No Caching

Setiap load dashboard:
👉 semua query hit database ulang

⸻

4. No Concurrency Control
	•	Tidak ada limit request
	•	Tidak ada queue
	•	Semua request langsung eksekusi

⸻

💥 Impact
	•	CPU spike (100%+)
	•	Query melambat
	•	Risk MySQL crash (OOM sebelumnya)
	•	API response lambat / gagal

⸻

🚀 Required Backend Actions

🥇 1. Reduce Parallel Requests (CRITICAL)

❌ Current (likely)

Promise.all([
  getBookings(),
  getStats(),
  getSeats(),
  getAgents()
])


⸻

✅ Fix

await getStats();
await getBookings();

Atau:

await getStats();
await delay(300);
await getBookings();


⸻

🥈 2. Implement Caching (HIGH IMPACT)

👉 Dashboard tidak perlu real-time per detik

Options:
	•	Redis
	•	Memory cache

⸻

Example:

if (cache.exists('dashboard_stats')) {
  return cache.get('dashboard_stats');
}


⸻

🥉 3. Optimize Queries

Action:

SHOW PROCESSLIST;

Cari:
	•	query lama
	•	query sering muncul

⸻

🏅 4. Limit Backend Concurrency

Gunakan:
	•	p-limit
	•	queue

⸻

🎖️ 5. Precompute Data (Advanced)

👉 Generate data via cron → simpan ke cache
👉 Dashboard tinggal read cache

⸻

📊 Monitoring Plan

Reproduce spike:
	1.	Jalankan:

watch -n 1 docker stats

	2.	Buka dashboard
	3.	Capture:

	•	CPU spike
	•	Memory spike

⸻

Check MySQL:

SHOW PROCESSLIST;


⸻

⚠️ Important Notes
	•	Issue bukan dari RAM sekarang (swap sudah bantu)
	•	Issue bukan dari Docker
	•	Issue berasal dari:
👉 uncontrolled parallel queries

⸻

💣 Risk if Not Fixed
	•	CPU spike terus
	•	MySQL overload
	•	kemungkinan crash lagi saat traffic naik

⸻

🎯 Target Final State
	•	CPU stabil saat dashboard load
	•	Tidak ada spike >70%
	•	Query terkontrol
	•	Dashboard load tetap cepat

⸻

🧠 Final Verdict

👉 Sistem sekarang:
	•	✅ Stabil saat idle
	•	❌ Tidak stabil saat spike

👉 Root cause:

Uncontrolled parallel load from dashboard + backend


⸻

:::

tugas backend:

check query yg memerlukan resource paling berat dari databse sperti dashboard, cron, dan yg lain

---

## Update Audit Backend: Cron (Database Overhit)

Tanggal audit: 2026-03-29

### Temuan utama (urut dampak ke database)

1. **Seat mismatch cron (paling berat)**
- Scheduler: `util/seatFixCron.js` (`CRON_FREQUENCY_SEAT_MISMATCH`, default tiap 3 jam)
- Fungsi berat: `fixAllSeatMismatches2()` di `controllers/seatAvailabilityController.js`
- Masalah:
  - `SeatAvailability.findAll` global (tanpa limit tanggal) + join dalam ke `Schedule -> Boat` dan `BookingSeatAvailability -> Booking -> Passenger`
  - Setelah itu loop update satu per satu (`await sa.update(...)`)
- Risiko: full table scan + join besar + banyak roundtrip update saat data seat tumbuh.

2. **Duplicate seat cron (berat + frekuensi tinggi)**
- Scheduler: `util/cronFrequencySeatDuplicates.js` (default tiap 1 jam)
- Fungsi berat: `findDuplicateSeats()` di `controllers/seatAvailabilityController.js`
- Masalah:
  - Raw SQL join besar (`Passengers`, `Bookings`, `BookingSeatAvailability`, `SeatAvailability`)
  - Agregasi berat (`GROUP BY`, `HAVING COUNT(DISTINCT ...) > 1`, `GROUP_CONCAT`)
  - Scope tanggal hardcoded terbuka dari `2025-07-17` (bisa terus membesar)
- Risiko: query agregasi makin lambat seiring data historis bertambah.

3. **Custom email cron (N+1 query)**
- Scheduler: `util/customEmailJob.js` (default tiap 2 jam)
- Fungsi berat: `runCustomEmailJob()` di `controllers/customEmailSchedulerController.js`
- Masalah:
  - Per scheduler melakukan `Booking.findAll(...)`
  - Per booking cek log kirim `EmailSendLog.findOne(...)` (N+1 query pattern)
  - Batch pakai `Promise.all` masih bisa memicu spike concurrent query
- Risiko: lonjakan query saat eligible booking banyak.

4. **Waiting list cron (query berulang per grup seat)**
- Scheduler: `util/waitingListCron.js` (default tiap 1 jam)
- Masalah:
  - Awal job `WaitingList.findAll(...)`
  - Lalu per `seat_availability_id` memanggil `waitingListNotify(...)` yang query `WaitingList.findAll(...)` lagi dengan include relasi
  - Double filtering dan repetitive fetch untuk data yang overlap
- Risiko: query total membesar secara multiplicative saat waiting list ramai.

5. **Expired/unpaid cron (loop transaksi per booking)**
- Scheduler:
  - `util/cronJobs.js` default tiap 5 menit
  - `util/unpaidReminderCronJobs.js` default tiap 15 menit
- Masalah:
  - Batch fetch booking, lalu proses per booking dalam transaksi
  - Tiap item memicu chain query release seat (`releaseBookingSeats`, `releaseMainScheduleSeats`, `releaseSubScheduleSeats`)
- Risiko: saat backlog naik, terjadi burst query beruntun.

### Bug logika yang ikut memperbesar beban

- Di `util/waitingListCron.js`, variabel `isValid` tidak pernah di-set ke `false` saat invalid condition.
- Dampak: entry invalid tetap masuk flow valid, sehingga pekerjaan dan query lanjutan bisa tetap jalan.

### Prioritas perbaikan (cron dulu)

1. Optimasi `fixAllSeatMismatches2`:
- Batasi scope data (date window, availability aktif, atau changed since last run)
- Hindari eager include terlalu lebar, pindah ke query agregasi terukur
- Gunakan bulk update terkontrol (chunked), bukan update 1-by-1 tanpa batching

2. Optimasi `findDuplicateSeats`:
- Batasi window tanggal (mis. rolling 7/14/30 hari)
- Pastikan index pada kolom join/filter utama (`booking_id`, `seat_availability_id`, `payment_status`, `date`, `seat_number`)
- Pertimbangkan materialized/precomputed check untuk histori lama

3. Hilangkan N+1 di custom email cron:
- Ambil `EmailSendLog` sekali per scheduler (set/map booking_id), jangan `findOne` per booking
- Batasi concurrency kirim + query (queue atau p-limit)

4. Refactor waiting list cron:
- Single fetch path (hindari fetch ulang data yang sama di `waitingListNotify`)
- Perbaiki bug `isValid` agar invalid entry keluar lebih awal

5. Tambahkan guard concurrent run:
- Pastikan tiap cron punya `isRunning` lock (beberapa sudah punya, sebagian belum)
- Hindari overlap run saat job sebelumnya belum selesai

---







## Plan Implementasi Fix: Seat Mismatch Cron

Target: menurunkan CPU spike dan query burst dari job seat mismatch tanpa mengubah hasil bisnis.

### Phase 1 — Baseline & Guard (quick win)

1. Tambah instrumentation:
- Log `started_at`, `ended_at`, `duration_ms`, `checked_count`, `fixed_count`.
- Simpan log ringkas per run agar bisa dibandingkan sebelum/sesudah.

2. Tambah overlap protection:
- Gunakan `isRunning` lock pada scheduler seat mismatch.
- Jika run sebelumnya belum selesai, tick berikutnya di-skip.

3. Tambah window kontrol awal:
- Batasi scope data by date window (mis. rolling X hari) via env.
- Fallback ke full scan hanya jika env memerintahkan.

### Phase 2 — Refactor Query (impact terbesar)

1. Ganti pola eager-load besar:
- Hindari `SeatAvailability.findAll` + include bertingkat untuk semua data.
- Pindah ke query agregasi SQL per `seat_availability_id`:
  - hitung `occupiedSeats = COUNT(DISTINCT normalized seat_number)`
  - filter booking status valid
  - exclude infant

2. Ambil kapasitas dengan join minimal:
- Join ke `Schedule`/`Boat` hanya field yang dibutuhkan (`capacity`, `published_capacity`, `boost`).

3. Hitung `correctAvailableSeats` di layer service:
- `correctCapacity = boost ? capacity : published_capacity`
- `correctAvailableSeats = max(0, correctCapacity - occupiedSeats)`

### Phase 3 — Update Strategy

1. Update hanya yang mismatch:
- Lewati row yang nilainya sudah benar.

2. Batch update:
- Proses chunk per N row untuk meratakan load.
- Hindari update satu-per-satu tanpa batching jika volume besar.

3. Safety:
- Jalankan dalam transaction per batch (bukan satu transaction raksasa).

### Phase 4 — Index & DB Hygiene

1. Verifikasi/tambah index:
- `BookingSeatAvailability(seat_availability_id, booking_id)`
- `Passengers(booking_id, passenger_type, seat_number)`
- `Bookings(id, payment_status)`
- `SeatAvailability(id, schedule_id, date, custom_seat)`

2. Review query plan:
- Gunakan `EXPLAIN` pada query agregasi baru.

### Phase 5 — Validation

1. Uji konsistensi hasil:
- Bandingkan `fixed_count` dan sample hasil lama vs baru.

2. Uji performa:
- Bandingkan `duration_ms`, CPU MySQL, dan jumlah query per run.

3. Rollout bertahap:
- Aktifkan lewat env flag.
- Monitor 1-3 hari sebelum full rollout.

### Definition of Done

- Seat mismatch cron tidak overlap.
- Durasi job turun signifikan dibanding baseline.
- Tidak ada perubahan hasil bisnis (available seats tetap akurat).
- Tidak ada spike CPU abnormal saat cron berjalan.
