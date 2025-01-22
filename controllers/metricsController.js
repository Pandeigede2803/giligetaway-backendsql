const { Op, fn, col } = require("sequelize"); // Sequelize operators
const moment = require("moment"); // Import Moment.js for date manipulation
const {
  sequelize,
  Booking,
  AgentCommission,
  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  Agent,
  BookingSeatAvailability,
  Boat,
} = require("../models");

// Fungsi untuk mendapatkan metrik pemesanan berdasarkan sumber
const getBookingMetricsBySource = async (req, res) => {
  try {
    const { timeframe } = req.query;

    if (!timeframe) {
      return res
        .status(400)
        .json({ error: "Timeframe is required (Day, Week, Month, or Year)." });
    }

    const today = moment();
    let startDate, endDate;

    switch (timeframe) {
      case "Day":
        startDate = today
          .clone()
          .subtract(6, "days")
          .startOf("day")
          .format("YYYY-MM-DD");
        endDate = today.clone().endOf("day").format("YYYY-MM-DD");
        break;

      case "Week":
        startDate = today.clone().startOf("month").format("YYYY-MM-DD");
        endDate = today.clone().endOf("month").format("YYYY-MM-DD");
        break;

      case "Month":
        startDate = today.clone().startOf("year").format("YYYY-MM-DD");
        endDate = today.clone().endOf("year").format("YYYY-MM-DD");
        break;

      case "Year":
        startDate = today
          .clone()
          .subtract(3, "years")
          .startOf("year")
          .format("YYYY-MM-DD");
        endDate = today.clone().endOf("year").format("YYYY-MM-DD");
        break;

      default:
        return res.status(400).json({
          error: "Invalid timeframe. Use 'Day', 'Week', 'Month', or 'Year'.",
        });
    }

    // Query metrics grouped by `booking_source`
    const metrics = await Booking.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate],
        },
        payment_status: ["Paid", "Invoiced"],
      },
      attributes: ["booking_source", [fn("COUNT", col("id")), "totalBookings"]],
      group: ["booking_source"],
      raw: true,
    });

    // Ensure all possible booking sources are included, even if 0
    const allSources = ["website", "agent", "direct", "Other"]; // Add all expected booking sources here
    const data = allSources.map((source) => {
      const metric = metrics.find((m) => m.booking_source === source);
      return {
        booking_source: source,
        totalBookings: metric ? parseInt(metric.totalBookings) : 0,
      };
    });

    return res.json({
      status: "success",
      timeframe,
      data,
    });
  } catch (error) {
    console.error("Error fetching booking metrics by source:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

// Helper to parse and build date filter
// month, year, day

// const buildDateFilter = ({ from, to, month, year, day }) => {
//   if (from && to) {
//     return { [Op.between]: [from, to] };
//   }
//   if (year && month && day) {
//     const paddedMonth = month.toString().padStart(2, "0");
//     const paddedDay = day.toString().padStart(2, "0");
//     return sequelize.where(
//       sequelize.fn("DATE", sequelize.col("booking_date")),
//       `${year}-${paddedMonth}-${paddedDay}`
//     );
//   }
//   if (year && month) {
//     const paddedMonth = month.toString().padStart(2, "0");
//     return sequelize.where(
//       sequelize.fn("DATE_FORMAT", sequelize.col("booking_date"), "%Y-%m"),
//       `${year}-${paddedMonth}`
//     );
//   }
//   if (year) {
//     return sequelize.where(
//       sequelize.fn("YEAR", sequelize.col("booking_date")),
//       year
//     );
//   }
//   return undefined;
// };

const buildDateFilter = ({ from, to, month, year, day }) => {
  // For from and to dates
  if (from && to) {
    return { [Op.between]: [from, to] };
  }

  // Convert inputs to numbers and validate
  const numericYear = year ? parseInt(year) : null;
  const numericMonth = month ? parseInt(month) : null;
  const numericDay = day ? parseInt(day) : null;

  // Full date (year, month, day)
  if (numericYear && numericMonth && numericDay) {
    const dateStr = moment(`${numericYear}-${numericMonth}-${numericDay}`).format('YYYY-MM-DD');
    return {
      [Op.and]: [
        sequelize.where(sequelize.fn('YEAR', sequelize.col('booking_date')), numericYear),
        sequelize.where(sequelize.fn('MONTH', sequelize.col('booking_date')), numericMonth),
        sequelize.where(sequelize.fn('DAY', sequelize.col('booking_date')), numericDay)
      ]
    };
  }

  // Year and month
  if (numericYear && numericMonth) {
    const startDate = moment(`${numericYear}-${numericMonth}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${numericYear}-${numericMonth}-01`).endOf('month').format('YYYY-MM-DD');
    
    return {
      [Op.between]: [startDate, endDate]
    };
  }

  // Only year
  if (numericYear) {
    const startDate = moment(`${numericYear}-01-01`).startOf('year').format('YYYY-MM-DD');
    const endDate = moment(`${numericYear}-12-31`).endOf('year').format('YYYY-MM-DD');
    
    return {
      [Op.between]: [startDate, endDate]
    };
  }

  // Default case - return current month if no parameters
  const currentDate = moment();
  return {
    [Op.between]: [
      currentDate.clone().startOf('month').format('YYYY-MM-DD'),
      currentDate.clone().endOf('month').format('YYYY-MM-DD')
    ]
  };
};;

// Controller to fetch metrics
const getMetrics = async (req, res) => {
  try {
    const { from, to, month, year, day } = req.query; // Month, year, or day filter (optional)

    // Build date filters
    const dateFilter =
      from && to
        ? { [Op.between]: [from, to] }
        : buildDateFilter({ month, year, day });

    let previousPeriodFilter;
    if (from && to) {
      const previousFrom = moment(from)
        .subtract(3, "days")
        .format("YYYY-MM-DD");
      const previousTo = moment(to).subtract(3, "days").format("YYYY-MM-DD");
      previousPeriodFilter = { [Op.between]: [previousFrom, previousTo] };
    } else {
      // Calculate previous period for month/year/day
      previousPeriodFilter = buildDateFilter({
        month: month ? (month === 1 ? 12 : month - 1) : undefined,
        year: month && month === 1 ? year - 1 : year,
        day,
      });
    }

    // const dateFilter = buildDateFilter({ month, year, day });

    // const previousPeriodFilter = buildDateFilter({
    //   month: month ? month - 1 : undefined,
    //   year: month && month === 1 ? year - 1 : year,
    //   day,
    // });
    // 1. Booking Value: Sum of all bookings with any status
    const bookingValue =
      (await Booking.sum("gross_total", {
        where: { created_at: dateFilter },
      })) || 0;

    const bookingValueBoat1 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 1 },
          attributes: [],
        },
      ],
      where: {
        created_at: dateFilter,
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id since we're filtering by it
    });


    const bookingNetValueBoat1 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 1 },
          attributes: [],
        },
      ],
      where: {
        created_at: dateFilter,
        payment_status: ['paid', 'invoiced'],
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id since we're filtering by it
    });
    const previousNetValueBoat1 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 1 },
          attributes: [],
        },
      ],
      where: {
       created_at: previousPeriodFilter,
        payment_status: ['paid', 'invoiced'],
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id
    });


    const bookingNetValueBoat2 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 2 },
          attributes: [],
        },
      ],
      where: {
        created_at: dateFilter,
        payment_status: ['paid', 'invoiced'],
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id since we're filtering by it
    });
    const previousNetValueBoat2 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 2 },
          attributes: [],
        },
      ],
      where: {
        created_at: previousPeriodFilter,
        payment_status: ['paid', 'invoiced'],
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id
    });

    const bookingNetValueBoat3 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 3 },
          attributes: [],
        },
      ],
      where: {
        created_at: dateFilter,
        payment_status: ['paid', 'invoiced'],
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id since we're filtering by it
    });
    const previousNetValueBoat3 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 3 },
          attributes: [],
        },
      ],
      where: {
        created_at: previousPeriodFilter,
        payment_status: ['paid', 'invoiced'],
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id
    });

    const previousBookingValueBoat1 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 1 },
          attributes: [],
        },
      ],
      where: {
        created_at: previousPeriodFilter,
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id
    });

    const bookingValueBoat2 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 2 },
          attributes: [],
        },
      ],
      where: {
       created_at: dateFilter,
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id since we're filtering by it
    });

    const previousBookingValueBoat2 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 2 },
          attributes: [],
        },
      ],
      where: {
        created_at: previousPeriodFilter,
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id
    });

    const bookingValueBoat3 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 3 },
          attributes: [],
        },
      ],
      where: {
        created_at: dateFilter,
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id since we're filtering by it
    });

    const previousBookingValueBoat3 = await Booking.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingValue"],
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          where: { boat_id: 3 },
          attributes: [],
        },
      ],
      where: {
        created_at: previousPeriodFilter,
      },
      group: ["schedule.boat_id"], // Changed from schedule.id to boat_id
    });



    const currentValue = Number(
      bookingValueBoat1?.dataValues?.bookingValue || 0
    );

    const previousValue = Number(
      previousBookingValueBoat1?.dataValues?.bookingValue || 0
    );
    const bookingValueBoat1Change =
      previousValue !== 0
        ? ((currentValue - previousValue) / previousValue) * 100
        : 0;

        // net value booking 1
    const currentNetValue1 = Number(
      bookingNetValueBoat1?.dataValues?.bookingValue || 0
    );

    const previousNetValue1 = Number(
      previousNetValueBoat1?.dataValues?.bookingValue || 0
    );
 
    const bookingNetValueBoat1Change = previousNetValue1 !== 0
      ? ((currentNetValue1 - previousNetValue1) / previousNetValue1) * 100
      : 0;

              // net value booking 1
    const currentNetValue2 = Number(
      bookingNetValueBoat2?.dataValues?.bookingValue || 0
    );

    const previousNetValue2 = Number(
      previousNetValueBoat2?.dataValues?.bookingValue || 0
    );
    const bookingNetValueBoat2Change =
      previousValue !== 0
        ? ((currentNetValue2 - previousNetValue2) / previousNetValue2) * 100
        : 0;

              // net value booking 1
    console.log("Calculating net value change for Boat 3...");
    const currentNetValue3 = Number(
      bookingNetValueBoat3?.dataValues?.bookingValue || 0
    );

    const previousNetValue3 = Number(
      previousNetValueBoat3?.dataValues?.bookingValue || 0
    );

    const bookingNetValueBoat3Change =
      previousNetValue3 !== 0
        ? ((currentNetValue3 - previousNetValue3) / previousNetValue3) * 100
        : 0;

    console.log(`Net value change for Boat 3: ${bookingNetValueBoat3Change.toFixed(2)}%`);
    

    // boat 2

    const currentValue2 = Number(
      bookingValueBoat2?.dataValues?.bookingValue || 0
    );
    const previousValue2 = Number(
      previousBookingValueBoat2?.dataValues?.bookingValue || 0
    );
    const bookingValueBoat2Change =
      previousValue !== 0
        ? ((currentValue2 - previousValue2) / previousValue) * 100
        : 0;

    // boat 3

    const currentValue3 = Number(
      bookingValueBoat3?.dataValues?.bookingValue || 0
    );
    const previousValue3 = Number(
      previousBookingValueBoat3?.dataValues?.bookingValue || 0
    );
    const bookingValueBoat3Change =
      previousValue !== 0
        ? ((currentValue3 - previousValue3) / previousValue) * 100
        : 0;

    // AGENT COMSSION BASE ON BOAT 1, 2, 3

    const agentCommissionBoat1 = await AgentCommission.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "commissionValue"],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            created_at: dateFilter,
            payment_status: ["invoiced", "paid"],
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              where: { boat_id: 1 },
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });

    const previousAgentCommissionBoat1 = await AgentCommission.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "commissionValue"],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            created_at: previousPeriodFilter,
            payment_status: ["invoiced", "paid"],
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              where: { boat_id: 1 },
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });

    // Calculate change
    const currentValueAgentBoat1 = Number(
      agentCommissionBoat1?.commissionValue || 0
    );
    const previousValueAgentBoat1 = Number(
      previousAgentCommissionBoat1?.commissionValue || 0
    );

    const commissionChange =
      previousValue !== 0
        ? ((currentValueAgentBoat1 - previousValueAgentBoat1) / previousValue) *
          100
        : 0;

    const agentCommissionBoat2 = await AgentCommission.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "commissionValue"],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            created_at: dateFilter,
            payment_status: ["invoiced", "paid"],
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              where: { boat_id: 2 },
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });

    const previousAgentCommissionBoat2 = await AgentCommission.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "commissionValue"],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            created_at: previousPeriodFilter,
            payment_status: ["invoiced", "paid"],
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              where: { boat_id: 2 },
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });

    // Calculate change
    const currentValueAgentBoat2 = Number(
      agentCommissionBoat2?.commissionValue || 0
    );
    const previousValueAgentBoat2 = Number(
      previousAgentCommissionBoat2?.commissionValue || 0
    );

    const commissionChange2 =
      previousValue !== 0
        ? ((currentValueAgentBoat2 - previousValueAgentBoat2) / previousValue) *
          100
        : 0;

    // agent boat 3

    const agentCommissionBoat3 = await AgentCommission.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "commissionValue"],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            created_at: dateFilter,
            payment_status: ["invoiced", "paid"],
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              where: { boat_id: 3 },
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });

    const previousAgentCommissionBoat3 = await AgentCommission.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "commissionValue"],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            created_at: previousPeriodFilter,
            payment_status: ["invoiced", "paid"],
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              where: { boat_id: 3 },
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });

    // Calculate change
    const currentValueAgentBoat3 = Number(
      agentCommissionBoat3?.commissionValue || 0
    );
    const previousValueAgentBoat3 = Number(
      previousAgentCommissionBoat3?.commissionValue || 0
    );

    const commissionChange3 =
      previousValue !== 0
        ? ((currentValueAgentBoat3 - previousValueAgentBoat3) / previousValue) *
          100
        : 0;

    // 2. Payment Received: Sum of bookings with 'paid' status
    const paymentReceived =
      (await Booking.sum("gross_total", {
        where: { created_at: dateFilter, payment_status: "paid" },
      })) || 0;

    // 3. Total Refund: Sum of bookings with 'refund' status
    const totalRefund =
      (await Booking.sum("gross_total", {
        where: { created_at: dateFilter, payment_status: "refund" },
      })) || 0;

    // 4. Total Agents: Count of all agents
    const totalAgents = await Agent.count();

    // 5. Average Order Value
    const averageOrderValue = await Booking.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("gross_total")), "avgGrossTotal"],
      ],
      where: { created_at: dateFilter },
    }).then((result) => result?.dataValues.avgGrossTotal || 0);

    // 6. Agent Booking Invoiced
    const agentBookingInvoiced =
      (await Booking.sum("gross_total", {
        where: {
          created_at: dateFilter,
          payment_status: "invoiced",
          agent_id: { [Op.ne]: null },
        },
      })) || 0;

    // 7. Agent Payment Received
    const agentPaymentReceived =
      (await Booking.sum("gross_total", {
        where: {
          created_at: dateFilter,
          payment_status: "paid",
          agent_id: { [Op.ne]: null },
        },
      })) || 0;

    // 8. Transport Booking Count
    const transportBookingCount =
      (await TransportBooking.count({
        include: {
          model: Booking,
          as: "booking",
          where: { payment_status: "paid", created_at: dateFilter },
        },
      })) || 0;
    const transportBookingTotal =
      (await TransportBooking.sum("transport_price", {
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [],
            where: {
              created_at: dateFilter,
              payment_status: "paid",
            },
          },
        ],
      })) || 0;

    // 9. Total Booking Count
    const totalBookingCount =
      (await Booking.count({
        where: { created_at: dateFilter },
      })) || 0;

    // 10. Total Customers
    const totalCustomers =
      (await Passenger.count({
        include: {
          model: Booking,
          as: "booking",
          where: { created_at: dateFilter },
        },
      })) || 0;

    // Previous period filter

    // Previous metrics calculations
    const previousAverageOrderValue = await Booking.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("gross_total")), "avgGrossTotal"],
      ],
      where: { created_at: previousPeriodFilter },
    }).then((result) => result?.dataValues.avgGrossTotal || 0);

    // Previous agent invoiced total
    const previousAgentBookingInvoiced =
      (await Booking.sum("gross_total", {
        where: {
          created_at: previousPeriodFilter,
          payment_status: "invoiced",
          // Exclude null agent_id
          agent_id: { [Op.not]: null },
        },
      })) || 0;

  
    // Previous agent paid total
    const previousAgentPaymentReceived =
      (await Booking.sum("gross_total", {
        where: {
          created_at: previousPeriodFilter,
          payment_status: "paid",
          agent_id: { [Op.ne]: null },
        },
      })) || 0;

    const previousTransportBookingCount =
      (await TransportBooking.count({
        include: {
          model: Booking,
          as: "booking",
          where: { payment_status: "paid", created_at: previousPeriodFilter },
        },
      })) || 0;

    const previousTransportBookingTotal =
      (await TransportBooking.sum("transport_price", {
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [], // Kosongkan attributes
            where: {
              created_at: previousPeriodFilter,
              payment_status: "paid",
            },
          },
        ],
      })) || 0;
    const previousTotalBookingCount =
      (await Booking.count({
        where: { created_at: previousPeriodFilter },
      })) || 0;

    const previousTotalCustomers =
      (await Passenger.count({
        include: {
          model: Booking,
          as: "booking",
          where: { created_at: previousPeriodFilter },
        },
      })) || 0;

    const previousBookingValue =
      (await Booking.sum("gross_total", {
        where: { created_at: previousPeriodFilter },
      })) || 0;
    const previousPaymentReceived =
      (await Booking.sum("gross_total", {
        where: { created_at: previousPeriodFilter, payment_status: "paid" },
      })) || 0;
    const previousTotalRefund =
      (await Booking.sum("gross_total", {
        where: { booking_date: previousPeriodFilter, payment_status: "refund" },
      })) || 0;
    const previousTotalAgents = await Agent.count(); // Count agents in the previous period

    // Calculate percentage changes
    const bookingValueChange = previousBookingValue
      ? ((bookingValue - previousBookingValue) / previousBookingValue) * 100
      : 0;

    const paymentReceivedChange = previousPaymentReceived
      ? ((paymentReceived - previousPaymentReceived) /
          previousPaymentReceived) *
        100
      : 0;

    // caluclate percentage changes of booking value boat 1

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

    // Calculate change
    const transportBookingTotalChange = previousTransportBookingTotal
      ? ((transportBookingTotal - previousTransportBookingTotal) /
          previousTransportBookingTotal) *
        100
      : 0;

  

    const currentNetIncome =
      paymentReceived -
      (currentValueAgentBoat1 +
        currentValueAgentBoat2 +
        currentValueAgentBoat3);
        console.log("previousPaymentReceived:", previousPaymentReceived);

        console.log("previousValueAgentBoat3:", previousValueAgentBoat2);

    const previousNetIncome =
      previousPaymentReceived -
      (previousValueAgentBoat1 +
        previousValueAgentBoat2 +
        previousValueAgentBoat3);
    console.log("currentNetIncome:", currentNetIncome);
    console.log("previousNetIncome:", previousNetIncome);

    const change =
      previousNetIncome !== 0
        ? ((currentNetIncome - previousNetIncome) / previousNetIncome) * 100
        : currentNetIncome > 0
        ? 100
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
        // add total transport booking

        transportBooking: {
          value: transportBookingTotal,
          status:
            transportBookingTotal >= previousTransportBookingTotal
              ? "increase"
              : "decrease",
          change: `${transportBookingTotalChange.toFixed(2)}%`,
        },

        // add total booking value boat 1
        bookingValueBoat1: {
          value: currentValue, // This will now be a direct number: 24320000
          status: currentValue >= previousValue ? "increase" : "decrease",
          change: `${bookingValueBoat1Change.toFixed(2)}%`,
        },

        bookingNetValueBoat1: {
          value:currentNetValue1,
          status: currentNetValue1 >= previousNetValue1 ? "increase" : "decrease",
          change: `${bookingNetValueBoat1Change.toFixed(2)}%`,
        },

        // add bookingNetValueboat2 and 3
        bookingNetValueBoat2: {
          value:currentNetValue2,
          status: currentNetValue2 >= previousNetValue2 ? "increase" : "decrease",
          change: `${bookingNetValueBoat2Change.toFixed(2)}%`,
        },

        bookingNetValueBoat3: {
          value:currentNetValue3,
          status: currentNetValue3 >= previousNetValue3 ? "increase" : "decrease",
          change: `${bookingNetValueBoat3Change.toFixed(2)}%`,
        },

        //  create booking value boat 2 and 3
        bookingValueBoat2: {
          value: currentValue2, // This will now be a direct number: 24320000
          status: currentValue2 >= previousValue2 ? "increase" : "decrease",
          change: `${bookingValueBoat2Change.toFixed(2)}%`,
        },
        bookingValueBoat3: {
          value: currentValue3, // This will now be a direct number: 24320000
          status: currentValue3 >= previousValue3 ? "increase" : "decrease",
          change: `${bookingValueBoat3Change.toFixed(2)}%`,
        },
        agentCommissionBoat1: {
          value: currentValueAgentBoat1,
          status:
            currentValueAgentBoat1 >= previousValueAgentBoat1
              ? "increase"
              : "decrease",
          change: `${commissionChange.toFixed(2)}%`,
        },
        agentCommissionBoat2: {
          value: currentValueAgentBoat2,
          status:
            currentValueAgentBoat2 >= previousValueAgentBoat2
              ? "increase"
              : "decrease",
          change: `${commissionChange2.toFixed(2)}%`,
        },
        agentCommissionBoat3: {
          value: currentValueAgentBoat3,
          status:
            currentValueAgentBoat3 >= previousValueAgentBoat3
              ? "increase"
              : "decrease",
          change: `${commissionChange3.toFixed(2)}%`,
        },
        netIncome: {
          value: currentNetIncome,
          status:
            currentNetIncome >= previousNetIncome ? "increase" : "decrease",
          change:
            `${change.toFixed(2)}%`,
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
    change: `${change.toFixed(2)}%`,
  };
};







// Get metrics by agent ID
const getMetricsByAgentId = async (req, res) => {
  const { agent_id } = req.params;
  const { from, to, month, year, day } = req.query;

  console.log("Agent ID:", agent_id);
  console.log("Date Filters:", { from, to, month, year, day });

  if (!agent_id) {
    return res
      .status(400)
      .json({ error: "Agent ID is required as a route parameter." });
  }

  // Validasi tanggal dari dan ke
  if (from && to) {
    const isValidFrom = moment(from, "YYYY-MM-DD", true).isValid();
    const isValidTo = moment(to, "YYYY-MM-DD", true).isValid();

    if (!isValidFrom || !isValidTo) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD for 'from' and 'to'.",
      });
    }
  }
  try {
    // Filter berdasarkan rentang tanggal atau bulan/tahun/hari
    const dateFilter =
      from && to
        ? { [Op.between]: [from, to] }
        : buildDateFilter({ month, year, day });

    // Define previous period filter (e.g., previous month or year)
    // Filter untuk periode sebelumnya
    const previousPeriodFilter =
      from && to
        ? {
            [Op.between]: [
              moment(from).subtract(1, "months").format("YYYY-MM-DD"),
              moment(to).subtract(1, "months").format("YYYY-MM-DD"),
            ],
          }
        : buildDateFilter({
            year: month && month === 1 ? year - 1 : year,
            month: month ? month - 1 : undefined,
            day,
          });

    // Current metrics
    const currentBookingValue =
      (await Booking.sum("gross_total", {
        where: {
          agent_id,
          payment_status: ["paid", "invoiced"],
          created_at: dateFilter,
        },
      })) ?? 0;

    const currentTotalBookingCount =
      (await Booking.count({
        where: { agent_id, created_at: dateFilter },
      })) ?? 0;
    // const currentTransportBooking =
    //   (await TransportBooking.sum("transport_price", {
    //     attributes:[],
    //     include: [
    //       { model: Booking, where: { agent_id, booking_date: dateFilter } },
    //     ],
    //   })) ?? 0;

    const currentTransportBooking =
      (await TransportBooking.sum("transport_price", {
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [],
            where: {
              created_at: dateFilter,
              payment_status: "paid",
            },
          },
        ],
      })) || 0;

    const currentTotalCustomers =
      (await Passenger.count({
        distinct: true,
        col: "id",
        include: {
          model: Booking,
          as: "booking",
          where: { agent_id, created_at: dateFilter },
        },
      })) ?? 0;

      const currentTotalCommission = await AgentCommission.sum("amount", {
        include: [{
          model: Booking,
          attributes: [],
          required: true,
          where: {
            agent_id,
            created_at: dateFilter
          }
        }],
        where: {
          agent_id
        }
      }) ?? 0;

    const currentUnpaidToGiligetaway =
      (await Booking.sum("gross_total", {
        where: {
          agent_id,
          payment_status: "invoiced",
         created_at: dateFilter,
        },
      })) ?? 0;

    const currentpaidToGiligetaway =
      (await Booking.sum("gross_total", {
        where: {
          agent_id,
          payment_status: "paid",
          created_at: dateFilter,
        },
      })) ?? 0;

    // Previous metrics for comparison
    const previousBookingValue =
      (await Booking.sum("gross_total", {
        where: { agent_id, created_at: previousPeriodFilter },
      })) ?? 0;
    const previousTotalBookingCount =
      (await Booking.count({
        where: { agent_id, created_at: previousPeriodFilter },
      })) ?? 0;

    // const previousTransportBooking =
    //   (await TransportBooking.sum( "transport_price", {
    //     attributes:[],
    //     include: [
    //       {
    //         model: Booking,
    //         where: { agent_id, booking_date: previousPeriodFilter },
    //       },
    //     ],
    //   })) ?? 0;

    const previousTransportBooking =
      (await TransportBooking.sum("transport_price", {
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [], // Kosongkan attributes
            where: {
              created_at: previousPeriodFilter,
              payment_status: "paid",
            },
          },
        ],
      })) || 0;
    const previousTotalCustomers =
      (await Passenger.count({
        distinct: true,
        col: "id",
        include: {
          model: Booking,
          as: "booking",
          where: { agent_id, created_at: previousPeriodFilter },
        },
      })) ?? 0;
      const previousTotalCommission = await AgentCommission.sum("amount", {
        include: [{
          model: Booking,
          attributes: [],
          required: true,
          where: {
            agent_id,
            created_at: previousPeriodFilter
          }
        }],
        where: {
          agent_id
        }
      }) ?? 0;

    const previousUnpaidToGiligetaway =
      (await Booking.sum("gross_total", {
        where: {
          agent_id,
          payment_status: "invoiced",
          created_at: previousPeriodFilter,
        },
      })) ?? 0;
    const previouspaidToGiligetaway =
      (await Booking.sum("gross_total", {
        where: {
          agent_id,
          payment_status: "invoiced",
          created_at: previousPeriodFilter,
        },
      })) ?? 0;

    // Metrics with comparison
    const metrics = {
      bookingValue: calculateComparison(
        currentBookingValue,
        previousBookingValue
      ),
      totalBookingCount: calculateComparison(
        currentTotalBookingCount,
        previousTotalBookingCount
      ),
      transportBooking: calculateComparison(
        currentTransportBooking,
        previousTransportBooking
      ),
      totalCustomers: calculateComparison(
        currentTotalCustomers,
        previousTotalCustomers
      ),
      totalCommission: calculateComparison(
        currentTotalCommission,
        previousTotalCommission
      ),
      unpaidToGiligetaway: calculateComparison(
        currentUnpaidToGiligetaway,
        previousUnpaidToGiligetaway
      ),
      // get paid to giligetaway

      paidToGiligetaway: calculateComparison(
        currentpaidToGiligetaway,
        previouspaidToGiligetaway
      ),
      // unpaidToGiligetaway: calculateComparison(
      //   currentUnpaidToGiligetaway,
      //   previousUnpaidToGiligetaway
      // ),
    };

    // Send the metrics as the response
    res.json({
      status: "success",
      metrics,
    });
  } catch (error) {
    console.error("Error fetching agent booking metrics:", error);
    res.status(500).json({ error: "Failed to retrieve metrics" });
  }
};

const getAnnualyMetrics = async (req, res) => {
  try {
    const { timeframe } = req.query;
    const today = moment();
    let startDate, endDate, data = [];

    switch (timeframe) {
      case "Day":
        startDate = today.clone().subtract(6, "days").startOf("day").format("YYYY-MM-DD");
        endDate = today.clone().endOf("day").format("YYYY-MM-DD");

        // Get paid/invoiced bookings
        const paidBookings = await Booking.findAll({
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
            payment_status: ["paid", "invoiced"],
          },
          attributes: [
            [sequelize.fn("DATE", sequelize.col("booking_date")), "date"],
            [sequelize.fn("COUNT", sequelize.col("id")), "paidBookings"],
          ],
          group: ["date"],
          raw: true,
        });

        // Get all bookings
        const allBookings = await Booking.findAll({
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("DATE", sequelize.col("booking_date")), "date"],
            [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
          ],
          group: ["date"],
          raw: true,
        });

        // Fill missing days with 0 and combine both datasets
        const last7Days = Array.from({ length: 7 }, (_, i) =>
          today.clone().subtract(i, "days").format("YYYY-MM-DD")
        ).reverse();

        data = last7Days.map(date => ({
          date,
          totalBookings: paidBookings.find(d => d.date === date)?.paidBookings || 0,
          totalAllBookings: allBookings.find(d => d.date === date)?.totalBookings || 0
        }));
        break;

      case "Week":
        const currentMonth = today.month() + 1;
        const currentYear = today.year();
        const weeks = [
          {
            week: 1,
            start: today.clone().startOf("month").startOf("week"),
            end: today.clone().startOf("month").endOf("week"),
          },
          {
            week: 2,
            start: today.clone().startOf("month").add(1, "weeks").startOf("week"),
            end: today.clone().startOf("month").add(1, "weeks").endOf("week"),
          },
          {
            week: 3,
            start: today.clone().startOf("month").add(2, "weeks").startOf("week"),
            end: today.clone().startOf("month").add(2, "weeks").endOf("week"),
          },
          {
            week: 4,
            start: today.clone().startOf("month").add(3, "weeks").startOf("week"),
            end: today.clone().startOf("month").add(3, "weeks").endOf("week"),
          },
          {
            week: 5,
            start: today.clone().startOf("month").add(4, "weeks").startOf("week"),
            end: today.clone().startOf("month").add(4, "weeks").endOf("week"),
          },
        ];

        data = await Promise.all(
          weeks.map(async (week) => {
            const totalBookings = await Booking.count({
              where: {
                created_at: {
                  [Op.between]: [
                    week.start.format("YYYY-MM-DD"),
                    week.end.format("YYYY-MM-DD"),
                  ],
                },
                payment_status: ["paid", "invoiced"],
              },
            });

            const totalAllBookings = await Booking.count({
              where: {
                created_at: {
                  [Op.between]: [
                    week.start.format("YYYY-MM-DD"),
                    week.end.format("YYYY-MM-DD"),
                  ],
                },
              },
            });

            return {
              week: `Week ${week.week}`,
             totalBookings,
              totalAllBookings
            };
          })
        );
        break;

      case "Month":
        startDate = today.clone().startOf("year").format("YYYY-MM-DD");
        endDate = today.clone().endOf("year").format("YYYY-MM-DD");

        const paidMonthlyBookings = await Booking.findAll({
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
            payment_status: ["paid", "invoiced"],
          },
          attributes: [
            [sequelize.fn("MONTH", sequelize.col("booking_date")), "month"],
            [sequelize.fn("COUNT", sequelize.col("id")), "paidBookings"],
          ],
          group: ["month"],
          raw: true,
        });

        const allMonthlyBookings = await Booking.findAll({
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("MONTH", sequelize.col("booking_date")), "month"],
            [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
          ],
          group: ["month"],
          raw: true,
        });

        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        data = months.map(month => ({
          month,
          totalBookings: paidMonthlyBookings.find(d => d.month === month)?.paidBookings || 0,
          totalAllBookings: allMonthlyBookings.find(d => d.month === month)?.totalBookings || 0
        }));
        break;

      case "Year":
        startDate = today.clone().subtract(3, "years").startOf("year").format("YYYY-MM-DD");
        endDate = today.clone().endOf("year").format("YYYY-MM-DD");

        const paidYearlyBookings = await Booking.findAll({
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
            payment_status: ["paid", "invoiced"],
          },
          attributes: [
            [sequelize.fn("YEAR", sequelize.col("booking_date")), "year"],
            [sequelize.fn("COUNT", sequelize.col("id")), "paidBookings"],
          ],
          group: ["year"],
          raw: true,
        });

        const allYearlyBookings = await Booking.findAll({
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("YEAR", sequelize.col("booking_date")), "year"],
            [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
          ],
          group: ["year"],
          raw: true,
        });

        const years = Array.from({ length: 4 }, (_, i) => today.year() - i).reverse();
        data = years.map(year => ({
          year,
          totalBookings: paidYearlyBookings.find(d => d.year === year)?.paidBookings || 0,
          totalAllBookings: allYearlyBookings.find(d => d.year === year)?.totalBookings || 0
        }));
        break;

      default:
        return res.status(400).json({
          error: "Invalid timeframe provided. Use 'Day', 'Week', 'Month', or 'Year'.",
        });
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

// get annual metrics
const getAgentAnnualyMetrics = async (req, res) => {
  try {
    const { timeframe, agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required." });
    }

    const today = moment();
    let startDate,
      endDate,
      data = [];

    switch (timeframe) {
      case "Day":
        // Last 7 days
        startDate = today
          .clone()
          .subtract(6, "days")
          .startOf("day")
          .format("YYYY-MM-DD");
        endDate = today.clone().endOf("day").format("YYYY-MM-DD");

        data = await Booking.findAll({
          where: {
            agent_id: agentId,
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("DATE", sequelize.col("booking_date")), "date"],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal(
                  `CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END`
                )
              ),
              "totalBookingsPaid",
            ],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal(
                  `CASE WHEN payment_status = 'invoiced' THEN 1 ELSE 0 END`
                )
              ),
              "totalBookingsInvoiced",
            ],
          ],
          group: ["date"],
          raw: true,
        });

        const last7Days = Array.from({ length: 7 }, (_, i) =>
          today.clone().subtract(i, "days").format("YYYY-MM-DD")
        ).reverse();
        data = last7Days.map(
          (date) =>
            data.find((d) => d.date === date) || {
              date,
              totalBookingsPaid: 0,
              totalBookingsInvoiced: 0,
            }
        );
        break;

      case "Month":
        startDate = today.clone().startOf("year").format("YYYY-MM-DD");
        endDate = today.clone().endOf("year").format("YYYY-MM-DD");

        data = await Booking.findAll({
          where: {
            agent_id: agentId,
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("MONTH", sequelize.col("booking_date")), "month"],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal(
                  `CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END`
                )
              ),
              "totalBookingsPaid",
            ],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal(
                  `CASE WHEN payment_status = 'invoiced' THEN 1 ELSE 0 END`
                )
              ),
              "totalBookingsInvoiced",
            ],
          ],
          group: ["month"],
          raw: true,
        });

        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        data = months.map(
          (month) =>
            data.find((d) => d.month === month) || {
              month,
              totalBookingsPaid: 0,
              totalBookingsInvoiced: 0,
            }
        );
        break;

      case "Year":
        startDate = today
          .clone()
          .subtract(3, "years")
          .startOf("year")
          .format("YYYY-MM-DD");
        endDate = today.clone().endOf("year").format("YYYY-MM-DD");

        data = await Booking.findAll({
          where: {
            agent_id: agentId,
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("YEAR", sequelize.col("booking_date")), "year"],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal(
                  `CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END`
                )
              ),
              "totalBookingsPaid",
            ],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal(
                  `CASE WHEN payment_status = 'invoiced' THEN 1 ELSE 0 END`
                )
              ),
              "totalBookingsInvoiced",
            ],
          ],
          group: ["year"],
          raw: true,
        });

        const years = Array.from(
          { length: 4 },
          (_, i) => today.year() - i
        ).reverse();
        data = years.map(
          (year) =>
            data.find((d) => d.year === year) || {
              year,
              totalBookingsPaid: 0,
              totalBookingsInvoiced: 0,
            }
        );
        break;

      default:
        return res.status(400).json({
          error:
            "Invalid timeframe provided. Use 'Day', 'Week', 'Month', or 'Year'.",
        });
    }

    return res.json({
      status: "success",
      timeframe,
      data,
    });
  } catch (error) {
    console.error("Error fetching agent booking metrics:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

const getBookingComparisonMetrics = async (req, res) => {
  try {
    // Get current week's start and end dates
    const currentWeekStart = moment().startOf("week");
    const currentWeekEnd = moment().endOf("week");
    const lastWeekStart = moment().subtract(1, "week").startOf("week");
    const lastWeekEnd = moment().subtract(1, "week").endOf("week");

    // Get daily counts for current week
    const currentWeekData = await Booking.findAll({
      where: {
        created_at: {
          [Op.between]: [
            currentWeekStart.format("YYYY-MM-DD"),
            currentWeekEnd.format("YYYY-MM-DD"),
          ],
        },
      },
      attributes: [
        [sequelize.fn("DATE", sequelize.col("booking_date")), "date"],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal(
              "CASE WHEN payment_status IN ('Paid', 'Invoiced') THEN 1 END"
            )
          ),
          "paid_invoiced",
        ],
        [sequelize.fn("COUNT", sequelize.col("*")), "total"],
      ],
      group: [sequelize.fn("DATE", sequelize.col("booking_date"))],
      raw: true,
    });

    // Get daily counts for last week
    const lastWeekData = await Booking.findAll({
      where: {
        created_at: {
          [Op.between]: [
            lastWeekStart.format("YYYY-MM-DD"),
            lastWeekEnd.format("YYYY-MM-DD"),
          ],
        },
      },
      attributes: [
        [sequelize.fn("DATE", sequelize.col("booking_date")), "date"],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal(
              "CASE WHEN payment_status IN ('Paid', 'Invoiced') THEN 1 END"
            )
          ),
          "paid_invoiced",
        ],
        [sequelize.fn("COUNT", sequelize.col("*")), "total"],
      ],
      group: [sequelize.fn("DATE", sequelize.col("booking_date"))],
      raw: true,
    });

    // Format data for chart
    const formatWeekData = (weekData) => {
      const days = ["M", "T", "W", "T", "F", "S", "S"];
      return days.map((day, index) => {
        const dayData = weekData.find(
          (d) => moment(d.date).day() === (index + 1) % 7
        ) || { total: 0, paid_invoiced: 0 };
        return {
          total: parseInt(dayData.total) || 0,
          paid_invoiced: parseInt(dayData.paid_invoiced) || 0,
        };
      });
    };

    const response = {
      status: "success",
      data: {
        categories: ["M", "T", "W", "T", "F", "S", "S"],
        series: [
          {
            name: "Total Bookings",
            data: formatWeekData(currentWeekData).map((d) => d.total),
          },
          {
            name: "Paid/Invoiced Bookings",
            data: formatWeekData(currentWeekData).map((d) => d.paid_invoiced),
          },
        ],
        lastWeek: {
          name: "Last Week",
          total: formatWeekData(lastWeekData).map((d) => d.total),
          paid_invoiced: formatWeekData(lastWeekData).map(
            (d) => d.paid_invoiced
          ),
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching booking comparison metrics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve booking comparison metrics",
    });
  }
};

const getAgentStatistics = async (req, res) => {
  try {
      const { month, year, day } = req.query;

      // Determine timeframe for response
      let timeframe = 'Year';
      if (month) timeframe = 'Month';
      if (day) timeframe = 'Day';

      // Build date filter based on parameters
      const dateFilter = buildDateFilter({ month, year, day });

      // Get agent statistics with status breakdown
      const agentStats = await Booking.findAll({
          attributes: [
              'agent_id',
              'payment_status',
              [sequelize.fn('COUNT', sequelize.col('*')), 'totalBookings'],
              [sequelize.fn('SUM', sequelize.col('gross_total')), 'bookingTotal']
          ],
          include: [
              {
                  model: Agent,
                  attributes: ['name'],
                  required: true  // Changed to true to force INNER JOIN
              }
          ],
          where: {
              created_at: dateFilter,
              payment_status: {
                  [Op.in]: ['invoiced', 'paid']
              },
              agent_id: {
                  [Op.ne]: null  // Explicitly exclude null agent_id
              }
          },
          group: ['agent_id', 'Agent.id', 'Agent.name', 'payment_status'],
          raw: true,
          nest: true
      });

      // Transform and aggregate the data
      const agentMap = new Map();

      agentStats.forEach(stat => {
          const agentId = stat.agent_id;

          if (!agentMap.has(agentId)) {
              agentMap.set(agentId, {
                  agent_id: agentId,
                  agent_name: stat.Agent.name,
                  totalBookings: 0,
                  bookingTotal: 0,
                  statusBreakdown: {
                      invoiced: {
                          count: 0,
                          total: 0
                      },
                      paid: {
                          count: 0,
                          total: 0
                      }
                  }
              });
          }

          const agentData = agentMap.get(agentId);
          agentData.totalBookings += parseInt(stat.totalBookings);
          agentData.bookingTotal += parseFloat(stat.bookingTotal);
          agentData.statusBreakdown[stat.payment_status] = {
              count: parseInt(stat.totalBookings),
              total: parseFloat(stat.bookingTotal)
          };
      });

      // Convert Map to array and sort by total bookings
      const formattedData = Array.from(agentMap.values())
          .sort((a, b) => b.totalBookings - a.totalBookings);

      res.json({
          status: 'success',
          timeframe,
          data: formattedData
      });

  } catch (error) {
      console.error('Error in getAgentBookingAnalytics:', error);
      res.status(500).json({
          status: 'error',
          message: 'Failed to retrieve agent booking analytics'
      });
  }
};


// create get metrics by agent id

module.exports = {
  getMetrics,
  getBookingMetricsBySource,
  getBookingComparisonMetrics,
  getMetricsByAgentId,
  getAnnualyMetrics,
  getAgentAnnualyMetrics,
  getAgentStatistics
};
