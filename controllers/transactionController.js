// controllers/transactionController.js

const { sequelize, Booking, Transaction, TransportBooking } = require('../models');
const { updateAgentCommission } = require('../util/updateAgentComission');
const { updateTransactionStatus } = require('../util/transactionUtils');
const { Op } = require('sequelize'); // Import Sequelize operators

const updateMultiTransactionStatusHandler = async (req, res) => {
  const { transaction_ids } = req.body; // transaction_ids is now an array of transaction IDs
  const {
    status,
    failure_reason,
    refund_reason,
    payment_method,
    payment_gateway,
    amount_in_usd,
    exchange_rate,
    amount,
    currency,
  } = req.body;

  const transaction = await sequelize.transaction();
  try {
    console.log('Step 1: Starting transaction');

    const updateData = {
      status: status || 'pending',
      failure_reason: failure_reason || null,
      refund_reason: refund_reason || null,
      payment_method: payment_method || null,
      payment_gateway: payment_gateway || null,
      amount: amount || null,
      amount_in_usd: amount_in_usd || 0,
      exchange_rate: exchange_rate || 0,
      currency: currency || null,
    };

    console.log('Step 2: Updating multiple transactions');
    await updateMultiTransactionStatus(transaction_ids, updateData, transaction);

    // Step 3: Commit the transaction after successful update
    await transaction.commit();

    res.status(200).json({
      message: `Transactions with IDs ${transaction_ids.join(', ')} updated successfully`,
    });
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if any error occurs
    res.status(500).json({ error: error.message });
  }
};




// Your controller function here
const updateTransactionStatusHandler = async (req, res) => {
  const { transaction_id } = req.params;
  const {
    status,
    failure_reason,
    refund_reason,
    payment_method,
    payment_gateway,
    amount_in_usd,
    exchange_rate,
    amount,
    currency,
  } = req.body;

  const transaction = await sequelize.transaction();
  try {
    console.log('Step 1: Starting transaction');
    // Ensure that status and other fields are properly formatted (not arrays or objects)
    const updateData = {
      status: status || 'pending',
      failure_reason: failure_reason || null,
      refund_reason: refund_reason || null,
      payment_method: payment_method || null,
      payment_gateway: payment_gateway || null,
      amount: amount || null,
      amount_in_usd: amount_in_usd || 0,
      exchange_rate: exchange_rate || 0,
      currency: currency || null,
    };

    console.log('Step 2: Data to update transaction:', updateData);

    // Update the transaction details
    console.log('Step 3: Updating transaction details');
    await updateTransactionStatus(transaction_id, updateData);

    // Find the related transaction to access the booking_id
    console.log('Step 4: Finding related transaction');
    const transactionRecord = await Transaction.findOne({ where: { transaction_id } });

    if (!transactionRecord) {
      throw new Error(`Transaction with ID ${transaction_id} not found`);
    }

    // Update the related Booking table using the booking_id from the transaction
    console.log('Step 5: Updating related booking');
    const booking = await Booking.findOne({
      where: { id: transactionRecord.booking_id },
      include: [{ model: TransportBooking, as: 'transportBookings' }] // Include TransportBooking data
    });

    if (!booking) {
      throw new Error(`Booking with ID ${transactionRecord.booking_id} not found`);
    }

    let commissionResponse = { success: false, commission: 0 }; // Initialize the commission response

    // If the transaction is successful, update the booking's payment status and stop expiration time
    if (status === 'paid') {
      console.log('Step 6: Updating booking payment status and stopping expiration time');
      await Booking.update(
        {
          payment_status: 'paid',
          payment_method: payment_method || booking.payment_method,
          expiration_time: null
        },
        { where: { id: booking.id } }
      );

      // Update the agent commission if agent is involved and the payment is successful
      if (booking.agent_id) {
        console.log('Step 7: Updating agent commission');
        commissionResponse = await updateAgentCommission(
          booking.agent_id,
          booking.gross_total,
          booking.total_passengers,
          'paid',
          booking.schedule_id,
          booking.subschedule_id,
          booking.id,
          transaction,
          booking.transportBookings // Pass transports to the function
        );
      }
    }

    await transaction.commit(); // Commit the transaction if successful

    res.status(200).json({
      message: `Transaction ${transaction_id} and related booking updated successfully`,
      commission: commissionResponse.commission,  // Return the commission amount
      agent_id: booking.agent_id,
      success: commissionResponse.success ? 'Commission calculated successfully' : 'No commission calculated'
    });
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if any error occurs
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




module.exports = { updateTransactionStatusHandler,updateMultiTransactionStatusHandler, getTransactions,updateTransactionStatusHandler };


// Controller to handle updating transaction status and other details
// const updateTransactionStatusHandler = async (req, res) => {
//   const { transaction_id } = req.params;
//   const { status, failure_reason, refund_reason, payment_method, payment_gateway, amount_in_usd, exchange_rate, amount, currency } = req.body;

//   console.log(`Received transaction update request for transaction ID: ${transaction_id}`);
//   console.log('Request body:', req.body);

//   try {
//     // Ensure that status and other fields are properly formatted (not arrays or objects)
//     const updateData = {
//       status: status || 'pending', // Ensure it's a string, fallback to 'pending' if null
//       failure_reason: failure_reason || null,
//       refund_reason: refund_reason || null,
//       payment_method: payment_method || null,
//       payment_gateway: payment_gateway || null,
//       amount: amount || null,
//       amount_in_usd: amount_in_usd || 0,
//       exchange_rate: exchange_rate || 0,
//       currency: currency || null,
//     };

//     console.log('Data to update transaction:', updateData);

//     // Update the transaction details
//     console.log(`Updating transaction status for transaction ID: ${transaction_id}`);
//     await updateTransactionStatus(transaction_id, updateData);
//     console.log(`Transaction ${transaction_id} updated successfully`);

//     // Find the related transaction to access the booking_id
//     console.log(`Fetching transaction with ID: ${transaction_id}`);
//     const transaction = await Transaction.findOne({ where: { transaction_id } });

//     if (!transaction) {
//       throw new Error(`Transaction with ID ${transaction_id} not found`);
//     }
//     console.log(`Transaction found:`, transaction);

//     // Update the related Booking table using the booking_id from the transaction
//     console.log(`Fetching booking with ID: ${transaction.booking_id}`);
//     const booking = await Booking.findOne({ where: { id: transaction.booking_id } });

//     if (!booking) {
//       throw new Error(`Booking with ID ${transaction.booking_id} not found`);
//     }
//     console.log(`Booking found:`, booking);

//     // If the transaction is successful, update the booking's payment status and stop expiration time
//     if (status === 'paid') {
//       console.log(`Transaction ${transaction_id} is successful, updating booking ID: ${booking.id}`);
//       await Booking.update(
//         {
//           payment_status: 'paid',  // Update payment status
//           payment_method: payment_method || booking.payment_method,  // Update payment method
//           expiration_time: null  // Stop the expiration time
//         },
//         { where: { id: booking.id } }
//       );
//       console.log(`Booking ${booking.id} updated successfully to 'paid' status`);
//     }

//     res.status(200).json({
//       message: `Transaction ${transaction_id} and related booking updated successfully`,
//     });
//     console.log(`Response sent: Transaction ${transaction_id} and booking updated`);
//   } catch (error) {
//     console.error('Error occurred:', error.message);
//     res.status(500).json({ error: error.message });
//   }
// };

// Import Sequelize models (assuming they are in the 'models' directory)
