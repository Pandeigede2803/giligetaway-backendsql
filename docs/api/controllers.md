# Controllers - Business Logic

## Overview

Controllers berisi business logic untuk menangani request dari routes. Setiap controller file berfungsi sebagai handler untuk endpoint terkait.

## Detailed Documentation

Controller yang sudah didokumentasikan secara detail:

| Controller | Documentation | Status |
|------------|---------------|--------|
| **destinationController.js** | [destination.md](controllers/destination.md) | ✅ Complete |
| **boatController.js** | [boat.md](controllers/boat.md) | ✅ Complete |
| **userController.js** | [user.md](controllers/user.md) | ✅ Complete |
| **scheduleController.js** | [schedule.md](controllers/schedule.md) | ✅ Complete |

---

## Controller Files Index

| File | Description | Documentation |
|------|-------------|---------------|
| userController.js | User authentication & management | [user.md](controllers/user.md) ✅ |
| agentController.js | Agent management & login | ⏳ Pending |
| agentComission.js | Agent commission calculations | ⏳ Pending |
| agentMetricsController.js | Agent performance metrics | ⏳ Pending |
| boatController.js | Boat CRUD operations | [boat.md](controllers/boat.md) ✅ |
| destinationController.js | Destination CRUD operations | [destination.md](controllers/destination.md) ✅ |
| scheduleController.js | Schedule management | [schedule.md](controllers/schedule.md) ✅ |
| subScheduleController.js | Sub-schedule management | ⏳ Pending |
| subScheduleRelationController.js | Sub-schedule relationships | ⏳ Pending |
| bookingController.js | Main booking logic | ⏳ Pending |
| bookingAgentController.js | Agent-specific booking | ⏳ Pending |
| bookingSeatAvailabilityController.js | Seat availability for booking | ⏳ Pending |
| bulkBookingController.js | Bulk booking operations | ⏳ Pending |
| passengerController.js | Passenger management | ⏳ Pending |
| transactionController.js | Transaction management | ⏳ Pending |
| paymentController.js | Payment processing (Midtrans) | ⏳ Pending |
| dokuController.js | Payment processing (DOKU) | ⏳ Pending |
| emailController.js | Email operations | ⏳ Pending |
| emailSendLogController.js | Email logging | ⏳ Pending |
| customEmailSchedulerController.js | Custom email scheduling | ⏳ Pending |
| transportController.js | Transport service management | ⏳ Pending |
| transportBookingController.js | Transport booking logic | ⏳ Pending |
| transitController.js | Transit point management | ⏳ Pending |
| waitingListController.js | Waiting list logic | ⏳ Pending |
| discountController.js | Discount/promo logic | ⏳ Pending |
| metricsController.js | General metrics | ⏳ Pending |
| seatAvailabilityController.js | Seat availability management | ⏳ Pending |
| searchAgentScheduleV4.js | Advanced schedule search | ⏳ Pending |
| bookingGoogleDataController.js | Google Ads attribution | ⏳ Pending |
| telegramController.js | Telegram notifications | ⏳ Pending |
| agentCsvController.js | Agent CSV operations | ⏳ Pending |
| csvUploadController.js | CSV bulk upload | ⏳ Pending |

---

## Quick Reference (Pending Documentation)

### Core Controllers

#### bookingController.js
**Purpose**: Core booking logic for customer bookings.

**Key Functions**:
- `createBooking` - Create new booking with seat locking
- `getBooking` - Get booking details by ID
- `updateBooking` - Update booking details
- `cancelBooking` - Cancel booking and release seats
- `getBookings` - List bookings with filters
- `getBookingByTicketId` - Find booking by ticket ID
- `generateTicketPDF` - Generate PDF ticket
- `resendTicketEmail` - Resend ticket via email

**Related Utils**:
- `handleMainScheduleBooking.js`
- `handleSubScheduleBooking.js`
- `releaseSeats.js`
- `sendPaymentEmail.js`

---

#### bookingAgentController.js
**Purpose**: Booking logic specific to agents.

**Key Functions**:
- `agentLogin` - Agent authentication
- `createAgentBooking` - Create booking with agent commission
- `getAgentBooking` - Get booking by agent
- `getAgentBookings` - List agent's bookings
- `validateAgentBooking` - Validate booking before creation
- `searchSchedulesForAgent` - Search schedules with agent pricing

**Key Logic**:
- Applies agent tier-based pricing
- Calculates agent commission automatically
- Uses agent-specific seat locking
- Validates agent permissions

**Middleware Used**:
- `validateAgentBooking.js`
- `validateAgentRoundTripBooking.js`
- `calculateAgentComissionMiddleware.js`

---

#### paymentController.js
**Purpose**: Midtrans payment integration.

**Key Functions**:
- `createMidtransPayment` - Create Midtrans payment request
- `handleMidtransWebhook` - Handle Midtrans notification
- `checkPaymentStatus` - Check payment status from Midtrans
- `verifyPayment` - Verify payment and update booking

**Key Logic**:
- Creates payment order with Midtrans API
- Handles settlement notifications
- Updates booking status on successful payment
- Triggers ticket email on settlement

**Race Condition Handling**:
- See [race-condition-case.md](../../maintenance/race-condition-case.md) for details

**Related Utils**:
- `handleMidtransSettlement.js`
- `fetchMidtransPaymentStatus.js`

---

#### dokuController.js
**Purpose**: DOKU payment integration.

**Key Functions**:
- `createDokuPayment` - Create DOKU payment request
- `handleDokuWebhook` - Handle DOKU notification
- `verifyDokuPayment` - Verify DOKU payment signature
- `checkDokuPaymentStatus` - Check payment status from DOKU

**Key Logic**:
- Generates DOKU payment link
- Validates DOKU signature for security
- Handles payment status updates
- Supports multiple payment methods (bank transfer, e-wallet, etc.)

**Config**: `../../database/config.md#doku-payment-configuration`

---

#### seatAvailabilityController.js
**Purpose**: Manage seat availability.

**Key Functions**:
- `getSeatAvailability` - Check seat availability for schedule
- `getSeatAvailabilityDetails` - Get detailed seat info
- `fixAllSeatMismatches` - Fix seat count discrepancies
- `getAvailabilityBySchedule` - Get by schedule ID
- `getAvailabilityBySubSchedule` - Get by sub-schedule ID

**Key Logic**:
- Calculates available seats: `total_capacity - booked_seats`
- Handles public capacity (reduced capacity for public display)
- Validates seat availability before booking
- Fixes seat mismatches from cron jobs

**Related Utils**:
- `calculatePublicCapacity.js`
- `getCapacityReduction.js`
- `validateSeatAvailability.js`

---

#### waitingListController.js
**Purpose**: Handle waiting list for full bookings.

**Key Functions**:
- `joinWaitingList` - Add customer to waiting list
- `getWaitingListStatus` - Check waiting list position
- `cancelWaitingList` - Remove from waiting list
- `processWaitingList` - Process waiting list when seats available
- `notifyWaitingList` - Notify customers when seats available

**Key Logic**:
- Adds to waiting list when no seats available
- Notifies customers when seats become available
- Handles expiration (24 hours to confirm)
- Processes in FIFO order

**Related Utils**:
- `sendWaitingListEmail.js`
- `waitingListCron.js`

---

## Supporting Controllers

### agentController.js
**Purpose**: Agent management.

**Key Functions**:
- `createAgent` - Create new agent
- `getAgents` - List agents
- `getAgentById` - Get agent details
- `updateAgent` - Update agent info
- `deleteAgent` - Delete agent
- `updateAgentTier` - Update agent tier (affects commission)
- `getAgentBookings` - Get agent's bookings

**Agent Tiers**: bronze, silver, gold, platinum (affects commission rate)

---

### discountController.js
**Purpose**: Discount/promo code management.

**Key Functions**:
- `createDiscount` - Create new discount
- `getDiscounts` - List active discounts
- `getDiscountByCode` - Get discount details
- `validateDiscountCode` - Validate and calculate discount
- `applyDiscount` - Apply discount to booking
- `updateDiscount` - Update discount
- `deleteDiscount` - Delete discount

**Discount Types**:
- `percentage` - Percentage off total
- `fixed` - Fixed amount off

---

### metricsController.js
**Purpose**: General system metrics.

**Key Functions**:
- `getGeneralMetrics` - Overall system metrics
- `getDailyMetrics` - Daily performance metrics
- `getMonthlyMetrics` - Monthly performance metrics
- `getRevenueMetrics` - Revenue analytics
- `getOccupancyMetrics` - Seat occupancy rate

**Metrics Tracked**:
- Total bookings
- Total revenue
- Average booking value
- Seat occupancy rate
- Agent performance
- Payment method distribution

---

### emailController.js
**Purpose**: Email operations.

**Key Functions**:
- `sendEmail` - Send custom email
- `getEmailTemplates` - List available templates
- `sendTestEmail` - Send test email

**Related Utils**:
- `emailSender.js`
- `sendPaymentEmail.js`
- `sendInvoiceAndTicketEmail.js`

---

### customEmailSchedulerController.js
**Purpose**: Manage scheduled emails.

**Key Functions**:
- `createScheduledEmail` - Create new scheduled email
- `getScheduledEmails` - List scheduled emails
- `getScheduledEmail` - Get details
- `updateScheduledEmail` - Update configuration
- `deleteScheduledEmail` - Delete schedule
- `triggerScheduledEmail` - Trigger manually
- `toggleScheduledEmail` - Toggle active status

**Email Types**: payment, reminder, promotion, announcement

---

### csvUploadController.js
**Purpose**: Handle bulk booking from CSV upload.

**Key Functions**:
- `uploadCSV` - Upload and process CSV
- `getUploadStatus` - Check upload progress
- `getUploadResults` - Get processing results

**Process**:
1. Upload CSV file
2. Validate data format
3. Process each row as booking
4. Generate results report
5. Send summary email

---

## Specialized Controllers

### searchAgentScheduleV4.js
**Purpose**: Advanced schedule search with agent pricing.

**Key Functions**:
- `searchSchedulesV4` - Search with complex filters
- `calculateAgentPrice` - Apply agent pricing
- `filterByAvailability` - Filter by seat availability
- `sortScheduleResults` - Sort results

**Features**:
- Multi-route search
- Date range search
- Price range filters
- Agent tier pricing
- Transit point filtering

---

### bookingGoogleDataController.js
**Purpose**: Handle Google Ads attribution data.

**Key Functions**:
- `captureGoogleData` - Capture GA4 data on booking
- `getBookingGoogleData` - Retrieve attribution data
- `updateGoogleData` - Update attribution info

**Data Captured**:
- gclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term

**Related Utils**:
- `googleAttribution.js`
- `ga4Tracker.js`

---

### telegramController.js
**Purpose**: Telegram notifications for monitoring.

**Key Functions**:
- `sendTelegramAlert` - Send alert to Telegram
- `sendBookingAlert` - Send booking notification
- `sendErrorAlert` - Send error notification

**Use Cases**:
- Booking alerts
- Payment errors
- System errors
- Low seat alerts

**Related Utils**:
- `telegram.js`

---

## Controller Patterns

### Standard Create Pattern

```javascript
const createX = async (req, res) => {
  try {
    const data = req.body;
    // Validate input
    // Create record
    // Send response
    res.status(201).json({
      status: 'success',
      data: result,
      message: 'X created successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
```

### Transaction Pattern

```javascript
const createBooking = async (req, res) => {
  try {
    const result = await sequelize.transaction(async (t) => {
      // Multiple operations
      await booking.save({ transaction: t });
      await seat.update({ transaction: t });
      return result;
    });
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
```

### Error Handling Pattern

```javascript
try {
  // Business logic
} catch (error) {
  console.error('Error:', error);
  if (error.name === 'SequelizeValidationError') {
    return res.status(422).json({
      status: 'error',
      message: 'Validation failed',
      errors: error.errors
    });
  }
  return res.status(500).json({
    status: 'error',
    message: error.message
  });
}
```

---

## Related Documentation

- [routes.md](routes.md) - API endpoints
- [models.md](../database/models.md) - Database models
- [utils.md](utils.md) - Utility functions
- [middleware.md](middleware.md) - Request processing

---

**Last Updated**: 2026-04-06
