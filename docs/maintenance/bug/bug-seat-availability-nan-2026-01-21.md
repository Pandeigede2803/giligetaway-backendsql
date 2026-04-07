# Bug Report: Seat Availability NaN in Agent Booking (2026-01-21)

## Summary
Agent booking failed during seat availability validation with error:

```
Unknown column 'NaN' in 'where clause'
```

Root cause: `subschedule_id` was `null` but got parsed/logged as `NaN`, and the query tried to use `subschedule_id = NaN` in SQL. MySQL treats `NaN` as a column identifier, causing the error.

## Logs (Example)
```
---VALIDATE SEATAVAILABILITY---
Schedule ID: 62
SubSchedule ID: NaN
Booking Date: 2027-06-15
Total Passengers: 2
Error validating seat availability for single trip: Unknown column 'NaN' in 'where clause'
```

## Impact
- Agent booking failed at seat availability validation.
- Booking did not proceed even though `subschedule_id` is allowed to be null.

## Root Cause
`validateSeatAvailabilitySingleTrip` accepted `subschedule_id` without validation and included it in the `where` clause when it was `NaN`.

## Fix (Safe Utils)
- Created new utility that parses IDs safely and only includes `subschedule_id` when it is a valid number.
- Kept existing utility unchanged to avoid breaking other flows.
- Agent booking now uses the safe utility.

## Changes
- Added: `util/validateSeatAvailabilitySingleTripSafe.js`
- Updated: `controllers/bookingAgentController.js` to import and use the safe utility

## Notes
- `subschedule_id` is allowed to be null. In that case, the query should only use `schedule_id`.
- Existing `validateSeatAvailabilitySingleTrip` remains for other modules.
