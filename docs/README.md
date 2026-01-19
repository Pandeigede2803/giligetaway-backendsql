# Documentation Index

This directory contains technical documentation for the Gili Getaway Backend system.

---

## Recent Updates

### Agent Booking Email Enhancement (Nov 4, 2025)

Enhanced round-trip booking emails with complete passenger details and transport information.

**Quick Links:**
- 📧 [Email Enhancement Guide](agent-booking-email-enhancement.md) - Complete documentation of passenger data flow and email improvements

### CronJob Error Fix (Nov 3, 2025)

Critical bug fix for expired booking processing with Telegram error notifications.

**Quick Links:**
- 📋 [Summary](CRONJOB-ERROR-FIX-SUMMARY.md) - Quick overview of the fix
- 🇬🇧 [Detailed Analysis (EN)](bug-fix-cronjob-release-seats-error.md) - Full technical documentation
- 🇮🇩 [Analisis Lengkap (ID)](bug-fix-cronjob-release-seats-error-id.md) - Dokumentasi teknis lengkap
- 📱 [Telegram Setup Guide](telegram-notification-setup.md) - Configure error notifications

---

## Documentation Files

### Feature Enhancements

| File | Description | Language | Status |
|------|-------------|----------|--------|
| [agent-booking-email-enhancement.md](agent-booking-email-enhancement.md) | Round-trip email passenger details & transport info fix | 🇬🇧 EN | ✅ Current |

### API Flows

| File | Description | Language | Status |
|------|-------------|----------|--------|
| [agent-search-schedule-v3-flow.md](agent-search-schedule-v3-flow.md) | Flow for agent search schedule v3 endpoint | ID | ✅ Current |
| [agent-booking-pricing-commission.md](agent-booking-pricing-commission.md) | Pricing and commission flow for agent bookings | ID | ✅ Current |

### Bug Fixes & Analysis

| File | Description | Language | Status |
|------|-------------|----------|--------|
| [CRONJOB-ERROR-FIX-SUMMARY.md](CRONJOB-ERROR-FIX-SUMMARY.md) | Quick summary of the cronjob error fix | 🇬🇧 EN | ✅ Current |
| [bug-fix-cronjob-release-seats-error.md](bug-fix-cronjob-release-seats-error.md) | Detailed analysis of cronjob release seats error | 🇬🇧 EN | ✅ Current |
| [bug-fix-cronjob-release-seats-error-id.md](bug-fix-cronjob-release-seats-error-id.md) | Analisis detail error release seats di cronjob | 🇮🇩 ID | ✅ Current |

### Setup Guides

| File | Description | Language |
|------|-------------|----------|
| [telegram-notification-setup.md](telegram-notification-setup.md) | Complete guide to setup Telegram error notifications | 🇬🇧 EN |

---

## Quick Start

### Setting Up Telegram Notifications

1. **Create a Bot**
   - Message `@BotFather` on Telegram
   - Follow the [Telegram Setup Guide](telegram-notification-setup.md)

2. **Configure Environment**
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

3. **Test It**
   ```bash
   node test-telegram.js
   ```

---

## Contributing to Documentation

When adding new documentation:

1. **Create the file** in the `docs/` directory
2. **Update this README** with a link to your new doc
3. **Use clear naming** (e.g., `feature-name-guide.md`)
4. **Add language tags** if creating multilingual docs
5. **Include examples** and code snippets where relevant

### Documentation Template

```markdown
# [Title]

## Overview
Brief description of what this document covers

## Problem/Feature
What problem does this solve or what feature does this explain

## Solution/Implementation
How it works

## Setup/Usage
Step-by-step instructions

## Examples
Real-world examples

## Troubleshooting
Common issues and solutions

## References
Links to related documentation
```

---

## Document Status

| Status | Meaning |
|--------|---------|
| ✅ Current | Up-to-date and actively maintained |
| ⚠️ Review | Needs review or update |
| 🚧 Draft | Work in progress |
| 📦 Archived | Old version, kept for reference |

---

## Need Help?

- 📧 Contact: [Your Support Email]
- 💬 Slack: [Your Slack Channel]
- 🐛 Issues: [GitHub Issues Link]

---

Last Updated: November 4, 2025
