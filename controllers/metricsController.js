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
const moment = require("moment"); // Import Moment.js for date manipulation

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
// Helper function to calculate comparison status and percentage change
const calculateComparison = (current, previous) => {
  const change = previous ? ((current - previous) / previous) * 100 : 0;
  return {
    value: current ?? 0,
    status: current >= previous ? "increase" : "decrease",
    change: `${change.toFixed(2)}%`
  };
};
const getMetricsByAgentId = async (req, res) => {
  const { agent_id } = req.params;
  const { month, year, day } = req.query;

  if (!agent_id) {
    return res.status(400).json({ error: 'Agent ID is required as a route parameter.' });
  }

  try {
    const dateFilter = buildDateFilter({ month, year, day });

    // Define previous period filter (e.g., previous month or year)
    const previousPeriodFilter = buildDateFilter({
      year: month && month === 1 ? year - 1 : year,
      month: month ? month - 1 : undefined,
      day
    });

    // Current metrics
    const currentBookingValue = (await Booking.sum('gross_total', { where: { agent_id, booking_date: dateFilter } })) ?? 0;
    const currentTotalBookingCount = (await Booking.count({ where: { agent_id, booking_date: dateFilter } })) ?? 0;
    const currentTransportBookingCount = (await TransportBooking.count({
      include: [{ model: Booking, where: { agent_id, booking_date: dateFilter } }]
    })) ?? 0;
    const currentTotalCustomers = (await Passenger.count({
      distinct: true,
      col: 'id',
      include: { model: Booking, as: "booking", where: { agent_id, booking_date: dateFilter } }
    })) ?? 0;
    const currentTotalCommission = (await AgentCommission.sum('amount', { where: { agent_id, created_at: dateFilter } })) ?? 0;
    const currentUnpaidToGiligetaway = (await Booking.sum('gross_total', { where: { agent_id, payment_status: 'invoiced', booking_date: dateFilter } })) ?? 0;

    // Previous metrics for comparison
    const previousBookingValue = (await Booking.sum('gross_total', { where: { agent_id, booking_date: previousPeriodFilter } })) ?? 0;
    const previousTotalBookingCount = (await Booking.count({ where: { agent_id, booking_date: previousPeriodFilter } })) ?? 0;
    const previousTransportBookingCount = (await TransportBooking.count({
      include: [{ model: Booking, where: { agent_id, booking_date: previousPeriodFilter } }]
    })) ?? 0;
    const previousTotalCustomers = (await Passenger.count({
      distinct: true,
      col: 'id',
      include: { model: Booking, as: "booking", where: { agent_id, booking_date: previousPeriodFilter } }
    })) ?? 0;
    const previousTotalCommission = (await AgentCommission.sum('amount', { where: { agent_id, created_at: previousPeriodFilter } })) ?? 0;
    const previousUnpaidToGiligetaway = (await Booking.sum('gross_total', { where: { agent_id, payment_status: 'invoiced', booking_date: previousPeriodFilter } })) ?? 0;

    // Metrics with comparison
    const metrics = {
      bookingValue: calculateComparison(currentBookingValue, previousBookingValue),
      totalBookingCount: calculateComparison(currentTotalBookingCount, previousTotalBookingCount),
      transportBookingCount: calculateComparison(currentTransportBookingCount, previousTransportBookingCount),
      totalCustomers: calculateComparison(currentTotalCustomers, previousTotalCustomers),
      totalCommission: calculateComparison(currentTotalCommission, previousTotalCommission),
      unpaidToGiligetaway: calculateComparison(currentUnpaidToGiligetaway, previousUnpaidToGiligetaway),
    };

    // Send the metrics as the response
    res.json({
      status: 'success',
      metrics,
    });
  } catch (error) {
    console.error('Error fetching agent booking metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
};

const getAnnualyMetrics = async (req, res) => {
  
    try {
      const { timeframe } = req.query;
  
      const today = moment();
      let startDate, endDate, data = [];
  
      switch (timeframe) {
        case "Day":
          // Last 7 days
          startDate = today.clone().subtract(6, "days").startOf("day").format("YYYY-MM-DD");
          endDate = today.clone().endOf("day").format("YYYY-MM-DD");
  
          // Aggregate data by day
          data = await Booking.findAll({
            where: {
              booking_date: {
                [Op.between]: [startDate, endDate],
              },
              payment_status: ["Paid", "Invoiced"],
            },
            attributes: [
              [sequelize.fn("DATE", sequelize.col("booking_date")), "date"],
              [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
            ],
            group: ["date"],
            raw: true,
          });
  
          // Fill missing days with 0
          const last7Days = Array.from({ length: 7 }, (_, i) =>
            today.clone().subtract(i, "days").format("YYYY-MM-DD")
          ).reverse();
          data = last7Days.map((date) => data.find((d) => d.date === date) || { date, totalBookings: 0 });
          break;
  
        case "Week":
          // Current month by week
          const currentMonth = today.month() + 1; // Moment.js months are zero-indexed
          const currentYear = today.year();
  
          const weeks = [
            { week: 1, start: today.clone().startOf("month").startOf("week"), end: today.clone().startOf("month").endOf("week") },
            { week: 2, start: today.clone().startOf("month").add(1, "weeks").startOf("week"), end: today.clone().startOf("month").add(1, "weeks").endOf("week") },
            { week: 3, start: today.clone().startOf("month").add(2, "weeks").startOf("week"), end: today.clone().startOf("month").add(2, "weeks").endOf("week") },
            { week: 4, start: today.clone().startOf("month").add(3, "weeks").startOf("week"), end: today.clone().startOf("month").add(3, "weeks").endOf("week") },
            { week: 5, start: today.clone().startOf("month").add(4, "weeks").startOf("week"), end: today.clone().startOf("month").add(4, "weeks").endOf("week") }
          ];
  
          data = await Promise.all(
            weeks.map(async (week) => {
              const bookings = await Booking.count({
                where: {
                  booking_date: {
                    [Op.between]: [
                      week.start.format("YYYY-MM-DD"),
                      week.end.format("YYYY-MM-DD"),
                    ],
                  },
                  payment_status: ["Paid", "Invoiced"],
                },
              });
              return { week: `Week ${week.week}`, totalBookings: bookings };
            })
          );
          break;
  
        case "Month":
          // Current year by month
          startDate = today.clone().startOf("year").format("YYYY-MM-DD");
          endDate = today.clone().endOf("year").format("YYYY-MM-DD");
  
          // Aggregate data by month
          data = await Booking.findAll({
            where: {
              booking_date: {
                [Op.between]: [startDate, endDate],
              },
              payment_status: ["Paid", "Invoiced"],
            },
            attributes: [
              [sequelize.fn("MONTH", sequelize.col("booking_date")), "month"],
              [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
            ],
            group: ["month"],
            raw: true,
          });
  
          // Fill missing months with 0
          const months = Array.from({ length: 12 }, (_, i) => i + 1);
          data = months.map((month) => data.find((d) => d.month === month) || { month, totalBookings: 0 });
          break;
  
        case "Year":
          // Past 4 years
          startDate = today.clone().subtract(3, "years").startOf("year").format("YYYY-MM-DD");
          endDate = today.clone().endOf("year").format("YYYY-MM-DD");
  
          // Aggregate data by year
          data = await Booking.findAll({
            where: {
              booking_date: {
                [Op.between]: [startDate, endDate],
              },
              payment_status: ["Paid", "Invoiced"],
            },
            attributes: [
              [sequelize.fn("YEAR", sequelize.col("booking_date")), "year"],
              [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
            ],
            group: ["year"],
            raw: true,
          });
  
          // Fill missing years with 0
          const years = Array.from({ length: 4 }, (_, i) => today.year() - i).reverse();
          data = years.map((year) => data.find((d) => d.year === year) || { year, totalBookings: 0 });
          break;
  
        default:
          return res.status(400).json({ error: "Invalid timeframe provided. Use 'Day', 'Week', 'Month', or 'Year'." });
      }
  
      return res.json({
        status: "success",
        timeframe,
        data,
      });
    } catch (error) {
      console.error("Error fetching booking metrics:", error);
      return res.status(500).json({ status: "error", message: "Internal server error" });
    }
  };
  

// create get metrics by agent id

module.exports = { getMetrics, getMetricsByAgentId,getAnnualyMetrics };
