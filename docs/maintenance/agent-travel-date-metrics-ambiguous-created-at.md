# Agent Travel Date Metrics - Ambiguous `created_at`

## Ringkasan

Error yang muncul:

```txt
ER_NON_UNIQ_ERROR: Column 'created_at' in where clause is ambiguous
```

Terjadi saat endpoint metrics agent dengan log:

```txt
start the traveler date metrics agent
```

## Akar Masalah

Query melakukan `LEFT JOIN` ke beberapa tabel (`TransportBookings`, `Passengers`, `AgentCommissions`) yang juga memiliki kolom `created_at`.

Di saat yang sama, filter tanggal dibangun menggunakan ekspresi tanpa prefix tabel:

- `YEAR(created_at)`
- `MONTH(created_at)`
- `DAY(created_at)`

Karena `created_at` ada di lebih dari satu tabel hasil join, MySQL tidak bisa menentukan kolom mana yang dimaksud, sehingga melempar error `ambiguous`.

## Bukti Lokasi Kode

- Endpoint travel date metrics:
  - `controllers/metricsController.js` pada fungsi `getMetricsByAgentIdTravelDate`
- Builder filter tanggal:
  - `controllers/metricsController.js` pada fungsi `buildDateFilter`
- Titik rawan:
  - `sequelize.col("created_at")` pada blok `YEAR/MONTH/DAY`

Catatan: di file yang sama sudah ada jejak komentar solusi yang benar (menggunakan `Booking.created_at`) tetapi belum aktif dipakai oleh implementasi saat ini.

## Kenapa Bisa Kena Endpoint Travel Date

Walaupun endpoint travel date menggunakan `booking_date` untuk `combinedFilter`, fungsi itu tetap memanggil `buildDateFilter(...)`.
Untuk mode filter tertentu (mis. `year/month/day`), `buildDateFilter` menghasilkan kondisi berbasis `created_at` tanpa alias tabel.
Akibatnya query akhir masih bisa memuat `YEAR(created_at)` dan memicu error ambiguity.

## Brainstorm Opsi Perbaikan

1. Quick fix
- Ubah semua `sequelize.col("created_at")` menjadi `sequelize.col("Booking.created_at")`.
- Dampak: paling cepat, minim perubahan.

2. Fix yang lebih rapi dan reusable
- Refactor `buildDateFilter` agar menerima parameter target kolom, misalnya:
  - `column: "Booking.created_at"` untuk endpoint booking-created metrics.
  - `column: "Booking.booking_date"` untuk endpoint travel-date metrics.
- Dampak: mencegah bug serupa saat ada endpoint baru.

3. Optimasi query (disarankan setelah fix ambiguity)
- Hindari `YEAR/MONTH/DAY(column)` karena cenderung menghambat pemakaian index.
- Ganti menjadi rentang tanggal (`>= startOf...` dan `<= endOf...`) agar lebih ramah index.

## Rekomendasi

Mulai dari opsi 2 (refactor kecil, aman, maintainable), lalu pertimbangkan opsi 3 jika perlu peningkatan performa.
