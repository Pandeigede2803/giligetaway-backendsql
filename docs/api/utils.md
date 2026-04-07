# Utils - Utility Functions

## Overview

Folder `util/` berisi berbagai utility functions yang digunakan di seluruh aplikasi. Utilities ini mencakup cron jobs, email handling, booking logic, seat management, dan helper functions lainnya.

## Utility Files Index

### Cron Jobs & Scheduling

| File | Description |
|------|-------------|
| cronJobs.js | Handle expired bookings and release seats |
| bookingSummaryCron.js | Daily booking summary email |
| seatFixCron.js | Fix seat availability mismatches |
| waitingListCron.js | Process waiting list |
| unpaidReminderCronJobs.js | Send payment reminders |
| promoOpsChainCron.js | Promo operations |
| seatCapacityCron.js | Monitor seat capacity |
| seatCapacityAlert.js | Send low seat alerts |

### Email & Notifications

| File | Description |
|------|-------------|
| emailUtils.js | Email utility functions |
| emailSender.js | Email sending with Resend/Nodemailer |
| sendPaymentEmail.js | Payment email templates |
| sendInvoiceAndTicketEmail.js | Invoice and ticket emails |
| sendWaitingListEmail.js | Waiting list notifications |
| sendPaymentEmailApiAgent.js | Agent payment emails |
| customEmailJob.js | Custom email jobs |
| telegram.js | Telegram notifications |
| bullDelayExpiredEmail.js | Queue expired booking emails |

### Booking & Seat Management

| File | Description |
|------|-------------|
| handleMainScheduleBooking.js | Booking for main schedules |
| handleSubScheduleBooking.js | Booking for sub-schedules |
| handleMainScheduleBookingWithLock.js | Main booking with seat locking |
| handleSubScheduleBookingWithLock.js | Sub-schedule booking with seat locking |
| handleMultipleSeatsBooking.js | Multi-seat booking logic |
| handleDynamicSeatAvailability.js | Dynamic seat availability |
| releaseSeats.js | Release seats back to availability |
| releaseMainScheduleSeats.js | Release main schedule seats |
| releaseSubScheduleSeats.js | Release sub-schedule seats |
| validateSeatAvailability.js | Validate seat availability |
| validateSeatAvailabilitySingleTrip.js | Validate single trip |
| validateSeatAvailabilitySingleTripSafe.js | Safe single trip validation |
| checkSeatNumber.js | Validate seat numbers |
| seatAvailabilityUtils.js | Seat availability helpers |
| seatUtils.js | General seat utilities |
| autoAssignSeats.js | Auto-assign seat numbers |
| bsaUpdate.js | Update booking seat availability |
| syncBookingTotals.js | Sync booking financials |

### Schedule & Search

| File | Description |
|------|-------------|
| querySchedulesHelper.js | Schedule query helper |
| querySchedulesHelperV4.js | Advanced schedule query (v4) |
| buildSearchCondition.js | Build search conditions |
| buildRoute.js | Build route information |
| formatScheduleResponse.js | Format schedule for API |
| formatSchedules.js | Format multiple schedules |
| formatUtilsSimple.js | Simple formatting utilities |
| formattedData2.js | Data formatting v2 |
| scheduleUtils.js | Schedule helpers |
| mapTransitDetails.js | Map transit information |
| mapJourneySteps.js | Map journey steps |
| mapJourneyStepsRoundTrip.js | Map round trip journey |

### Financial & Commission

| File | Description |
|------|-------------|
| calculateTicketTotal.js | Calculate booking total |
| recalculateBookingFinancials.js | Recalculate booking finances |
| syncBookingTotals.js | Sync booking totals |
| agentNetPrice.js | Calculate agent net price |
| updateAgentMetrics.js | Update agent metrics |
| updateAgentComission.js | Update agent commission |
| calculatePublicCapacity.js | Calculate public seat capacity |
| getCapacityReduction.js | Get capacity reduction amount |
| paymentAdjustment.js | Payment adjustments |

### Payment Integration

| File | Description |
|------|-------------|
| handleMidtransSettlement.js | Handle Midtrans payment settlement |
| handleMidtransSettlementRoundTrip.js | Round trip settlement |
| fetchMidtransPaymentStatus.js | Fetch payment status |
| transactionUtils.js | Transaction helpers |
| getExchangeRate.js | Get currency exchange rate |

### Data & Analytics

| File | Description |
|------|-------------|
| fetchMetricsBookingDate.js | Fetch metrics by date |
| sumTotalPassengers.js | Sum passengers count |
| calculateDepartureAndArrivalTime.js | Calculate times |
| googleAttribution.js | Google Ads attribution |
| ga4Tracker.js | GA4 tracking |
| getSeatAvailabilityIncludes.js | Query includes for seats |
| findSeatQuery.js | Find seat queries |
| cronFrequencySeatDuplicates.js | Handle duplicate cron jobs |

### Validation & Exception Handling

| File | Description |
|------|-------------|
| isException.js | Check if date is exception |
| isExceptionV2.js | Exception checking v2 |
| validateSeatAvailability.js | Seat availability validation |
| bookingUtil.js | Booking utilities |

### File Generation

| File | Description |
|------|-------------|
| generatePdf.js | Generate PDF tickets |
| dateUtils.js | Date formatting utilities |

### Queue Management

| File | Description |
|------|-------------|
| seatFixEventQueue.js | Queue for seat fix events |
| waitingListNotify.js | Queue for waiting list notifications |

---

## Key Utilities Explained

### cronJobs.js

**Purpose**: Handle expired bookings and release seats.

**Main Function**: `handleExpiredBookings()`

**Process**:
1. Find bookings where `payment_status = 'pending'` and `expiration_time < now`
2. Process in batches (100 at a time) to handle large volumes
3. For each expired booking:
   - Release seats back to availability (with transaction)
   - Update booking status to 'expired'
   - Update transaction status to 'cancelled'
   - Queue expired notification email (if not already sent)
4. Send Telegram alert on errors

**Email Rules**:
- One Way (GG-OW): Always send email
- Round Trip (GG-RT): Only send for odd numbers (GG-RT-1, GG-RT-3, etc.)
- Skip if another booking from same email created within 10 minutes

**Related**: `bullDelayExpiredEmail.js`, `releaseSeats.js`

---

### handleMainScheduleBooking.js

**Purpose**: Handle booking for main schedules.

**Main Function**: `handleMainScheduleBooking(bookingData)`

**Process**:
1. Validate schedule and date
2. Check seat availability
3. Lock seats (prevent overbooking)
4. Create booking record
5. Link seat availability to booking
6. Return booking details

**Transaction Safety**: Uses Sequelize transaction for atomicity.

**Related**: `handleMainScheduleBookingWithLock.js`, `validateSeatAvailability.js`

---

### handleSubScheduleBooking.js

**Purpose**: Handle booking for sub-schedules (specific dates).

**Main Function**: `handleSubScheduleBooking(bookingData)`

**Process**:
1. Validate sub-schedule and date
2. Check seat availability
3. Lock seats
4. Create booking record
5. Link to sub-schedule
6. Return booking details

**Related**: `handleSubScheduleBookingWithLock.js`, `releaseSubScheduleSeats.js`

---

### sendPaymentEmail.js

**Purpose**: Send payment-related emails.

**Functions**:
- `sendPaymentConfirmationEmail(booking)` - Payment success email
- `sendPaymentPendingEmail(booking)` - Payment pending email
- `sendExpiredBookingEmail(email, booking)` - Expired booking notification

**Email Templates**:
- Payment confirmation with ticket details
- Payment pending with payment link
- Expired booking with options to rebook

**Related**: `emailSender.js`, `sendInvoiceAndTicketEmail.js`

---

### handleMidtransSettlement.js

**Purpose**: Handle Midtrans payment settlement notification.

**Main Function**: `handleMidtransSettlement(orderId, paymentData)`

**Process**:
1. Find booking by order ID
2. Verify payment amount matches
3. Update transaction status to 'paid'
4. Update booking status to 'paid'
5. Calculate and save agent commission (if applicable)
6. Send ticket email
7. Send Telegram notification

**Race Condition Handling**:
- Checks if booking already processed
- Validates transaction exists
- Ensures data consistency

**Related**: `fetchMidtransPaymentStatus.js`, `sendInvoiceAndTicketEmail.js`

---

### releaseSeats.js

**Purpose**: Release seats back to availability when booking is cancelled/expired.

**Functions**:
- `releaseSeats(booking, transaction)` - Main release function
- `releaseMainScheduleSeats(scheduleId, date, count, transaction)` - Release main schedule seats
- `releaseSubScheduleSeats(scheduleId, subscheduleId, date, count, transaction)` - Release sub-schedule seats

**Process**:
1. Find all SeatAvailability records for the booking
2. Increase `available_seats` count
3. Update `booked_seats` count
4. Update BookingSeatAvailability junction
5. Return updated seat IDs

**Transaction Safety**: Must be called within a transaction.

---

### validateSeatAvailability.js

**Purpose**: Validate that seats are available for booking.

**Main Function**: `validateSeatAvailability(scheduleId, date, passengerCount, subscheduleId)`

**Validation Checks**:
1. Schedule or sub-schedule exists
2. Date is within validity period
3. Enough available seats
4. Schedule is active

**Returns**:
```javascript
{
  valid: boolean,
  message: string,
  availableSeats: number,
  price: number
}
```

---

### calculateTicketTotal.js

**Purpose**: Calculate total booking amount.

**Main Function**: `calculateTicketTotal(bookingData)`

**Calculation**:
- Base price × adult count
- Child price (50% of adult) × child count
- Infant price (10% of adult) × infant count
- Plus bank fee
- Minus discount (if applicable)

**Season Pricing**:
- Low season: `low_season_price`
- High season: `high_season_price`
- Peak season: `peak_season_price`

**Related**: `recalculateBookingFinancials.js`, `agentNetPrice.js`

---

### waitingListCron.js

**Purpose**: Process waiting list when seats become available.

**Main Function**: `scheduleWaitingListCron()`

**Process**:
1. Find schedules with newly available seats
2. Get waiting list entries in FIFO order
3. Notify customers (email)
4. Set 24-hour expiration
5. Move to booked if confirmed

**Related**: `sendWaitingListEmail.js`, `waitingListNotify.js`

---

### telegram.js

**Purpose**: Send notifications to Telegram for monitoring.

**Main Function**: `sendTelegramMessage(message)`

**Use Cases**:
- Booking alerts
- Payment errors
- System errors
- Low seat availability (< 10 seats)
- Cron job failures

**Message Format**: HTML with bold, code, and pre tags.

---

### emailSender.js

**Purpose**: Centralized email sending with Resend and Nodemailer.

**Functions**:
- `sendEmail(to, subject, html, attachments)` - Send email
- `sendEmailWithTemplate(to, templateId, data)` - Send with template
- `queueEmail(to, subject, html)` - Queue email for later sending

**Providers**:
- Resend (primary)
- Nodemailer (fallback)

**Related**: `emailUtils.js`, `sendPaymentEmail.js`

---

### querySchedulesHelperV4.js

**Purpose**: Advanced schedule query with complex filtering.

**Main Function**: `querySchedulesHelperV4(filters)`

**Filters Supported**:
- Origin/destination
- Date range
- Passenger count
- Agent tier (for agent pricing)
- Trip type (one-way, round-trip)
- Time preferences
- Season

**Returns**: Formatted schedules with availability and pricing.

**Related**: `buildSearchCondition.js`, `formatSchedules.js`

---

### generatePdf.js

**Purpose**: Generate PDF tickets for bookings.

**Main Function**: `generateTicketPDF(booking)`

**Process**:
1. Load ticket template
2. Fill in booking details
3. Include passenger information
4. Add QR code
5. Generate PDF buffer
6. Return PDF for email attachment/download

**Related**: `sendInvoiceAndTicketEmail.js`

---

### updateAgentComission.js

**Purpose**: Calculate and save agent commission.

**Main Function**: `updateAgentComission(booking)`

**Commission Calculation**:
- Bronze: 5%
- Silver: 7%
- Gold: 10%
- Platinum: 12%

**Process**:
1. Get agent tier
2. Calculate commission amount
3. Create AgentCommission record
4. Update AgentMetrics

**Related**: `agentNetPrice.js`, `updateAgentMetrics.js`

---

### googleAttribution.js

**Purpose**: Capture Google Ads attribution data.

**Functions**:
- `captureAttributionData(req)` - Extract GA4 data from request
- `storeAttributionData(bookingId, data)` - Store in booking

**Data Captured**:
- gclid
- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term
- ga_client_id

**Related**: `ga4Tracker.js`, `bookingGoogleDataController.js`

---

### bullDelayExpiredEmail.js

**Purpose**: Queue expired booking emails with delay.

**Functions**:
- `queueExpiredBookingEmail(email, booking)` - Queue single email
- `bulkQueueExpiredBookingEmails(bookings)` - Queue multiple emails

**Delay**: Default 3 hours (configurable via `EXPIRED_EMAIL_DELAY` env var)

**Queue System**: Uses Bull (Redis-based queue) for reliable email delivery.

---

### bookingSummaryCron.js

**Purpose**: Send daily booking summary email.

**Main Function**: `scheduleDailySummary()`

**Summary Includes**:
- Total bookings
- Total revenue
- Breakdown by payment method
- Breakdown by route
- Agent performance

**Schedule**: Runs daily at configurable time.

---

### seatFixCron.js

**Purpose**: Detect and fix seat availability mismatches.

**Functions**:
- `scheduleSeatFixJob()` - Regular seat fix
- `scheduleSeatFixDeepScanJob()` - Deep scan for issues

**Fixes**:
- Reconcile booked_seats with actual bookings
- Fix negative available seats
- Sync BookingSeatAvailability with SeatAvailability

**Related**: `seatFixEventQueue.js`

---

### unpaidReminderCronJobs.js

**Purpose**: Send payment reminders for pending bookings.

**Main Function**: `sendUnpaidReminders()`

**Schedule**:
- 1 hour before expiration
- 24 hours before expiration
- 48 hours before expiration

**Related**: `sendPaymentEmail.js`

---

## Usage Examples

### Creating a Booking

```javascript
const { handleMainScheduleBooking } = require('./util/handleMainScheduleBooking');

const bookingData = {
  schedule_id: 1,
  booking_date: '2026-04-10',
  contact_name: 'John Doe',
  contact_email: 'john@example.com',
  contact_phone: '+628123456789',
  adult_passengers: 2,
  child_passengers: 1,
  infant_passengers: 0
};

try {
  const booking = await handleMainScheduleBooking(bookingData);
  console.log('Booking created:', booking);
} catch (error) {
  console.error('Booking failed:', error);
}
```

### Sending Email

```javascript
const { sendEmail } = require('./util/emailSender');

await sendEmail(
  'customer@example.com',
  'Your Booking Confirmation',
  '<h1>Booking Confirmed!</h1><p>Your ticket ID: GG-OW-12345</p>'
);
```

### Validating Seat Availability

```javascript
const { validateSeatAvailability } = require('./util/validateSeatAvailability');

const validation = await validateSeatAvailability(1, '2026-04-10', 3);

if (validation.valid) {
  console.log('Seats available:', validation.availableSeats);
} else {
  console.log('Validation failed:', validation.message);
}
```

### Calculating Ticket Total

```javascript
const { calculateTicketTotal } = require('./util/calculateTicketTotal');

const total = await calculateTicketTotal({
  schedule_id: 1,
  booking_date: '2026-04-10',
  adult_passengers: 2,
  child_passengers: 1,
  infant_passengers: 0,
  discount_code: 'SUMMER10'
});

console.log('Total:', total.total);
```

---

## Related Documentation

- [cron-jobs.md](cron-jobs.md) - Scheduled tasks detail
- [controllers.md](controllers.md) - Controllers using utils
- [models.md](models.md) - Database models
