# Perbaikan Bug: Error Release Seats di CronJob

## Deskripsi Error

**Pesan Error:**
```
❌ Error processing expired booking 15770: TypeError: Cannot read properties of undefined (reading 'length')
    at /Users/macbookprom1/Coding/giligetawaysqlexpress/giligetaway-backendsql/util/cronJobs.js:196:62
```

**Tanggal Diperbaiki:** 3 November 2025

**Dampak:** Kritis - Mencegah pemrosesan booking yang expired dengan benar, menyebabkan kursi tidak dikembalikan ke inventori.

---

## Analisis Akar Masalah

### Masalahnya

Fungsi `releaseSeats()` di `util/cronJobs.js` memiliki dua masalah kritis:

1. **Return Statement Hilang**: Fungsi tidak mengembalikan hasil dari fungsi release yang mendasarinya
2. **Ketidakcocokan Tipe**: Kode mengharapkan Array tetapi bisa menerima Set, menyebabkan `.length` menjadi undefined

### Alur Kode

```
handleExpiredBookings()
  └─> releaseSeats(booking, transaction)
       ├─> releaseMainScheduleSeats() → mengembalikan Array
       └─> releaseSubScheduleSeats() → mengembalikan Set
```

### Mengapa Gagal

**Kode Awal (RUSAK):**
```javascript
const releaseSeats = async (booking, transaction) => {
  // ... kode ...

  if (subschedule_id) {
    await releaseSubScheduleSeats(...);  // Mengembalikan Set, tapi tidak ditangkap
  } else {
    await releaseMainScheduleSeats(...); // Mengembalikan Array, tapi tidak ditangkap
  }

  // ❌ TIDAK ADA RETURN STATEMENT - fungsi mengembalikan undefined
};

// Kemudian di handleExpiredBookings():
const releasedSeatIds = await releaseSeats(booking, t);
console.log(`✅ Released seats: ${releasedSeatIds.length > 0 ? ...}`);
//                                  ^^^^^^^^^^^^^^^^^^^
//                                  undefined.length → undefined
//                                  Tidak bisa membaca 'length' dari undefined!
```

### Mengapa Booking 15770 Memicu Error

- Booking 15770 memiliki `subschedule_id`
- Memanggil `releaseSubScheduleSeats()` yang mengembalikan **Set**
- `releaseSeats()` tidak mengembalikan Set tersebut
- Hasil: `releasedSeatIds` adalah `undefined`
- Mengakses `undefined.length` menyebabkan error

---

## Perbaikannya

### 1. Menambahkan Return Statement ke `releaseSeats()`

**File:** `util/cronJobs.js` (baris 104-149)

```javascript
const releaseSeats = async (booking, transaction) => {
  const { schedule_id, subschedule_id, total_passengers, booking_date } = booking;

  console.log(`✅ MEMULAI RELEASE SEATS FOR BOOKING ID: ${booking.id}...`);

  try {
    let result;  // ✅ Ditambahkan: Menangkap nilai return

    if (subschedule_id) {
      result = await releaseSubScheduleSeats(
        schedule_id,
        subschedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    } else {
      result = await releaseMainScheduleSeats(
        schedule_id,
        booking_date,
        total_passengers,
        transaction
      );
    }

    console.log(`🎉Berhasil melepaskan ${total_passengers} kursi untuk Booking ID: ${booking.id}🎉`);
    return result;  // ✅ Ditambahkan: Mengembalikan hasilnya

  } catch (error) {
    console.error(`😻Gagal melepaskan kursi untuk Booking ID: ${booking.id} dan ticket ID: ${booking.ticket_id}`, error);
    throw error;
  }
};
```

### 2. Menangani Tipe Return Array dan Set

**File:** `util/cronJobs.js` (baris 197-203)

```javascript
const releasedSeatIds = await releaseSeats(booking, t);

// ✅ Menangani Array (dari releaseMainScheduleSeats) dan Set (dari releaseSubScheduleSeats)
const seatCount = releasedSeatIds instanceof Set
  ? releasedSeatIds.size
  : (releasedSeatIds?.length || 0);

const seatList = releasedSeatIds instanceof Set
  ? Array.from(releasedSeatIds).join(", ")
  : (releasedSeatIds?.join(", ") || "");

console.log(`✅ Released seats: ${seatCount > 0 ? seatList : "None"}`);
```

---

## Mengapa Ini Masalah Besar

### 1. **Rollback Transaksi**
Error terjadi di dalam transaksi database:
```javascript
await sequelize.transaction(async (t) => {
  const releasedSeatIds = await releaseSeats(booking, t);  // ❌ Error di sini
  // ... sisa kode tidak pernah dieksekusi
});
```

Ketika error terjadi:
- Seluruh transaksi di-rollback
- Kursi **tidak dikembalikan** ke inventori
- Status booking **tidak diupdate** menjadi expired
- Status transaksi tetap pending

### 2. **Masalah Konsistensi Data**
- Booking yang expired tetap dalam status "pending"
- Kursi tetap terkunci/tidak tersedia
- Inventori menunjukkan ketersediaan yang salah
- Booking baru tidak bisa mengakses kursi tersebut

### 3. **Notifikasi Email Gagal**
Logika notifikasi email berada setelah kode release seats:
```javascript
await releaseSeats(booking, t);  // ❌ Gagal di sini
// Kode email tidak pernah tercapai
```

### 4. **Kegagalan Berantai**
- Cron job akan mencoba ulang booking expired yang sama
- Error yang sama akan terjadi berulang kali
- Log akan penuh dengan pesan error
- Booking expired lainnya dalam batch masih akan diproses

---

## Perbedaan Tipe Return

### `releaseMainScheduleSeats()` Mengembalikan Array

**File:** `util/releaseMainScheduleSeats.js` (baris 146)

```javascript
const releaseMainScheduleSeats = async (...) => {
  const releasedSeatIds = [];

  // Tambahkan main schedule
  releasedSeatIds.push(mainScheduleSeatAvailability.id);

  // Tambahkan subschedule terkait
  for (const subSchedule of relatedSubSchedules) {
    releasedSeatIds.push(subScheduleSeatAvailability.id);
  }

  return releasedSeatIds;  // Mengembalikan Array dari SeatAvailability IDs
};
```

### `releaseSubScheduleSeats()` Mengembalikan Set

**File:** `util/releaseSubScheduleSeats.js` (baris 955)

```javascript
const releaseSubScheduleSeats = async (...) => {
  const updatedSubSchedules = new Set();

  for (const relatedSubSchedule of relatedSubSchedules) {
    updatedSubSchedules.add(relatedSubSchedule.id);
  }

  return updatedSubSchedules;  // Mengembalikan Set dari SubSchedule IDs
};
```

**Catatan:** Fungsi ini mengembalikan tipe ID yang berbeda:
- Main schedule: Mengembalikan `SeatAvailability.id` (Array)
- Sub schedule: Mengembalikan `SubSchedule.id` (Set)

---

## Testing

### Sebelum Perbaikan
```bash
❌ Error processing expired booking 15770: TypeError: Cannot read properties of undefined (reading 'length')
```

### Setelah Perbaikan
```bash
✅ MEMULAI RELEASE SEATS FOR BOOKING ID: 15770...
start releaseSubScheduleSeats, schedule_id: 59, subschedule_id: 110, ...
✅ Updated available seats for SubSchedule ID 110: 21
✅ Updated available seats for SubSchedule ID 111: 21
✅ Updated available seats for Main Schedule: 21
🎉Berhasil melepaskan 1 kursi untuk Booking ID: 15770🎉
✅ Released seats: 110, 111
✅ Booking 15770 (ticket GG-OW-15770) expired and processed successfully.
```

---

## Pencegahan

### Rekomendasi Ke Depan

1. **Standarisasi Tipe Return**: Pertimbangkan untuk membuat kedua fungsi mengembalikan tipe yang sama (baik Array atau Set)

2. **Tambahkan Type Checking**: Gunakan TypeScript atau JSDoc untuk mendokumentasikan tipe return yang diharapkan:
```javascript
/**
 * @returns {Array<number>|Set<number>} - SeatAvailability IDs atau SubSchedule IDs
 */
const releaseSeats = async (booking, transaction) => {
  // ...
};
```

3. **Tambahkan Unit Test**: Test kedua jalur kode:
```javascript
describe('releaseSeats', () => {
  it('harus mengembalikan array untuk booking main schedule', async () => {
    const result = await releaseSeats(mainScheduleBooking, transaction);
    expect(Array.isArray(result)).toBe(true);
  });

  it('harus mengembalikan set untuk booking subschedule', async () => {
    const result = await releaseSeats(subScheduleBooking, transaction);
    expect(result instanceof Set).toBe(true);
  });
});
```

4. **Tambahkan Logging**: Enhanced logging membantu mengidentifikasi masalah dengan cepat

---

## File yang Dimodifikasi

1. `util/cronJobs.js`
   - Baris 18: Ditambahkan `const { sendTelegramMessage } = require("../util/telegram");`
   - Baris 111: Ditambahkan `let result;`
   - Baris 117: Diubah menjadi `result = await releaseSubScheduleSeats(...)`
   - Baris 130: Diubah menjadi `result = await releaseMainScheduleSeats(...)`
   - Baris 141: Ditambahkan `return result;`
   - Baris 198-203: Ditambahkan pengecekan tipe untuk Array vs Set
   - Baris 279-301: Ditambahkan notifikasi Telegram untuk error level booking
   - Baris 314-333: Ditambahkan notifikasi Telegram untuk fatal error

---

## Masalah Terkait

- Kursi tidak dikembalikan untuk booking yang expired
- Booking expired застряли dalam status "pending"
- Ketidaksesuaian ketersediaan inventori
- Email notifikasi expired yang hilang

---

## Notifikasi Error via Telegram

Untuk mendeteksi error lebih cepat, notifikasi Telegram telah ditambahkan ke cron job:

### Setup

Tambahkan environment variables ini ke `.env`:

```bash
TELEGRAM_BOT_TOKEN=token_bot_anda_disini
TELEGRAM_CHAT_ID=chat_id_anda_disini
```

### Tipe Notifikasi

1. **Error Level Booking** (baris 279-301)
   - Dipicu ketika booking tertentu gagal diproses
   - Termasuk detail booking, pesan error, dan waktu
   - Memungkinkan intervensi manual untuk booking tersebut

2. **Fatal Error** (baris 314-333)
   - Dipicu ketika seluruh cron job gagal
   - Termasuk tipe error, pesan, dan stack trace
   - Menunjukkan masalah sistem secara keseluruhan

### Contoh Notifikasi

```
🚨 CRONJOB ERROR - Expired Booking Processing

Booking ID: 15770
Ticket ID: GG-OW-15770
Contact: user@example.com
Schedule ID: 59
SubSchedule ID: 110
Passengers: 2

Error: Cannot read properties of undefined (reading 'length')

Time: 3/11/2025, 14:30:00

⚠️ Seats may not have been released. Manual check required.
```

---

## Pelajaran yang Dipetik

1. Selalu kembalikan nilai dari fungsi async ketika pemanggil mengharapkannya
2. Konsisten dengan tipe return di antara fungsi yang serupa
3. Tangani variasi tipe secara defensif (Array vs Set)
4. Gunakan transaksi dengan hati-hati - error akan rollback semua perubahan
5. Enhanced logging membantu mendiagnosis masalah produksi dengan cepat
6. **Notifikasi error real-time** (Telegram) membantu mendeteksi masalah kritis segera sebelum menjadi lebih besar

---

## Ringkasan Singkat

**Masalah:** Fungsi `releaseSeats()` tidak mengembalikan nilai, menyebabkan `undefined.length` error.

**Penyebab:**
- Missing `return` statement di fungsi `releaseSeats()`
- Perbedaan tipe return (Array vs Set) tidak ditangani

**Solusi:**
- Tambahkan `return result;` di fungsi `releaseSeats()`
- Tambahkan pengecekan tipe untuk menangani Array dan Set

**Dampak:**
- Booking expired tidak diproses
- Kursi tidak dikembalikan ke inventori
- Transaksi database di-rollback
- Email notifikasi tidak terkirim
