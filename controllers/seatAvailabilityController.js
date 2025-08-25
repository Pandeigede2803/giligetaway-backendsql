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
  SubScheduleRelation,
  sequelize,
} = require("../models"); // Adjust the path as needed
const { QueryTypes } = require("sequelize");
const cron = require("node-cron");
const formatScheduleResponse = require("../util/formatScheduleResponse");
const { validationResult } = require("express-validator");
const {
  buildRouteFromSchedule,
  buildRouteFromScheduleFlatten,
} = require("../util/buildRoute");
const nodemailer = require("nodemailer");

// create new filtered controller to find related seat availability with same schedule_id and booking_date and have Booking.payment_status = 'paid'
const { Op } = require("sequelize"); // Import Sequelize operators
const {
  adjustSeatAvailability,
  boostSeatAvailability,
  createSeatAvailability,
  createSeatAvailability2,
  createSeatAvailabilityMax,
} = require("../util/seatAvailabilityUtils");
const { sub } = require("date-fns/sub");
const { sendTelegramMessage } = require("..//util/telegram");

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
      console.log(
        "2. Main seat not found, creating main schedule seat availability..."
      );
      const result = await createSeatAvailability2({
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
      const result = await createSeatAvailability2({
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

const findBoostedSeats = async () => {
  // find the seat availability that boost is true and the availability is true
  const boostedSeats = await SeatAvailability.findAll({
    where: {
      boost: true,
      availability: true,
      date: {
        [Op.startsWith]: "2025-07",
      },
    },
  });
  console.log(`🔍 Found ${boostedSeats.length} boosted seats.`);
  return boostedSeats;
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
        return res
          .status(400)
          .json({ error: "Invalid date format. Use YYYY-MM-DD." });
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
          attributes: [
            "id",
            "destination_from_id",
            "destination_to_id",
            "departure_time",
          ],
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
                  where: {
                    passenger_type: {
                      [Op.ne]: "infant", // ⛔ exclude infant
                    },
                  },
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

    const enhancedSeatAvailabilities = seatAvailabilities.map(
      (seatAvailability) => {
        const seatAvailabilityObj = seatAvailability.get({ plain: true });

        // let totalPassengers = 0;
        // const bookingIds = new Set();

        // if (seatAvailabilityObj.BookingSeatAvailabilities) {
        //   seatAvailabilityObj.BookingSeatAvailabilities.forEach((bsa) => {
        //     if (bsa.Booking?.passengers?.length > 0) {
        //       totalPassengers += bsa.Booking.passengers.length;
        //       bookingIds.add(bsa.Booking.id);
        //     }
        //   });
        // }
        const seatNumbers = new Set();
        const bookingIds = new Set();

        if (seatAvailabilityObj.BookingSeatAvailabilities) {
          seatAvailabilityObj.BookingSeatAvailabilities.forEach((bsa) => {
            const booking = bsa.Booking;
            if (booking?.passengers?.length > 0) {
              bookingIds.add(booking.id);
              booking.passengers.forEach((p) => {
                if (p.seat_number) {
                  seatNumbers.add(p.seat_number.trim().toUpperCase()); // normalisasi
                }
              });
            }
          });
        }

        const totalPassengers = seatNumbers.size; // now it's total seat used, not raw passengers

        const correctCapacity = seatAvailabilityObj.boost
          ? seatAvailabilityObj.Schedule?.Boat?.capacity || 0
          : seatAvailabilityObj.Schedule?.Boat?.published_capacity || 0;

        const correctAvailableSeats = correctCapacity - totalPassengers;
        const miss_seat =
          correctAvailableSeats - seatAvailabilityObj.available_seats;

        const route = seatAvailabilityObj.Schedule
          ? buildRouteFromScheduleFlatten(
              seatAvailabilityObj.Schedule,
              seatAvailabilityObj.SubSchedule
            )
          : null;

        return {
          ...seatAvailabilityObj,
          boat_id: seatAvailabilityObj.Schedule?.Boat?.id,
          total_passengers: totalPassengers,
          total_bookings: bookingIds.size,
          correct_capacity: correctCapacity,
          route: route,
          capacity_match_status:
            totalPassengers + seatAvailabilityObj.available_seats ===
            correctCapacity
              ? "MATCH"
              : "MISMATCH",
          miss_seats: miss_seat,
          BookingSeatAvailabilities: undefined,
        };
      }
    );

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

// Helper Functions
const validateInput = (year, month, page) => {
  const pageNumber = parseInt(page, 10);

  if (isNaN(pageNumber) || pageNumber < 1) {
    throw new Error("Page must be a positive number.");
  }

  if (!year || !month) {
    throw new Error("Both 'year' and 'month' parameters are required.");
  }

  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new Error("Invalid year or month. Month must be between 1-12.");
  }

  return { yearNum, monthNum, pageNumber };
};

const generateMonthDates = (year, month) => {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  const daysInMonth = endOfMonth.getDate();

  const allDatesInMonth = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    allDatesInMonth.push(dateStr);
  }

  return { allDatesInMonth, daysInMonth };
};

const calculatePagination = (allDatesInMonth, daysInMonth, pageNumber) => {
  const daysPerPage = 14;
  const totalPages = Math.ceil(daysInMonth / daysPerPage);
  const startIndex = (pageNumber - 1) * daysPerPage;
  const endIndex = Math.min(startIndex + daysPerPage, daysInMonth);

  const currentPageDates = allDatesInMonth.slice(startIndex, endIndex);

  if (currentPageDates.length === 0) {
    throw new Error(
      `Page ${pageNumber} is out of range. Total pages: ${totalPages}`
    );
  }

  return {
    currentPageDates,
    daysPerPage,
    totalPages,
    firstDate: currentPageDates[0],
    lastDate: currentPageDates[currentPageDates.length - 1],
  };
};

const buildSeatAvailabilityQuery = () => {
  return `
    WITH booking_passengers AS (
      SELECT 
        bsa.seat_availability_id,
        COUNT(p.id) as passenger_count,
        COUNT(DISTINCT b.id) as booking_count
      FROM BookingSeatAvailability bsa
      JOIN Bookings b ON bsa.booking_id = b.id
      LEFT JOIN Passengers p ON b.id = p.booking_id
      WHERE b.payment_status IN ('paid', 'invoiced', 'pending', 'unpaid')
      GROUP BY bsa.seat_availability_id
    )
    SELECT 
      -- SeatAvailability fields
      sa.id, sa.schedule_id, sa.available_seats, sa.transit_id, sa.subschedule_id,
      sa.availability, sa.date, sa.boost, sa.updated_at as sa_updated_at, sa.created_at as sa_created_at,
      
      -- Schedule fields
      s.id as schedule_id, s.destination_from_id as schedule_destination_from_id,
      s.destination_to_id as schedule_destination_to_id, s.departure_time,
      
      -- Boat fields
      b.id as boat_id, b.capacity, b.published_capacity,
      
      -- Schedule Destinations
      df.id as from_destination_id, df.name as from_destination_name,
      dt.id as to_destination_id, dt.name as to_destination_name,
      
      -- SubSchedule fields
      sub.id as subschedule_id, sub.schedule_id as sub_schedule_id,
      
      -- SubSchedule Destinations
      sub_df.id as sub_from_destination_id, sub_df.name as sub_from_destination_name,
      sub_dt.id as sub_to_destination_id, sub_dt.name as sub_to_destination_name,
      
      -- Transit fields
      t_from.id as transit_from_id, td_from.id as transit_from_destination_id, td_from.name as transit_from_destination_name,
      t_to.id as transit_to_id, td_to.id as transit_to_destination_id, td_to.name as transit_to_destination_name,
      t1.id as transit_1_id, td1.id as transit_1_destination_id, td1.name as transit_1_destination_name,
      t2.id as transit_2_id, td2.id as transit_2_destination_id, td2.name as transit_2_destination_name,
      t3.id as transit_3_id, td3.id as transit_3_destination_id, td3.name as transit_3_destination_name,
      t4.id as transit_4_id, td4.id as transit_4_destination_id, td4.name as transit_4_destination_name,
      
      -- Booking data
      COALESCE(bp.passenger_count, 0) as total_passengers,
      COALESCE(bp.booking_count, 0) as total_bookings
      
    FROM SeatAvailability sa
    JOIN Schedules s ON sa.schedule_id = s.id
    JOIN Boats b ON s.boat_id = b.id
    JOIN Destinations df ON s.destination_from_id = df.id
    JOIN Destinations dt ON s.destination_to_id = dt.id
    
    -- SubSchedule joins
    LEFT JOIN SubSchedules sub ON sa.subschedule_id = sub.id
    LEFT JOIN Destinations sub_df ON sub.destination_from_schedule_id = sub_df.id
    LEFT JOIN Destinations sub_dt ON sub.destination_to_schedule_id = sub_dt.id
    
    -- Transit joins
    LEFT JOIN Transits t_from ON sub.transit_from_id = t_from.id
    LEFT JOIN Destinations td_from ON t_from.destination_id = td_from.id
    LEFT JOIN Transits t_to ON sub.transit_to_id = t_to.id
    LEFT JOIN Destinations td_to ON t_to.destination_id = td_to.id
    LEFT JOIN Transits t1 ON sub.transit_1 = t1.id
    LEFT JOIN Destinations td1 ON t1.destination_id = td1.id
    LEFT JOIN Transits t2 ON sub.transit_2 = t2.id
    LEFT JOIN Destinations td2 ON t2.destination_id = td2.id
    LEFT JOIN Transits t3 ON sub.transit_3 = t3.id
    LEFT JOIN Destinations td3 ON t3.destination_id = td3.id
    LEFT JOIN Transits t4 ON sub.transit_4 = t4.id
    LEFT JOIN Destinations td4 ON t4.destination_id = td4.id
    
    -- Booking data
    LEFT JOIN booking_passengers bp ON sa.id = bp.seat_availability_id
    
    WHERE sa.date BETWEEN :firstDate AND :lastDate
    ORDER BY sa.date ASC, sa.created_at ASC
  `;
};

const buildRouteFromRawData = (row, isSubschedule = false) => {
  if (isSubschedule && row.subschedule_id) {
    const schedule = {
      FromDestination: {
        id: row.from_destination_id,
        name: row.from_destination_name,
      },
      ToDestination: {
        id: row.to_destination_id,
        name: row.to_destination_name,
      },
    };

    const subSchedule = {
      DestinationFrom: row.sub_from_destination_id
        ? {
            id: row.sub_from_destination_id,
            name: row.sub_from_destination_name,
          }
        : null,
      DestinationTo: row.sub_to_destination_id
        ? { id: row.sub_to_destination_id, name: row.sub_to_destination_name }
        : null,
      TransitFrom: row.transit_from_id
        ? {
            id: row.transit_from_id,
            Destination: {
              id: row.transit_from_destination_id,
              name: row.transit_from_destination_name,
            },
          }
        : null,
      TransitTo: row.transit_to_id
        ? {
            id: row.transit_to_id,
            Destination: {
              id: row.transit_to_destination_id,
              name: row.transit_to_destination_name,
            },
          }
        : null,
      Transit1: row.transit_1_id
        ? {
            id: row.transit_1_id,
            Destination: {
              id: row.transit_1_destination_id,
              name: row.transit_1_destination_name,
            },
          }
        : null,
      Transit2: row.transit_2_id
        ? {
            id: row.transit_2_id,
            Destination: {
              id: row.transit_2_destination_id,
              name: row.transit_2_destination_name,
            },
          }
        : null,
      Transit3: row.transit_3_id
        ? {
            id: row.transit_3_id,
            Destination: {
              id: row.transit_3_destination_id,
              name: row.transit_3_destination_name,
            },
          }
        : null,
      Transit4: row.transit_4_id
        ? {
            id: row.transit_4_id,
            Destination: {
              id: row.transit_4_destination_id,
              name: row.transit_4_destination_name,
            },
          }
        : null,
    };

    return buildRouteFromScheduleFlatten(schedule, subSchedule);
  } else {
    const schedule = {
      FromDestination: {
        id: row.from_destination_id,
        name: row.from_destination_name,
      },
      ToDestination: {
        id: row.to_destination_id,
        name: row.to_destination_name,
      },
    };
    return buildRouteFromScheduleFlatten(schedule, null);
  }
};

const processQueryResults = (results) => {
  const scheduleSeats = [];
  const subscheduleSeats = [];

  results.forEach((row) => {
    const correctCapacity = row.boost ? row.capacity : row.published_capacity;
    const correctAvailableSeats = correctCapacity - row.total_passengers;
    const miss_seat = correctAvailableSeats - row.available_seats;

    const processedSeat = {
      id: row.id,
      schedule_id: row.schedule_id,
      available_seats: row.available_seats,
      transit_id: row.transit_id,
      subschedule_id: row.subschedule_id,
      availability: row.availability,
      date:
        row.date instanceof Date
          ? row.date.toISOString().split("T")[0]
          : row.date.toString().split("T")[0],
      boost: row.boost,
      updated_at: row.sa_updated_at,
      created_at: row.sa_created_at,
      boat_id: row.boat_id,
      total_passengers: row.total_passengers,
      total_bookings: row.total_bookings,
      correct_capacity: correctCapacity,
      route: buildRouteFromRawData(row, row.subschedule_id !== null),
      capacity_match_status:
        row.total_passengers + row.available_seats === correctCapacity
          ? "MATCH"
          : "MISMATCH",
      miss_seats: miss_seat,
      Schedule: {
        id: row.schedule_id,
        destination_from_id: row.schedule_destination_from_id,
        destination_to_id: row.schedule_destination_to_id,
        departure_time: row.departure_time,
        Boat: {
          id: row.boat_id,
          capacity: row.capacity,
          published_capacity: row.published_capacity,
        },
        FromDestination: {
          id: row.from_destination_id,
          name: row.from_destination_name,
        },
        ToDestination: {
          id: row.to_destination_id,
          name: row.to_destination_name,
        },
      },
    };

    if (row.subschedule_id) {
      processedSeat.SubSchedule = buildSubScheduleObject(row);
      subscheduleSeats.push(processedSeat);
    } else {
      scheduleSeats.push(processedSeat);
    }
  });

  return { scheduleSeats, subscheduleSeats };
};

const buildSubScheduleObject = (row) => {
  return {
    id: row.subschedule_id,
    schedule_id: row.sub_schedule_id,
    DestinationFrom: row.sub_from_destination_id
      ? {
          id: row.sub_from_destination_id,
          name: row.sub_from_destination_name,
        }
      : null,
    DestinationTo: row.sub_to_destination_id
      ? {
          id: row.sub_to_destination_id,
          name: row.sub_to_destination_name,
        }
      : null,
    TransitFrom: row.transit_from_id
      ? {
          id: row.transit_from_id,
          Destination: {
            id: row.transit_from_destination_id,
            name: row.transit_from_destination_name,
          },
        }
      : null,
    TransitTo: row.transit_to_id
      ? {
          id: row.transit_to_id,
          Destination: {
            id: row.transit_to_destination_id,
            name: row.transit_to_destination_name,
          },
        }
      : null,
    Transit1: row.transit_1_id
      ? {
          id: row.transit_1_id,
          Destination: {
            id: row.transit_1_destination_id,
            name: row.transit_1_destination_name,
          },
        }
      : null,
    Transit2: row.transit_2_id
      ? {
          id: row.transit_2_id,
          Destination: {
            id: row.transit_2_destination_id,
            name: row.transit_2_destination_name,
          },
        }
      : null,
    Transit3: row.transit_3_id
      ? {
          id: row.transit_3_id,
          Destination: {
            id: row.transit_3_destination_id,
            name: row.transit_3_destination_name,
          },
        }
      : null,
    Transit4: row.transit_4_id
      ? {
          id: row.transit_4_id,
          Destination: {
            id: row.transit_4_destination_id,
            name: row.transit_4_destination_name,
          },
        }
      : null,
  };
};

const mergeScheduleAndSubscheduleSeats = (scheduleSeats, subscheduleSeats) => {
  const subscheduleByScheduleAndDate = new Map();

  subscheduleSeats.forEach((subSeat) => {
    const key = `${subSeat.schedule_id}_${subSeat.date}`;
    if (!subscheduleByScheduleAndDate.has(key)) {
      subscheduleByScheduleAndDate.set(key, []);
    }

    subscheduleByScheduleAndDate.get(key).push({
      id: subSeat.id,
      subschedule_id: subSeat.subschedule_id,
      available_seats: subSeat.available_seats,
      transit_id: subSeat.transit_id,
      availability: subSeat.availability,
      boost: subSeat.boost,
      total_passengers: subSeat.total_passengers,
      total_bookings: subSeat.total_bookings,
      correct_capacity: subSeat.correct_capacity,
      route: subSeat.route,
      capacity_match_status: subSeat.capacity_match_status,
      miss_seats: subSeat.miss_seats,
      SubSchedule: subSeat.SubSchedule,
      updated_at: subSeat.updated_at,
      created_at: subSeat.created_at,
    });
  });

  return scheduleSeats.map((scheduleSeat) => {
    const key = `${scheduleSeat.schedule_id}_${scheduleSeat.date}`;
    const relatedSubscheduleSeats = subscheduleByScheduleAndDate.get(key) || [];

    return {
      ...scheduleSeat,
      subschedule_seat: relatedSubscheduleSeats,
    };
  });
};

const createCalendarData = (enhancedSeatAvailabilities, currentPageDates) => {
  const seatAvailabilityByDate = new Map();
  enhancedSeatAvailabilities.forEach((seat) => {
    const dateKey = seat.date;
    if (!seatAvailabilityByDate.has(dateKey)) {
      seatAvailabilityByDate.set(dateKey, []);
    }
    seatAvailabilityByDate.get(dateKey).push(seat);
  });

  return currentPageDates.map((dateStr) => {
    const dateData = seatAvailabilityByDate.get(dateStr) || [];

    let totalPassengers = 0;
    let totalBookings = 0;
    let mismatchCount = 0;
    let totalSubscheduleSeats = 0;

    dateData.forEach((seat) => {
      totalPassengers += seat.total_passengers;
      totalBookings += seat.total_bookings;
      if (seat.capacity_match_status === "MISMATCH") mismatchCount++;

      seat.subschedule_seat.forEach((subSeat) => {
        totalPassengers += subSeat.total_passengers;
        totalBookings += subSeat.total_bookings;
        if (subSeat.capacity_match_status === "MISMATCH") mismatchCount++;
        totalSubscheduleSeats++;
      });
    });

    return {
      date: dateStr,
      dayOfWeek: new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "long",
      }),
      dayOfMonth: new Date(dateStr).getDate(),
      seatCount: dateData.length,
      subscheduleSeatsCount: totalSubscheduleSeats,
      seats: dateData,
      totalPassengers: totalPassengers,
      totalBookings: totalBookings,
      mismatchCount: mismatchCount,
    };
  });
};

const calculateSummary = (
  enhancedSeatAvailabilities,
  currentPageDates,
  firstDate,
  lastDate
) => {
  let totalScheduleSeats = enhancedSeatAvailabilities.length;
  let totalSubscheduleSeats = 0;
  let totalPassengers = 0;
  let totalBookings = 0;
  let mismatchedSeats = 0;

  enhancedSeatAvailabilities.forEach((seat) => {
    totalPassengers += seat.total_passengers;
    totalBookings += seat.total_bookings;
    if (seat.capacity_match_status === "MISMATCH") mismatchedSeats++;

    seat.subschedule_seat.forEach((subSeat) => {
      totalSubscheduleSeats++;
      totalPassengers += subSeat.total_passengers;
      totalBookings += subSeat.total_bookings;
      if (subSeat.capacity_match_status === "MISMATCH") mismatchedSeats++;
    });
  });

  return {
    dateRange: {
      start: firstDate,
      end: lastDate,
      totalDays: currentPageDates.length,
    },
    totals: {
      totalScheduleSeats: totalScheduleSeats,
      totalSubscheduleSeats: totalSubscheduleSeats,
      totalSeats: totalScheduleSeats + totalSubscheduleSeats,
      totalPassengers: totalPassengers,
      totalBookings: totalBookings,
      mismatchedSeats: mismatchedSeats,
      matchedSeats:
        totalScheduleSeats + totalSubscheduleSeats - mismatchedSeats,
    },
  };
};

const buildPaginationInfo = (
  daysInMonth,
  pageNumber,
  daysPerPage,
  totalPages,
  firstDate,
  lastDate,
  currentPageDates,
  yearNum,
  monthNum
) => {
  return {
    total: daysInMonth,
    page: pageNumber,
    limit: daysPerPage,
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
      monthName: new Date(yearNum, monthNum - 1, 1).toLocaleDateString(
        "en-US",
        { month: "long" }
      ),
    },
  };
};

// Main Controller Function
const getSeatAvailabilityMonthlyView = async (req, res) => {
  const { year, month, page = 1 } = req.query;

  try {
    // 1. Validate input
    const { yearNum, monthNum, pageNumber } = validateInput(year, month, page);

    console.log(
      `📅 Fetching monthly view for ${year}-${month.toString().padStart(2, "0")}, page ${pageNumber}`
    );

    // 2. Generate dates and calculate pagination
    const { allDatesInMonth, daysInMonth } = generateMonthDates(
      yearNum,
      monthNum
    );
    const { currentPageDates, daysPerPage, totalPages, firstDate, lastDate } =
      calculatePagination(allDatesInMonth, daysInMonth, pageNumber);

    console.log(`📊 Fetching data for dates: ${firstDate} to ${lastDate}`);

    // 3. Execute database query
    const rawQuery = buildSeatAvailabilityQuery();
    const results = await sequelize.query(rawQuery, {
      replacements: { firstDate, lastDate },
      type: sequelize.QueryTypes.SELECT,
    });

    console.log(`📊 Raw query returned ${results.length} rows`);

    // 4. Process query results
    const { scheduleSeats, subscheduleSeats } = processQueryResults(results);

    // 5. Merge schedule and subschedule seats
    const enhancedSeatAvailabilities = mergeScheduleAndSubscheduleSeats(
      scheduleSeats,
      subscheduleSeats
    );

    // 6. Create calendar data
    const calendarData = createCalendarData(
      enhancedSeatAvailabilities,
      currentPageDates
    );

    // 7. Calculate summary
    const summary = calculateSummary(
      enhancedSeatAvailabilities,
      currentPageDates,
      firstDate,
      lastDate
    );
    summary.daysWithData = calendarData.filter(
      (day) => day.seatCount > 0
    ).length;
    summary.daysWithoutData = calendarData.filter(
      (day) => day.seatCount === 0
    ).length;

    // 8. Build pagination info
    const paginationInfo = buildPaginationInfo(
      daysInMonth,
      pageNumber,
      daysPerPage,
      totalPages,
      firstDate,
      lastDate,
      currentPageDates,
      yearNum,
      monthNum
    );

    console.log(
      `📊 Processed ${scheduleSeats.length} schedule seats and ${subscheduleSeats.length} subschedule seats`
    );

    return res.status(200).json({
      success: true,
      message: `Monthly seat availability fetched for ${year}-${month.toString().padStart(2, "0")} (${firstDate} to ${lastDate}) - Schedule with nested subschedule`,
      calendar_data: calendarData,
      seat_availabilities: enhancedSeatAvailabilities,
      summary: summary,
      pagination: paginationInfo,
    });
  } catch (error) {
    console.error(
      "❌ Error fetching monthly seat availability:",
      error.message
    );
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// const getSeatAvailabilityMonthlyView = async (req, res) => {
//   const { year, month, page = 1 } = req.query;

//   try {
//     const pageNumber = parseInt(page, 10);

//     // Validasi input
//     if (isNaN(pageNumber) || pageNumber < 1) {
//       return res.status(400).json({ error: "Page must be a positive number." });
//     }

//     if (!year || !month) {
//       return res.status(400).json({
//         error: "Both 'year' and 'month' parameters are required.",
//       });
//     }

//     const yearNum = parseInt(year, 10);
//     const monthNum = parseInt(month, 10);

//     if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
//       return res.status(400).json({
//         error: "Invalid year or month. Month must be between 1-12.",
//       });
//     }

//     console.log(`📅 Fetching monthly view for ${year}-${month.toString().padStart(2, '0')}, page ${pageNumber}`);

//     // Generate all dates in the month
//     const startOfMonth = new Date(yearNum, monthNum - 1, 1);
//     const endOfMonth = new Date(yearNum, monthNum, 0); // Last day of month
//     const daysInMonth = endOfMonth.getDate();

//     // Generate array of all dates in the month
//     const allDatesInMonth = [];
//     for (let day = 1; day <= daysInMonth; day++) {
//       const dateStr = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
//       allDatesInMonth.push(dateStr);
//     }

//     // Calculate pagination - 14 days (2 weeks) per page
//     const daysPerPage = 14;
//     const totalPages = Math.ceil(daysInMonth / daysPerPage);
//     const startIndex = (pageNumber - 1) * daysPerPage;
//     const endIndex = Math.min(startIndex + daysPerPage, daysInMonth);

//     // Get dates for current page
//     const currentPageDates = allDatesInMonth.slice(startIndex, endIndex);

//     if (currentPageDates.length === 0) {
//       return res.status(400).json({
//         error: `Page ${pageNumber} is out of range. Total pages: ${totalPages}`,
//       });
//     }

//     const firstDate = currentPageDates[0];
//     const lastDate = currentPageDates[currentPageDates.length - 1];

//     console.log(`📊 Fetching data for dates: ${firstDate} to ${lastDate} (including both schedule and subschedule)`);

//     // First, get all schedule seats (subschedule_id = null)
//     const scheduleSeats = await SeatAvailability.findAll({
//       where: {
//         date: {
//           [Op.between]: [new Date(firstDate), new Date(lastDate)],
//         },
//         subschedule_id: null, // Only schedule seats
//       },
//       attributes: [
//         "id",
//         "schedule_id",
//         "available_seats",
//         "transit_id",
//         "subschedule_id",
//         "availability",
//         "date",
//         "boost",
//         "updated_at",
//         "created_at",
//       ],
//       include: [
//         {
//           model: Schedule,
//           required: true,
//           attributes: ["id", "destination_from_id", "destination_to_id", "departure_time"],
//           include: [
//             {
//               model: Boat,
//               as: "Boat",
//               required: true,
//               attributes: ["id", "capacity", "published_capacity"],
//             },
//             {
//               model: Destination,
//               as: "FromDestination",
//               required: true,
//               attributes: ["id", "name"],
//             },
//             {
//               model: Destination,
//               as: "ToDestination",
//               required: true,
//               attributes: ["id", "name"],
//             },
//           ],
//         },
//         {
//           model: BookingSeatAvailability,
//           required: false,
//           as: "BookingSeatAvailabilities",
//           include: [
//             {
//               model: Booking,
//               attributes: ["id"],
//               required: false,
//               where: {
//                 payment_status: {
//                   [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
//                 },
//               },
//               include: [
//                 {
//                   model: Passenger,
//                   as: "passengers",
//                   required: false,
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//       order: [["date", "ASC"], ["created_at", "ASC"]],
//     });

//     // Then, get all subschedule seats (subschedule_id IS NOT NULL)
//     const subscheduleSeats = await SeatAvailability.findAll({
//       where: {
//         date: {
//           [Op.between]: [new Date(firstDate), new Date(lastDate)],
//         },
//         subschedule_id: {
//           [Op.ne]: null, // Only subschedule seats
//         },
//       },
//       attributes: [
//         "id",
//         "schedule_id",
//         "available_seats",
//         "transit_id",
//         "subschedule_id",
//         "availability",
//         "date",
//         "boost",
//         "updated_at",
//         "created_at",
//       ],
//       include: [
//         {
//           model: Schedule,
//           required: true,
//           attributes: ["id", "destination_from_id", "destination_to_id", "departure_time"],
//           include: [
//             {
//               model: Boat,
//               as: "Boat",
//               required: true,
//               attributes: ["id", "capacity", "published_capacity"],
//             },
//             {
//               model: Destination,
//               as: "FromDestination",
//               required: true,
//               attributes: ["id", "name"],
//             },
//             {
//               model: Destination,
//               as: "ToDestination",
//               required: true,
//               attributes: ["id", "name"],
//             },
//           ],
//         },
//         {
//           model: SubSchedule,
//           required: true,
//           attributes: [
//             "id",
//             "schedule_id",
//             // "destination_from_id",
//             // "destination_to_id",
//             // "transit_from_id",
//             // "transit_to_id",
//             // "transit_1_id",
//             // "transit_2_id",
//             // "transit_3_id",
//             // "transit_4_id"
//           ],
//           as: "SubSchedule",
//           include: [
//             {
//               model: Destination,
//               as: "DestinationFrom",
//               attributes: ["id", "name"],
//             },
//             {
//               model: Destination,
//               as: "DestinationTo",
//               attributes: ["id", "name"],
//             },
//             {
//               model: Transit,
//               as: "TransitFrom",
//               attributes: ["id"],
//               include: {
//                 model: Destination,
//                 as: "Destination",
//                 attributes: ["id", "name"],
//               },
//             },
//             {
//               model: Transit,
//               as: "TransitTo",
//               attributes: ["id"],
//               include: {
//                 model: Destination,
//                 as: "Destination",
//                 attributes: ["id", "name"],
//               },
//             },
//             {
//               model: Transit,
//               as: "Transit1",
//               attributes: ["id"],
//               include: {
//                 model: Destination,
//                 as: "Destination",
//                 attributes: ["id", "name"],
//               },
//             },
//             {
//               model: Transit,
//               as: "Transit2",
//               attributes: ["id"],
//               include: {
//                 model: Destination,
//                 as: "Destination",
//                 attributes: ["id", "name"],
//               },
//             },
//             {
//               model: Transit,
//               as: "Transit3",
//               attributes: ["id"],
//               include: {
//                 model: Destination,
//                 as: "Destination",
//                 attributes: ["id", "name"],
//               },
//             },
//             {
//               model: Transit,
//               as: "Transit4",
//               attributes: ["id"],
//               include: {
//                 model: Destination,
//                 as: "Destination",
//                 attributes: ["id", "name"],
//               },
//             },
//           ],
//         },
//         {
//           model: BookingSeatAvailability,
//           required: false,
//           as: "BookingSeatAvailabilities",
//           include: [
//             {
//               model: Booking,
//               attributes: ["id"],
//               required: false,
//               where: {
//                 payment_status: {
//                   [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
//                 },
//               },
//               include: [
//                 {
//                   model: Passenger,
//                   as: "passengers",
//                   required: false,
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//       order: [["date", "ASC"], ["created_at", "ASC"]],
//     });

//     // Helper function to process seat data
//     const processSeatData = (seatAvailability, isSubschedule = false) => {
//       const seatAvailabilityObj = seatAvailability.get({ plain: true });

//       let totalPassengers = 0;
//       const bookingIds = new Set();

//       if (seatAvailabilityObj.BookingSeatAvailabilities) {
//         seatAvailabilityObj.BookingSeatAvailabilities.forEach((bsa) => {
//           if (bsa.Booking?.passengers?.length > 0) {
//             totalPassengers += bsa.Booking.passengers.length;
//             bookingIds.add(bsa.Booking.id);
//           }
//         });
//       }

//       const correctCapacity = seatAvailabilityObj.boost
//         ? seatAvailabilityObj.Schedule?.Boat?.capacity || 0
//         : seatAvailabilityObj.Schedule?.Boat?.published_capacity || 0;

//       const correctAvailableSeats = correctCapacity - totalPassengers;
//       const miss_seat = correctAvailableSeats - seatAvailabilityObj.available_seats;

//       const route = seatAvailabilityObj.Schedule
//         ? buildRouteFromScheduleFlatten(
//             seatAvailabilityObj.Schedule,
//             isSubschedule ? seatAvailabilityObj.SubSchedule : null
//           )
//         : null;

//       return {
//         ...seatAvailabilityObj,
//         date: seatAvailabilityObj.date instanceof Date
//           ? seatAvailabilityObj.date.toISOString().split('T')[0]
//           : seatAvailabilityObj.date.toString().split('T')[0],
//         boat_id: seatAvailabilityObj.Schedule?.Boat?.id,
//         total_passengers: totalPassengers,
//         total_bookings: bookingIds.size,
//         correct_capacity: correctCapacity,
//         route: route,
//         capacity_match_status:
//           totalPassengers + seatAvailabilityObj.available_seats === correctCapacity
//             ? "MATCH"
//             : "MISMATCH",
//         miss_seats: miss_seat,
//         BookingSeatAvailabilities: undefined,
//       };
//     };

//     // Process schedule seats
//     const processedScheduleSeats = scheduleSeats.map(seat => processSeatData(seat, false));

//     // Process subschedule seats
//     const processedSubscheduleSeats = subscheduleSeats.map(seat => processSeatData(seat, true));

//     // Group subschedule seats by schedule_id and date for nesting
//     const subscheduleByScheduleAndDate = {};
//     processedSubscheduleSeats.forEach(subSeat => {
//       const key = `${subSeat.schedule_id}_${subSeat.date}`;
//       if (!subscheduleByScheduleAndDate[key]) {
//         subscheduleByScheduleAndDate[key] = [];
//       }
//       subscheduleByScheduleAndDate[key].push({
//         id: subSeat.id,
//         subschedule_id: subSeat.subschedule_id,
//         available_seats: subSeat.available_seats,
//         transit_id: subSeat.transit_id,
//         availability: subSeat.availability,
//         boost: subSeat.boost,
//         total_passengers: subSeat.total_passengers,
//         total_bookings: subSeat.total_bookings,
//         correct_capacity: subSeat.correct_capacity,
//         route: subSeat.route,
//         capacity_match_status: subSeat.capacity_match_status,
//         miss_seats: subSeat.miss_seats,
//         SubSchedule: subSeat.SubSchedule,
//         updated_at: subSeat.updated_at,
//         created_at: subSeat.created_at,
//       });
//     });

//     // Merge schedule seats with their subschedule seats
//     const enhancedSeatAvailabilities = processedScheduleSeats.map(scheduleSeat => {
//       const key = `${scheduleSeat.schedule_id}_${scheduleSeat.date}`;
//       const relatedSubscheduleSeats = subscheduleByScheduleAndDate[key] || [];

//       return {
//         ...scheduleSeat,
//         subschedule_seat: relatedSubscheduleSeats,
//       };
//     });

//     // Group seat availabilities by date
//     const seatAvailabilityByDate = {};
//     enhancedSeatAvailabilities.forEach((seat) => {
//       const dateKey = seat.date;

//       if (!seatAvailabilityByDate[dateKey]) {
//         seatAvailabilityByDate[dateKey] = [];
//       }
//       seatAvailabilityByDate[dateKey].push(seat);
//     });

//     // Create ordered calendar data structure
//     const calendarData = currentPageDates.map((dateStr) => {
//       const dateData = seatAvailabilityByDate[dateStr] || [];

//       // Calculate totals including subschedule seats
//       let totalPassengers = 0;
//       let totalBookings = 0;
//       let mismatchCount = 0;
//       let totalSubscheduleSeats = 0;

//       dateData.forEach(seat => {
//         // Count schedule seat
//         totalPassengers += seat.total_passengers;
//         totalBookings += seat.total_bookings;
//         if (seat.capacity_match_status === 'MISMATCH') mismatchCount++;

//         // Count subschedule seats
//         seat.subschedule_seat.forEach(subSeat => {
//           totalPassengers += subSeat.total_passengers;
//           totalBookings += subSeat.total_bookings;
//           if (subSeat.capacity_match_status === 'MISMATCH') mismatchCount++;
//           totalSubscheduleSeats++;
//         });
//       });

//       return {
//         date: dateStr,
//         dayOfWeek: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }),
//         dayOfMonth: new Date(dateStr).getDate(),
//         seatCount: dateData.length,
//         subscheduleSeatsCount: totalSubscheduleSeats,
//         seats: dateData,
//         totalPassengers: totalPassengers,
//         totalBookings: totalBookings,
//         mismatchCount: mismatchCount,
//       };
//     });

//     // Calculate summary statistics
//     let totalScheduleSeats = enhancedSeatAvailabilities.length;
//     let totalSubscheduleSeats = 0;
//     let totalPassengers = 0;
//     let totalBookings = 0;
//     let mismatchedSeats = 0;

//     enhancedSeatAvailabilities.forEach(seat => {
//       // Schedule seat stats
//       totalPassengers += seat.total_passengers;
//       totalBookings += seat.total_bookings;
//       if (seat.capacity_match_status === 'MISMATCH') mismatchedSeats++;

//       // Subschedule seat stats
//       seat.subschedule_seat.forEach(subSeat => {
//         totalSubscheduleSeats++;
//         totalPassengers += subSeat.total_passengers;
//         totalBookings += subSeat.total_bookings;
//         if (subSeat.capacity_match_status === 'MISMATCH') mismatchedSeats++;
//       });
//     });

//     const summary = {
//       dateRange: {
//         start: firstDate,
//         end: lastDate,
//         totalDays: currentPageDates.length,
//       },
//       totals: {
//         totalScheduleSeats: totalScheduleSeats,
//         totalSubscheduleSeats: totalSubscheduleSeats,
//         totalSeats: totalScheduleSeats + totalSubscheduleSeats,
//         totalPassengers: totalPassengers,
//         totalBookings: totalBookings,
//         mismatchedSeats: mismatchedSeats,
//         matchedSeats: (totalScheduleSeats + totalSubscheduleSeats) - mismatchedSeats,
//       },
//       daysWithData: calendarData.filter(day => day.seatCount > 0).length,
//       daysWithoutData: calendarData.filter(day => day.seatCount === 0).length,
//     };

//     return res.status(200).json({
//       success: true,
//       message: `Monthly seat availability fetched for ${year}-${month.toString().padStart(2, '0')} (${firstDate} to ${lastDate}) - Schedule with nested subschedule`,
//       calendar_data: calendarData,
//       seat_availabilities: enhancedSeatAvailabilities,
//       summary: summary,
//       pagination: {
//         total: daysInMonth,
//         page: pageNumber,
//         limit: daysPerPage,
//         totalPages: totalPages,
//         hasNextPage: pageNumber < totalPages,
//         hasPrevPage: pageNumber > 1,
//         dateRange: {
//           start: firstDate,
//           end: lastDate,
//           totalDaysInPage: currentPageDates.length,
//         },
//         monthInfo: {
//           year: yearNum,
//           month: monthNum,
//           totalDaysInMonth: daysInMonth,
//           monthName: new Date(yearNum, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
//         },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching monthly seat availability:", error.message);
//     return res.status(500).json({
//       error: "Internal server error",
//       message: error.message,
//     });
//   }
// };

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
      where: {
        custom_seat: false,
      },
      include: [
        {
          model: Schedule,
          include: [{ model: Boat, as: "Boat" }],
        },
        {
          model: BookingSeatAvailability,
          as: "BookingSeatAvailabilities",
          include: [
            {
              model: Booking,
              where: {
                payment_status: {
                  [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
                },
              },
              include: [
                {
                  model: Passenger,
                  as: "passengers",
                },
              ],
            },
          ],
        },
      ],
    });

    if (!seatAvailability) {
      return res.status(404).json({
        success: false,
        message: "Seat availability not found",
      });
    }

    // Hitung total penumpang
    let totalPassengers = 0;
    seatAvailability.BookingSeatAvailabilities.forEach((bsa) => {
      if (bsa.Booking && bsa.Booking.passengers) {
        totalPassengers += bsa.Booking.passengers.length;
      }
    });

    // Tentukan kapasitas yang benar
    const correctCapacity = seatAvailability.boost
      ? seatAvailability.Schedule.Boat.capacity
      : seatAvailability.Schedule.Boat.published_capacity;

    // Hitung available_seats yang benar
    const correctAvailableSeats = Math.max(
      0,
      correctCapacity - totalPassengers
    );

    // Hitung miss_seat sebelum perbaikan
    const originalMissSeat =
      correctAvailableSeats - seatAvailability.available_seats;

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
      available_seats: correctAvailableSeats,
    });

    return res.status(200).json({
      success: true,
      message: "Seat availability mismatch fixed",
      seatAvailability: updatedSeatAvailability,
      originalMissSeat,
      fixed: true,
    });
  } catch (error) {
    console.error("Error fixing seat mismatch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fix seat mismatch",
      error: error.message,
    });
  }
};

const fixAllSeatMismatches = async () => {
  console.log("🕒 Running Seat Mismatch Fix Job");

  const seatAvailabilities = await SeatAvailability.findAll({
    // exclude the seat avaible where the custom seat is true
    where: {
      custom_seat: false,
    },
    include: [
      {
        model: Schedule,
        include: [{ model: Boat, as: "Boat" }],
      },
      {
        model: BookingSeatAvailability,
        as: "BookingSeatAvailabilities",
        include: [
          {
            model: Booking,
            where: {
              payment_status: {
                [Op.in]: ["paid", "invoiced", "unpaid"],
              },
            },
            include: [
              {
                model: Passenger,
                as: "passengers",
                where: {
                  passenger_type: {
                    [Op.ne]: "infant", // ⛔ exclude infant
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  });

  // buatkan patokan terisi sebuah seat itu berdasarkan passenger.seat_number

  let totalFixed = 0;

  for (const seatAvailability of seatAvailabilities) {
    let totalPassengers = 0;

    seatAvailability.BookingSeatAvailabilities.forEach((bsa) => {
      if (bsa.Booking?.passengers?.length) {
        totalPassengers += bsa.Booking.passengers.length;
      }
    });

    const correctCapacity = seatAvailability.boost
      ? seatAvailability.Schedule.Boat.capacity
      : seatAvailability.Schedule.Boat.published_capacity;

    const correctAvailableSeats = Math.max(
      0,
      correctCapacity - totalPassengers
    );

    if (seatAvailability.available_seats !== correctAvailableSeats) {
      await seatAvailability.update({ available_seats: correctAvailableSeats });
      // console.log(
      //   `✅ Fix Seat ID ${seatAvailability.id} date: ${seatAvailability.date}`
      // );
      totalFixed++;
    }
  }

  console.log(`🎯 Seat mismatch job completed. Total fixed: ${totalFixed}`);
};

const fixAllSeatMismatches2 = async () => {
  console.log("🕒 Running Seat Mismatch Fix Job (uniq seat_number logic)");

  const seatAvailabilities = await SeatAvailability.findAll({
    where: {
      custom_seat: false,
    },
    include: [
      {
        model: Schedule,
        include: [{ model: Boat, as: "Boat" }],
      },
      {
        model: BookingSeatAvailability,
        as: "BookingSeatAvailabilities",
        include: [
          {
            model: Booking,
            where: {
              payment_status: {
                [Op.in]: ["paid", "invoiced", "unpaid"],
              },
            },
            include: [
              {
                model: Passenger,
                as: "passengers",
                where: {
                  passenger_type: {
                    [Op.ne]: "infant", // exclude infant
                  },
                },
                attributes: ["seat_number"],
              },
            ],
          },
        ],
      },
    ],
  });

  let totalFixed = 0;

  for (const sa of seatAvailabilities) {
    const seatSet = new Set();

    sa.BookingSeatAvailabilities.forEach((bsa) => {
      bsa.Booking?.passengers?.forEach((p) => {
        if (p.seat_number) {
          seatSet.add(p.seat_number.trim().toUpperCase());
        }
      });
    });

    const occupiedSeats = seatSet.size;

    const correctCapacity = sa.boost
      ? sa.Schedule.Boat.capacity
      : sa.Schedule.Boat.published_capacity;

    const correctAvailableSeats = Math.max(0, correctCapacity - occupiedSeats);

    if (sa.available_seats !== correctAvailableSeats) {
      await sa.update({ available_seats: correctAvailableSeats });
      // console.log(`✅ Fixed SA ID ${sa.id} (${sa.date})`);
      totalFixed++;
    }
  }

  console.log(`🎯 Seat mismatch job completed. Total fixed: ${totalFixed}`);
};

const fixSeatMismatchBatch2 = async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of seat availability IDs",
    });
  }

  try {
    const results = {
      total: ids.length,
      fixed: 0,
      alreadyCorrect: 0,
      failed: 0,
      details: [],
    };

    for (const id of ids) {
      try {
        const seatAvailability = await SeatAvailability.findByPk(id, {
          include: [
            {
              model: Schedule,
              include: [{ model: Boat, as: "Boat" }],
            },
            {
              model: BookingSeatAvailability,
              as: "BookingSeatAvailabilities",
              include: [
                {
                  model: Booking,
                  where: {
                    payment_status: {
                      [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
                    },
                  },
                  include: [
                    {
                      model: Passenger,
                      as: "passengers",
                      where: {
                        passenger_type: {
                          [Op.ne]: "infant",
                        },
                      },
                      attributes: ["seat_number"],
                    },
                  ],
                },
              ],
            },
          ],
        });

        if (!seatAvailability) {
          results.failed++;
          results.details.push({
            id,
            status: "failed",
            message: "Seat availability not found",
          });
          continue;
        }

        // Hitung berdasarkan seat_number unik
        const seatSet = new Set();

        seatAvailability.BookingSeatAvailabilities.forEach((bsa) => {
          bsa.Booking?.passengers?.forEach((p) => {
            if (p.seat_number) {
              seatSet.add(p.seat_number.trim().toUpperCase());
            }
          });
        });

        const occupiedSeats = seatSet.size;

        const correctCapacity = seatAvailability.boost
          ? seatAvailability.Schedule.Boat.capacity
          : seatAvailability.Schedule.Boat.published_capacity;

        const correctAvailableSeats = Math.max(
          0,
          correctCapacity - occupiedSeats
        );
        const miss_seat =
          correctAvailableSeats - seatAvailability.available_seats;

        if (miss_seat === 0) {
          results.alreadyCorrect++;
          results.details.push({
            id,
            status: "already_correct",
            miss_seat: 0,
          });
          continue;
        }

        await seatAvailability.update({
          available_seats: correctAvailableSeats,
        });

        results.fixed++;
        results.details.push({
          id,
          status: "fixed",
          original_miss_seat: miss_seat,
          new_available_seats: correctAvailableSeats,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          id,
          status: "error",
          message: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Fixed ${results.fixed} seat availabilities, ${results.alreadyCorrect} already correct, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error("❌ Error fixing seat mismatches in batch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fix seat mismatches",
      error: error.message,
    });
  }
};

const fixSeatMismatchBatch = async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of seat availability IDs",
    });
  }

  try {
    // Hasil dari operasi batch
    const results = {
      total: ids.length,
      fixed: 0,
      alreadyCorrect: 0,
      failed: 0,
      details: [],
    };

    // Proses setiap SeatAvailability
    for (const id of ids) {
      try {
        // Temukan SeatAvailability dengan relasi
        const seatAvailability = await SeatAvailability.findByPk(id, {
          where: {
            custom_seat: false,
          },
          include: [
            {
              model: Schedule,
              include: [{ model: Boat, as: "Boat" }],
            },
            {
              model: BookingSeatAvailability,
              as: "BookingSeatAvailabilities",
              include: [
                {
                  model: Booking,
                  where: {
                    payment_status: {
                      [Op.in]: ["paid", "invoiced", "pending", "unpaid"],
                    },
                  },
                  include: [
                    {
                      model: Passenger,
                      as: "passengers",
                      where: {
                        passenger_type: {
                          [Op.ne]: "infant", // ⛔ exclude infant
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });

        if (!seatAvailability) {
          results.failed++;
          results.details.push({
            id,
            status: "failed",
            message: "Seat availability not found",
          });
          continue;
        }

        // Hitung total penumpang
        let totalPassengers = 0;
        seatAvailability.BookingSeatAvailabilities.forEach((bsa) => {
          if (bsa.Booking && bsa.Booking.passengers) {
            totalPassengers += bsa.Booking.passengers.length;
          }
        });

        // Tentukan kapasitas yang benar
        const correctCapacity = seatAvailability.boost
          ? seatAvailability.Schedule.Boat.capacity
          : seatAvailability.Schedule.Boat.published_capacity;

        // Hitung available_seats yang benar
        const correctAvailableSeats = Math.max(
          0,
          correctCapacity - totalPassengers
        );

        // Hitung miss_seat
        const miss_seat =
          correctAvailableSeats - seatAvailability.available_seats;

        // Jika tidak ada ketidakcocokan, tidak perlu update
        if (miss_seat === 0) {
          results.alreadyCorrect++;
          results.details.push({
            id,
            status: "already_correct",
            miss_seat: 0,
          });
          continue;
        }

        // Update available_seats
        await seatAvailability.update({
          available_seats: correctAvailableSeats,
        });

        results.fixed++;
        results.details.push({
          id,
          status: "fixed",
          original_miss_seat: miss_seat,
          new_available_seats: correctAvailableSeats,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          id,
          status: "error",
          message: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Fixed ${results.fixed} seat availabilities, ${results.alreadyCorrect} already correct, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error("Error fixing seat mismatches in batch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fix seat mismatches",
      error: error.message,
    });
  }
};

/**
 * Memperbaiki miss_seat untuk beberapa SeatAvailability secara batch
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */

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
        message: `Seat availability with IDs ${ids.join(", ")} has been deleted`,
      });
    }

    return res.status(400).json({
      error: "Bad request",
      message: "Ids must be an array with at least one element",
    });
  } catch (error) {
    console.log("Error:", error.message);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const transporterTitan = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_TITAN,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER_TITAN,
    pass: process.env.EMAIL_PASS_TITAN,
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  pool: true,
  maxConnections: 3,
});

const sendSeatAvailabilityEmail = async ({ subject, text }) => {
  try {
    await transporterTitan.sendMail({
      from: `"Gili Getaway System" <${process.env.EMAIL_USER_TITAN}>`,
      to: process.env.EMAIL_USER_TITAN, // fallback
      cc: "ooppssainy@gmail.com",
      subject,
      text,
    });
  } catch (emailErr) {
    console.error(
      "❌ Failed to send seat availability email:",
      emailErr.message
    );
  }
};
// BOOST
const handleSeatAvailability = async (req, res) => {
  const { seat_availability_id, schedule_id, date, boost } = req.body;

  try {
    if (seat_availability_id && boost === true) {
      // Scenario 1: Boost existing seat availability to maximum
      console.log("🛠 Scenario 1: Boost existing seat availability to maximum");

      const seatAvailability = await boostSeatAvailability({
        id: seat_availability_id,
        boost,
      });

      await sendSeatAvailabilityEmail({
        subject: `✅ Seat Boosted: ID ${seat_availability_id}`,
        text: `Seat availability with ID ${seat_availability_id}-${schedule_id} on ${date} was successfully boosted to maximum capacity.`,
      });

      return res.status(200).json({
        success: true,
        message: "Seat availability boosted to maximum successfully.",
        seat_availability: seatAvailability,
      });
    }

    if (schedule_id && date) {
      // Scenario 2: Create new seat availability
      console.log("🛠 Scenario 2: Create new seat availability");

      const { mainSeatAvailability, subscheduleSeatAvailabilities } =
        await createSeatAvailabilityMax({ schedule_id, date });

      await sendSeatAvailabilityEmail({
        subject: `✅ New Seat Availability Created`,
        text: `New seat availability created for schedule_id: ${schedule_id} on ${date}.\nMain Seat ID: ${mainSeatAvailability.id}`,
      });

      return res.status(201).json({
        success: true,
        message: "Seat availabilities created successfully.",
        mainSeatAvailability,
        subscheduleSeatAvailabilities,
      });
    }

    return res.status(400).json({
      success: false,
      message:
        "Invalid request: Provide either seat_availability_id with boost=true or schedule_id and date.",
    });
  } catch (error) {
    console.error("❌ Error handling seat availability:", error.message);

    await sendSeatAvailabilityEmail({
      subject: `❌ Error in Seat Availability Handler`,
      text: `An error occurred:\n${error.message}`,
    });

    return res.status(500).json({
      success: false,
      message: "An error occurred while processing seat availability.",
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
          as: "BookingSeatAvailabilities",
          include: [
            {
              model: Booking,
              where: { payment_status: ["paid", "invoiced", "unpaid"] }, // Only include bookings with payment_status 'paid'
            },
          ],
        },
      ],
    });

    if (!seatAvailability) {
      return res.status(404).json({
        status: "fail",
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
          as: "BookingSeatAvailabilities",
          include: [
            {
              model: Booking,
              where: { payment_status: ["paid", "invoiced", "unpaid"] }, // Only include bookings with payment_status 'paid'
            },
          ],
        },
      ],
    });

    // Return only the seat_availability_id of the related records
    const seatAvailabilityIds = relatedSeatAvailabilities.map((sa) => sa.id);

    return res.status(200).json({
      status: "success",
      message: "Related seat availabilities retrieved successfully",
      seatAvailabilityIds, // Return the list of seat_availability_ids
    });
  } catch (error) {
    console.error("Error fetching related seat availabilities:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching seat availabilities",
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
      return res.status(404).json({
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
            attributes: [
              "id",
              "contact_name",
              "contact_phone",
              "contact_passport_id",
              "contact_nationality",
              "contact_email",
              "schedule_id",
              "agent_id",
              "payment_method",
              "gross_total",
              "total_passengers",
              "adult_passengers",
              "child_passengers",
              "infant_passengers",
              "payment_status",
              "booking_source",
              "booking_date",
              "ticket_id",
              "created_at",
              "updated_at",
            ],
            include: {
              model: Passenger,
              as: "passengers",
            },
          },
        });
        return {
          ...seatAvailability.get({ plain: true }),
          available_seats: seatAvailability.available_seats, // Ensure available_seats is included
          bookings: bookings.map((bsa) => ({ id: bsa.Booking.id })),
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

const setAllSeatsAvailabilityById = async (req, res) => {
  const { id, availability } = req.body;

  const desiredAvailability =
    typeof availability === "string"
      ? availability.toLowerCase() === "true"
      : Boolean(availability);

  const t = await sequelize.transaction();
  try {
    // 1) Ambil base row (acuan)
    const baseSA = await SeatAvailability.findByPk(id, { transaction: t });
    if (!baseSA) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: "error", message: `Seat availability not found for ID ${id}.` });
    }

    // 2) Update SEMUA row di schedule_id + date yg sama (base + semua sub)
    const [affectedCount] = await SeatAvailability.update(
      { availability: desiredAvailability },
      {
        where: {
          schedule_id: baseSA.schedule_id,
          date: baseSA.date,
          // tidak pakai filter subschedule_id → semua termasuk base ikut berubah
        },
        transaction: t,
      }
    );

    await t.commit();
    return res.status(200).json({
      status: "success",
      message: `Updated availability for ${affectedCount} row(s) on ${baseSA.date} (schedule ${baseSA.schedule_id}).`,
      data: {
        base_id: baseSA.id,
        schedule_id: baseSA.schedule_id,
        date: baseSA.date,
        set_availability_to: desiredAvailability,
        affected: affectedCount,
      },
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({
      status: "error",
      message: "Failed to update seat availability for the day.",
      error: err.message,
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
    custom_seat,
    date,
  } = req.body;
  console.log("😹request body:", req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const seatAvailability = await SeatAvailability.findByPk(id);

    if (!seatAvailability) {
      return res
        .status(404)
        .json({ error: `Seat availability not found for ID ${id}.` });
    }

    const updatedSeatAvailability = await seatAvailability.update({
      schedule_id,
      available_seats,
      transit_id,
      subschedule_id,
      availability,
      boost,
      custom_seat,
      date,
    });

    return res.status(200).json({
      status: "success",
      message: "Seat availability updated successfully",
      seat_availability: updatedSeatAvailability,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "An error occurred while updating seat availability",
      error: error.message,
    });
  }
};

const getAllSeatAvailabilityScheduleAndSubSchedule = async (req, res) => {
  const { schedule_id } = req.query;

  try {
    let seatAvailabilities;

    if (schedule_id) {
      console.log(
        `Fetching seat availabilities for schedule_id: ${schedule_id}`
      );

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
              { model: Destination, as: "DestinationTo" },
            ],
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
                  { model: Destination, as: "DestinationTo" },
                ],
              },
            ],
          },
        ],
      });
    } else {
      console.log("Fetching all seat availabilities");

      // Fetch all seat availabilities
      seatAvailabilities = await SeatAvailability.findAll({
        include: [
          {
            model: Schedule,
            as: "Schedule",
            include: [
              { model: Boat, as: "Boat" },
              { model: Destination, as: "DestinationFrom" },
              { model: Destination, as: "DestinationTo" },
            ],
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
                  { model: Destination, as: "DestinationTo" },
                ],
              },
            ],
          },
        ],
      });
    }

    if (!seatAvailabilities || seatAvailabilities.length === 0) {
      console.log("No seat availabilities found.");
      return res.status(404).json({
        status: "fail",
        message: "No seat availabilities found.",
      });
    }

    console.log(`Found ${seatAvailabilities.length} seat availabilities`);

    // Format the response using formatScheduleResponse utility
    const responseData = seatAvailabilities.map(formatScheduleResponse);

    console.log("Returning formatted seat availabilities data");

    // Return the response
    return res.status(200).json({
      status: "success",
      message:
        "Seat availabilities with schedules and subschedules retrieved successfully",
      seat_availabilities: responseData,
    });
  } catch (error) {
    console.error("Error retrieving seat availabilities:", error.message);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving seat availabilities",
      error: error.message,
    });
  }
};

const findMissingRelatedBySeatId = async (req, res) => {
  const { seat_availability_id } = req.query;
  console.log(
    `🔍 Finding missing related subschedules for seat_availability_id: ${seat_availability_id}`
  );

  if (!seat_availability_id) {
    return res.status(400).json({
      success: false,
      message: "seat_availability_id is required",
    });
  }

  try {
    const mainSeat = await SeatAvailability.findByPk(seat_availability_id);

    if (!mainSeat) {
      return res.status(404).json({
        success: false,
        message: "SeatAvailability not found",
      });
    }

    const { subschedule_id, schedule_id, date } = mainSeat;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Missing date in seat availability",
      });
    }

    let relatedIds = [];

    // ✅ CASE A: Jika ada subschedule_id → gunakan relasi biasa
    if (subschedule_id) {
      console.log(`🧠 Seat with subschedule_id: ${subschedule_id}`);
      const relations = await SubScheduleRelation.findAll({
        where: { main_subschedule_id: subschedule_id },
        attributes: ["related_subschedule_id"],
      });

      relatedIds = relations.map((r) => r.related_subschedule_id);
    }
    // ✅ CASE B: subschedule_id null → seat utama, pakai semua SubSchedule dari schedule_id
    else {
      console.log(
        `🧠 Seat with NULL subschedule_id. Using schedule_id: ${schedule_id} to infer related subschedules`
      );

      const allSubSchedules = await SubSchedule.findAll({
        where: { schedule_id },
        attributes: ["id"],
      });

      relatedIds = allSubSchedules.map((s) => s.id);

      // ✅ Tambahkan pengecualian: jika tidak ada SubSchedule, langsung return found kosong
      if (relatedIds.length === 0) {
        return res.status(200).json({
          success: true,
          base: {
            seat_availability_id: mainSeat.id,
            schedule_id,
            subschedule_id: null,
            date,
          },
          related_found: [],
          related_missing: [],
          note: "No related subschedules exist under this schedule_id",
        });
      }
    }

    console.log(`📎 Related SubSchedule IDs:`, relatedIds);

    const foundRelations = [];
    const missingRelations = [];

    for (const relatedId of relatedIds) {
      const existing = await SeatAvailability.findOne({
        where: {
          subschedule_id: relatedId,
          date,
        },
      });

      if (existing) {
        console.log(
          `✅ Related ID ${relatedId} FOUND for date ${date}, SeatAvailability ID: ${existing.id}`
        );
        foundRelations.push({
          related_subschedule_id: relatedId,
          seat_availability_id: existing.id,
          date,
        });
      } else {
        console.log(`❌ Related ID ${relatedId} MISSING for date ${date}`);
        missingRelations.push({
          main_seat_availability_id: mainSeat.id,
          date,
          schedule_id: mainSeat.schedule_id,
          related_subschedule_id: relatedId,
        });
      }
    }

    return res.status(200).json({
      success: true,
      base: {
        seat_availability_id: mainSeat.id,
        schedule_id,
        subschedule_id: subschedule_id || null,
        date,
      },
      related_found: foundRelations,
      related_missing: missingRelations,
    });
  } catch (error) {
    console.error("❌ Error in findMissingRelatedBySeatId:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const findDuplicateSeats = async () => {
  const skipConditionsArray = [
    `(b.schedule_id = 61 AND b.subschedule_id IN (118,123))`,
    `(b.schedule_id = 67 AND b.subschedule_id IN (134,135))`,
    `(b.schedule_id = 60 AND b.subschedule_id IN (117,112))`,
    `(b.schedule_id = 64 AND b.subschedule_id IN (129,128))`,
    `(b.schedule_id = 65 AND b.subschedule_id IN (130,131))`,
    `(b.schedule_id = 66 AND b.subschedule_id IN (133,132))`,
    `(b.schedule_id = 62 AND b.subschedule_id IN (125,124))`,
  ];

  const skipConditions = skipConditionsArray.length
    ? `AND NOT (${skipConditionsArray.join(" OR ")})`
    : "";

  const query = `
    SELECT
      sa.id AS seat_availability_id,
      sa.date AS availability_date,
      p.seat_number,
      COUNT(*) AS seat_count,
      GROUP_CONCAT(DISTINCT CONCAT(b.ticket_id, ' (', b.contact_name, ')') ORDER BY b.ticket_id SEPARATOR ', ') AS ticket_details
    FROM Passengers p
    JOIN Bookings b ON b.id = p.booking_id
    JOIN BookingSeatAvailability bsa ON bsa.booking_id = b.id
    JOIN SeatAvailability sa ON sa.id = bsa.seat_availability_id
    WHERE b.payment_status IN ('paid', 'invoiced', 'unpaid')
      AND sa.date >= '2025-07-17'
      AND p.passenger_type != 'infant'
      AND p.seat_number IS NOT NULL
      ${skipConditions}
    GROUP BY sa.id, sa.date, p.seat_number
    HAVING seat_count > 1
    ORDER BY availability_date DESC
  `;

  return sequelize.query(query, { type: QueryTypes.SELECT });
};

const notifyTelegram = async (duplicates) => {
  if (!duplicates.length) {
    await sendTelegramMessage("✅ No duplicated seats found.");
    return;
  }

  let message = `⚠️ <b>DUPLICATED SEATS DETECTED</b> (${duplicates.length} rows)\n\n`;

  message += duplicates
    .slice(0, 50)
    .map(
      (d) =>
        `• <b>SA#${d.seat_availability_id}</b> - ${d.availability_date}, seat <b>${d.seat_number}</b> ×${d.seat_count}\nBookings: ${d.ticket_details}`
    )
    .join("\n\n");

  if (duplicates.length > 50) {
    message += `\n\n…and ${duplicates.length - 50} more rows`;
  }

  await sendTelegramMessage(message);
};;

const notifyTelegramSeatBoosted = async (boostedSeats) => {
  if (!boostedSeats.length) {
    await sendTelegramMessage("✅ No boosted seats found at this time.");
    return;
  }

  let message = `🚀 <b>BOOSTED SEATS ACTIVE</b>\n\nTotal: <b>${boostedSeats.length}</b> entries found\n\n`;

  message += boostedSeats
    .slice(0, 50)
    .map(
      (s) =>
        `• <b>SA#${s.id}</b> - ${s.date} (Schedule: ${s.schedule_id}, SubSchedule: ${s.subschedule_id})`
    )
    .join("\n");

  if (boostedSeats.length > 50) {
    message += `\n\n…and ${boostedSeats.length - 50} more entries`;
  }

  await sendTelegramMessage(message);
};

const getDuplicateSeatReport = async (req, res) => {
  try {
    console.log("🔍 Fetching duplicate seat report...");
    const duplicates = await findDuplicateSeats();

    if (req.query.notify === "telegram") {
      console.log("📡 Notifying Telegram with duplicate seat report...");
      await notifyTelegram(duplicates);
      console.log("✅ Notified Telegram with duplicate seat report");
    }

    res.json({
      success: true,
      total: duplicates.length,
      data: duplicates,
    });
  } catch (err) {
    console.error("❌ Error in getDuplicateSeatReport:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const cronFrequencySeatMatches =
  process.env.CRON_FREQUENCY_SEAT_MISMATCH || "0 */3 * * *"; // Default setiap 3 jam

// Jalankan setiap 3 jam sekali
cron.schedule("0 */3 * * *", async () => {
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
  fixAllSeatMismatches2,
  fixSeatMismatchBatch,
  fixSeatMismatchBatch2,
  fixAllSeatMismatches,
  findDuplicateSeats,
  notifyTelegram,
  getSeatAvailabilityMonthlyView,
  findMissingRelatedBySeatId,
  getDuplicateSeatReport,
    findBoostedSeats,
    notifyTelegramSeatBoosted,
    setAllSeatsAvailabilityById
};
