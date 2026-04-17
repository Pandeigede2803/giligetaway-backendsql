# scheduleController.js

## Overview

Controller ini menangani semua operasi terkait **Schedule** (jadwal perjalanan). Schedule adalah jadwal utama yang mendefinisikan rute, waktu, dan harga perjalanan fastboat. Controller ini juga menangani sub-schedule, transits, dan pencarian schedule yang kompleks.

## File Location

```
controllers/scheduleController.js
```

## Dependencies

```javascript
const {
  Schedule, SubSchedule, User, Boat, Transit,
  SeatAvailability, Destination, Passenger, Booking,
  sequelize, Agent
} = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { processBookedSeats } = require("../util/seatUtils");
const { Op, literal, QueryTypes, fn, col } = require("sequelize");
const { buildRoute, buildRouteFromSchedule } = require("../util/buildRoute");
const { calculatePublicCapacity } = require("../util/getCapacityReduction");
const { formatSchedules, formatSubSchedules } = require("../util/formatSchedules");
const { getDay } = require("date-fns");
const { formatSchedulesSimple, getDayNamesFromBitmask } = require("../util/formatUtilsSimple");
const { getTotalPassengers, getTotalRealPassengersRaw } = require("../util/schedulepassenger/getTotalPassenger");
const { getSchedulesAndSubSchedules, filterAvailableSchedules, formatScheduleWithClearRoute } = require("../util/querySchedulesHelper");
const { getNetPrice } = require("../util/agentNetPrice");
```

---

## Helper Functions (Internal)

### `isDayAvailable(date, daysOfWeek)`

**Purpose**: Cek apakah hari tertentu tersedia berdasarkan bitmask.

**Implementation**:
```javascript
const isDayAvailable = (date, daysOfWeek) => {
  const dayOfWeek = new Date(date).getDay(); // 0=Sunday, 1=Monday, etc.
  return (daysOfWeek & (1 << dayOfWeek)) !== 0;
};
```

**Usage**:
- Digunakan untuk validasi hari dalam schedule recurring
- `daysOfWeek` adalah integer yang mewakili hari-hari yang aktif (bitmask)

**Bitmask Example**:
- `0` (0000000) - Tidak ada hari
- `1` (0000001) - Minggu
- `2` (0000010) - Senin
- `3` (0000011) - Minggu & Senin
- `127` (1111111) - Semua hari

---

### `getDaysInMonth(month, year)`

**Purpose**: Generate array tanggal untuk satu bulan.

**Implementation**:
```javascript
const getDaysInMonth = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const monthString = String(month).padStart(2", "0");
    const dayString = String(day).padStart(2, "0");
    return `${year}-${monthString}-${dayString}`;
  });
};
```

---

### `createSeatAvailability(schedule, subschedule, date)`

**Purpose**: Create seat availability record untuk schedule/sub-schedule pada tanggal tertentu.

**Parameters**:
- `schedule` - Schedule object
- `subschedule` - SubSchedule object (optional)
- `date` - Date string (YYYY-MM-DD)

**Implementation**:
```javascript
const createSeatAvailability = async (schedule, subschedule, date) => {
  try {
    // Calculate public capacity
    const publicCapacity = calculatePublicCapacity(schedule);

    // Create seat availability
    const seatAvailability = await SeatAvailability.create({
      schedule_id: schedule.id,
      subschedule_id: subschedule?.id || null,
      date: date,
      total_capacity: schedule.Boat?.capacity || 0,
      available_seats: schedule.Boat?.capacity || 0,
      booked_seats: 0,
      public_capacity: publicCapacity
    });

    return seatAvailability;
  } catch (error) {
    console.error('Error creating seat availability:', error);
    throw error;
  }
};
```

---

## Exported Functions

### `getAllSchedulesWithSubSchedules`

**Purpose**: Mendapatkan semua schedules dengan sub-schedules untuk bulan dan boat tertentu.

**Method**: `GET`

**Route**: `/api/schedules/with-subschedules`

**Query Parameters**:
- `month` (required) - Bulan (1-12)
- `year` (required) - Tahun
- `boat_id` (required) - Boat ID

**Request**:
```bash
GET /api/schedules/with-subschedules?month=4&year=2026&boat_id=1
```

**Response (Success - 200)**:
```javascript
{
  "success": true,
  "message": "Schedules fetched successfully",
  "data": [
    {
      "id": 1,
      "boat_id": 1,
      "destination_from_id": 1,
      "destination_to_id": 2,
      "validity_start": "2026-01-01",
      "validity_end": "2026-12-31",
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "SubSchedules": [
        {
          "id": 101,
          "schedule_id": 1,
          "date": "2026-04-10",
          "price_override": null
        }
      ]
    }
  ]
}
```

**Response (No Data - 200)**:
```javascript
{
  "success": true,
  "message": "There's no schedule yet for the specified month and boat.",
  "data": []
}
```

**Response (Error - 400)**:
```javascript
{
  "success": false,
  "message": "Please provide month, year, and boat_id in the query parameters."
}
```

---

### `getScheduleSubschedule`

**Purpose**: Mendapatkan schedule dengan sub-schedules dan informasi lengkap termasuk seat availability.

**Method**: `GET`

**Route**: `/api/schedules/subschedule`

**Query Parameters**:
- `date` (required) - Tanggal perjalanan
- `from` (optional) - Destination asal ID
- `to` (optional) - Destination tujuan ID

**Request**:
```bash
GET /api/schedules/subschedule?date=2026-04-10&from=1&to=2
```

**Response (Success - 200)**:
```javascript
{
  "schedules": [
    {
      "id": 1,
      "boat": "Gili Cat 2",
      "fromDestination": "Padang Bai",
      "toDestination": "Gili Trawangan",
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "duration": "1h 30m",
      "schedule_type": "regular",
      "subSchedules": [
        {
          "id": 101,
          "date": "2026-04-10",
          "availableSeats": 45,
          "totalCapacity": 80,
          "price": 350000,
          "isOverride": false
        }
      ]
    }
  ]
}
```

---

### `getScheduleFormatted`

**Purpose**: Mendapatkan schedules dengan format yang sudah diproses untuk frontend.

**Method**: `GET`

**Route**: `/api/schedules/formatted`

**Query Parameters**:
- `date` (required) - Tanggal perjalanan
- `from` (optional) - Destination asal ID
- `to` (optional) - Destination tujuan ID
- `passengers` (optional) - Jumlah penumpang

**Response (Success - 200)**:
```javascript
{
  "schedules": [
    {
      "id": 1,
      "route": "Padang Bai → Gili Trawangan",
      "routeTimeline": [
        {
          "destination": "Padang Bai",
          "time": "08:00",
          "type": "departure"
        },
        {
          "destination": "Gili Trawangan",
          "time": "09:30",
          "type": "arrival"
        }
      ],
      "boat": "Gili Cat 2",
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "duration": "1h 30m",
      "prices": {
        "low_season": 300000,
        "high_season": 400000,
        "peak_season": 500000
      },
      "available_seats": 45,
      "total_capacity": 80
    }
  ]
}
```

---

### `searchSchedulesAndSubSchedules`

**Purpose**: Pencarian schedule dengan filter kompleks.

**Method**: `GET`

**Route**: `/api/schedules/search`

**Query Parameters**:
- `from` (optional) - Destination asal ID
- `to` (optional) - Destination tujuan ID
- `date` (optional) - Tanggal perjalanan
- `passengers` (optional) - Jumlah penumpang (default: 1)
- `return_date` (optional) - Tanggal kembali (untuk round trip)

**Response (Success - 200)**:
```javascript
{
  "oneWay": {
    "schedules": [
      {
        "id": 1,
        "route": "Padang Bai → Gili Trawangan",
        "departure_time": "08:00:00",
        "arrival_time": "09:30:00",
        "boat": "Gili Cat 2",
        "price": 350000,
        "available_seats": 45,
        "total_capacity": 80,
        "schedule_type": "regular",
        "days_of_week": [1, 2, 3, 4, 5, 6, 7]
      }
    ]
  },
  "roundTrip": {
    "schedules": []
  }
}
```

**Features**:
- Mendukung one-way dan round trip search
- Filter by availability
- Harga berdasarkan season
- Route timeline dengan transits (jika ada)

---

### `searchSchedulesAndSubSchedulesAgent`

**Purpose**: Pencarian schedule khusus untuk agent dengan harga net.

**Method**: `GET`

**Route**: `/api/schedules/search/agent`

**Query Parameters**:
- `from` (optional) - Destination asal ID
- `to` (optional) - Destination tujuan ID
- `date` (optional) - Tanggal perjalanan
- `passengers` (optional) - Jumlah penumpang
- `agent_id` (required) - Agent ID

**Response (Success - 200)**:
```javascript
{
  "schedules": [
    {
      "id": 1,
      "route": "Padang Bai → Gili Trawangan",
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "boat": "Gili Cat 2",
      "gross_price": 350000,
      "net_price": 315000,
      "commission": 35000,
      "available_seats": 45,
      "total_capacity": 80
    }
  ]
}
```

**Agent Pricing**:
- `gross_price` - Harga normal
- `net_price` - Harga setelah komisi (untuk agent)
- `commission` - Jumlah komisi agent

---

### `searchSchedulesAndSubSchedulesV3`

**Purpose**: Pencarian schedule dan sub-schedule untuk sistem utama yang sudah login, dengan format hasil yang lebih lengkap untuk UI dan pricing internal.

**Method**: `GET`

**Route**: `/api/schedules/search/v3`

**Authentication Required**: Yes

**Middleware**:
- `authenticate`

**Query Parameters**:
- `from` (required) - Destination asal ID
- `to` (required) - Destination tujuan ID
- `date` (required) - Tanggal perjalanan format `YYYY-MM-DD`
- `passengers_total` (optional) - Jumlah penumpang untuk filter kapasitas
- `agent_id` (optional) - Agent ID jika ingin menghitung harga net agent

**Request Example**:
```bash
GET /api/schedules/search/v3?from=1&to=2&date=2026-04-10&passengers_total=2
Authorization: Bearer YOUR_TOKEN
```

**Response (Success - 200)**:
```javascript
{
  "status": "success",
  "data": {
    "schedules": [
      {
        "id": 1,
        "schedule_id": 1,
        "subschedule_id": null,
        "type": "direct",
        "route_timeline": [
          {
            "type": "departure",
            "location": "Padang Bai",
            "time": "08:00:00",
            "action": "Depart from"
          },
          {
            "type": "arrival",
            "location": "Gili Trawangan",
            "time": "09:30:00",
            "action": "Arrive at"
          }
        ],
        "route_description": "08:00:00 Padang Bai → 09:30:00 Gili Trawangan",
        "route_steps": [
          {
            "step": 1,
            "from": "Padang Bai",
            "departure_time": "08:00:00",
            "to": "Gili Trawangan",
            "arrival_time": "09:30:00",
            "type": "to_destination"
          }
        ],
        "route_summary": "Padang Bai → Gili Trawangan",
        "route_type": "direct",
        "stops_count": 2,
        "price": 350000,
        "boat": {
          "id": 1,
          "name": "Gili Cat 2",
          "capacity": 80,
          "image": "https://...",
          "seat_layout": {
            "inside_seats": [],
            "outside_seats": [],
            "rooftop_seats": []
          }
        },
        "seatAvailability": {
          "available_seats": 45,
          "bookedSeatNumbers": ["A1", "A2"]
        },
        "net_price": 315000,
        "net_price_before_discount": 315000,
        "net_price_after_discount": 315000,
        "discount_amount": 0,
        "discount_activated": false
      }
    ],
    "passenger_count_requested": 2
  }
}
```

**If Passenger Count Filters Out All Results**:
```javascript
{
  "status": "success",
  "message": "No schedules available for 2 passengers. All selected schedules are full.",
  "data": {
    "schedules": [],
    "passenger_count_requested": 2,
    "seats_availability_issue": true
  }
}
```

**Result Notes**:
- Response menggabungkan `Schedule` dan `SubSchedule` dalam satu array `data.schedules`.
- Jika `passengers_total` diisi, hasil difilter hanya yang punya kursi cukup.
- Jika `agent_id` ada, field pricing net akan dihitung lewat `getNetPrice`.
- Jika tidak ada `agent_id`, field pricing net akan kembali ke nilai `N/A`.
- `discount` tidak divalidasi di middleware untuk route ini, jadi hasil pricing hanya memakai data yang sudah tersedia di request/session.

**Important Behavior**:
- Query ini memakai `authenticate`, jadi hanya user login yang bisa akses.
- Data availability disusun dari `SeatAvailability` yang ada atau dibuat otomatis bila belum tersedia.
- Hasil route dapat berisi rute direct maupun multi-stop, tergantung transit schedule yang ditemukan.

---

### `createScheduleWithTransit`

**Purpose**: Membuat schedule baru dengan multiple transit points.

**Method**: `POST`

**Route**: `/api/schedules/with-transit`

**Authentication Required**: Yes (Admin only)

**Request Body**:
```javascript
{
  "boat_id": 1,
  "destination_from_id": 1,
  "destination_to_id": 3,
  "user_id": 1,
  "validity_start": "2026-01-01",
  "validity_end": "2026-12-31",
  "check_in_time": "07:30:00",
  "departure_time": "08:00:00",
  "arrival_time": "10:00:00",
  "journey_time": "02:00:00",
  "low_season_price": 300000,
  "high_season_price": 400000,
  "peak_season_price": 500000,
  "return_low_season_price": 300000,
  "return_high_season_price": 400000,
  "return_peak_season_price": 500000,
  "availability": true,
  "schedule_type": "regular",
  "days_of_week": 127,
  "trip_type": "short",
  "route_image": "https://example.com/route.jpg",
  "transits": [
    {
      "destination_id": 2,
      "arrival_time": "08:45:00",
      "departure_time": "09:00:00",
      "sequence": 1
    }
  ]
}
```

**Response (Success - 201)**:
```javascript
{
  "message": "Schedule and transits created successfully",
  "schedule": {
    "id": 1,
    "boat_id": 1,
    "destination_from_id": 1,
    "destination_to_id": 3,
    // ... schedule fields
  },
  "transits": [
    {
      "id": 1,
      "schedule_id": 1,
      "destination_id": 2,
      "arrival_time": "08:45:00",
      "departure_time": "09:00:00",
      "sequence": 1
    }
  ]
}
```

---

### `duplicateScheduleWithTransits`

**Purpose**: Menduplikasi schedule beserta transitsnya.

**Method**: `POST`

**Route**: `/api/schedules/duplicate/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Schedule ID yang akan diduplikasi

**Response (Success - 201)**:
```javascript
{
  "message": "Schedule duplicated successfully",
  "newSchedule": {
    "id": 2,
    // ... duplicated schedule fields
  },
  "newTransits": [
    // ... duplicated transits
  ]
}
```

---

### `createSchedule`

**Purpose**: Membuat schedule baru (simple, tanpa transit).

**Method**: `POST`

**Route**: `/api/schedules`

**Authentication Required**: Yes (Admin only)

**Request Body**:
```javascript
{
  "boat_id": 1,
  "destination_from_id": 1,
  "destination_to_id": 2,
  "user_id": 1,
  "validity_start": "2026-01-01",
  "validity_end": "2026-12-31",
  "check_in_time": "07:30:00",
  "departure_time": "08:00:00",
  "arrival_time": "09:30:00",
  "journey_time": "01:30:00",
  "low_season_price": 300000,
  "high_season_price": 400000,
  "peak_season_price": 500000,
  "return_low_season_price": 300000,
  "return_high_season_price": 400000,
  "return_peak_season_price": 500000,
  "availability": true,
  "schedule_type": "regular",
  "days_of_week": 127,
  "trip_type": "short",
  "note": "Regular service"
}
```

**Response (Success - 201)**:
```javascript
{
  "message": "Schedule created successfully",
  "schedule": {
    "id": 1,
    // ... schedule fields
  }
}
```

---

### `getSchedules`

**Purpose**: Mendapatkan semua schedules dengan filter opsional.

**Method**: `GET`

**Route**: `/api/schedules`

**Authentication Required**: No (for public) / Yes (for admin details)

**Query Parameters**:
- `from` - Filter by origin destination
- `to` - Filter by destination
- `boat_id` - Filter by boat
- `date` - Filter by travel date
- `active` - Filter by availability (true/false)

**Response (Success - 200)**:
```javascript
{
  "schedules": [
    {
      "id": 1,
      "boat": "Gili Cat 2",
      "fromDestination": "Padang Bai",
      "toDestination": "Gili Trawangan",
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "availability": true,
      "days_of_week": 127,
      "prices": {
        "low_season": 300000,
        "high_season": 400000,
        "peak_season": 500000
      }
    }
  ]
}
```

---

### `getScheduleById`

**Purpose**: Mendapatkan detail schedule berdasarkan ID.

**Method**: `GET`

**Route**: `/api/schedules/:id`

**Authentication Required**: No

**URL Parameters**:
- `id` - Schedule ID

**Response (Success - 200)**:
```javascript
{
  "id": 1,
  "boat": {
    "id": 1,
    "name": "Gili Cat 2",
    "capacity": 80
  },
  "fromDestination": {
    "id": 1,
    "name": "Padang Bai"
  },
  "toDestination": {
    "id": 2,
    "name": "Gili Trawangan"
  },
  "departure_time": "08:00:00",
  "arrival_time": "09:30:00",
  "journey_time": "01:30:00",
  "low_season_price": 300000,
  "high_season_price": 400000,
  "peak_season_price": 500000,
  "days_of_week": 127,
  "Transits": []
}
```

---

### `getScheduleByIdSeat`

**Purpose**: Mendapatkan schedule dengan seat availability info.

**Method**: `GET`

**Route**: `/api/schedules/:id/seats`

**URL Parameters**:
- `id` - Schedule ID

**Query Parameters**:
- `date` - Tanggal untuk cek seat availability

**Response (Success - 200)**:
```javascript
{
  "schedule": {
    "id": 1,
    "departure_time": "08:00:00",
    "arrival_time": "09:30:00",
    "total_capacity": 80
  },
  "seatAvailability": {
    "available_seats": 45,
    "booked_seats": 35,
    "public_capacity": 70
  }
}
```

---

### `getScheduleSubscheduleByIdSeat`

**Purpose**: Mendapatkan schedule/sub-schedule dengan seat availability detail.

**Method**: `GET`

**Route**: `/api/schedules/:id/subschedule/:subscheduleId/seats`

**URL Parameters**:
- `id` - Schedule ID
- `subscheduleId` - SubSchedule ID

**Query Parameters**:
- `date` - Tanggal untuk cek seat availability

---

### `getAllSchedulesWithDetails`

**Purpose**: Mendapatkan semua schedules dengan detail lengkap (boat, destinations, transits).

**Method**: `GET`

**Route**: `/api/schedules/details`

**Query Parameters**:
- `date` - Filter by travel date
- `from` - Filter by origin
- `to` - Filter by destination

**Response (Success - 200)**:
```javascript
{
  "schedules": [
    {
      "id": 1,
      "boat": "Gili Cat 2",
      "route": "Padang Bai → Gili Trawangan",
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "duration": "1h 30m",
      "prices": {
        "low_season": 300000,
        "high_season": 400000,
        "peak_season": 500000
      },
      "transits": [
        {
          "destination": "Nusa Penida",
          "arrival_time": "08:45:00",
          "departure_time": "09:00:00"
        }
      ]
    }
  ]
}
```

---

### `getSchedulesByMultipleParams`

**Purpose**: Mendapatkan schedules dengan multiple filter parameters.

**Method**: `GET`

**Route**: `/api/schedules/filter`

**Query Parameters**:
- `boat_id` - Filter by boat
- `destination_from_id` - Filter by origin
- `destination_to_id` - Filter by destination
- `user_id` - Filter by creator
- `availability` - Filter by status
- `schedule_type` - Filter by type

---

### `getSchedulesWithTransits`

**Purpose**: Mendapatkan schedules dengan semua transit points.

**Method**: `GET`

**Route**: `/api/schedules/with-transits`

**Query Parameters**:
- `from` - Filter by origin
- `to` - Filter by destination

---

### `getSchedulesByDestination`

**Purpose**: Mendapatkan schedules berdasarkan rute.

**Method**: `GET`

**Route**: `/api/schedules/by-destination`

**Query Parameters**:
- `from` (required) - Destination asal ID
- `to` (required) - Destination tujuan ID

---

### `getSchedulesByValidity`

**Purpose**: Mendapatkan schedules dalam periode validity tertentu.

**Method**: `GET`

**Route**: `/api/schedules/by-validity`

**Query Parameters**:
- `start_date` - Tanggal mulai
- `end_date` - Tanggal akhir

---

### `getSchedulesByBoat`

**Purpose**: Mendapatkan schedules berdasarkan boat.

**Method**: `GET`

**Route**: `/api/schedules/by-boat/:boatId`

**URL Parameters**:
- `boatId` - Boat ID

---

### `getSchedulesByUser`

**Purpose**: Mendapatkan schedules berdasarkan user yang membuat.

**Method**: `GET`

**Route**: `/api/schedules/by-user/:userId`

**URL Parameters**:
- `userId` - User ID

---

### `updateSchedule`

**Purpose**: Mengupdate data schedule.

**Method**: `PUT`

**Route**: `/api/schedules/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Schedule ID

**Request Body** (semua field optional):
```javascript
{
  "boat_id": 2,
  "departure_time": "09:00:00",
  "arrival_time": "10:30:00",
  "low_season_price": 350000,
  "availability": false
}
```

**Response (Success - 200)**:
```javascript
{
  "message": "Schedule updated successfully",
  "schedule": {
    "id": 1,
    // ... updated fields
  }
}
```

---

### `deleteSchedule`

**Purpose**: Menghapus schedule secara permanen.

**Method**: `DELETE`

**Route**: `/api/schedules/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Schedule ID

**Response (Success - 200)**:
```javascript
{
  "message": "Schedule deleted successfully"
}
```

**Important Notes**:
- **CAUTION**: Ini adalah hard delete
- Transits terkait juga akan dihapus (cascade)
- Bookings yang sudah ada akan tetap ada (soft delete recommended)

---

### `uploadSchedules`

**Purpose**: Upload schedules dari file CSV.

**Method**: `POST`

**Route**: `/api/schedules/upload`

**Authentication Required**: Yes (Admin only)

**Request**: multipart/form-data dengan file CSV

**CSV Format**:
```csv
boat_id,destination_from_id,destination_to_id,user_id,validity_period,check_in_time,low_season_price,high_season_price,peak_season_price,arrival_time,journey_time,route_image,available_seats
1,1,2,1,2026-01-01 to 2026-12-31,07:30:00,300000,400000,500000,09:30:00,01:30:00,https://example.com/route.jpg,80
```

**Response (Success - 201)**:
```javascript
{
  "message": "Schedules uploaded successfully",
  "schedules": [
    {
      "boat_id": 1,
      "destination_from_id": 1,
      // ... uploaded schedule data
    }
  ]
}
```

---

## Model Reference

### Schedule Model

```javascript
{
  id: INTEGER (Primary Key, Auto Increment),
  boat_id: INTEGER (FK to Boats),
  destination_from_id: INTEGER (FK to Destinations),
  destination_to_id: INTEGER (FK to Destinations),
  user_id: INTEGER (FK to Users),
  validity_start: DATE (Not Null),
  validity_end: DATE (Not Null),
  check_in_time: TIME (Not Null),
  departure_time: TIME (Not Null),
  arrival_time: TIME (Not Null),
  journey_time: TIME (Not Null),
  low_season_price: DECIMAL (Not Null),
  high_season_price: DECIMAL (Not Null),
  peak_season_price: DECIMAL (Not Null),
  return_low_season_price: DECIMAL (Not Null),
  return_high_season_price: DECIMAL (Not Null),
  return_peak_season_price: DECIMAL (Not Null),
  availability: BOOLEAN (Default: true),
  route_image: STRING,
  schedule_type: STRING,
  days_of_week: TINYINT.UNSIGNED (Not Null),
  trip_type: ENUM('mid', 'short', 'long', 'intermediate'),
  note: STRING,
  created_at: DATE,
  updated_at: DATE
}
```

### Relationships

```
Schedule (1) ----< (*) SubSchedule
Schedule (1) ----< (*) Transit
Schedule (1) ----< (*) Booking
Schedule (1) ----< (*) SeatAvailability
Boat (1) ----< (*) Schedule
Destination (1) ----< (*) Schedule (FromDestination)
Destination (1) ----< (*) Schedule (ToDestination)
User (1) ----< (*) Schedule
```

---

## Schedule Types

| Type | Description |
|------|-------------|
| `regular` | Regular scheduled service |
| `charter` | Charter service |
| `special` | Special event service |

---

## Trip Types

| Type | Description |
|------|-------------|
| `short` | Short distance (< 1 hour) |
| `mid` | Medium distance (1-2 hours) |
| `long` | Long distance (2-4 hours) |
| `intermediate` | Multi-stop journey |

---

## Days of Week Bitmask

| Day | Bit | Value | Example |
|-----|-----|-------|---------|
| Sunday | 0 | 1 (0000001) | Only Sunday |
| Monday | 1 | 2 (0000010) | Only Monday |
| Tuesday | 2 | 4 (0000100) | Only Tuesday |
| Wednesday | 3 | 8 (0001000) | Only Wednesday |
| Thursday | 4 | 16 (0010000) | Only Thursday |
| Friday | 5 | 32 (0100000) | Only Friday |
| Saturday | 6 | 64 (1000000) | Only Saturday |
| All Days | 0-6 | 127 (1111111) | Every day |
| Weekdays | 1-5 | 62 (0111110) | Mon-Fri |
| Weekends | 0,6 | 65 (1000001) | Sat-Sun |

---

## Pricing Structure

### Seasonal Pricing

| Season | Field | Example |
|--------|-------|---------|
| Low Season | `low_season_price` | 300,000 IDR |
| High Season | `high_season_price` | 400,000 IDR |
| Peak Season | `peak_season_price` | 500,000 IDR |

### Return Pricing

Separate pricing untuk return trip:
- `return_low_season_price`
- `return_high_season_price`
- `return_peak_season_price`

---

## Usage Examples

### Creating a Schedule

```bash
curl -X POST http://localhost:8000/api/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "boat_id": 1,
    "destination_from_id": 1,
    "destination_to_id": 2,
    "user_id": 1,
    "validity_start": "2026-01-01",
    "validity_end": "2026-12-31",
    "check_in_time": "07:30:00",
    "departure_time": "08:00:00",
    "arrival_time": "09:30:00",
    "journey_time": "01:30:00",
    "low_season_price": 300000,
    "high_season_price": 400000,
    "peak_season_price": 500000,
    "return_low_season_price": 300000,
    "return_high_season_price": 400000,
    "return_peak_season_price": 500000,
    "days_of_week": 127,
    "trip_type": "short"
  }'
```

### Searching Schedules

```bash
curl "http://localhost:8000/api/schedules/search?from=1&to=2&date=2026-04-10&passengers=2"
```

### Search V3 for Main System

```bash
curl "http://localhost:8000/api/schedules/search/v3?from=1&to=2&date=2026-04-10&passengers_total=2" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Agent Search with Net Price

```bash
curl "http://localhost:8000/api/schedules/search/agent?from=1&to=2&date=2026-04-10&agent_id=1"
```

### Getting Schedule Details

```bash
curl http://localhost:8000/api/schedules/1
```

### Updating a Schedule

```bash
curl -X PUT http://localhost:8000/api/schedules/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "departure_time": "09:00:00",
    "low_season_price": 350000
  }'
```

### Deleting a Schedule

```bash
curl -X DELETE http://localhost:8000/api/schedules/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Uploading Schedules from CSV

```bash
curl -X POST http://localhost:8000/api/schedules/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@schedules.csv"
```

---

## Error Handling

| Error Type | Status Code | Message |
|------------|-------------|---------|
| Validation Error | 400 | Validation error details |
| Not Found | 404 | "Schedule not found" |
| Conflict | 409 | Schedule conflict (duplicate) |
| Database Error | 500 | Internal server error |

---

## Business Logic Notes

### SubSchedule Override

- SubSchedule dapat mengoverride harga schedule utama
- `price_override` di SubSchedule akan menggantikan seasonal pricing
- SubSchedule digunakan untuk special events atau holiday

### Seat Capacity

- `total_capacity` = Boat.capacity
- `available_seats` = total_capacity - booked_seats
- `public_capacity` = calculatePublicCapacity() - Capacity yang ditampilkan ke public (biasanya dikurangi beberapa seat untuk buffer)

### Transit Points

- Transit adalah intermediate stops
- Sequence number menentukan urutan stop
- Setiap transit memiliki arrival dan departure time

### Days of Week

- Menggunakan bitmask untuk efisiensi storage
- Mendukung fleksibilitas dalam setting hari operasional
- Validasi dilakukan sebelum schedule dibuat

### Route Building

- Route info di-build dari destinations dan transits
- Format: "Origin → Transit1 → Transit2 → Destination"
- Timeline menunjukkan waktu di setiap titik

---

## Related Routes

```javascript
// routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authenticate = require('../middleware/authenticate');

// Route examples
router.get('/', scheduleController.getSchedules);
router.get('/search', scheduleController.searchSchedulesAndSubSchedules);
router.get('/search/agent', authenticate, scheduleController.searchSchedulesAndSubSchedulesAgent);
router.get('/formatted', scheduleController.getScheduleFormatted);
router.get('/with-subschedules', scheduleController.getAllSchedulesWithSubSchedules);
router.get('/with-transits', scheduleController.getSchedulesWithTransits);
router.get('/details', scheduleController.getAllSchedulesWithDetails);
router.get('/by-destination', scheduleController.getSchedulesByDestination);
router.get('/by-boat/:boatId', scheduleController.getSchedulesByBoat);
router.get('/by-validity', scheduleController.getSchedulesByValidity);
router.get('/by-user/:userId', scheduleController.getSchedulesByUser);
router.get('/filter', scheduleController.getSchedulesByMultipleParams);
router.get('/subschedule', scheduleController.getScheduleSubschedule);
router.get('/:id', scheduleController.getScheduleById);
router.get('/:id/seats', scheduleController.getScheduleByIdSeat);
router.get('/:id/subschedule/:subscheduleId/seats', scheduleController.getScheduleSubscheduleByIdSeat);

// Admin routes
router.post('/', authenticate, scheduleController.createSchedule);
router.post('/with-transit', authenticate, scheduleController.createScheduleWithTransit);
router.post('/duplicate/:id', authenticate, scheduleController.duplicateScheduleWithTransits);
router.post('/upload', authenticate, upload.single('file'), scheduleController.uploadSchedules);
router.put('/:id', authenticate, scheduleController.updateSchedule);
router.delete('/:id', authenticate, scheduleController.deleteSchedule);

module.exports = router;
```

---

## Related Documentation

- [Model: Schedule](../../database/models.md#schedule)
- [Model: SubSchedule](../../database/models.md#subschedule)
- [Model: Transit](../../database/models.md#transit)
- [Route: Schedule](routes.md#schedules-api-schedules)
- [Util: buildRoute](../utils.md#buildroutejs)
- [Util: formatSchedules](../utils.md#formatschedulesjs)
- [Util: querySchedulesHelper](../utils.md#queryscheduleshelperjs)

---

**Last Updated**: 2026-04-06
