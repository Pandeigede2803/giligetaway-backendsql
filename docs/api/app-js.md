# app.js - Main Application Entry Point

## Overview

`app.js` adalah titik masuk utama (entry point) untuk aplikasi backend Giligetaway. File ini menginisialisasi Express server, mengatur middleware, mendefinisikan routes, dan memulai cron jobs.

## Dependencies

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');
```

## Configuration

### Environment Setup

```javascript
dotenv.config();
console.log('NODE_ENV:', process.env.NODE_ENV);
```

Membaca variabel environment dari file `.env`.

### CORS Options

```javascript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedDomains = [
      process.env.CORS_ORIGIN_1,
      process.env.CORS_ORIGIN,
      process.env.CORS_ORIGIN_2,
      process.env.CORS_ORIGIN_3,
      process.env.CORS_ORIGIN_4
    ];

    if (allowedDomains.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
};
```

### Custom CORS Middleware

Middleware kustom menangani dua skenario CORS:

1. **Public Agent API** (`/api/agent-access`): Diizinkan dari semua domain
2. **Protected Routes**: Hanya diizinkan dari domain yang terdaftar

```javascript
app.use((req, res, next) => {
  if (req.path.startsWith('/api/agent-access')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    return next();
  }
  cors(corsOptions)(req, res, next);
});
```

## Middleware Stack

### Body Parser

```javascript
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
```

Mengaktifkan parsing JSON dan URL-encoded request bodies.

## Routes

### Import Route Files

```javascript
const agentRoutesApi = require('./routes/agentRoutesApi');
const userRoutes = require('./routes/user');
const boatRoutes = require('./routes/boat');
const destinationRoutes = require('./routes/destination');
const scheduleRoutes = require('./routes/schedule');
const transportRoutes = require('./routes/transport');
const transitRoutes = require('./routes/transit');
const agentRoutes = require('./routes/agent');
const bookingRoutes = require('./routes/booking');
const passengerRoutes = require('./routes/passenger');
const transportBookingRoutes = require('./routes/transportBookingRoutes');
const subscheduleRoutes = require('./routes/subScheduleRoutes');
const agentMetricsRouter = require('./routes/agentMetrics');
const seatAvailabilityRoutes = require('./routes/SeatAvailability');
const bookingSeatAvailability = require('./routes/bookingSeatAvailability');
const transactionRoutes = require('./routes/transactionRoutes');
const emailRoutes = require('./routes/email');
const paymentRoutes = require('./routes/payment');
const agentComission = require('./routes/agentComission');
const metrics = require('./routes/metrics');
const csvUploadRoutes = require('./routes/csvUploadRoutes');
const discountRoutes = require('./routes/discountRoutes');
const subSchedulesRelationRoutes = require('./routes/subScheduleRelationsRoute');
const waitingListRoutes = require('./routes/waitingtListRoutes');
const customEmailSchedulerRoutes = require('./routes/customEmailSchedulerRoutes');
const emailLogRoutes = require('./routes/emailLogRoutes');
```

### Route Definitions

| Base Path | Route File | Description |
|-----------|------------|-------------|
| `/api/agent-access` | agentRoutesApi.js | **Public** Agent API (no CORS restriction) |
| `/api/users` | user.js | User management |
| `/api/boats` | boat.js | Boat management |
| `/api/destinations` | destination.js | Destination management |
| `/api/schedules` | schedule.js | Schedule management |
| `/api/transports` | transport.js | Transport management |
| `/api/transits` | transit.js | Transit management |
| `/api/agents` | agent.js | Agent management |
| `/api/agentsv2` | agentComission.js | Agent commission (v2) |
| `/api/bookings` | booking.js | Booking management |
| `/api/passengers` | passenger.js | Passenger management |
| `/api/transport-bookings` | transportBookingRoutes.js | Transport booking |
| `/api/subschedule` | subscheduleRoutes.js | Sub-schedule management |
| `/api/agent-metrics` | agentMetrics.js | Agent metrics |
| `/api/seat` | SeatAvailability.js | Seat availability |
| `/api/booking-seat` | bookingSeatAvailability.js | Booking seat availability |
| `/api/transactions` | transactionRoutes.js | Transaction management |
| `/api/email` | email.js | Email operations |
| `/api/payment` | payment.js | Payment operations |
| `/api/metrics` | metrics.js | General metrics |
| `/api/upload-multiple-csv-booking` | csvUploadRoutes.js | CSV bulk upload |
| `/api/discount` | discountRoutes.js | Discount/Promo management |
| `/api/subschedules-relation` | subScheduleRelationsRoute.js | Sub-schedule relations |
| `/api/waiting-list` | waitingListRoutes.js | Waiting list management |
| `/api/custom-email-scheduler` | customEmailSchedulerRoutes.js | Custom email scheduler |
| `/api/email-logs` | emailLogRoutes.js | Email logs |

## Root Endpoint

```javascript
app.get('/', (req, res) => {
  res.send('<h1>this is giligetaway my sql express backend</h1>');
});
```

## Error Handling

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);

  const message = `
❗️<b>Express Error</b>
<pre>${err.message}</pre>
📍<code>${req.method} ${req.originalUrl}</code>
🕒 ${new Date().toLocaleString()}
  `.trim();

  sendTelegramMessage(message);

  res.status(500).json({
    status: 'error',
    message: err.message,
  });
});
```

Error handler global yang:
1. Mencatat error ke console
2. Mengirim notifikasi ke Telegram
3. Mengembalikan error response ke client

## WebSocket Server

```javascript
const { initWebSocketServer } = require('./config/websocket');
const server = http.createServer(app);
initWebSocketServer(server);
```

WebSocket server diinisialisasi untuk real-time updates (seat availability, booking status, dll).

## Cron Jobs

Semua cron jobs dijadwalkan setelah koneksi database berhasil:

```javascript
sequelize.sync()
  .then(() => {
    console.log('Connected to the database');
    server.listen(PORT, () => {
      console.log(`YAY Server is running on port ${PORT}`);

      // Cron jobs
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
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
```

### Active Cron Jobs

| Cron Job | File | Frequency | Purpose |
|----------|------|-----------|---------|
| `handleExpiredBookings` | util/cronJobs.js | Every 5 min (configurable) | Cancel expired bookings, release seats, send notifications |
| `scheduleDailySummary` | util/bookingSummaryCron.js | Daily | Send daily booking summary |
| `scheduleSeatFixJob` | util/seatFixCron.js | Scheduled | Fix seat availability mismatches |
| `scheduleSeatFixDeepScanJob` | util/seatFixCron.js | Scheduled | Deep scan for seat issues |
| `scheduleWaitingListCron` | util/waitingListCron.js | Scheduled | Process waiting list |
| `sendUnpaidReminders` | util/unpaidReminderCronJobs.js | Scheduled | Send payment reminders |
| `schedulePromoOpsChainCron` | util/promoOpsChainCron.js | Scheduled | Promo operations |
| `scheduleSeatCapacityCron` | util/seatCapacityCron.js | Scheduled | Monitor seat capacity |
| `scheduleSeatCapacityCron70` | util/seatCapacityCron.js | Scheduled | Monitor seat capacity at 70% |

Lihat [cron-jobs.md](cron-jobs.md) untuk detail lengkap setiap cron job.

## Server Configuration

```javascript
const PORT = process.env.PORT || 8000;
```

Server berjalan pada port yang ditentukan oleh environment variable `PORT`, default 8000.

## Database Connection

Database menggunakan Sequelize ORM dengan konfigasi dari `config/database.js`.

Koneksi database diinisialisasi dengan `sequelize.sync()` yang:
1. Membuat koneksi ke database
2. Mensinkronisasi models dengan database tables
3. Membuat table jika belum ada (development mode)

## Important Notes

### Public Agent API

Route `/api/agent-access` adalah **public API** yang:
- Diizinkan dari semua domain (CORS: `*`)
- Digunakan oleh agent untuk akses schedule dan booking
- Tidak memerlukan auth token untuk beberapa endpoint

### Error Notifications

Semua error yang tidak tertangkap di level route akan:
1. Dilog ke console
2. Dikirim ke Telegram untuk monitoring
3. Direspons ke client dengan status 500

### Cron Job Initialization

Cron jobs hanya dijalankan setelah:
1. Database berhasil terkoneksi
2. Server berhasil listen pada port

### Transaction Handling

Untuk operasi yang memerlukan atomicity (multiple database updates):
- Gunakan `sequelize.transaction()` di controller/util
- Pastikan seat release dan booking update dalam satu transaksi

## Related Documentation

- [config.md](config.md) - Configuration files
- [routes.md](routes.md) - Route definitions
- [middleware.md](middleware.md) - Middleware functions
- [cron-jobs.md](cron-jobs.md) - Scheduled tasks
