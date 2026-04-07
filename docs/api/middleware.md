# Middleware - Request/Response Processing

## Overview

Folder `middleware/` berisi custom middleware functions yang digunakan untuk memproses request dan response sebelum mencapai controller. Middleware ini menangani authentication, validation, file upload, rate limiting, dan lain-lain.

## Middleware Files Index

### Authentication & Authorization

| File | Description |
|------|-------------|
| authenticate.js | JWT authentication middleware |
| validateKey.js | API key validation |
| checkAgentExist.js | Verify agent exists |
| validateAgent.js | Validate agent data |

### Validation

| File | Description |
|------|-------------|
| passengerValidation.js | Validate passenger data |
| paymentValidation.js | Validate payment data |
| validateSeatAvailability.js | Validate seat availability |
| validateTrips.js | Validate trip data |
| validateAgentBooking.js | Validate agent booking |
| validateAgentRoundTripBooking.js | Validate agent round trip |
| validateBookingcreation.js | Validate booking creation |
| validateAgentDiscount.js | Validate agent discount |
| validateAgentSearchDiscount.js | Validate agent discount search |
| validateDiscountQuery.js | Validate discount query |
| validateWaitingListCreateV2.js | Validate waiting list creation |
| validateScheduleForBookingChange.js | Validate schedule for booking change |
| validateScheduleAndSubschedule.js | Validate schedule/sub-schedule relationship |
| validateDuplicateScheduleInput.js | Validate duplicate schedule |
| customEmailValidation.js | Validate custom email config |
| checkSeatAvailabilityForUpdate.js | Check seats before update |
| checkUniqueEmail.js | Check email uniqueness |

### File Upload

| File | Description |
|------|-------------|
| upload.js | General file upload with Multer |
| uploadImage.js | Image upload configuration |

### Rate Limiting

| File | Description |
|------|-------------|
| rateLimiter.js | Rate limiting middleware |

### Business Logic Middleware

| File | Description |
|------|-------------|
| calculateAgentComissionMiddleware.js | Calculate agent commission |
| calculateAgentCommissionMulti.js | Calculate commission for multiple bookings |
| assignAgentSeatNumbers.js | Assign seat numbers for agent bookings |
| seatRelation.js | Handle seat relationships |
| boostSeatMiddleware.js | Boost seat capacity (special cases) |

---

## Middleware Details

### authenticate.js

**Purpose**: JWT authentication for protected routes.

**How It Works**:
1. Extracts token from `Authorization` header
2. Verifies token with JWT_SECRET
3. Finds user by decoded ID
4. Attaches user to `req.user`
5. Proceeds to next middleware or controller

**Usage**:
```javascript
const authenticate = require('../middleware/authenticate');

router.get('/profile', authenticate, userController.getProfile);
```

**Error Responses**:
- `401` - No token provided
- `401` - Invalid token
- `401` - User not found

---

### rateLimiter.js

**Purpose**: Prevent API abuse by limiting request rate.

**Configuration**:
```javascript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.'
});
```

**Usage**:
```javascript
const rateLimiter = require('../middleware/rateLimiter');

router.post('/book', rateLimiter, bookingController.createBooking);
```

**Custom Rate Limits**:
- Booking creation: 20 requests per 15 minutes
- Payment creation: 10 requests per 15 minutes
- Schedule search: 100 requests per hour

---

### passengerValidation.js

**Purpose**: Validate passenger data before booking.

**Validation Rules**:
- Name: Required, min 2 characters
- Age: Required, must be positive
- Type: Must be 'adult', 'child', or 'infant'
- Passport ID: Required for international routes
- Nationality: Required for international routes

**Usage**:
```javascript
const passengerValidation = require('../middleware/passengerValidation');

router.post('/bookings', passengerValidation, bookingController.createBooking);
```

---

### paymentValidation.js

**Purpose**: Validate payment data.

**Validation Rules**:
- Payment method: Required, must be valid method
- Amount: Required, must be positive
- Currency: Required, must be supported currency
- For DOKU: Validates payment channel
- For Midtrans: Validates payment type

**Usage**:
```javascript
const paymentValidation = require('../middleware/paymentValidation');

router.post('/payment/create', paymentValidation, paymentController.createPayment);
```

---

### validateSeatAvailability.js

**Purpose**: Validate seat availability before booking.

**Checks**:
- Schedule or sub-schedule exists
- Date is within validity period
- Enough available seats
- Seats not already locked

**Usage**:
```javascript
const validateSeatAvailability = require('../middleware/validateSeatAvailability');

router.post('/bookings', validateSeatAvailability, bookingController.createBooking);
```

---

### validateAgentBooking.js

**Purpose**: Validate agent-specific booking data.

**Additional Checks**:
- Agent exists and is active
- Agent has permission for the route
- Agent tier pricing applied
- Agent balance sufficient (if applicable)

**Usage**:
```javascript
const validateAgentBooking = require('../middleware/validateAgentBooking');

router.post('/agent/bookings', validateAgentBooking, bookingAgentController.createBooking);
```

---

### validateAgentRoundTripBooking.js

**Purpose**: Validate round trip bookings for agents.

**Additional Checks**:
- Both legs have availability
- Dates are valid (return date >= departure date)
- Round trip discount applies
- Agent commission for round trip calculated

**Usage**:
```javascript
const validateAgentRoundTripBooking = require('../middleware/validateAgentRoundTripBooking');

router.post('/agent/bookings/round-trip', validateAgentRoundTripBooking, bookingAgentController.createRoundTripBooking);
```

---

### calculateAgentComissionMiddleware.js

**Purpose**: Calculate agent commission before saving booking.

**Commission Tiers**:
- Bronze: 5%
- Silver: 7%
- Gold: 10%
- Platinum: 12%

**Usage**:
```javascript
const calculateAgentComission = require('../middleware/calculateAgentComissionMiddleware');

router.post('/agent/bookings', calculateAgentComission, bookingAgentController.createBooking);
```

---

### upload.js

**Purpose**: Handle file uploads with Multer.

**Configuration**:
```javascript
const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});
```

**Usage**:
```javascript
const upload = require('../middleware/upload');

router.post('/upload-csv', upload.single('file'), csvUploadController.uploadCSV);
router.post('/upload-multiple', upload.array('files', 5), controller.uploadMultiple);
```

---

### uploadImage.js

**Purpose**: Handle image uploads with ImageKit integration.

**Features**:
- Uploads to ImageKit CDN
- Generates optimized thumbnails
- Returns image URL
- Validates image format and size

**Usage**:
```javascript
const uploadImage = require('../middleware/uploadImage');

router.post('/boats/:id/image', uploadImage, boatController.uploadBoatImage);
```

---

### checkUniqueEmail.js

**Purpose**: Ensure email uniqueness for user/agent registration.

**Checks**:
- Email not already in use
- Email format valid
- Email not in blacklist

**Usage**:
```javascript
const checkUniqueEmail = require('../middleware/checkUniqueEmail');

router.post('/register', checkUniqueEmail, userController.register);
router.post('/agents', checkUniqueEmail, agentController.createAgent);
```

---

### validateWaitingListCreateV2.js

**Purpose**: Validate waiting list entry creation.

**Checks**:
- Schedule/sub-schedule exists
- No seats available (waiting list only for full bookings)
- Contact information valid
- Passenger count valid
- Not already in waiting list

**Usage**:
```javascript
const validateWaitingListCreateV2 = require('../middleware/validateWaitingListCreateV2');

router.post('/waiting-list', validateWaitingListCreateV2, waitingListController.joinWaitingList);
```

---

### validateDiscountQuery.js

**Purpose**: Validate discount code queries.

**Checks**:
- Discount code exists
- Discount is active
- Discount is within valid date range
- Discount is applicable to route/agent
- Usage limit not exceeded

**Usage**:
```javascript
const validateDiscountQuery = require('../middleware/validateDiscountQuery');

router.post('/discount/apply', validateDiscountQuery, discountController.applyDiscount);
```

---

### assignAgentSeatNumbers.js

**Purpose**: Automatically assign seat numbers for agent bookings.

**Logic**:
- Gets available seats
- Assigns in order (front to back)
- Marks seats as booked
- Returns seat assignments

**Usage**:
```javascript
const assignAgentSeatNumbers = require('../middleware/assignAgentSeatNumbers');

router.post('/agent/bookings', assignAgentSeatNumbers, bookingAgentController.createBooking);
```

---

### customEmailValidation.js

**Purpose**: Validate custom email scheduler configuration.

**Validation Rules**:
- Name: Required
- Email type: Required, must be valid type
- Template: Required, must exist
- Cron expression: Valid cron format
- Recipients: Valid email addresses
- Filters: Valid JSON

**Usage**:
```javascript
const customEmailValidation = require('../middleware/customEmailValidation');

router.post('/custom-email-scheduler', customEmailValidation, customEmailSchedulerController.create);
```

---

### seatRelation.js

**Purpose**: Handle seat relationship validation and management.

**Functions**:
- Validate seat relationships for bookings
- Check seat conflicts
- Manage seat assignments
- Handle seat transfers

**Usage**:
```javascript
const seatRelation = require('../middleware/seatRelation');

router.put('/bookings/:id/change-seats', seatRelation, bookingController.changeSeats);
```

---

### validateTrips.js

**Purpose**: Validate trip-related data.

**Checks**:
- Origin and destination valid
- Route exists
- Schedule valid for date
- Transit points valid (if applicable)

**Usage**:
```javascript
const validateTrips = require('../middleware/validateTrips');

router.post('/schedules', validateTrips, scheduleController.createSchedule);
```

---

### validateScheduleForBookingChange.js

**Purpose**: Validate schedule changes for existing bookings.

**Checks**:
- New schedule exists
- Seats available on new schedule
- Time difference acceptable
- Price difference calculated
- Agent commission recalculated

**Usage**:
```javascript
const validateScheduleForBookingChange = require('../middleware/validateScheduleForBookingChange');

router.put('/bookings/:id/change-schedule', validateScheduleForBookingChange, bookingController.changeSchedule);
```

---

### validateDuplicateScheduleInput.js

**Purpose**: Prevent duplicate schedule creation.

**Checks**:
- No identical schedule exists
- No overlapping time on same route
- Schedule not already created

**Usage**:
```javascript
const validateDuplicateScheduleInput = require('../middleware/validateDuplicateScheduleInput');

router.post('/schedules', validateDuplicateScheduleInput, scheduleController.createSchedule);
```

---

### validateScheduleAndSubschedule.js

**Purpose**: Validate relationship between schedule and sub-schedule.

**Checks**:
- Sub-schedule belongs to schedule
- Dates are valid
- No conflicts with other sub-schedules

**Usage**:
```javascript
const validateScheduleAndSubschedule = require('../middleware/validateScheduleAndSubschedule');

router.post('/subschedules', validateScheduleAndSubschedule, subScheduleController.create);
```

---

### checkSeatAvailabilityForUpdate.js

**Purpose**: Check seat availability before updating booking.

**Checks**:
- Current seats still available
- New seats available (if changing)
- No conflicts with other bookings

**Usage**:
```javascript
const checkSeatAvailabilityForUpdate = require('../middleware/checkSeatAvailabilityForUpdate');

router.put('/bookings/:id', checkSeatAvailabilityForUpdate, bookingController.updateBooking);
```

---

### checkAgentExist.js

**Purpose**: Verify agent exists and is active.

**Checks**:
- Agent ID valid
- Agent exists in database
- Agent account is active
- Agent has required permissions

**Usage**:
```javascript
const checkAgentExist = require('../middleware/checkAgentExist');

router.get('/agents/:id', checkAgentExist, agentController.getAgent);
```

---

### validateAgent.js

**Purpose**: Validate agent data for creation/update.

**Validation Rules**:
- Name: Required, min 2 characters
- Email: Required, valid format
- Phone: Required, valid format
- Tier: Must be valid tier (bronze, silver, gold, platinum)
- Commission rate: Must be between 0-100%

**Usage**:
```javascript
const validateAgent = require('../middleware/validateAgent');

router.post('/agents', validateAgent, agentController.createAgent);
router.put('/agents/:id', validateAgent, agentController.updateAgent);
```

---

### validateAgentDiscount.js

**Purpose**: Validate agent-specific discount requests.

**Checks**:
- Agent has discount permissions
- Discount code valid for agent
- Discount applies to selected route
- Discount not expired

**Usage**:
```javascript
const validateAgentDiscount = require('../middleware/validateAgentDiscount');

router.post('/agent/bookings/apply-discount', validateAgentDiscount, bookingAgentController.applyDiscount);
```

---

### validateAgentSearchDiscount.js

**Purpose**: Validate discount search for agents.

**Checks**:
- Agent has search permissions
- Search parameters valid
- Results filtered for agent tier

**Usage**:
```javascript
const validateAgentSearchDiscount = require('../middleware/validateAgentSearchDiscount');

router.get('/agent/discounts', validateAgentSearchDiscount, discountController.searchForAgent);
```

---

### boostSeatMiddleware.js

**Purpose**: Handle special seat capacity boosting (admin only).

**Use Cases**:
- Temporary capacity increase
- Overbook for special situations
- Emergency seat allocation

**Usage**:
```javascript
const boostSeatMiddleware = require('../middleware/boostSeatMiddleware');

router.post('/admin/boost-seats', boostSeatMiddleware, adminController.boostSeats);
```

---

### calculateAgentCommissionMulti.js

**Purpose**: Calculate commission for multiple bookings (bulk).

**Logic**:
- Processes multiple bookings
- Applies tier-based rates
- Summarizes total commission
- Creates commission records

**Usage**:
```javascript
const calculateAgentCommissionMulti = require('../middleware/calculateAgentCommissionMulti');

router.post('/bulk-commission', calculateAgentCommissionMulti, agentController.processBulkCommission);
```

---

## Middleware Order

### Standard Middleware Stack

```
Request
  ↓
Body Parser (app.js)
  ↓
Custom CORS (app.js)
  ↓
Rate Limiter (per route)
  ↓
Authentication (per route)
  ↓
Validation Middleware (per route)
  ↓
Business Logic Middleware (per route)
  ↓
Controller
  ↓
Response
```

### Example: Booking Creation

```javascript
router.post('/bookings',
  rateLimiter,                              // 1. Rate limiting
  passengerValidation,                       // 2. Validate passenger data
  validateSeatAvailability,                  // 3. Check seats available
  bookingController.createBooking            // 4. Create booking
);
```

---

## Creating Custom Middleware

### Basic Structure

```javascript
// middleware/myCustomMiddleware.js

const myCustomMiddleware = (req, res, next) => {
  // Do something with req
  console.log('Processing request:', req.path);

  // Do something with res
  res.setHeader('X-Custom-Header', 'value');

  // Call next() to proceed
  next();
};

module.exports = myCustomMiddleware;
```

### Async Middleware

```javascript
// middleware/asyncMiddleware.js

const asyncMiddleware = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next))
    .catch(next);
};

// Usage
const myAsyncHandler = asyncMiddleware(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
});
```

### Middleware with Options

```javascript
// middleware/validateWithConfig.js

const validateWithConfig = (options) => {
  return (req, res, next) => {
    // Use options
    const { requiredFields } = options;

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          error: `Field ${field} is required`
        });
      }
    }

    next();
  };
};

// Usage
router.post('/bookings',
  validateWithConfig({ requiredFields: ['name', 'email'] }),
  controller.createBooking
);
```

---

## Error Handling in Middleware

```javascript
const myMiddleware = (req, res, next) => {
  try {
    // Middleware logic
    if (someErrorCondition) {
      const error = new Error('Something went wrong');
      error.statusCode = 400;
      throw error;
    }
    next();
  } catch (error) {
    next(error); // Pass to error handler
  }
};

// Error handler middleware
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message
  });
});
```

---

## Related Documentation

- [app-js.md](app-js.md) - Middleware registration
- [routes.md](routes.md) - Middleware usage in routes
- [controllers.md](controllers.md) - Controller handlers
