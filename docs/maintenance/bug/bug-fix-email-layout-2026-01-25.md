# Bug Fix - Email Layout Order - 2026-01-25

## File Modified
- `util/sendPaymentEmailApiAgent.js`

## Problem
Layout urutan total pada email API Agent Staff tidak sesuai dengan flow perhitungan yang benar. Sebelumnya urutan adalah:
1. Ticket Total
2. Transport Total
3. **Discount** (dikurangi dulu)
4. Subtotal (gross_total)
5. Agent Commission
6. Net Amount

## Root Cause
- Discount ditampilkan sebelum Agent Commission, padahal di backend discount dihitung dari NET setelah commission
- Tidak ada keterangan bahwa discount dihitung setelah commission
- Subtotal menampilkan `gross_total` yang sudah termasuk pengurangan discount, membuat layout membingungkan

## Solution
Mengubah urutan layout menjadi:
1. Ticket Total
2. Transport Total
3. **Subtotal** (ticket + transport, sebelum pengurangan apapun)
4. **Agent Commission** (dikurangi dulu)
5. **Discount (After Agent Commission)** (dikurangi setelah commission)
6. **Net Amount (After Commission)**

## Changes Made

### 1. Function `sendEmailApiAgentStaff` (Line 327-369)
**Before:**
```html
<tr>
  <td>Ticket Total</td>
  <td>${formatIDR(ticketTotal)}</td>
</tr>
<tr>
  <td>Transport Total</td>
  <td>${formatIDR(transportTotal)}</td>
</tr>
<tr>
  <td>Discount (X%)</td>
  <td>-${formatIDR(discountAmount)}</td>
</tr>
<tr>
  <td>Subtotal</td>
  <td>${formatIDR(booking.gross_total)}</td>
</tr>
<tr>
  <td>Agent Commission</td>
  <td>-${formatIDR(totalCommission)}</td>
</tr>
<tr>
  <td>Net Amount</td>
  <td>${formatIDR(netAmount)}</td>
</tr>
```

**After:**
```html
<tr>
  <td>Ticket Total</td>
  <td>${formatIDR(ticketTotal)}</td>
</tr>
<tr>
  <td>Transport Total</td>
  <td>${formatIDR(transportTotal)}</td>
</tr>
<tr>
  <td>Subtotal</td>
  <td>${formatIDR(ticketTotal + transportTotal)}</td>
</tr>
<tr>
  <td>Agent Commission</td>
  <td>-${formatIDR(totalCommission)}</td>
</tr>
<tr>
  <td>Discount (After Agent Commission) - X%</td>
  <td>-${formatIDR(discountAmount)}</td>
</tr>
<tr>
  <td>Net Amount (After Commission)</td>
  <td>${formatIDR(netAmount)}</td>
</tr>
```

### 2. Function `sendEmailApiRoundTripAgentStaff` (Line 809-855)
**Before:**
```html
<tr>
  <td>Total Tickets (Departure + Return)</td>
  <td>${formatIDR(totalTickets)}</td>
</tr>
<tr>
  <td>Total Transport</td>
  <td>${formatIDR(totalTransport)}</td>
</tr>
<tr>
  <td>Total Discount (Dep: X%) (Ret: Y%)</td>
  <td>-${formatIDR(totalDiscount)}</td>
</tr>
<tr>
  <td>Subtotal</td>
  <td>${formatIDR(grossTotal)}</td>
</tr>
<tr>
  <td>Agent Commission</td>
  <td>-${formatIDR(totalCommission)}</td>
</tr>
<tr>
  <td>Net Amount</td>
  <td>${formatIDR(netAmount)}</td>
</tr>
```

**After:**
```html
<tr>
  <td>Total Tickets (Departure + Return)</td>
  <td>${formatIDR(totalTickets)}</td>
</tr>
<tr>
  <td>Total Transport</td>
  <td>${formatIDR(totalTransport)}</td>
</tr>
<tr>
  <td>Subtotal</td>
  <td>${formatIDR(totalTickets + totalTransport)}</td>
</tr>
<tr>
  <td>Agent Commission</td>
  <td>-${formatIDR(totalCommission)}</td>
</tr>
<tr>
  <td>Discount (After Agent Commission) - Dep: X% - Ret: Y%</td>
  <td>-${formatIDR(totalDiscount)}</td>
</tr>
<tr>
  <td>Net Amount (After Commission)</td>
  <td>${formatIDR(netAmount)}</td>
</tr>
```

## Example Calculation
**Booking Data:**
- Ticket Total: Rp 825.000
- Transport Total: Rp 0
- Commission: Rp 175.000
- Discount: Rp 130.000

**Email Display:**
```
Ticket Total:                      Rp 825.000
Transport Total:                   Rp 0
Subtotal:                          Rp 825.000
Agent Commission:                 -Rp 175.000
Discount (After Agent Commission): -Rp 130.000
────────────────────────────────────────────
Net Amount:                        Rp 520.000
```

**Math:** 825.000 - 175.000 - 130.000 = 520.000 ✓

## Testing
- Test dengan booking yang memiliki discount
- Test dengan booking tanpa discount
- Test dengan round trip booking
- Verify bahwa Net Amount tetap sama dengan backend calculation

## Impact
- Email layout sekarang lebih jelas dan akurat
- User/Agent dapat melihat dengan jelas bahwa discount dihitung setelah commission
- Konsisten dengan flow perhitungan di backend

## Related Files
- `controllers/bookingAgentController.js` - Backend calculation logic
- `DISCOUNT_IMPLEMENTATION.md` - Discount implementation documentation
