// controllers/scheduleController.js
const {
  Schedule,
  SubSchedule,
  User,
  Boat,
  Transit,
  SeatAvailability,
  Destination,
  sequelize,
} = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { Op } = require("sequelize");
const buildSearchConditions = require("../util/buildSearchCondition");
const {
  formatSchedules,
  formatSubSchedules,
} = require("../util/formatSchedules"); // Import utils
const { getDay } = require("date-fns"); // Correctly importing getDay

const createSeatAvailability = async (schedule, subschedule, date) => {
  try {
    // Determine the boat capacity based on schedule or subschedule
    const boatCapacity = schedule
      ? schedule.Boat.capacity
      : subschedule.Schedule.Boat.capacity;

    // Create the seat availability record
    const newSeatAvailability = await SeatAvailability.create({
      schedule_id: schedule ? schedule.id : subschedule.Schedule.id, // Use schedule_id for both Schedule and SubSchedule
      subschedule_id: subschedule ? subschedule.id : null, // Only pass subschedule_id if it’s a SubSchedule
      available_seats: boatCapacity, // Defaulting to boat capacity
      availability: true, // Setting availability to true
      date: date, // Setting the selected date
    });

    return newSeatAvailability;
  } catch (error) {
    console.error(
      `Creating seat availability for schedule_id: ${
        schedule ? schedule.id : subschedule ? subschedule.Schedule.id : "null"
      }, subschedule_id: ${
        subschedule ? subschedule.id : "null"
      }, date: ${date}, with available seats: ${boatCapacity}`
    );
    throw new Error("Failed to create seat availability");
  }
};

const searchSchedulesAndSubSchedules = async (req, res) => {
  const { from, to, date, passengers_total } = req.query;

  try {
    const selectedDate = new Date(date);
    const selectedDayOfWeek = getDay(selectedDate);

    const schedules = await Schedule.findAll({
      where: {
        destination_from_id: from,
        destination_to_id: to,
        availability: true,
        validity_start: { [Op.lte]: selectedDate },
        validity_end: { [Op.gte]: selectedDate },
        [Op.and]: sequelize.literal(
          `(Schedule.days_of_week & ${1 << selectedDayOfWeek}) != 0`
        ),
      },
      include: [
        {
          model: Destination,
          as: "FromDestination",
          attributes: ["id", "name"],
        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["id", "name"],
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "capacity","boat_name"],
        },
        {
          model: Transit,
          attributes: [
            "id",
            "destination_id",
            "departure_time",
            "arrival_time",
            "journey_time",
          ],
          include: [
            {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      attributes: [
        "id",
        "route_image",
        "low_season_price",
        "high_season_price",
        "peak_season_price",
        "departure_time",
        "check_in_time",
        "arrival_time",
        "journey_time",
      ],
    });


       // Fetch SubSchedules
       const subSchedules = await SubSchedule.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { destination_from_schedule_id: from },
                { "$TransitFrom.destination_id$": from },
              ],
            },
            {
              [Op.or]: [
                { destination_to_schedule_id: to },
                { "$TransitTo.destination_id$": to },
              ],
            },
            {
              validity_start: { [Op.lte]: selectedDate },
              validity_end: { [Op.gte]: selectedDate },
              [Op.and]: sequelize.literal(
                `(SubSchedule.days_of_week & ${1 << selectedDayOfWeek}) != 0`
              ),
            },
          ],
          availability: true,
        },
        include: [
          {
            model: Destination,
            as: "DestinationFrom",
            attributes: ["id", "name"],
          },
          {
            model: Destination,
            as: "DestinationTo",
            attributes: ["id", "name"],
          },
          {
            model: Transit,
            as: "TransitFrom",
            attributes: [
              "id",
              "destination_id",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          },
          {
            model: Transit,
            as: "TransitTo",
            attributes: [
              "id",
              "destination_id",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
  
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          },
          // Add transit_1, transit_2, transit_3, transit_4 associations
          {
            model: Transit,
            as: "Transit1",
            attributes: [
              "id",
              "destination_id",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          },
          {
            model: Transit,
            as: "Transit2",
            attributes: [
              "id",
              "destination_id",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          },
          {
            model: Transit,
            as: "Transit3",
            attributes: [
              "id",
              "destination_id",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          },
          {
            model: Transit,
            as: "Transit4",
            attributes: [
              "id",
              "destination_id",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
            include: {
              model: Destination,
              as: "Destination",
              attributes: ["id", "name"],
            },
          },
          {
            model: Schedule,
            as: "Schedule",
            attributes: ["id", "departure_time",
              "check_in_time",
              "arrival_time",
              "journey_time",],
            include: [
              {
                model: Boat,
                as: "Boat",
                attributes: ["id", "capacity"],
              },
            ],
          },
        ],
     
      });
  


    // Check Seat Availability for Schedules
    for (const schedule of schedules) {
      let seatAvailability = await SeatAvailability.findOne({
        where: {
          schedule_id: schedule.id,
          date: selectedDate,
          availability: true,
          available_seats: { [Op.gte]: passengers_total },
        },
      });

      // Create SeatAvailability if not found
      if (!seatAvailability) {
        seatAvailability = await createSeatAvailability(
          schedule,
          null,
          selectedDate
        );
      }

      schedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: seatAvailability.available_seats,
        date: selectedDate,
      };

      // Debugging log for schedules
      console.log(
        `Schedule ID: ${schedule.id}, Seat Availability:`,
        schedule.dataValues.seatAvailability
      );
    }

    // Check Seat Availability for SubSchedules
    for (const subSchedule of subSchedules) {
      let seatAvailability = await SeatAvailability.findOne({
        where: {
          subschedule_id: subSchedule.id,
          date: selectedDate,
          availability: true,
          available_seats: { [Op.gte]: passengers_total },
        },
      });

      // Create SeatAvailability if not found
      if (!seatAvailability) {
        seatAvailability = await createSeatAvailability(
          null,
          subSchedule,
          selectedDate
        );
      }

      // Attach seatAvailability to subSchedule dataValues
      subSchedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: seatAvailability.available_seats,
        date: selectedDate,
      };

      // Debugging log for subschedules
      console.log(
        `SubSchedule ID: ${subSchedule.id}, Seat Availability:`,
        subSchedule.dataValues.seatAvailability
      );
    }

    // Step 6: Return the combined results with SeatAvailability details
    res.status(200).json({
      status: "success",
      data: {
        schedules: formatSchedules(schedules,selectedDate),
        subSchedules: formatSubSchedules(subSchedules,selectedDate),
      },
    });
  } catch (error) {
    console.error("Error searching schedules and subschedules:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
// Helper function to get bitmask for the day of the week
const getDayOfWeekMask = (date) => {
  const dayOfWeek = date.getDay();
  return 2 ** dayOfWeek; // Sun = 1, Mon = 2, ..., Sat = 64
};

// Create a new schedule with transits
const createScheduleWithTransit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      boat_id,
      destination_from_id,
      destination_to_id,
      user_id,
      validity_start,
      validity_end,
      check_in_time,
      low_season_price,
      high_season_price,
      peak_season_price,
      return_low_season_price,
      return_high_season_price,
      return_peak_season_price,
      arrival_time,
      journey_time,
      transits,
      schedule_type,
      departure_time, // Include the departure_time field
      days_of_week,
      trip_type,
    } = req.body;

    console.log("Received schedule data:", req.body);

    // Call the upload middleware to handle image upload
    await uploadImageToImageKit(req, res, async () => {
      if (!req.file.url) {
        throw new Error("Image file is required");
      }

      // Create the schedule
      const schedule = await Schedule.create(
        {
          boat_id,
          destination_from_id,
          destination_to_id,
          user_id,
          validity_start,
          validity_end,
          check_in_time,
          low_season_price,
          high_season_price,
          peak_season_price,
          return_low_season_price,
          return_high_season_price,
          return_peak_season_price,
          arrival_time,
          journey_time,
          days_of_week,
          schedule_type,
          trip_type,
          departure_time, // Include the departure_time field
          route_image: req.file.url, // Use ImageKit URL for route_image
        },
        { transaction: t }
      );

      console.log("Created schedule:", schedule);

      // Create the transits
      const createdTransits = [];
      if (transits && transits.length > 0) {
        for (const transit of transits) {
          const {
            destination_id,
            check_in_time,
            departure_time,
            arrival_time,
            journey_time,
          } = transit;

          console.log("Processing transit:", transit);

          // Validate destination_id
          const destination = await Destination.findByPk(destination_id, {
            transaction: t,
          });
          if (!destination) {
            throw new Error(`Destination ID ${destination_id} not found.`);
          }

          const createdTransit = await Transit.create(
            {
              schedule_id: schedule.id,
              destination_id,
              check_in_time,
              departure_time,
              arrival_time,
              journey_time,
            },
            { transaction: t }
          );

          console.log("Created transit:", createdTransit);

          // Include destination details
          const transitWithDestination = await Transit.findByPk(
            createdTransit.id,
            {
              include: {
                model: Destination,
                as: "Destination",
              },
              transaction: t,
            }
          );

          console.log(
            "Transit with destination details:",
            transitWithDestination
          );

          createdTransits.push(transitWithDestination);
        }
      }

      await t.commit();
      res.status(201).json({
        schedule,
        transits: createdTransits,
      });
    });
  } catch (error) {
    await t.rollback();
    console.error("Error creating schedule with transits:", error);
    res.status(400).json({ error: error.message });
  }
};

//wihtout transit
const createSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.create(req.body);
    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// Get all schedules (existing function)
const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.findAll({
      attributes: ["id", "validity_start", "validity_end"], // Select specific fields from the Schedule
      include: [
        {
          model: Destination,
          as: "FromDestination", // Ensure this alias matches your model associations
          attributes: ["id", "name"], // Select specific fields from the Destination
        },
        {
          model: Destination,
          as: "ToDestination", // Ensure this alias matches your model associations
          attributes: ["id", "name"], // Select specific fields from the Destination
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "boat_name", "capacity", "boat_image"],
        },
      ],
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all schedules with destination and transit details
const getAllSchedulesWithDetails = async (req, res) => {
  try {
    const schedules = await Schedule.findAll({
      include: [
        {
          model: Destination,
          as: "FromDestination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Transit,
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
          },
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "boat_name", "capacity", "boat_image"],
        },
        // {
        //     model: User,
        //     attributes: ['id', 'name', 'email']
        // }
      ],
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller: getSchedulesByMultipleParams
 * Description: This controller fetches schedules and subschedules based on multiple parameters from the request query.
 *              It searches for schedules based on departure and destination locations, availability status, number of passengers, and a specific date.
 *              The results are then formatted to separate schedules based on their availability.
 *
 * Query Parameters:
 * - search_date (string): The date for which the schedules should be searched. It will be parsed into a JavaScript Date object.
 * - from (string): Name of the departure location. The system will fetch its corresponding destination ID from the `Destination` model.
 * - to (string): Name of the destination location. The system will fetch its corresponding destination ID from the `Destination` model.
 * - availability (string): Indicates whether only available schedules should be fetched. The value is parsed to a boolean.
 * - passengers_total (string|number): The total number of passengers. It filters schedules that have at least this many available seats.
 *
 * Workflow:
 * 1. Parse the query parameters and check availability status.
 * 2. Fetch destination IDs for 'from' and 'to' destinations based on their names.
 * 3. Build search conditions (`whereCondition` for schedules and `subWhereCondition` for subschedules).
 * 4. Fetch the main schedules and subschedules that meet the search conditions.
 * 5. Format the fetched data to make it suitable for the response. This includes separating schedules based on seat availability.
 * 6. Filter out schedules where availability is explicitly marked as false.
 * 7. Combine the available schedules and subschedules.
 * 8. Send the response based on the availability of schedules, or return appropriate error messages if no schedules or seats are available.
 *
 * Response:
 * - Success:
 *    - `availableSchedules`: List of available schedules and subschedules that meet the criteria.
 *    - `noSeatAvailabilitySchedules`: List of schedules with no seat availability information created.
 * - Full:
 *    - Returns a message indicating that all schedules for the selected date are full.
 * - No Schedules Found:
 *    - Returns an empty array if no schedules were found.
 *
 * Errors:
 * - Returns a 400 error if there's an issue fetching the schedules.
 *
 * Models:
 * - Schedule: Main schedule data.
 * - Destination: Departure and destination locations.
 * - Transit: Transit details, including intermediate destinations.
 * - SubSchedule: Schedule data for sub-routes.
 * - SeatAvailability: Availability information for seats, used to check if there are enough available seats.
 *
 * Example usage:
 * GET /schedules?search_date=2023-09-11&from=CityA&to=CityB&availability=true&passengers_total=4
 *
 * Notes:
 * - The function uses Sequelize's `findAll` to fetch records and Op operators for date and comparison-based conditions.
 */

const getSchedulesByMultipleParams = async (req, res) => {
  const { search_date, from, to, availability, passengers_total } = req.query;

  try {
    const { whereCondition, subWhereCondition } = buildSearchConditions(
      search_date,
      from,
      to,
      availability
    );

    const schedules = await Schedule.findAll({
      where: whereCondition,
      include: [
        {
          model: Destination,
          as: "FromDestination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Transit,
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
          },
        },
      ],
    });

    const subSchedules = await SubSchedule.findAll({
      where: subWhereCondition,
      include: [
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
          required: false,
          where: {
            date: new Date(search_date),
            available_seats: {
              [Op.gte]: passengers_total ? parseInt(passengers_total) : 0,
            },
          },
        },
      ],
    });

    // Format schedules
    const formattedSchedules = formatSchedules(schedules);

    // Format subSchedules with detailed SeatAvailability information
    const formattedSubSchedules = subSchedules.map((subSchedule) => {
      const seatAvailabilities = subSchedule.SeatAvailabilities;

      // Check if SeatAvailabilities exist and create relevant message
      const seatAvailabilityInfo =
        seatAvailabilities.length > 0
          ? seatAvailabilities
          : "Seat availability not created"; // Provide message if not available

      return {
        ...subSchedule.get({ plain: true }),
        type: "SubSchedule",
        SeatAvailabilities: seatAvailabilityInfo,
        availability_status:
          seatAvailabilities.length > 0
            ? seatAvailabilities[0].available_seats > 0
              ? "Available"
              : "Full"
            : "No seat information", // Additional seat availability status
      };
    });

    // Separate schedules by availability
    const availableSchedules = [];
    const fullSchedules = [];
    const noSeatAvailabilitySchedules = [];

    formattedSubSchedules.forEach((subSchedule) => {
      const seatAvailabilities = subSchedule.SeatAvailabilities;

      if (seatAvailabilities === "Seat availability not created") {
        noSeatAvailabilitySchedules.push(subSchedule);
      } else if (seatAvailabilities.length > 0) {
        const seatAvailability = seatAvailabilities[0];
        if (seatAvailability.available_seats === 0) {
          fullSchedules.push(subSchedule);
        } else {
          availableSchedules.push(subSchedule);
        }
      }
    });

    // Combine schedules with available subSchedules
    const combinedAvailableResults = [
      ...formattedSchedules.filter(
        (schedule) => schedule.availability !== false
      ),
      ...availableSchedules,
    ];

    // Determine response status
    let responseStatus = "success";
    let responseData = {
      availableSchedules: combinedAvailableResults,
      noSeatAvailabilitySchedules,
    };

    if (fullSchedules.length > 0 && combinedAvailableResults.length === 0) {
      responseStatus = "full";
      responseData = "The schedule for the selected date is full";
    } else if (
      combinedAvailableResults.length === 0 &&
      noSeatAvailabilitySchedules.length === 0
    ) {
      responseStatus = "no schedules found";
      responseData = [];
    }

    // Send the response
    res.status(200).json({
      status: responseStatus,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching schedules and subschedules:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

const getSchedulesWithTransits = async (req, res) => {
  try {
    const schedules = await Schedule.findAll({
      attributes: ["id", "validity_start", "validity_end"], // Select specific fields from the Schedule
      include: [
        {
          model: Destination,
          as: "FromDestination", // Ensure this alias matches your model associations
          attributes: ["id", "name"], // Select specific fields from the Destination
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "boat_name", "capacity", "boat_image"],
        },
        {
          model: Destination,
          as: "ToDestination", // Ensure this alias matches your model associations
          attributes: ["id", "name"], // Select specific fields from the Destination
        },
        {
          model: Transit,
          required: true, // This ensures only schedules with transits are included
          attributes: ["id"], // You can include more attributes from Transit if needed
        },
      ],
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get schedule by ID (existing function)
const getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id, {
      include: [
        {
          model: Destination,
          as: "DestinationFrom", // Pastikan alias ini sesuai dengan asosiasi model Anda
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Destination,
          as: "DestinationTo", // Pastikan alias ini sesuai dengan asosiasi model Anda
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "boat_name", "capacity", "boat_image"],
        },
        {
          model: Transit,
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
          },
        },

        {
          model: SubSchedule,
          as: "SubSchedules",
          include: [
            {
              model: Transit,
              as: "TransitFrom",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["id", "name"],
              },
            },
            {
              model: Transit,
              as: "TransitTo",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["id", "name"],
              },
            },
            {
              model: Transit,
              as: "Transit1",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["id", "name"],
              },
            },
            {
              model: Transit,
              as: "Transit2",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["id", "name"],
              },
            },
            {
              model: Transit,
              as: "Transit3",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["id", "name"],
              },
            },
            {
              model: Transit,
              as: "Transit4",
              attributes: ["id"],
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["id", "name"],
              },
            },
          ],
        },
      ],
    });

    if (schedule) {
      res.status(200).json(schedule);
    } else {
      res.status(404).json({ error: "Schedule not found" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get schedule by ID + Seat
const getScheduleByIdSeat = async (req, res) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id, {
      include: [
        {
          model: Destination,
          as: "DestinationFrom", // Pastikan alias ini sesuai dengan asosiasi model Anda
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Destination,
          as: "DestinationTo", // Pastikan alias ini sesuai dengan asosiasi model Anda
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "boat_name", "capacity", "boat_image"],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
        },
      ],
    });

    if (schedule) {
      res.status(200).json(schedule);
    } else {
      res.status(404).json({ error: "Schedule not found" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get schedules by destination
const getSchedulesByDestination = async (req, res) => {
  try {
    const { destinationId } = req.params;
    const schedules = await Schedule.findAll({
      where: {
        [Op.or]: [
          { destination_from_id: destinationId },
          { destination_to_id: destinationId },
        ],
      },
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get schedules by validity period
const getSchedulesByValidity = async (req, res) => {
  try {
    const { validity } = req.params;
    const schedules = await Schedule.findAll({
      where: {
        validity_period: validity,
      },
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get schedules by boat ID
const getSchedulesByBoat = async (req, res) => {
  try {
    const { boatId } = req.params;
    const schedules = await Schedule.findAll({
      where: {
        boat_id: boatId,
      },
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get schedules by user ID
const getSchedulesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const schedules = await Schedule.findAll({
      where: {
        user_id: userId,
      },
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//update schedule tanpa transit
// Update schedule tanpa transit dengan middleware upload image
const updateSchedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const scheduleId = req.params.id;
    const scheduleData = req.body;

    console.log("DATA BODY YNG DITERMIMA`:", scheduleData);

    const schedule = await Schedule.findByPk(scheduleId, {
      transaction: t,
    });

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Jika ada file, panggil middleware uploadImageToImageKit
    if (req.file) {
      await uploadImageToImageKit(req, res, async () => {
        if (req.file && req.file.url) {
          scheduleData.route_image = req.file.url;
        }
        // Update schedule
        await schedule.update(scheduleData, { transaction: t });
        console.log("Schedule updated with image:", schedule);

        await t.commit();
        console.log("Transaction committed.");
        res.status(200).json(schedule);
      });
    } else {
      // Update schedule tanpa file
      await schedule.update(scheduleData, { transaction: t });
      console.log("Schedule updated without image:", schedule);

      await t.commit();
      console.log("Transaction committed.");
      res.status(200).json(schedule);
    }
  } catch (error) {
    await t.rollback();
    console.error("Error updating schedule:", error);
    res.status(400).json({ error: error.message });
  }
};

// Delete schedule (existing function)
const deleteSchedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log(`Attempting to delete schedule with ID: ${req.params.id}`);

    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) {
      console.log(`Schedule with ID ${req.params.id} not found`);
      return res.status(404).json({ error: "Schedule not found" });
    }

    console.log(
      `Found schedule with ID: ${req.params.id}. Proceeding to delete related transits.`
    );

    // Delete all related transits
    await Transit.destroy({
      where: { schedule_id: schedule.id },
      transaction: t,
    });

    console.log(
      `Deleted transits related to schedule with ID: ${req.params.id}. Proceeding to delete the schedule.`
    );

    // Delete the schedule
    await schedule.destroy({ transaction: t });

    await t.commit();
    console.log(
      `Successfully deleted schedule with ID: ${req.params.id} and related transits.`
    );
    return res.status(200).json({
      message: `Successfully deleted schedule with ID: ${req.params.id} and all related transits.`,
    });
  } catch (error) {
    await t.rollback();
    console.error(
      `Error deleting schedule with ID: ${req.params.id} and related transits:`,
      error
    );
    return res.status(400).json({ error: error.message });
  }
};
const getScheduleSubscheduleByIdSeat = async (req, res) => {
  try {
    console.log(`Fetching schedule with ID: ${req.params.id}`);

    const schedule = await Schedule.findByPk(req.params.id, {
      attributes: [
        "id",
        "availability",
        "validity_start",
        "validity_end",
        "boat_id",
        "check_in_time",
        "arrival_time",
        "journey_time",
        "departure_time",
      ],
      include: [
        {
          model: Destination,
          as: "DestinationFrom",
          attributes: [
            "id",
            "name",
            // "port_map_url", "image_url"
          ],
        },
        {
          model: Destination,
          as: "DestinationTo",
          attributes: [
            "id",
            "name",
            //  "port_map_url", "image_url"
          ],
        },
        {
          model: Transit,
          include: {
            model: Destination,
            as: "Destination",
            attributes: [
              "id",
              "name",
              // "port_map_url", "image_url"
            ],
          },
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "boat_name", "capacity", "boat_image"],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
          attributes: [
            "id",
            "schedule_id",
            "date",
            "available_seats",
            "availability",
          ],
        },
        {
          model: SubSchedule,
          as: "SubSchedules",
          attributes: [
            "id",
            "schedule_id",
            "destination_from_schedule_id",
            "destination_to_schedule_id",
          ],
          include: [
            {
              model: Schedule,
              as: "Schedule",
              attributes: [
                "id",
                "validity_start",
                "validity_end",
                "boat_id",
                "check_in_time",
                "arrival_time",
                "journey_time",
                "departure_time",
              ],
              include: [
                {
                  model: Destination,
                  as: "DestinationFrom",
                  attributes: ["id", "name", "port_map_url", "image_url"],
                },
                {
                  model: Destination,
                  as: "DestinationTo",
                  attributes: ["id", "name", "port_map_url", "image_url"],
                },
                {
                  model: Boat,
                  as: "Boat",
                  attributes: ["id", "boat_name", "capacity", "boat_image"],
                },
              ],
            },
            {
              model: Destination,
              as: "DestinationFrom",
              attributes: ["id", "name", "port_map_url", "image_url"],
            },
            {
              model: Destination,
              as: "DestinationTo",
              attributes: ["id", "name", "port_map_url", "image_url"],
            },
            {
              model: Transit,
              as: "TransitFrom",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: Transit,
              as: "TransitTo",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: Transit,
              as: "Transit1",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: Transit,
              as: "Transit2",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: Transit,
              as: "Transit3",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },
            {
              model: Transit,
              as: "Transit4",
              include: [
                {
                  model: Destination,
                  as: "Destination",
                  attributes: ["id", "name"],
                },
              ],
            },

            {
              model: SeatAvailability,
              as: "SeatAvailabilities",
              attributes: [
                "id",
                "subschedule_id",
                "date",
                "available_seats",
                "availability",
              ],
            },
          ],
        },
      ],
    });

    if (schedule) {
      console.log("Schedule found:");
      console.log(JSON.stringify(schedule, null, 2));

      if (schedule.SubSchedules && schedule.SubSchedules.length > 0) {
        console.log("SubSchedules found:");
        schedule.SubSchedules.forEach((subSchedule, index) => {
          console.log(`SubSchedule ${index + 1}:`);
          console.log(JSON.stringify(subSchedule, null, 2));
        });
      } else {
        console.log("No SubSchedules found for this schedule.");
      }

      res.status(200).json(schedule);
    } else {
      console.log("Schedule not found.");
      res.status(404).json({ error: "Schedule not found" });
    }
  } catch (error) {
    console.error("Error fetching schedule and subschedules:", error.message);
    res.status(400).json({ error: error.message });
  }
};

// Upload schedules (existing function)
const uploadSchedules = async (req, res) => {
  const schedules = [];
  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csvParser())
    .on("data", async (row) => {
      try {
        const {
          boat_id,
          destination_from_id,
          destination_to_id,
          user_id,
          validity_period,
          check_in_time,
          low_season_price,
          high_season_price,
          peak_season_price,
          return_low_season_price,
          return_high_season_price,
          return_peak_season_price,
          arrival_time,
          journey_time,
          route_image,
          available_seats,
        } = row;

        // Validate IDs
        const user = await User.findByPk(user_id);
        const boat = await Boat.findByPk(boat_id);
        const destinationFrom = await Destination.findByPk(destination_from_id);
        const destinationTo = await Destination.findByPk(destination_to_id);

        if (!user || !boat || !destinationFrom || !destinationTo) {
          throw new Error("Invalid ID(s) provided.");
        }

        schedules.push({
          boat_id,
          destination_from_id,
          destination_to_id,
          user_id,
          validity_period,
          check_in_time,
          low_season_price,
          high_season_price,
          peak_season_price,
          return_low_season_price,
          return_high_season_price,
          return_peak_season_price,
          arrival_time,
          journey_time,
          route_image,
          available_seats,
        });
      } catch (error) {
        console.log("Error processing row:", error.message);
      }
    })
    .on("end", async () => {
      try {
        await Schedule.bulkCreate(schedules);
        res
          .status(201)
          .json({ message: "Schedules uploaded successfully", schedules });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    })
    .on("error", (error) => {
      console.log("Error reading CSV:", error.message);
      res.status(500).json({ error: error.message });
    });
};

module.exports = {
  getScheduleByIdSeat,
  createSchedule,
  getAllSchedulesWithDetails,
  getSchedules,
  getScheduleById,
  getSchedulesByDestination,
  getSchedulesByValidity,
  getScheduleSubscheduleByIdSeat,
  getSchedulesByBoat,
  getSchedulesByUser,
  updateSchedule,
  deleteSchedule,
  uploadSchedules,
  createScheduleWithTransit,
  getSchedulesByMultipleParams,
  getSchedulesWithTransits,
  searchSchedulesAndSubSchedules,
};

// Get schedules by multiple parametersconst { Op } = require('sequelize'); // Pastikan Anda mengimpor Op dari sequelize

//SEARCH BY MULTIPLE PARAMS WITH DESTINATION ID

// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     // Build the dynamic where condition
//     const whereCondition = {};

//     if (search_date) {
//         console.log('search_date:', search_date);
//         whereCondition.validity_start = {
//             [Op.lte]: new Date(search_date) // Pastikan format tanggal benar
//         };
//         whereCondition.validity_end = {
//             [Op.gte]: new Date(search_date) // Pastikan format tanggal benar
//         };
//     }

//     if (from) {
//         console.log('from:', from);
//         whereCondition.destination_from_id = parseInt(from); // Pastikan ini adalah integer
//     }

//     if (to) {
//         console.log('to:', to);
//         whereCondition.destination_to_id = parseInt(to); // Pastikan ini adalah integer
//     }

//     if (availability !== undefined) {
//         console.log('availability:', availability);
//         whereCondition.availability = availabilityBool;
//     }

//     // Log the whereCondition to debug
//     console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));

//     try {
//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 },
//                 {
//                     model: SubSchedule,
//                     as: 'SubSchedules',
//                     required: false, // Make SubSchedule optional
//                     where: {
//                         [Op.or]: [
//                             { availability: availabilityBool },
//                             { availability: { [Op.is]: null } }
//                         ]
//                     }
//                 },
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false, // Make SeatAvailability optional
//                     where: {
//                         date: new Date(search_date), // Filter berdasarkan search_date
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0 // Filter berdasarkan passengers_total
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));

//         const response = schedules.map(schedule => {
//             const seatAvailability = schedule.SeatAvailabilities.length > 0 ? schedule.SeatAvailabilities : null;
//             console.log('schedule:', JSON.stringify(schedule, null, 2));
//             return {
//                 ...schedule.get({ plain: true }),
//                 SeatAvailabilities: seatAvailability || 'Seat availability not available or not created for the given date'
//             };
//         });

//         const responseStatus = response.length > 0 ? 'success' : 'no schedules found';

//         console.log('response:', JSON.stringify(response, null, 2));

//         res.status(200).json({
//             status: responseStatus,
//             data: response
//         });
//     } catch (error) {
//         console.error('Error fetching schedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };

// search by multiple params with destination name

// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     try {
//         // Fetch destination IDs based on the names
//         const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
//         const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

//         const whereCondition = {};

//         if (search_date) {
//             const searchDate = new Date(search_date);
//             whereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//         }

//         console.log("whereCondition:", whereCondition);

//         if (fromDestination) {
//             whereCondition.destination_from_id = fromDestination.id; // Use the found ID
//         }

//         if (toDestination) {
//             whereCondition.destination_to_id = toDestination.id; // Use the found ID
//         }

//         if (availability !== undefined) {
//             whereCondition.availability = availabilityBool;
//         }

//         // Log the whereCondition to debug
//         console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));

//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 },
//                 // {
//                 //     model: SubSchedule,
//                 //     as: 'SubSchedules',
//                 //     required: false, // Make SubSchedule optional
//                 //     where: {
//                 //         [Op.or]: [
//                 //             { availability: availabilityBool },
//                 //             { availability: { [Op.is]: null } }
//                 //         ]
//                 //     }
//                 // },
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false, // Make SeatAvailability optional
//                     where: {
//                         date: new Date(search_date), // Filter by search_date
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0 // Filter by passengers_total
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));

//         const response = schedules.map(schedule => {
//             const seatAvailability = schedule.SeatAvailabilities.length > 0 ? schedule.SeatAvailabilities : null;
//             return {
//                 ...schedule.get({ plain: true }),
//                 SeatAvailabilities: seatAvailability || 'Seat availability not available or not created for the given date'
//             };
//         });

//         const responseStatus = response.length > 0 ? 'success' : 'no schedules found';

//         res.status(200).json({
//             status: responseStatus,
//             data: response
//         });
//     } catch (error) {
//         console.error('Error fetching schedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };

//SEARCH DESTINATION AND INCLUDE SUBSCDULE
// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     try {
//         // Fetch destination IDs based on the names
//         const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
//         const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

//         const whereCondition = {};
//         const subWhereCondition = {};

//         if (search_date) {
//             const searchDate = new Date(search_date);
//             whereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//             subWhereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//         }

//         if (fromDestination) {
//             whereCondition.destination_from_id = fromDestination.id;
//             subWhereCondition.destination_from_schedule_id = fromDestination.id;
//         }

//         if (toDestination) {
//             whereCondition.destination_to_id = toDestination.id;
//             subWhereCondition.destination_to_schedule_id = toDestination.id;
//         }

//         if (availability !== undefined) {
//             whereCondition.availability = availabilityBool;
//             subWhereCondition.availability = availabilityBool;
//         }

//         // Log the whereCondition to debug
//         console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));
//         console.log('subWhereCondition:', JSON.stringify(subWhereCondition, null, 2));

//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 }
//             ]
//         });

//         const subSchedules = await SubSchedule.findAll({
//             where: subWhereCondition,
//             include: [
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false,
//                     where: {
//                         date: new Date(search_date),
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));
//         console.log('subSchedules:', JSON.stringify(subSchedules, null, 2));

//         const formattedSchedules = schedules.map(schedule => ({
//             ...schedule.get({ plain: true }),
//             type: 'Schedule'
//         }));

//         // Format subSchedules
//         const formattedSubSchedules = subSchedules.map(subSchedule => ({
//             ...subSchedule.get({ plain: true }),
//             type: 'SubSchedule',
//             SeatAvailabilities: subSchedule.SeatAvailabilities.length > 0
//                 ? subSchedule.SeatAvailabilities
//                 : 'Seat availability not available or not created for the given date'
//         }));

//         // Combine results
//         const combinedResults = [...formattedSchedules, ...formattedSubSchedules];
//         // console.log('combinedResults:', JSON.stringify(combinedResults, null, 2));
//         const responseStatus = combinedResults.length > 0 ? 'success' : 'no schedules found';

//         // Send response
//         res.status(200).json({
//             status: responseStatus,
//             data: combinedResults
//         });
//     } catch (error) {
//         console.error('Error fetching schedules and subschedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };

//SEARCH SCHEDULE WITH MULTIPLE RESPONSES
// const getSchedulesByMultipleParams = async (req, res) => {
//     const { search_date, from, to, availability, passengers_total } = req.query;

//     // Parse availability to a boolean value
//     const availabilityBool = availability === 'true';

//     try {
//         // Fetch destination IDs based on the names
//         const fromDestination = from ? await Destination.findOne({ where: { name: from } }) : null;
//         const toDestination = to ? await Destination.findOne({ where: { name: to } }) : null;

//         const whereCondition = {};
//         const subWhereCondition = {};

//         if (search_date) {
//             const searchDate = new Date(search_date);
//             whereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//             subWhereCondition[Op.and] = [
//                 { validity_start: { [Op.lte]: searchDate } },
//                 { validity_end: { [Op.gte]: searchDate } }
//             ];
//         }

//         if (fromDestination) {
//             whereCondition.destination_from_id = fromDestination.id;
//             subWhereCondition.destination_from_schedule_id = fromDestination.id;
//         }

//         if (toDestination) {
//             whereCondition.destination_to_id = toDestination.id;
//             subWhereCondition.destination_to_schedule_id = toDestination.id;
//         }

//         if (availability !== undefined) {
//             whereCondition.availability = availabilityBool;
//             subWhereCondition.availability = availabilityBool;
//         }

//         // Log the whereCondition to debug
//         console.log('whereCondition:', JSON.stringify(whereCondition, null, 2));
//         console.log('subWhereCondition:', JSON.stringify(subWhereCondition, null, 2));

//         const schedules = await Schedule.findAll({
//             where: whereCondition,
//             include: [
//                 {
//                     model: Destination,
//                     as: 'FromDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Destination,
//                     as: 'ToDestination',
//                     attributes: ['id', 'name', 'port_map_url', 'image_url']
//                 },
//                 {
//                     model: Transit,
//                     include: {
//                         model: Destination,
//                         as: 'Destination',
//                         attributes: ['id', 'name', 'port_map_url', 'image_url']
//                     }
//                 }
//             ]
//         });

//         const subSchedules = await SubSchedule.findAll({
//             where: subWhereCondition,
//             include: [
//                 {
//                     model: SeatAvailability,
//                     as: 'SeatAvailabilities',
//                     required: false,
//                     where: {
//                         date: new Date(search_date),
//                         available_seats: {
//                             [Op.gte]: passengers_total ? parseInt(passengers_total) : 0
//                         }
//                     }
//                 }
//             ]
//         });

//         // Log the result to debug
//         console.log('schedules:', JSON.stringify(schedules, null, 2));
//         console.log('subSchedules:', JSON.stringify(subSchedules, null, 2));

//         const formattedSchedules = schedules.map(schedule => ({
//             ...schedule.get({ plain: true }),
//             type: 'Schedule'
//         }));

//         // Format subSchedules
//         const formattedSubSchedules = subSchedules.map(subSchedule => ({
//             ...subSchedule.get({ plain: true }),
//             type: 'SubSchedule',
//             SeatAvailabilities: subSchedule.SeatAvailabilities.length > 0
//                 ? subSchedule.SeatAvailabilities
//                 : 'Seat availability not created'
//         }));;

//         // Separate results based on seat availability
//         const availableSchedules = [];
//         const fullSchedules = [];
//         const noSeatAvailabilitySchedules = [];

//         formattedSubSchedules.forEach(subSchedule => {
//             if (subSchedule.SeatAvailabilities === 'Seat availability not created') {
//                 noSeatAvailabilitySchedules.push(subSchedule);
//             } else if (subSchedule.SeatAvailabilities.length > 0 && subSchedule.SeatAvailabilities[0].available_seats === 0) {
//                 fullSchedules.push(subSchedule);
//             } else {
//                 availableSchedules.push(subSchedule);
//             }
//         });

//         // Combine formattedSchedules with availableSchedules
//         const combinedAvailableResults = [...formattedSchedules, ...availableSchedules];

//         // Log the combined results for debugging
//         console.log('combinedAvailableResults:', JSON.stringify(combinedAvailableResults, null, 2));
//         console.log('fullSchedules:', JSON.stringify(fullSchedules, null, 2));
//         console.log('noSeatAvailabilitySchedules:', JSON.stringify(noSeatAvailabilitySchedules, null, 2));

//         // Determine response status and content
//         let responseStatus = 'success';
//         let responseData = {
//             availableSchedules: combinedAvailableResults,
//             noSeatAvailabilitySchedules: noSeatAvailabilitySchedules
//         };

//         if (fullSchedules.length > 0) {
//             responseStatus = 'full';
//             responseData = 'The schedule for the selected date is full';
//         } else if (combinedAvailableResults.length === 0 && noSeatAvailabilitySchedules.length === 0) {
//             responseStatus = 'no schedules found';
//             responseData = [];
//         }

//         // Send response
//         res.status(200).json({
//             status: responseStatus,
//             data: responseData
//         });
//     } catch (error) {
//         console.error('Error fetching schedules and subschedules:', error);
//         res.status(400).json({
//             status: 'error',
//             message: error.message
//         });
//     }
// };

//search schedule multiple params with 4 respond available scheulde, and f

// const createScheduleWithTransit = async (req, res) => {
//     const t = await sequelize.transaction();
//     try {
//         const {
//             boat_id,
//             destination_from_id,
//             destination_to_id,
//             user_id,
//             validity_start,
//             validity_end,
//             check_in_time,
//             low_season_price,
//             high_season_price,
//             peak_season_price,
//             return_low_season_price,
//             return_high_season_price,
//             return_peak_season_price,
//             arrival_time,
//             journey_time,
//             route_image,
//             transits
//         } = req.body;

//         // Create the schedule
//         const schedule = await Schedule.create({
//             boat_id,
//             destination_from_id,
//             destination_to_id,
//             user_id,
//             validity_start,
//             validity_end,
//             check_in_time,
//             low_season_price,
//             high_season_price,
//             peak_season_price,
//             return_low_season_price,
//             return_high_season_price,
//             return_peak_season_price,
//             arrival_time,
//             journey_time,
//             route_image
//         }, { transaction: t });

//         // Create the transits
//         const createdTransits = [];
//         if (transits && transits.length > 0) {
//             for (const transit of transits) {
//                 const { destination_id, check_in_time, departure_time, arrival_time, journey_time } = transit;

//                 // Validate destination_id
//                 const destination = await Destination.findByPk(destination_id);
//                 if (!destination) {
//                     throw new Error(`Destination ID ${destination_id} not found.`);
//                 }

//                 const createdTransit = await Transit.create({
//                     schedule_id: schedule.id,
//                     destination_id,
//                     check_in_time,
//                     departure_time,
//                     arrival_time,
//                     journey_time
//                 }, { transaction: t });

//                 // Include destination details
//                 const transitWithDestination = await Transit.findByPk(createdTransit.id, {
//                     include: {
//                         model: Destination,
//                         as: 'Destination'
//                     },
//                     transaction: t
//                 });

//                 createdTransits.push(transitWithDestination);
//             }
//         }

//         await t.commit();
//         res.status(201).json({
//             schedule,
//             transits: createdTransits
//         });
//     } catch (error) {
//         await t.rollback();
//         res.status(400).json({ error: error.message });
//     }
// };
