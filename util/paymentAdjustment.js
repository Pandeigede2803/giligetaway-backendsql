// utils/paymentAdjustments.js
const { TransportBooking } = require("../models");

// Helper: Rupiah dibuletin ke integer, USD 2 desimal
const roundIDR = (n) => Math.max(0, Math.round(n));
const roundUSD = (n) => Math.max(0, Math.round(n * 100) / 100);

/**
 * ================================================
 * 🔹 applyRefundAdjustments
 * --------------------------------
 * Fungsi ini dipakai untuk menyesuaikan nilai 
 * `ticket_total` di tabel Booking dan 
 * `transport_price` di tabel TransportBooking 
 * ketika terjadi proses refund.
 *
 * Cara kerja:
 * 1. Hitung jumlah refund berdasarkan persentase 
 *    (contoh refund_50 → 50%).
 * 2. Kurangi `ticket_total` Booking sesuai persentase.
 * 3. Loop semua baris TransportBooking milik booking 
 *    → kurangi `transport_price` sesuai persentase.
 * 4. Kembalikan ringkasan hasil perubahan:
 *    - Berapa tiket yang direfund
 *    - Berapa total transport yang direfund
 *    - Total refund keseluruhan
 *    - Nilai baru `ticket_total`
 *    - Detail perubahan tiap transport
 *    - Jika ada gross_total_usd → sesuaikan juga
 *
 * Catatan:
 * - Fungsi ini TIDAK update gross_total booking. 
 *   Itu dilakukan di controller setelah fungsi ini.
 * - Refund dilakukan proporsional berdasarkan 
 *   persentase refund.
 * - Semua update dijalankan dalam transaction (t).
 *
 * @param {BookingInstance} booking 
 *    Instance Booking dari Sequelize 
 *    (wajib sudah punya field ticket_total, gross_total, gross_total_in_usd).
 * @param {number} refundPercentage 
 *    Nilai antara 0–1 (contoh: 0.5 untuk refund 50%).
 * @param {object} t 
 *    Sequelize transaction object.
 *
 * @returns {object} summary
 * {
 *   ticketDelta,        // jumlah yang direfund dari ticket_total
 *   transportDelta,     // jumlah yang direfund dari transport_booking
 *   totalDelta,         // total refund (ticket + transport)
 *   newTicketTotal,     // nilai baru ticket_total
 *   transportChanges,   // detail perubahan tiap transport_booking
 *   totalDeltaUSD       // total refund dalam USD (jika ada)
 * }
 * ================================================
 */
const applyRefundAdjustments = async (booking, refundPercentage, t) => {
  if (refundPercentage <= 0 || refundPercentage > 1) {
    throw new Error("refundPercentage harus antara 0 dan 1");
  }

  // 1) Ticket total
  const origTicketTotal = Number(booking.ticket_total || 0);
  const ticketDeltaRaw = origTicketTotal * refundPercentage;
  const ticketDelta = roundIDR(ticketDeltaRaw);
  const newTicketTotal = roundIDR(origTicketTotal - ticketDelta);

  // 2) Transport prices
  const transportRows = await TransportBooking.findAll({
    where: { booking_id: booking.id },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  let transportDelta = 0;
  const transportChanges = [];
  for (const row of transportRows) {
    const orig = Number(row.transport_price || 0);
    const rowDeltaRaw = orig * refundPercentage;
    const rowDelta = roundIDR(rowDeltaRaw);
    const next = roundIDR(orig - rowDelta);

    if (rowDelta > 0) {
      await row.update({ transport_price: next }, { transaction: t });
    }

    transportDelta += rowDelta;
    transportChanges.push({
      id: row.id,
      original_price: orig,
      refunded: rowDelta,
      new_price: next,
    });
  }

  // 3) Totals
  const totalDelta = ticketDelta + transportDelta;

  let totalDeltaUSD = null;
  if (booking.gross_total_in_usd != null) {
    const grossUSD = Number(booking.gross_total_in_usd || 0);
    totalDeltaUSD = roundUSD(grossUSD * refundPercentage);
  }

  return {
    ticketDelta,
    transportDelta,
    totalDelta,
    newTicketTotal,
    transportChanges,
    totalDeltaUSD,
  };
};

module.exports = { applyRefundAdjustments };
