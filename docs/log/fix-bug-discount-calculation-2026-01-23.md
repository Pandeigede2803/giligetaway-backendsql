# Bug Fix Log - 23 Januari 2026

## Summary

Fix untuk perhitungan diskon agent booking yang salah. Diskon seharusnya dihitung dari NET (setelah dikurangi komisi agent), bukan dari ticket total langsung.

---

## Issue: Perhitungan Diskon dari Ticket Total (Salah)

### Problem
- Diskon dihitung langsung dari `ticket_total`
- Seharusnya diskon dihitung dari `NET = ticket_total - commission`
- Ini menyebabkan diskon lebih besar dari yang seharusnya

### Contoh Perhitungan (Sebelum - SALAH)
```
ticket_total     = 1,000,000
commission       = 100,000 (10%)
discount (20%)   = 200,000 (20% dari ticket_total = 1,000,000)
final_ticket     = 800,000
```

### Contoh Perhitungan (Sesudah - BENAR)
```
ticket_total     = 1,000,000
commission       = 100,000 (10%)
net              = 900,000 (ticket_total - commission)
discount (20%)   = 180,000 (20% dari NET = 900,000)
final_ticket     = 820,000
```

### Root Cause
Di `bookingAgentController.js`, fungsi `calculateDiscountAmount` langsung menghitung diskon dari `grossTotal` tanpa memperhitungkan komisi agent terlebih dahulu.

```javascript
// SEBELUM (SALAH)
const calculateDiscountAmount = (discount, grossTotal, scheduleId, direction = 'all') => {
  // ...
  discountAmount = (grossTotal * parseFloat(discount.discount_value)) / 100;
  // ...
}
```

---

## Solution

### 1. Update `calculateDiscountAmount` Function

File: `controllers/bookingAgentController.js`

**Perubahan:**
- Tambah parameter `commissionAmount`
- Hitung `netAfterCommission = ticketTotal - commissionAmount`
- Diskon dihitung dari `netAfterCommission`

```javascript
// SESUDAH (BENAR)
const calculateDiscountAmount = (discount, ticketTotal, commissionAmount = 0, scheduleId, direction = 'all') => {
  // Calculate net amount after commission deduction
  const netAfterCommission = ticketTotal - commissionAmount;

  // ...

  // Discount calculated from NET, not ticket_total
  discountAmount = (netAfterCommission * parseFloat(discount.discount_value)) / 100;

  // ...

  return {
    discountAmount,
    finalTotal,
    discountData,
    netAfterCommission
  };
}
```

### 2. Create Utility Function `calculateAgentCommissionAmount`

File: `util/updateAgentComission.js`

**Penambahan:**
Utility function baru untuk menghitung commission amount tanpa menyimpan ke database. Digunakan untuk pre-calculation sebelum discount.

```javascript
const calculateAgentCommissionAmount = ({
  agent,
  tripType,
  grossTotal,
  totalPassengers,
  transportBookings = []
}) => {
  // Calculate base commission (percentage or fixed)
  // Add transport commission if no pickup/dropoff
  return commissionAmount;
}
```

### 3. Update `createAgentBooking` Function

File: `controllers/bookingAgentController.js`

**Perubahan:**
- Pre-calculate commission SEBELUM menghitung diskon
- Pass commission amount ke `calculateDiscountAmount`

```javascript
// Pre-calculate commission for discount calculation
let preCalculatedCommission = 0;
if (bookingData.agent_id) {
  const agent = await Agent.findByPk(bookingData.agent_id);
  // Get trip type...
  preCalculatedCommission = calculateAgentCommissionAmount({
    agent,
    tripType,
    grossTotal,
    totalPassengers: bookingData.total_passengers,
    transportBookings: bookingData.transports || []
  });
}

// Apply discount from NET (after commission)
const discountResult = calculateDiscountAmount(
  discount,
  ticketTotal,
  preCalculatedCommission, // Commission deducted first
  bookingData.schedule_id,
  'departure'
);
```

### 4. Update `createAgentRoundTripBooking` Function

File: `controllers/bookingAgentController.js`

**Perubahan:**
Sama seperti `createAgentBooking`, pre-calculate commission sebelum discount untuk kedua leg (departure dan return).

### 5. Refactor `updateAgentCommissionOptimize`

File: `util/updateAgentComission.js`

**Perubahan:**
Menggunakan `calculateAgentCommissionAmount` untuk menghindari duplikasi kode.

---

## Additional: Telegram Notification

Ditambahkan notifikasi Telegram untuk setiap booking berhasil:

### One-Way Booking
```
✅ AGENT BOOKING SUCCESS
🎫 Ticket: GG-123456
agent id: 5
👤 Contact: John Doe
👥 Passengers: 2
💰 Total: IDR 1.500.000
📅 Date: 2026-01-25
🕒 23/1/2026 14.30.00
```

### Round-Trip Booking
```
✅ AGENT ROUND-TRIP BOOKING SUCCESS
🎫 Departure: GG-RT-123456
🎫 Return: GG-RT-123457
Agent id : 5
👤 Contact: John Doe
👥 Passengers: 2
💰 Total: IDR 3.000.000
📅 Dep: 2026-01-25 | Ret: 2026-01-28
🕒 23/1/2026 14.30.00
```

---

## Issue #2: Missing `net_total` in API Response (CRITICAL)

### Problem
- API response tidak menyertakan `net_total` (pendapatan company setelah dikurangi commission)
- Ini menyebabkan frontend/admin tidak bisa menampilkan data keuangan dengan benar
- Field ini penting untuk tracking revenue dan reporting

### Solution
File: `controllers/bookingAgentController.js`

**Perubahan untuk One-Way Booking:**
```javascript
// Calculate net_total (what company receives after commission)
const commissionAmount = result.commissionResult?.commission || 0;
const netTotal = grossTotal - commissionAmount;

return res.status(201).json({
  // ...
  gross_total: grossTotal,
  net_total: netTotal, // ✅ BARU: Company receives (gross_total - commission)
  // ...
});
```

**Perubahan untuk Round-Trip Booking:**
```javascript
// Calculate net_total for each leg and total
const departureCommission = result.departure.commission?.commission || 0;
const returnCommission = result.return.commission?.commission || 0;
const departureNetTotal = result.departure.booking.gross_total - departureCommission;
const returnNetTotal = result.return.booking.gross_total - returnCommission;
const totalCommission = departureCommission + returnCommission;
const totalNetTotal = totalGross - totalCommission;

return res.status(201).json({
  departure: {
    gross_total: ...,
    net_total: departureNetTotal, // ✅ BARU
    // ...
  },
  return: {
    gross_total: ...,
    net_total: returnNetTotal, // ✅ BARU
    // ...
  },
  total_gross: totalGross,
  total_commission: totalCommission, // ✅ BARU
  total_net: totalNetTotal, // ✅ BARU
  // ...
});
```

### New Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `net_total` | number | Company receives per booking (gross - commission) |
| `total_commission` | number | Total commission semua leg (round-trip only) |
| `total_net` | number | Total company receives (round-trip only) |

### Example Response (One-Way)
```json
{
  "ticket_total": 760000,
  "discount_amount": 117000,
  "gross_total": 643000,
  "net_total": 468000,
  "commission": { "commission": 175000 }
}
```

---

## Files Changed

| File | Changes |
|------|---------|
| `controllers/bookingAgentController.js` | Fix discount calculation, add commission param, add Telegram notification, add net_total to response |
| `util/updateAgentComission.js` | Add `calculateAgentCommissionAmount` utility, refactor `updateAgentCommissionOptimize` |

---

## Alur Perhitungan Baru

```
1. ticket_total = Hitung harga tiket (adult + child + infant)
2. transportTotal = Hitung total transport
3. grossTotal = ticket_total + transportTotal

4. PRE-CALCULATE COMMISSION:
   - Ambil agent data
   - Ambil trip type (long/short/mid/intermediate)
   - Hitung commission dengan utility function

5. CALCULATE DISCOUNT (dari NET):
   - netAfterCommission = ticket_total - commission
   - discountAmount = netAfterCommission × discount_percentage
   - ticketTotalAfterDiscount = ticket_total - discountAmount

6. FINAL:
   - gross_total = ticketTotalAfterDiscount + transportTotal
   - Create booking dengan gross_total baru
```

---

## Testing Checklist

- [ ] Test agent booking one-way dengan diskon
- [ ] Test agent booking round-trip dengan diskon
- [ ] Verify diskon dihitung dari NET (setelah commission)
- [ ] Verify Telegram notification terkirim
- [ ] Verify commission amount tetap benar di database

---

## Related Documentation

- `docs/agent-booking-pricing-commission.md` - Dokumentasi pricing dan commission agent
- `docs/discount-flow-agent-api-21-01-2026.md` - Flow diskon untuk agent API
