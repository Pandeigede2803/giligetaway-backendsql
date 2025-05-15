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
const formatScheduleResponse = require("../util/formatScheduleResponse");
const { validationResult } = require("express-validator");

// create new filtered controller to find related seat availability with same schedule_id and booking_date and have Booking.payment_status = 'paid'
const { Op } = require("sequelize"); // Import Sequelize operators
const {
  adjustSeatAvailability,
  boostSeatAvailability,
  createSeatAvailability,
  createSeatAvailabilityMax,
} = require("../util/seatAvailabilityUtils");

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

  // console.log("Query Params:", { year, month, page, limit });

  try {
    // Convert pagination parameters to numbers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // // Ensure month is zero-padded for consistency
    // const formattedMonth = month.padStart(2, "0");
    // // Calculate start and end of the month
    // const startOfMonth = new Date(`${year}-${formattedMonth}-01`);
    // const endOfMonth = new Date(`${year}-${formattedMonth}-01`);
    // endOfMonth.setMonth(endOfMonth.getMonth() + 1); // Move to next month

    let dateCondition = {};

    if (date) {
      const specificDate = new Date(date);
      if (isNaN(specificDate)) {
        return res
          .status(400)
          .json({ error: "Invalid date format. Use YYYY-MM-DD." });
      }
      dateCondition = { date: specificDate };
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
    } else {
      return res
        .status(400)
        .json({ error: "Provide either date or (year and month)." });
    }
    console.log("Date Condition:", dateCondition);


    // First, get total count for pagination info (this query is lightweight)
    const totalCount = await SeatAvailability.count({
      where: dateCondition,

    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limitNumber);

    // Gunakan Sequelize untuk melakukan query dengan include, pagination, dan atribut virtual
    const seatAvailabilities = await SeatAvailability.findAll({
      where: {
        date: {
          where: dateCondition,
        },
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
          attributes: ["id"],
          include: [
            {
              model: Boat,
              as: "Boat",
              required: true,
              attributes: ["id", "capacity", "published_capacity"],
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
      order: [["created_at", "DESC"]],
      limit: limitNumber,
      offset: offset,
    });

    // Transformasi hasil untuk menambahkan informasi yang dibutuhkan
    const enhancedSeatAvailabilities = seatAvailabilities.map(
      (seatAvailability) => {
        // Konversi ke plain object untuk manipulasi lebih mudah
        const seatAvailabilityObj = seatAvailability.get({ plain: true });

        // Hitung total penumpang
        let totalPassengers = 0;
        const bookingIds = new Set();

        if (seatAvailabilityObj.BookingSeatAvailabilities) {
          seatAvailabilityObj.BookingSeatAvailabilities.forEach((bsa) => {
            if (bsa.Booking && bsa.Booking.passengers) {
              totalPassengers += bsa.Booking.passengers.length;
              bookingIds.add(bsa.Booking.id);
            }
          });
        }

        // Total kursi yang terisi ditambah kursi yang tersedia harus sama dengan kapasitas maksimum
        const totalAllocatedSeats =
          totalPassengers + seatAvailabilityObj.available_seats;
        const correctCapacity = seatAvailabilityObj.boost
          ? seatAvailabilityObj.Schedule?.Boat?.capacity || 0
          : seatAvailabilityObj.Schedule?.Boat?.published_capacity || 0;

        // Hitung miss_seat (nilai +/- ketidakcocokan)
        // Hitung available_seats yang benar (correct capacity - total passengers)
        const correctAvailableSeats = correctCapacity - totalPassengers;

        // Hitung miss_seat (selisih antara available_seats yang benar dengan yang saat ini)
        const miss_seat =
          correctAvailableSeats - seatAvailabilityObj.available_seats;

        // Tambahkan field-field baru
        return {
          ...seatAvailabilityObj,
          boat_id: seatAvailabilityObj.Schedule?.Boat?.id,
          total_passengers: totalPassengers,
          total_bookings: bookingIds.size,
          correct_capacity: correctCapacity,
          capacity_match_status:
            totalAllocatedSeats === correctCapacity ? "MATCH" : "MISMATCH",
          miss_seats: miss_seat,
          // Hapus data nested yang tidak perlu (opsional, untuk mengurangi ukuran response)
          BookingSeatAvailabilities: undefined,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: "Seat availability fetched by month and year",
      seat_availabilities: enhancedSeatAvailabilities,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching seat availability:", error.message);
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
const handleSeatAvailability = async (req, res) => {
  const { seat_availability_id, schedule_id, date, boost } = req.body;

  try {
    if (seat_availability_id && boost === true) {
      // Scenario 1: Boost existing seat availability to the maximum capacity
      console.log("🛠 Scenario 1: Boost existing seat availability to maximum");
      const seatAvailability = await boostSeatAvailability({
        id: seat_availability_id,
        boost,
      });
      return res.status(200).json({
        success: true,
        message: "Seat availability boosted to maximum successfully.",
        seat_availability: seatAvailability,
      });
    } else if (schedule_id && date) {
      // Scenario 2: Create new seat availability
      console.log("🛠 Scenario 2: Create new seat availability");
      const { mainSeatAvailability, subscheduleSeatAvailabilities } =
        await createSeatAvailabilityMax({
          schedule_id,
          date,
        });
      return res.status(201).json({
        success: true,
        message: "Seat availabilities created successfully.",
        mainSeatAvailability,
        subscheduleSeatAvailabilities,
      });
    }

    // Invalid request
    return res.status(400).json({
      success: false,
      message:
        "Invalid request: Provide either seat_availability_id with boost=true or schedule_id and date.",
    });
  } catch (error) {
    console.error("Error handling seat availability:", error.message);
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

const updateSeatAvailability = async (req, res) => {
  const { id } = req.params;
  const {
    schedule_id,
    available_seats,
    transit_id,
    subschedule_id,
    availability,
    boost,
    date,
  } = req.body;

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
  fixSeatMismatchBatch,
};
