# Changelog

All notable changes to this project will be documented in this file.

## [2026-02-06] - Fix Empty Subschedule ID Validation in Round-Trip Booking

### Fixed
- **Database Error for Empty Subschedule ID**
  - Fixed error: `"Incorrect integer value: '' for column 'subschedule_id' at row 1"`
  - Middleware now removes `subschedule_id` field when value is `""`, `"N/A"`, `null`, or `undefined`
  - Applies to both departure and return legs in round-trip bookings
  - `subschedule_id` remains optional as per business requirements

### Changed
- **`validateAgentRoundTripBooking` Middleware**
  - File: `middleware/validateAgentRoundTripBooking.js`
  - Added explicit handling for empty/invalid subschedule_id values
  - Field is removed from request object instead of passing invalid value to controller
  - Database now receives `NULL` instead of empty string for optional subschedule

### Technical Details
- Agent applications may send empty strings when subschedule is not selected
- Middleware now sanitizes data defensively before passing to controller
- No changes required in controller or database schema

### Documentation
- Added: `docs/BUG_FIX_SUBSCHEDULE_EMPTY_STRING.md`

---

## [2026-01-23] - Fix Discount Calculation, Net Total & Telegram Notification

### Fixed
- **Discount Calculation Bug**
  - Diskon sekarang dihitung dari NET (ticket_total - commission), bukan dari ticket_total langsung
  - Contoh: ticket=1jt, commission=100rb, net=900rb, diskon 20% = 180rb (bukan 200rb)

- **Missing `net_total` in API Response (CRITICAL)**
  - API response tidak menyertakan `net_total` (pendapatan company setelah commission)
  - Ini penting untuk tracking keuangan dan reporting

### Added
- **New Utility Function `calculateAgentCommissionAmount`**
  - File: `util/updateAgentComission.js`
  - Menghitung commission amount tanpa menyimpan ke database
  - Digunakan untuk pre-calculation sebelum discount

- **Telegram Notification untuk Booking Success**
  - File: `controllers/bookingAgentController.js`
  - Notifikasi untuk one-way booking dan round-trip booking
  - Info: ticket ID, agent ID, contact, passengers, total, date

- **New Response Fields untuk Financial Tracking**
  - `net_total`: Company receives per booking (gross_total - commission)
  - `total_commission`: Total komisi semua leg (round-trip only)
  - `total_net`: Total company receives (round-trip only)

### Changed
- **`calculateDiscountAmount` Function**
  - Ditambahkan parameter `commissionAmount`
  - Diskon dihitung dari `netAfterCommission`
  - Return object menyertakan `netAfterCommission`

- **`createAgentBooking` Response**
  - Ditambahkan `net_total` = gross_total - commission

- **`createAgentRoundTripBooking` Response**
  - Ditambahkan `net_total` per leg (departure & return)
  - Ditambahkan `total_commission` dan `total_net` untuk summary

- **`updateAgentCommissionOptimize`**
  - Refactored untuk menggunakan `calculateAgentCommissionAmount`

### Documentation
- Added: `docs/log/fix-bug-discount-calculation-2026-01-23.md`

---

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
