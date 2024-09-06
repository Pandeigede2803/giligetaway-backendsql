// controllers/transactionController.js
const { updateTransactionStatus } = require('../util/transactionUtils');

const { Booking, Transaction } = require('../models'); // Import the Booking and Transaction models

// Controller to handle updating transaction status and other details
const updateTransactionStatusHandler = async (req, res) => {
  const { transaction_id } = req.params;
  const { status, failure_reason, refund_reason, payment_method, payment_gateway, amount, currency } = req.body;

  try {
    // Ensure that status and other fields are properly formatted (not arrays or objects)
    const updateData = {
      status: status || 'pending', // Ensure it's a string, fallback to 'pending' if null
      failure_reason: failure_reason || null,
      refund_reason: refund_reason || null,
      payment_method: payment_method || null,
      payment_gateway: payment_gateway || null,
      amount: amount || null,
      currency: currency || null
    };

    // Update the transaction details
    await updateTransactionStatus(transaction_id, updateData);

    // Find the related transaction to access the booking_id
    const transaction = await Transaction.findOne({ where: { transaction_id } });

    if (!transaction) {
      throw new Error(`Transaction with ID ${transaction_id} not found`);
    }

    // Update the related Booking table using the booking_id from the transaction
    const booking = await Booking.findOne({ where: { id: transaction.booking_id } });

    if (!booking) {
      throw new Error(`Booking with ID ${transaction.booking_id} not found`);
    }

    // If the transaction is successful, update the booking's payment status and stop expiration time
    if (status === 'paid') {
      await Booking.update(
        {
          payment_status: 'paid',  // Update payment status
          payment_method: payment_method || booking.payment_method,  // Update payment method
          expiration_time: null  // Stop the expiration time
        },
        { where: { id: booking.id } }
      );
    }

    res.status(200).json({
      message: `Transaction ${transaction_id} and related booking updated successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { updateTransactionStatusHandler };

