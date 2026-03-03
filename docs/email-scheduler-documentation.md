# 📬 Custom Email Scheduler System (Node.js + Sequelize)

## 🧭 Overview
This system automates email delivery based on booking data.  
It allows you to define custom schedulers that send emails automatically after a specific delay, with filters for booking status, payment method, and recipient type (customer or agent).

---

## 🗂️ Database Tables

### 1. `CustomEmailSchedulers`
Stores each email template and sending rule.

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(255) | Name of the automation rule |
| subject | VARCHAR(255) | Email subject |
| body | MEDIUMTEXT | Email HTML body (supports placeholders) |
| delay_minutes | INT | Delay time in minutes after booking creation |
| is_active | BOOLEAN | Whether the scheduler is active |
| booking_status | ENUM | Booking filter (pending, paid, cancelled, etc.) |
| payment_method | ENUM | Filter for payment methods (midtrans, manual, etc.) |
| target_type | ENUM | customer / agent / all |
| send_once | BOOLEAN | Send only once per booking |
| repeatable | BOOLEAN | Allow repeated sending (e.g., every 3 hours) |
| repeat_interval_minutes | INT | Interval for repeated sending |
| template_type | ENUM | reminder / follow_up / custom / marketing |
| notes | TEXT | Optional note for this scheduler |
| last_sent_at | DATETIME | Last time this scheduler ran |
| created_at / updated_at | DATETIME | Timestamps for creation and update |

---

### 2. `EmailSendLogs`
Keeps track of every email that has been sent (prevents duplicates).

| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| scheduler_id | INT | Foreign key to `CustomEmailSchedulers.id` |
| booking_id | INT | Foreign key to `Bookings.id` |
| sent_to | VARCHAR(255) | Recipient email address |
| sent_at | DATETIME | Timestamp of when the email was sent |

---

## 🧩 Models

| File | Description |
|------|--------------|
| `models/CustomEmailSchedulers.js` | Main model for automated email schedulers |
| `models/EmailSendLog.js` | Log model for sent emails |
| `models/Booking.js` | Booking model used for dynamic placeholders |

---

## ⚙️ Controllers

### 📨 `controllers/customEmailSchedulerController.js`
Handles CRUD operations and automated email execution.

#### Endpoints

| Method | Route | Description |
|--------|--------|-------------|
| `GET` | `/api/custom-email` | Get all schedulers |
| `GET` | `/api/custom-email/:id` | Get a single scheduler |
| `POST` | `/api/custom-email` | Create a new scheduler |
| `PUT` | `/api/custom-email/:id` | Update a scheduler |
| `DELETE` | `/api/custom-email/:id` | Delete a scheduler |
| `POST` | `/api/custom-email/run` | Manually trigger cron job to send eligible emails |

#### Supported Placeholders in Email Body

| Placeholder | Description |
|--------------|-------------|
| `%booking_id%` | Booking ticket ID |
| `%customer_name%` | Customer full name |
| `%total_price%` | Total booking amount |
| `%schedule_name%` | Schedule name |
| `%date%` | Booking date |

---

### 🧪 `controllers/customEmailTestingController.js`
For manually sending test emails from the frontend.

| Method | Route | Description |
|--------|--------|-------------|
| `POST` | `/api/custom-email/test` | Send a test email based on scheduler_id and recipient_email |

#### Example Request Body
```json
{
  "scheduler_id": 2,
  "booking_id": "GG-RT-776001",
  "recipient_email": "testing@example.com"
}
```

**Note:** The test endpoint uses actual booking data to populate placeholders automatically.

---

### 📊 `controllers/emailSendLogController.js`
For viewing and managing email send history.

| Method | Route | Description |
|--------|--------|-------------|
| `GET` | `/api/email-logs` | Get all sent email logs |
| `GET` | `/api/email-logs/:id` | Get a specific log by ID |
| `POST` | `/api/email-logs` | Create log manually (testing only) |
| `DELETE` | `/api/email-logs/:id` | Delete a specific log |
| `DELETE` | `/api/email-logs` | Clear all logs (admin only) |

---

## 🔐 Middleware

### `middleware/customEmailValidation.js`
Validates input data before creating/updating schedulers.

#### Validation Functions

1. **validateSchedulerInput** - Validates required fields:
   - `name` (required)
   - `subject` (required)
   - `body` (required, HTML content)
   - `delay_minutes` (required, >= 0)
   - `booking_status` (must be: pending, paid, cancelled, abandoned, completed)
   - `target_type` (must be: customer, agent, all)

2. **validateScheduleExistence** - Checks if `schedule_ids` exist in database (optional field, supports array)

3. **validateSubScheduleExistence** - Checks if `subschedule_ids` exist in database (optional field, supports array)

4. **validateBookingExistence** - Validates booking exists for test emails (optional)

---

## 🔄 Routes Summary

### Custom Email Scheduler Routes (`/api/custom-email`)

```javascript
// CRUD Operations
GET    /api/custom-email          // Get all schedulers
GET    /api/custom-email/:id      // Get single scheduler
POST   /api/custom-email          // Create new scheduler
PUT    /api/custom-email/:id      // Update scheduler
DELETE /api/custom-email/:id      // Delete scheduler

// Execution & Testing
POST   /api/custom-email/run      // Trigger email job manually
POST   /api/custom-email/test     // Send test email
```

### Email Logs Routes (`/api/email-logs`)

```javascript
GET    /api/email-logs            // Get all logs
GET    /api/email-logs/:id        // Get specific log
POST   /api/email-logs            // Create log manually
DELETE /api/email-logs/:id        // Delete specific log
DELETE /api/email-logs             // Clear all logs
```

---

## 📝 API Request/Response Examples

### Create Scheduler

**Request:**
```json
POST /api/custom-email
Content-Type: application/json

{
  "name": "Payment Reminder - 1 Hour After",
  "subject": "Complete Your Booking Payment",
  "body": "<h1>Hello %customer_name%</h1><p>Your booking %booking_id% is waiting for payment. Total: Rp %total_price%</p>",
  "delay_minutes": 60,
  "is_active": true,
  "booking_status": "pending",
  "payment_method": null,
  "target_type": "customer",
  "send_once": true,
  "repeatable": false,
  "repeat_interval_minutes": null,
  "template_type": "reminder",
  "notes": "Send reminder 1 hour after booking created"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Custom email scheduler created",
  "data": {
    "id": 1,
    "name": "Payment Reminder - 1 Hour After",
    "subject": "Complete Your Booking Payment",
    "is_active": true,
    "created_at": "2025-10-20T10:00:00.000Z",
    ...
  }
}
```

### Get All Schedulers

**Request:**
```json
GET /api/custom-email
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "name": "Payment Reminder - 1 Hour After",
      "subject": "Complete Your Booking Payment",
      "is_active": true,
      "booking_status": "pending",
      "target_type": "customer",
      "delay_minutes": 60,
      "last_sent_at": "2025-10-20T09:00:00.000Z",
      "SendLogs": [
        {
          "id": 1,
          "booking_id": 123,
          "sent_to": "customer@example.com",
          "sent_at": "2025-10-20T09:00:00.000Z"
        }
      ]
    },
    ...
  ]
}
```

### Run Email Job

**Request:**
```json
POST /api/custom-email/run
```

**Response:**
```json
{
  "success": true,
  "message": "Email job completed successfully. 5 email(s) sent.",
  "totalEmailsSent": 5
}
```

### Send Test Email

**Request:**
```json
POST /api/custom-email/test
Content-Type: application/json

{
  "scheduler_id": 1,
  "booking_id": "GG-RT-776001",
  "recipient_email": "test@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "details": {
    "to": "test@example.com",
    "subject": "Complete Your Booking Payment",
    "booking_data_used": {
      "ticket_id": "GG-RT-776001",
      "customer_name": "John Doe",
      "gross_total": 750000
    }
  }
}
```

---

## ⚙️ How It Works

### Email Sending Flow

1. **Cron Job Triggers** (or manual via `/api/custom-email/run`)
2. **Fetch Active Schedulers** - Get all schedulers where `is_active = true`
3. **For Each Scheduler:**
   - Calculate target time: `NOW - delay_minutes`
   - Find bookings matching:
     - `booking_status` = scheduler's target status
     - `created_at` <= target time
     - `payment_method` (if specified)
4. **For Each Eligible Booking:**
   - Check if email already sent (via `EmailSendLog`)
   - Skip if already sent
   - Determine recipient based on `target_type`:
     - `customer` → `booking.customer_email`
     - `agent` → `booking.agent_email`
     - `all` → send to both
   - Replace placeholders in email body
   - Send email via `sendEmail()` utility
   - Create log entry in `EmailSendLog`
5. **Update Scheduler** - Set `last_sent_at` to current time
6. **Return Summary** - Total emails sent

### Placeholder Replacement Logic

The system replaces these placeholders in the email body:
- `%booking_id%` → `booking.ticket_id`
- `%customer_name%` → `booking.customer_name`
- `%total_price%` → `booking.gross_total`
- `%schedule_name%` → `booking.Schedule.name`
- `%date%` → `booking.booking_date`

---

## 🔧 Setup & Integration

### 1. Database Migration

Ensure these tables exist in your database:

```sql
CREATE TABLE CustomEmailSchedulers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  booking_status ENUM('pending', 'paid', 'cancelled', 'abandoned', 'completed') NOT NULL DEFAULT 'pending',
  payment_method ENUM('midtrans', 'paypal', 'manual', 'doku'),
  target_type ENUM('customer', 'agent', 'all') NOT NULL DEFAULT 'customer',
  send_once BOOLEAN NOT NULL DEFAULT TRUE,
  repeatable BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_interval_minutes INT,
  template_type ENUM('reminder', 'follow_up', 'custom', 'marketing') NOT NULL DEFAULT 'custom',
  notes TEXT,
  last_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE EmailSendLogs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scheduler_id INT UNSIGNED NOT NULL,
  booking_id INT UNSIGNED NOT NULL,
  sent_to VARCHAR(255) NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scheduler_id) REFERENCES CustomEmailSchedulers(id) ON DELETE CASCADE
);
```

### 2. Model Associations

Add to `models/index.js`:

```javascript
const CustomEmailSchedulers = require('./CustomEmailScheduler');
const EmailSendLog = require('./EmailSendLog');

// Setup associations
CustomEmailSchedulers.associate({ EmailSendLog });
EmailSendLog.associate({ CustomEmailSchedulers });
```

### 3. Route Registration

Add to your main `app.js` or `server.js`:

```javascript
const customEmailRoutes = require('./routes/customEmailSchedulerRoutes');
const emailLogRoutes = require('./routes/emailLogRoutes');

app.use('/api/custom-email', customEmailRoutes);
app.use('/api/email-logs', emailLogRoutes);
```

### 4. Cron Job Setup

Set up a cron job to run the email scheduler periodically:

```javascript
const cron = require('node-cron');
const axios = require('axios');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    await axios.post('http://localhost:3000/api/custom-email/run');
    console.log('✅ Email scheduler executed');
  } catch (error) {
    console.error('❌ Email scheduler failed:', error.message);
  }
});
```

---

## 🎯 Use Cases

### Example 1: Payment Reminder
- **Trigger:** 1 hour after booking created
- **Target:** Customers with pending bookings
- **Template:** "Please complete your payment for booking %booking_id%"

### Example 2: Follow-up Email
- **Trigger:** 24 hours after payment completed
- **Target:** Customers with paid bookings
- **Template:** "Thank you for booking! Here's your trip details..."

### Example 3: Agent Notification
- **Trigger:** Immediately after booking (0 minutes)
- **Target:** Agents
- **Template:** "New booking received: %booking_id% - %customer_name%"

### Example 4: Abandoned Cart Recovery
- **Trigger:** 3 hours after booking created
- **Target:** Customers with pending/abandoned bookings
- **Template:** "Your booking is waiting! Complete now and get 10% off"

---

## 🛠️ Troubleshooting

### Emails Not Sending

1. **Check scheduler is active:**
   - Ensure `is_active = true`

2. **Check delay timing:**
   - Email only sends if `booking.created_at <= NOW - delay_minutes`

3. **Check duplicate prevention:**
   - Email won't send if entry exists in `EmailSendLog`

4. **Check email configuration:**
   - Verify `utils/emailSender.js` is properly configured

5. **Check booking filters:**
   - Ensure booking matches `booking_status` and `payment_method` (if set)

### Missing Placeholders

- Ensure booking has related `Schedule` and `SubSchedule` loaded
- Check that booking fields exist (`customer_name`, `ticket_id`, etc.)

---

## 📦 Dependencies

- `sequelize` - ORM for database operations
- `express` - Web framework
- Email sending utility (`utils/emailSender.js`)
- Node.js cron scheduler (for automated execution)

---

## 🔒 Security Considerations

1. **Validation:** All inputs validated via middleware
2. **SQL Injection:** Protected by Sequelize ORM
3. **Email Limits:** Consider rate limiting on send operations
4. **Access Control:** Add authentication middleware for production
5. **Sensitive Data:** Avoid storing sensitive data in email templates

---

## 📚 Additional Notes

- **send_once vs repeatable:**
  - `send_once=true`: Email sent only once per booking
  - `repeatable=true`: Can send multiple times based on `repeat_interval_minutes` (not yet implemented in controller)

- **Payment Method Filtering:**
  - Set to `null` to send regardless of payment method
  - Set specific value to target only certain payment types

- **HTML Email Support:**
  - Full HTML support in `body` field
  - Use inline CSS for best email client compatibility

---

**Last Updated:** 2025-10-20
**Version:** 1.0