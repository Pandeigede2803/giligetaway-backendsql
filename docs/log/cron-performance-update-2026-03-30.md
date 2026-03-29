# Cron Performance Update - 2026-03-30

## Date
- 2026-03-30

## Context
- Database CPU spike observed during cron execution and dashboard refresh.
- Main concern: heavy periodic jobs (`seat mismatch`, `duplicate seat`, `seat boosted`, `custom email`) causing burst load.

## Changes Done Today

### 1. Custom Email Cron
- Default schedule changed to every 5 hours with minute offset.
- Added non-overlap lock (`isRunning`) to prevent stacked runs.
- Reduced N+1 pattern in custom email sender:
  - Replaced per-booking `EmailSendLog.findOne` with per-batch `EmailSendLog.findAll`.
  - Added set-based lookup for already-sent checks.
- Improved error notification detail so Telegram receives both `message` and underlying `error`.

### 2. Duplicate / Boosted Seat Cron
- Added non-overlap locks for both duplicate-seat and boosted-seat tasks.
- Added runnable task functions:
  - `runDuplicateSeatJobTask`
  - `runSeatBoostedJobTask`
- Updated hourly default minute offsets to avoid tight collisions.

### 3. Sequential Promo Chain Cron
- Added orchestrator: `util/promoOpsChainCron.js`.
- Execution order is now strict and sequential:
  1. custom email
  2. duplicate seat
  3. seat boosted
- Added per-step delay controls via env:
  - `PROMO_CHAIN_STEP_DELAY_MS`
  - `PROMO_CHAIN_DUPLICATE_TO_BOOSTED_DELAY_MS`
- Integrated in `app.js` so chain scheduler is registered from server bootstrap.

### 4. Seat Fix Cron
- Updated `seatFixCron` to call `fixAllSeatMismatches3`.
- Default cron currently uses minute offset (`47 */4 * * *`) unless overridden by env.

### 5. Seat Mismatch v3 (Full Scan, Low Memory)
- Added `fixAllSeatMismatches3` with low-memory strategy:
  - keyset batching (`id > lastId`, `LIMIT`)
  - raw SQL aggregation for occupied seats
  - update only mismatched rows
  - optional batch delay and max batches per run
- Added env tuning options:
  - `SEAT_FIX_BATCH_SIZE`
  - `SEAT_FIX_BATCH_DELAY_MS`
  - `SEAT_FIX_MAX_BATCHES_PER_RUN`
  - `SEAT_FIX_LOOKBACK_DAYS`
  - `SEAT_FIX_LOOKAHEAD_DAYS` (optional; when unset, scans future open-ended from lookback start)

### 6. Metrics Cache Cleanup
- Removed `tenantId` usage from annual metrics cache keys and logs.
- Removed noisy cache debug logs (`MISS/HIT/SET`) in annual metrics cached endpoints.

## Operational Notes
- All changes compiled via `node -c` checks during implementation.
- Service restart is required for cron registration and env changes to take effect.

## Recommended Immediate Runtime Settings
- For safer frequent seat-fix execution:
  - `SEAT_FIX_BATCH_SIZE=100`
  - `SEAT_FIX_BATCH_DELAY_MS=100`
  - `SEAT_FIX_MAX_BATCHES_PER_RUN=5`
- For promo chain spacing:
  - `PROMO_CHAIN_DUPLICATE_TO_BOOSTED_DELAY_MS=900000`

