const {
  Agent,
  Schedule,
  SubSchedule,
  TransportBooking,
  Discount,
  AgentCommission,
  Booking,
  Passenger,
} = require("../models");
const { calculateTicketTotal } = require("./calculateTicketTotal");
const { calculateAgentCommissionAmount } = require("./updateAgentComission");

/**
 * Recalculate ticket_total, gross_total, bank_fee, discount_data, dan agent commission
 * setelah terjadi perubahan jumlah penumpang (misalnya penghapusan passenger).
 *
 * Fungsi ini melakukan update langsung ke tabel Booking dan AgentCommission
 * dalam satu transaction yang diberikan.
 *
 * Urutan kalkulasi:
 *   1. ticket_total    = price_per_pax × (adult + child + infant)
 *   2. transport_total = sum TransportBooking records
 *   0. Count actual adult/child/infant dari tabel Passenger (source of truth, bukan dari booking fields)
 *   3. commission_for_net = commission dari base gross sebelum diskon (untuk basis net diskon)
 *   4. discount_amount = dari net (ticket - commission_for_net), percentage atau fixed
 *   5. base_gross      = (ticket_total - discount) + transport_total
 *   6. bank_fee        = base_gross × rate  (rate diambil dari booking asli)
 *   7. gross_total     = base_gross + bank_fee
 *   8. final_commission = calculateAgentCommissionAmount(gross_total baru)
 *   9. Update Booking (ticket_total, gross_total, bank_fee, discount_data) + AgentCommission
 *
 * Catatan bank_fee:
 *   bank_fee dihitung ulang menggunakan rate yang sama dari booking asli.
 *   Formula: rate     = old_bank_fee / (old_gross_total - old_bank_fee)
 *            bank_fee = base_gross × rate
 *            gross_total = base_gross + bank_fee
 *   Jika booking asli tidak punya bank_fee (= 0), bank_fee tetap 0.
 *
 * @param {Object} params
 * @param {Object} params.booking          - Booking instance hasil findByPk
 * @param {import('sequelize').Transaction} params.transaction - Sequelize transaction aktif
 * @returns {Promise<{total_passengers: number, ticket_total: number, gross_total: number, bank_fee: number, discount_data: Object|null, commission_amount: number|null}>}
 */
const recalculateBookingFinancials = async ({ booking, transaction }) => {
  const booking_id = booking.id;
  const oldGrossTotal = parseFloat(booking.gross_total) || 0;

  // ─── 0. Count actual passengers dari DB — source of truth ────────────────
  // Jangan percaya booking.adult_passengers dll karena bisa stale/salah.
  const allPassengers = await Passenger.findAll({
    where: { booking_id },
    attributes: ['passenger_type'],
    transaction,
  });

  const adult  = allPassengers.filter(p => p.passenger_type === 'adult').length;
  const child  = allPassengers.filter(p => p.passenger_type === 'child').length;
  const infant = allPassengers.filter(p => p.passenger_type === 'infant').length;

  // total_passengers = adult + child (infant tidak menempati kursi, tidak bayar tiket)
  const seatTotal = adult + child;

  console.log(`\n💰 [recalculateBookingFinancials] START — booking_id: ${booking_id}`);
  console.log(`   Passengers (dari DB) → adult: ${adult}, child: ${child}, infant: ${infant}, seatTotal: ${seatTotal}`);
  console.log(`   schedule_id: ${booking.schedule_id}, subschedule_id: ${booking.subschedule_id || "N/A"}`);
  console.log(`   booking_date: ${booking.booking_date}`);
  console.log(`   agent_id: ${booking.agent_id || "none"}`);
  console.log(`   old gross_total: ${oldGrossTotal}, old bank_fee: ${parseFloat(booking.bank_fee) || 0}`);

  // ─── 1. Recalculate ticket_total ─────────────────────────────────────────
  // Infant tidak dihitung dalam ticket pricing — hanya adult + child yang bayar.
  const ticketCalcResult = await calculateTicketTotal(
    booking.schedule_id,
    booking.subschedule_id || null,
    booking.booking_date,
    adult,
    child,
    0
  );

  const newTicketTotal = ticketCalcResult.success
    ? ticketCalcResult.ticketTotal
    : parseFloat(booking.ticket_total);

  console.log(`   [1] ticket_total → ${newTicketTotal}${!ticketCalcResult.success ? " (fallback dari booking lama)" : ""}`);

  // ─── 2. Transport total ───────────────────────────────────────────────────
  // transport_price di TransportBooking adalah harga final (sudah fixed), cukup di-sum.
  const transportBookings = await TransportBooking.findAll({
    where: { booking_id },
    transaction,
  });

  const transportTotal = transportBookings.reduce(
    (sum, tb) => sum + parseFloat(tb.transport_price || 0),
    0
  );

  console.log(`   [2] transport_total → ${transportTotal} (${transportBookings.length} transport record(s))`);

  // ─── 3. Recalculate discount ──────────────────────────────────────────────
  let newDiscountData = booking.discount_data || null;
  let ticketTotalAfterDiscount = newTicketTotal;

  if (newDiscountData && newDiscountData.discountId) {
    console.log(`   [3] Discount found — discountId: ${newDiscountData.discountId}, recalculating...`);

    const discount = await Discount.findByPk(parseInt(newDiscountData.discountId), { transaction });

    if (discount) {
      // Pre-calc commission untuk basis net (sebelum diskon)
      let commissionForNet = 0;
      if (booking.agent_id) {
        const agentForNet = await Agent.findByPk(booking.agent_id, { transaction });
        const tripTypeForNet = await getTripType(booking, transaction);

        if (agentForNet && tripTypeForNet) {
          commissionForNet = calculateAgentCommissionAmount({
            agent: agentForNet,
            tripType: tripTypeForNet,
            grossTotal: newTicketTotal + transportTotal,
            totalPassengers: seatTotal,
            transportBookings,
          });
          console.log(`   [3] commission_for_net (pre-discount basis) → ${commissionForNet}`);
        }
      }

      const netAfterCommission = newTicketTotal - commissionForNet;
      let discountAmount = 0;

      if (discount.discount_type === "percentage") {
        discountAmount = (netAfterCommission * parseFloat(discount.discount_value)) / 100;
        const maxDiscountValue = parseFloat(discount.max_discount) || 0;
        if (maxDiscountValue > 0 && discountAmount > maxDiscountValue) {
          console.log(`   [3] discount capped: ${discountAmount} → ${maxDiscountValue} (max_discount)`);
          discountAmount = maxDiscountValue;
        }
        console.log(`   [3] discount_type: percentage (${discount.discount_value}%) → discount_amount: ${discountAmount}`);
      } else if (discount.discount_type === "fixed") {
        discountAmount = parseFloat(discount.discount_value);
        console.log(`   [3] discount_type: fixed → discount_amount: ${discountAmount}`);
      }

      ticketTotalAfterDiscount = newTicketTotal - discountAmount;
      newDiscountData = {
        discountId: newDiscountData.discountId,
        discountValue: parseFloat(discountAmount.toFixed(2)),
        discountPercentage:
          discount.discount_type === "percentage"
            ? discount.discount_value.toString()
            : "0",
        calculatedFromNet: parseFloat(netAfterCommission.toFixed(2)),
        commissionDeducted: parseFloat(commissionForNet.toFixed(2)),
      };

      console.log(`   [3] ticket_total after discount → ${ticketTotalAfterDiscount}`);
    } else {
      console.warn(`   [3] ⚠️ Discount id=${newDiscountData.discountId} not found, discount skipped`);
    }
  } else {
    console.log(`   [3] No discount_data on this booking, skipping`);
  }

  // ─── 4. base_gross ───────────────────────────────────────────────────────
  const baseGross = parseFloat((ticketTotalAfterDiscount + transportTotal).toFixed(2));
  console.log(`   [4] base_gross → ${baseGross} (ticket_after_discount: ${ticketTotalAfterDiscount} + transport: ${transportTotal})`);

  // ─── 5. Recalculate bank_fee & gross_total ────────────────────────────────
  // bank_fee = persentase dari base_gross baru, menggunakan rate yang sama dari booking asli.
  // Rate diderive dari: old_bank_fee / (old_gross_total - old_bank_fee)
  // Jika booking asli tidak punya bank_fee → bank_fee tetap 0.
  const oldBankFee = parseFloat(booking.bank_fee) || 0;
  let newBankFee = 0;
  let newGrossTotal = baseGross;

  if (oldBankFee > 0) {
    const originalBase = oldGrossTotal - oldBankFee;
    if (originalBase > 0) {
      const bankFeeRate = oldBankFee / originalBase;
      newBankFee = parseFloat((baseGross * bankFeeRate).toFixed(2));
      newGrossTotal = parseFloat((baseGross + newBankFee).toFixed(2));
      console.log(`   [5] bank_fee rate: ${(bankFeeRate * 100).toFixed(2)}% → bank_fee: ${newBankFee}, gross_total: ${newGrossTotal}`);
    }
  } else {
    console.log(`   [5] No bank_fee on original booking, skipping`);
  }

  // ─── 6. Recalculate AgentCommission (hanya jika sudah ada) ──────────────
  // Hanya update jika record AgentCommission sudah ada untuk booking ini.
  // Jika belum ada, skip — commission dibuat di flow lain (createBooking dll).
  let newCommissionAmount = null;
  if (booking.agent_id) {
    const existingCommission = await AgentCommission.findOne({
      where: { booking_id, agent_id: booking.agent_id },
      transaction,
    });

    if (existingCommission) {
      const agentForCommission = await Agent.findByPk(booking.agent_id, { transaction });
      const tripTypeForCommission = await getTripType(booking, transaction);

      if (agentForCommission && tripTypeForCommission) {
        newCommissionAmount = calculateAgentCommissionAmount({
          agent: agentForCommission,
          tripType: tripTypeForCommission,
          grossTotal: newGrossTotal,
          totalPassengers: seatTotal,
          transportBookings,
        });

        const commissionType = parseFloat(agentForCommission.commission_rate) > 0
          ? `percentage (${agentForCommission.commission_rate}% of ${newGrossTotal})`
          : `nominal/fixed (trip_type: ${tripTypeForCommission}, ${seatTotal} pax)`;

        await existingCommission.update({ amount: newCommissionAmount }, { transaction });
        console.log(`   [6] AgentCommission UPDATED → ${newCommissionAmount} [${commissionType}] (agent_id: ${booking.agent_id})`);
      } else {
        console.warn(`   [6] ⚠️ Agent or trip_type not found, commission not updated`);
      }
    } else {
      console.log(`   [6] No existing AgentCommission record, skipping`);
    }
  } else {
    console.log(`   [6] No agent_id, commission skipped`);
  }

  // ─── 7. Update Booking — passenger counts + financial fields ─────────────
  // Semua passenger counts di-sync dari hasil count aktual tabel Passenger.
  await Booking.update(
    {
      adult_passengers:  adult,
      child_passengers:  child,
      infant_passengers: infant,
      total_passengers:  seatTotal,
      ticket_total: parseFloat(newTicketTotal.toFixed(2)),
      gross_total: newGrossTotal,
      bank_fee: newBankFee,
      discount_data: newDiscountData,
    },
    { where: { id: booking_id }, transaction }
  );

  console.log(`   [7] Booking updated — adult: ${adult}, child: ${child}, infant: ${infant}, total_passengers: ${seatTotal}, ticket_total: ${newTicketTotal}, gross_total: ${newGrossTotal}, bank_fee: ${newBankFee}`);
  console.log(`💰 [recalculateBookingFinancials] DONE — booking_id: ${booking_id}\n`);

  return {
    adult_passengers:  adult,
    child_passengers:  child,
    infant_passengers: infant,
    total_passengers:  seatTotal,
    ticket_total:      parseFloat(newTicketTotal.toFixed(2)),
    gross_total:       newGrossTotal,
    bank_fee:          newBankFee,
    discount_data:     newDiscountData,
    commission_amount: newCommissionAmount,
  };
};

/**
 * Helper: resolve trip_type dari subschedule atau schedule booking.
 *
 * @param {Object} booking - Booking instance
 * @param {import('sequelize').Transaction} transaction
 * @returns {Promise<string|null>} trip_type ('long', 'short', 'mid', 'intermediate') atau null
 */
const getTripType = async (booking, transaction) => {
  if (booking.subschedule_id) {
    const sub = await SubSchedule.findByPk(booking.subschedule_id, { transaction });
    return sub ? sub.trip_type : null;
  }
  const sch = await Schedule.findByPk(booking.schedule_id, { transaction });
  return sch ? sch.trip_type : null;
};

module.exports = { recalculateBookingFinancials };
