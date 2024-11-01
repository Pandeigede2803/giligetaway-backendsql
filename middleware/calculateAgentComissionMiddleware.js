const calculateAgentCommissionMiddleware = async (req, res, next) => {
    const { status } = req.body;
    const { transaction_id } = req.params;
  
    if (status !== 'paid' && status !== 'invoiced') {
      // Skip commission calculation if status is not "paid" or "invoice"
      return next();
    }
  
    const transaction = await sequelize.transaction();
    try {
      // Fetch the transaction and related booking details
      const existingTransaction = await Transaction.findOne({
        where: { transaction_id },
        transaction,
      });
  
      if (!existingTransaction) {
        throw new Error(`Transaction with ID ${transaction_id} not found`);
      }
  
      const booking = await Booking.findOne({
        where: { id: existingTransaction.booking_id },
        include: [{ model: TransportBooking, as: 'transportBookings' }],
        transaction,
      });
  
      if (booking && booking.agent_id) {
        console.log(`Calculating commission for status: ${status}`);
        const commissionResponse = await updateAgentCommission(
          booking.agent_id,
          booking.gross_total,
          booking.total_passengers,
          status,  // Pass the status as either "invoice" or "paid"
          booking.schedule_id,
          booking.subschedule_id,
          booking.id,
          transaction,
          booking.transportBookings
        );
  
        req.commissionResponse = {
          commission: commissionResponse.commission,
          agent_id: booking.agent_id,
          success: commissionResponse.success ? 'Commission calculated successfully' : 'No commission calculated',
          status,  // Indicate whether it was calculated for "invoice" or "paid"
        };
      } else {
        req.commissionResponse = { commission: 0, success: 'No commission calculated', status };
      }
  
      await transaction.commit();
      next();
    } catch (error) {
      await transaction.rollback();
      res.status(500).json({ error: error.message });
    }
  };
  
  module.exports = calculateAgentCommissionMiddleware;
  