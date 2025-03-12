// controllers/transactionController.js

const {
  sequelize,
  Booking,
  Transaction,
  TransportBooking,
  Agent
} = require("../models");
const { updateAgentCommission } = require("../util/updateAgentComission");
const {
  updateTransactionStatus,
  updateMultiTransactionStatus,
} = require("../util/transactionUtils");
const { Op } = require("sequelize"); // Import Sequelize operators

const {sendEmailNotificationAgent} = require("../util/sendPaymentEmail");

// const updateMultiTransactionStatusHandler = async (req, res) => {
//   const { transaction_ids } = req.body; // transaction_ids is now an array of transaction IDs
//   const {
//     status,
//     failure_reason,
//     refund_reason,
//     payment_method,
//     payment_gateway,
//     amount_in_usd,
//     exchange_rate,
//     amount,
//     currency,
//   } = req.body;

//   const transaction = await sequelize.transaction();
//   try {
//     console.log('Step 1: Starting transaction');

//     const updateData = {
//       status: status || 'pending',
//       failure_reason: failure_reason || null,
//       refund_reason: refund_reason || null,
//       payment_method: payment_method || null,
//       payment_gateway: payment_gateway || null,
//       amount: amount || null,
//       amount_in_usd: amount_in_usd || 0,
//       exchange_rate: exchange_rate || 0,
//       currency: currency || null,
//     };

//     console.log('Step 2: Updating multiple transactions');
//     await updateMultiTransactionStatus(transaction_ids, updateData, transaction);

//     // Step 3: Commit the transaction after successful update
//     await transaction.commit();

//     res.status(200).json({
//       message: `Transactions with IDs ${transaction_ids.join(', ')} updated successfully`,
//     });
//   } catch (error) {
//     await transaction.rollback(); // Rollback transaction if any error occurs
//     res.status(500).json({ error: error.message });
//   }
// };

// const updateMultiTransactionStatusHandler = async (req, res) => {
//   const {
//     transaction_ids,
//     status,
//     failure_reason,
//     refund_reason,
//     payment_method,
//     payment_gateway,
//     amount_in_usd,
//     exchange_rate,
//     amount,
//     currency,
//   } = req.body;

//   console.log("Starting updateMultiTransactionStatusHandler...");

//   // Input validation
//   if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
//     console.error("Validation Error: transaction_ids must be a non-empty array");
//     return res.status(400).json({
//       success: false,
//       error: 'transaction_ids must be a non-empty array'
//     });
//   }

//   console.log("Unique transaction IDs:", transaction_ids);

//   // Check for duplicate transaction IDs
//   const uniqueTransactionIds = [...new Set(transaction_ids)];
//   if (uniqueTransactionIds.length !== transaction_ids.length) {
//     console.error("Validation Error: Duplicate transaction IDs detected.");
//     return res.status(400).json({
//       success: false,
//       error: 'Duplicate transaction IDs are not allowed'
//     });
//   }

//   const transaction = await sequelize.transaction();

//   try {
//     console.log("Step 1: Verifying if all transactions exist...");
//     // Step 1: Verify all transactions exist and retrieve booking IDs
//     const existingTransactions = await Transaction.findAll({
//       where: {
//         transaction_id: {
//           [Op.in]: uniqueTransactionIds
//         }
//       },
//       attributes: ['transaction_id', 'booking_id'],
//       transaction
//     });

//     console.log("Existing transactions found:", existingTransactions);

//     // Ensure all transactions exist
//     const nonExistentTransactionIds = uniqueTransactionIds.filter(
//       id => !existingTransactions.map(t => t.transaction_id).includes(id)
//     );

//     if (nonExistentTransactionIds.length > 0) {
//       console.error("Some transaction IDs do not exist:", nonExistentTransactionIds);
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         error: 'Some transaction IDs do not exist',
//         nonExistentTransactionIds
//       });
//     }

//     console.log("Step 2: Preparing data to update transactions...");
//     const updateData = {
//       status: status || 'pending',
//       failure_reason: failure_reason || null,
//       refund_reason: refund_reason || null,
//       // payment_method: payment_method || null,
//       // payment_gateway: payment_gateway || null,
//       // amount: amount ? parseFloat(amount) : null,
//       // amount_in_usd: amount_in_usd ? parseFloat(amount_in_usd) : 0,
//       // exchange_rate: exchange_rate ? parseFloat(exchange_rate) : 0,
//       // currency: currency || null,
//     };

//     console.log("Updating transactions with data:", updateData);

//     // Step 3: Use utility to update the transactions
//     const updatedCount = await updateMultiTransactionStatus(uniqueTransactionIds, updateData, transaction);

//     if (updatedCount === 0) {
//       console.warn("No transactions were updated.");
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         error: 'No transactions were updated'
//       });
//     }

//     console.log(`${updatedCount} transactions updated successfully.`);

//     console.log("Step 4: Retrieving related bookings...");
//     const bookingIds = existingTransactions.map(t => t.booking_id);
//     const bookings = await Booking.findAll({
//       where: { id: { [Op.in]: bookingIds } },
//       include: [{ model: TransportBooking, as: 'transportBookings' }],
//       transaction
//     });

//     console.log("Related bookings found:", bookings);

//     console.log("Step 5: Processing each booking and calculating commissions if necessary...");
//     const results = [];
//     for (const booking of bookings) {
//       let commissionResponse = { success: false, commission: 0 };

//       console.log(`Processing booking ID: ${booking.id}`);

//       if (status === 'paid') {
//         console.log(`Updating booking payment status to 'paid' for booking ID: ${booking.id}`);
//         // Update booking payment status
//         await Booking.update(
//           {
//             payment_status: 'paid',
//             payment_method: payment_method || booking.payment_method,
//             expiration_time: null
//           },
//           {
//             where: { id: booking.id },
//             transaction
//           }
//         );

//         // Calculate commission if the booking is linked to an agent
//         if (booking.agent_id) {
//           console.log(`Calculating commission for agent ID: ${booking.agent_id}, booking ID: ${booking.id}`);
//           try {
//             commissionResponse = await updateAgentCommission(
//               booking.agent_id,
//               booking.gross_total,
//               booking.total_passengers,
//               'paid',
//               booking.schedule_id,
//               booking.subschedule_id,
//               booking.id,
//               transaction,
//               booking.transportBookings
//             );
//             console.log(`Commission calculated successfully for booking ID: ${booking.id}:`, commissionResponse);
//           } catch (error) {
//             console.error(`Error calculating commission for booking ${booking.id}:`, error);
//             commissionResponse = {
//               success: false,
//               commission: 0,
//               error: error.message
//             };
//           }
//         } else {
//           console.warn(`No agent linked to booking ID: ${booking.id}`);
//         }
//       } else {
//         console.log(`Booking ID: ${booking.id} not marked as 'paid'. No commission calculation needed.`);
//       }

//       // Append results for each booking
//       results.push({
//         booking_id: booking.id,
//         agent_id: booking.agent_id,
//         commission: commissionResponse.commission,
//         commission_status: commissionResponse.success ? 'Success' : 'Failed',
//         commission_error: commissionResponse.error
//       });
//     }

//     console.log("Step 6: Committing transaction...");
//     await transaction.commit();

//     console.log("Transaction committed successfully.");

//     // Response after successful updates
//     return res.status(200).json({
//       success: true,
//       message: `Transactions and related bookings updated successfully`,
//       updated_transactions: uniqueTransactionIds,
//       booking_results: results,
//       total_commissions: results.reduce((sum, result) => sum + result.commission, 0)
//     });

//   } catch (error) {
//     console.error('Error processing transactions:', error);

//     // Rollback transaction in case of an error
//     await transaction.rollback();

//     return res.status(500).json({
//       success: false,
//       error: 'Failed to process transactions and bookings',
//       details: error.message
//     });
//   }
// };

const updateMultiTransactionStatusHandler = async (req, res) => {
  const {
    transaction_ids,
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
    console.log("Step 1: Fetching existing transactions...");

    // Fetch existing transactions and their statuses
    const existingTransactions = await Transaction.findAll({
      where: {
        transaction_id: { [Op.in]: transaction_ids },
      },
      attributes: ["transaction_id", "booking_id", "status"],
      transaction,
    });

    console.log("Existing transactions found:", existingTransactions);

    // Identify transactions that are not `paid` or `invoiced`
    const transactionsToUpdate = existingTransactions.filter(
      (t) => t.status !== "paid" && t.status !== "invoiced"
    );

    const transactionsToUpdateIds = transactionsToUpdate.map(
      (t) => t.transaction_id
    );

    if (transactionsToUpdateIds.length > 0) {
      console.log("Updating transactions with data...");

      // Prepare update data
      const updateData = {
        ...(typeof status !== "undefined" && { status }),
        ...(typeof failure_reason !== "undefined" && {
          failure_reason: failure_reason || null,
        }),
        ...(typeof refund_reason !== "undefined" && {
          refund_reason: refund_reason || null,
        }),
        ...(typeof payment_method !== "undefined" && { payment_method }),
        ...(typeof payment_gateway !== "undefined" && { payment_gateway }),
        ...(typeof amount !== "undefined" && { amount }),
        ...(typeof amount_in_usd !== "undefined" && {
          amount_in_usd: amount_in_usd ? parseFloat(amount_in_usd) : 0,
        }),
        ...(typeof exchange_rate !== "undefined" && {
          exchange_rate: exchange_rate ? parseFloat(exchange_rate) : 0,
        }),
        ...(typeof currency !== "undefined" && { currency }),
      };

      console.log("Data for transaction update:", updateData);

      // Update transactions
      const updatedCount = await Transaction.update(updateData, {
        where: { transaction_id: { [Op.in]: transactionsToUpdateIds } },
        transaction,
      });

      console.log(`${updatedCount} transactions updated successfully.`);
    } else {
      console.log(
        "No transactions to update. All are already 'paid' or 'invoiced'."
      );
    }

    console.log("Step 2: Fetching related bookings...");

    // Fetch bookings related to the transactions
    const bookingIds = existingTransactions.map((t) => t.booking_id);
    const bookings = await Booking.findAll({
      where: { id: { [Op.in]: bookingIds } },
      attributes: { include: ['id', 'ticket_id', 'agent_id', 'contact_email', 'payment_method', 'gross_total', 'total_passengers', 'schedule_id', 'subschedule_id'] },
      include: [
        { model: TransportBooking, as: "transportBookings" },
        { model: Agent, as: "Agent" } // Include agent details for email notification
      ],
      transaction,
    });

    console.log("Related bookings found:", bookings);

    console.log("Step 3: Updating bookings based on status...");

    const results = [];
    for (const booking of bookings) {
      let commissionResponse = { success: false, commission: 0 };
      let emailSent = false;

      console.log(`Processing booking ID: ${booking.id}`);

      // Update booking payment status
      await Booking.update(
        {
          payment_status: status, // Update to match the transaction status
          payment_method: payment_method || booking.payment_method,
          expiration_time: null,
        },
        {
          where: { id: booking.id },
          transaction,
        }
      );

      if (status === "paid" && booking.agent_id) {
        console.log(
          `Calculating commission for agent ID: ${booking.agent_id}, booking ID: ${booking.id}`
        );

        try {
          commissionResponse = await updateAgentCommission(
            booking.agent_id,
            booking.gross_total,
            booking.total_passengers,
            "paid",
            booking.schedule_id,
            booking.subschedule_id,
            booking.id,
            transaction,
            booking.transportBookings
          );
          console.log(
            `Commission calculated successfully for booking ID: ${booking.id}`,
            commissionResponse
          );;
          
          // Send email notification to agent when status is paid and commission is calculated (even if skipped)
          if (status === "paid" && booking.Agent && booking.Agent.email && booking.contact_email) {
            try {
              // Use Booking.contact_email as the recipient email
              const recipientEmail = booking.contact_email;
              const agentEmail = booking.Agent.email;
              
              console.log(`Sending email notification to: ${recipientEmail}, agent: ${agentEmail}`);
              await sendEmailNotificationAgent(
                recipientEmail,
                agentEmail,
                payment_method || booking.payment_method,
                status,
                booking.ticket_id // Using actual ticket_id or generating a fallback
              );
              console.log(`Email notification sent successfully to: ${recipientEmail}, agent: ${agentEmail}`);
              emailSent = true;
            } catch (emailError) {
              console.error(`Error sending email notification to: ${booking.contact_email}, agent: ${booking.Agent.email}`, emailError);
              // Don't fail the transaction if email sending fails
            }
          } else {
            console.log(`Skipping email notification for booking ID: ${booking.id}. Missing contact_email or agent email.`);
          }
        } catch (error) {
          console.error(
            `Error calculating commission for booking ${booking.id}:`,
            error
          );
          commissionResponse = {
            success: false,
            commission: 0,
            error: error.message,
          };
        }
      } else if (status !== "paid") {
        console.log(
          `Booking ID: ${booking.id} updated to '${status}'. No commission calculation needed.`
        );
      }

      results.push({
        booking_id: booking.id,
        agent_id: booking.agent_id,
        commission: commissionResponse.commission,
        commission_status: commissionResponse.success ? "Success" : "Failed",
        commission_error: commissionResponse.error,
        email_sent: emailSent
      });
    }

    console.log("Step 4: Committing transaction...");
    await transaction.commit();

    console.log("Transaction committed successfully.");

    return res.status(200).json({
      success: true,
      message: `Transactions and related bookings updated successfully`,
      updated_transactions: transaction_ids,
      booking_results: results,
      total_commissions: results.reduce(
        (sum, result) => sum + (parseFloat(result.commission) || 0),
        0
      ),
    });
  } catch (error) {
    console.error("Error processing transactions:", error);

    await transaction.rollback();

    return res.status(500).json({
      success: false,
      error: "Failed to process transactions and bookings",
      details: error.message,
    });
  }
};

const updateMultiAgentTransactionStatus = async (req, res) => {
  const {
    transaction_ids,
    status,
    failure_reason,
    refund_reason,
    payment_gateway,
    payment_method,
    amount_in_usd,
    exchange_rate,
    amount,
    currency,
  } = req.body;

  console.log("Starting updateMultiTransactionStatusHandler...");

  // Validate transaction_ids array
  if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
    console.error("Validation Error: transaction_ids must be a non-empty array");
    return res.status(400).json({
      success: false,
      error: "transaction_ids must be a non-empty array",
    });
  }

  const uniqueTransactionIds = [...new Set(transaction_ids)];
  if (uniqueTransactionIds.length !== transaction_ids.length) {
    console.error("Validation Error: Duplicate transaction IDs detected.");
    return res.status(400).json({
      success: false,
      error: "Duplicate transaction IDs are not allowed",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    console.log("Step 1: Verifying if all transactions exist and are updatable...");

    // Fetch existing transactions and their statuses
    const existingTransactions = await Transaction.findAll({
      where: {
        transaction_id: { [Op.in]: uniqueTransactionIds },
      },
      attributes: ["transaction_id", "booking_id", "status"],
      transaction,
    });

    // Identify transactions that do not exist
    const nonExistentTransactionIds = uniqueTransactionIds.filter(
      (id) => !existingTransactions.map((t) => t.transaction_id).includes(id)
    );

    if (nonExistentTransactionIds.length > 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Some transaction IDs do not exist",
        nonExistentTransactionIds,
      });
    }

    // Identify transactions that are already "paid" or "invoiced"
    const nonUpdatableTransactions = existingTransactions.filter(
      (t) => t.status === "paid" || t.status === "invoiced"
    );

    if (nonUpdatableTransactions.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Transactions with status "paid" or "invoiced" cannot be updated',
        nonUpdatableTransactions: nonUpdatableTransactions.map((t) => t.transaction_id),
      });
    }

    console.log("Step 2: Preparing data to update transactions...");
    const updateData = {
      status,
      failure_reason: failure_reason || null,
      refund_reason: refund_reason || null,
      payment_method:payment_method,
      // payment_gateway:payment_gateway,
      // amount: amount ? parseFloat(amount) : null,
      // amount_in_usd: amount_in_usd ? parseFloat(amount_in_usd) : 0,
      // exchange_rate: exchange_rate ? parseFloat(exchange_rate) : 0,
      currency,
    };

    console.log("Updating transactions with data:", updateData);

    // Update transactions
    const updatedCount = await Transaction.update(updateData, {
      where: { transaction_id: { [Op.in]: uniqueTransactionIds } },
      transaction,
    });

    if (updatedCount[0] === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "No transactions were updated",
      });
    }

    console.log("Step 4: Retrieving related bookings...");
    const bookingIds = existingTransactions.map((t) => t.booking_id);
    const bookings = await Booking.findAll({
      where: { id: { [Op.in]: bookingIds } },
      include: [{ model: TransportBooking, as: "transportBookings" }],
      transaction,
    });

    const results = [];
    for (const booking of bookings) {
      let commissionResponse = { success: false, commission: 0 };

      if (status === "paid" || status === "invoiced" || status === "unpaid") {
        console.log(`Updating booking payment status to '${status}' for booking ID: ${booking.id}`);

        await Booking.update(
          {
            payment_status: status,
            payment_method: payment_method || booking.payment_method,
            expiration_time: null,
          },
          {
            where: { id: booking.id },
            transaction,
          }
        );

        if (booking.agent_id) {
          console.log(`Calculating commission for agent ID: ${booking.agent_id}, booking ID: ${booking.id}, with status: ${status}`);
          
          try {
            commissionResponse = await updateAgentCommission(
              booking.agent_id,
              booking.gross_total,
              booking.total_passengers,
              status,
              booking.schedule_id,
              booking.subschedule_id,
              booking.id,
              transaction,
              booking.transportBookings
            );
            console.log(`Commission calculated successfully for booking ID: ${booking.id}`, commissionResponse);
          } catch (error) {
            console.error(`Error calculating commission for booking ${booking.id}:`, error);
            commissionResponse = { success: false, commission: 0, error: error.message };
          }
        }
      }

      results.push({
        booking_id: booking.id,
        agent_id: booking.agent_id,
        commission: commissionResponse.commission,
        commission_status: commissionResponse.success ? "Success" : "Failed",
        commission_error: commissionResponse.error,
      });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Transactions and related bookings updated successfully`,
      updated_transactions: uniqueTransactionIds,
      booking_results: results,
      total_commissions: results.reduce((sum, result) => sum + result.commission, 0),
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      error: "Failed to process transactions and bookings",
      details: error.message,
    });
  }
};

// Helper function to validate booking status
const isValidBookingStatus = (status) => {
  const validStatuses = ["pending", "paid", "cancelled", "refunded"];
  return validStatuses.includes(status);
};

// Your controller function here
const updateTransactionStatusHandler = async (req, res) => {

  console.log("----UPDATE TRANSACTION BEGIN----");
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

  if (!transaction_id) {
    return res
      .status(400)
      .json({ error: "transaction_id parameter is required" });
  }

  // Validasi status
  const validStatuses = ["paid", "pending", "failed",];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Allowed statuses are: ${validStatuses.join(
        ", "
      )}`,
    });
  }

  // Validasi data numerik
  if (amount_in_usd && typeof amount_in_usd !== "number") {
    return res.status(400).json({ error: "amount_in_usd must be a number" });
  }
  if (exchange_rate && typeof exchange_rate !== "number") {
    return res.status(400).json({ error: "exchange_rate must be a number" });
  }
  // if (amount && typeof amount !== "number") {
  //   return res.status(400).json({ error: "amount must be a number" });
  // }

  const transaction = await sequelize.transaction();
  try {
    console.log("Step 1: Starting transaction");

    // Pastikan transaksi ada dan belum berstatus "paid"
    const existingTransaction = await Transaction.findOne({
      where: { transaction_id },
      transaction,
    });

    if (!existingTransaction) {
      throw new Error(`Transaction with ID ${transaction_id} not found`);
    }

    if (existingTransaction.status === "paid") {
      throw new Error(
        `Cannot update transaction with ID ${transaction_id} as it is already paid`
      );
    }

    // Persiapkan data yang akan diupdate
    const updateData = {
      ...(typeof status !== "undefined" && { status }),
      ...(typeof failure_reason !== "undefined" && { failure_reason }),
      ...(typeof refund_reason !== "undefined" && { refund_reason }),
      ...(typeof payment_method !== "undefined" && { payment_method }),
      ...(typeof payment_gateway !== "undefined" && { payment_gateway }),
      ...(typeof amount !== "undefined" && { amount }),
      ...(typeof amount_in_usd !== "undefined" && { amount_in_usd }),
      ...(typeof exchange_rate !== "undefined" && { exchange_rate }),
      ...(typeof currency !== "undefined" && { currency }),
    };

    console.log("Step 2: Data to update transaction:", updateData);

    // Update the transaction details
    console.log("Step 3: Updating transaction details");
    await updateTransactionStatus(transaction_id, updateData);

    // Find the related booking using booking_id from the transaction
    console.log("Step 4: Finding related transaction");
    const booking = await Booking.findOne({
      where: { id: existingTransaction.booking_id },
      include: [{ model: TransportBooking, as: "transportBookings" }],
      transaction,
    });

    if (!booking) {
      throw new Error(
        `Booking with ID ${existingTransaction.booking_id} not found`
      );
    }

    let commissionResponse = { success: false, commission: 0 };

    // If the transaction status is "paid", update booking and calculate commission
    if (status === "paid") {
      console.log(
        "Step 6: Updating booking payment status and stopping expiration time"
      );
      await Booking.update(
        {
          payment_status: "paid",
          payment_method: payment_method || booking.payment_method,
          expiration_time: null,
        },
        { where: { id: booking.id }, transaction }
      );

      // Calculate commission if booking is linked to an agent
      if (booking.agent_id) {
        console.log("Step 7: Updating agent commission");
        commissionResponse = await updateAgentCommission(
          booking.agent_id,
          booking.gross_total,
          booking.total_passengers,
          "paid",
          booking.schedule_id,
          booking.subschedule_id,
          booking.id,
          transaction,
          booking.transportBookings
        );
      }
    }

    await transaction.commit(); // Commit the transaction if successful

    res.status(200).json({
      message: `Transaction ${transaction_id} and related booking updated successfully`,
      commission: commissionResponse.commission,
      agent_id: booking.agent_id,
      success: commissionResponse.success
        ? "Commission calculated successfully"
        : "No commission calculated",
    });
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if any error occurs
    res.status(500).json({ error: error.message });
  }
};

const updateAgentTransactionStatusHandler = async (req, res) => {
  const { transaction_id } = req.params;
  const {
    status,
    booking_status,
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
    console.log("Starting transaction update for ID:", transaction_id);

    // Retrieve the existing transaction
    const existingTransaction = await Transaction.findOne({
      where: { transaction_id },
      transaction,
    });

    if (!existingTransaction) {
      throw new Error(`Transaction with ID ${transaction_id} not found`);
    }

    if (existingTransaction.status === "paid") {
      throw new Error(
        `Cannot update transaction with ID ${transaction_id} as it is already paid`
      );
    }

    // Prepare the data to update transaction
    const updateData = {
      status: status || "pending",
      failure_reason: failure_reason || null,
      refund_reason: refund_reason || null,
      payment_method: payment_method || null,
      payment_gateway: payment_gateway || null,
      amount: amount || null,
      amount_in_usd: amount_in_usd || 0,
      exchange_rate: exchange_rate || 0,
      currency: currency || null,
    };

    console.log("Updating transaction details:", updateData);

    // Update the transaction details
    await updateTransactionStatus(transaction_id, updateData);

    // Find the related booking using booking_id from the transaction
    const booking = await Booking.findOne({
      where: { id: existingTransaction.booking_id },
      include: [{ model: TransportBooking, as: "transportBookings" }],
      transaction,
    });

    if (!booking) {
      throw new Error(
        `Booking with ID ${existingTransaction.booking_id} not found`
      );
    }

    let commissionResponse = { success: false, commission: 0 };

    // If the transaction status is "paid" or "invoiced", update booking and calculate commission
    if (status === "paid" || status === "invoiced" || status === "unpaid") {
      console.log("Updating booking payment status for status:", status);

      await Booking.update(
        {
          payment_status: status,
          payment_method: payment_method || booking.payment_method,
          expiration_time: null,
        },
        { where: { id: booking.id }, transaction }
      );

      // Calculate commission if booking is linked to an agent
      if (booking.agent_id) {
        console.log("Calculating commission for agent ID:", booking.agent_id);
        commissionResponse = await updateAgentCommission(
          booking.agent_id,
          booking.gross_total,
          booking.total_passengers,
          status,
          booking.schedule_id,
          booking.subschedule_id,
          booking.id,
          transaction,
          booking.transportBookings
        );
      }
    }

    await transaction.commit(); // Commit transaction if successful

    res.status(200).json({
      message: `Transaction ${transaction_id} and related booking updated successfully`,
      commission: commissionResponse.commission,
      agent_id: booking.agent_id,
      success: commissionResponse.success
        ? "Commission calculated successfully"
        : "No commission calculated",
    });
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if any error occurs
    res.status(500).json({ error: error.message });
  }
};


const getTransactions = async (req, res) => {
  console.log('\n=== GET TRANSACTIONS REQUEST STARTED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request Query Parameters:', req.query);

  try {
    const { date, month, payment_status } = req.query;
    const filterConditions = {};

    console.log('\nProcessing Filter Conditions:');

    // For specific date (format: DD-MM-YYYY)
    if (date) {
      console.log('\n→ Date Filter:');
      console.log('Input date:', date);

      const [day, monthValue, year] = date.split('-');
      const formattedDate = new Date(`${year}-${monthValue}-${day}`);
      
      if (isNaN(formattedDate.getTime())) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid date format. Please use DD-MM-YYYY format.',
          data: null
        });
      }

      console.log('Formatted date:', formattedDate);
      filterConditions.transaction_date = {
        [Op.eq]: formattedDate,
      };;
    } else if (month) {
      // For month-year (format: MM-YYYY)
      console.log('\n→ Month Filter:');
      console.log('Input month:', month);

      const [monthNum, year] = month.split('-');
      const startDate = new Date(`${year}-${monthNum}-01`);
      const endDate = new Date(`${year}-${monthNum}-31`);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid month format. Please use MM-YYYY format.',
          data: null
        });
      }

      console.log('Date range:', { startDate, endDate });
      filterConditions.transaction_date = {
        [Op.between]: [startDate, endDate],
      };
    }

    // For payment status
    if (payment_status) {
      console.log('\n→ Payment Status Filter:');
      console.log('Status:', payment_status);
      
      // Validate payment status (assuming valid statuses are: 'pending', 'completed', 'failed')
      const validStatuses = ['pending', 'paid', 'failed','invoiced'];
      if (!validStatuses.includes(payment_status.toLowerCase())) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid payment status. Valid values are: pending, completed, failed',
          data: null
        });
      }
      
      filterConditions.status = payment_status;
    }

    console.log('\nFinal Filter Conditions:', JSON.stringify(filterConditions, null, 2));

    console.log('\nExecuting Database Query...');
    const transactions = await Transaction.findAll({
      where: filterConditions,
      order: [["transaction_date", "DESC"]],
    });

    console.log('\nQuery Results:');
    console.log('Total records found:', transactions.length);
    
    if (transactions.length > 0) {
      console.log('First record:', JSON.stringify(transactions[0], null, 2));
      console.log('Last record:', JSON.stringify(transactions[transactions.length - 1], null, 2));
      
      return res.status(200).json({
        status: 'success',
        message: 'Transactions retrieved successfully',
        data: transactions,
        count: transactions.length
      });
    } else {
      console.log('No records found.');
      return res.status(404).json({
        status: 'success',
        message: 'No transactions found',
        data: [],
        count: 0
      });
    }

  } catch (error) {
    console.error('\n!!! ERROR IN GET TRANSACTIONS !!!');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Error Type:', error.constructor.name);

    console.log('\nSending Response: 500 Internal Server Error');
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      data: null
    });
  } finally {
    console.log('\n=== GET TRANSACTIONS REQUEST COMPLETED ===\n');
  }
};


module.exports = {
  updateTransactionStatusHandler,
  updateMultiAgentTransactionStatus,
  updateMultiTransactionStatusHandler,
  getTransactions,
  updateAgentTransactionStatusHandler,
};

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
