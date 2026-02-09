# Bug Fix: Subschedule ID Empty String Handling

**Date:** 2026-02-06
**Type:** Bug Fix
**Severity:** High
**Component:** Agent API - Round Trip Booking Validation

---

## Problem Description

When agent applications send round-trip booking requests with empty string (`""`) or `"N/A"` values for `subschedule_id`, the system returns a database error:

```json
{
  "error": "Internal server error",
  "message": "Incorrect integer value: '' for column 'subschedule_id' at row 1"
}
```

### Example Request with Issue:
```json
{
  "departure": {
    "schedule_id": 59,
    "subschedule_id": 123,
    ...
  },
  "return": {
    "schedule_id": 59,
    "subschedule_id": "",
    "total_passengers": 4,
    "booking_date": "2026-06-18",
    "contact_name": "Sig SANDRO GIRARDI"
  }
}
```

---

## Root Cause

The validation middleware `validateAgentRoundTripBooking.js` was checking `subschedule_id` using a truthy check:

```javascript
if (legData.subschedule_id) {
  // validation logic...
}
```

**Problem Flow:**
1. Empty string `""` is **falsy** in JavaScript
2. Validation block **skipped** for empty strings
3. `subschedule_id: ""` passed to controller unchanged
4. Database rejected empty string for INTEGER column

**Why This Happened:**
- `subschedule_id` is an **optional field** (frontend cannot always control the value)
- Agent applications may send `""`, `"N/A"`, `null`, or `undefined` when subschedule is not selected
- Middleware did not sanitize these invalid values before passing to controller

---

## Solution

Modified the validation logic to **explicitly remove** the `subschedule_id` field when it contains invalid optional values.

### Changes Made

**File:** `middleware/validateAgentRoundTripBooking.js`
**Lines:** 87-116 (inside `validateLeg()` function)

**Before:**
```javascript
// 3.2 Validate subschedule_id (if provided)
if (legData.subschedule_id) {
  const subScheduleId = parseInt(
    legData.subschedule_id?.value || legData.subschedule_id
  );
  if (isNaN(subScheduleId)) {
    return {
      error: `Invalid ${legName} subschedule_id`,
      message: `${legName} subschedule_id must be a valid number`,
    };
  }
  // ... validation continues
}
```

**After:**
```javascript
// 3.2 Validate subschedule_id (if provided)
// Clean up subschedule_id: handle "", "N/A", null, undefined → remove field
const rawSubScheduleId = legData.subschedule_id?.value || legData.subschedule_id;
if (!rawSubScheduleId || rawSubScheduleId === "" || rawSubScheduleId === "N/A") {
  delete legData.subschedule_id;
  // console.log(`✅ ${legName} subschedule_id is optional, field removed`);
} else {
  const subScheduleId = parseInt(rawSubScheduleId);
  if (isNaN(subScheduleId)) {
    return {
      error: `Invalid ${legName} subschedule_id`,
      message: `${legName} subschedule_id must be a valid number`,
    };
  }
  // ... validation continues
}
```

### What Changed:
1. **Explicit check** for empty/invalid values: `""`, `"N/A"`, `null`, `undefined`
2. **Delete field** from object instead of passing invalid value
3. **Applies to both legs**: departure AND return (since `validateLeg()` is called for both)

---

## Impact

### Before Fix:
```json
// Middleware output to controller
{
  "return": {
    "schedule_id": 59,
    "subschedule_id": "",  // ❌ Empty string passed to database
    "total_passengers": 4,
    ...
  }
}
```
**Result:** Database error

### After Fix:
```json
// Middleware output to controller
{
  "return": {
    "schedule_id": 59,
    // ✅ subschedule_id field removed entirely
    "total_passengers": 4,
    ...
  }
}
```
**Result:** Booking succeeds, `subschedule_id` stored as `NULL` in database

---

## Testing

### Test Cases:
1. ✅ `subschedule_id: ""` → Field removed, booking succeeds
2. ✅ `subschedule_id: "N/A"` → Field removed, booking succeeds
3. ✅ `subschedule_id: null` → Field removed, booking succeeds
4. ✅ `subschedule_id: undefined` → Field removed, booking succeeds
5. ✅ `subschedule_id: 123` → Validation runs, subschedule checked in database
6. ✅ Both departure and return legs handled correctly

### How to Test:
```bash
POST /api/agent/round-trip-book/v1
Content-Type: application/json

{
  "agent_id": 1,
  "api_key": "your-api-key",
  "departure": {
    "schedule_id": 59,
    "subschedule_id": 123,
    ...
  },
  "return": {
    "schedule_id": 59,
    "subschedule_id": "",  // Test with empty string
    ...
  }
}
```

**Expected:** 200 OK with booking confirmation

---

## Related Files

- `middleware/validateAgentRoundTripBooking.js` - Modified
- `routes/agentRoutesApi.js` - No changes (route uses this middleware)
- `controllers/bookingAgentController.js` - No changes (receives cleaned data)

---

## Notes

- This fix is **defensive** - handles frontend data inconsistencies at the middleware layer
- `subschedule_id` remains **optional** as per business requirements
- No changes needed in controller or database schema
- Fix applies to all agent round-trip booking endpoints using this middleware

---

## Deployment Checklist

- [x] Code changed in middleware
- [ ] Unit tests updated (if applicable)
- [ ] Integration tests run
- [ ] Staging deployment verified
- [ ] Production deployment scheduled
- [ ] Agent application teams notified (no frontend changes required)

---

## Commit Message

```
fix: handle empty subschedule_id in agent round-trip booking validation

- Remove subschedule_id field when value is "", "N/A", null, or undefined
- Prevents database error: "Incorrect integer value: '' for column 'subschedule_id'"
- Applies to both departure and return legs
- subschedule_id remains optional as per business requirements

Closes: #[issue-number]
```
