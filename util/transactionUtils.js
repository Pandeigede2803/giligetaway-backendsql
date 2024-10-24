// utils/transactionUtils.js
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
  try {
    // Validate that transaction_ids is an array
    if (!Array.isArray(transaction_ids)) {
      throw new Error('transaction_ids should be an array');
    }

    // Ensure transaction_ids array is not empty
    if (transaction_ids.length === 0) {
      throw new Error('transaction_ids array should not be empty');
    }

    // Validate that updateData is an object and contains at least one key-value pair
    if (typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
      throw new Error('updateData should be a non-empty object');
    }

    console.log('Transaction IDs:', transaction_ids);
    console.log('Update Data:', updateData);

    // Update all transactions that match the provided transaction_ids
    const [updatedCount] = await Transaction.update(updateData, {
      where: { transaction_id: { [Op.in]: transaction_ids } }, // Using Sequelize 'in' operator
      transaction
    });

    if (updatedCount === 0) {
      console.warn(`No transactions were updated for IDs: ${transaction_ids.join(', ')}`);
    } else {
      console.log(`All transactions with IDs ${transaction_ids.join(', ')} updated successfully.`);
    }

    return updatedCount; // Return the number of updated rows
  } catch (error) {
    // Log error details
    console.error(`Failed to update multiple transactions for IDs ${transaction_ids.join(', ')}: ${error.message}`);
    throw new Error(`Failed to update multiple transactions: ${error.message}`);
  }
};
  
  module.exports = {
    createTransaction,
    updateTransactionStatus,
    updateMultiTransactionStatus
  };