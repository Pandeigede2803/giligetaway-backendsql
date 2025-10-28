# Agent API Testing

Testing functions for agent booking REST API endpoints.

## Endpoints Tested

- `POST /api/v3/book/v1` - One-way agent booking
- `POST /api/v3/round-trip-book/v1` - Round-trip agent booking

## Setup

1. Install axios if not already installed:
```bash
npm install axios
```

2. Set environment variables:
```bash
export BASE_URL=http://localhost:3000
export API_KEY=your-api-key-here
```

## Usage

### Run all tests
```bash
node testing/agentApiTest.js all
```

### Run specific tests

**One-way booking test:**
```bash
node testing/agentApiTest.js one-way
```

**Round-trip booking test:**
```bash
node testing/agentApiTest.js round-trip
```

**One-way validation error tests:**
```bash
node testing/agentApiTest.js validate-one-way
```

**Round-trip validation error tests:**
```bash
node testing/agentApiTest.js validate-round-trip
```

## Test Data

### One-Way Booking Template

```javascript
{
  schedule_id: 1,
  subschedule_id: null,
  departure_date: '2025-10-25',
  adult_passengers: 2,
  child_passengers: 1,
  infant_passengers: 0,
  total_passengers: 3,
  contact_name: 'John Doe',
  contact_phone: '+628123456789',
  contact_email: 'johndoe@example.com',
  contact_nationality: 'Indonesian',
  agent_id: 1,
  currency: 'IDR',
  transports: [...]
}
```

### Round-Trip Booking Template

```javascript
{
  agent_id: 1,
  departure: {
    schedule_id: 1,
    booking_date: '2025-10-25',
    passengers: [...],
    transports: [...]
  },
  return: {
    schedule_id: 2,
    booking_date: '2025-10-30',
    passengers: [...],
    transports: [...]
  }
}
```

## Customizing Test Data

You can modify the templates in `agentApiTest.js`:
- `oneWayBookingTemplate` - for one-way bookings
- `roundTripBookingTemplate` - for round-trip bookings

Or pass custom data when calling test functions programmatically:

```javascript
const { testOneWayBooking } = require('./testing/agentApiTest');

testOneWayBooking({
  schedule_id: 5,
  agent_id: 2,
  departure_date: '2025-11-01'
});
```

## Using in Other Scripts

```javascript
const {
  testOneWayBooking,
  testRoundTripBooking,
  oneWayBookingTemplate,
  roundTripBookingTemplate
} = require('./testing/agentApiTest');

// Customize and test
const customBooking = {
  ...oneWayBookingTemplate,
  schedule_id: 10,
  agent_id: 5
};

await testOneWayBooking(customBooking);
```

## Expected Response Format

### One-Way Booking Success
```javascript
{
  success: true,
  message: 'Agent booking created successfully',
  data: {
    booking_id: 123,
    ticket_id: 'TK-...',
    transaction_id: 'TRANS-...',
    ticket_total: 500000,
    transport_total: 50000,
    gross_total: 550000,
    payment_status: 'invoiced',
    pricing_breakdown: {...},
    commission: {...}
  }
}
```

### Round-Trip Booking Success
```javascript
{
  success: true,
  message: 'Agent round-trip booking created successfully',
  data: {
    departure: {
      booking_id: 123,
      ticket_id: 'TK-...',
      transaction_id: 'TRANS-...',
      ...
    },
    return: {
      booking_id: 124,
      ticket_id: 'TK-...',
      transaction_id: 'TRANS-...',
      ...
    },
    total_gross: 1100000,
    payment_status: 'invoiced'
  }
}
```

## Validation Error Tests

The test suite includes validation error scenarios:
- Missing required fields
- Invalid data types
- Passenger count mismatches
- Invalid foreign keys (agent_id, schedule_id)
- Invalid transport data

## Notes

- Make sure your database has the required test data (schedules, agents, transports)
- Update the template IDs to match your database records
- API key must be valid and have proper permissions
- Tests create actual bookings in the database
