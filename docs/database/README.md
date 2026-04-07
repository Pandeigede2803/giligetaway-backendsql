# Database Documentation

Dokumentasi untuk database backend Giligetaway.

## Files

| File | Deskripsi |
|------|-----------|
| [models.md](models.md) | Semua Sequelize models dan relationships |
| [config.md](config.md) | Configuration (database, DOKU, WebSocket) |

## Quick Start

1. **Models**: Baca [models.md](models.md) untuk memahami struktur database
2. **Configuration**: Lihat [config.md](config.md) untuk setup koneksi database

## Models Overview

- **User**: Admin user accounts
- **Agent**: Travel agent accounts
- **Boat**: Fastboat vessels
- **Destination**: Ports/destinations
- **Schedule**: Main schedule definitions
- **SubSchedule**: Sub-schedule (specific dates)
- **Booking**: Booking records
- **Passenger**: Passenger details
- **Transaction**: Payment transactions
- **SeatAvailability**: Available seats per schedule/date
- **WaitingList**: Waiting list for full bookings
- **Discount**: Discount/promo codes
- **AgentCommission**: Agent commission records
- **AgentMetrics**: Agent performance metrics

## Relationships

```
User (1) ----< (*) Schedule
Boat (1) ----< (*) Schedule
Destination (1) ----< (*) Schedule (FromDestination, ToDestination)
Schedule (1) ----< (*) SubSchedule
Schedule (1) ----< (*) Booking
Booking (1) ----< (*) Passenger
Booking (1) ----< (*) Transaction
Agent (1) ----< (*) Booking
Agent (1) ----< (*) AgentCommission
```

---

**Back to [Main README](../README.md)**
