// calculateAgentCommission.js
const updateAgentCommission = require("../utils/updateAgentCommission");
const Booking = require("../models").Booking;
const TransportBooking = require("../models").TransportBooking;

const calculateAgentCommission = async (req, res, next) => {
  const { status } = req.body;
  const transaction = await sequelize.transaction();

  try {
    console.log("Starting agent commission calculation...");

    if (!req.existingTransactions || status !== "paid" && status !== "invoiced") {
      console.log("No transactions to calculate commission for.");
      return next();
    }

    const bookingIds = req.existingTransactions.map((t) => t.booking_id);
    const bookings = await Booking.findAll({
      where: { id: { [Op.in]: bookingIds } },
      include: [{ model: TransportBooking, as: "transportBookings" }],
      transaction,
    });

    const results = [];
    for (const booking of bookings) {
      let commissionResponse = { success: false, commission: 0 };

      if (booking.agent_id) {
        console.log(`Calculating commission for agent ID: ${booking.agent_id}, booking ID: ${booking.id}`);

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
      } else {
        console.warn(`No agent linked to booking ID: ${booking.id}`);
      }

      results.push({
        booking_id: booking.id,
        agent_id: booking.agent_id,
        commission: commissionResponse.commission,
        commission_status: commissionResponse.success ? "Success" : "Failed",
        commission_error: commissionResponse.error,
      });
    }

    req.commissionResults = results; // Pass results to the next handler
    await transaction.commit();
    next();
  } catch (error) {
    console.error("Error in agent commission calculation middleware:", error);
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      error: "Failed to calculate agent commissions",
      details: error.message,
    });
  }
};

module.exports = calculateAgentCommission;