// utils/transactionUtils.js
const { Hooks } = require('sequelize/lib/hooks');
const { Transaction } = require('../models');
const { Op } = require('sequelize'); // Import Sequelize operators

const createTransaction = async ({
  transaction_id,
  payment_method,
  payment_gateway,
  amount,
  currency,
  transaction_type,
  booking_id,
  failure_reason = null,
  refund_reason = null
}, transaction) => {
  try {
    // Create a new transaction with status 'pending'
    const createdTransaction = await Transaction.create({
      transaction_id,
      payment_method,
      payment_gateway,
      amount,
      currency,
      status: 'pending', // The status starts as 'pending'
      transaction_type,
      booking_id,
      failure_reason,
      refund_reason
    }, { transaction });

    return createdTransaction;
  } catch (error) {
    throw new Error(`Error creating transaction: ${error.message}`);
  }
};


// **
//  * Update the status of a transaction
//  * @param {string} transaction_id - The unique identifier of the transaction
//  * @param {string} status - The new status of the transaction (e.g., 'paid', 'failed', 'refunded')
//  * @param {string} [failure_reason] - Optional reason for transaction failure
//  * @param {string} [refund_reason] - Optional reason for transaction refund
//  * @returns {Promise<void>}
//  */
// Update the status or details of an existing transaction
const updateTransactionStatus = async (transaction_id, updateData) => {
    try {
      const transaction = await Transaction.findOne({ where: { transaction_id } });
      if (!transaction) {
        throw new Error(`Transaction with ID ${transaction_id} not found`);
      }
  
      // Ensure updateData contains correct data types (e.g., status should be a string)
      await Transaction.update(updateData, { where: { transaction_id } });
  
      console.log(`Transaction ${transaction_id} updated successfully`);
    } catch (error) {
      console.error('Error updating transaction status:', error.message);
      throw new Error(`Failed to update transaction: ${error.message}`);
    }
  };



// Function to update the status of multiple transactions
// Function to update the status of multiple transactions by transaction_ids
// Function to update the status of multiple transactions by transaction_ids
const updateMultiTransactionStatus = async (transaction_ids, updateData, transaction) => {
  console.log("----start updateMultiTransactionStatus with transaction_ids----:", transaction_ids);

  try {
    console.log("Transaction IDs:", transaction_ids);
    console.log("Update Data:", updateData);

    // Fetch current transactions to check their status
    const existingTransactions = await Transaction.findAll({
      where: { transaction_id: { [Op.in]: transaction_ids } },
      attributes: ["transaction_id", "status"], // Only fetch necessary fields
      raw: true,
      transaction,
    });

    console.log("🔍 Existing transactions found:", existingTransactions);

    // Filter out transactions that are already 'paid' or 'invoiced'
    const transactionsToUpdate = existingTransactions.filter(
      (t) => t.status !== "paid" && t.status !== "invoiced"
    );

    if (transactionsToUpdate.length === 0) {
      console.log("All transactions are already 'paid' or 'invoiced'. No updates needed.");
      return 0; // No updates needed
    }

    // Extract transaction IDs to update
    const transactionIdsToUpdate = transactionsToUpdate.map((t) => t.transaction_id);

    console.log("Transactions to update:", transactionIdsToUpdate);

    // Update all transactions that need an update
    const [updatedCount] = await Transaction.update(updateData, {
      where: { transaction_id: { [Op.in]: transactionIdsToUpdate } },
      transaction,
      logging: console.log,
      hooks: false, // Disable hooks to avoid unintended changes
    });

    if (updatedCount === 0) {
      console.warn(`No transactions were updated for IDs: ${transactionIdsToUpdate.join(", ")}`);
    } else {
      console.log(`All transactions with IDs ${transactionIdsToUpdate.join(", ")} updated successfully.`);
    }

    return updatedCount; // Return the number of updated rows
  } catch (error) {
    console.error(`Failed to update multiple transactions for IDs ${transaction_ids.join(", ")}: ${error.message}`);
    throw new Error(`Failed to update multiple transactions: ${error.message}`);
  }
};
  module.exports = {
    createTransaction,
    updateTransactionStatus,
    updateMultiTransactionStatus
  };