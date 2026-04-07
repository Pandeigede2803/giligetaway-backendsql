# API Documentation

Dokumentasi untuk API backend Giligetaway.

## Files

| File | Deskripsi |
|------|-----------|
| [app-js.md](app-js.md) | Main application entry point, middleware, routes, dan server initialization |
| [routes.md](routes.md) | Semua API endpoints dengan method, path, dan deskripsi |
| [controllers.md](controllers.md) | Business logic untuk setiap controller |
| [middleware.md](middleware.md) | Custom middleware (auth, validation, rate limiting) |
| [utils.md](utils.md) | Utility functions (cron jobs, email, booking logic) |

## Quick Start

1. **App Setup**: Baca [app-js.md](app-js.md) untuk memahami arsitektur aplikasi
2. **Routes**: Cek [routes.md](routes.md) untuk endpoint yang tersedia
3. **Controllers**: Lihat [controllers.md](controllers.md) untuk implementasi business logic
4. **Middleware**: Pelajari [middleware.md](middleware.md) untuk request/response processing
5. **Utils**: Baca [utils.md](utils.md) untuk utility functions

## Key Topics

### Authentication
- JWT authentication via [authenticate middleware](middleware.md#authenticatejs)
- Agent authentication via [agentRoutesApi](routes.md#public-agent-api)

### Payment
- Midtrans integration via [payment controller](controllers.md#paymentcontrollerjs)
- DOKU integration via [doku controller](controllers.md#dokucontrollerjs)

### Booking
- Customer booking via [booking controller](controllers.md#bookingcontrollerjs)
- Agent booking via [booking agent controller](controllers.md#bookingagentcontrollerjs)

### Seat Management
- Seat availability via [seat availability controller](controllers.md#seatavailabilitycontrollerjs)
- Seat locking via [seat availability utils](utils.md#seat-booking)

---

**Back to [Main README](../README.md)**
