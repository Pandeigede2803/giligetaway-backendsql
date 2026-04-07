# destinationController.js

## Overview

Controller ini menangani operasi CRUD (Create, Read, Update, Delete) untuk **Destination** (pelabuhan/lokasi tujuan). Destination adalah lokasi asal atau tujuan dalam perjalanan fastboat.

## File Location

```
controllers/destinationController.js
```

## Dependencies

```javascript
const { Destination } = require('../models');
```

---

## Functions

### `createDestination`

**Purpose**: Membuat destination baru.

**Method**: `POST`

**Route**: `/api/destinations`

**Authentication Required**: Yes (Admin only)

**Request Body**:
```javascript
{
  "name": "Padang Bai",
  "location": "Bali, Indonesia",
  "code": "PBAI",
  "is_active": true
}
```

**Response (Success - 201)**:
```javascript
{
  "id": 1,
  "name": "Padang Bai",
  "location": "Bali, Indonesia",
  "code": "PBAI",
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
const createDestination = async (req, res) => {
    try {
        const destination = await Destination.create(req.body);
        res.status(201).json(destination);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
```

---

### `getDestinations`

**Purpose**: Mendapatkan semua destination.

**Method**: `GET`

**Route**: `/api/destinations`

**Authentication Required**: No

**Query Parameters** (Optional):
- `is_active` - Filter by active status (true/false)

**Response (Success - 200)**:
```javascript
[
  {
    "id": 1,
    "name": "Padang Bai",
    "location": "Bali, Indonesia",
    "code": "PBAI",
    "is_active": true,
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Gili Trawangan",
    "location": "Lombok, Indonesia",
    "code": "GTRW",
    "is_active": true,
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  }
]
```

**Response (Error - 400)**:
```javascript
{
  "error": "Error message"
}
```

**Implementation**:
```javascript
const getDestinations = async (req, res) => {
    try {
        const destinations = await Destination.findAll();
        res.status(200).json(destinations);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
```

---

### `createMultipleDestinations`

**Purpose**: Membuat multiple destinations sekaligus.

**Method**: `POST`

**Route**: `/api/destinations/bulk` (custom route, if defined)

**Authentication Required**: Yes (Admin only)

**Request Body**:
```javascript
[
  {
    "name": "Sanur",
    "location": "Bali, Indonesia",
    "code": "SNUR",
    "is_active": true
  },
  {
    "name": "Nusa Penida",
    "location": "Bali, Indonesia",
    "code": "NPND",
    "is_active": true
  }
]
```

**Response (Success - 201)**:
```javascript
[
  {
    "id": 3,
    "name": "Sanur",
    "location": "Bali, Indonesia",
    "code": "SNUR",
    "is_active": true,
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  },
  {
    "id": 4,
    "name": "Nusa Penida",
    "location": "Bali, Indonesia",
    "code": "NPND",
    "is_active": true,
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  }
]
```

**Response (Error - 400)**:
```javascript
{
  "error": "Error message"
}
```

**Implementation**:
```javascript
const createMultipleDestinations = async (req, res) => {
    try {
        const destinations = await Destination.bulkCreate(req.body);
        res.status(201).json(destinations);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
```

---

### `getDestinationById`

**Purpose**: Mendapatkan detail destination berdasarkan ID.

**Method**: `GET`

**Route**: `/api/destinations/:id`

**Authentication Required**: No

**URL Parameters**:
- `id` - Destination ID (integer)

**Response (Success - 200)**:
```javascript
{
  "id": 1,
  "name": "Padang Bai",
  "location": "Bali, Indonesia",
  "code": "PBAI",
  "is_active": true,
  "created_at": "2026-04-06T00:00:00.000Z",
  "updated_at": "2026-04-06T00:00:00.000Z"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "error": "Destination not found"
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
const getDestinationById = async (req, res) => {
    try {
        const destination = await Destination.findByPk(req.params.id);
        if (destination) {
            res.status(200).json(destination);
        } else {
            res.status(404).json({ error: 'Destination not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
```

---

### `updateDestination`

**Purpose**: Mengupdate data destination yang sudah ada.

**Method**: `PUT`

**Route**: `/api/destinations/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Destination ID (integer)

**Request Body**:
```javascript
{
  "name": "Padang Bai Port",
  "location": "Padang Bai, Bali, Indonesia",
  "code": "PBAP",
  "is_active": true
}
```

**Response (Success - 200)**:
```javascript
{
  "id": 1,
  "name": "Padang Bai Port",
  "location": "Padang Bai, Bali, Indonesia",
  "code": "PBAP",
  "is_active": true,
  "created_at": "2026-04-06T00:00:00.000Z",
  "updated_at": "2026-04-06T01:30:00.000Z"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "error": "Destination not found"
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
const updateDestination = async (req, res) => {
    try {
        const destination = await Destination.findByPk(req.params.id);
        if (destination) {
            console.log('Updating destination with ID:', req.params.id);
            console.log('Request body:', req.body);
            await destination.update(req.body);
            res.status(200).json(destination);
        } else {
            res.status(404).json({ error: 'Destination not found' });
        }
    } catch (error) {
        console.error('Error updating destination:', error);
        res.status(400).json({ error: error.message });
    }
};
```

**Notes**:
- Fungsi ini mengirim log ke console untuk debugging
- Hanya field yang dikirim dalam request body yang akan diupdate

---

### `deleteDestination`

**Purpose**: Menghapus destination secara permanen.

**Method**: `DELETE`

**Route**: `/api/destinations/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - Destination ID (integer)

**Response (Success - 204)**:
```javascript
{}
```

**Response (Not Found - 404)**:
```javascript
{
  "error": "Destination not found"
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
const deleteDestination = async (req, res) => {
    try {
        const destination = await Destination.findByPk(req.params.id);
        if (destination) {
            await destination.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Destination not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
```

**Important Notes**:
- **CAUTION**: Ini adalah hard delete (permanent deletion)
- Destination yang sudah digunakan dalam Schedule tidak boleh dihapus
- Pertimbangkan soft delete (tambahkan `deleted_at` field) untuk production

---

## Model Reference

### Destination Model

```javascript
{
  id: INTEGER (Primary Key, Auto Increment),
  name: STRING (Not Null),
  location: STRING,
  code: STRING,
  is_active: BOOLEAN,
  created_at: DATE,
  updated_at: DATE
}
```

---

## Usage Examples

### Creating a New Destination

```bash
curl -X POST http://localhost:8000/api/destinations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Padang Bai",
    "location": "Bali, Indonesia",
    "code": "PBAI",
    "is_active": true
  }'
```

### Getting All Destinations

```bash
curl http://localhost:8000/api/destinations
```

### Getting a Specific Destination

```bash
curl http://localhost:8000/api/destinations/1
```

### Updating a Destination

```bash
curl -X PUT http://localhost:8000/api/destinations/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Padang Bai Port",
    "location": "Padang Bai, Bali, Indonesia"
  }'
```

### Deleting a Destination

```bash
curl -X DELETE http://localhost:8000/api/destinations/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Handling

| Error Type | Status Code | Message |
|------------|-------------|---------|
| Validation Error | 400 | Sequelize validation error message |
| Not Found | 404 | "Destination not found" |
| Database Error | 500 | Internal server error |

---

## Related Routes

```javascript
// routes/destination.js
const express = require('express');
const router = express.Router();
const destinationController = require('../controllers/destinationController');
const authenticate = require('../middleware/authenticate');

router.get('/', destinationController.getDestinations);
router.get('/:id', destinationController.getDestinationById);
router.post('/', authenticate, destinationController.createDestination);
router.put('/:id', authenticate, destinationController.updateDestination);
router.delete('/:id', authenticate, destinationController.deleteDestination);

module.exports = router;
```

---

## Related Documentation

- [Model: Destination](../../database/models.md#destination)
- [Route: Destination](routes.md#destinations-api-destinations)
- [Middleware: authenticate](middleware.md#authenticatejs)

---

**Last Updated**: 2026-04-06
