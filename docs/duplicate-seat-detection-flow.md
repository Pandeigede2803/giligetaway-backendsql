# Duplicate Seat Detection Flow

This note documents how the scheduled duplicate-seat checker works so it is easy to reason about what the SQL is doing, how the results are consumed, and how to operate the tooling.

## High-level flow

1. `controllers/seatAvailabilityController.js:2937` defines `findDuplicateSeats()`. It runs a raw SQL query via Sequelize and returns an array of duplicate rows.
2. `getDuplicateSeatReport` (same controller file, line 3096) exposes the data through the route `GET /seat-availability/test/duplicate-seat`. Adding `?notify=telegram` forces an on-demand Telegram push besides the JSON response.
3. `util/cronFrequencySeatDuplicates.js` schedules `findDuplicateSeats` to run automatically (default: hourly via `CRON_FREQUENCY_SEAT_DUPLICATE`). Each run feeds the output to `notifyTelegram`, which formats the rows and delivers them to the configured Telegram bot/chat.

## What the SQL looks for

The query joins `Passengers → Bookings → BookingSeatAvailability → SeatAvailability` and groups passengers by seat availability date plus a normalized seat identifier. The normalization (`seat_key`) strips whitespace, carriage returns, and line feeds before uppercasing the seat string, which lets us catch obvious data-entry duplicates like `" a1"`, `"A1 "`, or `"a 1"`.

Filters applied before aggregation:

- Only bookings with `payment_status IN ('paid', 'invoiced', 'unpaid')` are considered.
- Only non-infant passengers (either `passenger_type IS NULL` or not equal to `infant`).
- Seat numbers must be non-null, non-empty after `TRIM`.
- Availability date must be on/after `2025-07-17` (adjust this constant inside the query when the monitoring window changes).
- A tuple `NOT IN` blacklist skips schedule/subschedule combinations that are known to be noisy. `COALESCE(subschedule_id, -1)` keeps `NULL` subschedules safe.

After filtering, results are grouped by `sa.id`, `sa.date`, and `seat_key`. The `HAVING COUNT(DISTINCT p.id) > 1` clause retains only collisions where multiple passengers resolve to the same normalized seat on the same seat-availability record.

## Output fields

Each row includes:

- `seat_availability_id` and `availability_date` — help link findings back to `SeatAvailability`.
- `seat_key` — the normalized seat token used for deduping.
- `seat_count` — number of distinct passenger rows that resolved to this key.
- `ticket_details` — concatenated `ticket_id (contact_name)` pairs for quick inspection.
- Debug helpers: `raw_variants` (original seat strings), `booking_ids`, and `passenger_ids` to trace problematic rows precisely.

## Notifications & limits

- `notifyTelegram` trims the list to 50 rows per push, respects Telegram’s 4096-character limit, and escapes HTML so ticket IDs/names render safely. When more than 50 rows exist it appends a summary line ("…and N more rows").
- `notifyTelegramSeatBoosted` is unrelated but lives in the same controller; both functions use the shared Telegram sending helper.
- `MAX_TG_LEN` is set to 3900 characters as a safety margin; adjust only if Telegram limits change.

## Operational knobs

- `CRON_FREQUENCY_SEAT_DUPLICATE` (env) controls how often the cron in `util/cronFrequencySeatDuplicates.js` runs. Default is hourly (`0 */1 * * *`).
- Manual checks: hit `GET /seat-availability/test/duplicate-seat` to fetch JSON; append `?notify=telegram` if you want the cron-style alert immediately.
- To change the skip list or monitoring window, edit the raw SQL string in `findDuplicateSeats` and redeploy/restart to reload the controller definition.

Keeping this flow in mind helps when tweaking the filters/schedule or debugging Telegram alerts that reference `findDuplicateSeats`.
