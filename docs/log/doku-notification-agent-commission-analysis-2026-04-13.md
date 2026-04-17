# Analisa DOKU Notification - Agent Commission Hilang

**Date:** 2026-04-13
**Route:** `/api/payment/doku-notification`
**Controller:** `dokuController.handleNotification`

---

## 🔍 MASALAH

Ketika pembayaran DOKU terupdate (notification), agent commission terkadang **hilang** atau tidak ditemukan kembali.

---

## 📋 CODE FLOW ANALISA

### 1. handleNotification Function (Line 190-327)

#### Query Transaction dengan Include (Line 203-223):
```javascript
const transaction = await Transaction.findOne({
  where: { transaction_id: invoiceNumber },
  include: [
    {
      model: Booking,
      as: "booking",
      include: [
        {
          model: AgentCommission,
          as: "agentCommission",
        },
        {
          model: Agent,
          as: "Agent",
        },
      ],
    },
  ],
});
```
✅ **Include AgentCommission & Agent** - Data lengkap

#### Update Transaction (Line 252-257):
```javascript
await transaction.update({
  status: paymentStatus.toLowerCase(),
  payment_data: notificationData,
  payment_method: notificationData.service?.id || "DOKU",
  paid_at: new Date(),
});
```
✅ **Hanya update Transaction table** - Tidak sentuh AgentCommission

#### Update Booking (Line 263-267):
```javascript
await booking.update({
  payment_status: "paid",
  payment_method: notificationData.service?.id || "DOKU",
  expiration_time: null,
});
```
✅ **Hanya update 3 field**:
- `payment_status`
- `payment_method`
- `expiration_time`

❌ **TIDAK update field lain** - AgentCommission tidak terpengaruh

---

### 2. handleRoundTripBooking Function (Line 330-565)

#### Query pairBooking (Line 351-358) - **ISSUE DITEMUKAN!**:

```javascript
let pairBooking = await Booking.findOne({
  where: {
    ticket_id: {
      [Op.or]: [pairTicketIdMinus, pairTicketIdPlus],
    },
  },
  include: [{ model: Transaction, as: "transactions" }],  // ❌ TANPA AgentCommission!
});
```

⚠️ **Masalah:**
- Hanya include `Transaction`
- **TIDAK include** `AgentCommission`
- **TIDAK include** `Agent`

Akibat: Ketika `pairBooking` diakses untuk email, data AgentCommission kosong/undefined.

#### Update currentBooking (Line 382-386):
```javascript
await currentBooking.update({
  payment_status: "paid",
  payment_method: currentBooking.payment_method,
  expiration_time: null,
});
```
✅ **Hanya update 3 field** - Tidak sentuh AgentCommission

#### Update pairBooking (Line 402-406):
```javascript
await pairBooking.update({
  payment_status: "paid",
  payment_method: currentBooking.payment_method,
  expiration_time: null,
});
```
✅ **Hanya update 3 field** - Tidak sentuh AgentCommission

#### Update Transaction (Line 427-430, 450-453):
```javascript
await transaction.update({
  status: "paid",
  paid_at: new Date(),
});
```
✅ **Hanya update Transaction** - Tidak sentuh AgentCommission

---

## ❌ KESIMPULAN

### TIDAK ADA INDIKASI CODE MENGHAPUS/MENGUPDATE AGENT COMMISSION

Dari analisa di atas, **tidak ada code** yang:
1. ❌ Menghapus record AgentCommission
2. ❌ Update AgentCommission ke nilai null/empty
3. ❌ Cascade delete dari Booking ke AgentCommission

Semua `update()` hanya mengubah field spesifik:
- `payment_status`
- `payment_method`
- `expiration_time`
- Transaction `status` & `paid_at`

### 🤔 PENYEBAB KEMUNGKINAN

Karena code tidak menghapus/mereset AgentCommission, penyebab kemungkinan adalah:

#### 1. **Booking Update Memicu AgentCommission Recalculate** (PERLU DICEK)

Di `controllers/agentComission.js` line 1473:
```javascript
await booking.update({ agent_id });
```

Update ke `agent_id` di Booking MUNGKIN memicu:
- Recalculation agent commission
- Create/update AgentCommission record

**Cek apakah ada trigger/hook yang:**
- Saat `booking.agent_id` berubah → hapus/create ulang AgentCommission

#### 2. **Data Tidak Di-query Sepenuhnya** (TIDAK TEPAT)
Di `handleRoundTripBooking`, `pairBooking` tidak include AgentCommission.

**Akibat:**
- Ketika kirim email, `pairBooking.agentCommission` = `undefined`
- Jika ada logic yang bergantung pada `agentCommission.id`, akan fail

#### 3. **Database-Level Issue** (PERLU DICEK)
- Trigger di database yang menghapus AgentCommission saat Booking di-update
- Foreign key constraint yang tidak tepat
- Row-level security / policy yang menghapus data

#### 4. **Race Condition** (PERLU DICEK)
- Booking di-update oleh 2 process sekaligus
- AgentCommission created kemudian dihapus oleh process lain
- `handleNotification` dan process lain jalan bersamaan

#### 5. **Unique Index Conflict** (PERLU DICEK)

Di `models/AgentComission.js` line 44-49:
```javascript
indexes: [
  {
    unique: true,
    fields: ['booking_id', 'agent_id'],
    name: 'unique_booking_agent'
  }
]
```

**POTENTIAL ISSUE:**
- Jika ada attempt create AgentCommission baru dengan same `booking_id` + `agent_id`
- Akan FAIL dan bisa menghapus record lama (tergantung logic)

#### 6. **Middleware/Hook Tidak Terlihat** (PERLU DICEK)

Cek apakah ada:
- `beforeUpdate` hook di Booking model
- Middleware yang jalan saat Booking di-update
- Background job yang sync data Booking → AgentCommission

---

## ✅ PERBAIKAN YANG DILAKUKAN

### 1. Tambah Include di pairBooking Query (Line 351-358)

**SEBELUM:**
```javascript
include: [{ model: Transaction, as: "transactions" }]
```

**SELESAI:**
```javascript
include: [
  { model: Transaction, as: "transactions" },
  { model: AgentCommission, as: "agentCommission" },  // ✅ DITAMBAH
  { model: Agent, as: "Agent" },  // ✅ DITAMBAH
]
```

### 2. Tambah Include di Verification Query (Line 469-477)

**SEBELUM:**
```javascript
include: [{ model: Transaction, as: "transactions" }]
```

**SELESAI:**
```javascript
include: [
  { model: Transaction, as: "transactions" },
  { model: AgentCommission, as: "agentCommission" },  // ✅ DITAMBAH
]
```

### 3. Tambah Debug Log untuk AgentCommission

```javascript
console.log("  Current booking:", {
  id: updatedCurrent.ticket_id,
  status: updatedCurrent.payment_status,
  transaksiStatus: ...,
  hasAgentCommission: !!updatedCurrent.agentCommission,  // ✅ DITAMBAH
  agentCommissionId: updatedCurrent.agentCommission?.id,  // ✅ DITAMBAH
});
```

---

## 🔍 INVESTIGASI LEBIH LANJUT

### Perlu Dicek di Database:

1. **Cek Agent Commission sebelum & sesudah update:**
```sql
SELECT * FROM AgentCommissions WHERE booking_id = <booking_id>;
-- Sebelum handleNotification dipanggil
-- Sesudah handleNotification selesai
```

2. **Cek Triggers/Constraints di Database:**
```sql
-- Cek apakah ada trigger yang menghapus AgentCommission
SHOW TRIGGERS WHERE `Table` = 'AgentCommissions';

-- Cek foreign key constraints
SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'AgentCommissions';
```

3. **Cek Log Update Booking:**
```javascript
// Tambah hook beforeUpdate di Booking model
Booking.beforeUpdate(async (booking, options) => {
  console.log('🔍 Booking beforeUpdate:', {
    id: booking.id,
    changes: options.fields,
    oldValues: booking._previousDataValues,
    newValues: booking.dataValues
  });
});
```

4. **Enable Query Logging di Sequelize:**
```javascript
// Di config/database.js
logging: true, // atau gunakan morgan
logQueryParameters: true,
```

---

## 📝 CATATAN

- **Tanggal:** 2026-04-13
- **Analisis berdasarkan:** Code review
- **Perlu testing:** Untuk konfirmasi penyebab hilangnya AgentCommission
- **Rekomendasi:** Enable query logging & database triggers investigation
