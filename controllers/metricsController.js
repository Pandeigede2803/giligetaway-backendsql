const {
  Agent,
  Boat,
  AgentMetrics,
  Booking,
  sequelize,
  Destination,
  Schedule,
  SubSchedule,
  Transport,
  Passenger,
  Transit,
  TransportBooking,
  AgentCommission,
} = require("../models"); // Pastikan jalur impor benar

const { Op } = require("sequelize"); // Sequelize operators

// Helper to parse and build date filter
const buildDateFilter = (dateParams) => {
  const { month, year, day } = dateParams;
  const filter = {};

  if (year) filter[Op.gte] = new Date(year, month ? month - 1 : 0, day || 1);
  if (year && month) filter[Op.lte] = new Date(year, month, 0); // last day of the month
  if (year && month && day) filter[Op.eq] = new Date(year, month - 1, day);

  return filter;
};
const getMetrics = async (req, res) => {
  try {
    const { month, year, day } = req.query; // Month, year, or day filter (optional)
    const dateFilter = buildDateFilter({ month, year, day });

    // 1. Booking Value: Sum of all bookings with any status
    const bookingValue = await Booking.sum("gross_total", {
      where: { booking_date: dateFilter },
    });

    // 2. Payment Received: Sum of bookings with 'paid' status
    const paymentReceived = await Booking.sum("gross_total", {
      where: { booking_date: dateFilter, payment_status: "paid" },
    });

    // 3. Total Refund: Sum of bookings with 'refund' status
    const totalRefund = await Booking.sum("gross_total", {
      where: { booking_date: dateFilter, payment_status: "refund" },
    });

    // 4. Total Agents: Count of all agents
    const totalAgents = await Agent.count();

    // 5. Average Order Value
    const averageOrderValue = await Booking.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("gross_total")), "avgGrossTotal"],
      ],
      where: { booking_date: dateFilter },
    }).then((result) => result?.dataValues.avgGrossTotal || 0);

    // 6. Agent Booking Invoiced
    const agentBookingInvoiced = await Booking.count({
      where: {
        booking_date: dateFilter,
        payment_status: "invoiced",
        agent_id: { [Op.ne]: null },
      },
    });

    // 7. Agent Payment Received
    const agentPaymentReceived = await Booking.count({
      where: {
        booking_date: dateFilter,
        payment_status: "paid",
        agent_id: { [Op.ne]: null },
      },
    });
    const previousPeriodFilter = buildDateFilter({
      month: month ? month - 1 : undefined,
      year: month && month === 1 ? year - 1 : year,
      day,
    });
    const previousBookingValue = await Booking.sum("gross_total", {
      where: { booking_date: previousPeriodFilter },
    });
    const previousPaymentReceived = await Booking.sum("gross_total", {
      where: { booking_date: previousPeriodFilter, payment_status: "paid" },
    });
    const previousTotalRefund = await Booking.sum("gross_total", {
      where: { booking_date: previousPeriodFilter, payment_status: "refund" },
    });
    const previousTotalAgents = await Agent.count(); // Count agents in the previous period

    // 8. Transport Booking Count
    const transportBookingCount = await TransportBooking.count({
      include: {
        model: Booking,
        as: "booking",
        where: { payment_status: "paid", booking_date: dateFilter },
      },
    });

    // 9. Total Booking Count
    const totalBookingCount = await Booking.count({
      where: { booking_date: dateFilter },
    });

    // 10. Total Customers
    const totalCustomers = await Passenger.count({
      include: {
        model: Booking,
        as: "booking",
        where: { booking_date: dateFilter },
      },
    });

    // Previous period filter
  

    // Previous metrics calculations
    const previousAverageOrderValue = await Booking.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("gross_total")), "avgGrossTotal"],
      ],
      where: { booking_date: previousPeriodFilter },
    }).then((result) => result?.dataValues.avgGrossTotal || 0);

    const previousAgentBookingInvoiced = await Booking.count({
      where: {
        booking_date: previousPeriodFilter,
        payment_status: "invoice",
        agent_id: { [Op.ne]: null },
      },
    });

    const previousAgentPaymentReceived = await Booking.count({
      where: {
        booking_date: previousPeriodFilter,
        payment_status: "paid",
        agent_id: { [Op.ne]: null },
      },
    });

    const previousTransportBookingCount = await TransportBooking.count({
      include: {
        model: Booking,
        as: "booking",
        where: { payment_status: "paid", booking_date: previousPeriodFilter },
      },
    });

    const previousTotalBookingCount = await Booking.count({
      where: { booking_date: previousPeriodFilter },
    });

    const previousTotalCustomers = await Passenger.count({
      include: {
        model: Booking,
        as: "booking",
        where: { booking_date: previousPeriodFilter },
      },
    });
    // Calculate percentage changes
    const bookingValueChange = previousBookingValue
      ? ((bookingValue - previousBookingValue) / previousBookingValue) * 100
      : 0;

    const paymentReceivedChange = previousPaymentReceived
      ? ((paymentReceived - previousPaymentReceived) /
          previousPaymentReceived) *
        100
      : 0;
    const totalRefundChange = previousTotalRefund
      ? ((totalRefund - previousTotalRefund) / previousTotalRefund) * 100
      : 0;
    const totalAgentsChange = previousTotalAgents
      ? ((totalAgents - previousTotalAgents) / previousTotalAgents) * 100
      : 0;
    // Calculate percentage changes
    const averageOrderValueChange = previousAverageOrderValue
      ? ((averageOrderValue - previousAverageOrderValue) /
          previousAverageOrderValue) *
        100
      : 0;
    const agentBookingInvoicedChange = previousAgentBookingInvoiced
      ? ((agentBookingInvoiced - previousAgentBookingInvoiced) /
          previousAgentBookingInvoiced) *
        100
      : 0;
    const agentPaymentReceivedChange = previousAgentPaymentReceived
      ? ((agentPaymentReceived - previousAgentPaymentReceived) /
          previousAgentPaymentReceived) *
        100
      : 0;
    const transportBookingCountChange = previousTransportBookingCount
      ? ((transportBookingCount - previousTransportBookingCount) /
          previousTransportBookingCount) *
        100
      : 0;
    const totalBookingCountChange = previousTotalBookingCount
      ? ((totalBookingCount - previousTotalBookingCount) /
          previousTotalBookingCount) *
        100
      : 0;
    const totalCustomersChange = previousTotalCustomers
      ? ((totalCustomers - previousTotalCustomers) / previousTotalCustomers) *
        100
      : 0;

    // Response with status and change for each metric
    res.json({
      status: "success",
      metrics: {
        bookingValue: {
          value: bookingValue,
          status:
            bookingValue >= previousBookingValue ? "increase" : "decrease",
          change: `${bookingValueChange.toFixed(2)}%`,
        },
        paymentReceived: {
          value: paymentReceived,
          status:
            paymentReceived >= previousPaymentReceived
              ? "increase"
              : "decrease",
          change: `${paymentReceivedChange.toFixed(2)}%`,
        },
        totalRefund: {
          value: totalRefund,
          status: totalRefund >= previousTotalRefund ? "increase" : "decrease",
          change: `${totalRefundChange.toFixed(2)}%`,
        },
        totalAgents: {
          value: totalAgents,
          status: totalAgents >= previousTotalAgents ? "increase" : "decrease",
          change: `${totalAgentsChange.toFixed(2)}%`,
        },
        averageOrderValue: {
          value: averageOrderValue,
          status:
            averageOrderValue >= previousAverageOrderValue
              ? "increase"
              : "decrease",
          change: `${averageOrderValueChange.toFixed(2)}%`,
        },
        agentBookingInvoiced: {
          value: agentBookingInvoiced,
          status:
            agentBookingInvoiced >= previousAgentBookingInvoiced
              ? "increase"
              : "decrease",
          change: `${agentBookingInvoicedChange.toFixed(2)}%`,
        },
        agentPaymentReceived: {
          value: agentPaymentReceived,
          status:
            agentPaymentReceived >= previousAgentPaymentReceived
              ? "increase"
              : "decrease",
          change: `${agentPaymentReceivedChange.toFixed(2)}%`,
        },
        transportBookingCount: {
          value: transportBookingCount,
          status:
            transportBookingCount >= previousTransportBookingCount
              ? "increase"
              : "decrease",
          change: `${transportBookingCountChange.toFixed(2)}%`,
        },
        totalBookingCount: {
          value: totalBookingCount,
          status:
            totalBookingCount >= previousTotalBookingCount
              ? "increase"
              : "decrease",
          change: `${totalBookingCountChange.toFixed(2)}%`,
        },
        totalCustomers: {
          value: totalCustomers,
          status:
            totalCustomers >= previousTotalCustomers ? "increase" : "decrease",
          change: `${totalCustomersChange.toFixed(2)}%`,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", error: "Failed to retrieve metrics" });
  }
};

module.exports = { getMetrics };
