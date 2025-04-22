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
const { el } = require("date-fns/locale/el");


  
 
  


  


const formatMetricsForResponse = (data, agentCount) => {
    // Extract current and previous data
    const { current, previous, transport, passengers } = data;
  
    // Calculate all percentage changes
    const bookingValueChange = calculatePercentageChange(
      current.totalValue,
      previous.totalValue
    );
    const ticketTotalChange = calculatePercentageChange(
      current.ticketTotal,
      previous.ticketTotal
    );
  
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
  
    // Net income change
    const netIncomeChange = calculatePercentageChange(
      current.netIncome,
      previous.netIncome
    );
    const bookingSourceChange = {
      agent: calculatePercentageChange(current.bookingSource.agent, previous.bookingSource.agent),
      website: calculatePercentageChange(current.bookingSource.website, previous.bookingSource.website),
      staff: calculatePercentageChange(current.bookingSource.staff, previous.bookingSource.staff),
      others: calculatePercentageChange(current.bookingSource.others, previous.bookingSource.others),
    };

    const bookingCountBySourceChange = {
      agent: calculatePercentageChange(current.bookingCountBySource.agent, previous.bookingCountBySource.agent),
      website: calculatePercentageChange(current.bookingCountBySource.website, previous.bookingCountBySource.website),
      staff: calculatePercentageChange(current.bookingCountBySource.staff, previous.bookingCountBySource.staff),
    }
    
    

  
    // Build final response in same format as original
    return {
      bookingValue: {
        value: current.totalValue,
        status:
          current.totalValue >= previous.totalValue ? "increase" : "decrease",
        change: `${bookingValueChange.toFixed(2)}%`,
      },
      totalCancelled: {
        value: current.totalCancelled,
        status:
          current.totalCanceled >= previous.totalCancelled
            ? "increase"
            : "decrease",
        change: `${totalCancelledChange.toFixed(2)}%`,
      },
      ticketTotal: {
        value: current.ticketTotal,
        status:
          current.ticketTotal >= previous.ticketTotal ? "increase" : "decrease",
        change: `${ticketTotalChange.toFixed(2)}%`,
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

      // get the agent booking unpaid
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

// //

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
      // console.log(`${period} period commission totals:`, {
      //   boat1: result[period].boats[1].commission || 0,
      //   boat2: result[period].boats[2].commission || 0,
      //   boat3: result[period].boats[3].commission || 0,
      //   total: totalCommission,
      // });
  
      result[period].netIncome = result[period].paymentReceived - totalCommission;
  
      // Log net income calculation
      // console.log(
      //   `${period} net income: ${result[period].paymentReceived} - ${totalCommission} = ${result[period].netIncome}`
      // );
    });
  };
  
  const calculatePercentageChange = (current, previous) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  };
  



const processCommissionDataBookingDate = (commissionData, result) => {
  // console.log("🦷 ini booking data bangsat comission",commissionData)
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

      // // Log untuk debugging
      // console.log(
      //   `Setting commission for boat ${boatId} in ${period} period: ${commissionTotal}`
      // );
    }
  });
};





const processBookingsDataBookingDate = (bookingsData, result) => {
  bookingsData.forEach((booking) => {
    const period = booking.period;
    const boatId = booking.boat_id;
    const grossTotal = parseFloat(booking.gross_total) || 0;
    const ticketTotal = parseFloat(booking.ticket_total) || 0;
    const paymentStatus = booking.payment_status;
    const hasAgent = booking.agent_id !== null;
    const bookingSource = booking.booking_source;

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

    // Process by payment status
    if (paymentStatus === "paid") {
      target.paymentReceived += grossTotal;

      if (hasAgent) {
        target.agentPaymentReceived += grossTotal;
      }

    } else if (paymentStatus === "refund") {
      target.totalRefund += grossTotal;
    } else if (paymentStatus === "invoiced" && hasAgent) {
      target.agentBookingInvoiced += grossTotal;
    } 
    // get the payment status unpaid agent
    else if (paymentStatus === "unpaid" && hasAgent) {
      target.agentBookingUnpaid += grossTotal;
    }
    // get cancel total
   else if (paymentStatus === "cancelled") {
      target.totalCancelled += grossTotal;
    }

    // get ticket total
    if (paymentStatus === "paid" || paymentStatus === "invoiced") {
      target.ticketTotal += ticketTotal;
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

const processTransportDataBookingDate = (transportData, result) => {
  transportData.forEach((transport) => {
    const period = transport.period;
    const price = parseFloat(transport.transport_price) || 0;

    result.transport[period].count++;
    result.transport[period].totalPrice += price;
  });
};

const processPassengerDataBookingDate = (passengerData, result) => {
    // console.log('🫦passengerData:', passengerData);
  passengerData.forEach((passenger) => {
    const period = passenger.period;
    result.passengers[period] = parseInt(passenger.passenger_count) || 0;
  });
};


const processMetricsDataBookingDate = (data) => {
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
        ticketTotal: 0,
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
      processBookingsDataBookingDate(bookingsData, result);
    } else {
      console.warn("bookingsData is not an array or is undefined");
    }
  
    // Proses data commission - pastikan tidak undefined sebelum diproses
    if (Array.isArray(commissionData)) {
      processCommissionDataBookingDate(commissionData, result);
    } else {
      console.warn("commissionData is not an array or is undefined");
    }
  
    // Proses data transport
    if (Array.isArray(transportData)) {
      processTransportDataBookingDate(transportData, result);
    } else {
      console.warn("transportData is not an array or is undefined");
    }
  
    // Proses data passenger
    if (Array.isArray(passengerData)) {
        // console.log("passengerData:", passengerData);
      processPassengerDataBookingDate(passengerData, result);
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


  const fetchAllMetricsDataBookingDate = async (dateFilter, previousPeriodFilter) => {
    console.log("DATE FILTER", dateFilter);
    console.log("PREVIOUS PERIOD FILTER", previousPeriodFilter);   
    try {
      // Queries yang sudah ada
      const bookingsData = await fetchBookingsWithAllDataBookingDate(
        dateFilter,
        previousPeriodFilter
      );
      const transportData = await fetchTransportDataBookingDate(
        dateFilter,
        previousPeriodFilter
      );
      const passengerData = await fetchPassengerCountBookingDate(
        dateFilter,
        previousPeriodFilter
      );
      const agentCount = await Agent.count();
  
      // Tambahkan query commission
      const commissionData = await fetchAgentCommissionByBoatBookingDate(
        dateFilter,
        previousPeriodFilter
      );
      // console.log("agentComissionData bangsat", commissionData);
      
  
      return {
        bookingsData,
        commissionData,
        transportData,
        passengerData,
        agentCount,
      };
    } catch (error) {
      console.error("Error fetching metrics data:", error);
      throw error;
    }
  };


  







//   //

const fetchAgentCommissionByBoatBookingDate = async (dateFilter, previousPeriodFilter) => {
  try {
    // console.log("fetchAgentCommissionByBoatBookingDate called");
    // console.log("dateFilter:", dateFilter);
    // console.log("previousPeriodFilter:", previousPeriodFilter);
    
    // Extract the date ranges directly from the original filters
    let currentDateRange, previousDateRange;
    
    // Check if the Symbol operators exist in the filters
    for (const key of Object.getOwnPropertySymbols(dateFilter.booking_date || {})) {
      if (key.toString() === 'Symbol(between)') {
        currentDateRange = dateFilter.booking_date[key];
      }
    }
    
    for (const key of Object.getOwnPropertySymbols(previousPeriodFilter.booking_date || {})) {
      if (key.toString() === 'Symbol(between)') {
        previousDateRange = previousPeriodFilter.booking_date[key];
      }
    }
    
    if (!currentDateRange || !previousDateRange) {
      console.error("Could not find date ranges in filters");
      return [];
    }
    
    const [prevStart, prevEnd] = previousDateRange;
    const [currentStart, currentEnd] = currentDateRange;
    
    // console.log("Date ranges extracted:", { 
    //   current: [currentStart, currentEnd],
    //   previous: [prevStart, prevEnd]
    // });
    
    // Create a combined where clause for booking dates
    const bookingDateWhere = {
      payment_status: ["invoiced", "paid"],
      [Op.or]: [
        { booking_date: { [Op.between]: [currentStart, currentEnd] } },
        { booking_date: { [Op.between]: [prevStart, prevEnd] } }
      ]
    };
    
    return await AgentCommission.findAll({
      attributes: [
        [
          sequelize.literal(
            `CASE WHEN Booking.booking_date BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
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
          where: bookingDateWhere,
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
      replacements: {
        prevStart,
        prevEnd
      },
      raw: true,
    });
  } catch (error) {
    console.error("Error fetching agent commission data:", error);
    return [];
  }
};
  const fetchBookingsWithAllDataBookingDate = async (dateFilter, previousPeriodFilter) => {

  
    try {

        const combinedFilter = {
            [Op.or]: [dateFilter, previousPeriodFilter],
          };
  

      const combinedBookingDateFilter = {
        [Op.or]: [
          dateFilter.booking_date, // pastikan ini berformat { [Op.between]: [start, end] }
          previousPeriodFilter.booking_date,
        ],
      };
   
  
      // Ekstrak tanggal dengan aman
      let prevStart, prevEnd;
      
      if (previousPeriodFilter.booking_date && previousPeriodFilter.booking_date[Op.between]) {
        [prevStart, prevEnd] = previousPeriodFilter.booking_date[Op.between];
      } else if (previousPeriodFilter[Op.between]) {
        [prevStart, prevEnd] = previousPeriodFilter[Op.between];
      } else {
        // Fallback values
        prevStart = moment().subtract(1, 'month').format('YYYY-MM-DD');
        prevEnd = moment().format('YYYY-MM-DD');
        console.warn('Using fallback dates for previous period:', prevStart, prevEnd);
      }
  
      // Replacements dengan tanggal yang sudah diekstrak dengan aman
      const replacements = {
        prevStart,
        prevEnd,
      };
  
      // console.log('Bookings query replacements:', replacements);
  
      return await Booking.findAll({
        attributes: [
          "id",
          [sequelize.col("schedule.boat_id"), "boat_id"],
          [
            sequelize.literal(
              `CASE WHEN Booking.booking_date BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
            ),
            "period",
          ],
          
          [sequelize.col("Booking.gross_total"), "gross_total"],
          [sequelize.col("Booking.booking_source"), "booking_source"],
          [sequelize.col("Booking.payment_status"), "payment_status"],
          [sequelize.col("Booking.ticket_total"), "ticket_total"],
          [sequelize.col("Booking.agent_id"), "agent_id"],
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
            as: "agentCommission",
            attributes: ["amount"],
            required: false,
          },
        ],
        where: {
          booking_date: combinedBookingDateFilter,
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
  
  const fetchTransportDataBookingDate = async (dateFilter, previousPeriodFilter) => {
    try {
      // Filter gabungan
      const combinedBookingDateFilter = {
        [Op.or]: [
          dateFilter.booking_date, // pastikan ini berformat { [Op.between]: [start, end] }
          previousPeriodFilter.booking_date,
        ],
      };
      
  
      // Ekstrak tanggal dengan aman
      let prevStart, prevEnd;
      
      if (previousPeriodFilter.booking_date && previousPeriodFilter.booking_date[Op.between]) {
        [prevStart, prevEnd] = previousPeriodFilter.booking_date[Op.between];
      } else if (previousPeriodFilter[Op.between]) {
        [prevStart, prevEnd] = previousPeriodFilter[Op.between];
      } else {
        // Fallback values
        prevStart = moment().subtract(1, 'month').format('YYYY-MM-DD');
        prevEnd = moment().format('YYYY-MM-DD');
        console.warn('Using fallback dates for previous period:', prevStart, prevEnd);
      }
  
      // Replacements dengan tanggal yang sudah diekstrak dengan aman
      const replacements = {
        prevStart,
        prevEnd,
      };
  
  
      return await TransportBooking.findAll({
        attributes: [
          [
            sequelize.literal(
              `CASE WHEN booking.booking_date BETWEEN :prevStart AND :prevEnd THEN 'previous' ELSE 'current' END`
            ),
            "period",
          ],
          [sequelize.col("TransportBooking.transport_price"), "transport_price"],
        ],
        include: [
          {
            model: Booking,
            as: "booking",
            attributes: [],
            where: {
              payment_status: ["paid", "invoiced"],
              booking_date: combinedBookingDateFilter,
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
  
  const fetchPassengerCountBookingDate = async (dateFilter, previousPeriodFilter) => {
    try {
      if (!dateFilter?.booking_date || !previousPeriodFilter?.booking_date) {
        throw new Error("Invalid date filters provided.");
      }
  
      let prevStart, prevEnd;
      if (previousPeriodFilter.booking_date[Op.between]) {
        [prevStart, prevEnd] = previousPeriodFilter.booking_date[Op.between];
      } else {
        prevStart = moment().subtract(1, 'month').format('YYYY-MM-DD');
        prevEnd = moment().format('YYYY-MM-DD');
        console.warn("Using fallback dates for previous period:", prevStart, prevEnd);
      }
  
      console.log("Fetching Booking data...");
      
      // Ambil semua booking berdasarkan filter
      const bookings = await Booking.findAll({
        attributes: ["id", "booking_date", "total_passengers"],
        where: {
          [Op.or]: [dateFilter, previousPeriodFilter],
        },
        raw: true, 
      });
  

  
      // **Jumlahkan total_passengers berdasarkan periode**
      const summary = bookings.reduce(
        (acc, booking) => {
          const period =
            booking.booking_date >= prevStart && booking.booking_date <= prevEnd
              ? "previous"
              : "current";
  
          acc[period] += booking.total_passengers || 0; // Pastikan tetap 0 jika undefined
          return acc;
        },
        { previous: 0, current: 0 } 
      );
  
      // **Pastikan output selalu berbentuk array**
      const passengerData = [
        { period: "current", passenger_count: summary.current || 0 },
        { period: "previous", passenger_count: summary.previous || 0 },
      ];
  
      // console.log("🫦 passengerData:", passengerData);
  
      return passengerData;
    } catch (error) {
      console.error("Error fetching passenger count:", error);
      throw error;
    }
  };
  


  module.exports = {
    fetchAgentCommissionByBoatBookingDate,
    fetchBookingsWithAllDataBookingDate,
    fetchTransportDataBookingDate,
    fetchPassengerCountBookingDate,
    processCommissionDataBookingDate,
    processBookingsDataBookingDate,
    processTransportDataBookingDate,
    processPassengerDataBookingDate,
    processMetricsDataBookingDate,  // Ganti nama agar konsisten
    fetchAllMetricsDataBookingDate  // Ubah nama untuk konsistensi
  };