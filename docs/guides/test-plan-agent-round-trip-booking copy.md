# Test Plan: Agent Round Trip Booking

## Overview
This document outlines the comprehensive test cases for the `createAgentRoundTripBooking` function, which handles round-trip bookings made by agents.

## API Endpoint
- **Route**: `POST /api/agent/bookings/round-trip`
- **Controller**: `createAgentRoundTripBooking`
- **Location**: `controllers/bookingAgentController.js:367-524`

---

## Test Categories

### 1. Request Validation Tests

#### 1.1 Valid Round Trip Booking Request
**Description**: Test successful round trip booking with all valid data
**Request Body**:
```json
{
  "departure": {
    "schedule_id": 1,
    "subschedule_id": null,
    "booking_date": "2025-12-01",
    "adult_passengers": 2,
    "child_passengers": 1,
    "infant_passengers": 0,
    "total_passengers": 3,
    "agent_id": 1,
    "currency": "IDR",
    "transports": [
      {
        "transport_id": 1,
        "transport_price": 50000,
        "quantity": 3
      }
    ],
    "passengers": [
      {
        "name": "John Doe",
        "nationality": "Indonesian",
        "id_number": "123456"
      },
      {
        "name": "Jane Doe",
        "nationality": "Indonesian",
        "id_number": "123457"
      },
      {
        "name": "Jimmy Doe",
        "nationality": "Indonesian",
        "id_number": "123458"
      }
    ]
  },
  "return": {
    "schedule_id": 2,
    "subschedule_id": null,
    "booking_date": "2025-12-05",
    "adult_passengers": 2,
    "child_passengers": 1,
    "infant_passengers": 0,
    "total_passengers": 3,
    "agent_id": 1,
    "currency": "IDR",
    "transports": [
      {
        "transport_id": 1,
        "transport_price": 50000,
        "quantity": 3
      }
    ],
    "passengers": [
      {
        "name": "John Doe",
        "nationality": "Indonesian",
        "id_number": "123456"
      },
      {
        "name": "Jane Doe",
        "nationality": "Indonesian",
        "id_number": "123457"
      },
      {
        "name": "Jimmy Doe",
        "nationality": "Indonesian",
        "id_number": "123458"
      }
    ]
  }
}
```
**Expected Result**:
- Status: 201
- Response includes both departure and return booking details
- `total_gross` = sum of departure and return gross_total
- Payment status is "invoiced"
- Both bookings created in database
- Two transactions created
- Queue jobs added for both legs

---

#### 1.2 Missing Departure Data
**Description**: Test when departure object is missing
**Request Body**:
```json
{
  "return": { /* valid return data */ }
}
```
**Expected Result**:
- Status: 500
- Error message indicating missing departure data

---

#### 1.3 Missing Return Data
**Description**: Test when return object is missing
**Request Body**:
```json
{
  "departure": { /* valid departure data */ }
}
```
**Expected Result**:
- Status: 500
- Error message indicating missing return data

---

### 2. Passenger Validation Tests

#### 2.1 Invalid Passenger Count - Departure
**Description**: Total passengers doesn't match sum
**Request Body**:
```json
{
  "departure": {
    "adult_passengers": 2,
    "child_passengers": 1,
    "infant_passengers": 0,
    "total_passengers": 5
  },
  "return": { /* valid data */ }
}
```
**Expected Result**:
- Status: 500
- Error from `validatePassengerCounts` function

---

#### 2.2 Invalid Passenger Count - Return
**Description**: Return leg has mismatched passenger counts
**Request Body**:
```json
{
  "departure": { /* valid data */ },
  "return": {
    "adult_passengers": 2,
    "child_passengers": 1,
    "infant_passengers": 0,
    "total_passengers": 10
  }
}
```
**Expected Result**:
- Status: 500
- Error from `validatePassengerCounts` function for return leg

---

#### 2.3 Zero Passengers
**Description**: Test with zero total passengers
**Request Body**:
```json
{
  "departure": {
    "adult_passengers": 0,
    "child_passengers": 0,
    "infant_passengers": 0,
    "total_passengers": 0
  },
  "return": { /* valid data */ }
}
```
**Expected Result**:
- Status: 500
- Validation error for invalid passenger count

---

#### 2.4 Mismatched Passenger Counts Between Legs
**Description**: Departure has 3 passengers, return has 2
**Request Body**:
```json
{
  "departure": {
    "total_passengers": 3,
    "passengers": [ /* 3 passengers */ ]
  },
  "return": {
    "total_passengers": 2,
    "passengers": [ /* 2 passengers */ ]
  }
}
```
**Expected Result**:
- Status: 201 (This should be allowed - passengers might differ)
- Both bookings created successfully

---

### 3. Schedule and Seat Availability Tests

#### 3.1 Invalid Schedule ID - Departure
**Description**: Non-existent schedule_id for departure
**Request Body**:
```json
{
  "departure": {
    "schedule_id": 99999,
    /* other valid data */
  },
  "return": { /* valid data */ }
}
```
**Expected Result**:
- Status: 500
- Error from ticket calculation or seat availability check

---

#### 3.2 Invalid Schedule ID - Return
**Description**: Non-existent schedule_id for return
**Request Body**:
```json
{
  "departure": { /* valid data */ },
  "return": {
    "schedule_id": 99999,
    /* other valid data */
  }
}
```
**Expected Result**:
- Status: 500
- Error from ticket calculation or seat availability check

---

#### 3.3 Insufficient Seats - Departure
**Description**: Requested passengers exceed available seats on departure
**Setup**: Create schedule with only 2 available seats
**Request Body**:
```json
{
  "departure": {
    "total_passengers": 10,
    /* other valid data */
  },
  "return": { /* valid data */ }
}
```
**Expected Result**:
- Status: 500
- Error message: "[departure] Insufficient seats available"

---

#### 3.4 Insufficient Seats - Return
**Description**: Requested passengers exceed available seats on return
**Setup**: Create schedule with only 2 available seats
**Request Body**:
```json
{
  "departure": { /* valid data */ },
  "return": {
    "total_passengers": 10,
    /* other valid data */
  }
}
```
**Expected Result**:
- Status: 500
- Error message: "[return] Insufficient seats available"

---

#### 3.5 Valid SubSchedule Booking
**Description**: Round trip with subschedules
**Request Body**:
```json
{
  "departure": {
    "schedule_id": 1,
    "subschedule_id": 101,
    /* other valid data */
  },
  "return": {
    "schedule_id": 2,
    "subschedule_id": 102,
    /* other valid data */
  }
}
```
**Expected Result**:
- Status: 201
- Both bookings created with subschedule references
- Queue processes via `handleSubScheduleBooking`

---

#### 3.6 Mixed Schedule Types
**Description**: Departure uses main schedule, return uses subschedule
**Request Body**:
```json
{
  "departure": {
    "schedule_id": 1,
    "subschedule_id": null
  },
  "return": {
    "schedule_id": 2,
    "subschedule_id": 102
  }
}
```
**Expected Result**:
- Status: 201
- Both bookings created correctly
- Different queue processing paths

---

### 4. Pricing and Calculation Tests

#### 4.1 Ticket Calculation Failure - Departure
**Description**: Backend pricing calculation fails for departure
**Mock**: `calculateTicketTotal` returns `{ success: false, error: "Invalid pricing" }`
**Expected Result**:
- Status: 500
- Error: "[departure] Ticket calculation failed: Invalid pricing"

---

#### 4.2 Ticket Calculation Failure - Return
**Description**: Backend pricing calculation fails for return
**Mock**: `calculateTicketTotal` returns `{ success: false, error: "Invalid pricing" }`
**Expected Result**:
- Status: 500
- Error: "[return] Ticket calculation failed: Invalid pricing"

---

#### 4.3 Pricing with Transport
**Description**: Verify transport costs are calculated correctly
**Request Body**:
```json
{
  "departure": {
    "transports": [
      { "transport_price": 50000, "quantity": 3 },
      { "transport_price": 30000, "quantity": 2 }
    ]
  },
  "return": {
    "transports": [
      { "transport_price": 50000, "quantity": 3 }
    ]
  }
}
```
**Expected Result**:
- Departure transport total: 210,000
- Return transport total: 150,000
- Correct gross_total for each leg

---

#### 4.4 Pricing Without Transport
**Description**: Round trip without any transport
**Request Body**:
```json
{
  "departure": {
    "transports": []
  },
  "return": {
    "transports": []
  }
}
```
**Expected Result**:
- Status: 201
- gross_total = ticket_total for both legs
- Transport total: 0

---

#### 4.5 Total Gross Calculation
**Description**: Verify total_gross in response
**Setup**:
- Departure gross_total: 500,000
- Return gross_total: 450,000
**Expected Result**:
- `total_gross` in response: 950,000

---

### 5. Agent Commission Tests

#### 5.1 Commission Generation - Valid Agent
**Description**: Verify commission is created for valid agent
**Request Body**:
```json
{
  "departure": {
    "agent_id": 1,
    /* other valid data */
  },
  "return": {
    "agent_id": 1,
    /* other valid data */
  }
}
```
**Expected Result**:
- Two separate commissions created (departure + return)
- Commissions processed in queue
- Telegram notification sent

---

#### 5.2 Commission - Invalid Agent ID
**Description**: Non-existent agent_id
**Request Body**:
```json
{
  "departure": {
    "agent_id": 99999
  },
  "return": {
    "agent_id": 99999
  }
}
```
**Expected Result**:
- Bookings still created
- Warning logged: "Agent not found"
- No commission created

---

#### 5.3 Commission - Different Agents
**Description**: Different agents for departure and return
**Request Body**:
```json
{
  "departure": {
    "agent_id": 1
  },
  "return": {
    "agent_id": 2
  }
}
```
**Expected Result**:
- Two separate commissions for different agents
- Both processed correctly

---

### 6. Transaction Tests

#### 6.1 Transaction Creation
**Description**: Verify two separate transactions are created
**Expected Result**:
- Two transaction records in database
- Format: `TRANS-{uuid}`
- Both have status: "success"
- Both linked to correct booking_id

---

#### 6.2 Transaction Currency
**Description**: Test different currencies
**Request Body**:
```json
{
  "departure": {
    "currency": "USD"
  },
  "return": {
    "currency": "USD"
  }
}
```
**Expected Result**:
- Transactions created with USD currency
- Correct currency in response

---

#### 6.3 Default Currency
**Description**: No currency specified
**Request Body**:
```json
{
  "departure": {},
  "return": {}
}
```
**Expected Result**:
- Default currency: "IDR"

---

### 7. Ticket ID Tests

#### 7.1 Unique Ticket IDs
**Description**: Verify departure and return have different ticket IDs
**Expected Result**:
- `departure.ticket_id` ≠ `return.ticket_id`
- Both follow `generateAgentTicketId` format

---

#### 7.2 Ticket ID Collision - Departure
**Description**: Generated ticket_id already exists
**Mock**: First call to `generateAgentTicketId` returns existing ID
**Expected Result**:
- Status: 500
- Error: "[departure] Ticket ID collision"

---

#### 7.3 Ticket ID Collision - Return
**Description**: Return ticket_id collision
**Mock**: Second call to `generateAgentTicketId` returns existing ID
**Expected Result**:
- Status: 500
- Error: "[return] Ticket ID collision"
- Departure booking rolled back

---

### 8. Queue Processing Tests

#### 8.1 Queue Job Creation
**Description**: Verify both legs added to queue
**Expected Result**:
- Two jobs added to `bookingRoundQueue`
- Job data contains all required fields
- Type field: "departure" and "return"

---

#### 8.2 Queue Processing - Main Schedule
**Description**: Queue processes main schedule
**Expected Result**:
- Calls `handleMainScheduleBooking`
- Creates BookingSeatAvailability records
- Adds transport bookings

---

#### 8.3 Queue Processing - SubSchedule
**Description**: Queue processes subschedule
**Expected Result**:
- Calls `handleSubScheduleBooking`
- Creates BookingSeatAvailability records
- Adds transport bookings

---

#### 8.4 Queue Error Handling
**Description**: Queue processing fails
**Mock**: `handleMainScheduleBooking` throws error
**Expected Result**:
- Transaction rollback
- Telegram notification sent
- Error logged

---

### 9. Passenger Data Tests

#### 9.1 Passengers Added Correctly
**Description**: Verify passengers are created via `addPassengers`
**Request Body**:
```json
{
  "departure": {
    "passengers": [
      { "name": "John", "nationality": "ID", "id_number": "123" }
    ]
  },
  "return": {
    "passengers": [
      { "name": "John", "nationality": "ID", "id_number": "123" }
    ]
  }
}
```
**Expected Result**:
- Passengers created for both bookings
- Linked to correct booking_id

---

#### 9.2 Missing Passenger Data
**Description**: No passengers array provided
**Request Body**:
```json
{
  "departure": {
    "passengers": []
  },
  "return": {
    "passengers": []
  }
}
```
**Expected Result**:
- Status: 201 (or error depending on validation)
- No passenger records created

---

### 10. Database Transaction Tests

#### 10.1 Atomic Transaction - Success
**Description**: All operations succeed
**Expected Result**:
- All changes committed
- Two bookings in database
- Two transactions in database
- Passengers created
- No rollback

---

#### 10.2 Atomic Transaction - Failure on Departure
**Description**: Departure leg fails
**Mock**: Seat availability check fails for departure
**Expected Result**:
- Entire transaction rolled back
- No bookings created
- No transactions created
- No passengers created

---

#### 10.3 Atomic Transaction - Failure on Return
**Description**: Return leg fails after departure succeeds
**Mock**: Return seat availability fails
**Expected Result**:
- Entire transaction rolled back
- Departure booking also rolled back
- No bookings created

---

### 11. Edge Cases

#### 11.1 Same Day Round Trip
**Description**: Return on same day as departure
**Request Body**:
```json
{
  "departure": {
    "booking_date": "2025-12-01"
  },
  "return": {
    "booking_date": "2025-12-01"
  }
}
```
**Expected Result**:
- Status: 201
- Both bookings created

---

#### 11.2 Return Before Departure
**Description**: Return date is earlier than departure
**Request Body**:
```json
{
  "departure": {
    "booking_date": "2025-12-10"
  },
  "return": {
    "booking_date": "2025-12-01"
  }
}
```
**Expected Result**:
- Status: 201 (no date validation in current code)
- Both bookings created

---

#### 11.3 Very Large Passenger Count
**Description**: Maximum passengers
**Request Body**:
```json
{
  "departure": {
    "total_passengers": 100
  },
  "return": {
    "total_passengers": 100
  }
}
```
**Expected Result**:
- Status: 201 (if seats available)
- OR seat availability error

---

#### 11.4 Maximum Transport Items
**Description**: Many transport bookings
**Request Body**:
```json
{
  "departure": {
    "transports": [ /* 20 different transports */ ]
  },
  "return": {
    "transports": [ /* 20 different transports */ ]
  }
}
```
**Expected Result**:
- Status: 201
- All transports added via queue

---

### 12. Response Format Tests

#### 12.1 Success Response Structure
**Description**: Verify response format
**Expected Response**:
```json
{
  "success": true,
  "message": "Agent round-trip booking created successfully",
  "data": {
    "departure": {
      "booking_id": 1,
      "ticket_id": "AG-...",
      "transaction_id": "TRANS-...",
      "ticket_total": 300000,
      "gross_total": 450000,
      "pricing_breakdown": { /* ... */ }
    },
    "return": {
      "booking_id": 2,
      "ticket_id": "AG-...",
      "transaction_id": "TRANS-...",
      "ticket_total": 300000,
      "gross_total": 450000,
      "pricing_breakdown": { /* ... */ }
    },
    "total_gross": 900000,
    "payment_status": "invoiced",
    "status": "processing"
  }
}
```

---

#### 12.2 Error Response - Validation Error
**Expected Response**:
```json
{
  "error": "Validation error",
  "message": "..."
}
```
**Status**: 400

---

#### 12.3 Error Response - Internal Error
**Expected Response**:
```json
{
  "error": "Internal server error",
  "message": "..."
}
```
**Status**: 500

---

### 13. Payment Status Tests

#### 13.1 Payment Status Always Invoiced
**Description**: Verify payment_status is always "invoiced"
**Expected Result**:
- Both bookings: payment_status = "invoiced"
- Both bookings: payment_method = "invoiced"
- Response: payment_status = "invoiced"

---

#### 13.2 Booking Source
**Description**: Verify booking_source is "agent"
**Expected Result**:
- Both bookings have booking_source = "agent"

---

### 14. Expiration Time Tests

#### 14.1 Expiration Time Set
**Description**: Verify expiration_time is set
**Expected Result**:
- Both bookings have expiration_time
- Time = current time + 30 minutes (from env)

---

### 15. Integration Tests

#### 15.1 Full Round Trip Flow
**Description**: Complete end-to-end test
**Steps**:
1. Create agent
2. Create schedules
3. Create seat availability
4. Submit round trip booking
5. Wait for queue processing
6. Verify all data created

**Expected Result**:
- All components working together
- Bookings created
- Seats reduced
- Transports added
- Commissions created
- Notifications sent

---

## Test Execution Priority

### P0 (Critical - Must Pass)
- 1.1, 2.1, 2.2, 3.3, 3.4, 4.1, 4.2, 10.1, 10.3

### P1 (High Priority)
- 1.2, 1.3, 3.1, 3.2, 4.3, 5.1, 6.1, 7.1, 8.1, 15.1

### P2 (Medium Priority)
- 2.3, 3.5, 4.4, 5.2, 6.2, 7.2, 8.2, 8.3

### P3 (Low Priority - Edge Cases)
- 2.4, 3.6, 4.5, 5.3, 11.1-11.4

---

## Test Data Requirements

### Required Database Setup
- At least 2 valid agents
- At least 4 schedules (2 for departure, 2 for return)
- At least 2 subschedules
- Seat availability records with varying capacities
- Transport options
- Valid pricing configuration

### Environment Variables
- `EXPIRATION_TIME_MINUTES`: Set to 30
- Database connection configured
- Redis/Bull queue configured
- Telegram bot configured (optional)

---

## Mocking Requirements

### Functions to Mock
- `calculateTicketTotal`
- `generateAgentTicketId`
- `validateSeatAvailabilitySingleTrip`
- `createTransaction`
- `addPassengers`
- `updateAgentCommissionOptimize`
- `sendTelegramMessage`

### External Services
- Bull Queue (for isolated unit tests)
- Database (for unit tests, use real DB for integration)
- Telegram API

---

## Coverage Goals
- Line Coverage: 90%+
- Branch Coverage: 85%+
- Function Coverage: 100%

---

## Notes
- All tests should clean up database after execution
- Use transactions for test isolation
- Mock external dependencies for unit tests
- Use real database for integration tests
- Monitor queue processing times
- Test concurrent bookings for race conditions
