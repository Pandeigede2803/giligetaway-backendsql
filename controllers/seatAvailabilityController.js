const {
  SeatAvailability,
  Schedule,
  Boat,
  Booking,
  SubSchedule,
  Transit,
  Destination,
  BookingSeatAvailability,
  Passenger,

} = require("../models"); // Adjust the path as needed
const cron = require("node-cron");
const formatScheduleResponse = require("../util/formatScheduleResponse");
const { validationResult } = require('express-validator');
const { buildRouteFromSchedule, buildRouteFromScheduleFlatten } = require("../util/buildRoute");

// create new filtered controller to find related seat availability with same schedule_id and booking_date and have Booking.payment_status = 'paid'
const { Op } = require('sequelize'); // Import Sequelize operators
const { adjustSeatAvailability,boostSeatAvailability,createSeatAvailability, createSeatAvailabilityMax } = require('../util/seatAvailabilityUtils');
const { sub } = require("date-fns/sub");

// update seat availability to bost the available_seats if theres no seat avaialbility create new seat availability
// the param is optional , maybe id, but if the seat not created yet it will be schedule /subscehdule id and booing date

// create me controller to create seat availability use the utils

const createOrGetSeatAvailability = async (req, res) => {
  const { schedule_id, date, subschedule_id, transit_id } = req.body;

  console.log("\n=== createOrGetSeatAvailability ===");
  console.log("Request Body:", {
    schedule_id,
    date,
    subschedule_id,
    transit_id,
  });

  try {
    // STEP 1: Ensure main schedule seat availability exists (no subschedule/transit)
    console.log("1. Checking main schedule seat availability...");
    let mainSeatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id,
        date,
        subschedule_id: null,
        transit_id: null,
      },
    });

    if (!mainSeatAvailability) {
      console.log("2. Main seat not found, creating main schedule seat availability...");
      const result = await createSeatAvailability({
        schedule_id,
        date,
        subschedule_id: null,
        transit_id: null,
        qty: 0,
      });
      mainSeatAvailability = result.mainSeatAvailability;
      console.log("3. Main schedule seat created:", mainSeatAvailability);
    } else {
      console.log("2. Main schedule seat already exists");
    }

    // STEP 2: Now handle requested seat availability (could be same or different if subschedule/transit provided)
    console.log("4. Checking requested seat availability...");
    let seatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id,
        date,
        subschedule_id: subschedule_id ?? null,
        transit_id: transit_id ?? null,
      },
    });

    if (!seatAvailability) {
      console.log("5. Requested seat not found, creating...");
      const result = await createSeatAvailability({
        schedule_id,
        date,
        subschedule_id: subschedule_id ?? null,
        transit_id: transit_id ?? null,
        qty: 0,
      });
      seatAvailability = result.mainSeatAvailability;
      console.log("6. Requested seat created:", seatAvailability);
    } else {
      console.log("5. Requested seat already exists");
    }

    // STEP 3: Respond
    return res.status(200).json({
      success: true,
      message: "Seat availability retrieved or created successfully",
      seat_availability: seatAvailability,
    });

  } catch (error) {
    console.error("❌ Error in createOrGetSeatAvailability:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getSeatAvailabilityByMonthYear = async (req, res) => {
  const { year, month, date, page = 1, limit = 10 } = req.query;

  try {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Validasi page & limit
    if (isNaN(pageNumber) || isNaN(limitNumber)) {
      return res.status(400).json({ error: "Page and limit must be numbers." });
    }

    let dateCondition = {};
    let description = "";

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
      }

      dateCondition = { date: parsedDate };
      description = `for date ${date}`;
    } else if (year && month) {
      const formattedMonth = month.padStart(2, "0");
      const startOfMonth = new Date(`${year}-${formattedMonth}-01`);
      const endOfMonth = new Date(`${year}-${formattedMonth}-01`);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      dateCondition = {
        date: {
          [Op.between]: [startOfMonth, endOfMonth],
        },
      };
      description = `for ${year}-${formattedMonth}`;
    } else {
      return res.status(400).json({
        error: "Provide either 'date' or both 'month' and 'year'.",
      });
    }

    console.log("📅 Fetching seat availability", description);

    const totalCount = await SeatAvailability.count({ where: dateCondition });

    const totalPages = Math.ceil(totalCount / limitNumber);

    const seatAvailabilities = await SeatAvailability.findAll({
      where: dateCondition,
      attributes: [
        "id",
        "schedule_id",
        "available_seats",
        "transit_id",
        "subschedule_id",
        "availability",
        "date",
        "boost",
        "updated_at",
        "created_at",
      ],
      include: [
        {
          model: Schedule,
          required: true,
          attributes: ["id","destination_from_id", "destination_to_id", "departure_time"],
          include: [
            {
              model: Boat,
              as: "Boat",
              required: true,
              attributes: ["id", "capacity", "published_capacity"],
            },
            {
              model: Destination,
              as: "FromDestination",
              required: true,
              attributes: ["id", "name"],
            },
            {
              model: Destination,
              as: "ToDestination",
              required: true,
              attributes: ["id", "name"],
            },
       
          ],
   

      
          
        },
      {
        model: SubSchedule,
        required: false,
        attributes: ["id", "schedule_id",],
        as: "SubSchedule",
        include: [
          {
            model: Destination,
            as: "DestinationFrom",
            attributes: ["name"],
          },
          {
            model: Destination,
            as: "DestinationTo",
            attributes: ["name"],
          },
          {
            model: Transit,
            as: "TransitFrom",
            attributes: ["id"],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["name"],
            },
          },
          {
            model: Transit,
            as: "TransitTo",
            attributes: ["id"],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["name"],
            },
          },
          {
            model: Transit,
            as: "Transit1",
            attributes: ["id"],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["name"],
            },
          },
          {
            model: Transit,
            as: "Transit2",
            attributes: ["id"],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["name"],
            },
          },
          {
            model: Transit,
            as: "Transit3",
            attributes: ["id"],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["name"],
            },
          },
          {
            model: Transit,
            as: "Transit4",
            attributes: ["id"],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["name"],
            },
          },
        ],
      },
        {
          model: BookingSeatAvailability,
          required: false,
          as: "BookingSeatAvailabilities",
          include: [
            {
              model: Booking,
              attributes: ["id",],
              required: false,
              where: {
                payment_status: {
                  [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
                },
              },
              include: [
                {
                  model: Passenger,
                  as: "passengers",
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: limitNumber,
      offset: offset,
    });

 



    const enhancedSeatAvailabilities = seatAvailabilities.map((seatAvailability) => {
      const seatAvailabilityObj = seatAvailability.get({ plain: true });

      let totalPassengers = 0;
      const bookingIds = new Set();

      if (seatAvailabilityObj.BookingSeatAvailabilities) {
        seatAvailabilityObj.BookingSeatAvailabilities.forEach((bsa) => {
          if (bsa.Booking?.passengers?.length > 0) {
            totalPassengers += bsa.Booking.passengers.length;
            bookingIds.add(bsa.Booking.id);
          }
        });
      }

      const correctCapacity = seatAvailabilityObj.boost
        ? seatAvailabilityObj.Schedule?.Boat?.capacity || 0
        : seatAvailabilityObj.Schedule?.Boat?.published_capacity || 0;

      const correctAvailableSeats = correctCapacity - totalPassengers;
      const miss_seat = correctAvailableSeats - seatAvailabilityObj.available_seats;

      const route = seatAvailabilityObj.Schedule
      ? buildRouteFromScheduleFlatten(
          seatAvailabilityObj.Schedule,
          seatAvailabilityObj.SubSchedule
        )
      : null;;

     






      return {
        ...seatAvailabilityObj,
        boat_id: seatAvailabilityObj.Schedule?.Boat?.id,
        total_passengers: totalPassengers,
        total_bookings: bookingIds.size,
        correct_capacity: correctCapacity,
        route: route,
        capacity_match_status:
          totalPassengers + seatAvailabilityObj.available_seats === correctCapacity
            ? "MATCH"
            : "MISMATCH",
        miss_seats: miss_seat,
        BookingSeatAvailabilities: undefined,
      };
    });;





    return res.status(200).json({
      success: true,
      message: `Seat availability fetched ${description}`,
      seat_availabilities: enhancedSeatAvailabilities,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching seat availability:", error.message);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const getSeatAvailabilityMonthlyView = async (req, res) => {
  const { year, month, page = 1 } = req.query;

  try {
    const pageNumber = parseInt(page, 10);
    
    // Validasi input
    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: "Page must be a positive number." });
    }

    if (!year || !month) {
      return res.status(400).json({
        error: "Both 'year' and 'month' parameters are required.",
      });
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        error: "Invalid year or month. Month must be between 1-12.",
      });
    }

    console.log(`📅 Fetching monthly view for ${year}-${month.toString().padStart(2, '0')}, page ${pageNumber}`);

    // Generate all dates in the month
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0); // Last day of month
    const daysInMonth = endOfMonth.getDate();

    // Generate array of all dates in the month
    const allDatesInMonth = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      allDatesInMonth.push(dateStr);
    }

    // Calculate pagination - 14 days (2 weeks) per page
    const daysPerPage = 14;
    const totalPages = Math.ceil(daysInMonth / daysPerPage);
    const startIndex = (pageNumber - 1) * daysPerPage;
    const endIndex = Math.min(startIndex + daysPerPage, daysInMonth);
    
    // Get dates for current page
    const currentPageDates = allDatesInMonth.slice(startIndex, endIndex);
    
    if (currentPageDates.length === 0) {
      return res.status(400).json({
        error: `Page ${pageNumber} is out of range. Total pages: ${totalPages}`,
      });
    }

    const firstDate = currentPageDates[0];
    const lastDate = currentPageDates[currentPageDates.length - 1];

    console.log(`📊 Fetching data for dates: ${firstDate} to ${lastDate} (schedule-only, no subschedule)`);

    // Fetch seat availability data for the date range (exclude subschedule)
    const seatAvailabilities = await SeatAvailability.findAll({
      where: {
        date: {
          [Op.between]: [new Date(firstDate), new Date(lastDate)],
        },
        subschedule_id: null, // Only get records without subschedule
      },
      attributes: [
        "id",
        "schedule_id",
        "available_seats",
        "transit_id",
        "subschedule_id",
        "availability",
        "date",
        "boost",
        "updated_at",
        "created_at",
      ],
      include: [
        {
          model: Schedule,
          required: true,
          attributes: ["id", "destination_from_id", "destination_to_id", "departure_time"],
          include: [
            {
              model: Boat,
              as: "Boat",
              required: true,
              attributes: ["id", "capacity", "published_capacity"],
            },
            {
              model: Destination,
              as: "FromDestination",
              required: true,
              attributes: ["id", "name"],
            },
            {
              model: Destination,
              as: "ToDestination",
              required: true,
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: SubSchedule,
          required: false,
          attributes: ["id", "schedule_id"],
          as: "SubSchedule",
          // Since we're filtering out subschedule_id: null, this will always be null
          // But we keep it for consistency with the interface
          include: [
            {
              model: Destination,
              as: "DestinationFrom",
              attributes: ["name"],
            },
            {
              model: Destination,
              as: "DestinationTo",
              attributes: ["name"],
            },
            {
              model: Transit,
              as: "TransitFrom",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "TransitTo",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit1",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit2",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit3",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit4",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
          ],
        },
        {
          model: BookingSeatAvailability,
          required: false,
          as: "BookingSeatAvailabilities",
          include: [
            {
              model: Booking,
              attributes: ["id"],
              required: false,
              where: {
                payment_status: {
                  [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
                },
              },
              include: [
                {
                  model: Passenger,
                  as: "passengers",
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [["date", "ASC"], ["created_at", "ASC"]], // Sort by date first, then creation time
    });

    // Group seat availabilities by date
    const seatAvailabilityByDate = {};
    seatAvailabilities.forEach((seat) => {
      // Handle both Date object and string
      let dateKey;
      if (seat.date instanceof Date) {
        dateKey = seat.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      } else {
        // If it's already a string, just use it (assuming it's in YYYY-MM-DD format)
        dateKey = seat.date.toString().split('T')[0];
      }
      
      if (!seatAvailabilityByDate[dateKey]) {
        seatAvailabilityByDate[dateKey] = [];
      }
      seatAvailabilityByDate[dateKey].push(seat);
    });

    // Process and enhance seat availability data
    const enhancedSeatAvailabilities = seatAvailabilities.map((seatAvailability) => {
      const seatAvailabilityObj = seatAvailability.get({ plain: true });

      let totalPassengers = 0;
      const bookingIds = new Set();

      if (seatAvailabilityObj.BookingSeatAvailabilities) {
        seatAvailabilityObj.BookingSeatAvailabilities.forEach((bsa) => {
          if (bsa.Booking?.passengers?.length > 0) {
            totalPassengers += bsa.Booking.passengers.length;
            bookingIds.add(bsa.Booking.id);
          }
        });
      }

      const correctCapacity = seatAvailabilityObj.boost
        ? seatAvailabilityObj.Schedule?.Boat?.capacity || 0
        : seatAvailabilityObj.Schedule?.Boat?.published_capacity || 0;

      const correctAvailableSeats = correctCapacity - totalPassengers;
      const miss_seat = correctAvailableSeats - seatAvailabilityObj.available_seats;

      const route = seatAvailabilityObj.Schedule
        ? buildRouteFromScheduleFlatten(
            seatAvailabilityObj.Schedule,
            null // Always null since we're excluding subschedule
          )
        : null;

      return {
        ...seatAvailabilityObj,
        // Ensure date is properly formatted as string
        date: seatAvailabilityObj.date instanceof Date 
          ? seatAvailabilityObj.date.toISOString().split('T')[0] 
          : seatAvailabilityObj.date.toString().split('T')[0],
        boat_id: seatAvailabilityObj.Schedule?.Boat?.id,
        total_passengers: totalPassengers,
        total_bookings: bookingIds.size,
        correct_capacity: correctCapacity,
        route: route,
        capacity_match_status:
          totalPassengers + seatAvailabilityObj.available_seats === correctCapacity
            ? "MATCH"
            : "MISMATCH",
        miss_seats: miss_seat,
        BookingSeatAvailabilities: undefined,
      };
    });

    // Create ordered calendar data structure
    const calendarData = currentPageDates.map((dateStr) => {
      const dateData = seatAvailabilityByDate[dateStr] || [];
      
      // Process the seat data for this date
      const processedSeats = dateData.map((seat) => {
        const seatObj = seat.get({ plain: true });
        
        let totalPassengers = 0;
        const bookingIds = new Set();

        if (seatObj.BookingSeatAvailabilities) {
          seatObj.BookingSeatAvailabilities.forEach((bsa) => {
            if (bsa.Booking?.passengers?.length > 0) {
              totalPassengers += bsa.Booking.passengers.length;
              bookingIds.add(bsa.Booking.id);
            }
          });
        }

        const correctCapacity = seatObj.boost
          ? seatObj.Schedule?.Boat?.capacity || 0
          : seatObj.Schedule?.Boat?.published_capacity || 0;

        const correctAvailableSeats = correctCapacity - totalPassengers;
        const miss_seat = correctAvailableSeats - seatObj.available_seats;

        const route = seatObj.Schedule
          ? buildRouteFromScheduleFlatten(seatObj.Schedule, null) // Always null since we're excluding subschedule
          : null;

        return {
          ...seatObj,
          // Ensure date is properly formatted as string
          date: seatObj.date instanceof Date 
            ? seatObj.date.toISOString().split('T')[0] 
            : seatObj.date.toString().split('T')[0],
          boat_id: seatObj.Schedule?.Boat?.id,
          total_passengers: totalPassengers,
          total_bookings: bookingIds.size,
          correct_capacity: correctCapacity,
          route: route,
          capacity_match_status:
            totalPassengers + seatObj.available_seats === correctCapacity
              ? "MATCH"
              : "MISMATCH",
          miss_seats: miss_seat,
          BookingSeatAvailabilities: undefined,
        };
      });

      return {
        date: dateStr,
        dayOfWeek: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }),
        dayOfMonth: new Date(dateStr).getDate(),
        seatCount: processedSeats.length,
        seats: processedSeats,
        totalPassengers: processedSeats.reduce((sum, seat) => sum + seat.total_passengers, 0),
        totalBookings: processedSeats.reduce((sum, seat) => sum + seat.total_bookings, 0),
        mismatchCount: processedSeats.filter(seat => seat.capacity_match_status === 'MISMATCH').length,
      };
    });

    // Calculate summary statistics for the current page
    const summary = {
      dateRange: {
        start: firstDate,
        end: lastDate,
        totalDays: currentPageDates.length,
      },
      totals: {
        totalSeats: enhancedSeatAvailabilities.length,
        totalPassengers: enhancedSeatAvailabilities.reduce((sum, seat) => sum + seat.total_passengers, 0),
        totalBookings: enhancedSeatAvailabilities.reduce((sum, seat) => sum + seat.total_bookings, 0),
        mismatchedSeats: enhancedSeatAvailabilities.filter(seat => seat.capacity_match_status === 'MISMATCH').length,
        matchedSeats: enhancedSeatAvailabilities.filter(seat => seat.capacity_match_status === 'MATCH').length,
      },
      daysWithData: calendarData.filter(day => day.seatCount > 0).length,
      daysWithoutData: calendarData.filter(day => day.seatCount === 0).length,
    };

    return res.status(200).json({
      success: true,
      message: `Monthly seat availability fetched for ${year}-${month.toString().padStart(2, '0')} (${firstDate} to ${lastDate}) - Schedule only`,
      calendar_data: calendarData, // Ordered by date, 2 weeks per page
      seat_availabilities: enhancedSeatAvailabilities, // All seat data (flat structure for compatibility)
      summary: summary,
      pagination: {
        total: daysInMonth, // Total days in month
        page: pageNumber,
        limit: daysPerPage, // 14 days per page
        totalPages: totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        dateRange: {
          start: firstDate,
          end: lastDate,
          totalDaysInPage: currentPageDates.length,
        },
        monthInfo: {
          year: yearNum,
          month: monthNum,
          totalDaysInMonth: daysInMonth,
          monthName: new Date(yearNum, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching monthly seat availability:", error.message);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};



// Controllers/SeatAvailabilityController.js

/**
 * Memperbaiki miss_seat untuk satu SeatAvailability
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const fixSeatMismatch = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Temukan SeatAvailability dengan relasi yang dibutuhkan
    const seatAvailability = await SeatAvailability.findByPk(id, {
      include: [
        {
          model: Schedule,
          include: [{ model: Boat, as: "Boat" }]
        },
        {
          model: BookingSeatAvailability,
          as: "BookingSeatAvailabilities",
          include: [
            {
              model: Booking,
              where: {
                payment_status: {
                  [Op.in]: ['paid', 'invoiced', 'pending', 'unpaid']
                }
              },
              include: [
                {
                  model: Passenger,
                  as: "passengers",
                }
              ]
            }
          ]
        }
      ]
    });
    
    if (!seatAvailability) {
      return res.status(404).json({
        success: false,
        message: "Seat availability not found",
      });
    }
    
    // Hitung total penumpang
    let totalPassengers = 0;
    seatAvailability.BookingSeatAvailabilities.forEach(bsa => {
      if (bsa.Booking && bsa.Booking.passengers) {
        totalPassengers += bsa.Booking.passengers.length;
      }
    });
    
    // Tentukan kapasitas yang benar
    const correctCapacity = seatAvailability.boost
      ? seatAvailability.Schedule.Boat.capacity
      : seatAvailability.Schedule.Boat.published_capacity;
    
    // Hitung available_seats yang benar
    const correctAvailableSeats = Math.max(0, correctCapacity - totalPassengers);
    
    // Hitung miss_seat sebelum perbaikan
    const originalMissSeat = correctAvailableSeats - seatAvailability.available_seats;
    
    // Jika tidak ada ketidakcocokan, tidak perlu update
    if (originalMissSeat === 0) {
      return res.status(200).json({
        success: true,
        message: "Seat availability already correct",
        seatAvailability,
        originalMissSeat,
        fixed: false,
      });
    }
    
    // Update available_seats
    const updatedSeatAvailability = await seatAvailability.update({
      available_seats: correctAvailableSeats
    });
    
    return res.status(200).json({
      success: true,
      message: "Seat availability mismatch fixed",
      seatAvailability: updatedSeatAvailability,
      originalMissSeat,
      fixed: true
    });
  } catch (error) {
    console.error("Error fixing seat mismatch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fix seat mismatch",
      error: error.message
    });
  }
};

const fixAllSeatMismatches = async () => {
  console.log("🕒 Running Seat Mismatch Fix Job");

  const seatAvailabilities = await SeatAvailability.findAll({
    include: [
      {
        model: Schedule,
        include: [{ model: Boat, as: "Boat" }]
      },
      {
        model: BookingSeatAvailability,
        as: "BookingSeatAvailabilities",
        include: [
          {
            model: Booking,
            where: {
              payment_status: {
                [Op.in]: ['paid', 'invoiced', 'unpaid']
              }
            },
            include: [
              {
                model: Passenger,
                as: "passengers",
              }
            ]
          }
        ]
      }
    ]
  });

  let totalFixed = 0;

  for (const seatAvailability of seatAvailabilities) {
    let totalPassengers = 0;

    seatAvailability.BookingSeatAvailabilities.forEach(bsa => {
      if (bsa.Booking?.passengers?.length) {
        totalPassengers += bsa.Booking.passengers.length;
      }
    });

    const correctCapacity = seatAvailability.boost
      ? seatAvailability.Schedule.Boat.capacity
      : seatAvailability.Schedule.Boat.published_capacity;

    const correctAvailableSeats = Math.max(0, correctCapacity - totalPassengers);

    if (seatAvailability.available_seats !== correctAvailableSeats) {
      await seatAvailability.update({ available_seats: correctAvailableSeats });
      console.log(`✅ Fix Seat ID ${seatAvailability.id} date: ${seatAvailability.date}`);
      totalFixed++;
    }
  }

  console.log(`🎯 Seat mismatch job completed. Total fixed: ${totalFixed}`);
};


/**
 * Memperbaiki miss_seat untuk beberapa SeatAvailability secara batch
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
const fixSeatMismatchBatch = async (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of seat availability IDs"
    });
  }
  
  try {
    // Hasil dari operasi batch
    const results = {
      total: ids.length,
      fixed: 0,
      alreadyCorrect: 0,
      failed: 0,
      details: []
    };
    
    // Proses setiap SeatAvailability
    for (const id of ids) {
      try {
        // Temukan SeatAvailability dengan relasi
        const seatAvailability = await SeatAvailability.findByPk(id, {
          include: [
            {
              model: Schedule,
              include: [{ model: Boat, as: "Boat" }]
            },
            {
              model: BookingSeatAvailability,
              as: "BookingSeatAvailabilities",
              include: [
                {
                  model: Booking,
                  where: {
                    payment_status: {
                      [Op.in]: ['paid', 'invoiced', 'pending', 'unpaid']
                    }
                  },
                  include: [
                    {
                      model: Passenger,
                      as: "passengers",
                    }
                  ]
                }
              ]
            }
          ]
        });
        
        if (!seatAvailability) {
          results.failed++;
          results.details.push({
            id,
            status: 'failed',
            message: 'Seat availability not found'
          });
          continue;
        }
        
        // Hitung total penumpang
        let totalPassengers = 0;
        seatAvailability.BookingSeatAvailabilities.forEach(bsa => {
          if (bsa.Booking && bsa.Booking.passengers) {
            totalPassengers += bsa.Booking.passengers.length;
          }
        });
        
        // Tentukan kapasitas yang benar
        const correctCapacity = seatAvailability.boost
          ? seatAvailability.Schedule.Boat.capacity
          : seatAvailability.Schedule.Boat.published_capacity;
        
        // Hitung available_seats yang benar
        const correctAvailableSeats = Math.max(0, correctCapacity - totalPassengers);
        
        // Hitung miss_seat
        const miss_seat = correctAvailableSeats - seatAvailability.available_seats;
        
        // Jika tidak ada ketidakcocokan, tidak perlu update
        if (miss_seat === 0) {
          results.alreadyCorrect++;
          results.details.push({
            id,
            status: 'already_correct',
            miss_seat: 0
          });
          continue;
        }
        
        // Update available_seats
        await seatAvailability.update({
          available_seats: correctAvailableSeats
        });
        
        results.fixed++;
        results.details.push({
          id,
          status: 'fixed',
          original_miss_seat: miss_seat,
          new_available_seats: correctAvailableSeats
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          id,
          status: 'error',
          message: error.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Fixed ${results.fixed} seat availabilities, ${results.alreadyCorrect} already correct, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error("Error fixing seat mismatches in batch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fix seat mismatches",
      error: error.message
    });
  }
};



const deleteSeatAvailabilityByIds = async (req, res) => {
  const { ids } = req.query;

  try {
    if (Array.isArray(ids) && ids.length > 0) {
      await SeatAvailability.destroy({
        where: {
          id: {
            [Op.in]: ids,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Seat availability with IDs ${ids.join(', ')} has been deleted`,
      });
    }

    return res.status(400).json({
      error: 'Bad request',
      message: 'Ids must be an array with at least one element',
    });
  } catch (error) {
    console.log('Error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
const handleSeatAvailability = async (req, res) => {
  const { seat_availability_id, schedule_id, date, boost } = req.body;

  try {
    if (seat_availability_id && boost === true) {
      // Scenario 1: Boost existing seat availability to the maximum capacity
      console.log('🛠 Scenario 1: Boost existing seat availability to maximum');
      const seatAvailability = await boostSeatAvailability({ id: seat_availability_id, boost });
      return res.status(200).json({
        success: true,
        message: 'Seat availability boosted to maximum successfully.',
        seat_availability: seatAvailability,
      });
    } else if (schedule_id && date) {
      // Scenario 2: Create new seat availability
      console.log('🛠 Scenario 2: Create new seat availability');
      const { mainSeatAvailability, subscheduleSeatAvailabilities } = await createSeatAvailabilityMax({
        schedule_id,
        date,
      });
      return res.status(201).json({
        success: true,
        message: 'Seat availabilities created successfully.',
        mainSeatAvailability,
        subscheduleSeatAvailabilities,
      });
    }

    // Invalid request
    return res.status(400).json({
      success: false,
      message: 'Invalid request: Provide either seat_availability_id with boost=true or schedule_id and date.',
    });
  } catch (error) {
    console.error('Error handling seat availability:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing seat availability.',
      error: error.message,
    });
  }
};

const getFilteredSeatAvailabilityById = async (req, res) => {
  const { id } = req.params; // `id` here is the seat_availability_id

  try {
    // Find the primary SeatAvailability record by ID
    const seatAvailability = await SeatAvailability.findOne({
      where: { id },
      include: [
        {
          model: BookingSeatAvailability,
          as: 'BookingSeatAvailabilities',
          include: [
            {
              model: Booking,
              where: { payment_status:[ 'paid','invoiced','unpaid'] }, // Only include bookings with payment_status 'paid'
            },
          ],
        },
      ],
    });

    if (!seatAvailability) {
      return res.status(404).json({
        status: 'fail',
        message: `Seat availability not found for ID ${id}.`,
      });
    }

    // Now find related seat availabilities with the same schedule_id and booking_date
    const relatedSeatAvailabilities = await SeatAvailability.findAll({
      where: {
        schedule_id: seatAvailability.schedule_id,
        date: seatAvailability.date, // Match booking_date
        id: { [Op.ne]: id }, // Exclude the seat_availability_id passed in the request
      },
      include: [
        {
          model: BookingSeatAvailability,
          as: 'BookingSeatAvailabilities',
          include: [
            {
              model: Booking,
              where: { payment_status:[ 'paid','invoiced','unpaid'] }, // Only include bookings with payment_status 'paid'
            },
          ],
        },
      ],
    });

    // Return only the seat_availability_id of the related records
    const seatAvailabilityIds = relatedSeatAvailabilities.map(sa => sa.id);

    return res.status(200).json({
      status: 'success',
      message: 'Related seat availabilities retrieved successfully',
      seatAvailabilityIds, // Return the list of seat_availability_ids
    });
  } catch (error) {
    console.error('Error fetching related seat availabilities:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching seat availabilities',
      error: error.message,
    });
  }
};



const checkAvailableSeats = async (req, res) => {
  const { schedule_id, booking_date } = req.query;

  try {
    let whereClause = {};
    if (schedule_id) {
      whereClause.schedule_id = schedule_id;
    }
    if (booking_date) {
      whereClause.date = booking_date;
    }

    // Fetch seat availability
    const seatAvailability = await SeatAvailability.findOne({
      where: whereClause,
    });

    if (!seatAvailability) {
      return res
        .status(404)
        .json({
          error: `Seat availability not found for schedule ID ${schedule_id} on date ${booking_date}.`,
        });
    }

    // Return available seats
    return res
      .status(200)
      .json({ available_seats: seatAvailability.available_seats });
  } catch (error) {
    console.log("Error checking available seats:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const checkAllAvailableSeats = async (req, res) => {
  const { schedule_id, booking_date } = req.query;

  try {
    let whereClause = {};
    if (schedule_id) {
      whereClause.schedule_id = schedule_id;
    }
    if (booking_date) {
      whereClause.date = booking_date;
    }

    // Fetch all seat availabilities for the given schedule_id and booking_date, including related details
    const seatAvailabilities = await SeatAvailability.findAll({
      where: whereClause,
      include: [
        {
          model: Schedule,
          include: [
            { model: Destination, as: "DestinationFrom" },
            { model: Destination, as: "DestinationTo" },
            { model: Boat, as: "Boat" },
          ],
        },
        { model: Transit },
        { model: SubSchedule },
      ],
    });

    if (seatAvailabilities.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: `No seat availabilities found for schedule ID ${schedule_id} on date ${booking_date}.`,
      });
    }

    // Return total number of seat availabilities and details
    return res.status(200).json({
      status: "success",
      message: "Seat availabilities retrieved successfully",
      total_seat_availabilities: seatAvailabilities.length,
      seat_availabilities: seatAvailabilities,
    });
  } catch (error) {
    console.log("Error checking available seats:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while checking available seats",
      error: error.message,
    });
  }
};

const checkAllAvailableSeatsBookingCount = async (req, res) => {
  const { schedule_id, booking_date } = req.query;

  try {
    let whereClause = {};
    if (schedule_id) {
      whereClause.schedule_id = schedule_id;
    }
    if (booking_date) {
      whereClause.date = booking_date;
    }

    // Fetch all seat availabilities for the given schedule_id and booking_date, including related details
    const seatAvailabilities = await SeatAvailability.findAll({
      where: whereClause,
      include: [
        {
          model: Schedule,
          include: [
            { model: Destination, as: "DestinationFrom" },
            { model: Destination, as: "DestinationTo" },
            { model: Boat, as: "Boat" },
          ],
        },
        // { model: Transit },
        // { model: SubSchedule },
      ],
    });

    if (seatAvailabilities.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: `No seat availabilities found for schedule ID ${schedule_id} on date ${booking_date}.`,
      });
    }

    // Fetch bookings for each seat availability
    const seatAvailabilitiesWithBookings = await Promise.all(
      seatAvailabilities.map(async (seatAvailability) => {
        const bookings = await BookingSeatAvailability.findAll({
          where: { seat_availability_id: seatAvailability.id },
          include: {
            model: Booking,
            attributes: ['id',
              'contact_name',
              'contact_phone',
              'contact_passport_id',
              'contact_nationality',
              'contact_email',
              'schedule_id',
              'agent_id',
              'payment_method',
              'gross_total',
              'total_passengers',
              'adult_passengers',
              'child_passengers',
              'infant_passengers',
              'payment_status',
              'booking_source',
              'booking_date',
              'ticket_id',
              'created_at',
              'updated_at'
            ],
            include: {
              model: Passenger,
              as:'passengers',
            }

          },
        });
        return {
          ...seatAvailability.get({ plain: true }),
          available_seats: seatAvailability.available_seats, // Ensure available_seats is included
          bookings: bookings.map(bsa => ({ id: bsa.Booking.id })),
        };
      })
    );

    // Return total number of seat availabilities and details
    return res.status(200).json({
      status: "success",
      message: "Seat availabilities retrieved successfully",
      total_seat_availabilities: seatAvailabilities.length,
      seat_availabilities: seatAvailabilitiesWithBookings,
    });
  } catch (error) {
    console.log("Error checking available seats:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while checking available seats",
      error: error.message,
    });
  }
};

const updateSeatAvailability = async (req, res) => {
  const { id } = req.params;
  const {
    schedule_id,
    available_seats,
    transit_id,
    subschedule_id,
    availability,
    boost,
    date
  } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const seatAvailability = await SeatAvailability.findByPk(id);

    if (!seatAvailability) {
      return res.status(404).json({ error: `Seat availability not found for ID ${id}.` });
    }

    const updatedSeatAvailability = await seatAvailability.update({
      schedule_id,
      available_seats,
      transit_id,
      subschedule_id,
      availability,
      boost,
      date
    });

    return res.status(200).json({
      status: "success",
      message: "Seat availability updated successfully",
      seat_availability: updatedSeatAvailability
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating seat availability",
      error: error.message
    });
  }
};


const getAllSeatAvailabilityScheduleAndSubSchedule = async (req, res) => {
  const { schedule_id } = req.query;

  try {
    let seatAvailabilities;

    if (schedule_id) {
      console.log(`Fetching seat availabilities for schedule_id: ${schedule_id}`);
      
      // Fetch specific seat availability for the given schedule_id
      seatAvailabilities = await SeatAvailability.findAll({
        where: { schedule_id },
        include: [
          {
            model: Schedule,
            as: "Schedule",
            include: [
              { model: Boat, as: "Boat" },
              { model: Destination, as: "DestinationFrom" },
              { model: Destination, as: "DestinationTo" }
            ]
          },
          {
            model: SubSchedule,
            as: "SubSchedule",
            include: [
              {
                model: Schedule,
                as: "Schedule",
                include: [
                  { model: Boat, as: "Boat" },
                  { model: Destination, as: "DestinationFrom" },
                  { model: Destination, as: "DestinationTo" }
                ]
              }
            ]
          }
        ]
      });
    } else {
      console.log('Fetching all seat availabilities');
      
      // Fetch all seat availabilities
      seatAvailabilities = await SeatAvailability.findAll({
        include: [
          {
            model: Schedule,
            as: "Schedule",
            include: [
              { model: Boat, as: "Boat" },
              { model: Destination, as: "DestinationFrom" },
              { model: Destination, as: "DestinationTo" }
            ]
          },
          {
            model: SubSchedule,
            as: "SubSchedule",
            include: [
              {
                model: Schedule,
                as: "Schedule",
                include: [
                  { model: Boat, as: "Boat" },
                  { model: Destination, as: "DestinationFrom" },
                  { model: Destination, as: "DestinationTo" }
                ]
              }
            ]
          }
        ]
      });
    }

    if (!seatAvailabilities || seatAvailabilities.length === 0) {
      console.log('No seat availabilities found.');
      return res.status(404).json({
        status: "fail",
        message: "No seat availabilities found."
      });
    }

    console.log(`Found ${seatAvailabilities.length} seat availabilities`);

    // Format the response using formatScheduleResponse utility
    const responseData = seatAvailabilities.map(formatScheduleResponse);

    console.log('Returning formatted seat availabilities data');
    
    // Return the response
    return res.status(200).json({
      status: "success",
      message: "Seat availabilities with schedules and subschedules retrieved successfully",
      seat_availabilities: responseData
    });
  } catch (error) {
    console.error("Error retrieving seat availabilities:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving seat availabilities",
      error: error.message
    });
  }
};


const cronFrequencySeatMatches = process.env.CRON_FREQUENCY_SEAT_MISMATCH || "0 */3 * * *"; // Default setiap 3 jam

// Jalankan setiap 3 jam sekali
cron.schedule('0 */3 * * *', async () => {
  console.log("🚀 Starting scheduled job for seat mismatch correction...");
  await fixAllSeatMismatches();
});


module.exports = {
  checkAvailableSeats,
  createOrGetSeatAvailability,
  checkAllAvailableSeats,
  checkAllAvailableSeatsBookingCount,
  updateSeatAvailability,
  getAllSeatAvailabilityScheduleAndSubSchedule,
  getFilteredSeatAvailabilityById,
 handleSeatAvailability,
 getSeatAvailabilityByMonthYear,
 deleteSeatAvailabilityByIds,
 fixSeatMismatch,
 fixSeatMismatchBatch,fixAllSeatMismatches,
 getSeatAvailabilityMonthlyView
};
