# Agent Booking Financial Calculation

Date: 2026-03-27

Dokumen ini merangkum perhitungan finansial yang dipakai pada:

- `POST /api/agent-access/book/v1`
- `POST /api/agent-access/round-trip-book/v1`

Fokus dokumen:

- `ticket_total`
- `transport_total`
- `discount_amount`
- `gross_total`
- `commission`
- `net_total`
- catatan `bank_fee`

## 1) Ticket Total

`ticket_total` dihitung di backend dari harga schedule/subschedule dan jumlah penumpang.

Rumus:

```text
ticket_total = price_per_passenger x total_passengers
```

Sumber harga:

- `Schedule.low_season_price`
- `Schedule.high_season_price`
- `Schedule.peak_season_price`
- atau field yang sama pada `SubSchedule`

Season dipilih berdasarkan `booking_date` dan environment:

- `LOW_SEASON_MONTHS`
- `HIGH_SEASON_MONTHS`
- `PEAK_SEASON_MONTHS`

## 2) Transport Total

`transport_total` dihitung dari array `transports`.

Rumus:

```text
transport_total = sum(transport_price x quantity)
```

Jika `transports` kosong, maka `transport_total = 0`.

## 3) Commission

Komisi agent dihitung dengan 2 tahap:

1. **Pre-calculate commission** untuk menghitung diskon.
2. **Final commission** disimpan setelah `gross_total` final booking terbentuk.

Pada kode saat ini:

- pre-calculate memakai `gross_total` sebelum diskon
- final commission memakai `gross_total` setelah diskon

### Basis komisi

Jika `agent.commission_rate > 0`:

```text
commission = gross_total x commission_rate / 100
```

Jika `commission_rate = 0`, maka pakai fixed commission per `trip_type`:

- `long` -> `commission_long x total_passengers`
- `short` -> `commission_short x total_passengers`
- `mid` -> `commission_mid x total_passengers`
- `intermediate` -> `commission_intermediate x total_passengers`

### Transport commission

Jika booking tidak memiliki transport tipe `pickup` atau `dropoff`, maka ditambah:

```text
transport_commission = commission_transport x total_passengers
```

Jadi total komisi:

```text
commission = base_commission + transport_commission
```

## 4) Discount

Diskon dihitung dari nilai net setelah komisi, bukan langsung dari `ticket_total`.

Rumus:

```text
net_after_commission = ticket_total - pre_calculated_commission
discount_amount = calculate_from(net_after_commission)
```

Aturan diskon:

- jika `discount_type = percentage`, maka diskon = persen dari `net_after_commission`
- jika `discount_type = fixed`, maka diskon = nilai tetap
- jika ada `min_purchase`, maka diskon hanya aktif jika `net_after_commission >= min_purchase`
- jika ada `max_discount`, maka diskon dibatasi sebesar `max_discount`
- diskon tidak boleh melebihi `net_after_commission`

## 5) Gross Total

Untuk flow `book/v1` dan `round-trip-book/v1`, `gross_total` final yang disimpan saat booking dibuat adalah:

```text
ticket_total_after_discount = max(0, ticket_total - discount_amount)
gross_total = ticket_total_after_discount + transport_total
```

Catatan:

- `bank_fee` tidak ditambahkan ke `gross_total` pada proses create booking di `bookingAgentController`
- `bank_fee` hanya muncul pada flow transaksi tertentu jika `amount` yang masuk lebih besar dari `gross_total` lama
- `commission` final tetap dihitung ulang dari `gross_total` final saat `AgentCommission` dibuat

## 6) Net Total

`net_total` dipakai sebagai gambaran pendapatan company setelah komisi dikurangi.

Rumus:

```text
net_total = gross_total - commission
```

Untuk round trip:

```text
total_net_total = departure_net_total + return_net_total
```

## 7) One-Way Flow

Urutan perhitungan pada `POST /api/agent-access/book/v1`:

1. Hitung `ticket_total`
2. Hitung `transport_total`
3. Pre-calculate `commission`
4. Hitung `discount_amount` dari `ticket_total - commission`
5. Hitung `gross_total = ticket_total_after_discount + transport_total`
6. Simpan booking, transaction, dan commission

### Formula ringkas

```text
ticket_total = price_per_passenger x total_passengers
transport_total = sum(transport_price x quantity)
pre_calculated_commission = calculate_from(ticket_total + transport_total)
discount_amount = calculate_from(ticket_total - pre_calculated_commission)
ticket_total_after_discount = max(0, ticket_total - discount_amount)
gross_total = ticket_total_after_discount + transport_total
net_total = gross_total - commission
```

## 8) Round-Trip Flow

Untuk `POST /api/agent-access/round-trip-book/v1`, perhitungan dilakukan per leg:

- `departure`
- `return`

Masing-masing leg punya:

- `ticket_total`
- `transport_total`
- `discount_amount`
- `gross_total`
- `commission`
- `net_total`

### Total round trip

```text
total_gross = departure.gross_total + return.gross_total
total_commission = departure.commission + return.commission
total_net = total_gross - total_commission
```

## 9) Contoh Singkat

Misal:

- price per passenger = 500,000
- total passengers = 2
- transport_total = 100,000
- commission = 100,000
- discount = 10% dari net

Perhitungan:

```text
ticket_total = 500,000 x 2 = 1,000,000
net_after_commission = 1,000,000 - 100,000 = 900,000
discount_amount = 10% x 900,000 = 90,000
ticket_total_after_discount = 1,000,000 - 90,000 = 910,000
gross_total = 910,000 + 100,000 = 1,010,000
net_total = 1,010,000 - 100,000 = 910,000
```

## 10) Referensi Kode

- [controllers/bookingAgentController.js](../controllers/bookingAgentController.js)
- [util/calculateTicketTotal.js](../util/calculateTicketTotal.js)
- [util/updateAgentComission.js](../util/updateAgentComission.js)
- [util/agentNetPrice.js](../util/agentNetPrice.js)
- [controllers/transactionController.js](../controllers/transactionController.js)
