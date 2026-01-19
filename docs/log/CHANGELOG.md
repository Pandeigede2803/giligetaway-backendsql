# Changelog

All notable changes to this project will be documented in this file.

## [2026-01-12] - Race Condition Prevention & Error Monitoring

### Added
- **New Utility Files for Database Locking**
  - `util/handleMainScheduleBookingWithLock.js`: Implements row-level locking for main schedule booking operations to prevent race conditions during concurrent booking updates
  - `util/handleSubScheduleBookingWithLock.js`: Implements row-level locking for sub-schedule booking operations with proper transaction handling

- **Enhanced Error Monitoring**
  - Added Telegram notifications for critical errors in cron job processing (util/cronJobs.js:313-338, 351-376)
  - Detailed error messages including booking details, schedule IDs, and stack traces
  - Separate notifications for individual booking errors vs fatal process errors

### Changed
- **util/bsaUpdate.js**
  - Integrated new locking mechanisms via `handleMainScheduleBookingWithLock` and `handleSubScheduleBookingWithLock`
  - Added `useLock` parameter (default: true) to `createBookingSeatLinksForRoute` function for controlling lock usage
  - Updated booking flow to use locked versions during schedule updates to prevent race conditions

- **util/cronJobs.js**
  - Wrapped seat release and booking update operations in database transactions for atomicity
  - Enhanced error handling with try-catch blocks for individual bookings
  - Added Telegram error notifications for failed booking processing
  - Improved logging for debugging expired booking workflows

### Technical Details
- **Database Locking Strategy**: Both new utility files use `t.LOCK.UPDATE` (row-level locking) to ensure safe concurrent access to SeatAvailability records
- **Transaction Safety**: All seat availability operations now execute within database transactions to maintain data consistency
- **Error Recovery**: System continues processing remaining bookings even if individual bookings fail

### Purpose
These changes address race condition issues that could occur when multiple users attempt to book or update schedules simultaneously, ensuring data integrity and preventing seat availability conflicts.
