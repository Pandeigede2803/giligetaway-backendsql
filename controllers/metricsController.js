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


const fetchAgentCommissionByBoat = async (dateFilter, previousPeriodFilter) => {
  try {
    // Filter gabungan
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter]
    };
    
    // Replacements
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1]
    };
    
    return await AgentCommission.findAll({
      attributes: [
        [sequelize.literal(`CASE WHEN Booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`), 'period'],
        [sequelize.col('Booking.schedule.boat_id'), 'boat_id'],
        [sequelize.fn('SUM', sequelize.col('AgentCommission.amount')), 'commission_total']
      ],
      include: [
        {
          model: Booking,
          attributes: [],
          required: true,
          where: {
            payment_status: ["invoiced", "paid"],
            created_at: combinedFilter
          },
          include: [
            {
              model: Schedule,
              as: 'schedule',
              attributes: [],
              required: true
            }
          ]
        }
      ],
      group: ['period', 'Booking.schedule.boat_id'],
      replacements,
      raw: true
    });
  } catch (error) {
    console.error('Error fetching agent commission data:', error);
    return [];
  }
};

const fetchAllMetricsData = async (dateFilter, previousPeriodFilter) => {
  try {
    // Queries yang sudah ada
    const bookingsData = await fetchBookingsWithAllData(dateFilter, previousPeriodFilter);
    const transportData = await fetchTransportData(dateFilter, previousPeriodFilter);
    const passengerData = await fetchPassengerCount(dateFilter, previousPeriodFilter);
    const agentCount = await Agent.count();
    
    // Tambahkan query commission
    const commissionData = await fetchAgentCommissionByBoat(dateFilter, previousPeriodFilter);
    
    return {
      bookingsData,
      commissionData,  // Tambahkan ini
      transportData,
      passengerData,
      agentCount
    };
  } catch (error) {
    console.error('Error fetching metrics data:', error);
    throw error;
  }
};

const fetchBookingsWithAllData = async (dateFilter, previousPeriodFilter) => {
  try {
    // Buat filter gabungan untuk mendapatkan data current dan previous dalam 1 query
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter]
    };
    
    // Build replacements untuk CASE statement di SQL
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1]
    };
    
    return await Booking.findAll({
      attributes: [
        'id', // Tambahkan id untuk referensi
        [sequelize.col('schedule.boat_id'), 'boat_id'],
        [sequelize.literal(`CASE WHEN Booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`), 'period'],
        [sequelize.col('Booking.gross_total'), 'gross_total'],  // Spesifikkan tabel
        [sequelize.col('Booking.payment_status'), 'payment_status'],  // Spesifikkan tabel
        [sequelize.col('Booking.agent_id'), 'agent_id']  // Spesifikkan tabel
      ],
      include: [
        {
          model: Schedule,
          as: 'schedule',
          attributes: ['boat_id'],
          required: true
        },
        {
          model: AgentCommission,
          as: 'agentCommissions', // Pastikan nama relasi sesuai model
          attributes: ['amount'],
          required: false
        }
      ],
      where: {
        created_at: combinedFilter
      },
      replacements,
      raw: true,
      nest: true
    });
  } catch (error) {
    console.error('Error fetching bookings with all data:', error);
    throw error;
  }
};


const fetchTransportData = async (dateFilter, previousPeriodFilter) => {
  try {
    // Filter gabungan untuk current dan previous period
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter]
    };
    
    // Build replacements untuk CASE statement di SQL
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1]
    };
    
    return await TransportBooking.findAll({
      attributes: [
        [sequelize.literal(`CASE WHEN booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`), 'period'],
        [sequelize.col('TransportBooking.transport_price'), 'transport_price'] // Spesifikkan tabel
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: [],
          where: {
            payment_status: ["paid","invoiced"],
            created_at: combinedFilter
          }
        }
      ],
      replacements,
      raw: true
    });
  } catch (error) {
    console.error('Error fetching transport data:', error);
    throw error;
  }
};

const processCommissionData = (commissionData, result) => {
  // Clear existing commission data yang mungkin sudah diset sebelumnya
  for (const period of ['current', 'previous']) {
    for (const boatId of [1, 2, 3]) {
      result[period].boats[boatId].commission = 0;
    }
  }
  
  // Proses data commission dari query khusus
  commissionData.forEach(commission => {
    const period = commission.period;
    const boatId = parseInt(commission.boat_id);
    const commissionTotal = parseFloat(commission.commission_total) || 0;
    
    // Set commission untuk perahu yang sesuai
    if (result[period] && result[period].boats[boatId]) {
      result[period].boats[boatId].commission = commissionTotal;
      
      // Log untuk debugging
      console.log(`Setting commission for boat ${boatId} in ${period} period: ${commissionTotal}`);
    }
  });
};


const fetchPassengerCount = async (dateFilter, previousPeriodFilter) => {
  try {
    // Filter gabungan untuk current dan previous period
    const combinedFilter = {
      [Op.or]: [dateFilter, previousPeriodFilter]
    };
    
    // Build replacements untuk CASE statement di SQL
    const replacements = {
      prevStart: previousPeriodFilter[Op.between][0],
      prevEnd: previousPeriodFilter[Op.between][1]
    };
    
    return await Passenger.findAll({
      attributes: [
        [sequelize.literal(`CASE WHEN booking.created_at BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`), 'period'],
        [sequelize.fn('COUNT', sequelize.col('Passenger.id')), 'passenger_count']
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: [],
          where: {
            created_at: combinedFilter
          }
        }
      ],
      group: ['period'],
      replacements,
      raw: true
    });
  } catch (error) {
    console.error('Error fetching passenger count:', error);
    throw error;
  }
};


const processMetricsData = (data) => {
  const { bookingsData, commissionData, transportData, passengerData, agentCount } = data;
  
  // Inisialisasi struktur data untuk hasil
  const result = {
    current: {
      totalValue: 0,
      paymentReceived: 0,
      totalRefund: 0,
      agentBookingInvoiced: 0,
      agentPaymentReceived: 0,
      bookingCount: 0,
      grossTotal: 0,
      boats: {
        1: { totalValue: 0, netValue: 0, commission: 0 },
        2: { totalValue: 0, netValue: 0, commission: 0 },
        3: { totalValue: 0, netValue: 0, commission: 0 }
      }
    },
    previous: {
      totalValue: 0,
      paymentReceived: 0,
      totalRefund: 0,
      agentBookingInvoiced: 0,
      agentPaymentReceived: 0,
      bookingCount: 0,
      grossTotal: 0,
      boats: {
        1: { totalValue: 0, netValue: 0, commission: 0 },
        2: { totalValue: 0, netValue: 0, commission: 0 },
        3: { totalValue: 0, netValue: 0, commission: 0 }
      }
    },
    transport: {
      current: { count: 0, totalPrice: 0 },
      previous: { count: 0, totalPrice: 0 }
    },
    passengers: {
      current: 0,
      previous: 0
    }
  };
  
  // Proses data booking
  if (Array.isArray(bookingsData)) {
    processBookingsData(bookingsData, result);
  } else {
    console.warn('bookingsData is not an array or is undefined');
  }
  
  // Proses data commission - pastikan tidak undefined sebelum diproses
  if (Array.isArray(commissionData)) {
    processCommissionData(commissionData, result);
  } else {
    console.warn('commissionData is not an array or is undefined');
  }
  
  // Proses data transport
  if (Array.isArray(transportData)) {
    processTransportData(transportData, result);
  } else {
    console.warn('transportData is not an array or is undefined');
  }
  
  // Proses data passenger
  if (Array.isArray(passengerData)) {
    processPassengerData(passengerData, result);
  } else {
    console.warn('passengerData is not an array or is undefined');
  }
  
  // Hitung averageOrderValue
  calculateAverageOrderValue(result);
  
  // Hitung netIncome
  calculateNetIncome(result);
  
  // Format hasil akhir untuk API response
  return formatMetricsForResponse(result, agentCount || 0);
};

const processBookingsData = (bookingsData, result) => {
  bookingsData.forEach(booking => {
    const period = booking.period;
    const boatId = booking.boat_id;
    const grossTotal = parseFloat(booking.gross_total) || 0;
    const paymentStatus = booking.payment_status;
    const hasAgent = booking.agent_id !== null;
    
    // Get target object based on period
    const target = result[period];
    
    // Increment booking count
    target.bookingCount++;
    
    // Add to total value
    target.totalValue += grossTotal;
    
    // Process by payment status
    if (paymentStatus === 'paid') {
      target.paymentReceived += grossTotal;
      
      if (hasAgent) {
        target.agentPaymentReceived += grossTotal;
      }
    } else if (paymentStatus === 'refund') {
      target.totalRefund += grossTotal;
    } else if (paymentStatus === 'invoiced' && hasAgent) {
      target.agentBookingInvoiced += grossTotal;
    }
    
    // Process boat-specific data
    if (boatId && target.boats[boatId]) {
      // Total value for boat
      target.boats[boatId].totalValue += grossTotal;
      
      // Net value for boat (paid or invoiced)
      if (paymentStatus === 'paid' || paymentStatus === 'invoiced') {
        target.boats[boatId].netValue += grossTotal;
      }
    }
  });
};

const processTransportData = (transportData, result) => {
  transportData.forEach(transport => {
    const period = transport.period;
    const price = parseFloat(transport.transport_price) || 0;
    
    result.transport[period].count++;
    result.transport[period].totalPrice += price;
  });
};


const processPassengerData = (passengerData, result) => {
  passengerData.forEach(passenger => {
    const period = passenger.period;
    result.passengers[period] = parseInt(passenger.passenger_count) || 0;
  });
};

/**
 * Calculate average order value
 * @param {Object} result - Result object to update
 */
const calculateAverageOrderValue = (result) => {
  ['current', 'previous'].forEach(period => {
    if (result[period].bookingCount > 0) {
      result[period].averageOrderValue = result[period].totalValue / result[period].bookingCount;
    } else {
      result[period].averageOrderValue = 0;
    }
  });
};



const calculateNetIncome = (result) => {
  ['current', 'previous'].forEach(period => {
    const totalCommission = 
      (result[period].boats[1].commission || 0) + 
      (result[period].boats[2].commission || 0) + 
      (result[period].boats[3].commission || 0);
    
    // Log untuk debugging
    console.log(`${period} period commission totals:`, {
      boat1: result[period].boats[1].commission || 0,
      boat2: result[period].boats[2].commission || 0,
      boat3: result[period].boats[3].commission || 0,
      total: totalCommission
    });
    
    result[period].netIncome = result[period].paymentReceived - totalCommission;
    
    // Log net income calculation
    console.log(`${period} net income: ${result[period].paymentReceived} - ${totalCommission} = ${result[period].netIncome}`);
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
  
  // Calculate all percentage changes
  const bookingValueChange = calculatePercentageChange(current.totalValue, previous.totalValue);
  const paymentReceivedChange = calculatePercentageChange(current.paymentReceived, previous.paymentReceived);
  const totalRefundChange = calculatePercentageChange(current.totalRefund, previous.totalRefund);
  const averageOrderValueChange = calculatePercentageChange(current.averageOrderValue, previous.averageOrderValue);
  const agentBookingInvoicedChange = calculatePercentageChange(current.agentBookingInvoiced, previous.agentBookingInvoiced);
  const agentPaymentReceivedChange = calculatePercentageChange(current.agentPaymentReceived, previous.agentPaymentReceived);
  const transportBookingCountChange = calculatePercentageChange(transport.current.count, transport.previous.count);
  const totalBookingCountChange = calculatePercentageChange(current.bookingCount, previous.bookingCount);
  const totalCustomersChange = calculatePercentageChange(passengers.current, passengers.previous);
  const transportBookingTotalChange = calculatePercentageChange(transport.current.totalPrice, transport.previous.totalPrice);
  
  // Boat-specific changes
  const bookingValueBoat1Change = calculatePercentageChange(current.boats[1].totalValue, previous.boats[1].totalValue);
  const bookingNetValueBoat1Change = calculatePercentageChange(current.boats[1].netValue, previous.boats[1].netValue);
  const bookingValueBoat2Change = calculatePercentageChange(current.boats[2].totalValue, previous.boats[2].totalValue);
  const bookingNetValueBoat2Change = calculatePercentageChange(current.boats[2].netValue, previous.boats[2].netValue);
  const bookingValueBoat3Change = calculatePercentageChange(current.boats[3].totalValue, previous.boats[3].totalValue);
  const bookingNetValueBoat3Change = calculatePercentageChange(current.boats[3].netValue, previous.boats[3].netValue);
  
  // Commission changes
  const commissionChange1 = calculatePercentageChange(current.boats[1].commission, previous.boats[1].commission);
  const commissionChange2 = calculatePercentageChange(current.boats[2].commission, previous.boats[2].commission);
  const commissionChange3 = calculatePercentageChange(current.boats[3].commission, previous.boats[3].commission);
  
  // Net income change
  const netIncomeChange = calculatePercentageChange(current.netIncome, previous.netIncome);
  
  // Build final response in same format as original
  return {
    bookingValue: {
      value: current.totalValue,
      status: current.totalValue >= previous.totalValue ? "increase" : "decrease",
      change: `${bookingValueChange.toFixed(2)}%`,
    },
    paymentReceived: {
      value: current.paymentReceived,
      status: current.paymentReceived >= previous.paymentReceived ? "increase" : "decrease",
      change: `${paymentReceivedChange.toFixed(2)}%`,
    },
    totalRefund: {
      value: current.totalRefund,
      status: current.totalRefund >= previous.totalRefund ? "increase" : "decrease",
      change: `${totalRefundChange.toFixed(2)}%`,
    },
    totalAgents: {
      value: agentCount,
      status: "stable", // Jumlah agent biasanya tidak berubah antar periode
      change: "0.00%",
    },
    averageOrderValue: {
      value: current.averageOrderValue,
      status: current.averageOrderValue >= previous.averageOrderValue ? "increase" : "decrease",
      change: `${averageOrderValueChange.toFixed(2)}%`,
    },
    agentBookingInvoiced: {
      value: current.agentBookingInvoiced,
      status: current.agentBookingInvoiced >= previous.agentBookingInvoiced ? "increase" : "decrease",
      change: `${agentBookingInvoicedChange.toFixed(2)}%`,
    },
    agentPaymentReceived: {
      value: current.agentPaymentReceived,
      status: current.agentPaymentReceived >= previous.agentPaymentReceived ? "increase" : "decrease",
      change: `${agentPaymentReceivedChange.toFixed(2)}%`,
    },
    transportBookingCount: {
      value: transport.current.count,
      status: transport.current.count >= transport.previous.count ? "increase" : "decrease",
      change: `${transportBookingCountChange.toFixed(2)}%`,
    },
    totalBookingCount: {
      value: current.bookingCount,
      status: current.bookingCount >= previous.bookingCount ? "increase" : "decrease",
      change: `${totalBookingCountChange.toFixed(2)}%`,
    },
    totalCustomers: {
      value: passengers.current,
      status: passengers.current >= passengers.previous ? "increase" : "decrease",
      change: `${totalCustomersChange.toFixed(2)}%`,
    },
    transportBooking: {
      value: transport.current.totalPrice,
      status: transport.current.totalPrice >= transport.previous.totalPrice ? "increase" : "decrease",
      change: `${transportBookingTotalChange.toFixed(2)}%`,
    },
    bookingValueBoat1: {
      value: current.boats[1].totalValue,
      status: current.boats[1].totalValue >= previous.boats[1].totalValue ? "increase" : "decrease",
      change: `${bookingValueBoat1Change.toFixed(2)}%`,
    },
    bookingNetValueBoat1: {
      value: current.boats[1].netValue,
      status: current.boats[1].netValue >= previous.boats[1].netValue ? "increase" : "decrease",
      change: `${bookingNetValueBoat1Change.toFixed(2)}%`,
    },
    bookingNetValueBoat2: {
      value: current.boats[2].netValue,
      status: current.boats[2].netValue >= previous.boats[2].netValue ? "increase" : "decrease",
      change: `${bookingNetValueBoat2Change.toFixed(2)}%`,
    },
    bookingNetValueBoat3: {
      value: current.boats[3].netValue,
      status: current.boats[3].netValue >= previous.boats[3].netValue ? "increase" : "decrease",
      change: `${bookingNetValueBoat3Change.toFixed(2)}%`,
    },
    bookingValueBoat2: {
      value: current.boats[2].totalValue,
      status: current.boats[2].totalValue >= previous.boats[2].totalValue ? "increase" : "decrease",
      change: `${bookingValueBoat2Change.toFixed(2)}%`,
    },
    bookingValueBoat3: {
      value: current.boats[3].totalValue,
      status: current.boats[3].totalValue >= previous.boats[3].totalValue ? "increase" : "decrease",
      change: `${bookingValueBoat3Change.toFixed(2)}%`,
    },
    agentCommissionBoat1: {
      value: current.boats[1].commission,
      status: current.boats[1].commission >= previous.boats[1].commission ? "increase" : "decrease",
      change: `${commissionChange1.toFixed(2)}%`,
    },
    agentCommissionBoat2: {
      value: current.boats[2].commission,
      status: current.boats[2].commission >= previous.boats[2].commission ? "increase" : "decrease",
      change: `${commissionChange2.toFixed(2)}%`,
    },
    agentCommissionBoat3: {
      value: current.boats[3].commission,
      status: current.boats[3].commission >= previous.boats[3].commission ? "increase" : "decrease",
      change: `${commissionChange3.toFixed(2)}%`,
    },
    netIncome: {
      value: current.netIncome,
      status: current.netIncome >= previous.netIncome ? "increase" : "decrease",
      change: `${netIncomeChange.toFixed(2)}%`,
    },
  };
};


const buildDateFilter = ({ from, to, month, year, day }) => {
  // For from and to dates
  if (from && to) {
    return { [Op.between]: [from, to] };
  }

  // Convert inputs to numbers and validate
  const numericYear = year ? parseInt(year) : null;
  const numericMonth = month ? parseInt(month) : null;
  const numericDay = day ? parseInt(day) : null;

  console.log("Filter parameters:", { numericYear, numericMonth, numericDay });

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
      .format("YYYY-MM-DD");
    const endDate = moment(`${numericYear}-${numericMonth}-01`)
      .endOf("month")
      .format("YYYY-MM-DD");

    return {
      [Op.between]: [startDate, endDate],
    };
  }

  // Only year
  if (numericYear) {
    const startDate = moment(`${numericYear}-01-01`)
      .startOf("year")
      .format("YYYY-MM-DD");
    const endDate = moment(`${numericYear}-12-31`)
      .endOf("year")
      .format("YYYY-MM-DD");

    return {
      [Op.between]: [startDate, endDate],
    };
  }

  // Default case - return current month if no parameters
  const currentDate = moment();
  return {
    [Op.between]: [
      currentDate.clone().startOf("month").format("YYYY-MM-DD"),
      currentDate.clone().endOf("month").format("YYYY-MM-DD"),
    ],
  };
};

// Controller to fetch metrics

const getMetrics = async (req, res) => {
  try {
    // Ambil parameter filter dari query
    const { from, to, month, year, day } = req.query;

    // Convert parameters to numbers for easier validation
    const numericYear = year ? parseInt(year) : null;
    const numericMonth = month ? parseInt(month) : null;
    const numericDay = day ? parseInt(day) : null;
    
    // Build date filters
    const dateFilter = from && to
      ? { [Op.between]: [from, to] }
      : buildDateFilter({ month, year, day });
    
    let previousPeriodFilter;
    if (from && to) {
      const previousFrom = moment(from).subtract(3, "days").format("YYYY-MM-DD");
      const previousTo = moment(to).subtract(3, "days").format("YYYY-MM-DD");
      previousPeriodFilter = { [Op.between]: [previousFrom, previousTo] };
    } else if (numericYear && !numericMonth && !numericDay) {
      // If only year is provided, use previous year
      previousPeriodFilter = buildDateFilter({
        year: numericYear - 1,
      });
    } else {
      // For month/day combinations
      previousPeriodFilter = buildDateFilter({
        month: numericMonth ? (numericMonth === 1 ? 12 : numericMonth - 1) : undefined,
        year: numericMonth && numericMonth === 1 ? numericYear - 1 : numericYear,
        day,
      });
    }
    
    
    // Log filters untuk debugging
    console.log('Current period filter:', dateFilter);
    console.log('Previous period filter:', previousPeriodFilter);
    
    // Fetch semua data dengan query yang optimal
    const metricsData = await fetchAllMetricsData(dateFilter, previousPeriodFilter);
    
    // Proses data untuk membentuk respon yang dibutuhkan
    const metrics = processMetricsData(metricsData);
    
    // Kirimkan respons
    res.json({
      status: "success",
      metrics
    });
  } catch (error) {
    console.error('Error in getMetrics controller:', error);
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
        where: {
          agent_id,
          created_at: dateFilter,
          payment_status: ["paid", "invoiced"],
        },
      })) ?? 0;


    const currentTransportBooking =
      (await TransportBooking.sum("transport_price", {
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [],
            where: {
              created_at: dateFilter,
              payment_status: ["paid", "invoiced"],
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
          where: {
            agent_id,
            payment_status: ["paid", "invoiced"],
            created_at: dateFilter,
          },
        },
      })) ?? 0;

    const currentTotalCommission =
      (await AgentCommission.sum("amount", {
        include: [
          {
            model: Booking,
            attributes: [],
            required: true,
            where: {
              agent_id,
              created_at: dateFilter,
              payment_status: ["paid", "invoiced"],
            },
          },
        ],
        where: {
          agent_id,
        },
      })) ?? 0;

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
        where: {
          agent_id,
          payment_status: ["paid", "invoiced"],
          created_at: previousPeriodFilter,
        },
      })) ?? 0;



    const previousTransportBooking =
      (await TransportBooking.sum("transport_price", {
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [], // Kosongkan attributes
            where: {
              created_at: previousPeriodFilter,
              payment_status: ["paid", "invoiced"],
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
    const previousTotalCommission =
      (await AgentCommission.sum("amount", {
        include: [
          {
            model: Booking,
            attributes: [],
            required: true,
            where: {
              agent_id,
              created_at: previousPeriodFilter,
            },
          },
        ],
        where: {
          agent_id,
        },
      })) ?? 0;

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
  getAnnualyMetrics,
  getAgentAnnualyMetrics,
  getAgentStatistics,
};
