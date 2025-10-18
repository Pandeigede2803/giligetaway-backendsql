# Agent Round-Trip Booking Documentation

## Overview
This document describes the agent round-trip booking system implementation for the Gili Getaway booking platform.

## Features
- Round-trip booking for travel agents
- Paired ticket ID generation (odd-even number pairing)
- Automatic commission calculation for both legs
- Queue-based processing for seat availability and transport bookings
- Transaction-based data integrity

---

## API Endpoint

### Create Agent Round-Trip Booking
**POST** `/api/agent/round-trip-booking`

Creates a round-trip booking (departure + return) for a travel agent.

#### Request Body
```json
{
  "departure": {
    "schedule_id": 1,
    "subschedule_id": null,
    "booking_date": "2025-01-15",
    "adult_passengers": 2,
    "child_passengers": 0,
    "infant_passengers": 0,
    "total_passengers": 2,
    "agent_id": 5,
    "currency": "IDR",
    "contact_name": "John Doe",
    "contact_phone": "+6281234567890",
    "contact_email": "john@example.com",
    "passengers": [
      {
        "name": "John Doe",
        "age": 30,
        "nationality": "Indonesian"
      },
      {
        "name": "Jane Doe",
        "age": 28,
        "nationality": "Indonesian"
      }
    ],
    "transports": [
      {
        "transport_id": 1,
        "transport_price": 50000,
        "quantity": 2
      }
    ]
  },
  "return": {
    "schedule_id": 2,
    "subschedule_id": null,
    "booking_date": "2025-01-20",
    "adult_passengers": 2,
    "child_passengers": 0,
    "infant_passengers": 0,
    "total_passengers": 2,
    "agent_id": 5,
    "currency": "IDR",
    "contact_name": "John Doe",
    "contact_phone": "+6281234567890",
    "contact_email": "john@example.com",
    "passengers": [
      {
        "name": "John Doe",
        "age": 30,
        "nationality": "Indonesian"
      },
      {
        "name": "Jane Doe",
        "age": 28,
        "nationality": "Indonesian"
      }
    ],
    "transports": []
  }
}
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Agent round-trip booking created successfully",
  "data": {
    "departure": {
      "booking_id": 2562,
      "ticket_id": "GG-RT-984277",
      "transaction_id": "TRANS-5de3d010990b48e4",
      "ticket_total": 760000,
      "gross_total": 860000,
      "pricing_breakdown": {
        "flatPrice": 760000,
        "totalPassengers": 2,
        "total": 760000
      },
      "commission": {
        "success": true,
        "commission": 100000
      }
    },
    "return": {
      "booking_id": 2563,
      "ticket_id": "GG-RT-984278",
      "transaction_id": "TRANS-8a9b2c01345d67ef",
      "ticket_total": 760000,
      "gross_total": 760000,
      "pricing_breakdown": {
        "flatPrice": 760000,
        "totalPassengers": 2,
        "total": 760000
      },
      "commission": {
        "success": true,
        "commission": 100000
      }
    },
    "total_gross": 1620000,
    "payment_status": "invoiced",
    "status": "processing"
  }
}
```

---

## Ticket ID Format

### Round-Trip Ticket IDs
- **Format**: `GG-RT-XXXXXX`
- **Pattern**: Paired odd-even numbers
- **Example**:
  - Departure: `GG-RT-984277` (odd number)
  - Return: `GG-RT-984278` (even number)

### Validation Rules
1. Departure ticket ID must end with an **odd number**
2. Return ticket ID must end with an **even number**
3. Return ticket number = Departure ticket number + 1
4. **NEVER** end with `99` (departure) or `00` (return)
5. Both tickets must be unique in the database

### Generation Logic
```javascript
// Example paired numbers:
// GG-RT-386515 (departure, ends with 15 - odd)
// GG-RT-386516 (return, ends with 16 - even)

// Invalid examples:
// GG-RT-386599 (would create GG-RT-386600 - ends with 00) ❌
// GG-RT-386500 (return ends with 00) ❌
```

---

## Processing Flow

### 1. Main Controller (Synchronous)
The main controller handles the following in a **database transaction**:

1. **Validate passenger counts** (adult, child, infant)
2. **Calculate ticket prices** using backend pricing logic
3. **Generate paired ticket IDs** (one pair for both legs)
4. **Validate seat availability** for each leg
5. **Create booking records** for departure and return
6. **Create transaction records** for both bookings
7. **Add passengers** to each booking
8. **Calculate and create agent commissions** for both legs
9. **Add to background queue** for heavy operations

### 2. Background Queue (Asynchronous)
The queue processor handles:

1. **Seat availability updates** (decrement available seats)
2. **Create BookingSeatAvailability pivot records**
3. **Add transport bookings** (if applicable)
4. **Send Telegram notifications** on success/failure

### 3. Commission Calculation
- Calculated **synchronously** in the main controller
- Applied to **both departure and return** bookings
- Based on:
  - Gross total (ticket + transport)
  - Number of passengers
  - Trip type (from schedule/subschedule)
  - Agent commission rate

---

## Helper Functions

### `generateAgentRoundTripTicketId()`
**Location**: `util/calculateTicketTotal.js`

Generates a paired ticket ID for round-trip bookings.

**Returns**:
```javascript
{
  ticket_id_departure: "GG-RT-386515",
  ticket_id_return: "GG-RT-386516"
}
```

**Algorithm**:
1. Generate random 6-digit number (100000-999999)
2. Ensure it's odd (for departure)
3. Validate it doesn't end with `99`
4. Validate paired number doesn't end with `00`
5. Check database for uniqueness
6. Return paired IDs

### `calculateTotals(transports)`
**Location**: `controllers/bookingAgentController.js`

Calculates total transport costs.

**Parameters**:
- `transports` (Array): Array of transport objects

**Returns**:
```javascript
{
  transportTotal: 100000
}
```

### `notifyQueueError(error, context, title)`
**Location**: `controllers/bookingAgentController.js`

Sends Telegram notification when queue processing fails.

**Parameters**:
- `error` (Error): The error object
- `context` (Object): Booking context (booking_id, date, schedule, etc.)
- `title` (String): Error message title

---

## Database Schema

### Bookings Table
Each round-trip creates **2 booking records**:

```sql
-- Departure booking
{
  id: 2562,
  ticket_id: "GG-RT-984277",
  booking_date: "2025-01-15",
  payment_status: "invoiced",
  payment_method: "invoiced",
  booking_source: "agent",
  agent_id: 5,
  ticket_total: 760000,
  gross_total: 860000,
  ...
}

-- Return booking
{
  id: 2563,
  ticket_id: "GG-RT-984278",
  booking_date: "2025-01-20",
  payment_status: "invoiced",
  payment_method: "invoiced",
  booking_source: "agent",
  agent_id: 5,
  ticket_total: 760000,
  gross_total: 760000,
  ...
}
```

### Transactions Table
Each booking creates **1 transaction record**:

```sql
{
  transaction_id: "TRANS-5de3d010990b48e4",
  booking_id: 2562,
  payment_method: "invoiced",
  amount: 860000,
  status: "success",
  ...
}
```

### Agent Commissions Table
Each booking creates **1 commission record** (if agent_id provided):

```sql
{
  agent_id: 5,
  booking_id: 2562,
  commission_amount: 100000,
  gross_total: 860000,
  ...
}
```

---

## Error Handling

### Validation Errors (400)
```json
{
  "error": "Validation error",
  "message": "Passenger count mismatch. Adult(2) + Child(0) + Infant(0) = 2, but total_passengers is 3"
}
```

### Seat Availability Errors (400)
```json
{
  "error": "Internal server error",
  "message": "[departure] Insufficient seat availability"
}
```

### Server Errors (500)
```json
{
  "error": "Internal server error",
  "message": "Could not generate unique agent round-trip ticket IDs"
}
```

---

## Queue Monitoring

### Success Notification
```
✅ [QUEUE SUCCESS]
Booking ID: 2562
Type: departure
🕒 2025-01-15 10:30:00
```

### Error Notification
```
❌ [BOOKING ROUND QUEUE ERROR]
Insufficient seat availability
🧾 Booking ID: 2562
📅 Booking Date: 2025-01-15
🛤️ Schedule: 1
🔀 SubSchedule: N/A
🔖 Type: departure
🕒 2025-01-15 10:30:00
```

---

## Testing

### Test Endpoint
You can test the round-trip booking with:

```bash
curl -X POST http://localhost:3000/api/agent/round-trip-booking \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Validation Checklist
- [ ] Ticket IDs are paired (odd-even)
- [ ] Ticket IDs don't end with 99/00
- [ ] Both bookings created successfully
- [ ] Transactions created for both bookings
- [ ] Commissions calculated for both legs
- [ ] Passengers added to both bookings
- [ ] Queue jobs added for both legs
- [ ] Seat availability decremented
- [ ] Transport bookings created

---

## File Structure

```
controllers/
  └── bookingAgentController.js    # Main controller with round-trip logic

util/
  ├── calculateTicketTotal.js      # Ticket ID generation utilities
  ├── validateSeatAvailability.js  # Seat validation utilities
  ├── transactionUtils.js          # Transaction creation utilities
  └── bookingUtil.js               # Passenger and transport utilities

middleware/
  └── validateAgentRoundTripBooking.js  # Request validation middleware

routes/
  └── agentRoutesApi.js            # API route definitions
```

---

## Key Differences: Agent Round-Trip vs Regular Round-Trip

| Feature | Agent Round-Trip | Regular Round-Trip |
|---------|-----------------|-------------------|
| Ticket ID Format | `GG-RT-XXXXXX` | `GG-RT-XXXXXX` |
| Payment Status | `invoiced` | Varies (pending, paid, etc.) |
| Payment Method | `invoiced` | Multiple options |
| Booking Source | `agent` | `web`, `mobile`, etc. |
| Commission | ✅ Calculated | ❌ No commission |
| Queue Name | `bookingRoundQueue` | `bookingRoundQueue` |
| Validation | Agent-specific | Standard |

---

## Future Enhancements

- [ ] Support for multi-leg trips (more than 2 legs)
- [ ] Batch round-trip bookings (multiple passengers, different routes)
- [ ] Commission tier system (based on volume)
- [ ] Real-time seat availability updates via WebSocket
- [ ] Agent dashboard for booking management

---

## Changelog

### v1.0.0 (2025-01-17)
- Initial implementation of agent round-trip booking
- Paired ticket ID generation with odd-even validation
- Synchronous commission calculation
- Queue-based seat availability and transport processing
- Telegram notifications for queue errors

---

## Support

For issues or questions, contact:
- **Developer**: [Your Name]
- **Email**: support@giligetaway.com
- **GitHub Issues**: [Repository URL]
