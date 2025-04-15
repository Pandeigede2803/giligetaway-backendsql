

const {
  Agent,
  Boat,
  AgentMetrics,
  Booking,
  sequelize,
  Destination,
  Schedule,
  Transport,
  Passenger,
  TransportBooking,
  AgentCommission,
  Transaction,
} = require("../models"); // Pastikan jalur impor benar
const { Op } = require("sequelize");

const {sendPaymentSuccessEmail, sendPaymentSuccessEmailRoundTrip} = require("../util/sendPaymentEmail");
const handleMidtransSettlement = async (midtransOrderId, midtransPayload) => {
  // ✅ Ambil hanya bagian awal sebelum "-<timestamp>"
  const transactionId = midtransOrderId.split('-').slice(0, 2).join('-'); 

  console.log(`🔄 Handling Midtrans settlement for transaction ID: ${transactionId}`);
  console.log(`Payload: ${JSON.stringify(midtransPayload, null, 2)}`);

  const transaction = await Transaction.findOne({
    where: { transaction_id: transactionId },
    include: [
      {
        model: Booking,
        as: 'booking',
      },
    ],
  });

  if (!transaction) {
    console.warn(`❌ Transaction with ID ${transactionId} not found`);
    return;
  }

  const booking = transaction.booking;

  if (!booking) {
    console.warn(`❌ Booking not found for transaction ${transaction.transaction_id}`);
    return;
  }

  if (booking.payment_status === 'paid') {
    console.log(`ℹ️ Booking ${booking.id} sudah paid, skip update`);
    return;;
  }

  await transaction.update({
    status: 'paid',
    transaction_id: midtransPayload.transaction_id,
    payment_method: midtransPayload.payment_type,
    amount: Number(midtransPayload.gross_amount),
    paid_at: new Date(),
  });

  await booking.update({
    payment_status: 'paid',
    payment_method: midtransPayload.payment_type,
    expiration_time: null,
  });

  await sendPaymentSuccessEmail(booking.contact_email, booking);

  console.log(`✅ Booking ${booking.id} updated & email sent.`);
};

const handleMidtransSettlementRoundTrip = async (midtransOrderId, midtransPayload) => {
  const transactionId = midtransOrderId.split('-').slice(0, 2).join('-'); 

  console.log(`🔄 [RT] Handling Midtrans settlement for transaction ID: ${transactionId}`);
  console.log(`Payload: ${JSON.stringify(midtransPayload, null, 2)}`);

  const transaction = await Transaction.findOne({
    where: { transaction_id: transactionId },
    include: [{ model: Booking, as: 'booking' }],
  });

  if (!transaction || !transaction.booking) {
    console.warn(`❌ [RT] Transaction or booking not found for ${transactionId}`);
    return;
  }

  const currentBooking = transaction.booking;
  const ticketId = currentBooking.ticket_id;
  const ticketNumber = parseInt(ticketId.split('-')[2], 10);
  const isOdd = ticketNumber % 2 === 1;
  const pairNumber = isOdd ? ticketNumber + 1 : ticketNumber - 1;
  const pairTicketId = `GG-RT-${pairNumber}`;

  console.log("🔍 Checking round-trip pair...");
  console.log("  current ticket_id:", ticketId);
  console.log("  expected pair ticket_id:", pairTicketId);

  // 🧩 Ambil booking pasangan
  const pairBooking = await Booking.findOne({
    where: { ticket_id: pairTicketId },
    include: [{ model: Transaction, as: 'transactions' }],
  });

  if (!pairBooking) {
    console.warn(`❌ Pair booking not found for: ${pairTicketId}`);
    const existingTickets = await Booking.findAll({
      where: { ticket_id: { [Op.like]: 'GG-RT%' } },
    });
    console.log("🧾 Available GG-RT ticket_ids in DB:", existingTickets.map(b => b.ticket_id));
  }

  // ✅ Update transaksi dan booking utama
  await transaction.update({
    status: 'paid',
    transaction_id: midtransPayload.transaction_id,
    payment_method: midtransPayload.payment_type,
    amount: Number(midtransPayload.gross_amount),
    paid_at: new Date(),
    payment_order_id: midtransOrderId,
  });

  await currentBooking.update({
    payment_status: 'paid',
    payment_method: midtransPayload.payment_type,
    expiration_time: null,
  });

  // ✅ Update booking pasangan jika ditemukan
  if (pairBooking) {
    await pairBooking.update({
      payment_status: 'paid',
      payment_method: midtransPayload.payment_type,
      expiration_time: null,
    });

    const pairTx = pairBooking.transactions?.[0];
    if (pairTx) {
      await pairTx.update({
        status: 'paid',
        transaction_id: midtransPayload.transaction_id,
        payment_method: midtransPayload.payment_type,
        amount: Number(midtransPayload.gross_amount),
        paid_at: new Date(),
        payment_order_id: midtransOrderId,
      });
    }
  }

  // ✅ Tentukan booking ganjil untuk pengiriman email
  const emailFromBooking = isOdd ? currentBooking : pairBooking;

  if (emailFromBooking) {
    await sendPaymentSuccessEmailRoundTrip(
      emailFromBooking.contact_email,
      isOdd ? currentBooking : pairBooking,
      isOdd ? pairBooking : currentBooking
    );
    console.log(`📧 [RT] Email sent from booking ${emailFromBooking.ticket_id}`);
  } else {
    console.warn(`⚠️ [RT] Cannot send email: booking ganjil tidak ditemukan`);
  }

  console.log(`✅ [RT] Booking ${ticketId} and pair ${pairTicketId} updated.`);
};



module.exports = {handleMidtransSettlement,handleMidtransSettlementRoundTrip};