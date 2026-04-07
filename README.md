# Giligetaway Backend - MySQL Express

Backend REST API untuk sistem booking fastboat Giligetaway. Dibangun dengan Node.js, Express, dan MySQL (Sequelize ORM).

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)

## Overview

Backend ini menangani seluruh logika bisnis untuk:
- Booking tiket fastboat (single trip & round trip)
- Manajemen jadwal dan kapal
- Manajemen agent dan komisi
- Pembayaran (Midtrans, DOKU)
- Notifikasi email
- Cron jobs untuk maintenance
- WebSocket untuk real-time updates
- Google Analytics attribution

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **ORM**: Sequelize
- **Authentication**: JWT
- **Payment**: Midtrans Client, DOKU
- **Email**: Nodemailer, Resend
- **Scheduling**: node-cron, Bull (Queue)
- **File Upload**: Multer, Formidable
- **Real-time**: WebSocket (ws)
- **PDF Generation**: Puppeteer
- **Other**: bcryptjs, jsonwebtoken, dotenv, cors

## Environment Variables

```env
# Server
NODE_ENV=development|production
PORT=8000

# Database (Development)
DEV_DB_NAME=giligetaway_dev
DEV_DB_USER=root
DEV_DB_PASSWORD=password
DEV_DB_HOST=localhost
DEV_DB_PORT=3306
DEV_DB_DIALECT=mysql

# Database (Production)
DB_NAME=giligetaway_prod
DB_USER=prod_user
DB_PASSWORD=prod_password
DB_HOST=prod_host
DB_PORT=3306
DB_DIALECT=mysql

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_ORIGIN_1=http://localhost:3000
CORS_ORIGIN_2=https://giligetaway.com
CORS_ORIGIN_3=https://api.giligetaway.com
CORS_ORIGIN_4=https://staging.giligetaway.com

# Payment - Midtrans
MIDTRANS_SERVER_KEY=your_server_key
MIDTRANS_CLIENT_KEY=your_client_key
MIDTRANS_API_BASE_URL=https://api.midtrans.com/v2

# Payment - DOKU
DOKU_MERCHANT_ID=your_merchant_id
DOKU_SHARED_KEY=your_shared_key
DOKU_SECRET_KEY=your_secret_key
DOKU_API_URL=https://api-sandbox.doku.com

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
RESEND_API_KEY=your_resend_api_key

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Telegram (Error Notifications)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# ImageKit (Image Upload)
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=your_url_endpoint

# Google Analytics
GA4_MEASUREMENT_ID=your_measurement_id
```

## Project Structure

```
giligetaway-backendsql/
├── app.js                          # Main application entry point
├── package.json                    # Dependencies & scripts
├── .env                            # Environment variables
├── .gitignore
├── config/                         # Configuration files
│   ├── database.js                # Sequelize database connection
│   ├── doku.js                    # DOKU payment configuration
│   └── websocket.js               # WebSocket server setup
├── models/                         # Sequelize models
│   ├── index.js                   # Model associations
│   ├── user.js                    # User model
│   ├── agent.js                   # Agent model
│   ├── boat.js                    # Boat model
│   ├── destination.js             # Destination model
│   ├── schedule.js                # Schedule model
│   ├── SubSchedule.js             # Sub-schedule model
│   ├── SubscheduleRelation.js     # Sub-schedule relations
│   ├── booking.js                 # Booking model
│   ├── passenger.js               # Passenger model
│   ├── Transaction.js             # Transaction model
│   ├── SeatAvailability.js        # Seat availability model
│   ├── BookingSeatAvailability.js # Booking-seat junction
│   ├── Transport.js               # Transport model
│   ├── TransportBooking.js        # Transport booking model
│   ├── Transit.js                 # Transit model
│   ├── AgentCommission.js         # Agent commission model
│   ├── AgentMetrics.js            # Agent metrics model
│   ├── WaitingList.js             # Waiting list model
│   ├── discount.js                # Discount/Promo model
│   ├── CustomEmailScheduler.js    # Custom email scheduler
│   ├── EmailSendLog.js            # Email send log
│   ├── BulkBookingUpload.js       # Bulk booking upload
│   └── BulkBookingResult.js       # Bulk booking result
├── controllers/                    # Route controllers
│   ├── userController.js
│   ├── agentController.js
│   ├── agentComission.js
│   ├── agentMetricsController.js
│   ├── boatController.js
│   ├── destinationController.js
│   ├── scheduleController.js
│   ├── subScheduleController.js
│   ├── subScheduleRelationController.js
│   ├── bookingController.js
│   ├── bookingAgentController.js
│   ├── bookingSeatAvailabilityController.js
│   ├── bulkBookingController.js
│   ├── passengerController.js
│   ├── transactionController.js
│   ├── paymentController.js
│   ├── dokuController.js
│   ├── emailController.js
│   ├── emailSendLogController.js
│   ├── customEmailSchedulerController.js
│   ├── transportController.js
│   ├── transportBookingController.js
│   ├── transitController.js
│   ├── waitingListController.js
│   ├── discountController.js
│   ├── metricsController.js
│   ├── searchAgentScheduleV4.js
│   ├── bookingGoogleDataController.js
│   ├── telegramController.js
│   ├── agentCsvController.js
│   └── csvUploadController.js
├── routes/                         # Express routes
│   ├── index.js
│   ├── user.js
│   ├── agent.js
│   ├── agentRoutesApi.js           # Public agent API
│   ├── agentComission.js
│   ├── agentMetrics.js
│   ├── boat.js
│   ├── destination.js
│   ├── schedule.js
│   ├── subScheduleRoutes.js
│   ├── subScheduleRelationsRoute.js
│   ├── booking.js
│   ├── bookingSeatAvailability.js
│   ├── passenger.js
│   ├── transactionRoutes.js
│   ├── payment.js
│   ├── email.js
│   ├── sendInvoice.js
│   ├── emailLogRoutes.js
│   ├── customEmailSchedulerRoutes.js
│   ├── transport.js
│   ├── transportBookingRoutes.js
│   ├── transit.js
│   ├── waitingListRoutes.js
│   ├── discountRoutes.js
│   ├── metrics.js
│   ├── SeatAvailability.js
│   └── csvUploadRoutes.js
├── middleware/                     # Custom middleware
│   ├── authenticate.js            # JWT authentication
│   ├── rateLimiter.js             # Rate limiting
│   ├── upload.js                  # File upload middleware
│   ├── uploadImage.js             # Image upload
│   ├── checkAgentExist.js
│   ├── checkUniqueEmail.js
│   ├── passengerValidation.js
│   ├── paymentValidation.js
│   ├── validateAgent.js
│   ├── validateSeatAvailability.js
│   ├── seatRelation.js
│   ├── validateTrips.js
│   ├── validateDuplicateScheduleInput.js
│   ├── validateScheduleForBookingChange.js
│   ├── validateScheduleAndSubschedule.js
│   ├── validateAgentBooking.js
│   ├── validateBookingcreation.js
│   ├── validateAgentRoundTripBooking.js
│   ├── validateAgentDiscount.js
│   ├── validateAgentSearchDiscount.js
│   ├── validateDiscountQuery.js
│   ├── validateWaitingListCreateV2.js
│   ├── customEmailValidation.js
│   ├── validateKey.js
│   ├── checkSeatAvailabilityForUpdate.js
│   ├── assignAgentSeatNumbers.js
│   ├── calculateAgentComissionMiddleware.js
│   ├── calculateAgentCommissionMulti.js
│   └── boostSeatMiddleware.js
├── util/                           # Utility functions
│   ├── cronJobs.js                # Expired bookings cleanup
│   ├── bookingSummaryCron.js      # Daily booking summary
│   ├── seatFixCron.js             # Seat fix jobs
│   ├── waitingListCron.js         # Waiting list processing
│   ├── unpaidReminderCronJobs.js  # Unpaid payment reminders
│   ├── promoOpsChainCron.js       # Promo operations
│   ├── seatCapacityCron.js        # Seat capacity monitoring
│   ├── telegram.js                # Telegram notifications
│   ├── emailUtils.js              # Email utilities
│   ├── emailSender.js             # Email sender
│   ├── sendPaymentEmail.js        # Payment email templates
│   ├── sendInvoiceAndTicketEmail.js
│   ├── sendWaitingListEmail.js
│   ├── sendPaymentEmailApiAgent.js
│   ├── googleAttribution.js       # Google Ads attribution
│   ├── ga4Tracker.js              # GA4 tracking
│   ├── mapTransitDetails.js
│   ├── mapJourneySteps.js
│   ├── mapJourneyStepsRoundTrip.js
│   ├── formatScheduleResponse.js
│   ├── formatSchedules.js
│   ├── formatUtilsSimple.js
│   ├── formattedData2.js
│   ├── dateUtils.js
│   ├── calculateDepartureAndArrivalTime.js
│   ├── scheduleUtils.js
│   ├── getExchangeRate.js
│   ├── bookingUtil.js
│   ├── transactionUtils.js
│   ├── seatAvailabilityUtils.js
│   ├── validateSeatAvailability.js
│   ├── validateSeatAvailabilitySingleTrip.js
│   ├── validateSeatAvailabilitySingleTripSafe.js
│   ├── handleMainScheduleBooking.js
│   ├── handleSubScheduleBooking.js
│   ├── handleMainScheduleBookingWithLock.js
│   ├── handleSubScheduleBookingWithLock.js
│   ├── handleMultipleSeatsBooking.js
│   ├── handleDynamicSeatAvailability.js
│   ├── releaseSeats.js
│   ├── releaseMainScheduleSeats.js
│   ├── releaseSubScheduleSeats.js
│   ├── checkSeatNumber.js
│   ├── seatUtils.js
│   ├── calculatePublicCapacity.js
│   ├── getCapacityReduction.js
│   ├── seatCapacityAlert.js
│   ├── getSeatAvailabilityIncludes.js
│   ├── findSeatQuery.js
│   ├── buildSearchCondition.js
│   ├── buildRoute.js
│   ├── querySchedulesHelper.js
│   ├── querySchedulesHelperV4.js
│   ├── fetchMetricsBookingDate.js
│   ├── fetchMidtransPaymentStatus.js
│   ├── handleMidtransSettlement.js
│   ├── updateAgentMetrics.js
│   ├── updateAgentComission.js
│   ├── autoAssignSeats.js
│   ├── calculateTicketTotal.js
│   ├── recalculateBookingFinancials.js
│   ├── syncBookingTotals.js
│   ├── agentNetPrice.js
│   ├── paymentAdjustment.js
│   ├── generatePdf.js
│   ├── isException.js
│   ├── isExceptionV2.js
│   ├── sumTotalPassengers.js
│   ├── bsaUpdate.js
│   ├── customEmailJob.js
│   ├── seatFixEventQueue.js
│   ├── cronFrequencySeatDuplicates.js
│   └── waitingListNotify.js
├── docs/                           # Documentation
│   ├── app-js.md                  # app.js documentation
│   ├── models.md                  # Models documentation
│   ├── controllers.md             # Controllers documentation
│   ├── routes.md                  # Routes documentation
│   ├── utils.md                   # Utilities documentation
│   ├── middleware.md              # Middleware documentation
│   ├── config.md                  # Configuration documentation
│   ├── cron-jobs.md               # Cron jobs documentation
│   └── race-condition-case.md     # Race condition case study
└── node_modules/                  # Dependencies
```

## Documentation

Untuk dokumentasi detail, lihat file di folder `docs/`:

- **[app-js.md](docs/app-js.md)** - Main application setup, middleware, routes, and server initialization
- **[models.md](docs/models.md)** - All Sequelize models and their relationships
- **[controllers.md](docs/controllers.md)** - Business logic for each endpoint
- **[routes.md](docs/routes.md)** - API endpoint definitions
- **[utils.md](docs/utils.md)** - Utility functions and helpers
- **[middleware.md](docs/middleware.md)** - Custom middleware functions
- **[config.md](docs/config.md)** - Configuration files
- **[cron-jobs.md](docs/cron-jobs.md)** - Scheduled tasks and background jobs
- **[race-condition-case.md](docs/race-condition-case.md)** - Case study on race condition handling

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd giligetaway-backendsql
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up database
```bash
# Create database
mysql -u root -p
CREATE DATABASE giligetaway_dev;
```

5. Run the server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/users/login` - User login
- `POST /api/users/register` - User registration

### Agent API (Public)
- `GET /api/agent-access/schedules` - Search schedules (public access)
- `POST /api/agent-access/bookings` - Create booking (public access)
- `GET /api/agent-access/agents/:id/commission` - Get agent commission
- See [routes/agentRoutesApi.js](routes/agentRoutesApi.js) for full endpoints

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details
- `GET /api/bookings` - List bookings
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Schedules
- `GET /api/schedules` - List schedules
- `GET /api/schedules/:id` - Get schedule details
- `POST /api/schedules` - Create schedule (admin)
- `PUT /api/schedules/:id` - Update schedule (admin)

### Payments
- `POST /api/payment/midtrans/create` - Create Midtrans payment
- `POST /api/payment/doku/create` - Create DOKU payment
- `POST /api/payment/midtrans/webhook` - Midtrans webhook
- `POST /api/payment/doku/webhook` - DOKU webhook

### Seat Availability
- `GET /api/seat` - Check seat availability
- `GET /api/booking-seat` - Check booking seat availability

### Agents
- `GET /api/agents` - List agents
- `GET /api/agents/:id` - Get agent details
- `GET /api/agent-metrics/:id` - Get agent metrics

### Waiting List
- `POST /api/waiting-list` - Join waiting list
- `GET /api/waiting-list/:id` - Get waiting list status

### Email Scheduler
- `POST /api/custom-email-scheduler` - Create custom email schedule
- `GET /api/custom-email-scheduler` - List scheduled emails
- `GET /api/email-logs` - View email logs

For complete API documentation, see [routes.md](docs/routes.md).

## Development

### Running Tests
```bash
npm test
```

### Database Migrations
```bash
# Run migrations (if using Sequelize CLI)
npx sequelize-cli db:migrate
```

### Linting
```bash
npm run lint
```

## Important Notes

1. **Timezone**: System uses Asia/Makassar (+08:00) timezone
2. **Payment Handling**: Race conditions are handled as documented in [race-condition-case.md](docs/race-condition-case.md)
3. **Seat Availability**: Multi-level seat locking and validation prevent overbooking
4. **Agent Commission**: Calculated automatically based on agent tier and booking value
5. **Email Notifications**: Sent via Resend and Nodemailer with proper error handling
6. **WebSocket**: Real-time seat availability updates for clients

## License

ISC

## Support

For issues and questions, contact the development team or create an issue in the repository.
