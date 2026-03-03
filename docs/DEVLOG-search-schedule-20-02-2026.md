# Dev Log

---

## 2026-02-20

### Topic: Bug Fix + Optimisasi `search-schedule` Agent API

---

## Bug Fix 1 — `querySchedules` mengambil SeatAvailability milik SubSchedule

**File:** `util/querySchedulesHelper.js`

**Problem:**
Query Sequelize untuk direct schedule tidak memfilter `subschedule_id IS NULL` saat JOIN ke `SeatAvailabilities`. Akibatnya satu schedule bisa dapat banyak seat availability sekaligus — termasuk milik sub-schedule yang kebetulan punya `schedule_id` sama.

Contoh nyata dari log:
```
[querySchedules] schedule_id=81  seatAvailabilities_count=10
  [seatAvail] id=9875  subschedule_id=198  ← [0] ini yang dipakai — SALAH
  [seatAvail] id=9876  subschedule_id=null ← yang seharusnya dipakai
  ... (8 lainnya, semua milik sub-schedule)
```

**Fix:**
```js
// SEBELUM
where: { date: selectedDate }

// SESUDAH
where: { date: selectedDate, subschedule_id: null }
```

---

## Bug Fix 2 — `processSeatAvailabilityData` fallback `[0]` untuk SubSchedule

**File:** `util/querySchedulesHelper.js`

**Problem:**
Ketika exact match (`schedule_id + subschedule_id`) tidak ditemukan, kode fallback ke `SeatAvailabilities[0]`. Record `[0]` bisa berupa record lama dengan `schedule_id=null + subschedule_id=X` (data tidak valid), padahal seat **wajib punya `schedule_id`**.

**Fix:**
Hapus fallback `|| subSchedule.SeatAvailabilities?.[0]`. Jika tidak ada exact match, skip (tidak assign seat availability). `createMissingSeatAvailabilities` yang sudah jalan lebih awal akan handle pembuatan record yang benar.

```js
// SEBELUM
) || subSchedule.SeatAvailabilities?.[0];

// SESUDAH
) ?? null; // no fallback: harus exact match schedule_id + subschedule_id
```

---

## Feature: Search Schedule V4 — Raw SQL Optimization

**Files baru:**
- `util/querySchedulesHelperV4.js`
- `controllers/searchAgentScheduleV4.js`

**Route baru:** `GET /api/agent-access/search-schedule/v4`

### Problem di V3
Query lambat (bisa mencapai ~20 detik pada data besar) karena:
1. **N+1 problem** — SubSchedule load 6 Transit associations terpisah (TransitFrom, TransitTo, Transit1–4), masing-masing dengan Destination. Untuk 10 sub-schedule = 60+ queries.
2. **Triple formatting pass** — v3 melakukan 3x loop array (formatSchedules → formattedWithSeats → finalFormatted).
3. **Sequelize ORM overhead** — model instantiation + eager loading semua kolom.

### Solusi V4
| | V3 | V4 |
|---|---|---|
| Schedule query | Sequelize ORM | Raw SQL |
| SubSchedule query | 6 ORM includes (N+1) | 1 raw SQL dengan semua JOIN |
| Transit fetch | N queries per schedule | 1 batch query |
| Formatting pass | 3x loop | 1 pass |
| SeatAvail filter | JS post-query | SQL level (`subschedule_id IS NULL`) |

### Bug yang ditemukan saat implementasi V4

**1. Table name salah:**
Model Sequelize alias `SeatAvailabilities` (plural), nama tabel DB asli `SeatAvailability` (singular). Raw SQL harus pakai nama tabel asli.
```
Error: Table 'giligetaway.SeatAvailabilities' doesn't exist
Fix: ganti semua SeatAvailabilities → SeatAvailability di raw SQL
```

**2. Filter `sa_availability === 1` salah:**
MySQL2 driver mengembalikan kolom BOOLEAN/TINYINT(1) sebagai `true/false` (bukan `1/0`). Sehingga `=== 1` selalu false, semua hasil difilter keluar.
```js
// SEBELUM (bug)
s => s.sa_availability === 1 && s.sa_available_seats > 0

// SESUDAH (fix)
s => !!s.sa_availability && s.sa_available_seats > 0
```

---

## Status
- [x] Bug fix `querySchedules` subschedule_id filter
- [x] Bug fix `processSeatAvailabilityData` no fallback
- [x] V4 endpoint live di `/api/agent-access/search-schedule/v4`
- [ ] Performance testing v4 vs v3 pada route dengan sub-schedule
- [ ] DB index optimization (candidate: `SeatAvailability(schedule_id, subschedule_id, date)`)
