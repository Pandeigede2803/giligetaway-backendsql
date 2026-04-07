# Waiting List Cron Overview

This note summarizes how the waiting-list automation is wired today and the
current edge cases observed during the review.

## Scheduling Entry Point

- `app.js:186` calls `waitingListCron.scheduleWaitingListCron()` when the
  server boots so the task is live for the lifetime of the process.
- `util/waitingListCron.js:618` registers a `node-cron` job. The frequency is
  driven by `CRON_FREQUENCY_WAITING_LIST` (default `0 * * * *`, i.e. hourly).
- Every run delegates to `checkAndNotifyWaitingList()` and expects a summary
  object back (counts of checked rows, notifications, invalid entries, etc.).

## `checkAndNotifyWaitingList`

- Pulls every `WaitingList` row that is still `pending` and whose
  `booking_date` is strictly greater than today using `Op.gt`. This means
  same-day bookings never reach the cron at the moment.
- Eager loads the related `Schedule` so the cron can check `validity_start /`
  `validity_end` plus `days_of_week`, and keeps the `seat_availability_id`
  handy to group entries efficiently.
- The intended validation flow:
  1. Ensure the booking date falls inside the schedule validity window.
  2. Ensure the booking date’s weekday matches one of the bits in
     `days_of_week`.
  3. If either check fails, push the entry to `invalidWaitingListIds` for
     follow-up handling.
  4. Otherwise group valid entries by `seat_availability_id` so the released
     seats can be processed in batches.
- **Bug:** `isValid` never flips to `false` and `invalidReason` never gets set,
  so the invalid group is always empty and no follow-up emails send even when
  bookings fall outside the allowed date range or weekday.
- Valid groups call `waitingListNotify` with the first entry’s schedule data
  plus the list of seat availability IDs. Invalid ones are supposed to trigger
  `sendInvalidWaitingListFollowUp`, then mark the entries as `contacted` after
  writing a note. The current update call only preserves the old
  `follow_up_notes`, so the invalid reason/email result is never persisted.

## `waitingListNotify`

- Invoked per seat-availability group to perform a stricter validation before
  blasting emails.
- Filters rows by `seat_availability_id` plus `status: 'pending'` and joins
  `Schedule`, `SubSchedule`, and `SeatAvailability` (all with `availability:
  true`).
- Validation steps:
  - Booking date has not passed yet.
  - Booking date stays within the schedule validity window.
  - Booking date occurs on one of the active `days_of_week` bits.
  - Available seats are still sufficient for `total_passengers`.
- When an entry succeeds it queues two emails using
  `sendWaitingListEmail`: one to the customer, one to the staff address in
  `EMAIL_BOOKING`, both CC’ing `booking@giligetaway.site`. After sending, the
  entry status becomes `contacted` with `last_contact_date` populated.

## Follow-Up Email Utility

- `sendInvalidWaitingListFollowUp()` (in `util/sendWaitingListEmail.js`)
  iterates over invalid entries, crafts a tailored explanation (date outside
  validity, wrong weekday, or both), and emails the customer individually.
- Returns total/success/failure counts plus per-recipient results so the cron
  can log metrics and annotate the DB rows accordingly.

## Outstanding Issues / Risks

1. `isValid` never becomes `false` in `checkAndNotifyWaitingList`, so follow-up
   emails are never triggered and `follow_up_emails_sent` remains zero.
2. Same-day waiting list rows are skipped due to `Op.gt`. Confirm whether they
   should be processed; if yes, switch to `Op.gte`.
3. When marking invalid entries as `contacted`, the cron drops the new context
   instead of appending it to `follow_up_notes`, making audits harder.
4. `waitingListNotify` mutates the shared `currentDate` via `.setHours` before
   every comparison. The code still works but is fragile because the value is
   no longer a `Date` object after the first mutation.

Keeping these notes up to date will make it easier to reason about the cron and
avoid double-processing or silent skips.

