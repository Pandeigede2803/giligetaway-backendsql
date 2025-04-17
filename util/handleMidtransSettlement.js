

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
const { sendInvoiceAndTicketEmail,sendInvoiceAndTicketEmailRoundTrip } = require("./sendInvoiceAndTicketEmail");
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

  // await sendPaymentSuccessEmail(booking.contact_email, booking);
  await sendInvoiceAndTicketEmail(booking.contact_email, booking,midtransOrderId);

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

  // Cari dua kemungkinan pasangan: -1 dan +1
  const pairTicketIdMinus = `GG-RT-${ticketNumber - 1}`;
  const pairTicketIdPlus = `GG-RT-${ticketNumber + 1}`;

  console.log("🔍 Checking round-trip pairs...");
  console.log("  current ticket_id:", ticketId);
  console.log("  trying pair ticket_ids:", pairTicketIdMinus, "and", pairTicketIdPlus);

  let pairBooking = await Booking.findOne({
    where: { ticket_id: pairTicketIdMinus },
    include: [{ model: Transaction, as: 'transactions' }],
  });

  if (!pairBooking) {
    pairBooking = await Booking.findOne({
      where: { ticket_id: pairTicketIdPlus },
      include: [{ model: Transaction, as: 'transactions' }],
    });
  }

  if (pairBooking) {
    console.log(`✅ Pair booking found: ${pairBooking.ticket_id}`);
  } else {
    console.warn(`❌ Pair booking not found for: ${pairTicketIdMinus} or ${pairTicketIdPlus}`);
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

  // Kirim email dari currentBooking (jika tidak ada pasangan), atau dari yang ganjil jika keduanya ada
  const currentNumberIsOdd = ticketNumber % 2 === 1;
  let emailFromBooking = currentBooking;
  let secondBooking = pairBooking;

  if (pairBooking) {
    const pairNumber = parseInt(pairBooking.ticket_id.split('-')[2], 10);
    const pairIsOdd = pairNumber % 2 === 1;

    if (currentNumberIsOdd) {
      emailFromBooking = currentBooking;
      secondBooking = pairBooking;
    } else if (pairIsOdd) {
      emailFromBooking = pairBooking;
      secondBooking = currentBooking;
    }
  }

  if (emailFromBooking) {
    await sendPaymentSuccessEmailRoundTrip(
      emailFromBooking.contact_email,
      emailFromBooking,
      secondBooking
    );
    await sendInvoiceAndTicketEmailRoundTrip(
      emailFromBooking.contact_email,
      emailFromBooking,
      secondBooking,
      midtransOrderId
    );
    console.log(`📧 [RT] Email sent from booking ${emailFromBooking.ticket_id}`);
  } else {
    console.warn(`⚠️ [RT] Cannot send email: no valid booking for email found`);
  }

  console.log(`✅ [RT] Booking ${ticketId} and its pair updated.`);
};




module.exports = {handleMidtransSettlement,handleMidtransSettlementRoundTrip};