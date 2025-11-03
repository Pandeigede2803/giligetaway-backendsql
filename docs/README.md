# Documentation Index

This directory contains technical documentation for the Gili Getaway Backend system.

---

## Recent Updates

### CronJob Error Fix (Nov 3, 2025)

Critical bug fix for expired booking processing with Telegram error notifications.

**Quick Links:**
- 📋 [Summary](CRONJOB-ERROR-FIX-SUMMARY.md) - Quick overview of the fix
- 🇬🇧 [Detailed Analysis (EN)](bug-fix-cronjob-release-seats-error.md) - Full technical documentation
- 🇮🇩 [Analisis Lengkap (ID)](bug-fix-cronjob-release-seats-error-id.md) - Dokumentasi teknis lengkap
- 📱 [Telegram Setup Guide](telegram-notification-setup.md) - Configure error notifications

---

## Documentation Files

### Bug Fixes & Analysis

| File | Description | Language |
|------|-------------|----------|
| [CRONJOB-ERROR-FIX-SUMMARY.md](CRONJOB-ERROR-FIX-SUMMARY.md) | Quick summary of the cronjob error fix | 🇬🇧 EN |
| [bug-fix-cronjob-release-seats-error.md](bug-fix-cronjob-release-seats-error.md) | Detailed analysis of cronjob release seats error | 🇬🇧 EN |
| [bug-fix-cronjob-release-seats-error-id.md](bug-fix-cronjob-release-seats-error-id.md) | Analisis detail error release seats di cronjob | 🇮🇩 ID |

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

Last Updated: November 3, 2025
