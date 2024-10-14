// controllers/transactionController.js
const { updateTransactionStatus } = require('../util/transactionUtils');

const { Op } = require('sequelize'); // Import Sequelize operators
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


// Controller to fetch transactions with filters and pagination
const getTransactions = async (req, res) => {
  try {
    const { date, month, year, page = 1, limit = 10, payment_status } = req.query;

    // Initialize filter conditions as an empty object
    const filterConditions = {};

    // Check if there are any filters applied
    const hasFilters = date || month || year || payment_status;

    // Filtering by date
    if (date) {
      filterConditions.transaction_date = {
        [Op.eq]: date, // Filter by specific date
      };
    }

    // Filtering by month and year
    if (month && year) {
      filterConditions.transaction_date = {
        [Op.gte]: new Date(`${year}-${month}-01`), // Start of the month
        [Op.lte]: new Date(`${year}-${month}-31`), // End of the month
      };
    }

    // Filtering by year only
    if (year && !month) {
      filterConditions.transaction_date = {
        [Op.gte]: new Date(`${year}-01-01`), // Start of the year
        [Op.lte]: new Date(`${year}-12-31`), // End of the year
      };
    }

    // Filtering by payment_status (paid, pending, failed)
    if (payment_status) {
      filterConditions.status = {
        [Op.eq]: payment_status, // Only include transactions with the specified status
      };
    }

    // Pagination settings
    const offset = (page - 1) * limit; // Calculate offset for pagination

    // Query the database with filters and pagination, or fetch all data if no filters
    const transactions = await Transaction.findAndCountAll({
      where: hasFilters ? filterConditions : {}, // If no filters, pass an empty condition to fetch all data
      limit: parseInt(limit), // Limit per page
      offset: parseInt(offset), // Offset for pagination
      order: [['transaction_date', 'DESC']], // Order by transaction date descending
    });

    // Return the transactions with pagination info
    res.status(200).json({
      total: transactions.count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(transactions.count / limit),
      transactions: transactions.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};




module.exports = { updateTransactionStatusHandler, getTransactions };

