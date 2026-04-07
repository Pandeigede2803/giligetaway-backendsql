# Giligetaway Backend Documentation

Selamat datang di dokumentasi backend Giligetaway. Dokumentasi ini terorganisir berdasarkan kategori untuk memudahkan navigasi.

## 📁 Struktur Dokumentasi

```
docs/
├── README.md                    # Halaman ini
├── api/                         # API Documentation
│   ├── app-js.md               # Main application setup
│   ├── routes.md               # All API endpoints
│   ├── controllers.md          # Business logic
│   ├── middleware.md           # Request/response processing
│   └── utils.md                # Utility functions
├── database/                    # Database Documentation
│   ├── models.md               # Sequelize models
│   └── config.md               # Database configuration
├── features/                    # Feature Documentation
│   ├── agent/                  # Agent-related features
│   ├── DISCOUNT_IMPLEMENTATION.md
│   ├── email-scheduler-documentation.md
│   ├── FRONTEND-EMAIL-SCHEDULER-GUIDE.md
│   ├── waiting-list-*.md
│   ├── googledata.md
│   ├── duplicate-seat-detection-flow.md
│   ├── telegram-notification-setup.md
│   └── add-email-notification-foragentbooking.md
├── maintenance/                 # Maintenance Documentation
│   ├── cron-jobs.md            # Scheduled tasks
│   ├── race-condition-case.md  # Race condition handling
│   ├── booking*.md             # Booking maintenance
│   └── bug/                    # Bug fixes
├── guides/                      # Guides & Tutorials
│   └── test-plan-agent-round-trip-booking copy.md
└── log/                         # Development Logs
    └── DEVLOG-*.md
```

## 🚀 Quick Start

### Untuk Developer Baru

1. **Baca Overview**: Mulai dari [api/app-js.md](api/app-js.md) untuk memahami arsitektur
2. **Pelajari Database**: Lihat [database/models.md](database/models.md) untuk struktur data
3. **API Endpoints**: Cek [api/routes.md](api/routes.md) untuk endpoint yang tersedia
4. **Business Logic**: Baca [api/controllers.md](api/controllers.md) untuk implementasi

### Untuk Maintenance

1. **Cron Jobs**: Lihat [maintenance/cron-jobs.md](maintenance/cron-jobs.md) untuk scheduled tasks
2. **Bug Fixes**: Cek folder [maintenance/bug/](maintenance/bug/) untuk riwayat bug fix
3. **Race Conditions**: Baca [maintenance/race-condition-case.md](maintenance/race-condition-case.md)

### Untuk Fitur Khusus

- **Agent Booking**: [features/agent/](features/agent/)
- **Discount/Promo**: [features/DISCOUNT_IMPLEMENTATION.md](features/DISCOUNT_IMPLEMENTATION.md)
- **Email Scheduler**: [features/email-scheduler-documentation.md](features/email-scheduler-documentation.md)
- **Waiting List**: [features/waiting-list-*.md](features/)
- **Google Analytics**: [features/googledata.md](features/googledata.md)

---

## 📚 API Documentation

| File | Deskripsi |
|------|-----------|
| [app-js.md](api/app-js.md) | Main application entry point, middleware, routes |
| [routes.md](api/routes.md) | Semua API endpoints dengan method dan deskripsi |
| [controllers.md](api/controllers.md) | Business logic untuk setiap controller |
| [middleware.md](api/middleware.md) | Custom middleware (auth, validation, rate limiting) |
| [utils.md](api/utils.md) | Utility functions (cron jobs, email, booking logic) |

---

## 🗄️ Database Documentation

| File | Deskripsi |
|------|-----------|
| [models.md](database/models.md) | Semua Sequelize models dan relationships |
| [config.md](database/config.md) | Configuration (database, DOKU, WebSocket) |

---

## ⚡ Feature Documentation

### Agent Features

| File | Deskripsi |
|------|-----------|
| [agent/agent-booking-pricing-commission.md](features/agent/agent-booking-pricing-commission.md) | Pricing dan commission untuk agent |
| [agent/agent-round-trip-booking.md](features/agent/agent-round-trip-booking.md) | Round trip booking untuk agent |
| [agent/agent-search-schedule-v3-flow.md](features/agent/agent-search-schedule-v3-flow.md) | Flow pencarian schedule agent v3 |
| [agent/agent-seat-auto-assignment.md](features/agent/agent-seat-auto-assignment.md) | Auto assignment seat number untuk agent |
| [agent/agent-booking-email-enhancement.md](features/agent/agent-booking-email-enhancement.md) | Email enhancement untuk agent booking |
| [agent/agent-booking-financial-calculation.md](features/agent/agent-booking-financial-calculation.md) | Perhitungan financial agent booking |
| [agent/agent-commission-queue.md](features/agent/agent-commission-queue.md) | Queue system untuk agent commission |

### Other Features

| File | Deskripsi |
|------|-----------|
| [DISCOUNT_IMPLEMENTATION.md](features/DISCOUNT_IMPLEMENTATION.md) | Implementasi sistem discount |
| [email-scheduler-documentation.md](features/email-scheduler-documentation.md) | Dokumentasi email scheduler |
| [FRONTEND-EMAIL-SCHEDULER-GUIDE.md](features/FRONTEND-EMAIL-SCHEDULER-GUIDE.md) | Guide email scheduler untuk frontend |
| [waiting-list-cron.md](features/waiting-list-cron.md) | Cron job untuk waiting list |
| [waiting-list-improvements-2025-12-29.md](features/waiting-list-improvements-2025-12-29.md) | Improvement waiting list |
| [googledata.md](features/googledata.md) | Google Analytics attribution |
| [duplicate-seat-detection-flow.md](features/duplicate-seat-detection-flow.md) | Flow deteksi seat duplikat |
| [telegram-notification-setup.md](features/telegram-notification-setup.md) | Setup notifikasi Telegram |
| [add-email-notification-foragentbooking.md](features/add-email-notification-foragentbooking.md) | Notifikasi email untuk agent booking |

---

## 🔧 Maintenance Documentation

| File | Deskripsi |
|------|-----------|
| [cron-jobs.md](maintenance/cron-jobs.md) | Detail semua scheduled tasks |
| [race-condition-case.md](maintenance/race-condition-case.md) | Case study race condition handling |
| [bookingSummary.md](maintenance/bookingSummary.md) | Summary booking |
| [booking-sync-total-handover.md](maintenance/booking-sync-total-handover.md) | Sync total handover booking |

### Bug Fixes

Lihat folder [maintenance/bug/](maintenance/bug/) untuk riwayat bug fix:
- [BUG_FIX_SUBSCHEDULE_EMPTY_STRING.md](maintenance/bug/BUG_FIX_SUBSCHEDULE_EMPTY_STRING.md)
- [CRONJOB-ERROR-FIX-SUMMARY.md](maintenance/bug/CRONJOB-ERROR-FIX-SUMMARY.md)
- [bug-fix-cronjob-release-seats-error-id.md](maintenance/bug/bug-fix-cronjob-release-seats-error-id.md)
- [bug-fix-cronjob-release-seats-error.md](maintenance/bug/bug-fix-cronjob-release-seats-error.md)
- [bug-seat-availability-nan-2026-01-21.md](maintenance/bug/bug-seat-availability-nan-2026-01-21.md)

---

## 📖 Guides & Tutorials

| File | Deskripsi |
|------|-----------|
| [test-plan-agent-round-trip-booking copy.md](guides/test-plan-agent-round-trip-booking%20copy.md) | Test plan untuk agent round trip booking |

### Development Logs

Lihat folder [log/](log/) untuk development logs:
- [DEVLOG-booking-18-02-2026.md](log/DEVLOG-booking-18-02-2026.md)
- [DEVLOG-search-schedule-20-02-2026.md](log/DEVLOG-search-schedule-20-02-2026.md)

---

## 🔗 Related Links

- **Main README**: [../README.md](../README.md)
- **Package.json**: [../package.json](../package.json)

---

## 📝 Menambah Dokumentasi

### Untuk Feature Baru

1. Buat file di folder [features/](features/) atau [features/agent/](features/agent/)
2. Tambahkan link di README ini
3. Update documentation structure jika perlu

### Untuk Bug Fix

1. Tambahkan file di folder [maintenance/bug/](maintenance/bug/)
2. Beri nama dengan format: `bug-{issue}-{date}.md`
3. Include: problem, solution, dan testing

### Untuk Development Log

1. Tambahkan file di folder [log/](log/)
2. Beri nama dengan format: `DEVLOG-{feature}-{date}.md`
3. Include: what changed, why, dan impact

---

## 📞 Need Help?

Untuk pertanyaan atau bantuan, hubungi tim development atau buat issue di repository.

---

**Last Updated**: 2026-04-06
