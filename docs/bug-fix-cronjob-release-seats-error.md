# Bug Fix: CronJob Release Seats Error

## Error Description

**Error Message:**
```
❌ Error processing expired booking 15770: TypeError: Cannot read properties of undefined (reading 'length')
    at /Users/macbookprom1/Coding/giligetawaysqlexpress/giligetaway-backendsql/util/cronJobs.js:196:62
```

**Date Fixed:** November 3, 2025

**Impact:** Critical - Prevented expired bookings from being processed correctly, causing seats to not be released back to inventory.

---

## Root Cause Analysis

### The Problem

The `releaseSeats()` function in `util/cronJobs.js` had two critical issues:

1. **Missing Return Statement**: The function didn't return the result from the underlying release functions
2. **Type Mismatch**: The code expected an Array but could receive a Set, causing `.length` to be undefined

### Code Flow

```
handleExpiredBookings()
  └─> releaseSeats(booking, transaction)
       ├─> releaseMainScheduleSeats() → returns Array
       └─> releaseSubScheduleSeats() → returns Set
```

### Why It Failed

**Original Code (BROKEN):**
```javascript
const releaseSeats = async (booking, transaction) => {
  // ... code ...

  if (subschedule_id) {
    await releaseSubScheduleSeats(...);  // Returns Set, but not captured
  } else {
    await releaseMainScheduleSeats(...); // Returns Array, but not captured
  }

  // ❌ NO RETURN STATEMENT - function returns undefined
};

// Later in handleExpiredBookings():
const releasedSeatIds = await releaseSeats(booking, t);
console.log(`✅ Released seats: ${releasedSeatIds.length > 0 ? ...}`);
//                                  ^^^^^^^^^^^^^^^^^^^
//                                  undefined.length → undefined
//                                  Cannot read 'length' of undefined!
```

### Why Booking 15770 Triggered It

- Booking 15770 had a `subschedule_id`
- Called `releaseSubScheduleSeats()` which returns a **Set**
- `releaseSeats()` didn't return the Set
- Result: `releasedSeatIds` was `undefined`
- Accessing `undefined.length` caused the error

---

## The Fix

### 1. Added Return Statement to `releaseSeats()`

**File:** `util/cronJobs.js` (lines 104-149)

```javascript
const releaseSeats = async (booking, transaction) => {
  const { schedule_id, subschedule_id, total_passengers, booking_date } = booking;

  console.log(`✅ MEMULAI RELEASE SEATS FOR BOOKING ID: ${booking.id}...`);

  try {
    let result;  // ✅ Added: Capture return value

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
    return result;  // ✅ Added: Return the result

  } catch (error) {
    console.error(`😻Gagal melepaskan kursi untuk Booking ID: ${booking.id} dan ticket ID: ${booking.ticket_id}`, error);
    throw error;
  }
};
```

### 2. Handle Both Array and Set Return Types

**File:** `util/cronJobs.js` (lines 197-203)

```javascript
const releasedSeatIds = await releaseSeats(booking, t);

// ✅ Handle both Array (from releaseMainScheduleSeats) and Set (from releaseSubScheduleSeats)
const seatCount = releasedSeatIds instanceof Set
  ? releasedSeatIds.size
  : (releasedSeatIds?.length || 0);

const seatList = releasedSeatIds instanceof Set
  ? Array.from(releasedSeatIds).join(", ")
  : (releasedSeatIds?.join(", ") || "");

console.log(`✅ Released seats: ${seatCount > 0 ? seatList : "None"}`);
```

---

## Why This Was a Big Issue

### 1. **Transaction Rollback**
The error occurred inside a database transaction:
```javascript
await sequelize.transaction(async (t) => {
  const releasedSeatIds = await releaseSeats(booking, t);  // ❌ Error here
  // ... rest of code never executed
});
```

When the error occurred:
- The entire transaction was rolled back
- Seats were **not released** back to inventory
- Booking status was **not updated** to expired
- Transaction status remained pending

### 2. **Data Consistency Issues**
- Expired bookings stayed in "pending" state
- Seats remained locked/unavailable
- Inventory showed incorrect availability
- New bookings couldn't access those seats

### 3. **Email Notifications Failed**
The email notification logic came after the release seats code:
```javascript
await releaseSeats(booking, t);  // ❌ Failed here
// Email code never reached
```

### 4. **Cascading Failures**
- Cron job would retry the same expired bookings
- Same error would occur repeatedly
- Logs would fill with error messages
- Other expired bookings in the batch would still process

---

## Return Type Differences

### `releaseMainScheduleSeats()` Returns Array

**File:** `util/releaseMainScheduleSeats.js` (line 146)

```javascript
const releaseMainScheduleSeats = async (...) => {
  const releasedSeatIds = [];

  // Add main schedule
  releasedSeatIds.push(mainScheduleSeatAvailability.id);

  // Add related subschedules
  for (const subSchedule of relatedSubSchedules) {
    releasedSeatIds.push(subScheduleSeatAvailability.id);
  }

  return releasedSeatIds;  // Returns Array of SeatAvailability IDs
};
```

### `releaseSubScheduleSeats()` Returns Set

**File:** `util/releaseSubScheduleSeats.js` (line 955)

```javascript
const releaseSubScheduleSeats = async (...) => {
  const updatedSubSchedules = new Set();

  for (const relatedSubSchedule of relatedSubSchedules) {
    updatedSubSchedules.add(relatedSubSchedule.id);
  }

  return updatedSubSchedules;  // Returns Set of SubSchedule IDs
};
```

**Note:** These return different types of IDs:
- Main schedule: Returns `SeatAvailability.id` (Array)
- Sub schedule: Returns `SubSchedule.id` (Set)

---

## Testing

### Before Fix
```bash
❌ Error processing expired booking 15770: TypeError: Cannot read properties of undefined (reading 'length')
```

### After Fix
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

## Prevention

### Future Recommendations

1. **Standardize Return Types**: Consider making both functions return the same type (either both Array or both Set)

2. **Add Type Checking**: Use TypeScript or JSDoc to document expected return types:
```javascript
/**
 * @returns {Array<number>|Set<number>} - SeatAvailability IDs or SubSchedule IDs
 */
const releaseSeats = async (booking, transaction) => {
  // ...
};
```

3. **Add Unit Tests**: Test both code paths:
```javascript
describe('releaseSeats', () => {
  it('should return array for main schedule bookings', async () => {
    const result = await releaseSeats(mainScheduleBooking, transaction);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return set for subschedule bookings', async () => {
    const result = await releaseSeats(subScheduleBooking, transaction);
    expect(result instanceof Set).toBe(true);
  });
});
```

4. **Add Logging**: Enhanced logging helped identify the issue quickly

---

## Files Modified

1. `util/cronJobs.js`
   - Line 18: Added `const { sendTelegramMessage } = require("../util/telegram");`
   - Line 111: Added `let result;`
   - Line 117: Changed to `result = await releaseSubScheduleSeats(...)`
   - Line 130: Changed to `result = await releaseMainScheduleSeats(...)`
   - Line 141: Added `return result;`
   - Lines 198-203: Added type checking for Array vs Set
   - Lines 279-301: Added Telegram error notification for booking-level errors
   - Lines 314-333: Added Telegram error notification for fatal errors

---

## Related Issues

- Seats not being released for expired bookings
- Expired bookings stuck in "pending" status
- Inventory availability discrepancies
- Missing expiration notification emails

---

## Telegram Error Notifications

To catch errors early, Telegram notifications have been added to the cron job:

### Setup

Add these environment variables to `.env`:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Notification Types

1. **Booking-Level Errors** (lines 279-301)
   - Triggered when a specific booking fails to process
   - Includes booking details, error message, and time
   - Allows manual intervention for that specific booking

2. **Fatal Errors** (lines 314-333)
   - Triggered when the entire cron job fails
   - Includes error type, message, and stack trace
   - Indicates system-wide issues

### Example Notification

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

## Lessons Learned

1. Always return values from async functions when the caller expects them
2. Be consistent with return types across similar functions
3. Handle type variations defensively (Array vs Set)
4. Use transactions carefully - errors rollback all changes
5. Enhanced logging helps diagnose production issues quickly
6. **Real-time error notifications** (Telegram) help catch critical issues immediately before they cascade
