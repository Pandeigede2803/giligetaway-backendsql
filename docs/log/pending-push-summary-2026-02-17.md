# Pending Push Summary - 2026-02-17

Branch: `main` (tracking `dede-main/main`)

## Current Git Status
Modified (`M`):
- `controllers/scheduleController.js`
- `docs/log/CHANGELOG.md`
- `middleware/validateBookingcreation.js`
- `routes/booking.js`
- `util/calculateTicketTotal.js`
- `util/formatSchedules.js`

Untracked (`??`):
- `docs/log/backend-calculation-ticket-gross-total-2026-02-11.md`

## Change Summary By File
1. `controllers/scheduleController.js`
- Subschedule seat lookup tightened to include parent schedule consistency.
- `SeatAvailability.findOne` now filters by:
  - `schedule_id: parentScheduleId`
  - `subschedule_id: subSchedule.id`
  - `date: selectedDate`
- Response mapping now sets `seatAvailability.schedule_id` from the same `parentScheduleId` to keep lookup/output consistent.

2. `middleware/validateBookingcreation.js`
- Booking pricing flow changed from client-value validation to backend calculation.
- `ticket_total`, `transport_total`, and `gross_total` are recalculated from DB/business rules.
- Transport item `transport_price` is replaced by backend-calculated value (`cost * quantity`).
- Applies to single-trip and round-trip validation paths.

3. `routes/booking.js`
- Added middleware `validateSingleBookingGrossTotal` to `POST /bookings/transit-queue`.
- Added middleware `validateRoundTripGrossTotal` to `POST /bookings/round-queue`.

4. `util/calculateTicketTotal.js`
- One-way ticket ID generation changed from time-based (`HHMMSS`) to random 6-digit format (`GG-OW-XXXXXX`) with DB collision retry.

5. `util/formatSchedules.js`
- Export fixed: added `getSeasonPrice` to `module.exports`.

6. `docs/log/CHANGELOG.md`
- Added changelog section dated `2026-02-11` covering backend-controlled ticket/gross total calculation and related route/middleware updates.

7. `docs/log/backend-calculation-ticket-gross-total-2026-02-11.md` (new)
- New documentation file describing backend calculation logic for ticket total and gross total.

## Diff Stats Snapshot
- 6 tracked files changed
- `204 insertions(+), 84 deletions(-)`
- Plus 1 untracked doc file

## Notes Before Push
- Working tree is not clean; all files above should be reviewed together before commit/push.
- If this push is intended only for subschedule seat lookup fix, split commit is recommended so unrelated pricing/ticket-id changes are not mixed.
