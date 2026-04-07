# Models - Sequelize Database Models

## Overview

Backend ini menggunakan Sequelize ORM untuk berinteraksi dengan database MySQL. Semua models didefinisikan di folder `models/` dan di-export dari `models/index.js`.

## Model Index

File `models/index.js` berfungsi sebagai:
1. Central export untuk semua models
2. Definisi associations (relationships)
3. Sequelize instance export

## List of Models

| Model | File | Description |
|-------|------|-------------|
| `User` | user.js | User/admin accounts |
| `Agent` | agent.js | Travel agent accounts |
| `Boat` | boat.js | Fastboat vessels |
| `Destination` | destination.js | Ports/destinations |
| `Schedule` | schedule.js | Main schedule definitions |
| `SubSchedule` | SubSchedule.js | Sub-schedule (specific dates) |
| `SubScheduleRelation` | SubscheduleRelation.js | Relationships between sub-schedules |
| `Booking` | booking.js | Booking records |
| `Passenger` | passenger.js | Passenger details |
| `Transaction` | Transaction.js | Payment transactions |
| `SeatAvailability` | SeatAvailability.js | Available seats per schedule/date |
| `BookingSeatAvailability` | BookingSeatAvailability.js | Junction table for booking-seat |
| `Transport` | transport.js | Transport services |
| `TransportBooking` | TransportBooking.js | Transport booking records |
| `Transit` | transit.js | Transit stops |
| `AgentCommission` | AgentCommission.js | Agent commission records |
| `AgentMetrics` | agentMetrics.js | Agent performance metrics |
| `WaitingList` | WaitingList.js | Waiting list for full bookings |
| `Discount` | discount.js | Discount/promo codes |
| `EmailSendLog` | EmailSendLog.js | Email delivery logs |
| `CustomEmailScheduler` | CustomEmailScheduler.js | Scheduled email configurations |
| `BulkBookingUpload` | BulkBookingUpload.js | Bulk upload records |
| `BulkBookingResult` | BulkBookingResult.js | Bulk booking results |

---

## Model Details

### User

**Purpose**: Admin user accounts untuk backend management.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `username` (STRING, NOT NULL)
- `email` (STRING, NOT NULL, UNIQUE)
- `password` (STRING, NOT NULL) - Hashed with bcrypt
- `role` (STRING, NOT NULL) - 'admin', 'superadmin'
- `created_at`, `updated_at` (DATE)

**Associations**:
- `Schedule.hasMany(User, { foreignKey: 'user_id' })`

---

### Agent

**Purpose**: Travel agent accounts yang melakukan booking.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `name` (STRING, NOT NULL)
- `email` (STRING, NOT NULL, UNIQUE)
- `phone` (STRING)
- `password` (STRING, NOT NULL) - Hashed
- `tier` (STRING) - Agent level (bronze, silver, gold, platinum)
- `commission_rate` (DECIMAL) - Commission percentage
- `is_active` (BOOLEAN) - Account status
- `created_at`, `updated_at` (DATE)

**Associations**:
- `Booking.hasMany(Agent, { foreignKey: 'agent_id', as: 'agent' })`
- `AgentCommission.hasMany(Agent, { foreignKey: 'agent_id' })`
- `AgentMetrics.hasMany(Agent, { foreignKey: 'agent_id' })`

---

### Boat

**Purpose**: Data kapal fastboat.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `name` (STRING, NOT NULL)
- `capacity` (INTEGER) - Total passenger capacity
- `image` (STRING) - Boat image URL
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `Schedule.hasMany(Boat, { foreignKey: 'boat_id', as: 'Boat' })`

---

### Destination

**Purpose**: Pelabuhan/lokasi tujuan.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `name` (STRING, NOT NULL)
- `location` (STRING)
- `code` (STRING) - Destination code
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `Schedule.belongsTo(Destination, { as: 'FromDestination', foreignKey: 'destination_from_id' })`
- `Schedule.belongsTo(Destination, { as: 'ToDestination', foreignKey: 'destination_to_id' })`

---

### Schedule

**Purpose**: Jadwal utama rute perjalanan.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `boat_id` (INTEGER, FK to Boats)
- `destination_from_id` (INTEGER, FK to Destinations)
- `destination_to_id` (INTEGER, FK to Destinations)
- `user_id` (INTEGER, FK to Users) - Creator
- `validity_start` (DATE, NOT NULL) - Valid from date
- `validity_end` (DATE, NOT NULL) - Valid to date
- `check_in_time` (TIME, NOT NULL)
- `departure_time` (TIME, NOT NULL)
- `arrival_time` (TIME, NOT NULL)
- `journey_time` (TIME, NOT NULL)
- `low_season_price` (DECIMAL, NOT NULL)
- `high_season_price` (DECIMAL, NOT NULL)
- `peak_season_price` (DECIMAL, NOT NULL)
- `return_low_season_price` (DECIMAL, NOT NULL)
- `return_high_season_price` (DECIMAL, NOT NULL)
- `return_peak_season_price` (DECIMAL, NOT NULL)
- `availability` (BOOLEAN, DEFAULT true)
- `route_image` (STRING)
- `schedule_type` (STRING)
- `days_of_week` (TINYINT.UNSIGNED) - Bitmask (0-127)
- `trip_type` (ENUM: 'mid', 'short', 'long', 'intermediate')
- `note` (STRING)
- `created_at`, `updated_at` (DATE)

**Days of Week Bitmask**:
- Bit 0: Sunday
- Bit 1: Monday
- ...
- Bit 6: Saturday

**Associations**:
- `belongsTo(Boat, { as: 'Boat' })`
- `belongsTo(Destination, { as: 'FromDestination' })`
- `belongsTo(Destination, { as: 'ToDestination' })`
- `hasMany(Transit)`
- `hasMany(SubSchedule, { as: 'SubSchedules' })`
- `hasMany(Booking, { as: 'Bookings' })`
- `hasMany(SeatAvailability, { as: 'SeatAvailabilities' })`
- `hasMany(WaitingList, { as: 'WaitingLists' })`

---

### SubSchedule

**Purpose**: Jadwal khusus untuk tanggal tertentu (override schedule utama).

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `schedule_id` (INTEGER, FK to Schedules)
- `date` (DATE, NOT NULL)
- `departure_time` (TIME)
- `arrival_time` (TIME)
- `price_override` (DECIMAL) - Override main price
- `is_active` (BOOLEAN)
- `notes` (TEXT)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Schedule, { foreignKey: 'schedule_id' })`
- `hasMany(SeatAvailability)`
- `hasMany(WaitingList, { as: 'WaitingLists' })`
- `hasMany(SubScheduleRelation, { as: 'MainRelations' })`
- `hasMany(SubScheduleRelation, { as: 'RelatedRelations' })`

---

### SubScheduleRelation

**Purpose**: Menghubungkan dua sub-schedule untuk round trip / multi-leg journeys.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `main_subschedule_id` (INTEGER, FK to SubSchedules)
- `related_subschedule_id` (INTEGER, FK to SubSchedules)
- `relation_type` (ENUM: 'return', 'connection')
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(SubSchedule, { as: 'MainSchedule', foreignKey: 'main_subschedule_id' })`
- `belongsTo(SubSchedule, { as: 'RelatedSchedule', foreignKey: 'related_subschedule_id' })`

---

### Booking

**Purpose**: Record pemesanan tiket.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `ticket_id` (STRING, NOT NULL) - Unique ticket identifier (GG-OW-xxx or GG-RT-xxx)
- `contact_name` (STRING, NOT NULL)
- `contact_phone` (STRING, NOT NULL)
- `contact_email` (STRING, NOT NULL)
- `contact_passport_id` (STRING)
- `contact_nationality` (STRING)
- `schedule_id` (INTEGER, FK to Schedules, NOT NULL)
- `subschedule_id` (INTEGER, FK to SubSchedules, NULLABLE)
- `agent_id` (INTEGER, FK to Agents, NULLABLE)
- `payment_method` (STRING) - 'midtrans', 'doku', 'manual'
- `payment_status` (STRING, NOT NULL) - 'pending', 'paid', 'cancelled', 'expired'
- `gross_total` (DECIMAL, NOT NULL)
- `ticket_total` (DECIMAL, NOT NULL)
- `bank_fee` (DECIMAL)
- `currency` (STRING, DEFAULT 'IDR')
- `gross_total_in_usd` (DECIMAL)
- `exchange_rate` (DECIMAL)
- `total_passengers` (INTEGER, NOT NULL)
- `adult_passengers` (INTEGER, NOT NULL)
- `child_passengers` (INTEGER, NOT NULL)
- `infant_passengers` (INTEGER, NOT NULL)
- `booking_source` (STRING) - 'web', 'agent', 'admin'
- `booking_date` (DATE, NOT NULL)
- `expiration_time` (DATE) - Payment expiration
- `abandoned` (BOOLEAN, DEFAULT false)
- `note` (TEXT)
- `final_state` (JSON) - Final booking state
- `discount_data` (JSON) - Applied discounts
- `booked_by` (STRING)
- `reminder_hours` (INTEGER)
- `google_data` (JSON) - Google Ads attribution
- `created_at`, `updated_at` (DATE)

**Ticket ID Format**:
- One Way: `GG-OW-{number}`
- Round Trip: `GG-RT-{number}`

**Associations**:
- `belongsTo(Schedule, { as: 'schedule' })`
- `belongsTo(SubSchedule, { as: 'subSchedule' })`
- `belongsTo(Agent)`
- `hasMany(Passenger, { as: 'passengers' })`
- `hasMany(Transaction, { as: 'transactions' })`
- `hasMany(TransportBooking, { as: 'transportBookings' })`
- `belongsToMany(SeatAvailability, { through: BookingSeatAvailability, as: 'seatAvailabilities' })`
- `hasOne(AgentCommission, { as: 'agentCommission' })`
- `hasMany(BulkBookingResult, { as: 'BookingResults' })`

---

### Passenger

**Purpose**: Detail penumpang per booking.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `booking_id` (INTEGER, FK to Bookings, NOT NULL)
- `name` (STRING, NOT NULL)
- `age` (INTEGER)
- `type` (ENUM: 'adult', 'child', 'infant')
- `passport_id` (STRING)
- `nationality` (STRING)
- `seat_number` (STRING)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Booking, { foreignKey: 'booking_id' })`

---

### Transaction

**Purpose**: Record transaksi pembayaran.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `booking_id` (INTEGER, FK to Bookings, NOT NULL)
- `transaction_id` (STRING, NOT NULL) - Payment gateway transaction ID
- `payment_order_id` (STRING) - Order ID from payment gateway
- `amount` (DECIMAL, NOT NULL)
- `currency` (STRING, DEFAULT 'IDR')
- `payment_method` (STRING)
- `payment_type` (STRING) - 'credit_card', 'bank_transfer', 'ewallet', etc.
- `status` (STRING) - 'pending', 'paid', 'cancelled', 'failed', 'refunded'
- `gateway_response` (JSON) - Full response from payment gateway
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Booking, { foreignKey: 'booking_id' })`

---

### SeatAvailability

**Purpose**: Track ketersediaan kursi per schedule/date/subschedule.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `schedule_id` (INTEGER, FK to Schedules, NULLABLE)
- `subschedule_id` (INTEGER, FK to SubSchedules, NULLABLE)
- `transit_id` (INTEGER, FK to Transits, NULLABLE)
- `date` (DATE, NOT NULL)
- `total_capacity` (INTEGER, NOT NULL)
- `available_seats` (INTEGER, NOT NULL)
- `booked_seats` (INTEGER, DEFAULT 0)
- `public_capacity` (INTEGER) - Capacity visible to public
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Schedule)`
- `belongsTo(SubSchedule)`
- `belongsTo(Transit)`
- `belongsToMany(Booking, { through: BookingSeatAvailability })`
- `hasMany(WaitingList, { as: 'WaitingLists' })`

---

### BookingSeatAvailability

**Purpose**: Junction table untuk Many-to-Many relationship antara Booking dan SeatAvailability.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `booking_id` (INTEGER, FK to Bookings, NOT NULL)
- `seat_availability_id` (INTEGER, FK to SeatAvailabilities, NOT NULL)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Booking)`
- `belongsTo(SeatAvailability)`

---

### Transport

**Purpose**: Layanan transportasi (hotel transfer, dll).

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `name` (STRING, NOT NULL)
- `type` (STRING)
- `description` (TEXT)
- `price` (DECIMAL)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsToMany(Booking, { through: TransportBookings, as: 'transports' })`

---

### TransportBooking

**Purpose**: Record booking transportasi tambahan.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `booking_id` (INTEGER, FK to Bookings, NOT NULL)
- `transport_id` (INTEGER, FK to Transports, NOT NULL)
- `quantity` (INTEGER, DEFAULT 1)
- `price` (DECIMAL)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Booking)`
- `belongsTo(Transport)`

---

### Transit

**Purpose**: Stop/transit points dalam journey.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `schedule_id` (INTEGER, FK to Schedules, NOT NULL)
- `destination_id` (INTEGER, FK to Destinations, NOT NULL)
- `arrival_time` (TIME)
- `departure_time` (TIME)
- `sequence` (INTEGER) - Order in journey
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Schedule)`
- `belongsTo(Destination)`
- `hasMany(SeatAvailability)`
- `hasMany(BookingSeatAvailability)`

---

### AgentCommission

**Purpose**: Record komisi untuk agent per booking.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `booking_id` (INTEGER, FK to Bookings, NOT NULL)
- `agent_id` (INTEGER, FK to Agents, NOT NULL)
- `commission_amount` (DECIMAL)
- `commission_rate` (DECIMAL)
- `status` (STRING) - 'pending', 'paid', 'cancelled'
- `paid_at` (DATE)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Booking, { foreignKey: 'booking_id', as: 'agentCommission' })`
- `belongsTo(Agent)`

---

### AgentMetrics

**Purpose**: Metrik performa agent.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `agent_id` (INTEGER, FK to Agents, NOT NULL)
- `date` (DATE, NOT NULL)
- `total_bookings` (INTEGER, DEFAULT 0)
- `total_revenue` (DECIMAL, DEFAULT 0)
- `total_passengers` (INTEGER, DEFAULT 0)
- `commission_earned` (DECIMAL, DEFAULT 0)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Agent)`

---

### WaitingList

**Purpose**: Antrian untuk booking ketika seat penuh.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `schedule_id` (INTEGER, FK to Schedules, NULLABLE)
- `subschedule_id` (INTEGER, FK to SubSchedules, NULLABLE)
- `seat_availability_id` (INTEGER, FK to SeatAvailabilities, NULLABLE)
- `contact_name` (STRING, NOT NULL)
- `contact_email` (STRING, NOT NULL)
- `contact_phone` (STRING, NOT NULL)
- `total_passengers` (INTEGER, NOT NULL)
- `status` (STRING) - 'pending', 'notified', 'booked', 'cancelled'
- `notified_at` (DATE)
- `expires_at` (DATE)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Schedule, { as: 'WaitingSchedule' })`
- `belongsTo(SubSchedule, { as: 'WaitingSubSchedule' })`
- `belongsTo(SeatAvailability, { as: 'WaitingSeatAvailability' })`

---

### Discount

**Purpose**: Kode diskon/promo.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `code` (STRING, NOT NULL, UNIQUE)
- `description` (TEXT)
- `discount_type` (ENUM: 'percentage', 'fixed')
- `value` (DECIMAL, NOT NULL)
- `min_booking_amount` (DECIMAL)
- `max_discount_amount` (DECIMAL)
- `usage_limit` (INTEGER)
- `used_count` (INTEGER, DEFAULT 0)
- `valid_from` (DATE, NOT NULL)
- `valid_to` (DATE, NOT NULL)
- `applicable_to` (ENUM: 'all', 'specific_routes', 'specific_agents')
- `applicable_routes` (JSON) - Array of route IDs
- `applicable_agents` (JSON) - Array of agent IDs
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (DATE)

---

### EmailSendLog

**Purpose**: Log pengiriman email.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `booking_id` (INTEGER, FK to Bookings, NULLABLE)
- `email_type` (STRING) - 'payment', 'invoice', 'ticket', 'reminder', 'expired'
- `recipient_email` (STRING, NOT NULL)
- `subject` (STRING)
- `status` (STRING) - 'queued', 'sent', 'failed'
- `error_message` (TEXT)
- `sent_at` (DATE)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(Booking)`

---

### CustomEmailScheduler

**Purpose**: Konfigurasi email custom terjadwal.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `name` (STRING, NOT NULL)
- `email_type` (STRING)
- `template` (STRING)
- `cron_expression` (STRING)
- `recipients` (JSON) - Array of email addresses
- `filters` (JSON) - Booking filters
- `is_active` (BOOLEAN, DEFAULT true)
- `last_run_at` (DATE)
- `next_run_at` (DATE)
- `created_at`, `updated_at` (DATE)

---

### BulkBookingUpload

**Purpose**: Record untuk bulk booking upload.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `uploaded_by` (STRING)
- `filename` (STRING)
- `total_records` (INTEGER)
- `processed_records` (INTEGER, DEFAULT 0)
- `successful_records` (INTEGER, DEFAULT 0)
- `failed_records` (INTEGER, DEFAULT 0)
- `status` (STRING) - 'uploading', 'processing', 'completed', 'failed'
- `created_at`, `updated_at` (DATE)

---

### BulkBookingResult

**Purpose**: Hasil dari proses bulk booking.

**Fields**:
- `id` (INTEGER, PK, Auto Increment)
- `upload_id` (INTEGER, FK to BulkBookingUpload, NOT NULL)
- `booking_id` (INTEGER, FK to Bookings, NULLABLE)
- `row_data` (JSON) - Original row data
- `status` (STRING) - 'success', 'failed'
- `error_message` (TEXT)
- `created_at`, `updated_at` (DATE)

**Associations**:
- `belongsTo(BulkBookingUpload)`
- `belongsTo(Booking, { as: 'BookingResults' })`

---

## Model Relationships Diagram

```
User (1) ----< (*) Schedule

Destination (1) ----< (*) Schedule (FromDestination)
Destination (1) ----< (*) Schedule (ToDestination)

Boat (1) ----< (*) Schedule

Schedule (1) ----< (*) SubSchedule
Schedule (1) ----< (*) Transit
Schedule (1) ----< (*) Booking
Schedule (1) ----< (*) SeatAvailability

SubSchedule (1) ----< (*) SubScheduleRelation (MainSchedule)
SubSchedule (1) ----< (*) SubScheduleRelation (RelatedSchedule)
SubSchedule (1) ----< (*) SeatAvailability
SubSchedule (1) ----< (*) Booking
SubSchedule (1) ----< (*) WaitingList

Transit (1) ----< (*) SeatAvailability

SeatAvailability (M) ----< (M) Booking (through BookingSeatAvailability)
SeatAvailability (1) ----< (*) WaitingList

Booking (1) ----< (*) Passenger
Booking (1) ----< (*) Transaction
Booking (1) ----< (*) TransportBooking (through Booking)
Booking (1) ----< (*) AgentCommission
Booking (1) ----< (*) BulkBookingResult
Booking (1) ----< (*) EmailSendLog

Agent (1) ----< (*) Booking
Agent (1) ----< (*) AgentCommission
Agent (1) ----< (*) AgentMetrics

Transport (M) ----< (M) Booking (through TransportBooking)
```

## Important Notes

### Race Condition Handling

Lihat [race-condition-case.md](race-condition-case.md) untuk detail tentang handling race condition antara payment valid dan transaction settled.

### Transaction Safety

Untuk operasi yang memerlukan atomicity:
```javascript
await sequelize.transaction(async (t) => {
  // Multiple operations here
  await booking.save({ transaction: t });
  await seat.update({ transaction: t });
});
```

### Timestamps

Semua models menggunakan `created_at` dan `updated_at` timestamps. Beberapa models menggunakan `timestamps: false` dan manual timestamps.

### Soft Delete

Tidak ada soft delete bawaan. Jika diperlukan, tambahkan `deleted_at` field dan scope `paranoid: true`.

## Related Documentation

- [controllers.md](controllers.md) - Business logic yang menggunakan models
- [routes.md](routes.md) - API endpoints yang memanggil controllers
- [utils.md](utils.md) - Utility functions untuk database operations
