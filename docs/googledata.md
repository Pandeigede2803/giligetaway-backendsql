# 📌 GILI GETAWAY — GOOGLE ADS TRACKING MASTER DOCUMENTATION  
### Penyebab Utama Mismatch Conversion • Cara Identifikasi Ads Traffic • Fix Plan 100% Akurat

Dokumen ini merangkum seluruh analisis 3 bulan data tracking, Next.js frontend, WordPress success page, Google Ads requirements, dan data mentah dari frontend/backend.

---

# 1. Mengapa Data Internal ≠ Data Google Ads?
Internal dashboard menghitung **SEMUA booking**:

- Ads
- Organic
- Direct
- WhatsApp
- Instagram
- Referral
- Returning user

Google Ads hanya menghitung:

1. User yang benar-benar klik iklan Ads  
2. User yang tracking-nya **selamat sampai success page**  
3. Data identitas (EC data) valid  
4. Click ID (`gclid` atau `_gcl_aw`) masuk tanpa terhapus

Maka sangat normal:
Internal: 15 booking (Total 40 juta)
Google Ads: 10 booking (17 juta)
Gap akan selalu muncul sampai tracking Ads berjalan 100% sempurna.

---

# 2. Parameter Mana yang Representasi Google Ads?
| Parameter | Makna | Apakah Ads? |
|----------|--------|--------------|
| `gclid` | Google Ads click ID (URL) | ✔ 100% Ads |
| `_gcl_aw` | Google Ads click ID (cookie, encoded) | ✔ 100% Ads |
| `gbraid` | Ads click untuk iOS/Safari | ✔ Ads |
| `wbraid` | Ads click untuk cross-app | ✔ Ads |
| `_gl` (mengandung `_gcl_aw`) | Bundle attribution Google | ✔ Ads |
| `_gcl_au` | Attribution cookie, bukan Ads | ❌ Organic/Direct |
| `_ga` | GA session ID | ❌ Bukan Ads |

✔ **Hanya parameter di kolom “✔ Ads” yang berarti traffic berasal dari Google Ads.**  
❌ `_gcl_au`, `_ga`, `_gl` *tanpa* `_gcl_aw` semuanya adalah NON Ads.

---

# 3. Analisis Data Raw yang Kamu Upload (3 bulan)
Kamu mengirim dua tipe data:

### **Data A — Non Ads**
```json
{
  "_gl": "1*6rwnwf*_gcl_au*..*_ga*...",
  "timestamp": "2025-12-04T07:04:06.295Z"
}