# Routes - API Endpoints

## Overview

Routes didefinisikan di folder `routes/` dan menghubungkan HTTP endpoints ke controller functions. Setiap route file berisi definisi endpoint untuk modul tertentu.

## Route Files Index

| File | Base Path | Description |
|------|-----------|-------------|
| agentRoutesApi.js | `/api/agent-access` | **Public** Agent API (no CORS restriction) |
| user.js | `/api/users` | User authentication & management |
| boat.js | `/api/boats` | Boat management |
| destination.js | `/api/destinations` | Destination management |
| schedule.js | `/api/schedules` | Schedule management |
| subScheduleRoutes.js | `/api/subschedule` | Sub-schedule management |
| subScheduleRelationsRoute.js | `/api/subschedules-relation` | Sub-schedule relationships |
| booking.js | `/api/bookings` | Booking management |
| bookingSeatAvailability.js | `/api/booking-seat` | Booking seat availability |
| passenger.js | `/api/passengers` | Passenger management |
| transactionRoutes.js | `/api/transactions` | Transaction management |
| payment.js | `/api/payment` | Payment operations |
| email.js | `/api/email` | Email operations |
| sendInvoice.js | - | Invoice sending |
| emailLogRoutes.js | `/api/email-logs` | Email logs |
| customEmailSchedulerRoutes.js | `/api/custom-email-scheduler` | Custom email scheduler |
| transport.js | `/api/transports` | Transport management |
| transportBookingRoutes.js | `/api/transport-bookings` | Transport booking |
| transit.js | `/api/transits` | Transit management |
| agent.js | `/api/agents` | Agent management |
| agentComission.js | `/api/agentsv2` | Agent commission (v2) |
| agentMetrics.js | `/api/agent-metrics` | Agent metrics |
| waitingListRoutes.js | `/api/waiting-list` | Waiting list management |
| discountRoutes.js | `/api/discount` | Discount/Promo management |
| metrics.js | `/api/metrics` | General metrics |
| SeatAvailability.js | `/api/seat` | Seat availability |
| csvUploadRoutes.js | `/api/upload-multiple-csv-booking` | CSV bulk upload |

---

## Detailed Routes

### Public Agent API (`/api/agent-access`)

**File**: `routes/agentRoutesApi.js`

**CORS**: Public (allowed from all domains)

**Authentication**: Some endpoints require agent auth

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/login` | Agent login | No |
| GET | `/schedules` | Search schedules (public) | No |
| POST | `/bookings` | Create booking | Yes |
| GET | `/bookings/:id` | Get booking details | Yes |
| GET | `/agents/:id/commission` | Get agent commission | Yes |
| POST | `/bookings/validate` | Validate booking before creation | Yes |
| GET | `/schedules/:id/seats` | Get available seats | Yes |

**Controller**: `bookingAgentController.js`, `agentController.js`

---

### Users (`/api/users`)

**File**: `routes/user.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| GET | `/` | Get all users | Yes |
| GET | `/:id` | Get user by ID | Yes |
| PUT | `/:id` | Update user | Yes |
| DELETE | `/:id` | Delete user | Yes |

**Controller**: `userController.js`

**Middleware**: `authenticate`

---

### Boats (`/api/boats`)

**File**: `routes/boat.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List all boats | No |
| GET | `/:id` | Get boat details | No |
| POST | `/` | Create boat (admin) | Yes |
| PUT | `/:id` | Update boat (admin) | Yes |
| DELETE | `/:id` | Delete boat (admin) | Yes |
| POST | `/:id/image` | Upload boat image | Yes |

**Controller**: `boatController.js`

**Middleware**: `authenticate`, `uploadImage`

---

### Destinations (`/api/destinations`)

**File**: `routes/destination.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List all destinations | No |
| GET | `/:id` | Get destination details | No |
| POST | `/` | Create destination (admin) | Yes |
| PUT | `/:id` | Update destination (admin) | Yes |
| DELETE | `/:id` | Delete destination (admin) | Yes |

**Controller**: `destinationController.js`

**Middleware**: `authenticate`

---

### Schedules (`/api/schedules`)

**File**: `routes/schedule.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List schedules with filters | No |
| GET | `/:id` | Get schedule details | No |
| POST | `/` | Create schedule (admin) | Yes |
| PUT | `/:id` | Update schedule (admin) | Yes |
| DELETE | `/:id` | Delete schedule (admin) | Yes |
| GET | `/:id/transits` | Get schedule transits | No |
| GET | `/:id/subschedules` | Get schedule sub-schedules | No |

**Query Parameters**:
- `from`: Destination from ID
- `to`: Destination to ID
- `date`: Travel date
- `passengers`: Number of passengers
- `type`: Trip type (one-way, round-trip)

**Controller**: `scheduleController.js`

**Middleware**: `authenticate` (for admin operations)

---

### Sub-Schedules (`/api/subschedule`)

**File**: `routes/subScheduleRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List sub-schedules | No |
| GET | `/:id` | Get sub-schedule details | No |
| POST | `/` | Create sub-schedule (admin) | Yes |
| PUT | `/:id` | Update sub-schedule (admin) | Yes |
| DELETE | `/:id` | Delete sub-schedule (admin) | Yes |
| GET | `/schedule/:scheduleId` | Get sub-schedules by schedule | No |

**Controller**: `subScheduleController.js`

**Middleware**: `authenticate` (for admin operations)

---

### Sub-Schedule Relations (`/api/subschedules-relation`)

**File**: `routes/subScheduleRelationsRoute.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List all relations | Yes |
| POST | `/` | Create relation | Yes |
| GET | `/:id` | Get relation details | Yes |
| DELETE | `/:id` | Delete relation | Yes |

**Controller**: `subScheduleRelationController.js`

**Middleware**: `authenticate`

---

### Bookings (`/api/bookings`)

**File**: `routes/booking.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/` | Create booking | No |
| GET | `/` | List bookings (with filters) | Yes |
| GET | `/:id` | Get booking details | Yes |
| PUT | `/:id` | Update booking | Yes |
| DELETE | `/:id` | Cancel booking | Yes |
| GET | `/:id/passengers` | Get booking passengers | Yes |
| GET | `/:id/ticket` | Generate ticket PDF | Yes |
| POST | `/:id/resend-email` | Resend ticket email | Yes |
| GET | `/ticket/:ticketId` | Find booking by ticket ID | No |

**Query Parameters** (for listing):
- `status`: Filter by payment status
- `date`: Filter by booking date
- `agent_id`: Filter by agent
- `from`: Filter by origin
- `to`: Filter by destination

**Controller**: `bookingController.js`, `bookingAgentController.js`

**Middleware**: `authenticate` (except create and find by ticket ID)

---

### Booking Seat Availability (`/api/booking-seat`)

**File**: `routes/bookingSeatAvailability.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | Check seat availability for booking | No |
| POST | `/` | Lock seats for booking | Yes |
| DELETE | `/:id` | Release locked seats | Yes |

**Controller**: `bookingSeatAvailabilityController.js`

**Middleware**: `authenticate` (except GET)

---

### Passengers (`/api/passengers`)

**File**: `routes/passenger.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List passengers | Yes |
| GET | `/:id` | Get passenger details | Yes |
| POST | `/` | Add passenger to booking | Yes |
| PUT | `/:id` | Update passenger | Yes |
| DELETE | `/:id` | Remove passenger | Yes |

**Controller**: `passengerController.js`

**Middleware**: `authenticate`, `passengerValidation`

---

### Transactions (`/api/transactions`)

**File**: `routes/transactionRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List transactions | Yes |
| GET | `/:id` | Get transaction details | Yes |
| GET | `/booking/:bookingId` | Get booking transactions | Yes |
| POST | `/:id/refund` | Initiate refund | Yes |

**Controller**: `transactionController.js`

**Middleware**: `authenticate`

---

### Payments (`/api/payment`)

**File**: `routes/payment.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/midtrans/create` | Create Midtrans payment | No |
| POST | `/midtrans/webhook` | Midtrans webhook handler | No |
| POST | `/doku/create` | Create DOKU payment | No |
| POST | `/doku/webhook` | DOKU webhook handler | No |
| GET | `/status/:orderId` | Check payment status | No |
| POST | `/verify` | Verify payment | Yes |

**Controller**: `paymentController.js`, `dokuController.js`

**Middleware**: None (webhooks must be public)

---

### Email (`/api/email`)

**File**: `routes/email.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/send` | Send email | Yes |
| GET | `/templates` | List email templates | Yes |
| POST | `/test` | Send test email | Yes |

**Controller**: `emailController.js`

**Middleware**: `authenticate`

---

### Email Logs (`/api/email-logs`)

**File**: `routes/emailLogRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List email logs | Yes |
| GET | `/:id` | Get email log details | Yes |
| GET | `/booking/:bookingId` | Get logs by booking | Yes |
| POST | `/:id/resend` | Resend failed email | Yes |

**Controller**: `emailSendLogController.js`

**Middleware**: `authenticate`

---

### Custom Email Scheduler (`/api/custom-email-scheduler`)

**File**: `routes/customEmailSchedulerRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List scheduled emails | Yes |
| POST | `/` | Create scheduled email | Yes |
| GET | `/:id` | Get scheduled email details | Yes |
| PUT | `/:id` | Update scheduled email | Yes |
| DELETE | `/:id` | Delete scheduled email | Yes |
| POST | `/:id/trigger` | Trigger scheduled email manually | Yes |
| POST | `/:id/toggle` | Toggle active status | Yes |

**Controller**: `customEmailSchedulerController.js`

**Middleware**: `authenticate`, `customEmailValidation`

---

### Transports (`/api/transports`)

**File**: `routes/transport.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List transports | No |
| GET | `/:id` | Get transport details | No |
| POST | `/` | Create transport (admin) | Yes |
| PUT | `/:id` | Update transport (admin) | Yes |
| DELETE | `/:id` | Delete transport (admin) | Yes |

**Controller**: `transportController.js`

**Middleware**: `authenticate` (for admin operations)

---

### Transport Bookings (`/api/transport-bookings`)

**File**: `routes/transportBookingRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/` | Create transport booking | Yes |
| GET | `/:id` | Get transport booking details | Yes |
| DELETE | `/:id` | Cancel transport booking | Yes |

**Controller**: `transportBookingController.js`

**Middleware**: `authenticate`

---

### Transits (`/api/transits`)

**File**: `routes/transit.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List transits | No |
| GET | `/:id` | Get transit details | No |
| POST | `/` | Create transit (admin) | Yes |
| PUT | `/:id` | Update transit (admin) | Yes |
| DELETE | `/:id` | Delete transit (admin) | Yes |
| GET | `/schedule/:scheduleId` | Get transits by schedule | No |

**Controller**: `transitController.js`

**Middleware**: `authenticate` (for admin operations)

---

### Agents (`/api/agents`)

**File**: `routes/agent.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List agents | Yes |
| GET | `/:id` | Get agent details | Yes |
| POST | `/` | Create agent (admin) | Yes |
| PUT | `/:id` | Update agent | Yes |
| DELETE | `/:id` | Delete agent | Yes |
| PUT | `/:id/tier` | Update agent tier | Yes |
| GET | `/:id/bookings` | Get agent bookings | Yes |

**Controller**: `agentController.js`

**Middleware**: `authenticate`, `validateAgent`

---

### Agent Commission (`/api/agentsv2`)

**File**: `routes/agentComission.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List agent commissions | Yes |
| GET | `/:id` | Get commission details | Yes |
| GET | `/agent/:agentId` | Get commissions by agent | Yes |
| POST | `/:id/mark-paid` | Mark commission as paid | Yes |

**Controller**: `agentComission.js`

**Middleware**: `authenticate`

---

### Agent Metrics (`/api/agent-metrics`)

**File**: `routes/agentMetrics.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/:id` | Get agent metrics | Yes |
| GET | `/:id/daily` | Get daily metrics | Yes |
| GET | `/:id/monthly` | Get monthly metrics | Yes |
| GET | `/:id/range` | Get metrics by date range | Yes |

**Query Parameters** (for range):
- `startDate`: Start date
- `endDate`: End date

**Controller**: `agentMetricsController.js`

**Middleware**: `authenticate`

---

### Waiting List (`/api/waiting-list`)

**File**: `routes/waitingtListRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/` | Join waiting list | No |
| GET | `/:id` | Get waiting list status | No |
| PUT | `/:id/cancel` | Cancel waiting list | No |
| GET | `/schedule/:scheduleId` | Get waiting list for schedule | Yes |

**Controller**: `waitingListController.js`

**Middleware**: `validateWaitingListCreateV2`

---

### Discounts (`/api/discount`)

**File**: `routes/discountRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List discounts | No |
| GET | `/:code` | Validate discount code | No |
| POST | `/` | Create discount (admin) | Yes |
| PUT | `/:id` | Update discount | Yes |
| DELETE | `/:id` | Delete discount | Yes |
| POST | `/:code/apply` | Apply discount to booking | No |

**Controller**: `discountController.js`

**Middleware**: `authenticate` (for admin operations), `validateDiscountQuery`

---

### Metrics (`/api/metrics`)

**File**: `routes/metrics.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | Get general metrics | Yes |
| GET | `/daily` | Get daily metrics | Yes |
| GET | `/monthly` | Get monthly metrics | Yes |
| GET | `/revenue` | Get revenue metrics | Yes |
| GET | `/occupancy` | Get seat occupancy metrics | Yes |

**Query Parameters**:
- `startDate`: Start date for range queries
- `endDate`: End date for range queries

**Controller**: `metricsController.js`

**Middleware**: `authenticate`

---

### Seat Availability (`/api/seat`)

**File**: `routes/SeatAvailability.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | Check seat availability | No |
| GET | `/:id` | Get seat availability details | No |
| GET | `/schedule/:scheduleId` | Get by schedule | No |
| GET | `/subschedule/:subscheduleId` | Get by sub-schedule | No |

**Query Parameters**:
- `schedule_id`: Schedule ID
- `subschedule_id`: Sub-schedule ID
- `date`: Travel date
- `passengers`: Number of passengers

**Controller**: `seatAvailabilityController.js`

**Middleware**: None (public endpoint)

---

### CSV Bulk Upload (`/api/upload-multiple-csv-booking`)

**File**: `routes/csvUploadRoutes.js`

**Endpoints**:

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/` | Upload CSV for bulk booking | Yes |
| GET | `/uploads/:uploadId` | Get upload status | Yes |
| GET | `/uploads/:uploadId/results` | Get upload results | Yes |

**Controller**: `csvUploadController.js`

**Middleware**: `authenticate`, `upload`

---

## Response Format

### Success Response

```json
{
  "status": "success",
  "data": { ... },
  "message": "Success message"
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Error message",
  "error": { ... }
}
```

### Pagination Response

```json
{
  "status": "success",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Authenticated but no permission |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Authentication

Most endpoints require JWT authentication in the `Authorization` header:

```
Authorization: Bearer <token>
```

**Public endpoints** (no auth required):
- `/api/agent-access` (most endpoints)
- `/api/schedules` (GET)
- `/api/seat` (GET)
- `/api/discount` (GET)
- `/api/waiting-list` (POST, GET own)
- `/api/payment/*/webhook`

---

## Rate Limiting

Some endpoints have rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/payment/*/create` | 10 requests | 15 minutes |
| `/api/bookings` | 20 requests | 15 minutes |
| `/api/agent-access/schedules` | 100 requests | 1 hour |

See [middleware.md](middleware.md) for rate limiter details.

---

## Related Documentation

- [controllers.md](controllers.md) - Business logic implementation
- [middleware.md](middleware.md) - Request/response processing
- [app-js.md](app-js.md) - Route registration
