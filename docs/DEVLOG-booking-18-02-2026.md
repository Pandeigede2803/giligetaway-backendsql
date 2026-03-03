# Dev Log

---

## 2026-02-18

### Commit: `35f73c2` — Refactor booking validation middleware (security enhancement)

**Files yang diubah:**
- `middleware/validateBookingcreation.js`
- `routes/booking.js`
- `middleware/validateBookingcreation.new.js` *(file baru, alternatif/draft)*

---

### Ringkasan Perubahan

#### 1. Perubahan Arsitektur: Validasi → Kalkulasi Backend

Sebelumnya middleware hanya **memvalidasi** nilai finansial yang dikirim dari frontend (membandingkan dengan data backend, lalu reject jika berbeda). Pendekatan ini memiliki celah keamanan karena masih *mempercayai* nilai dari frontend sebagai acuan.

Hari ini diubah menjadi: middleware sekarang **menghitung sendiri** semua nilai finansial dari backend, lalu **mengganti** nilai dari frontend dengan hasil kalkulasi backend.

**Prinsip baru:** *Tidak ada nilai finansial yang dipercaya dari frontend.*

---

#### 2. `calculateTransportTotalAndValidate` — Transport Cost

| | Sebelum | Sesudah |
|---|---|---|
| Pendekatan | Validasi `transport_price` dari frontend vs DB | Hitung dari DB, replace nilai frontend |
| Toleransi | Ada toleransi 1.000 IDR | Tidak relevan lagi |
| Output | Throw error jika mismatch | Selalu pakai nilai DB |

**Alur baru:**
```
transport_id → cari di DB → cost × quantity = calculatedPrice
→ t.transport_price = calculatedPrice  ← replace nilai frontend
```

---

#### 3. `validateSingleBookingGrossTotal` — Single Booking

Diubah dari "validator" menjadi "calculator". Sekarang middleware ini melakukan 5 langkah berurutan:

1. **Step 1** – Hitung `ticket_total` dari harga season (low/high/peak) × `total_passengers`
2. **Step 2** – Hitung `transport_total` dari tabel `Transport` di database
3. **Step 3** – Resolve discount dari `discount_code` atau `discount_data.discountCode`
   - Cek `min_purchase` vs `ticket_total`
   - Hitung discount (percentage atau flat)
   - Terapkan cap `max_discount` jika ada
   - Discount tidak boleh melebihi `ticket_total`
4. **Step 4** – Hitung `gross_total` = `ticket_total` + `transport_total` − `discountAmount` + `bank_fee`
5. **Step 5** – Replace `req.body.ticket_total`, `req.body.gross_total`, `req.body.discount` dengan hasil kalkulasi

**Field yang dipercaya dari frontend:**
- `total_passengers`, `schedule_id`, `subschedule_id`, `booking_date`
- `transports[]` (hanya `transport_id` dan `quantity`)
- `bank_fee`, `discount_code`, `discount_data`

**Field yang TIDAK dipercaya (dihitung ulang):**
- `ticket_total` ❌
- `gross_total` ❌
- `transport_price` ❌
- `discount` (amount) ❌ — hanya `discount_code`-nya yang dipercaya

---

#### 4. `validateGrossTotalForSegment` — Round Trip Segments

Perubahan sama seperti single booking, diterapkan ke masing-masing segment (`departure` dan `return`):

- Hitung `ticket_total`, `transport_total`, discount dari backend
- Replace `segment.ticket_total`, `segment.gross_total`, `segment.discount`
- Support discount by `discount_code` (string) **atau** `discount_data.discountId` (ID langsung)

---

#### 5. `routes/booking.js` — Re-enable Middleware

Middleware yang sebelumnya di-comment-out karena masih dalam proses refactor, hari ini diaktifkan kembali:

```js
// SEBELUM (dinonaktifkan):
// validateSingleBookingGrossTotal,
// validateRoundTripGrossTotal,

// SESUDAH (diaktifkan):
validateSingleBookingGrossTotal,
validateRoundTripGrossTotal,
```

Artinya kalkulasi backend sekarang **aktif berjalan** di semua route booking.

---

### Motivasi / Alasan Perubahan

- **Security**: Mencegah manipulasi harga dari sisi client (price tampering)
- **Konsistensi**: Harga selalu konsisten dengan data di database, tidak bergantung kalkulasi frontend
- **Discount resolution**: Frontend bisa kirim `discount_code` (string kode voucher) dan backend yang akan mencari, validasi, dan menghitung nilainya

---

### Status

- [x] Single booking (`/bookings/transit-queue`) — middleware aktif
- [x] Round trip (`/bookings/round-trip/transit-queue`) — middleware aktif
- [ ] Console log production cleanup — beberapa `console.log` masih aktif (perlu dibersihkan sebelum production)
