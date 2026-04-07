# Cron Jobs - Scheduled Tasks

## Overview

Cron jobs adalah tugas terjadwal yang berjalan secara otomatis pada interval tertentu. Backend ini menggunakan `node-cron` library untuk menjalankan berbagai maintenance dan background tasks.

## Active Cron Jobs

| Cron Job | File | Schedule | Purpose |
|----------|------|----------|---------|
| `handleExpiredBookings` | util/cronJobs.js | Every 5 min (configurable) | Cancel expired bookings, release seats |
| `scheduleDailySummary` | util/bookingSummaryCron.js | Daily | Send daily booking summary |
| `scheduleSeatFixJob` | util/seatFixCron.js | Hourly | Fix seat availability mismatches |
| `scheduleSeatFixDeepScanJob` | util/seatFixCron.js | Daily at 2 AM | Deep scan for seat issues |
| `scheduleWaitingListCron` | util/waitingListCron.js | Every 10 min | Process waiting list |
| `sendUnpaidReminders` | util/unpaidReminderCronJobs.js | Every hour | Send payment reminders |
| `schedulePromoOpsChainCron` | util/promoOpsChainCron.js | Daily | Promo operations |
| `scheduleSeatCapacityCron` | util/seatCapacityCron.js | Every 30 min | Monitor seat capacity |
| `scheduleSeatCapacityCron70` | util/seatCapacityCron.js | Every 15 min | Monitor seat capacity at 70% |

---

## Cron Job Details

### 1. Handle Expired Bookings

**File**: `util/cronJobs.js`

**Schedule**: Every 5 minutes (configurable via `CRON_FREQUENCY` env var)

**Purpose**: Cancel bookings that have passed their payment expiration time and release the seats back to availability.

**Process**:

1. **Find Expired Bookings**
   - Query for bookings where `payment_status = 'pending'` and `expiration_time < now`
   - Process in batches of 100 to handle large volumes
   - Order by email and creation date for consistent email handling

2. **Release Seats**
   - Use `releaseSeats()` function to return seats to availability
   - Handle both main schedule and sub-schedule bookings
   - Update `SeatAvailability` records within a transaction

3. **Update Booking Status**
   - Set `payment_status` to 'expired'
   - Set `abandoned` flag to `true`
   - Update transaction status to 'cancelled'

4. **Send Email Notifications**
   - Queue expired booking notification email
   - Apply email rules to prevent duplicates:
     - One Way (GG-OW): Always send email
     - Round Trip (GG-RT): Only send for odd numbers
     - Skip if another booking from same email within 10 minutes

5. **Error Handling**
   - Log errors to console
   - Send Telegram notification for critical errors
   - Continue processing next booking on error

**Email Delay**: Emails are queued with a 3-hour delay (configurable via `EXPIRED_EMAIL_DELAY`)

**Environment Variables**:
```env
CRON_FREQUENCY=*/5 * * * *
EXPIRED_STATUS=expired
EXPIRED_EMAIL_DELAY=10800000  # 3 hours in milliseconds
```

**Related**:
- `util/releaseSeats.js`
- `util/bullDelayExpiredEmail.js`
- `util/sendPaymentEmail.js`

---

### 2. Daily Booking Summary

**File**: `util/bookingSummaryCron.js`

**Schedule**: Daily at 9:00 AM

**Purpose**: Send a comprehensive daily summary of all bookings to admin.

**Summary Includes**:
- Total number of bookings
- Total revenue
- Breakdown by payment status
- Breakdown by route
- Breakdown by payment method
- Agent performance summary
- Cancelled/expired bookings count

**Recipients**: Configured in environment variables or admin email list

**Process**:
1. Query bookings from previous day (00:00 - 23:59)
2. Calculate metrics and aggregations
3. Format HTML email
4. Send via email sender
5. Log success/failure

**Related**:
- `util/emailSender.js`

---

### 3. Seat Fix Jobs

**File**: `util/seatFixCron.js`

**Schedule**:
- Regular fix: Every hour
- Deep scan: Daily at 2:00 AM

**Purpose**: Detect and fix seat availability discrepancies.

**Regular Fix Job**:
1. Finds schedules where `booked_seats` doesn't match actual bookings
2. Recalculates `available_seats` based on actual bookings
3. Fixes negative available seats
4. Syncs `BookingSeatAvailability` with `SeatAvailability`

**Deep Scan Job**:
1. Comprehensive scan of all seat availability records
2. Reconciles all bookings with seat availability
3. Fixes orphaned booking-seat relationships
4. Generates detailed report

**Issues Fixed**:
- Negative available seats
- Booked seats > total capacity
- Mismatched booking counts
- Orphaned BookingSeatAvailability records
- Missing seat availability for bookings

**Related**:
- `util/seatFixEventQueue.js`
- `controllers/seatAvailabilityController.js`

---

### 4. Waiting List Processing

**File**: `util/waitingListCron.js`

**Schedule**: Every 10 minutes

**Purpose**: Process waiting list entries when seats become available.

**Process**:
1. **Find Available Seats**
   - Check schedules/sub-schedules with newly available seats
   - Compare against waiting list entries

2. **Process in FIFO Order**
   - Get waiting list entries sorted by creation time
   - Notify customers in order

3. **Send Notifications**
   - Email customer that seats are available
   - Include booking link with 24-hour expiration
   - Set waiting list status to 'notified'

4. **Handle Confirmations**
   - If customer confirms within 24 hours: Create booking
   - If customer doesn't confirm: Move to next person

5. **Cleanup**
   - Remove expired waiting list entries
   - Update seat counts after processing

**Email Template**: Waiting list notification with booking link

**Related**:
- `util/sendWaitingListEmail.js`
- `util/waitingListNotify.js`
- `models/WaitingList.js`

---

### 5. Payment Reminders

**File**: `util/unpaidReminderCronJobs.js`

**Schedule**: Every hour

**Purpose**: Send payment reminders for pending bookings.

**Reminder Schedule**:
- 48 hours before expiration: First reminder
- 24 hours before expiration: Second reminder
- 1 hour before expiration: Final reminder

**Process**:
1. Find pending bookings
2. Calculate time until expiration
3. Check if reminder should be sent (not already sent)
4. Queue reminder email
5. Log reminder sent

**Email Content**:
- Booking details
- Payment link
- Time remaining
- Expiration warning

**Related**:
- `util/sendPaymentEmail.js`
- `util/bullDelayExpiredEmail.js`

---

### 6. Promo Operations

**File**: `util/promoOpsChainCron.js`

**Schedule**: Daily at 6:00 AM

**Purpose**: Execute promotional operations and chain tasks.

**Operations**:
1. Activate scheduled promos
2. Deactivate expired promos
3. Update promo usage counts
4. Generate promo performance reports
5. Send promo summary to marketing

**Chain Tasks**:
- Check promo validity
- Apply automatic discounts
- Update featured schedules
- Send targeted emails for expiring promos

**Related**:
- `models/discount.js`
- `controllers/discountController.js`

---

### 7. Seat Capacity Monitoring

**File**: `util/seatCapacityCron.js`

**Schedule**:
- Regular monitoring: Every 30 minutes
- 70% alert: Every 15 minutes

**Purpose**: Monitor seat capacity and send alerts for low availability.

**Regular Monitoring**:
- Tracks seat availability across all schedules
- Updates capacity metrics
- Logs capacity trends

**70% Alert**:
- Sends alert when schedule reaches 70% capacity
- Triggers marketing notifications
- Updates display priority (full schedules shown first)

**Alert Levels**:
- 70% capacity: Info alert
- 90% capacity: Warning alert
- 95% capacity: Critical alert
- 100% capacity: Sold out

**Alert Channels**:
- Telegram bot
- Email to operations team
- Dashboard notifications

**Related**:
- `util/seatCapacityAlert.js`
- `util/telegram.js`

---

## Cron Job Management

### Starting/Stopping Cron Jobs

All cron jobs are registered in `app.js` after successful database connection:

```javascript
sequelize.sync()
  .then(() => {
    server.listen(PORT, () => {
      // Start all cron jobs
      cronJobs.handleExpiredBookings();
      bookingSummaryCron.scheduleDailySummary();
      seatFixCron.scheduleSeatFixJob();
      seatFixCron.scheduleSeatFixDeepScanJob();
      waitingListCron.scheduleWaitingListCron();
      unpaidReminderCronJobs.sendUnpaidReminders();
      promoOpsChainCron.schedulePromoOpsChainCron();
      scheduleSeatCapacityCron();
      scheduleSeatCapacityCron70();
    });
  });
```

### Customizing Schedules

Modify schedules via environment variables:

```env
# Expired bookings check (default: every 5 min)
CRON_FREQUENCY=*/5 * * * *

# Waiting list processing (default: every 10 min)
WAITING_LIST_CRON=*/10 * * * *

# Seat capacity check (default: every 30 min)
SEAT_CAPACITY_CRON=*/30 * * * *

# Payment reminders (default: every hour)
REMINDER_CRON=0 * * * *
```

### Adding New Cron Jobs

1. Create cron job file in `util/`:

```javascript
// util/myCustomCron.js
const cron = require("node-cron");

function scheduleMyCustomCron() {
  cron.schedule("0 0 * * *", async () => { // Daily at midnight
    try {
      console.log("Running custom cron job...");
      // Your logic here
    } catch (error) {
      console.error("Custom cron error:", error);
    }
  });

  console.log("✅ MyCustomCron registered");
}

module.exports = { scheduleMyCustomCron };
```

2. Register in `app.js`:

```javascript
const { scheduleMyCustomCron } = require('./util/myCustomCron');

// Inside server.listen callback
scheduleMyCustomCron();
```

---

## Cron Job Best Practices

### 1. Error Handling

Always wrap cron job logic in try-catch blocks:

```javascript
cron.schedule("*/5 * * * *", async () => {
  try {
    // Cron job logic
  } catch (error) {
    console.error("Cron job error:", error);
    // Send alert
    sendTelegramMessage(`Cron error: ${error.message}`);
  }
});
```

### 2. Transaction Safety

For database operations, use transactions:

```javascript
await sequelize.transaction(async (t) => {
  await booking.save({ transaction: t });
  await seat.update({ transaction: t });
});
```

### 3. Batch Processing

For large datasets, process in batches:

```javascript
const batchSize = 100;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const records = await Model.findAll({
    limit: batchSize,
    offset: offset
  });

  if (records.length === 0) {
    hasMore = false;
    break;
  }

  // Process records
  for (const record of records) {
    await processRecord(record);
  }

  offset += batchSize;
}
```

### 4. Idempotency

Make cron jobs idempotent (safe to run multiple times):

```javascript
// Add processed flag
if (booking.processed_by_cron) {
  return; // Skip already processed
}

// Process booking
await processBooking(booking);

// Mark as processed
booking.processed_by_cron = true;
await booking.save();
```

### 5. Logging

Log cron job execution:

```javascript
console.log(`[${new Date().toISOString()}] Cron job started`);
// ... process
console.log(`[${new Date().toISOString()}] Cron job completed, processed ${count} records`);
```

### 6. Monitoring

Monitor cron job health:

```javascript
// Track last execution
const cronStatus = {
  lastRun: null,
  lastSuccess: null,
  errorCount: 0
};

cron.schedule("*/5 * * * *", async () => {
  cronStatus.lastRun = new Date();

  try {
    // Process
    cronStatus.lastSuccess = new Date();
    cronStatus.errorCount = 0;
  } catch (error) {
    cronStatus.errorCount++;

    if (cronStatus.errorCount > 3) {
      sendAlert(`Cron failed ${cronStatus.errorCount} times in a row`);
    }
  }
});
```

---

## Cron Job Monitoring Dashboard

Consider creating a monitoring endpoint:

```javascript
// routes/cron-status.js
router.get('/cron-status', authenticate, async (req, res) => {
  const status = {
    expiredBookings: {
      lastRun: getCronLastRun('expiredBookings'),
      status: 'running'
    },
    dailySummary: {
      lastRun: getCronLastRun('dailySummary'),
      status: 'completed'
    },
    // ... other cron jobs
  };

  res.json({ status });
});
```

---

## Related Documentation

- [app-js.md](app-js.md) - Cron job registration
- [utils.md](utils.md) - Cron job implementation details
- [models.md](models.md) - Database models used by cron jobs
- [race-condition-case.md](race-condition-case.md) - Race condition handling in cron jobs
