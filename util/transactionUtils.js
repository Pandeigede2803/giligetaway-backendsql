// utils/transactionUtils.js
const { Transaction } = require('../models');

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
  
  module.exports = {
    createTransaction,
    updateTransactionStatus
  };