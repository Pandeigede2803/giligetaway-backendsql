# Agent Booking Email Enhancement - Round Trip Passenger Details Fix

**Date:** November 4, 2025
**Status:** ✅ Fixed
**Type:** Feature Enhancement & Bug Fix

---

## Overview

Enhanced the agent booking system to properly display passenger details in round-trip booking emails, including both departure and return seat numbers. The solution maintains database simplicity while providing complete information in email notifications.

---

## Problems Fixed

### 1. **Missing Transport Details in Emails**
- **Issue**: Transport bookings showed only IDs, not descriptive information
- **Impact**: Agents couldn't identify which transport service was booked

### 2. **Round-Trip Email Design Inconsistency**
- **Issue**: Round-trip emails had different layout than one-way emails
- **Impact**: Unprofessional appearance, harder to read

### 3. **Duplicate Passenger Insertions**
- **Issue**: Passengers added twice - once in controller, once in queue processor
- **Impact**: Potential data duplication, unnecessary database operations

### 4. **Missing Passengers in One-Way Bookings**
- **Issue**: One-way controller never called `addPassengers()`
- **Impact**: Passengers not saved for one-way bookings

### 5. **Blank Passenger Details in Round-Trip Emails**
- **Issue**: Email couldn't properly display both departure and return seat numbers
- **Root Cause**: Request body contains `seat_number_departure` and `seat_number_return` for each passenger, but database only stores single `seat_number` per booking
- **Impact**: Passengers showed blank seat numbers in email

---

## Solution Architecture

### Design Principle: **Keep Database Simple, Pass Rich Data to Email**

Instead of complicating the database schema, we:
1. Store passengers with single `seat_number` in database (one record per booking leg)
2. Pass original passenger array (with both seat numbers) through the queue
3. Use original array directly in email template

### Data Flow

```
User Request Body:
{
  passengers: [
    {
      name: "John Doe",
      nationality: "USA",
      passport_id: "ABC123",
      passenger_type: "adult",
      seat_number_departure: "G1",  ← Both seat numbers
      seat_number_return: "F4"      ← in request
    }
  ]
}
              ↓
Controller (Departure Booking):
- Saves passenger with seat_number = "G1" to DB
- Passes full passengers array to queue
              ↓
Controller (Return Booking):
- Saves passenger with seat_number = "F4" to DB
- Passes full passengers array to queue
              ↓
Queue Processor:
- Stores passengers array in roundTripCompletionMap
- No DB queries for passengers
              ↓
Email Function:
- Receives passengers array directly
- Displays both seat_number_departure and seat_number_return
- No need to merge data from two bookings
```

---

## Changes Made

### 1. **Transport Details Enhancement**

**File:** `controllers/bookingAgentController.js`

Added Transport model association to booking queries:

```javascript
// Lines 841-845, 853-857
const departureBooking = await Booking.findByPk(existingData.departure, {
  include: [
    {
      model: TransportBooking,
      as: "transportBookings",
      include: [{ model: Transport, as: "transport" }] // ✅ Added
    },
    // ... other includes
  ]
});
```

**File:** `util/sendPaymentEmailApiAgent.js`

Updated email template to show transport details:

```javascript
<div style="font-weight: 600;">${tb.transport_type} - ${tb.transport?.description}</div>
${tb.transport?.pickup_area ? `<div style="color: #007bff;">📍 ${tb.transport.pickup_area}</div>` : ''}
```

### 2. **Round-Trip Email Redesign**

**File:** `util/sendPaymentEmailApiAgent.js`

Completely redesigned round-trip email to match one-way layout:
- Color-coded sections (yellow for departure, blue for return)
- Professional table layout
- Clear journey separators
- Passenger table with both seat columns

### 3. **Passenger Data Flow Simplification**

**File:** `controllers/bookingAgentController.js`

#### A. Removed Duplicate Passenger Insertions

```javascript
// BEFORE: Passengers added in both controller and queue ❌
// Controller: addPassengers()
// Queue: addPassengers() again

// AFTER: Only in controller ✅
// Lines 603-608
const passengersForThisLeg = data.passengers.map(p => ({
  ...p,
  seat_number: type === 'departure' ? p.seat_number_departure : p.seat_number_return
}));
await addPassengers(passengersForThisLeg, booking.id, t);
```

#### B. Added Missing Passengers to One-Way

```javascript
// Lines 228-231
if (bookingData.passengers && bookingData.passengers.length > 0) {
  await addPassengers(bookingData.passengers, booking.id, t);
}
```

#### C. Pass Original Passengers to Queue

```javascript
// Line 660
bookingAgentRoundQueue.add({
  // ... other fields
  passengers: data.passengers, // ✅ Pass original with both seat numbers
});
```

#### D. Store Passengers in Tracking Map

```javascript
// Lines 821-836
if (!roundTripCompletionMap.has(baseTicketId)) {
  roundTripCompletionMap.set(baseTicketId, {
    [type]: booking_id,
    [`${type}_commission`]: commission_amount,
    [`${type}_ticket`]: ticket_id,
    passengers, // ✅ Store original array
    agent_email
  });
} else {
  const existingData = roundTripCompletionMap.get(baseTicketId);
  existingData[type] = booking_id;
  existingData[`${type}_commission`] = commission_amount;
  existingData[`${type}_ticket`] = ticket_id;
  existingData.passengers = passengers; // ✅ Update with original array
  existingData.agent_email = agent_email;
}
```

#### E. Pass Passengers to Email Function

```javascript
// Lines 1004-1011
await sendEmailApiRoundTripAgentStaff(
  process.env.EMAIL_AGENT,
  departureBooking,
  returnBooking,
  departureBooking.Agent?.name || "Unknown Agent",
  departureBooking.Agent?.email || existingData.agent_email,
  existingData.passengers // ✅ Pass original passengers array
);
```

### 4. **Email Function Update**

**File:** `util/sendPaymentEmailApiAgent.js`

#### A. Accept Passengers Parameter

```javascript
// Lines 473-480
const sendEmailApiRoundTripAgentStaff = async (
  recipientEmail,
  firstBooking,
  secondBooking,
  agentName,
  agentEmail,
  passengersArray // ✅ New parameter with both seat numbers
) => {
```

#### B. Use Passengers Directly (No DB Queries)

```javascript
// BEFORE: Query from database and merge ❌
// const passengerDataDep = firstBooking.passengers || [];
// const passengerDataRet = secondBooking.passengers || [];
// const mergedPassengerData = passengerDataDep.map((depPassenger, index) => {
//   const retPassenger = passengerDataRet[index] || {};
//   return {
//     ...depPassenger,
//     seat_number_departure: depPassenger.seat_number,
//     seat_number_return: retPassenger.seat_number
//   };
// });

// AFTER: Use original array directly ✅
// Line 539
const passengerData = passengersArray || [];
```

#### C. Display Both Seat Numbers

```javascript
// Lines 642-672
${passengerData.map((passenger) => `
  <tr style="border-bottom: 1px solid #f0f0f0;">
    <td style="padding: 12px; font-weight: 500; color: #333;">${passenger.name || "-"}</td>
    <td style="padding: 12px; color: #666;">${passenger.nationality || "-"}</td>
    <td style="padding: 12px; color: #666; font-family: monospace;">${passenger.passport_id || "-"}</td>
    <td style="padding: 12px; text-align: center;">
      <span style="padding: 4px 8px; background: ${...}; border-radius: 12px;">
        ${passenger.passenger_type || "-"}
      </span>
    </td>
    <td style="padding: 12px; text-align: center; font-weight: 600; color: #856404;">
      ${passenger.seat_number_departure || "-"}
    </td>
    <td style="padding: 12px; text-align: center; font-weight: 600; color: #004085;">
      ${passenger.seat_number_return || "-"}
    </td>
  </tr>
`).join("")}
```

---

## Database Schema (Unchanged)

The `passengers` table remains simple:

```sql
CREATE TABLE passengers (
  id INT PRIMARY KEY,
  booking_id INT,
  name VARCHAR(255),
  nationality VARCHAR(100),
  passport_id VARCHAR(100),
  passenger_type ENUM('adult', 'child', 'infant'),
  seat_number VARCHAR(10), -- ✅ Single seat number (per booking)
  -- ... other fields
);
```

**Why This Works:**
- Round-trip creates 2 bookings (departure + return)
- Each booking gets its own passenger record with correct seat
- Original request data (with both seats) passes through queue to email
- Email displays complete information without complex DB queries

---

## Request/Response Examples

### Request Body (Round-Trip)

```json
{
  "departure": {
    "schedule_id": 1,
    "booking_date": "2025-11-10",
    "total_passengers": 1,
    "passengers": [
      {
        "name": "John Doe",
        "nationality": "USA",
        "passport_id": "ABC123",
        "passenger_type": "adult",
        "seat_number_departure": "G1",
        "seat_number_return": "F4"
      }
    ],
    "transports": [
      {
        "transport_id": 1,
        "transport_type": "pickup",
        "transport_price": 50000,
        "quantity": 1
      }
    ]
  },
  "return": {
    "schedule_id": 2,
    "booking_date": "2025-11-15",
    "total_passengers": 1
  },
  "agent_id": 5,
  "agent_email": "agent@example.com"
}
```

### Database Records Created

**Departure Booking - Passenger:**
```json
{
  "id": 1001,
  "booking_id": 500,
  "name": "John Doe",
  "nationality": "USA",
  "passport_id": "ABC123",
  "passenger_type": "adult",
  "seat_number": "G1"  // ← Only departure seat
}
```

**Return Booking - Passenger:**
```json
{
  "id": 1002,
  "booking_id": 501,
  "name": "John Doe",
  "nationality": "USA",
  "passport_id": "ABC123",
  "passenger_type": "adult",
  "seat_number": "F4"  // ← Only return seat
}
```

### Email Display

| Name     | Nationality | Passport | Type  | Seat (Dep) | Seat (Ret) |
|----------|-------------|----------|-------|------------|------------|
| John Doe | USA         | ABC123   | Adult | G1         | F4         |

**Data Source:** Original `passengersArray` from request body (not from database)

---

## Benefits

### 1. **Database Simplicity**
- ✅ No schema changes required
- ✅ Single `seat_number` field per passenger
- ✅ Clean one-to-many relationship (booking → passengers)

### 2. **Performance**
- ✅ No complex joins or data merging
- ✅ No duplicate database operations
- ✅ Direct array passing through queue

### 3. **Maintainability**
- ✅ Clear data flow: Request → Controller → Queue → Email
- ✅ Single source of truth (request body)
- ✅ No passenger queries in email function

### 4. **User Experience**
- ✅ Complete passenger information in emails
- ✅ Both seat numbers clearly displayed
- ✅ Professional, consistent email design
- ✅ Transport details visible

---

## Testing

### Test Scenario: Round-Trip Booking

**Input:**
```json
{
  "passengers": [
    {
      "name": "Test User",
      "nationality": "Switzerland",
      "passport_id": "none",
      "passenger_type": "adult",
      "seat_number_departure": "G1",
      "seat_number_return": "F4"
    }
  ]
}
```

**Expected Results:**

1. **Database (Departure):**
   - Passenger saved with `seat_number = "G1"`

2. **Database (Return):**
   - Passenger saved with `seat_number = "F4"`

3. **Queue Tracking:**
   ```javascript
   roundTripCompletionMap.get(baseTicketId) = {
     departure: 500,
     return: 501,
     passengers: [{ name: "Test User", ..., seat_number_departure: "G1", seat_number_return: "F4" }],
     agent_email: "agent@example.com"
   }
   ```

4. **Email:**
   - Shows "Test User" with Seat (Dep): G1, Seat (Ret): F4
   - Transport details: "Pickup - Shared Van Service" with pickup area

---

## Files Modified

```
controllers/bookingAgentController.js
├── Line 228-231: Added passengers to one-way booking
├── Line 603-608: Map seat numbers for each booking leg
├── Line 660: Pass passengers to queue
├── Line 743: Accept passengers in queue processor
├── Line 822-836: Store passengers in tracking map
└── Line 1010: Pass passengers to email function

util/sendPaymentEmailApiAgent.js
├── Line 479: Accept passengersArray parameter
├── Line 539: Use passengersArray directly
└── Line 642-672: Display both seat numbers in table
```

---

## Key Learnings

1. **Don't Over-Complicate the Database**
   - Keep schemas simple and normalized
   - Use application layer for data transformation

2. **Pass Rich Data Through Queues**
   - Queues can carry more than just IDs
   - Reduces need for DB queries in processors

3. **Single Source of Truth**
   - Original request body has all needed data
   - No need to merge from multiple DB queries

4. **Separation of Concerns**
   - Database: Storage (normalized, simple)
   - Application: Business logic (transformations)
   - Presentation: Display (rich, formatted)

---

## Future Enhancements

- [ ] Add passenger count validation (departure vs return)
- [ ] Support different passenger lists for each leg
- [ ] Add seat number validation before saving
- [ ] Include passenger photos in emails (if available)
- [ ] Add PDF ticket attachment with passenger details

---

## Related Documentation

- [CronJob Error Fix Summary](CRONJOB-ERROR-FIX-SUMMARY.md)
- [Telegram Notification Setup](telegram-notification-setup.md)
- [Bug Fix: CronJob Release Seats Error](bug-fix-cronjob-release-seats-error.md)

---

**Fixed by:** Claude Code
**Date:** November 4, 2025
**Version:** 1.0
