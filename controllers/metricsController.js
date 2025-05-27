const Sequelize = require("sequelize");
const { Op, fn, col } = Sequelize;

// Di bagian paling atas file

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

const {
  fetchAllMetricsDataBookingDate,
  processMetricsDataBookingDate,
} = require("../util/fetchMetricsBookingDate");

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
        payment_status: ["paid", "invoiced"],
      },
      attributes: ["booking_source", [fn("COUNT", col("id")), "totalBookings"]],
      group: ["booking_source"],
      raw: true,
    });

    // Ensure all possible booking sources are included, even if 0
    const allSources = ["website", "agent",  "Other","staff"]; // Add all expected booking sources here
    const data = allSources.map((source) => {
      const metric = metrics.find((m) => m.booking_source === source);
      return {
        booking_source: source,
        totalBookings: metric ? parseInt(metric.totalBookings) : 0,
      };
    });;

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

const fetchAgentCommissionByBoat = async (dateFilter, previousPeriodFilter) => {
  try {
    // Filter gabungan
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter],
    };

    // Replacements
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1],
    };

    return await AgentCommission.findAll({
      attributes: [
        [
          sequelize.literal(
            `CASE WHEN Booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
          ),
          "period",
        ],
        [sequelize.col("Booking.schedule.boat_id"), "boat_id"],
        [
          sequelize.fn("SUM", sequelize.col("AgentCommission.amount")),
          "commission_total",
        ],
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            payment_status: ["invoiced", "paid"],
            created_at: combinedFilter,
          },
          include: [
            {
              model: Schedule,
              as: "schedule",
              attributes: [],
              required: true,
            },
          ],
        },
      ],
      group: ["period", "Booking.schedule.boat_id"],
      replacements,
      raw: true,
    });
  } catch (error) {
    console.error("Error fetching agent commission data:", error);
    return [];
  }
};

const fetchAllMetricsData = async (dateFilter, previousPeriodFilter) => {
  try {
    // Queries yang sudah ada
    const bookingsData = await fetchBookingsWithAllData(
      dateFilter,
      previousPeriodFilter
    );

    // console.log("🫦fetchall Metrcis data booking data :", bookingsData);
    const transportData = await fetchTransportData(
      dateFilter,
      previousPeriodFilter
    );
    const passengerData = await fetchPassengerCount(
      dateFilter,
      previousPeriodFilter
    );
    const agentCount = await Agent.count();

    // Tambahkan query commission
    const commissionData = await fetchAgentCommissionByBoat(
      dateFilter,
      previousPeriodFilter
    );

    return {
      bookingsData,
      commissionData, // Tambahkan ini
      transportData,
      passengerData,
      agentCount,
    };
  } catch (error) {
    console.error("Error fetching metrics data:", error);
    throw error;
  }
};

const fetchBookingsWithAllData = async (dateFilter, previousPeriodFilter) => {
  try {
    // Buat filter gabungan untuk mendapatkan data current dan previous dalam 1 query
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter],
    };

    // Build replacements untuk CASE statement di SQL
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1],
    };

    return await Booking.findAll({
      attributes: [
        "id", // Tambahkan id untuk referensi
        [sequelize.col("schedule.boat_id"), "boat_id"],
        [
          sequelize.literal(
            `CASE WHEN Booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
          ),
          "period",
        ],
        [sequelize.col("Booking.gross_total"), "gross_total"], // Spesifikkan tabel
        // add tabel booking for booking source
        [sequelize.col("Booking.booking_source"), "booking_source"],
        [sequelize.col("Booking.payment_status"), "payment_status"], // Spesifikkan tabel
        // add ticket total
        [sequelize.col("Booking.ticket_total"), "ticket_total"],
        [sequelize.col("Booking.agent_id"), "agent_id"], // Spesifikkan tabel
      ],
      include: [
        {
          model: Schedule,
          as: "schedule",
          attributes: ["boat_id"],
          required: true,
        },
        {
          model: AgentCommission,
          as: "agentCommission", // Pastikan nama relasi sesuai model
          attributes: ["amount"],
          required: false,
        },
      ],
      where: {
        created_at: combinedFilter,
      },
      replacements,
      raw: true,
      nest: true,
    });
  } catch (error) {
    console.error("Error fetching bookings with all data:", error);
    throw error;
  }
};

const fetchTransportData = async (dateFilter, previousPeriodFilter) => {
  try {
    // Filter gabungan untuk current dan previous period
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter],
    };

    // Build replacements untuk CASE statement di SQL
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1],
    };

    return await TransportBooking.findAll({
      attributes: [
        [
          sequelize.literal(
            `CASE WHEN booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
          ),
          "period",
        ],
        [sequelize.col("TransportBooking.transport_price"), "transport_price"], // Spesifikkan tabel
      ],
      include: [
        {
          model: Booking,
          as: "booking",
          attributes: [],
          where: {
            payment_status: ["paid", "invoiced"],
            created_at: combinedFilter,
          },
        },
      ],
      replacements,
      raw: true,
    });
  } catch (error) {
    console.error("Error fetching transport data:", error);
    throw error;
  }
};

const processCommissionData = (commissionData, result) => {
  // Clear existing commission data yang mungkin sudah diset sebelumnya
  for (const period of ["current", "previous"]) {
    for (const boatId of [1, 2, 3]) {
      result[period].boats[boatId].commission = 0;
    }
  }

  // Proses data commission dari query khusus
  commissionData.forEach((commission) => {
    const period = commission.period;
    const boatId = parseInt(commission.boat_id);
    const commissionTotal = parseFloat(commission.commission_total) || 0;

    // Set commission untuk perahu yang sesuai
    if (result[period] && result[period].boats[boatId]) {
      result[period].boats[boatId].commission = commissionTotal;

      // Log untuk debugging
      // console.log(
      //   `Setting commission for boat ${boatId} in ${period} period: ${commissionTotal}`
      // );
    }
  });
};

const fetchPassengerCount = async (dateFilter, previousPeriodFilter) => {
  try {
    // Pastikan previousPeriodFilter memiliki Op.between dengan created_at
    if (!previousPeriodFilter || !previousPeriodFilter[Op.between]) {
      throw new Error("Invalid previousPeriodFilter: missing Op.between.");
    }

    // Build previous period filter using created_at
    const previousCreatedAtFilter = {
      created_at: previousPeriodFilter, // Sesuaikan dengan created_at
    };

    // Build current period filter using created_at
    const currentCreatedAtFilter = {
      created_at: dateFilter, // Sesuaikan dengan created_at
    };

    // console.log("🧠Fetching passenger count...");
    // console.log("🧠Current period filter:", currentCreatedAtFilter);
    // console.log("🧠Previous period filter:", previousCreatedAtFilter);

    return await Booking.findAll({
      attributes: [
        [
          sequelize.literal(
            `CASE WHEN created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
          ),
          "period",
        ],
        [
          sequelize.fn("SUM", sequelize.col("total_passengers")),
          "passenger_count",
        ],
      ],
      where: {
        [Op.or]: [currentCreatedAtFilter, previousCreatedAtFilter],
      },
      group: ["period"],
      replacements: {
        prevStart: previousPeriodFilter[Op.between][0],
        prevEnd: previousPeriodFilter[Op.between][1],
      },
      raw: true,
    });
  } catch (error) {
    console.error("Error fetching passenger count:", error);
    throw error;
  }
};

const processMetricsData = (data) => {
  const {
    bookingsData,
    commissionData,
    transportData,
    passengerData,
    agentCount,
  } = data;



  // Inisialisasi struktur data untuk hasil
  const result = {
    current: {
      totalValue: 0,
      // total ticket only
      ticketTotal: 0,
      // cancel only
      totalCancelled: 0,
      paymentReceived: 0,
      totalRefund: 0,
      agentBookingInvoiced: 0,
      agentPaymentReceived: 0,
      agentBookingUnpaid: 0,
      bookingCount: 0,
      grossTotal: 0,
      bookingSource: {
        agent: 0,
        website: 0,
        staff: 0,
        others: 0,
      },
      bookingCountBySource: {
        agent: 0,
        website: 0,
        staff: 0,
        others: 0,
      },
      boats: {
        1: { totalValue: 0, netValue: 0, commission: 0 },
        2: { totalValue: 0, netValue: 0, commission: 0 },
        3: { totalValue: 0, netValue: 0, commission: 0 },
      },
    },
    previous: {
      totalValue: 0,
      ticketTotal: 0,
      paymentReceived: 0,
      totalCancelled: 0,
      totalRefund: 0,
      agentBookingInvoiced: 0,
      agentPaymentReceived: 0,
      agentBookingUnpaid: 0,
      bookingCount: 0,
      grossTotal: 0,
      bookingSource: {
        agent: 0,
        website: 0,
        staff: 0,
        others: 0,
      },
      bookingCountBySource: {
        agent: 0,
        website: 0,
        staff: 0,
        others: 0,
      },
      boats: {
        1: { totalValue: 0, netValue: 0, commission: 0 },
        2: { totalValue: 0, netValue: 0, commission: 0 },
        3: { totalValue: 0, netValue: 0, commission: 0 },
      },
    },
    transport: {
      current: { count: 0, totalPrice: 0 },
      previous: { count: 0, totalPrice: 0 },
    },
    passengers: {
      current: 0,
      previous: 0,
    },
  };

  // Proses data booking
  if (Array.isArray(bookingsData)) {
    processBookingsData(bookingsData, result);
  } else {
    console.warn("bookingsData is not an array or is undefined");
  }

  // Proses data commission - pastikan tidak undefined sebelum diproses
  if (Array.isArray(commissionData)) {
    processCommissionData(commissionData, result);
  } else {
    console.warn("commissionData is not an array or is undefined");
  }

  // Proses data transport
  if (Array.isArray(transportData)) {
    processTransportData(transportData, result);
  } else {
    console.warn("transportData is not an array or is undefined");
  }

  // Proses data passenger
  if (Array.isArray(passengerData)) {
    processPassengerData(passengerData, result);
  } else {
    console.warn("passengerData is not an array or is undefined");
  }

  // Hitung averageOrderValue
  calculateAverageOrderValue(result);

  // Hitung netIncome
  calculateNetIncome(result);

  // Format hasil akhir untuk API response
  return formatMetricsForResponse(result, agentCount || 0);
};

// Pastikan objek result diinisialisasi dengan benar
const initializeResultObject = () => {
  return {
    current: {
      bookingCount: 0,
      totalValue: 0,
      paymentReceived: 0,
      agentPaymentReceived: 0, // Hanya untuk paid
      agentBookingInvoiced: 0, // Untuk invoiced
      totalRefund: 0,
      boats: {
        1: { totalValue: 0, netValue: 0 },
        2: { totalValue: 0, netValue: 0 },
      },
    },
  };
};

const processBookingsData = (bookingsData, result) => {

  bookingsData.forEach((booking) => {
    const period = booking.period;
    const boatId = booking.boat_id;
    const grossTotal = parseFloat(booking.gross_total) || 0;
    const ticketTotal = parseFloat(booking.ticket_total) || 0;
    const paymentStatus = booking.payment_status;
    const hasAgent = booking.agent_id !== null;
    const bookingSource = booking.booking_source;;

    // Get target object based on period
    const target = result[period];

    // Initialize bookingSource object
    if (!target.bookingSource) {
      target.bookingSource = {
        agent: 0,
        website: 0,
        staff: 0,
        others: 0,
      };
    }

    // Increment booking count
    target.bookingCount++;

    // Add to total value
    target.totalValue += grossTotal;


    // Memproses berdasarkan status pembayaran
    if (paymentStatus === "paid") {
      // Total nilai booking yang sudah dibayar
      target.paymentReceived += grossTotal;

      // Hanya tambahkan ke agentPaymentReceived jika statusnya paid dan ada agent
      if (hasAgent) {
        target.agentPaymentReceived += grossTotal;
      }
    } else if (paymentStatus === "invoiced") {
      // Total nilai booking yang sudah ditagih
      target.paymentReceived += grossTotal;

      // Khusus untuk invoiced dengan agent
      if (hasAgent) {
        target.agentBookingInvoiced += grossTotal;
      }
    } else if (paymentStatus === "refund") {
      // Total nilai refund/pengembalian dana
      target.totalRefund += grossTotal;
    }  else if (paymentStatus === "unpaid" && hasAgent) {
      target.agentBookingUnpaid += grossTotal;
    }
    // get the unpaid agent booking


    // how to get ticketTotal
    if (paymentStatus === "paid" || paymentStatus === "invoiced") {
      target.ticketTotal += ticketTotal;
    }

    // how to get totalCancceled
    if ( paymentStatus === "cancelled") {
      target.totalCancelled += grossTotal;
    }

    // Process boat-specific data
    if (boatId && target.boats[boatId]) {
      // Total value for boat
      target.boats[boatId].totalValue += grossTotal;

      // Net value for boat (paid or invoiced)
      if (paymentStatus === "paid" || paymentStatus === "invoiced") {
        target.boats[boatId].netValue += grossTotal;
      }
    }

    // Process booking source
    if (paymentStatus === "paid" || paymentStatus === "invoiced") {
      switch (bookingSource) {
        case "agent":
          target.bookingSource.agent += grossTotal;
          break;
        case "website":
          target.bookingSource.website += grossTotal;
          break;
        case "staff":
          target.bookingSource.staff += grossTotal;
          break;
        case "others":
          target.bookingSource.others += grossTotal;
          break;
      }
    }
    // add booking count for the each source
    if (paymentStatus === "paid" || paymentStatus === "invoiced") {
      if (!target.bookingCountBySource) {
        target.bookingCountBySource = {
          agent: 0,
          website: 0,
          staff: 0,
          others: 0,
        };
      }
      target.bookingCountBySource[bookingSource] += 1;
    }


  });
};

const processTransportData = (transportData, result) => {
  transportData.forEach((transport) => {
    const period = transport.period;
    const price = parseFloat(transport.transport_price) || 0;

    result.transport[period].count++;
    result.transport[period].totalPrice += price;
  });
};

const processPassengerData = (passengerData, result) => {
  passengerData.forEach((passenger) => {
    const period = passenger.period;
    result.passengers[period] = parseInt(passenger.passenger_count) || 0;
  });
};

/**
 * Calculate average order value
 * @param {Object} result - Result object to update
 */
const calculateAverageOrderValue = (result) => {
  ["current", "previous"].forEach((period) => {
    if (result[period].bookingCount > 0) {
      result[period].averageOrderValue =
        result[period].totalValue / result[period].bookingCount;
    } else {
      result[period].averageOrderValue = 0;
    }
  });
};

const calculateNetIncome = (result) => {
  ["current", "previous"].forEach((period) => {
    const totalCommission =
      (result[period].boats[1].commission || 0) +
      (result[period].boats[2].commission || 0) +
      (result[period].boats[3].commission || 0);

    // Log untuk debugging

    result[period].netIncome = result[period].paymentReceived - totalCommission;
  });
};

const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

const formatMetricsForResponse = (data, agentCount) => {
  // Extract current and previous data
  const { current, previous, transport, passengers } = data;
  // console.log("🧠curent BANGSAT", current);

  // Calculate all percentage changes
  const bookingValueChange = calculatePercentageChange(
    current.totalValue,
    previous.totalValue
  );
  const ticketTotalChange = calculatePercentageChange(
    current.ticketTotal,
    previous.ticketTotal
  );

  // 

  // cancel only
  const totalCancelledChange = calculatePercentageChange(
    current.totalCancelled,
    previous.totalCancelled
  );
  const paymentReceivedChange = calculatePercentageChange(
    current.paymentReceived,
    previous.paymentReceived
  );
  const totalRefundChange = calculatePercentageChange(
    current.totalRefund,
    previous.totalRefund
  );
  const averageOrderValueChange = calculatePercentageChange(
    current.averageOrderValue,
    previous.averageOrderValue
  );
  const agentBookingInvoicedChange = calculatePercentageChange(
    current.agentBookingInvoiced,
    previous.agentBookingInvoiced
  );
  const agentPaymentReceivedChange = calculatePercentageChange(
    current.agentPaymentReceived,
    previous.agentPaymentReceived
  );
   // get the unpaid agent
   const agentBookingUnpaidChange = calculatePercentageChange(
    current.agentBookingUnpaid,
    previous.agentBookingUnpaid
  );
  const transportBookingCountChange = calculatePercentageChange(
    transport.current.count,
    transport.previous.count
  );
  const totalBookingCountChange = calculatePercentageChange(
    current.bookingCount,
    previous.bookingCount
  );
  const totalCustomersChange = calculatePercentageChange(
    passengers.current,
    passengers.previous
  );
  const transportBookingTotalChange = calculatePercentageChange(
    transport.current.totalPrice,
    transport.previous.totalPrice
  );

  // Boat-specific changes
  const bookingValueBoat1Change = calculatePercentageChange(
    current.boats[1].totalValue,
    previous.boats[1].totalValue
  );
  const bookingNetValueBoat1Change = calculatePercentageChange(
    current.boats[1].netValue,
    previous.boats[1].netValue
  );
  const bookingValueBoat2Change = calculatePercentageChange(
    current.boats[2].totalValue,
    previous.boats[2].totalValue
  );
  const bookingNetValueBoat2Change = calculatePercentageChange(
    current.boats[2].netValue,
    previous.boats[2].netValue
  );
  const bookingValueBoat3Change = calculatePercentageChange(
    current.boats[3].totalValue,
    previous.boats[3].totalValue
  );
  const bookingNetValueBoat3Change = calculatePercentageChange(
    current.boats[3].netValue,
    previous.boats[3].netValue
  );

  // Commission changes
  const commissionChange1 = calculatePercentageChange(
    current.boats[1].commission,
    previous.boats[1].commission
  );
  const commissionChange2 = calculatePercentageChange(
    current.boats[2].commission,
    previous.boats[2].commission
  );
  const commissionChange3 = calculatePercentageChange(
    current.boats[3].commission,
    previous.boats[3].commission
  );

  // add booking source
  const bookingSourceChange = {
    agent: calculatePercentageChange(current.bookingSource.agent, previous.bookingSource.agent),
    website: calculatePercentageChange(current.bookingSource.website, previous.bookingSource.website),
    staff: calculatePercentageChange(current.bookingSource.staff, previous.bookingSource.staff),
    others: calculatePercentageChange(current.bookingSource.others, previous.bookingSource.others),
  };
  // add Booking source count
// console.log("`bookingCountBySource", current.bookingCountBySource);
const bookingCountBySourceChange = {
  agent: calculatePercentageChange(current.bookingCountBySource.agent, previous.bookingCountBySource.agent),
  website: calculatePercentageChange(current.bookingCountBySource.website, previous.bookingCountBySource.website),
  staff: calculatePercentageChange(current.bookingCountBySource.staff, previous.bookingCountBySource.staff),
}

  

  // Net income change
  const netIncomeChange = calculatePercentageChange(
    current.netIncome,
    previous.netIncome
  );

  // Build final response in same format as original
  return {
    bookingValue: {
      value: current.totalValue,
      status:
        current.totalValue >= previous.totalValue ? "increase" : "decrease",
      change: `${bookingValueChange.toFixed(2)}%`,
    },
    ticketTotal: {
      value: current.ticketTotal,
      status:
        current.ticketTotal >= previous.ticketTotal ? "increase" : "decrease",
      change: `${ticketTotalChange.toFixed(2)}%`,
    },
    totalCancelled: {
      value: current.totalCancelled,
      status:
        current.totalCancelled >= previous.totalCancelled
          ? "increase"
          : "decrease",
      change: `${totalCancelledChange.toFixed(2)}%`,
    },
    paymentReceived: {
      value: current.paymentReceived,
      status:
        current.paymentReceived >= previous.paymentReceived
          ? "increase"
          : "decrease",
      change: `${paymentReceivedChange.toFixed(2)}%`,
    },
    totalRefund: {
      value: current.totalRefund,
      status:
        current.totalRefund >= previous.totalRefund ? "increase" : "decrease",
      change: `${totalRefundChange.toFixed(2)}%`,
    },
    totalAgents: {
      value: agentCount,
      status: "stable", // Jumlah agent biasanya tidak berubah antar periode
      change: "0.00%",
    },
    averageOrderValue: {
      value: current.averageOrderValue,
      status:
        current.averageOrderValue >= previous.averageOrderValue
          ? "increase"
          : "decrease",
      change: `${averageOrderValueChange.toFixed(2)}%`,
    },
    agentBookingInvoiced: {
      value: current.agentBookingInvoiced,
      status:
        current.agentBookingInvoiced >= previous.agentBookingInvoiced
          ? "increase"
          : "decrease",
      change: `${agentBookingInvoicedChange.toFixed(2)}%`,
    },
    agentPaymentReceived: {
      value: current.agentPaymentReceived,
      status:
        current.agentPaymentReceived >= previous.agentPaymentReceived
          ? "increase"
          : "decrease",
      change: `${agentPaymentReceivedChange.toFixed(2)}%`,
    },
    agentBookingUnpaid: {
      value: current.agentBookingUnpaid,
      status:
        current.agentBookingUnpaid >= previous.agentBookingUnpaid
          ? "increase"
          : "decrease",
      change: `${agentBookingUnpaidChange.toFixed(2)}%`,
    },
    transportBookingCount: {
      value: transport.current.count,
      status:
        transport.current.count >= transport.previous.count
          ? "increase"
          : "decrease",
      change: `${transportBookingCountChange.toFixed(2)}%`,
    },
    totalBookingCount: {
      value: current.bookingCount,
      status:
        current.bookingCount >= previous.bookingCount ? "increase" : "decrease",
      change: `${totalBookingCountChange.toFixed(2)}%`,
    },
    totalCustomers: {
      value: passengers.current,
      status:
        passengers.current >= passengers.previous ? "increase" : "decrease",
      change: `${totalCustomersChange.toFixed(2)}%`,
    },
    transportBooking: {
      value: transport.current.totalPrice,
      status:
        transport.current.totalPrice >= transport.previous.totalPrice
          ? "increase"
          : "decrease",
      change: `${transportBookingTotalChange.toFixed(2)}%`,
    },
    bookingValueBoat1: {
      value: current.boats[1].totalValue,
      status:
        current.boats[1].totalValue >= previous.boats[1].totalValue
          ? "increase"
          : "decrease",
      change: `${bookingValueBoat1Change.toFixed(2)}%`,
    },
    bookingNetValueBoat1: {
      value: current.boats[1].netValue,
      status:
        current.boats[1].netValue >= previous.boats[1].netValue
          ? "increase"
          : "decrease",
      change: `${bookingNetValueBoat1Change.toFixed(2)}%`,
    },
    bookingNetValueBoat2: {
      value: current.boats[2].netValue,
      status:
        current.boats[2].netValue >= previous.boats[2].netValue
          ? "increase"
          : "decrease",
      change: `${bookingNetValueBoat2Change.toFixed(2)}%`,
    },
    bookingNetValueBoat3: {
      value: current.boats[3].netValue,
      status:
        current.boats[3].netValue >= previous.boats[3].netValue
          ? "increase"
          : "decrease",
      change: `${bookingNetValueBoat3Change.toFixed(2)}%`,
    },
    bookingValueBoat2: {
      value: current.boats[2].totalValue,
      status:
        current.boats[2].totalValue >= previous.boats[2].totalValue
          ? "increase"
          : "decrease",
      change: `${bookingValueBoat2Change.toFixed(2)}%`,
    },
    bookingValueBoat3: {
      value: current.boats[3].totalValue,
      status:
        current.boats[3].totalValue >= previous.boats[3].totalValue
          ? "increase"
          : "decrease",
      change: `${bookingValueBoat3Change.toFixed(2)}%`,
    },
    agentCommissionBoat1: {
      value: current.boats[1].commission,
      status:
        current.boats[1].commission >= previous.boats[1].commission
          ? "increase"
          : "decrease",
      change: `${commissionChange1.toFixed(2)}%`,
    },
    agentCommissionBoat2: {
      value: current.boats[2].commission,
      status:
        current.boats[2].commission >= previous.boats[2].commission
          ? "increase"
          : "decrease",
      change: `${commissionChange2.toFixed(2)}%`,
    },
    agentCommissionBoat3: {
      value: current.boats[3].commission,
      status:
        current.boats[3].commission >= previous.boats[3].commission
          ? "increase"
          : "decrease",
      change: `${commissionChange3.toFixed(2)}%`,
    },
    netIncome: {
      value: current.netIncome,
      status: current.netIncome >= previous.netIncome ? "increase" : "decrease",
      change: `${netIncomeChange.toFixed(2)}%`,
    },
    bookingSource: {
      value: current.bookingSource,
      change: bookingSourceChange,
      status: bookingSourceChange >= 0 ? "increase" : "decrease",
    },
    // console.log("`bookingCountBySource", current.bookingCountBySource);
    bookingSourceCountChange: {
      value: current.bookingCountBySource,
      change: bookingCountBySourceChange,
      status: bookingCountBySourceChange >= 0 ? "increase" : "decrease",
    }
  };
};
const calculatePreviousPeriod = (fromDate, toDate) => {
  // Parse dates
  const fromMoment = moment(fromDate);
  const toMoment = moment(toDate);
  
  // Calculate duration in days
  const durationDays = toMoment.diff(fromMoment, 'days') + 1;
  
  // Calculate the previous period by going back exactly one period length
  const previousFrom = fromMoment.clone().subtract(durationDays, 'days').startOf('day');
  const previousTo = toMoment.clone().subtract(durationDays, 'days').endOf('day');
  
  return {
    fromDate: previousFrom.format('YYYY-MM-DD HH:mm:ss'),
    toDate: previousTo.format('YYYY-MM-DD HH:mm:ss')
  };
};
const buildDateFilter = ({ from, to, month, year, day }) => {
  // For from and to dates
  // Untuk filter from-to
  // Dalam fungsi buildDateFilter
  if (from && to) {
    const fromDate = moment(from).startOf("day").format("YYYY-MM-DD HH:mm:ss");
    const toDate = moment(to).endOf("day").format("YYYY-MM-DD HH:mm:ss");

    // Menggunakan operator terpisah daripada BETWEEN
    return {
      created_at: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate,
      },
    };
  }

  // Convert inputs to numbers and validate
  const numericYear = year ? parseInt(year) : null;
  const numericMonth = month ? parseInt(month) : null;
  const numericDay = day ? parseInt(day) : null;

  // Full date (year, month, day)
  if (numericYear && numericMonth && numericDay) {
    const dateStr = moment(
      `${numericYear}-${numericMonth}-${numericDay}`
    ).format("YYYY-MM-DD");
    return {
      [Op.and]: [
        sequelize.where(
          sequelize.fn("YEAR", sequelize.col("created_at")),
          numericYear
        ),
        sequelize.where(
          sequelize.fn("MONTH", sequelize.col("created_at")),
          numericMonth
        ),
        sequelize.where(
          sequelize.fn("DAY", sequelize.col("created_at")),
          numericDay
        ),
      ],
    };
  }

  // Year and month
  if (numericYear && numericMonth) {
    const startDate = moment(`${numericYear}-${numericMonth}-01`)
      .startOf("month")
      .format("YYYY-MM-DD HH:mm:ss");
    const endDate = moment(`${numericYear}-${numericMonth}-01`)
      .endOf("month")
      .format("YYYY-MM-DD HH:mm:ss");

    return {
      [Op.between]: [startDate, endDate],
    };
  }

  // Only year
  if (numericYear) {
    const startDate = moment(`${numericYear}-01-01`)
      .startOf("year")
      .format("YYYY-MM-DD HH:mm:ss");
    const endDate = moment(`${numericYear}-12-31`)
      .endOf("year")
      .format("YYYY-MM-DD HH:mm:ss");

    return {
      [Op.between]: [startDate, endDate],
    };
  }

  // Default case - return current month if no parameters
  const currentDate = moment();
  return {
    [Op.between]: [
      currentDate.clone().startOf("month").format("YYYY-MM-DD HH:mm:ss"),
      currentDate.clone().endOf("month").format("YYYY-MM-DD HH:mm:ss"),
    ],
  };
};

// Controller to fetch metrics

// const buildDateFilter = ({ from, to, month, year, day }) => {
//   // For from and to dates
//   if (from && to) {
//     const fromDate = moment(from).startOf("day").format("YYYY-MM-DD HH:mm:ss");
//     const toDate = moment(to).endOf("day").format("YYYY-MM-DD HH:mm:ss");

//     // Menggunakan operator terpisah daripada BETWEEN
//     return {
//       'Booking.created_at': {  // Tambahkan nama tabel
//         [Op.gte]: fromDate,
//         [Op.lte]: toDate,
//       },
//     };
//   }

//   // Convert inputs to numbers and validate
//   const numericYear = year ? parseInt(year) : null;
//   const numericMonth = month ? parseInt(month) : null;
//   const numericDay = day ? parseInt(day) : null;

//   console.log("Filter parameters:", { numericYear, numericMonth, numericDay });

//   // Full date (year, month, day)
//   if (numericYear && numericMonth && numericDay) {
//     const dateStr = moment(
//       `${numericYear}-${numericMonth}-${numericDay}`
//     ).format("YYYY-MM-DD");
//     return {
//       [Op.and]: [
//         sequelize.where(
//           sequelize.fn("YEAR", sequelize.col("Booking.created_at")),  // Tambahkan nama tabel
//           numericYear
//         ),
//         sequelize.where(
//           sequelize.fn("MONTH", sequelize.col("Booking.created_at")),  // Tambahkan nama tabel
//           numericMonth
//         ),
//         sequelize.where(
//           sequelize.fn("DAY", sequelize.col("Booking.created_at")),  // Tambahkan nama tabel
//           numericDay
//         ),
//       ],
//     };
//   }

//   // Year and month
//   if (numericYear && numericMonth) {
//     const startDate = moment(`${numericYear}-${numericMonth}-01`)
//       .startOf("month")
//       .format("YYYY-MM-DD HH:mm:ss");
//     const endDate = moment(`${numericYear}-${numericMonth}-01`)
//       .endOf("month")
//       .format("YYYY-MM-DD HH:mm:ss");

//     return {
//       'Booking.created_at': {  // Tambahkan nama kolom dengan tabel
//         [Op.between]: [startDate, endDate],
//       }
//     };
//   }

//   // Only year
//   if (numericYear) {
//     const startDate = moment(`${numericYear}-01-01`)
//       .startOf("year")
//       .format("YYYY-MM-DD HH:mm:ss");
//     const endDate = moment(`${numericYear}-12-31`)
//       .endOf("year")
//       .format("YYYY-MM-DD HH:mm:ss");

//     return {
//       'Booking.created_at': {  // Tambahkan nama kolom dengan tabel
//         [Op.between]: [startDate, endDate],
//       }
//     };
//   }

//   // Default case - return current month if no parameters
//   const currentDate = moment();
//   return {
//     'Booking.created_at': {  // Tambahkan nama kolom dengan tabel
//       [Op.between]: [
//         currentDate.clone().startOf("month").format("YYYY-MM-DD HH:mm:ss"),
//         currentDate.clone().endOf("month").format("YYYY-MM-DD HH:mm:ss"),
//       ],
//     }
//   };
// };
const getMetrics = async (req, res) => {
  try {
    // Ambil parameter filter dari query
    const { from, to, month, year, day } = req.query;

    const numericYear = year ? parseInt(year) : null;
    const numericMonth = month ? parseInt(month) : null;
    const numericDay = day ? parseInt(day) : null;

    // console.log("From raw:", req.query.from);
    // console.log("To raw:", req.query.to);
    // console.log("From parsed:", new Date(req.query.from));
    // console.log("To parsed:", new Date(req.query.to));

    // Cek jika from-to adalah untuk satu bulan penuh
    let dateFilter;
    if (from && to) {
      const fromMoment = moment(from);
      const toMoment = moment(to);

      // Periksa apakah rentang adalah bulan penuh (1-31)
      const isFullMonth =
        fromMoment.date() === 1 &&
        toMoment.month() === fromMoment.month() &&
        toMoment.date() >= 28; // Mengakomodasi bulan Februari

      if (isFullMonth) {
        // Jika bulan penuh, gunakan filter bulan-tahun
        console.log("Detected full month query, using month-year filter");
        dateFilter = buildDateFilter({
          month: fromMoment.month() + 1, // Moment: Jan=0, API: Jan=1
          year: fromMoment.year(),
        });
      } else {
        // Untuk rentang tanggal biasa
        const fromDate = fromMoment
          .startOf("day")
          .format("YYYY-MM-DD HH:mm:ss");
        const toDate = toMoment.endOf("day").format("YYYY-MM-DD HH:mm:ss");
        dateFilter = { [Op.between]: [fromDate, toDate] };
      }
    } else {
      // Gunakan buildDateFilter untuk parameter lainnya
      dateFilter = buildDateFilter({ month, year, day });
    }

  
    let previousPeriodFilter;
    if (from && to) {
      const fromMoment = moment(from);
      const toMoment = moment(to);

      // Periksa jika bulan penuh - improved check for last day of month
      const isFullMonth =
        fromMoment.date() === 1 &&
        toMoment.month() === fromMoment.month() &&
        toMoment.date() === toMoment.daysInMonth();

      if (isFullMonth) {
        // Jika bulan penuh, gunakan bulan sebelumnya sebagai pembanding
        let prevMonth = fromMoment.month();
        let prevYear = fromMoment.year();

        if (prevMonth === 0) {
          // Januari
          prevMonth = 11; // Desember
          prevYear -= 1;
        } else {
          prevMonth -= 1;
        }

        previousPeriodFilter = buildDateFilter({
          month: prevMonth + 1, // Koreksi untuk API
          year: prevYear,
        });
        
        // console.log(`Full month detected: ${fromMoment.format('YYYY-MM-DD')} to ${toMoment.format('YYYY-MM-DD')}`);
        // console.log(`Previous period (month): ${prevMonth + 1}/${prevYear}`);
      } else {
        // For custom date ranges, calculate an equivalent previous period
        const { fromDate: previousFrom, toDate: previousTo } = calculatePreviousPeriod(from, to);
        
        // Create filter with proper previous period
        previousPeriodFilter = { [Op.between]: [previousFrom, previousTo] };
        
        // // Log for debugging
        // console.log("Custom date range detected:");
        // console.log(`Current period: ${fromMoment.format('YYYY-MM-DD')} to ${toMoment.format('YYYY-MM-DD')}`);
        // console.log(`Previous period: ${moment(previousFrom).format('YYYY-MM-DD')} to ${moment(previousTo).format('YYYY-MM-DD')}`);
      }
    } else if (numericYear && !numericMonth && !numericDay) {
      // If only year is provided, use previous year
      previousPeriodFilter = buildDateFilter({
        year: numericYear - 1,
      });
      
      // console.log(`Year only filter: ${numericYear}`);
      // console.log(`Previous period (year): ${numericYear - 1}`);
    } else {
      // For month/day combinations
      previousPeriodFilter = buildDateFilter({
        month: numericMonth
          ? numericMonth === 1
            ? 12
            : numericMonth - 1
          : undefined,
        year:
          numericMonth && numericMonth === 1 ? numericYear - 1 : numericYear,
        day,
      });
      
      // console.log(`Month/day filter: Month=${numericMonth}, Year=${numericYear}, Day=${numericDay}`);
      // console.log(`Previous period: Month=${numericMonth ? (numericMonth === 1 ? 12 : numericMonth - 1) : 'undefined'}, Year=${numericMonth && numericMonth === 1 ? numericYear - 1 : numericYear}`);
    }
    // Log filters untuk debugging
    // console.log("Current period filter:", dateFilter);
    // console.log("Previous period filter:", previousPeriodFilter);

    // Fetch semua data dengan query yang optimal
    const metricsData = await fetchAllMetricsData(
      dateFilter,
      previousPeriodFilter
    );

    // Proses data untuk membentuk respon yang dibutuhkan
    const metrics = processMetricsData(metricsData);

    // Kirimkan respons
    res.json({
      status: "success",
      metrics,
    });
  } catch (error) {
    console.error("Error in getMetrics controller:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
const buildBookingDateFilter = ({ from, to, month, year, day }) => {
  console.log("👄Build booking date filter with params:", { from, to, month, year, day });
  
  // ✅ FIXED: Include time component in all format() calls
  if (from && to) {
    const fromDate = moment(from).startOf("day").format("YYYY-MM-DD HH:mm:ss"); // ✅ Added HH:mm:ss
    const toDate = moment(to).endOf("day").format("YYYY-MM-DD HH:mm:ss");       // ✅ Added HH:mm:ss
    return { booking_date: { [Op.between]: [fromDate, toDate] } };
  }

  // Convert inputs to numbers and validate
  const numericYear = year ? parseInt(year) : moment().year();
  const numericMonth = month ? parseInt(month) : null;
  const numericDay = day ? parseInt(day) : null;

  // Full date (year, month, day) - Keep using database functions for precise date matching
  if (numericYear && numericMonth && numericDay) {
    return {
      [Op.and]: [
        sequelize.where(sequelize.fn("YEAR", sequelize.col("booking_date")), numericYear),
        sequelize.where(sequelize.fn("MONTH", sequelize.col("booking_date")), numericMonth),
        sequelize.where(sequelize.fn("DAY", sequelize.col("booking_date")), numericDay),
      ],
    };
  }

  // Year and month
  if (numericYear && numericMonth) {
    const startDate = moment(`${numericYear}-${numericMonth}-01`)
      .startOf("month")
      .format("YYYY-MM-DD HH:mm:ss"); // ✅ Added HH:mm:ss
    const endDate = moment(`${numericYear}-${numericMonth}-01`)
      .endOf("month")
      .format("YYYY-MM-DD HH:mm:ss");   // ✅ Added HH:mm:ss

    return { booking_date: { [Op.between]: [startDate, endDate] } };
  }

  // Only year
  if (numericYear) {
    const startDate = moment(`${numericYear}-01-01`)
      .startOf("year")
      .format("YYYY-MM-DD HH:mm:ss");  // ✅ Added HH:mm:ss
    const endDate = moment(`${numericYear}-12-31`)
      .endOf("year")
      .format("YYYY-MM-DD HH:mm:ss");    // ✅ Added HH:mm:ss

    return { booking_date: { [Op.between]: [startDate, endDate] } };
  }

  // Default case - return current month
  const currentDate = moment();
  return {
    booking_date: {
      [Op.between]: [
        currentDate.clone().startOf("month").format("YYYY-MM-DD HH:mm:ss"), // ✅ Added HH:mm:ss
        currentDate.clone().endOf("month").format("YYYY-MM-DD HH:mm:ss"),   // ✅ Added HH:mm:ss
      ],
    },
  };
};

// const buildBookingDateFilter = ({ from, to, month, year, day }) => {
// console.log("👄Build booking date filter with params:", { from, to, month, year, day });

//   // Prioritize explicit from and to dates first
//   if (from && to) {
//     const fromDate = moment(from).startOf("day").format("YYYY-MM-DD");
//     const toDate = moment(to).endOf("day").format("YYYY-MM-DD");
//     return { booking_date: { [Op.between]: [fromDate, toDate] } };
//   }

//   // Convert inputs to numbers and validate
//   const numericYear = year ? parseInt(year) : moment().year();
//   const numericMonth = month ? parseInt(month) : null;
//   const numericDay = day ? parseInt(day) : null;

//   // console.log("Filter parameters:", { numericYear, numericMonth, numericDay });

//   // Full date (year, month, day)
//   if (numericYear && numericMonth && numericDay) {
//     return {
//       [Op.and]: [
//         sequelize.where(
//           sequelize.fn("YEAR", sequelize.col("booking_date")),
//           numericYear
//         ),
//         sequelize.where(
//           sequelize.fn("MONTH", sequelize.col("booking_date")),
//           numericMonth
//         ),
//         sequelize.where(
//           sequelize.fn("DAY", sequelize.col("booking_date")),
//           numericDay
//         ),
//       ],
//     };
//   }

//   // Year and month
//   if (numericYear && numericMonth) {
//     const startDate = moment(`${numericYear}-${numericMonth}-01`)
//       .startOf("month")
//       .format("YYYY-MM-DD");
//     const endDate = moment(`${numericYear}-${numericMonth}-01`)
//       .endOf("month")
//       .format("YYYY-MM-DD");

//     return {
//       booking_date: { [Op.between]: [startDate, endDate] },
//     };
//   }

//   // Only year
//   if (numericYear) {
//     const startDate = moment(`${numericYear}-01-01`)
//       .startOf("year")
//       .format("YYYY-MM-DD");
//     const endDate = moment(`${numericYear}-12-31`)
//       .endOf("year")
//       .format("YYYY-MM-DD");

//     return {
//       booking_date: { [Op.between]: [startDate, endDate] },
//     };
//   }

//   // Default case - return current month
//   const currentDate = moment();
//   return {
//     booking_date: {
//       [Op.between]: [
//         currentDate.clone().startOf("month").format("YYYY-MM-DD"),
//         currentDate.clone().endOf("month").format("YYYY-MM-DD"),
//       ],
//     },
//   };
// };

// booking date
const getMetricsBookingDate = async (req, res) => {
  try {
    // Ambil parameter filter dari query
    // console.log("START TO FILTER BOOKING DATE METRICS");
    const { from, to, month, year, day } = req.query;
    // console.log("  ✅===all query====  ✅", req.query);

    const numericYear = year ? parseInt(year) : null;
    const numericMonth = month ? parseInt(month) : null;
    const numericDay = day ? parseInt(day) : null;

    // console.log("From raw:", req.query.from);
    // console.log("To raw:", req.query.to);
    // console.log("From parsed:", new Date(req.query.from));
    // console.log("To parsed:", new Date(req.query.to));

    // Cek jika from-to adalah untuk satu bulan penuh
    let dateFilter;
    if (from && to) {
      const fromMoment = moment(from);
      const toMoment = moment(to);

      // Periksa apakah rentang adalah bulan penuh (1-31)
      const isFullMonth =
        fromMoment.date() === 1 &&
        toMoment.month() === fromMoment.month() &&
        toMoment.date() === toMoment.daysInMonth(); // Check if it's the last day of the month

      if (isFullMonth) {
        console.log("Detected full month query, using month-year filter");
        dateFilter = buildBookingDateFilter({
          month: fromMoment.month() + 1, // Moment: Jan=0, API: Jan=1
          year: fromMoment.year(),
        });
      } else {
        // Untuk rentang tanggal biasa dengan komponen waktu
        const fromDate = fromMoment
          .startOf("day")
          .format("YYYY-MM-DD HH:mm:ss");
        const toDate = toMoment.endOf("day").format("YYYY-MM-DD HH:mm:ss");
        // Filter untuk booking_date
        dateFilter = { booking_date: { [Op.between]: [fromDate, toDate] } };
      }
    } else {
      // Gunakan buildBookingDateFilter untuk parameter lainnya
      dateFilter = buildBookingDateFilter({ month, year, day });
    }

    let previousPeriodFilter;
    if (from && to) {
      const fromMoment = moment(from);
      const toMoment = moment(to);

      // Periksa jika bulan penuh - improved check for last day of month
      const isFullMonth =
        fromMoment.date() === 1 &&
        toMoment.month() === fromMoment.month() &&
        toMoment.date() === toMoment.daysInMonth();

      if (isFullMonth) {
        // Jika bulan penuh, gunakan bulan sebelumnya sebagai pembanding
        let prevMonth = fromMoment.month();
        let prevYear = fromMoment.year();

        if (prevMonth === 0) {
          // Januari
          prevMonth = 11; // Desember
          prevYear -= 1;
        } else {
          prevMonth -= 1;
        }

        // Gunakan buildBookingDateFilter untuk booking_date
        previousPeriodFilter = buildBookingDateFilter({
          month: prevMonth + 1, // Koreksi untuk API
          year: prevYear,
        });
        
        // console.log(`Full month detected: ${fromMoment.format('YYYY-MM-DD')} to ${toMoment.format('YYYY-MM-DD')}`);
        // console.log(`Previous period (month): ${prevMonth + 1}/${prevYear}`);
      } else {
        // For custom date ranges, calculate an equivalent previous period
        const { fromDate: previousFrom, toDate: previousTo } = calculatePreviousPeriod(from, to);
        
        // Filter untuk booking_date
        previousPeriodFilter = {
          booking_date: { [Op.between]: [previousFrom, previousTo] },
        };
        
        // Log for debugging
        // console.log("Custom date range detected:");
        // console.log(`Current period: ${fromMoment.format('YYYY-MM-DD')} to ${toMoment.format('YYYY-MM-DD')}`);
        // console.log(`Previous period: ${moment(previousFrom).format('YYYY-MM-DD')} to ${moment(previousTo).format('YYYY-MM-DD')}`);
      }
    } else if (numericYear && !numericMonth && !numericDay) {
      // If only year is provided, use previous year
      // Gunakan buildBookingDateFilter untuk booking_date
      previousPeriodFilter = buildBookingDateFilter({
        year: numericYear - 1,
      });
      
      // console.log(`Year only filter: ${numericYear}`);
      // console.log(`Previous period (year): ${numericYear - 1}`);
    } else {
      // For month/day combinations
      // Gunakan buildBookingDateFilter untuk booking_date
      previousPeriodFilter = buildBookingDateFilter({
        month: numericMonth
          ? numericMonth === 1
            ? 12
            : numericMonth - 1
          : undefined,
        year:
          numericMonth && numericMonth === 1 ? numericYear - 1 : numericYear,
        day,
      });
      
      // console.log(`Month/day filter: Month=${numericMonth}, Year=${numericYear}, Day=${numericDay}`);
      // console.log(`Previous period: Month=${numericMonth ? (numericMonth === 1 ? 12 : numericMonth - 1) : 'undefined'}, Year=${numericMonth && numericMonth === 1 ? numericYear - 1 : numericYear}`);
    }

    // // Log filters untuk debugging
    // console.log("DATE FILTER", dateFilter);
    // console.log("PREVIOUS PERIOD FILTER", previousPeriodFilter);

    // Gunakan fungsi fetchAllMetricsDataBookingDate untuk query booking_date
    const metricsData = await fetchAllMetricsDataBookingDate(
      dateFilter,
      previousPeriodFilter
    );
    // console.log("Metrics Data:", metricsData);
    // Proses data untuk membentuk respon yang dibutuhkan
    // Pastikan ini menggunakan processMetricsData yang benar
    const metrics = processMetricsDataBookingDate(metricsData);

    // Kirimkan respons
    res.json({
      status: "success",
      metrics,
    });
  } catch (error) {
    console.error("Error in getMetricsBookingDate controller:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
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

  // console.log("Agent ID:", agent_id);
  // console.log("Date Filters:", { from, to, month, year, day });

  if (!agent_id) {
    return res
      .status(400)
      .json({ error: "Agent ID is required as a route parameter." });
  }

  // Validasi tanggal
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

    // Kombinasikan filter untuk satu query
    const combinedFilter = {
      [Op.or]: [
        { created_at: dateFilter },
        { created_at: previousPeriodFilter },
      ],
    };

    // Definisikan kondisi where untuk agent
    const whereConditions = {
      agent_id,
      // Tidak filter berdasarkan payment_status agar mendapatkan semua status
    };

    // Tambahkan filter gabungan
    const fullWhereConditions = {
      ...whereConditions,
      ...combinedFilter,
    };

    // Query 1: Mendapatkan semua data booking dengan include
    const bookings = await Booking.findAll({
      where: fullWhereConditions,
      attributes: ["id", "gross_total", "payment_status","created_at" ],
      include: [
        {
          model: TransportBooking,
          as: "transportBookings",
          attributes: ["id", "transport_price"],
        },
        {
          model: Passenger,
          as: "passengers",
          attributes: ["id"],
        },
        {
          model: AgentCommission,
          as: "agentCommission",
          attributes: ["id", "amount"],
        },
      ],
      raw: false, // Perlu objek untuk relasi
      nest: true,
    });

    // Proses data yang diperoleh
    const currentData = {
      totalValue: 0,
      bookingCount: 0,
      paidTotal: 0,
      invoicedTotal: 0, // Renamed from unpaidTotal
      unpaidTotal: 0, // New field for unpaid status
      cancelledTotal: 0, // New field for cancelled status
      transportTotal: 0,
      passengerCount: new Set(),
      commissionTotal: 0,
    };

    const previousData = {
      totalValue: 0,
      bookingCount: 0,
      paidTotal: 0,
      invoicedTotal: 0, // Renamed from unpaidTotal
      unpaidTotal: 0, // New field for unpaid status
      cancelledTotal: 0, // New field for cancelled status
      transportTotal: 0,
      passengerCount: new Set(),
      commissionTotal: 0,
    };

    // Proses masing-masing booking untuk dikelompokkan berdasarkan periode
    bookings.forEach((booking) => {
      // Tentukan apakah booking ini dari periode saat ini atau sebelumnya
      const isCurrentPeriod = isInDateRange(booking.created_at, dateFilter);
      const target = isCurrentPeriod ? currentData : previousData;

      // Tambahkan nilai total
      const grossTotal = parseFloat(booking.gross_total) || 0;
      target.totalValue += grossTotal;
      target.bookingCount++;

      // Status pembayaran - menghitung berdasarkan semua status
      if (booking.payment_status === "paid") {
        target.paidTotal += grossTotal;
        // Jika statusnya paid, tambahkan ke total paidTotal

        // Jika statusnya invoiced, tambahkan ke total invoicedTotal
      } else if (booking.payment_status === "invoiced") {
        target.invoicedTotal += grossTotal;
        // Jika statusnya unpaid, tambahkan ke total unpaidTotal
      } else if (booking.payment_status === "unpaid") {
        target.unpaidTotal += grossTotal;
        // Jika statusnya cancelled, tambahkan ke total cancelledTotal
      } else if (booking.payment_status === "cancelled") {
        target.cancelledTotal += grossTotal;
      }

      // Transport bookings - hanya hitung transport untuk pembayaran yang valid (paid/invoiced)
      if (
        ["paid", "invoiced"].includes(booking.payment_status) &&
        booking.transportBookings &&
        Array.isArray(booking.transportBookings)
      ) {
        booking.transportBookings.forEach((transport) => {
          target.transportTotal += parseFloat(transport.transport_price) || 0;
        });
      }

      // Passengers - hitung semua penumpang terlepas dari status pembayaran
      if (booking.passengers && Array.isArray(booking.passengers)) {
        booking.passengers.forEach((passenger) => {
          target.passengerCount.add(passenger.id);
        });
      }

      // Agent commissions - hanya hitung komisi untuk pembayaran yang valid (paid/invoiced)
      if (
        ["paid", "invoiced"].includes(booking.payment_status) &&
        booking.agentCommission // Tidak perlu cek apakah array
      ) {
    
        target.commissionTotal +=
          parseFloat(booking.agentCommission.amount) || 0;
      }
    });

    // Hitung jumlah penumpang unik
    const currentTotalCustomers = currentData.passengerCount.size;
    const previousTotalCustomers = previousData.passengerCount.size;

    // Metrics with comparison - dengan metrik baru dan nama yang diubah
    const metrics = {
      bookingValue: calculateComparison(
        currentData.totalValue,
        previousData.totalValue
      ),

      totalBookingCount: calculateComparison(
        currentData.bookingCount,
        previousData.bookingCount
      ),
      transportBooking: calculateComparison(
        currentData.transportTotal,
        previousData.transportTotal
      ),
      totalCustomers: calculateComparison(
        currentTotalCustomers,
        previousTotalCustomers
      ),
      totalCommission: calculateComparison(
        currentData.commissionTotal,
        previousData.commissionTotal
      ),
      // Renamed metric
      invoicedBooking: calculateComparison(
        currentData.invoicedTotal,
        previousData.invoicedTotal
      ),
      // New metrics
      unpaidBooking: calculateComparison(
        currentData.unpaidTotal,
        previousData.unpaidTotal
      ),
      cancelledBooking: calculateComparison(
        currentData.cancelledTotal,
        previousData.cancelledTotal
      ),
      paidToGiligetaway: calculateComparison(
        currentData.paidTotal,
        previousData.paidTotal
      ),
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

const getMetricsByAgentIdTravelDate = async (req, res) => {
  console.log("start the traveler date metrics agent");
  const { agent_id } = req.params;
  const { from, to, month, year, day } = req.query;

  // console.log("Agent ID:", agent_id);
  // console.log("Date Filters:", { from, to, month, year, day });

  if (!agent_id) {
    return res
      .status(400)
      .json({ error: "Agent ID is required as a route parameter." });
  }

  // Validasi tanggal
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

    // Kombinasikan filter untuk satu query
    const combinedFilter = {
      [Op.or]: [
        { booking_date: dateFilter },
        { booking_date: previousPeriodFilter },
      ],
    };

    // Definisikan kondisi where untuk agent
    const whereConditions = {
      agent_id,
      // Tidak filter berdasarkan payment_status agar mendapatkan semua status
    };

    // Tambahkan filter gabungan
    const fullWhereConditions = {
      ...whereConditions,
      ...combinedFilter,
    };;

    // Query 1: Mendapatkan semua data booking dengan include
    const bookings = await Booking.findAll({
      where: fullWhereConditions,
      attributes: ["id", "gross_total", "payment_status","payment_method", "booking_date"],
      include: [
        {
          model: TransportBooking,
          as: "transportBookings",
          attributes: ["id", "transport_price"],
        },
        {
          model: Passenger,
          as: "passengers",
          attributes: ["id"],
        },
        {
          model: AgentCommission,
          as: "agentCommission",
          attributes: ["id", "amount"],
        },
      ],
      raw: false, // Perlu objek untuk relasi
      nest: true,
    });

  
    // console.log("👧bookings", JSON.stringify(bookings, null, 2));

    // Proses data yang diperoleh
    const currentData = {
      totalValue: 0,
      bookingCount: 0,
      paidTotal: 0,
      invoicedTotal: 0, // Renamed from unpaidTotal
      unpaidTotal: 0, // New field for unpaid status
      cancelledTotal: 0, // New field for cancelled status
      transportTotal: 0,
      passengerCount: new Set(),
      commissionTotal: 0,
    };

    const previousData = {
      totalValue: 0,
      bookingCount: 0,
      paidTotal: 0,
      invoicedTotal: 0, // Renamed from unpaidTotal
      unpaidTotal: 0, // New field for unpaid status
      cancelledTotal: 0, // New field for cancelled status
      transportTotal: 0,
      passengerCount: new Set(),
      commissionTotal: 0,
    };

    // Proses masing-masing booking untuk dikelompokkan berdasarkan periode
    bookings.forEach((booking) => {
      // Tentukan apakah booking ini dari periode saat ini atau sebelumnya
      const isCurrentPeriod = isInDateRange(booking.booking_date, dateFilter);
      const target = isCurrentPeriod ? currentData : previousData;

      // Tambahkan nilai total
      const grossTotal = parseFloat(booking.gross_total) || 0;
      target.totalValue += grossTotal;
      target.bookingCount++;

      // Status pembayaran - menghitung berdasarkan semua status
      if (booking.payment_status === "paid") {
        target.paidTotal += grossTotal;
      } else if (booking.payment_status === "invoiced") {
        target.invoicedTotal += grossTotal;
      } else if (booking.payment_status === "unpaid") {
        target.unpaidTotal += grossTotal;
      } else if (booking.payment_status === "cancelled") {
        target.cancelledTotal += grossTotal;
      }

      // Transport bookings - hanya hitung transport untuk pembayaran yang valid (paid/invoiced)
      if (
        ["paid", "invoiced"].includes(booking.payment_status) &&
        booking.agentCommission // Tidak perlu cek apakah array
      ) {
        target.commissionTotal +=
          parseFloat(booking.agentCommission.amount) || 0;
      }

      // Passengers - hitung semua penumpang terlepas dari status pembayaran
      if (booking.passengers && Array.isArray(booking.passengers)) {
        booking.passengers.forEach((passenger) => {
          target.passengerCount.add(passenger.id);
        });
      }

      // Agent commissions - hanya hitung komisi untuk pembayaran yang valid (paid/invoiced)
      if (
        ["paid", "invoiced"].includes(booking.payment_status) &&
        booking.agentCommissions &&
        Array.isArray(booking.agentCommissions)
      ) {
        booking.agentCommissions.forEach((commission) => {
          target.commissionTotal += parseFloat(commission.amount) || 0;
        });
      }
    });

    // Hitung jumlah penumpang unik
    const currentTotalCustomers = currentData.passengerCount.size;
    const previousTotalCustomers = previousData.passengerCount.size;

    // Metrics with comparison - dengan metrik baru dan nama yang diubah
    const metrics = {
      bookingValue: calculateComparison(
        currentData.totalValue,
        previousData.totalValue
      ),
      totalBookingCount: calculateComparison(
        currentData.bookingCount,
        previousData.bookingCount
      ),
      transportBooking: calculateComparison(
        currentData.transportTotal,
        previousData.transportTotal
      ),
      totalCustomers: calculateComparison(
        currentTotalCustomers,
        previousTotalCustomers
      ),
      totalCommission: calculateComparison(
        currentData.commissionTotal,
        previousData.commissionTotal
      ),
      // Renamed metric
      invoicedBooking: calculateComparison(
        currentData.invoicedTotal,
        previousData.invoicedTotal
      ),
      // New metrics
      unpaidBooking: calculateComparison(
        currentData.unpaidTotal,
        previousData.unpaidTotal
      ),
      cancelledBooking: calculateComparison(
        currentData.cancelledTotal,
        previousData.cancelledTotal
      ),
      paidToGiligetaway: calculateComparison(
        currentData.paidTotal,
        previousData.paidTotal
      ),
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

// Helper function untuk memeriksa apakah tanggal dalam range
function isInDateRange(date, dateRange) {
  if (!date) return false;

  const checkDate = new Date(date);

  if (dateRange[Op.between]) {
    const [startDate, endDate] = dateRange[Op.between].map((d) => new Date(d));
    return checkDate >= startDate && checkDate <= endDate;
  }

  return false;
}

// Helper function untuk memeriksa apakah tanggal dalam range
function isInDateRange(date, dateRange) {
  if (!date) return false;

  const checkDate = new Date(date);

  if (dateRange[Op.between]) {
    const [startDate, endDate] = dateRange[Op.between].map((d) => new Date(d));
    return checkDate >= startDate && checkDate <= endDate;
  }

  return false;
}

const getAnnualyMetrics = async (req, res) => {
  try {
    const { timeframe } = req.query;
    const today = moment();
    let startDate,
      endDate,
      data = [];

    switch (timeframe) {
      case "Day":
        startDate = today
          .clone()
          .subtract(6, "days")
          .startOf("day")
          .format("YYYY-MM-DD");
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

        data = last7Days.map((date) => ({
          date,
          totalBookings:
            paidBookings.find((d) => d.date === date)?.paidBookings || 0,
          totalAllBookings:
            allBookings.find((d) => d.date === date)?.totalBookings || 0,
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
            start: today
              .clone()
              .startOf("month")
              .add(1, "weeks")
              .startOf("week"),
            end: today.clone().startOf("month").add(1, "weeks").endOf("week"),
          },
          {
            week: 3,
            start: today
              .clone()
              .startOf("month")
              .add(2, "weeks")
              .startOf("week"),
            end: today.clone().startOf("month").add(2, "weeks").endOf("week"),
          },
          {
            week: 4,
            start: today
              .clone()
              .startOf("month")
              .add(3, "weeks")
              .startOf("week"),
            end: today.clone().startOf("month").add(3, "weeks").endOf("week"),
          },
          {
            week: 5,
            start: today
              .clone()
              .startOf("month")
              .add(4, "weeks")
              .startOf("week"),
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
              totalAllBookings,
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
        data = months.map((month) => ({
          month,
          totalBookings:
            paidMonthlyBookings.find((d) => d.month === month)?.paidBookings ||
            0,
          totalAllBookings:
            allMonthlyBookings.find((d) => d.month === month)?.totalBookings ||
            0,
        }));
        break;

      case "Year":
        startDate = today
          .clone()
          .subtract(3, "years")
          .startOf("year")
          .format("YYYY-MM-DD");
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

        const years = Array.from(
          { length: 4 },
          (_, i) => today.year() - i
        ).reverse();
        data = years.map((year) => ({
          year,
          totalBookings:
            paidYearlyBookings.find((d) => d.year === year)?.paidBookings || 0,
          totalAllBookings:
            allYearlyBookings.find((d) => d.year === year)?.totalBookings || 0,
        }));
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
    console.error("Error fetching booking metrics:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
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
    let timeframe = "Year";
    if (month) timeframe = "Month";
    if (day) timeframe = "Day";

    // Build date filter based on parameters
    const dateFilter = buildDateFilter({ month, year, day });

    // Get agent statistics with status breakdown
    const agentStats = await Booking.findAll({
      attributes: [
        "agent_id",
        "payment_status",
        [sequelize.fn("COUNT", sequelize.col("*")), "totalBookings"],
        [sequelize.fn("SUM", sequelize.col("gross_total")), "bookingTotal"],
      ],
      include: [
        {
          model: Agent,
          attributes: ["name"],
          required: true, // Changed to true to force INNER JOIN
        },
      ],
      where: {
        created_at: dateFilter,
        payment_status: {
          [Op.in]: ["invoiced", "paid"],
        },
        agent_id: {
          [Op.ne]: null, // Explicitly exclude null agent_id
        },
      },
      group: ["agent_id", "Agent.id", "Agent.name", "payment_status"],
      raw: true,
      nest: true,
    });

    // Transform and aggregate the data
    const agentMap = new Map();

    agentStats.forEach((stat) => {
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
              total: 0,
            },
            paid: {
              count: 0,
              total: 0,
            },
          },
        });
      }

      const agentData = agentMap.get(agentId);
      agentData.totalBookings += parseInt(stat.totalBookings);
      agentData.bookingTotal += parseFloat(stat.bookingTotal);
      agentData.statusBreakdown[stat.payment_status] = {
        count: parseInt(stat.totalBookings),
        total: parseFloat(stat.bookingTotal),
      };
    });

    // Convert Map to array and sort by total bookings
    const formattedData = Array.from(agentMap.values()).sort(
      (a, b) => b.totalBookings - a.totalBookings
    );

    res.json({
      status: "success",
      timeframe,
      data: formattedData,
    });
  } catch (error) {
    console.error("Error in getAgentBookingAnalytics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve agent booking analytics",
    });
  }
};

// create get metrics by agent id

module.exports = {
  getMetrics,
  getBookingMetricsBySource,
  getBookingComparisonMetrics,
  getMetricsByAgentId,
  getMetricsByAgentIdTravelDate,
  getAnnualyMetrics,
  getAgentAnnualyMetrics,
  getAgentStatistics,
  getMetricsBookingDate,
};
