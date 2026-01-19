# Agent Booking Pricing & Commission Flow

## Overview
Dokumen ini menjelaskan alur perhitungan harga dan komisi pada booking agent (one-way dan round-trip). Fokusnya adalah bagaimana backend menghitung harga tanpa input `price` dari client.

## Endpoints
- `POST /api/agent-access/book/v1`
- `POST /api/agent-access/round-trip-book/v1`

## Middleware yang Terlibat
- `validateApiKey` (agent_id + api_key)
- `validateAgentBooking` (one-way)
- `validateAgentRoundTripBooking` (round-trip)
- `validateAgentDiscount` / `validateAgentRoundTripDiscount` (optional)
  - Validasi date range memakai `departure_date` atau `booking_date`.
  - Cek `agent_ids`, `schedule_ids`, `applicable_types`, dan `applicable_direction`.

## Input Harga dari Client
- Client tidak perlu mengirim field `price`.
- Semua harga dihitung di backend berdasarkan schedule/subschedule dan tanggal.

## Perhitungan Harga Ticket (Backend)
1. `calculateTicketTotal(...)` di `util/calculateTicketTotal.js`
   - Mengambil data schedule/subschedule.
   - Menentukan season (low/high/peak) via env `LOW_SEASON_MONTHS`, `HIGH_SEASON_MONTHS`, `PEAK_SEASON_MONTHS`.
   - Menentukan harga per passenger berdasarkan season.
2. `ticket_total = price_per_passenger * total_passengers`.
3. Response menyertakan `pricing_breakdown` berisi `flatPrice`, `totalPassengers`, dan `total`.

## Transport dan Discount
- `transportTotal` dihitung dari array `transports`.
- `gross_total = ticket_total + transportTotal`.
- Jika ada `discount_code`, maka `gross_total` dikurangi sesuai rule discount:
  - `percentage` atau `fixed`.
  - Validasi schedule restriction dan date range.
  - Hasil disimpan ke `discount_data`.

## Komisi Agent
Komisi dihitung pada booking (bukan dari input client) menggunakan `updateAgentCommissionOptimize`:
- Basis komisi: `gross_total`.
- Jika `commission_rate > 0`, komisi = `gross_total * (rate/100)`.
- Jika `commission_rate = 0`, komisi fixed per `trip_type` * `total_passengers`:
  - `long`, `short`, `mid`, `intermediate`.
- Jika tidak ada transport (pickup/dropoff), ditambah `commission_transport * total_passengers`.
- Komisi disimpan ke tabel `AgentCommission` dan dicegah duplikat per booking+agent.

## Net Price di Search Schedule
- `net_price` hanya muncul pada response search schedule v3.
- `net_price` adalah per passenger, dan tidak dipakai dalam booking.
- Booking tetap menggunakan harga backend (gross) dan komisi dihitung terpisah.

## Catatan
- Jika suatu saat booking ingin menggunakan harga net, perlu ubah basis komisi agar tidak terjadi double deduction.
- Format `price` dan `net_price` di response search sekarang number (bukan string) saat nilai valid.
