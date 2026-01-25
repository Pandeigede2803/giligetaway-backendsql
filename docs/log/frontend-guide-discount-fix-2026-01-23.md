# Frontend Guide - Discount Calculation Fix (23 Jan 2026)

## Ringkasan Perubahan

Perbaikan perhitungan diskon agent booking. Diskon sekarang dihitung dari **NET** (setelah dikurangi komisi), bukan dari ticket_total.

---

## Perubahan API Response

### 1. One-Way Booking (`POST /agent/booking`)

**Field Baru:**
| Field | Type | Keterangan |
|-------|------|------------|
| `net_total` | number | Pendapatan company (gross_total - commission) |

**Contoh Response:**
```json
{
  "status": "success",
  "booking": {
    "ticket_id": "GG-123456",
    "ticket_total": 760000,
    "discount_amount": 117000,
    "gross_total": 643000,
    "net_total": 468000
  },
  "commission": {
    "commission": 175000
  }
}
```

### 2. Round-Trip Booking (`POST /agent/booking/roundtrip`)

**Field Baru:**
| Field | Type | Keterangan |
|-------|------|------------|
| `departure.net_total` | number | Net pendapatan leg berangkat |
| `return.net_total` | number | Net pendapatan leg pulang |
| `total_commission` | number | Total komisi kedua leg |
| `total_net` | number | Total net pendapatan (total_gross - total_commission) |

**Contoh Response:**
```json
{
  "status": "success",
  "departure": {
    "ticket_id": "GG-RT-123456",
    "gross_total": 643000,
    "net_total": 468000,
    "commission": { "commission": 175000 }
  },
  "return": {
    "ticket_id": "GG-RT-123457",
    "gross_total": 643000,
    "net_total": 468000,
    "commission": { "commission": 175000 }
  },
  "total_gross": 1286000,
  "total_commission": 350000,
  "total_net": 936000
}
```

---

## Perubahan Logika Diskon

### Sebelumnya (SALAH)
```
discount = ticket_total x discount_percentage
```

### Sekarang (BENAR)
```
net = ticket_total - commission
discount = net x discount_percentage
```

### Contoh Perhitungan

| Item | Sebelum | Sesudah |
|------|---------|---------|
| ticket_total | 1,000,000 | 1,000,000 |
| commission (10%) | 100,000 | 100,000 |
| net | - | 900,000 |
| discount (20%) | 200,000 | 180,000 |
| final_ticket | 800,000 | 820,000 |

> **Note:** Nilai diskon sekarang lebih kecil karena dihitung dari NET.

---

## Rekomendasi Frontend

1. **Tampilkan `net_total`** di summary booking untuk admin/agent
2. **Update kalkulasi** di preview booking jika ada
3. **Round-trip:** Gunakan `total_net` dan `total_commission` untuk summary total

---

## Backward Compatibility

- Field lama (`gross_total`, `discount_amount`, `ticket_total`) tetap ada
- Tidak ada breaking changes, hanya penambahan field baru
