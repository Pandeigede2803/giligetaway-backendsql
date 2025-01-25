const Transaction = require("../models").Transaction; // Import your Transaction model

const transactionUpdateValidation = async (req, res, next) => {
  const { transaction_id } = req.params;
  const {
    status,
    booking_status,
    amount_in_usd,
    exchange_rate,
    amount,
  } = req.body;

  // Check if transaction_id exists
  if (!transaction_id) {
    return res.status(400).json({ error: 'transaction_id parameter is required' });
  }

  // Validate transaction status
  const validTransactionStatuses = ['paid', 'pending', 'failed', 'invoiced'];
  if (status && !validTransactionStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Allowed statuses are: ${validTransactionStatuses.join(', ')}`,
    });
  }

  // Validate booking status
  const validBookingStatuses = ['pending', 'invoiced'];
  if (booking_status && !validBookingStatuses.includes(booking_status)) {
    return res.status(400).json({
      error: `Invalid booking status. Allowed statuses are: ${validBookingStatuses.join(', ')}`,
    });
  }

  // Validate numerical fields
  if (amount_in_usd && typeof amount_in_usd !== 'number') {
    return res.status(400).json({ error: 'amount_in_usd must be a number' });
  }
  if (exchange_rate && typeof exchange_rate !== 'number') {
    return res.status(400).json({ error: 'exchange_rate must be a number' });
  }
  if (amount && typeof amount !== 'number') {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  try {
    // Check the current status of the transaction in the database
    const existingTransaction = await Transaction.findOne({
      where: { transaction_id },
    });

    if (!existingTransaction) {
      return res.status(404).json({ error: `Transaction with ID ${transaction_id} not found` });
    }

    // If the transaction is already "paid" or "invoiced", prevent further updates
    if (existingTransaction.status === 'paid' || existingTransaction.status === 'invoiced') {
      return res.status(400).json({
        error: `Transaction with ID ${transaction_id} is already marked as ${existingTransaction.status} and cannot be updated`,
      });
    }

    // Cannot validate if the transaction is already "paid" or "invoiced"
    // if (status === 'paid' || status === 'invoiced') {
    //   return res.status(400).json({
    //     error: `Cannot change status to ${status} for transaction with ID ${transaction_id}`,
    //   });
    // }

    next();  // Proceed to the next middleware or controller if validations pass
  } catch (error) {
    console.error("Error during transaction status validation:", error);
    res.status(500).json({ error: "An error occurred during validation" });
  }
};


const { body } = require("express-validator");
const { Op } = require("sequelize");

const validateTransactionUpdate = (req, res, next) => {
  const {
    transaction_ids,
    status,
    amount,
    amount_in_usd,
    exchange_rate,
    currency,
  } = req.body;

  console.log("Starting validation middleware...", req.body);

  // Validate transaction_ids
  if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
    console.error("Validation Error: transaction_ids must be a non-empty array");
    return res.status(400).json({
      success: false,
      error: "transaction_ids must be a non-empty array",
    });
  }

  // Check for duplicate transaction IDs
  const uniqueTransactionIds = [...new Set(transaction_ids)];
  if (uniqueTransactionIds.length !== transaction_ids.length) {
    console.error("Validation Error: Duplicate transaction IDs detected.");
    return res.status(400).json({
      success: false,
      error: "Duplicate transaction IDs are not allowed",
    });
  }

  // Validate status (if provided)
  const validStatuses = ["pending","invoiced", "paid", "failed",];
  if (status && !validStatuses.includes(status)) {
    console.error(`Validation Error: Invalid status. Allowed statuses: ${validStatuses.join(", ")}`);
    return res.status(400).json({
      success: false,
      error: `Invalid status. Allowed statuses are: ${validStatuses.join(", ")}`,
    });
  }

  // Validate numeric fields
  if (amount && typeof amount !== "number") {
    console.error("Validation Error: amount must be a number");
    return res.status(400).json({ success: false, error: "amount must be a number" });
  }

  if (amount_in_usd && typeof amount_in_usd !== "number") {
    console.error("Validation Error: amount_in_usd must be a number");
    return res.status(400).json({ success: false, error: "amount_in_usd must be a number" });
  }

  if (exchange_rate && typeof exchange_rate !== "number") {
    console.error("Validation Error: exchange_rate must be a number");
    return res.status(400).json({ success: false, error: "exchange_rate must be a number" });
  }

  // Validate currency (if provided)
  if (currency && typeof currency !== "string") {
    console.error("Validation Error: currency must be a string");
    return res.status(400).json({ success: false, error: "currency must be a string" });
  }

  console.log("Validation successful. Proceeding to controller...");
  next();
};

// Middleware to validate transaction_ids and updateData
const transactionIdsValidation = (req, res, next) => {
  const {  transaction_ids,
    status,
    failure_reason,
    refund_reason,
    payment_method,
    payment_gateway,
    amount_in_usd,
    exchange_rate,
    amount,
    currency, } = req.body;

  // {
  //   transactionIds: [
  //     'TRANS-1736182367222', 'TRANS-1736182367521'
  //   ],
  //   modifiedTransactionData: {
  //     status: 'paid',
  //     currency: 'IDR',
  //     failure_reason: null,
  //     refund_reason: null
  //   }
  // }

  try {
    // Validate that transaction_ids is an array
    console.log("Validating transaction_ids...");
    if (!Array.isArray(transaction_ids)) {
      throw new Error("transaction_ids should be an array");
    }
    console.log("transaction_ids is valid");
    // Ensure transaction_ids array is not empty
    if (transaction_ids.length === 0) {
      throw new Error("transaction_ids array should not be empty");
    }
console.log("transaction_ids array is valid");
    // Validate that updateData is an object and contains at least one key-value pair
  
    // If all validations pass, proceed to the next middleware or handler
    next();
  } catch (error) {
    console.error(" ", error.message);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



module.exports = {
  transactionUpdateValidation,
  validateTransactionUpdate,
  transactionIdsValidation,};