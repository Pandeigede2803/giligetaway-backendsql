# Agent API Auto Seat Assignment

**Date:** 2026-02-XX
**Status:** ✅ Active

Auto-seat middleware now protects `/api/agent-access/book/v1` dan `/round-trip-book/v1` dari konflik kursi yang muncul ketika agent tidak menyediakan seat number (atau mengirim default yang bentrok).

## Kenapa dibutuhkan?
Beberapa agent belum mendukung pemilihan kursi, sehingga request mereka selalu memakai seat default (misal `A1`). Hal ini menyebabkan tabrakan dengan booking lain yang sudah punya seat valid. Middleware baru melakukan:

1. Validasi seat number bila sudah dikirim (harus ada di layout boat & belum di-book).
2. Auto assign kursi kosong jika field seat kosong atau bertabrakan.
3. Blok request bila seat layout boat kosong atau semua kursi terisi (kasus ini harus ditangani manual).

## Flow Teknis

1. **Hook route** – lihat `routes/agentRoutesApi.js`:
   - One-way: `validateAgentBooking → assignAgentSeatNumbers → validateAgentDiscount → createAgentBooking`
   - Round-trip: `validateAgentRoundTripBooking → assignAgentRoundTripSeatNumbers → validateAgentRoundTripDiscount → createAgentRoundTripBooking`

2. **Middleware** (`middleware/assignAgentSeatNumbers.js`):
   - Hanya melakukan deteksi cepat: cek apakah penumpang non-infant punya `seat_number*` dan apakah ada duplikat dalam payload.
   - Jika ditemukan kursi kosong atau bentrok, middleware menempelkan `req.autoAssignSeat` (atau versi departure/return) dengan flag `required: true`; controller tidak menolak request, hanya meneruskan flag ini ke queue.

3. **Queue auto-assign** (`bookingAgentQueue` & `bookingAgentRoundQueue`):
   - Setelah seat availability link dan email terkirim, worker mengecek `job.data.auto_assign_required`.
   - Jika perlu, worker memanggil `util/autoAssignSeats.js` untuk mengambil layout boat, membaca `SeatAvailability` + daftar kursi yang sudah ter-booking (menggunakan helper yang sama dengan `/search-schedule/v3`), lalu meng-update `Passengers.seat_number` secara langsung.
   - Kegagalan auto-assign dikirim ke Telegram, tapi tidak menggagalkan job utama.

### Flow Chart (Sederhana)

```
Agent Request
   |
   v
validateAgent* middleware
   |
   v
assignAgentSeatNumbers (flag + metadata jika kursi kosong/duplikat?)
   |
   v
Controller create booking + push Bull job { auto_assign_required }
   |
   v
bookingAgentQueue / bookingAgentRoundQueue worker
   |
   +--> Handle seat availability + transport + email
   |
   +--> Kalau auto_assign_required = true → util/autoAssignSeats
   |
   v
Passengers.seat_number diperbarui
```

## Catatan Operasional

- Tambahkan kursi baru cukup update layout di tabel `Boats` saja.
- Kalau ingin mengecualikan seat tertentu, hapus dari layout (middleware hanya mengenal kursi yang ada di layout).
- Jika agent mengirim seat manual yang tidak ada di layout, request akan tetap di-assign otomatis (seat lama diabaikan) → beri tahu agent jika perlu.
- Error 409 sekarang hanya muncul bila layout Boat kosong (karena util tidak punya referensi kursi); middleware sendiri hanya memberi flag.
- Auto-assign di queue memakai daftar kursi ter-booking yang sama dengan `/api/agent-access/search-schedule/v3`, jadi data yang dilihat agent = data yang dipakai worker.

Dengan ini, agent yang belum support seat selection tidak lagi menyebabkan kursi double-booked 😺
