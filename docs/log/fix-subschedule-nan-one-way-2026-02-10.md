# Fix: Sanitasi `subschedule_id` Booking One-Way Agent (2026-02-10)

## Ringkasan
Booking one-way agen gagal apabila frontend mengirimkan `subschedule_id` kosong (`""` / `"N/A"`) atau nilai yang membuat `parseInt` menghasilkan `NaN`. Middleware `validateAgentBooking` tidak mem-filter kasus tersebut sehingga nilai mentah diteruskan ke controller. Dampaknya: Sequelize mencoba menyimpan `NaN` ke kolom integer dan MySQL melempar error `Incorrect integer value`.

## Akar Masalah
- Middleware hanya melakukan `parseInt` lalu melanjutkan validasi jika hasilnya truthy.
- Saat hasil parsing `NaN`, blok validasi dilewati dan field tetap ada di payload.
- Controller menyebarkan `req.body` ke `Booking.create`, sehingga `NaN` dikirim ke database.

## Perbaikan
- Menormalisasi `subschedule_id` di `middleware/validateAgentBooking.js`:
  - Nilai `undefined`, `null`, `""`, `"N/A"` dihapus dari payload sehingga kolom tersimpan sebagai `NULL`.
  - Nilai lain diparse dan diverifikasi sebagai angka valid; jika bukan angka, request ditolak dengan HTTP 400.
  - Validasi subschedule di database sekarang dipicu selama field tidak `undefined/null`.

## Dampak
- Booking one-way tetap berjalan ketika subschedule memang tidak dipilih.
- Database tidak lagi menerima nilai non-angka untuk `subschedule_id`.
- Log validasi lebih jelas karena error dikembalikan lebih awal di middleware.

## File Terkait
- `middleware/validateAgentBooking.js`
- `docs/log/CHANGELOG.md`
