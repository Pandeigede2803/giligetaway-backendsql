# Booking Sync Total Handover

Date: 2026-03-27

Dokumen ini dibuat untuk handover ke frontend agar tahu kapan dan bagaimana memanggil endpoint sync total booking.

## Tujuan

Endpoint ini dipakai untuk menghitung ulang total booking ketika:

- `booking_date` berubah
- `schedule_id` berubah
- `subschedule_id` berubah
- harga schedule berbeda untuk tanggal yang berbeda

Endpoint ini **tidak mengubah schedule/date**. Endpoint ini hanya menyinkronkan perhitungan finansial berdasarkan data booking yang sudah tersimpan.

## Endpoint

```http
PUT /api/bookings/sync-total/:id
```

`id` adalah `booking.id`.

### Preview Endpoint

```http
GET /api/bookings/sync-total/:id/preview
```

Endpoint ini dipakai untuk melihat hasil perhitungan tanpa menyimpan perubahan ke database.

## Kapan Frontend Harus Memanggil

Frontend harus memanggil endpoint PUT ini setelah perubahan data berikut berhasil disimpan:

- booking schedule berubah
- booking date berubah
- passenger count berubah
- discount data berubah
- transport data berubah

Jika user hanya mengubah tampilan form tanpa menyimpan ke backend, endpoint PUT ini tidak perlu dipanggil.

Untuk cek hasil perubahan sebelum save, frontend bisa memanggil endpoint GET preview.

## Flow Perhitungan

Endpoint akan melakukan langkah berikut:

1. Load booking beserta relasi `schedule`, `subSchedule`, `transportBookings`, dan `Agent`
2. Hitung ulang `ticket_total` dari harga season sesuai `booking_date`
3. Hitung ulang `transport_total`
4. Resolve diskon dari `discount_data`
5. Hitung ulang `gross_total`
6. Hitung ulang komisi agent jika booking punya `agent_id`
7. Update `Booking` dan `AgentCommission`

## Rumus

### Ticket Total

```text
ticket_total = price_per_passenger x total_passengers
```

### Transport Total

```text
transport_total = sum(transport_price x quantity)
```

### Discount

Diskon dihitung dari `ticket_total` sesuai data diskon yang tersimpan.

### Gross Total

```text
gross_total = ticket_total + transport_total - discount_amount + bank_fee
```

Catatan:

- `bank_fee` lama tetap dipertahankan
- kalau booking tidak punya `bank_fee`, nilainya tetap `0`

### Commission

Komisi dihitung ulang dari `gross_total` final.

## Request Example

```http
PUT /api/bookings/sync-total/123
Authorization: Bearer <token>
Content-Type: application/json
```

Request body tidak wajib.

## Preview Query Example

```http
GET /api/bookings/sync-total/123/preview?new_booking_date=2026-04-01&new_schedule_id=81&adult_passengers=2&child_passengers=1&infant_passengers=0
```

Query yang didukung:

- `booking_date` atau `new_booking_date`
- `schedule_id` atau `new_schedule_id`
- `subschedule_id` atau `new_subschedule_id`
- `adult_passengers`
- `child_passengers`
- `infant_passengers`
- `bank_fee`
- `discount_code`
- `discount_data` sebagai JSON string
- `transports` sebagai JSON string

## Response Example

```json
{
  "success": true,
  "message": "Booking totals synchronized successfully",
  "data": {
    "booking_id": 123,
    "ticket_id": "GG-OW-123456",
    "schedule_id": 81,
    "subschedule_id": null,
    "booking_date": "2026-03-27",
    "previous": {
      "ticket_total": 1000000,
      "gross_total": 1100000,
      "gross_total_in_usd": 71.23,
      "bank_fee": 5000
    },
    "current": {
      "ticket_total": 1200000,
      "transport_total": 100000,
      "discount_amount": 50000,
      "gross_total": 1255000,
      "gross_total_in_usd": 81.47,
      "bank_fee": 5000,
      "net_total": 1180000
    },
    "commission": {
      "amount": 75000,
      "action": "updated"
    }
  }
}
```

## Log Yang Bisa Dicek

Endpoint ini menulis log step-by-step:

- `START bookingId=...`
- `booking loaded`
- `previous totals`
- `ticket calculation`
- `discount resolution`
- `gross total calculated`
- `commission calculated` atau `commission skipped`
- `booking updated`
- `DONE`

## Catatan Implementasi

- Endpoint ini memakai data booking yang sudah ada di database
- Endpoint tidak mengubah `schedule_id`, `subschedule_id`, atau `booking_date`
- Endpoint aman dipanggil setelah proses edit booking selesai
- Endpoint ini dibuat supaya frontend tidak perlu menghitung ulang total sendiri

## Contoh Alur Frontend

Flow yang disarankan:

1. User edit schedule / date / passenger / transport / discount di form
2. Frontend panggil `GET /api/bookings/sync-total/:id/preview` untuk lihat hasil hitung
3. Frontend tampilkan hasil preview ke user untuk konfirmasi
4. Kalau user setuju, frontend kirim request update ke endpoint edit booking yang relevan
5. Kalau update sukses, frontend langsung panggil `PUT /api/bookings/sync-total/:id`
6. Frontend pakai response `current` untuk update tampilan total
7. Kalau perlu, tampilkan `previous` vs `current` sebagai ringkasan perubahan

Contoh pseudo-code:

```javascript
async function saveBookingChanges(bookingId, payload) {
  const previewUrl = new URL(`/bookings/sync-total/${bookingId}/preview`, window.location.origin);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      previewUrl.searchParams.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value)
      );
    }
  });

  const previewResponse = await api.get(previewUrl.pathname + previewUrl.search);

  if (!previewResponse.data.success) {
    throw new Error("Preview total failed");
  }

  const updateResponse = await api.put(`/bookings/${bookingId}`, payload);

  if (!updateResponse.data.success) {
    throw new Error("Booking update failed");
  }

  const syncResponse = await api.put(`/bookings/sync-total/${bookingId}`);

  if (!syncResponse.data.success) {
    throw new Error("Sync total failed");
  }

  return {
    preview: previewResponse.data.data,
    booking: updateResponse.data,
    sync: syncResponse.data.data,
  };
}
```

Kalau frontend sudah menerima nilai baru dari response `sync-total`, jangan hitung manual lagi di client. Gunakan hasil dari backend sebagai source of truth.

## Referensi Kode

- [routes/booking.js](/Users/macbookprom1/Coding/giligetawaysqlexpress/giligetaway-backendsql/routes/booking.js)
- [controllers/bookingController.js](/Users/macbookprom1/Coding/giligetawaysqlexpress/giligetaway-backendsql/controllers/bookingController.js)
- [util/syncBookingTotals.js](/Users/macbookprom1/Coding/giligetawaysqlexpress/giligetaway-backendsql/util/syncBookingTotals.js)
