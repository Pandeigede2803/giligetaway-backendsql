# boatController.js

## Overview

Controller ini menangani operasi CRUD untuk **Boat** (kapal fastboat). Boat adalah kapal yang digunakan untuk perjalanan antar pulau/pelabuhan. Controller ini juga menghitung statistik terkait boat seperti jumlah schedule dan booking.

## File Location

```
controllers/boatController.js
```

## Dependencies

```javascript
const { Boat, Schedule, Booking } = require('../models');
const { calculatePublicCapacity } = require("../util/getCapacityReduction");
```

---

## Functions

### `createBoat`

**Purpose**: Membuat data kapal (boat) baru.

**Method**: `POST`

**Route**: `/api/boats`

**Authentication Required**: Yes (Admin only)

**Request Body**:
```javascript
{
  "name": "Gili Cat 2",
  "capacity": 80,
  "published_capacity": 70,
  "image": "https://example.com/boat-image.jpg",
  "description": "Fast boat with air conditioning",
  "is_active": true
}
```

**Request Body Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | STRING | Yes | Nama kapal |
| `capacity` | INTEGER | Yes | Kapasitas total penumpang |
| `published_capacity` | INTEGER | No | Kapasitas yang ditampilkan ke public (default: sama dengan capacity) |
| `image` | STRING | No | URL gambar kapal |
| `description` | TEXT | No | Deskripsi kapal |
| `is_active` | BOOLEAN | No | Status aktif (default: true) |

**Response (Success - 201)**:
```javascript
{
  "id": 1,
  "name": "Gili Cat 2",
  "capacity": 80,
  "published_capacity": 70,
  "image": "https://example.com/boat-image.jpg",
  "description": "Fast boat with air conditioning",
  "is_active": true,
  "created_at": "2026-04-06T00:00:00.000Z",
  "updated_at": "2026-04-06T00:00:00.000Z"
}
```

**Response (Error - 400)**:
```javascript
{
  "error": "Error message"
}
```

**Implementation**:
```javascript
const createBoat = async (req, res) => {
    try {
        const boat = await Boat.create(req.body);
        console.log('Boat created:', boat);
        res.status(201).json(boat);
    } catch (error) {
        console.log('Error creating boat:', error.message);
        res.status(400).json({ error: error.message });
    }
};
```

---

### `getBoats`

**Purpose**: Mendapatkan semua data boat dengan statistik sederhana.

**Method**: `GET`

**Route**: `/api/boats`

**Authentication Required**: No

**Query Parameters** (Optional):
- `is_active` - Filter by active status (true/false)

**Response (Success - 200)**:
```javascript
[
  {
    "id": 1,
    "name": "Gili Cat 2",
    "capacity": 80,
    "published_capacity": 70,
    "image": "https://example.com/boat-image.jpg",
    "description": "Fast boat with air conditioning",
    "is_active": true,
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z",
    "scheduleCount": 5,
    "publicCapacity": 70
  },
  {
    "id": 2,
    "name": "Eka Jaya",
    "capacity": 60,
    "published_capacity": 50,
    "image": "https://example.com/eka-jaya.jpg",
    "description": "Traditional fast boat",
    "is_active": true,
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z",
    "scheduleCount": 3,
    "publicCapacity": 50
  }
]
```

**Additional Fields**:
- `scheduleCount` - Jumlah schedule yang menggunakan boat ini
- `publicCapacity` - Kapasitas yang ditampilkan ke public (dari `published_capacity`)

**Response (Error - 400)**:
```javascript
{
  "error": "Error message"
}
```

**Implementation**:
```javascript
const getBoats = async (req, res) => {
    try {
        const boats = await Boat.findAll({
            include: [
                {
                    model: Schedule,
                    as: 'Schedules',
                    attributes: ['id']
                }
            ]
        });

        const boatsData = boats.map(boat => {
            const boatData = boat.toJSON();
            boatData.scheduleCount = boat.Schedules.length;
            boatData.publicCapacity = boatData.published_capacity;
            return boatData;
        });

        res.status(200).json(boatsData);
    } catch (error) {
        console.log('Error retrieving boats:', error.message);
        res.status(400).json({ error: error.message });
    }
};
```

**Notes**:
- Menggunakan `include` untuk mengambil schedule terkait
- `scheduleCount` dihitung dari jumlah schedule yang terhubung
- Booking count saat ini di-comment out (line 38)

---

### `getBoatById`

**Purpose**: Mendapatkan detail boat berdasarkan ID dengan schedule dan booking terkait.

**Method**: `GET`

**Route**: `/api/boats/:id`

**Authentication Required**: No

**URL Parameters**:
- `id` - Boat ID (integer)

**Response (Success - 200)**:
```javascript
{
  "id": 1,
  "name": "Gili Cat 2",
  "capacity": 80,
  "published_capacity": 70,
  "image": "https://example.com/boat-image.jpg",
  "description": "Fast boat with air conditioning",
  "is_active": true,
  "created_at": "2026-04-06T00:00:00.000Z",
  "updated_at": "2026-04-06T00:00:00.000Z",
  "Schedules": [
    {
      "id": 1,
      "boat_id": 1,
      "destination_from_id": 1,
      "destination_to_id": 2,
      "departure_time": "08:00:00",
      "arrival_time": "09:30:00",
      "Bookings": [
        {
          "id": 101,
          "contact_name": "John Doe",
          "total_passengers": 2
        },
        {
          "id": 102,
          "contact_name": "Jane Smith",
          "total_passengers": 3
        }
      ]
    }
  ],
  "scheduleCount": 5,
  "bookingCount": 150
}
```

**Additional Fields**:
- `scheduleCount` - Jumlah schedule yang menggunakan boat ini
- `bookingCount` - Total booking dari semua schedule

**Response (Not Found - 404)**:
```javascript
{
  "error": "Boat not found"
}
```

**Response (Error - 400)**:
```javascript
{
  "error": "Error message"
}
```

**Implementation**:
```javascript
const getBoatById = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id, {
            include: [
                {
                    model: Schedule,
                    as: 'Schedules',
                    include: [
                        {
                            model: Booking,
                            as: 'Bookings'
                        }
                    ]
                }
            ]
        });

        if (boat) {
            const boatData = boat.toJSON();
            boatData.scheduleCount = boat.Schedules.length;
            boatData.bookingCount = boat.Schedules.reduce((total, schedule) => total + schedule.Bookings.length, 0);

            res.status(200).json(boatData);
        } else {
            console.log('Boat not found with id:', req.params.id);
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        console.log('Error retrieving boat:', error.message);
        res.status(400).json({ error: error.message });
    }
};
```

**Notes**:
- Menggunakan nested include untuk mendapatkan schedules dan bookings
- `bookingCount` dihitung dengan `reduce` dari semua bookings di semua schedules

---

### `updateBoat`

**Purpose**: Mengupdate data boat yang sudah ada.

**Method**: `PUT`

**Route**: `/api/boats/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Boat ID (integer)

**Request Body** (semua field optional):
```javascript
{
  "name": "Gili Cat 2 Updated",
  "capacity": 90,
  "published_capacity": 80,
  "image": "https://example.com/new-boat-image.jpg",
  "description": "Updated fast boat with new facilities",
  "is_active": true
}
```

**Response (Success - 200)**:
```javascript
{
  "id": 1,
  "name": "Gili Cat 2 Updated",
  "capacity": 90,
  "published_capacity": 80,
  "image": "https://example.com/new-boat-image.jpg",
  "description": "Updated fast boat with new facilities",
  "is_active": true,
  "created_at": "2026-04-06T00:00:00.000Z",
  "updated_at": "2026-04-06T01:30:00.000Z"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "error": "Boat not found"
}
```

**Response (Error - 400)**:
```javascript
{
  "error": "Error message"
}
```

**Implementation**:
```javascript
const updateBoat = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id);
        if (boat) {
            const updatedBoat = await boat.update(req.body);
            console.log('Boat updated from:', updatedBoat);
            res.status(200).json(updatedBoat);
        } else {
            console.log('Boat not found with id:', req.params.id);
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        console.log('Error updating boat:', error.message);
        res.status(400).json({ error: error.message });
    }
};
```

**Notes**:
- Hanya field yang dikirim akan diupdate
- `updated_at` akan otomatis diupdate

---

### `deleteBoat`

**Purpose**: Menghapus boat secara permanen dengan validasi.

**Method**: `DELETE`

**Route**: `/api/boats/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Boat ID (integer)

**Validation Rules**:
- Boat tidak boleh dihapus jika masih ada schedule yang aktif
- Hanya boat tanpa schedule yang boleh dihapus

**Response (Success - 204)**:
```javascript
{}
```

**Response (Bad Request - 400)**:
```javascript
{
  "error": "Error deleting Boat because there are schedules still running for it"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "error": "Boat not found"
}
```

**Implementation**:
```javascript
const deleteBoat = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id, {
            include: [
                {
                    model: Schedule,
                    as: 'Schedules'
                }
            ]
        });

        if (boat && boat.Schedules.length === 0) {
            await boat.destroy();
            console.log('Boat deleted:', boat);
            res.status(204).json();
        } else {
            console.log('Error deleting Boat because there are schedules still running for it');
            res.status(400).json({
                error: 'Error deleting Boat because there are schedules still running for it'
            });
        }
    } catch (error) {
        console.log('Error deleting boat:', error.message);

        if (error.message.includes('Cannot delete or update a parent row: a foreign key constraint fails')) {
            return res.status(400).json({
                error: 'Cannot delete Boat because there are schedules still running for it'
            });
        }

        res.status(400).json({ error: error.message });
    }
};
```

**Important Notes**:
- Validasi dilakukan dengan cek jumlah schedule terkait
- Jika ada schedule aktif, delete akan ditolak
- Ada penanganan error untuk foreign key constraint dari database
- Pertimbangkan soft delete (tambahkan `deleted_at` field) untuk production

---

## Model Reference

### Boat Model

```javascript
{
  id: INTEGER (Primary Key, Auto Increment),
  name: STRING (Not Null),
  capacity: INTEGER (Not Null),
  published_capacity: INTEGER,
  image: STRING,
  description: TEXT,
  is_active: BOOLEAN,
  created_at: DATE,
  updated_at: DATE
}
```

### Relationships

```
Boat (1) ----< (*) Schedule
    └── Boat.boat_id = Schedule.boat_id
```

---

## Usage Examples

### Creating a New Boat

```bash
curl -X POST http://localhost:8000/api/boats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Gili Cat 2",
    "capacity": 80,
    "published_capacity": 70,
    "description": "Fast boat with air conditioning",
    "is_active": true
  }'
```

### Getting All Boats

```bash
curl http://localhost:8000/api/boats
```

### Getting Active Boats Only

```bash
curl "http://localhost:8000/api/boats?is_active=true"
```

### Getting a Specific Boat

```bash
curl http://localhost:8000/api/boats/1
```

### Updating a Boat

```bash
curl -X PUT http://localhost:8000/api/boats/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Gili Cat 2 Updated",
    "capacity": 90
  }'
```

### Deleting a Boat

```bash
curl -X DELETE http://localhost:8000/api/boats/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Handling

| Error Type | Status Code | Message |
|------------|-------------|---------|
| Validation Error | 400 | Sequelize validation error message |
| Not Found | 404 | "Boat not found" |
| Foreign Key Constraint | 400 | "Cannot delete Boat because there are schedules still running for it" |
| Database Error | 500 | Internal server error |

---

## Related Routes

```javascript
// routes/boat.js
const express = require('express');
const router = express.Router();
const boatController = require('../controllers/boatController');
const authenticate = require('../middleware/authenticate');

router.get('/', boatController.getBoats);
router.get('/:id', boatController.getBoatById);
router.post('/', authenticate, boatController.createBoat);
router.put('/:id', authenticate, boatController.updateBoat);
router.delete('/:id', authenticate, boatController.deleteBoat);

module.exports = router;
```

---

## Business Logic Notes

### Published Capacity vs Actual Capacity

- **`capacity`**: Kapasitas aktual kapal (total seat tersedia)
- **`published_capacity`**: Kapasitas yang ditampilkan ke public/public API
- **Use Case**: Boat bisa memiliki kapasitas 80, tapi hanya 70 yang ditampilkan untuk keamanan/reservasi

### Delete Protection

Boat dengan schedule aktif dilindungi dari penghapusan:
1. Cek jumlah schedule sebelum delete
2. Cek foreign key constraint dari database
3. Return error message yang jelas jika ada schedule terkait

### Statistics Calculation

- `scheduleCount`: Diambil dari hasil query dengan `include`
- `bookingCount`: Dihitung menggunakan `reduce` dari semua bookings dalam schedules
- Statistik ini dihitung di controller, bukan di database (consider for optimization if needed)

---

## Related Documentation

- [Model: Boat](../../database/models.md#boat)
- [Route: Boat](routes.md#boats-api-boats)
- [Middleware: authenticate](middleware.md#authenticatejs)
- [Util: calculatePublicCapacity](../utils.md#calculatepubliccapacityjs)

---

**Last Updated**: 2026-04-06
