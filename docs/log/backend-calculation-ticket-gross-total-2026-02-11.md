# Backend Calculation for Ticket Total & Gross Total

**Date**: 2026-02-11
**Type**: Security Enhancement
**Impact**: High - Prevents price manipulation from frontend
**Routes Affected**:
- `POST /bookings/transit-queue` (Single Trip)
- `POST /bookings/round-queue` (Round Trip)

---

## Problem Statement

Sebelumnya, backend menerima dan mempercayai nilai finansial dari frontend:
- `ticket_total` - dikirim dari frontend
- `gross_total` - dikirim dari frontend
- `transport_price` - dikirim dari frontend

**Security Risk**: Frontend bisa mengirim nilai yang sudah dimanipulasi (harga lebih murah, gratis, dll).

---

## Solution

Backend sekarang **menghitung ulang semua nilai finansial** dan **tidak mempercayai** nilai dari frontend.

### Calculation Formula

```javascript
// 1. Get season price from database
season_price = getSeasonPrice(schedule_id, subschedule_id, booking_date)

// 2. Calculate ticket total
ticket_total = season_price × total_passengers

// 3. Calculate transport total
for each transport in transports:
  transport_cost = Transport.findByPk(transport_id).cost
  transport_price = transport_cost × quantity
  transport_total += transport_price

// 4. Calculate gross total
gross_total = ticket_total + transport_total - discount + bank_fee
```

---

## Implementation Details

### 1. Single Trip (`/transit-queue`)

**Middleware Added**: `validateSingleBookingGrossTotal`

**File**: `middleware/validateBookingcreation.js`

**Process**:
1. Ambil season price dari Schedule/SubSchedule berdasarkan booking_date
2. Hitung `ticket_total = season_price × total_passengers`
3. Loop semua transports:
   - Fetch Transport dari database berdasarkan transport_id
   - Hitung `transport_price = cost × quantity`
   - Replace nilai `transport_price` di array dengan hasil perhitungan
4. Hitung `gross_total = ticket_total + transport_total - discount + bank_fee`
5. **Replace** `req.body.ticket_total` dan `req.body.gross_total` dengan nilai backend

**Route Order**:
```javascript
router.post(
  "/transit-queue",
  authenticate,
  validateScheduleAndSubSchedule,
  validateBookingCreation,
  validateSingleBookingGrossTotal,  // ✅ NEW - Backend calculation
  validateTransportData,
  bookingController.createBookingWithTransitQueue
);
```

---

### 2. Round Trip (`/round-queue`)

**Middleware Added**: `validateRoundTripGrossTotal`

**File**: `middleware/validateBookingcreation.js`

**Process**:
1. Process **departure** segment:
   - Call `validateGrossTotalForSegment(departure, "DEPARTURE")`
   - Calculate ticket_total, transport_total, gross_total
   - Replace values in `req.body.departure`

2. Process **return** segment:
   - Call `validateGrossTotalForSegment(returnBooking, "RETURN")`
   - Calculate ticket_total, transport_total, gross_total
   - Replace values in `req.body.return`

**Route Order**:
```javascript
router.post(
  "/round-queue",
  authenticate,
  bookingRateLimiter,
  validateScheduleAndSubScheduleForRoundTrip,
  validateRoundTripBookingPost,
  validateRoundTripGrossTotal,  // ✅ NEW - Backend calculation
  bookingController.createRoundBookingWithTransitQueue
);
```

---

## Data Trust Model

### ✅ Trusted from Frontend (Validated)

| Field | Validation |
|-------|-----------|
| `total_passengers` | Required, > 0 |
| `schedule_id` | Exists in Schedule table |
| `subschedule_id` | Exists in SubSchedule table (optional) |
| `booking_date` | Valid date, used for season calculation |
| `transports[].transport_id` | Exists in Transport table |
| `transports[].quantity` | Integer, > 0 |
| `bank_fee` | Number (business parameter) |
| `discount` | Number (business parameter) |

### ❌ NOT Trusted from Frontend (Recalculated)

| Field | Source | Calculation |
|-------|--------|-------------|
| `ticket_total` | Backend | `season_price × total_passengers` |
| `gross_total` | Backend | `ticket_total + transport_total - discount + bank_fee` |
| `transport_price` | Backend | `Transport.cost × quantity` |

---

## Season Price Logic

Season ditentukan berdasarkan `booking_date`:

```javascript
const month = new Date(booking_date).getMonth() + 1;

if (LOW_SEASON_MONTHS.includes(month)) {
  return schedule.low_season_price;
} else if (HIGH_SEASON_MONTHS.includes(month)) {
  return schedule.high_season_price;
} else if (PEAK_SEASON_MONTHS.includes(month)) {
  return schedule.peak_season_price;
}
```

**Environment Variables**:
- `LOW_SEASON_MONTHS` - e.g., "1,2,11,12"
- `HIGH_SEASON_MONTHS` - e.g., "3,4,9,10"
- `PEAK_SEASON_MONTHS` - e.g., "5,6,7,8"

---

## Example: Single Trip

### Frontend Request
```json
{
  "schedule_id": 10,
  "subschedule_id": null,
  "booking_date": "2026-07-15",
  "total_passengers": 2,
  "transports": [
    { "transport_id": 5, "quantity": 2, "transport_price": 999999 }
  ],
  "bank_fee": 5000,
  "discount": 10000,
  "ticket_total": 888888,
  "gross_total": 777777
}
```

### Backend Calculation (July = Peak Season)
```javascript
// 1. Get season price
schedule = Schedule.findByPk(10)
season_price = schedule.peak_season_price  // 450000

// 2. Calculate ticket total
ticket_total = 450000 × 2 = 900000

// 3. Calculate transport total
transport = Transport.findByPk(5)
transport.cost = 50000
transport_price = 50000 × 2 = 100000
transport_total = 100000

// 4. Calculate gross total
gross_total = 900000 + 100000 - 10000 + 5000 = 995000
```

### req.body After Middleware
```json
{
  "schedule_id": 10,
  "subschedule_id": null,
  "booking_date": "2026-07-15",
  "total_passengers": 2,
  "transports": [
    { "transport_id": 5, "quantity": 2, "transport_price": 100000 }
  ],
  "bank_fee": 5000,
  "discount": 10000,
  "ticket_total": 900000,
  "gross_total": 995000
}
```

**Note**: Frontend values (888888, 777777, 999999) diabaikan dan diganti dengan perhitungan backend.

---

## Example: Round Trip

### Frontend Request
```json
{
  "departure": {
    "schedule_id": 10,
    "booking_date": "2026-07-15",
    "total_passengers": 2,
    "transports": [{ "transport_id": 5, "quantity": 2 }],
    "discount": 10000,
    "bank_fee": 5000,
    "ticket_total": 888888,
    "gross_total": 777777
  },
  "return": {
    "schedule_id": 20,
    "booking_date": "2026-07-20",
    "total_passengers": 2,
    "transports": [{ "transport_id": 6, "quantity": 2 }],
    "discount": 0,
    "bank_fee": 5000,
    "ticket_total": 666666,
    "gross_total": 555555
  }
}
```

### Backend Calculation

**Departure (July = Peak Season)**:
```javascript
season_price = 450000
ticket_total = 450000 × 2 = 900000
transport_total = 50000 × 2 = 100000
gross_total = 900000 + 100000 - 10000 + 5000 = 995000
```

**Return (July = Peak Season)**:
```javascript
season_price = 480000
ticket_total = 480000 × 2 = 960000
transport_total = 60000 × 2 = 120000
gross_total = 960000 + 120000 - 0 + 5000 = 1085000
```

### req.body After Middleware
```json
{
  "departure": {
    "schedule_id": 10,
    "booking_date": "2026-07-15",
    "total_passengers": 2,
    "transports": [{ "transport_id": 5, "quantity": 2, "transport_price": 100000 }],
    "discount": 10000,
    "bank_fee": 5000,
    "ticket_total": 900000,
    "gross_total": 995000
  },
  "return": {
    "schedule_id": 20,
    "booking_date": "2026-07-20",
    "total_passengers": 2,
    "transports": [{ "transport_id": 6, "quantity": 2, "transport_price": 120000 }],
    "discount": 0,
    "bank_fee": 5000,
    "ticket_total": 960000,
    "gross_total": 1085000
  }
}
```

---

## Files Changed

### 1. `/middleware/validateBookingcreation.js`

#### Modified Functions:
- `calculateTransportTotalAndValidate()`
  - **Before**: Validated `transport_price` from frontend
  - **After**: Calculates from database, replaces frontend value

- `validateSingleBookingGrossTotal()`
  - **Before**: Validated frontend gross_total, rejected if mismatch
  - **After**: Calculates all values, replaces frontend values in req.body

- `validateGrossTotalForSegment()`
  - **Before**: Validated segment gross_total, threw error if mismatch
  - **After**: Calculates all values, replaces segment values

- `validateRoundTripGrossTotal()`
  - **Before**: Validated both segments, rejected if mismatch
  - **After**: Calculates both segments, replaces values

### 2. `/util/formatSchedules.js`

#### Fixed:
- Added `getSeasonPrice` to `module.exports`
- **Before**: Function existed but not exported
- **After**: Exported and used by middleware

### 3. `/routes/booking.js`

#### Changes:
- Import `validateSingleBookingGrossTotal` and `validateRoundTripGrossTotal`
- Add middleware to `/transit-queue` route
- Add middleware to `/round-queue` route

---

## Testing Checklist

### Single Trip
- [ ] Test dengan low season date
- [ ] Test dengan high season date
- [ ] Test dengan peak season date
- [ ] Test dengan transport kosong
- [ ] Test dengan multiple transports
- [ ] Test dengan discount = 0
- [ ] Test dengan bank_fee = 0
- [ ] Test frontend kirim ticket_total palsu (harus diabaikan)
- [ ] Test frontend kirim gross_total palsu (harus diabaikan)
- [ ] Test frontend kirim transport_price palsu (harus diabaikan)

### Round Trip
- [ ] Test departure dan return di season berbeda
- [ ] Test dengan transports berbeda per segment
- [ ] Test dengan discount hanya di satu segment
- [ ] Test frontend kirim nilai palsu di departure (harus diabaikan)
- [ ] Test frontend kirim nilai palsu di return (harus diabaikan)

---

## Security Impact

### Before
```
Frontend → Backend → Database
   ❌         ✅        ✅
(manipulable) (trusts)  (saves)
```

**Risk**: Frontend bisa kirim harga murah/gratis, backend simpan langsung ke database.

### After
```
Frontend → Middleware (Recalculate) → Backend → Database
   ❌           ✅✅✅                    ✅        ✅
(ignored)   (calculates from DB)     (uses)   (saves)
```

**Security**: Frontend values diabaikan, backend hitung ulang dari database yang terpercaya.

---

## Performance Considerations

**Additional Database Queries per Request**:
- 1 query: Get Schedule/SubSchedule for season price
- N queries: Get Transport for each transport item (where N = transports.length)

**Impact**: Minimal, queries sudah efficient dengan primary key lookup.

**Trade-off**: Small performance cost untuk security yang jauh lebih baik.

---

## Migration Notes

**Breaking Changes**: None

**Backward Compatibility**: Yes
- Frontend masih bisa kirim ticket_total dan gross_total
- Values akan diabaikan dan diganti dengan perhitungan backend
- API response format tidak berubah

**Rollback**: Safe
- Hapus middleware dari routes
- System akan kembali mempercayai nilai frontend

---

## Future Enhancements

1. **Caching**: Cache season pricing configuration to reduce DB queries
2. **Audit Log**: Log perbedaan antara frontend value vs backend calculation
3. **Alert System**: Alert admin jika frontend kirim nilai yang sangat berbeda (possible attack)
4. **Rate Limiting**: Extra rate limiting untuk endpoint ini (high value targets)

---

## Conclusion

Perubahan ini significantly meningkatkan keamanan sistem booking dengan memastikan semua nilai finansial dihitung dari sumber yang terpercaya (database), bukan dari input user yang bisa dimanipulasi.

**Key Principle**: "Never trust the client"

All financial calculations harus dilakukan di backend yang kita kontrol.
