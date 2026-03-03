# Discount System Implementation - Agent Booking Controller

## Overview
This document describes the discount calculation system implemented in `bookingAgentController.js` for agent bookings (both one-way and round-trip).

---

## Table of Contents
1. [Discount Data Structure](#discount-data-structure)
2. [Helper Function](#helper-function)
3. [One-Way Booking with Discount](#one-way-booking-with-discount)
4. [Round-Trip Booking with Discount](#round-trip-booking-with-discount)
5. [Discount Validation Rules](#discount-validation-rules)
6. [Final Total Formula](#final-total-formula)
7. [Test Cases (Manual)](#test-cases-manual)
8. [API Request Examples](#api-request-examples)
9. [Response Examples](#response-examples)
10. [Dashboard Integration](#dashboard-integration)

---

## Discount Data Structure

The `discount_data` JSON field in the Booking table stores:

```json
{
  "discountId": "10",
  "discountValue": 190000,
  "discountPercentage": "25.00"
}
```

### Fields:
- **`discountId`** (string): The ID of the discount from the Discount table
- **`discountValue`** (number): The actual discount amount deducted from the ticket total (transport excluded)
- **`discountPercentage`** (string): The percentage value (e.g., "25.00") for percentage discounts, or "0" for fixed amount discounts

---

## Helper Function

### `calculateDiscountAmount(discount, grossTotal, scheduleId, direction)`

**Location:** `controllers/bookingAgentController.js` (lines 92-166)

**Purpose:** Validates and calculates discount amount based on discount rules.

#### Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `discount` | Object | Discount record from database |
| `grossTotal` | Number | Ticket total before discount (transport excluded) |
| `scheduleId` | Number | Schedule ID to validate against |
| `direction` | String | Trip direction: 'departure', 'return', or 'all' |

#### Returns:
```javascript
{
  discountAmount: 190000,        // Amount deducted
  finalTotal: 1810000,           // Ticket total after discount
  discountData: {                // JSON to store in booking
    discountId: "10",
    discountValue: 190000,
    discountPercentage: "25.00"
  }
}
```

#### Validation Logic:
1. **Schedule Validation**: Checks if discount is applicable to the specific schedule
2. **Direction Validation**: Validates if discount applies to departure/return/all
3. **Minimum Purchase**: Ensures ticket total meets minimum purchase requirement
4. **Discount Calculation**:
   - **Percentage**: `(grossTotal × percentage) / 100`
   - **Fixed**: Direct discount value
5. **Max Discount Cap**: Applied if `max_discount` is set in discount record

---

## One-Way Booking with Discount

### Implementation Flow:

1. **Request includes `discount_code`** in the booking data
2. **System fetches discount** from the Discount table by code
3. **Validates and calculates** discount using `calculateDiscountAmount()`
4. **Applies discount** to ticket total only (transport excluded)
5. **Stores `discount_data`** JSON in booking record
6. **Rebuilds gross total** = (ticket_total_after_discount + transport_total)
7. **Commission calculated** based on discounted gross total
8. **Returns discount information** in the response

### Code Location:
- Lines 259-294: Discount application logic
- Line 340: `discount_data` stored in booking

---

## Round-Trip Booking with Discount

### Implementation Flow:

Each leg (departure and return) can have **separate discount codes**.

1. **Each leg processes** its own `discount_code`
2. **Direction-specific validation**:
   - Departure leg uses `direction = 'departure'`
   - Return leg uses `direction = 'return'`
3. **Independent discount calculation** per leg (ticket total only)
4. **Total discount** = departure discount + return discount

### Code Location:
- Lines 733-768: Discount logic in `handleLeg()` function
- Line 795: `discount_data` stored in booking
- Line 940: `total_discount` in response

---

## Discount Validation Rules

### 1. **Schedule Restriction**
```javascript
// Discount table has schedule_ids array
schedule_ids: [58, 60, 62, 59, 61, 79, 77, 75]

// Validation
if (Array.isArray(discount.schedule_ids) && discount.schedule_ids.length > 0) {
  if (!discount.schedule_ids.includes(parseInt(scheduleId))) {
    // Discount not applicable
  }
}
```

### 2. **Direction Restriction**
```javascript
// applicable_direction ENUM: 'departure', 'return', 'all'

// Examples:
// - 'departure' only applies to departure bookings
// - 'return' only applies to return bookings
// - 'all' applies to both
```

### 3. **Trip Type Restriction**
```javascript
// applicable_types ENUM: 'one_way', 'round_trip', 'all'

// Note: This is validated in middleware (validateDiscountQuery.js)
```

### 4. **Date Range Validation**
```javascript
// start_date and end_date in Discount table
// Validated in middleware (validateDiscountQuery.js)
```

### 5. **Minimum Purchase**
```javascript
if (discount.min_purchase && grossTotal < parseFloat(discount.min_purchase)) {
  // Discount not applicable
}
```
> `grossTotal` here refers to the ticket total before discount (transport excluded).

### 6. **Maximum Discount Cap**
```javascript
if (discount.max_discount && discountAmount > parseFloat(discount.max_discount)) {
  discountAmount = parseFloat(discount.max_discount);
}
```

### 7. **Agent Restriction**
```javascript
// agent_ids array in Discount table
agent_ids: [926, 1234, 5678]

// Note: Validation should be added in middleware if needed
```

---

## Final Total Formula

Discount is applied to ticket price only. Transport is always added after discount.

```text
ticket_total = calculated from schedule + passengers
transport_total = sum(transport_price * quantity)
discount_amount = calculated from ticket_total
ticket_total_after_discount = max(0, ticket_total - discount_amount)
gross_total = ticket_total_after_discount + transport_total
```

## Test Cases (Manual)

1) One-way with transport + percentage discount  
   - ticket_total = 1,000,000  
   - transport_total = 100,000  
   - discount = 10% of ticket_total = 100,000  
   - ticket_total_after_discount = 900,000  
   - gross_total = 900,000 + 100,000 = 1,000,000

2) One-way with transport + fixed discount  
   - ticket_total = 750,000  
   - transport_total = 50,000  
   - discount = 200,000  
   - ticket_total_after_discount = 550,000  
   - gross_total = 600,000

3) Minimum purchase check (ticket only)  
   - min_purchase = 500,000  
   - ticket_total = 450,000  
   - transport_total = 300,000  
   - result: discount NOT applied because ticket_total < min_purchase

4) Round-trip (per leg discount)  
   - departure ticket_total = 800,000; transport_total = 100,000; discount 10% = 80,000  
     gross_total (departure) = 720,000 + 100,000 = 820,000  
   - return ticket_total = 700,000; transport_total = 0; discount fixed 50,000  
     gross_total (return) = 650,000  
   - total_gross = 1,470,000; total_discount = 130,000

## API Request Examples

### One-Way Booking with Discount

**Endpoint:** `POST /api/agent/booking`

```json
{
  "contact_name": "John Doe",
  "contact_phone": "+628123456789",
  "contact_email": "john@example.com",
  "schedule_id": 58,
  "subschedule_id": null,
  "departure_date": "2025-12-01",
  "adult_passengers": 2,
  "child_passengers": 1,
  "infant_passengers": 0,
  "total_passengers": 3,
  "currency": "IDR",
  "agent_id": 926,
  "discount_code": "EXPLOREGILI",
  "passengers": [
    {
      "name": "John Doe",
      "age": 30,
      "nationality": "Indonesian",
      "passport_id": "A1234567"
    }
  ],
  "transports": [
    {
      "transport_id": 1,
      "transport_price": 50000,
      "quantity": 2
    }
  ]
}
```

### Round-Trip Booking with Discounts

**Endpoint:** `POST /api/agent/booking/round-trip`

```json
{
  "departure": {
    "contact_name": "John Doe",
    "contact_phone": "+628123456789",
    "contact_email": "john@example.com",
    "schedule_id": 58,
    "subschedule_id": null,
    "booking_date": "2025-12-01",
    "adult_passengers": 2,
    "child_passengers": 0,
    "infant_passengers": 0,
    "total_passengers": 2,
    "currency": "IDR",
    "agent_id": 926,
    "discount_code": "AGENT10",
    "passengers": [
      {
        "name": "John Doe",
        "age": 30,
        "seat_number_departure": "A1",
        "seat_number_return": "B2"
      }
    ],
    "transports": []
  },
  "return": {
    "contact_name": "John Doe",
    "contact_phone": "+628123456789",
    "contact_email": "john@example.com",
    "schedule_id": 60,
    "subschedule_id": null,
    "booking_date": "2025-12-05",
    "adult_passengers": 2,
    "child_passengers": 0,
    "infant_passengers": 0,
    "total_passengers": 2,
    "currency": "IDR",
    "agent_id": 926,
    "discount_code": "EXPLOREGILI",
    "passengers": [
      {
        "name": "John Doe",
        "age": 30,
        "seat_number_departure": "A1",
        "seat_number_return": "B2"
      }
    ],
    "transports": []
  }
}
```

---

## Response Examples

### One-Way Booking Response

```json
{
  "success": true,
  "message": "Agent booking created successfully",
  "data": {
    "booking_id": 12345,
    "ticket_id": "GG-OW-123456",
    "transaction_id": "TRANS-abc123def456",
    "ticket_total": 1900000,
    "transport_total": 100000,
    "discount_amount": 200000,
    "discount_data": {
      "discountId": "2",
      "discountValue": 200000,
      "discountPercentage": "10.00"
    },
    "gross_total": 1800000,
    "payment_status": "invoiced",
    "payment_method": "invoiced",
    "status": "processing",
    "pricing_breakdown": {
      "adult": 950000,
      "child": 0,
      "infant": 0
    },
    "commission": {
      "success": true,
      "commission": 180000
    }
  }
}
```

### Round-Trip Booking Response

```json
{
  "success": true,
  "message": "Agent round-trip booking created successfully",
  "data": {
    "departure": {
      "booking_id": 12345,
      "ticket_id": "GG-RT-123457",
      "transaction_id": "TRANS-abc123def456",
      "ticket_total": 1000000,
      "discount_amount": 100000,
      "discount_data": {
        "discountId": "3",
        "discountValue": 100000,
        "discountPercentage": "10.00"
      },
      "gross_total": 900000,
      "pricing_breakdown": {
        "adult": 500000,
        "child": 0,
        "infant": 0
      },
      "commission": {
        "success": true,
        "commission": 90000
      }
    },
    "return": {
      "booking_id": 12346,
      "ticket_id": "GG-RT-123458",
      "transaction_id": "TRANS-xyz789ghi012",
      "ticket_total": 1000000,
      "discount_amount": 150000,
      "discount_data": {
        "discountId": "2",
        "discountValue": 150000,
        "discountPercentage": "15.00"
      },
      "gross_total": 850000,
      "pricing_breakdown": {
        "adult": 500000,
        "child": 0,
        "infant": 0
      },
      "commission": {
        "success": true,
        "commission": 85000
      }
    },
    "total_gross": 1750000,
    "total_discount": 250000,
    "payment_status": "invoiced",
    "status": "processing"
  }
}
```

---

## Dashboard Integration

### Querying Bookings with Discounts

#### SQL Query Example:
```sql
SELECT
  id,
  ticket_id,
  gross_total,
  JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountId')) AS discount_id,
  JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountValue')) AS discount_value,
  JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountPercentage')) AS discount_percentage
FROM Bookings
WHERE discount_data IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountId')) != ''
ORDER BY created_at DESC;
```

#### Sequelize Query Example:
```javascript
const { literal } = require('sequelize');

const bookingsWithDiscounts = await Booking.findAll({
  where: {
    discount_data: {
      [Op.ne]: null
    },
    [Op.and]: literal(`JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountId')) != ''`)
  },
  attributes: [
    'id',
    'ticket_id',
    'gross_total',
    [literal(`JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountId'))`), 'discountId'],
    [literal(`JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountValue'))`), 'discountValue'],
    [literal(`JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountPercentage'))`), 'discountPercentage'],
    'discount_data'
  ],
  order: [['created_at', 'DESC']]
});
```

### Discount Analytics

#### Total Discount Amount by Discount Code:
```javascript
const discountStats = await Booking.findAll({
  where: {
    discount_data: {
      [Op.ne]: null
    }
  },
  attributes: [
    [literal(`JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountId'))`), 'discountId'],
    [literal('COUNT(*)'), 'usage_count'],
    [literal(`SUM(JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountValue')))`), 'total_discount_amount']
  ],
  group: [literal(`JSON_UNQUOTE(JSON_EXTRACT(discount_data, '$.discountId'))`)],
  raw: true
});

// Then join with Discount table to get discount names
const discountIds = discountStats.map(s => parseInt(s.discountId));
const discounts = await Discount.findAll({
  where: { id: { [Op.in]: discountIds } }
});

// Merge results
const result = discountStats.map(stat => {
  const discount = discounts.find(d => d.id === parseInt(stat.discountId));
  return {
    discount_id: stat.discountId,
    discount_code: discount?.code,
    discount_name: discount?.name,
    usage_count: stat.usage_count,
    total_discount_amount: parseFloat(stat.total_discount_amount)
  };
});
```

### Dashboard Display Example:

```javascript
// In your dashboard controller
exports.getDiscountReport = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: {
        discount_data: { [Op.ne]: null }
      },
      attributes: ['id', 'ticket_id', 'gross_total', 'discount_data', 'created_at']
    });

    const report = bookings.map(b => ({
      booking_id: b.id,
      ticket_id: b.ticket_id,
      gross_total: b.gross_total,
      discount_id: b.discount_data?.discountId,
      discount_value: b.discount_data?.discountValue,
      discount_percentage: b.discount_data?.discountPercentage,
      booking_date: b.created_at
    }));

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

---

## Notes

1. **Discount is applied BEFORE commission calculation**: Agents earn commission based on the discounted gross total
2. **No discount relationship in database**: Discount data is stored as JSON to avoid foreign key constraints and allow flexibility
3. **Validation happens at middleware level**: Use `validateDiscountQuery` middleware for pre-booking discount validation
4. **Commission calculation**: Based on final gross total after discount
5. **Exchange rate calculation**: Applied after discount calculation
6. **Queue processing**: Discount data is stored before queue processing for seat/transport/email operations

---

## Future Enhancements

- Add agent_ids validation in booking controller
- Create discount usage analytics endpoint
- Add discount expiry notifications
- Implement discount usage limits (max uses per discount)
- Add bulk discount operations for agents
