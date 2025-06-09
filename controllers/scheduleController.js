// controllers/scheduleController.js
const {
  Schedule,
  SubSchedule,
  User,
  Boat,
  Transit,
  SeatAvailability,
  Destination,
  Passenger,
  Booking,
  sequelize,
} = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { processBookedSeats } = require("../util/seatUtils");
const { Op, literal, QueryTypes } = require("sequelize");
const buildSearchConditions = require("../util/buildSearchCondition");
const { buildRoute, buildRouteFromSchedule } = require("../util/buildRoute");
const {
  buildRouteFromSchedule2,
} = require("../util/schedulepassenger/buildRouteFromSchedule");
const { calculatePublicCapacity } = require("../util/getCapacityReduction");
const { getScheduleAndSubScheduleByDate } = require("../util/scheduleUtils");
const { fn, col } = require("sequelize");
const {
  getSchedulesWithSubSchedules2,
} = require("../util/schedulepassenger/scheduleUtils");
// getAllSchedulesWithSubSchedules.js (Controller)

const {
  formatSchedules,
  formatSubSchedules,
} = require("../util/formatSchedules"); // Import utils
const { getDay } = require("date-fns"); // Correctly importing getDay
const {
  formatSchedulesSimple,
  formatSubSchedulesSimple,
  getDayNamesFromBitmask,
} = require("../util/formatUtilsSimple");
const { getSubScheduleInclude } = require("../util/formattedData2");
const {
  getTotalPassengers,
  getTotalRealPassengersRaw,
} = require("../util/schedulepassenger/getTotalPassenger");

// Fungsi untuk memeriksa apakah hari tertentu tersedia berdasarkan bitmask

const isDayAvailable = (date, daysOfWeek) => {
  const dayOfWeek = new Date(date).getDay(); // Dapatkan hari dalam minggu (0 untuk Minggu, 1 untuk Senin, dst.)
  return (daysOfWeek & (1 << dayOfWeek)) !== 0; // Periksa apakah hari tersebut sesuai dengan bitmask
};
const getDaysInMonth = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate(); // Get number of days in the month
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const monthString = String(month).padStart(2, "0");
    const dayString = String(day).padStart(2, "0");
    return `${year}-${monthString}-${dayString}`; // Format date as 'YYYY-MM-DD'
  });
};

// const getAllSchedulesWithSubSchedules = async (req, res) => {
//   const { month, year, boat_id } = req.query;

//   if (!month || !year || !boat_id) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "Please provide month, year, and boat_id in the query parameters.",
//     });
//   }

//   try {
//     // Use the utility function to fetch schedules with sub-schedules
//     const schedules = await getSchedulesWithSubSchedules2(
//       Schedule, // Your Schedule model
//       SubSchedule, // Your SubSchedule model
//       Destination, // Your Destination model
//       Transit, // Your Transit model
//       Boat, // Your Boat model
//       { month, year, boat_id } // Query parameters
//     );

//     // If no schedules are found, return a 200 status with a message
//     if (!schedules || schedules.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "There’s no schedule yet for the specified month and boat.",
//         data: [],
//       });
//     }

//     // Use getDaysInMonth to generate all days in the requested month
//     const daysInMonth = getDaysInMonth(month, year);
//     const results = [];

//     for (const date of daysInMonth) {
//       console.log(`Processing date: ${date}`);

//       for (const schedule of schedules) {
//         // Ambil total penumpang dan seat availability ID untuk jadwal utama
//         const { totalPassengers, seatAvailabilityIds } = await getTotalPassengers(
//           schedule.id,
//           null,
//           date
//         );

//         // Tambahkan hasil jadwal utama ke results
//         results.push({
//           seatavailability_id: seatAvailabilityIds.length > 0 ? seatAvailabilityIds[0] : null, // Ambil ID pertama jika ada
//           date: date,
//           schedule_id: schedule.id,
//           subschedule_id: null,
//           total_passengers: totalPassengers,
//           route: buildRouteFromSchedule2(schedule, null),
//           days_of_week: schedule.days_of_week,
//         });

//         // Iterasi setiap sub-jadwal
//         for (const subSchedule of schedule.SubSchedules) {
//           const { totalPassengers, seatAvailabilityIds } = await getTotalPassengers(
//             subSchedule.schedule_id,
//             subSchedule.id,
//             date
//           );

//           results.push({
//             seatavailability_id: seatAvailabilityIds.length > 0 ? seatAvailabilityIds[0] : null, // Ambil ID pertama jika ada
//             date: date,
//             schedule_id: subSchedule.schedule_id,
//             subschedule_id: subSchedule.id,
//             total_passengers: totalPassengers,
//             route: buildRouteFromSchedule2(schedule, subSchedule),
//             days_of_week: subSchedule.days_of_week,
//           });
//         }
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       data: results,
//     });
//   } catch (error) {
//     console.error("Error fetching schedules with sub-schedules:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch schedules for the specified month and boat.",
//     });
//   }
// };
// const getScheduleSubschedule = async (req, res) => {
//   const { boat_id } = req.query;

//   try {
//     let schedules;

//     // Fetch schedules by boat_id, or all schedules if no boat_id provided
//     if (boat_id) {
//       schedules = await Schedule.findAll({
//         where: { boat_id },
//         include: [
//           { model: Destination, as: "FromDestination", attributes: ["id", "name"] },
//           { model: Destination, as: "ToDestination", attributes: ["id", "name"] },
//           { model: Boat, as: "Boat", attributes: ["id", "boat_name"] }
//         ],
//         logging: console.log,
//       });

//       if (schedules.length === 0) {
//         return res.status(404).json({
//           status: "error",
//           message: `No schedules found for boat_id ${boat_id}`,
//         });
//       }
//     } else {
//       schedules = await Schedule.findAll({
//         include: [
//           { model: Destination, as: "FromDestination", attributes: ["id", "name"] },
//           { model: Destination, as: "ToDestination", attributes: ["id", "name"] },
//           { model: Boat, as: "Boat", attributes: ["id", "boat_name"] }
//         ],
//         logging: console.log,
//       });
//     }

//     const scheduleIds = schedules.map((schedule) => schedule.id);

//     // Fetch related sub-schedules
//     const subSchedules = await SubSchedule.findAll({
//       where: {
//         schedule_id: scheduleIds,
//       },
//       include: getSubScheduleInclude(),
//       logging: console.log,
//     });

//     if (subSchedules.length === 0) {
//       return res.status(404).json({
//         status: "error",
//         message: `No subschedules found for boat_id ${boat_id || 'all boats'}`,
//       });
//     }

//     // Format schedules and sub-schedules
//     const formattedSchedules = schedules.map((schedule) => {
//       const boat_name = schedule.Boat?.boat_name || 'N/A';
//       const main_route = `${schedule.FromDestination?.name || 'N/A'} to ${schedule.ToDestination?.name || 'N/A'}`;
//       const days_of_week = getDayNamesFromBitmask(schedule.days_of_week);

//       // Format the main schedule similarly to a sub-schedule
//       const formattedMainSchedule = {
//         id: schedule.id,
//         schedule_id: schedule.id, // Main schedule has its own ID
//         from: schedule.FromDestination?.name || 'N/A',
//         to: schedule.ToDestination?.name || 'N/A',
//         transits: [], // Main schedule has no transits
//         route_image: schedule.route_image || 'N/A', // Add if schedule has an image
//         departure_time: schedule.departure_time || 'N/A',
//         check_in_time: schedule.check_in_time || 'N/A',
//         arrival_time: schedule.arrival_time || 'N/A',
//         journey_time: schedule.journey_time || 'N/A',
//         boat_id: schedule.Boat?.id || 'N/A',
//         low_season_price: schedule.low_season_price || 'N/A',
//         high_season_price: schedule.high_season_price || 'N/A',
//         peak_season_price: schedule.peak_season_price || 'N/A',
//         validity: `${schedule.validity_start} to ${schedule.validity_end}`,
//       };

//       // Filter subSchedules related to this schedule
//       const scheduleSubSchedules = subSchedules.filter(subSchedule => subSchedule.schedule_id === schedule.id);

//       // Format subSchedules
//       const formattedSubSchedules = scheduleSubSchedules.map((subSchedule) => {
//         // Get timing data
//         const departure_time = subSchedule.departure_time || subSchedule.TransitFrom?.departure_time || schedule.departure_time || 'N/A';
//         const check_in_time = subSchedule.check_in_time || subSchedule.TransitFrom?.check_in_time || schedule.check_in_time || 'N/A';
//         const arrival_time = subSchedule.arrival_time || subSchedule.TransitTo?.arrival_time || schedule.arrival_time || 'N/A';
//         const journey_time = subSchedule.journey_time || subSchedule.TransitTo?.journey_time || schedule.journey_time || 'N/A';

//         return {
//           id: subSchedule.id,
//           schedule_id: subSchedule.schedule_id,
//           from: subSchedule.DestinationFrom?.name || subSchedule.TransitFrom?.Destination?.name || 'N/A',
//           to: subSchedule.DestinationTo?.name || subSchedule.TransitTo?.Destination?.name || 'N/A',
//           transits: subSchedule.Transits ? subSchedule.Transits.map((transit) => ({
//             destination: transit.Destination?.name || 'N/A',
//             departure_time: transit.departure_time || 'N/A',
//             arrival_time: transit.arrival_time || 'N/A',
//             journey_time: transit.journey_time || 'N/A',
//           })) : [],
//           route_image: subSchedule.route_image || 'N/A',
//           departure_time,
//           check_in_time,
//           arrival_time,
//           journey_time,
//           boat_id: subSchedule.Schedule?.Boat?.id || 'N/A',
//           low_season_price: subSchedule.low_season_price || 'N/A',
//           high_season_price: subSchedule.high_season_price || 'N/A',
//           peak_season_price: subSchedule.peak_season_price || 'N/A',
//           validity: `${subSchedule.validity_start} to ${subSchedule.validity_end}`,
//         };
//       });

//       // Combine main schedule and subSchedules into one array
//       return {
//         boat_name,
//         main_route,
//         days_of_week,
//         allSchedules: [formattedMainSchedule, ...formattedSubSchedules], // Main schedule first, then sub-schedules
//       };
//     });

//     // Return the response, ensuring an array of schedules is returned
//     res.status(200).json({
//       status: "success",
//       data: formattedSchedules,
//     });
//   } catch (error) {
//     console.error("Error fetching subschedules:", error);
//     res.status(500).json({
//       status: "error",
//       message: error.message,
//     });
//   }
// };

// const getAllSchedulesWithSubSchedules = async (req, res) => {
//   const { month, year, boat_id } = req.query;
//   console.log("boatID" ,boat_id);

//   if (!month || !year || !boat_id) {
//     return res.status(400).json({
//       success: false,
//       message: "Please provide month, year, and boat_id in the query parameters.",
//     });
//   }

//   try {
//     // Dynamic import untuk p-limit
//     const { default: pLimit } = await import("p-limit");

//     // Ambil schedules beserta sub-schedules untuk bulan dan boat tertentu
//     const schedules = await getSchedulesWithSubSchedules2(
//       Schedule,      // Model Schedule
//       SubSchedule,   // Model SubSchedule
//       Destination,   // Model Destination
//       Transit,       // Model Transit
//       Boat,          // Model Boat
//       { month, year, boat_id }  // Parameter objek
//     );

//     // Jika tidak ditemukan schedule, kembalikan pesan yang sesuai
//     if (!schedules || schedules.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "There’s no schedule yet for the specified month and boat.",
//         data: [],
//       });
//     }

//     // Ambil semua tanggal dalam bulan tersebut, misalnya ['2025-02-01', ..., '2025-02-28']
//     const daysInMonth = getDaysInMonth(month, year);

//     // Gunakan p-limit untuk membatasi jumlah promise yang berjalan bersamaan (misalnya, maksimum 10)
//     const limit = pLimit(10);
//     const tasks = [];

//     // Iterasi setiap tanggal
//     for (const date of daysInMonth) {

//       // Iterasi setiap schedule
//       for (const schedule of schedules) {
//         // Buat promise untuk schedule utama (tanpa sub-schedule)
//         tasks.push(
//           limit(() =>
//             getTotalPassengers(schedule.id, null, date).then(
//               ({ totalPassengers, seatAvailabilityIds,totalRealPassengers }) => ({
//                 seatavailability_id:
//                   seatAvailabilityIds.length > 0 ? seatAvailabilityIds[0] : null,
//                 date,
//                 schedule_id: schedule.id,
//                 subschedule_id: null,
//                 total_passengers: totalPassengers,
//                 total_real_passengers: totalRealPassengers ||0,
//                 route: buildRouteFromSchedule2(schedule, null),
//                 days_of_week: schedule.days_of_week,
//               })
//             )
//           )
//         );

//         // Jika schedule memiliki sub-schedules, proses masing-masing sub-schedule
//         if (schedule.SubSchedules && schedule.SubSchedules.length > 0) {
//           for (const subSchedule of schedule.SubSchedules) {
//             tasks.push(
//               limit(() =>
//                 getTotalPassengers(subSchedule.schedule_id, subSchedule.id, date).then(
//                   ({ totalPassengers, seatAvailabilityIds,totalRealPassengers }) => ({
//                     seatavailability_id:
//                       seatAvailabilityIds.length > 0 ? seatAvailabilityIds[0] : null,
//                     date,
//                     schedule_id: subSchedule.schedule_id,
//                     subschedule_id: subSchedule.id,
//                     total_passengers: totalPassengers,
//                     total_real_passengers: totalRealPassengers || 0,
//                     route: buildRouteFromSchedule2(schedule, subSchedule),
//                     days_of_week: subSchedule.days_of_week,
//                   })
//                 )
//               )
//             );
//           }
//         }
//       }
//     }

//     // Eksekusi semua promise secara paralel dengan batas concurrency
//     const results = await Promise.all(tasks);

//     return res.status(200).json({
//       success: true,
//       data: results,
//     });
//   } catch (error) {
//     console.error("Error fetching schedules with sub-schedules:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch schedules for the specified month and boat.",
//     });
//   }
// };

const getAllSchedulesWithSubSchedules = async (req, res) => {
  const { month, year, boat_id } = req.query;
  console.log("boatID", boat_id);

  if (!month || !year || !boat_id) {
    return res.status(400).json({
      success: false,
      message:
        "Please provide month, year, and boat_id in the query parameters.",
    });
  }

  // Convert boat_id to integer
  const boatIdInt = parseInt(boat_id, 10);
  console.log("BOAT ID RECEIVED:", boatIdInt);

  try {
    // Define the first and last date of the month
    const firstDate = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0);

    // Create date range for the month
    const daysInMonth = getDaysInMonth(month, year);

    // =============== STEP 1: Fetch all relevant schedules and subschedules ===============
    const boatFilter = boatIdInt === 0 ? {} : { boat_id: boatIdInt };
    console.log("Fetching schedules for:", {
      month,
      year,
      boatIdInt,
      boatFilter,
    });

    const schedules = await Schedule.findAll({
      attributes: [
        "id",
        "boat_id",
        "days_of_week",
        "destination_from_id",
        "destination_to_id",
      ],
      where: {
        availability: true,
        ...boatFilter,
        [Op.or]: [
          {
            validity_start: { [Op.lte]: lastDate },
            validity_end: { [Op.gte]: firstDate },
          },
        ],
      },
      include: [
        {
          model: SubSchedule,
          as: "SubSchedules",
          attributes: [
            "id",
            "schedule_id",
            "days_of_week",
            "destination_from_schedule_id",
            "destination_to_schedule_id",
            "transit_from_id",
            "transit_to_id",
            "transit_1",
            "transit_2",
            "transit_3",
            "transit_4",
          ],
          where: {
            availability: true,
            [Op.or]: [
              {
                validity_start: { [Op.lte]: lastDate },
                validity_end: { [Op.gte]: firstDate },
              },
            ],
          },
          required: false,
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
          model: Boat,
          as: "Boat",
          attributes: ["boat_name", "capacity"],
        },
      ],
      raw: false, // Ensure we get model instances, not just plain objects
    });

    if (!schedules || schedules.length === 0) {
      return res.status(200).json({
        success: true,
        message: "There's no schedule yet for the specified month and boat.",
        data: [],
      });
    }

    console.log("Schedules Found:", schedules.length);

    // =============== STEP 2: Extract schedule and subschedule IDs ===============
    const scheduleIds = schedules.map((schedule) => schedule.id);

    // =============== STEP 3: Get SeatAvailability and passenger data ===============
    const seatAvailabilityData = await sequelize.query(
      `
      SELECT 
        sa.id as seat_availability_id,
        sa.schedule_id,
        sa.subschedule_id,
        sa.date,
        COALESCE(SUM(b.total_passengers), 0) as total_passengers
      FROM SeatAvailability sa
      LEFT JOIN BookingSeatAvailability bsa ON sa.id = bsa.seat_availability_id
      LEFT JOIN Bookings b ON bsa.booking_id = b.id AND b.payment_status IN ('paid', 'invoiced', 'unpaid','refund_50','cancel_100_charge')
      WHERE 
        sa.schedule_id IN (:scheduleIds)
        AND sa.date BETWEEN :startDate AND :endDate
      GROUP BY 
        sa.id, sa.schedule_id, sa.subschedule_id, sa.date
    `,
      {
        replacements: {
          scheduleIds: scheduleIds,
          startDate: firstDate,
          endDate: lastDate,
        },
        type: QueryTypes.SELECT,
      }
    );

    // =============== STEP 4: Get Booking data for total_real_passengers ===============
    const bookingData = await sequelize.query(
      `
      SELECT 
        schedule_id,
        subschedule_id,
        DATE(booking_date) as date,
        SUM(total_passengers) as total_real_passengers
      FROM Bookings
      WHERE 
        schedule_id IN (:scheduleIds)
        AND booking_date BETWEEN :startDate AND :endDate
        AND payment_status IN ('paid', 'invoiced', 'unpaid','refund_50','cancel_100_charge')
      GROUP BY 
        schedule_id, subschedule_id, DATE(booking_date)
    `,
      {
        replacements: {
          scheduleIds: scheduleIds,
          startDate: firstDate,
          endDate: lastDate,
        },
        type: QueryTypes.SELECT,
      }
    );

    // =============== STEP 5: Process data into maps for easy lookup ===============
    const results = [];
    const seatAvailabilityMap = {};
    const realPassengerMap = {};

    // Map SeatAvailability data
    seatAvailabilityData.forEach((sa) => {
      const key = `${sa.schedule_id}_${sa.subschedule_id || "null"}_${sa.date}`;

      if (!seatAvailabilityMap[key]) {
        seatAvailabilityMap[key] = [];
      }

      seatAvailabilityMap[key].push({
        id: sa.seat_availability_id,
        total_passengers: parseInt(sa.total_passengers) || 0,
      });
    });

    // Map Booking data
    bookingData.forEach((booking) => {
      const key = `${booking.schedule_id}_${booking.subschedule_id || "null"}_${
        booking.date
      }`;
      realPassengerMap[key] = parseInt(booking.total_real_passengers) || 0;
    });

    // Function to get best SeatAvailability for a given key
    const getBestSeatAvailability = (key) => {
      const seatAvailabilities = seatAvailabilityMap[key] || [];
      let bestId = null;
      let maxPassengers = -1;

      seatAvailabilities.forEach((sa) => {
        if (sa.total_passengers > maxPassengers) {
          maxPassengers = sa.total_passengers;
          bestId = sa.id;
        }
      });

      // If no SeatAvailability with passengers, use the first one
      if (bestId === null && seatAvailabilities.length > 0) {
        bestId = seatAvailabilities[0].id;
      }

      return {
        id: bestId,
        total_passengers: maxPassengers > 0 ? maxPassengers : 0,
      };
    };

    // Adjust the buildRouteFromSchedule2 function to be more flexible with data structures
    const buildRouteFromSchedule2Adjusted = (schedule, subSchedule) => {
      let route = "";

      // Ensure that schedule is available
      if (!schedule) {
        return "Unknown route";
      }

      // Check if we're working with a raw object or a Sequelize model instance
      const isModelInstance = (obj) => {
        return obj && typeof obj === "object" && obj.dataValues !== undefined;
      };

      // Helper function to safely get values from either model instances or plain objects
      const getValue = (obj, path) => {
        if (!obj) return null;

        // Handle path like "FromDestination.name"
        const parts = path.split(".");
        let current = obj;

        for (const part of parts) {
          if (!current) return null;

          // If it's a model instance, use dataValues
          if (isModelInstance(current)) {
            current = current.dataValues[part] || current[part];
          } else {
            current = current[part];
          }
        }

        return current;
      };

      // Handle Schedule Only Case (no SubSchedule)
      if (!subSchedule) {
        const destinationFrom =
          getValue(schedule, "DestinationFrom.name") || "Unknown";
        const transits = Array.isArray(getValue(schedule, "Transits"))
          ? getValue(schedule, "Transits")
              .map((t) => getValue(t, "Destination.name"))
              .filter(Boolean)
          : [];
        const destinationTo =
          getValue(schedule, "DestinationTo.name") || "Unknown";

        // Build the route
        route = `${destinationFrom} - ${
          transits.length > 0 ? transits.join(" - ") + " - " : ""
        }${destinationTo}`;
      }

      // Handle SubSchedule Case
      else {
        const destinationFromSchedule =
          getValue(subSchedule, "DestinationFrom.name") || "Unknown";
        const transitFrom =
          getValue(subSchedule, "TransitFrom.Destination.name") || "Unknown";

        // Collect all transit points
        const transits = [
          getValue(subSchedule, "Transit1.Destination.name"),
          getValue(subSchedule, "Transit2.Destination.name"),
          getValue(subSchedule, "Transit3.Destination.name"),
          getValue(subSchedule, "Transit4.Destination.name"),
        ].filter(Boolean);

        const transitTo =
          getValue(subSchedule, "TransitTo.Destination.name") || "Unknown";
        const destinationToSchedule =
          getValue(subSchedule, "DestinationTo.name") || "Unknown";

        // Build the route
        route = `${destinationFromSchedule} - ${transitFrom} - ${
          transits.length > 0 ? transits.join(" - ") + " - " : ""
        }${transitTo} - ${destinationToSchedule}`;
      }

      return route;
    };

    // =============== STEP 6: Generate final results ===============
    // Generate results for each schedule
    schedules.forEach((schedule) => {
      // Process main schedule for each date
      daysInMonth.forEach((date) => {
        const key = `${schedule.id}_null_${date}`;
        const seatAvailability = getBestSeatAvailability(key);
        const total_real_passengers = realPassengerMap[key] || 0;

        results.push({
          date,
          schedule_id: schedule.id,
          subschedule_id: null,
          total_passengers: seatAvailability.total_passengers,
          total_real_passengers: total_real_passengers,
          seatavailability_id: seatAvailability.id,
          route: buildRouteFromSchedule2Adjusted(schedule, null),
          days_of_week: schedule.days_of_week,
          boat_name: schedule.Boat?.boat_name || "",
          capacity: schedule.Boat?.capacity || 0,
        });
      });

      // Process sub-schedules for each date
      if (schedule.SubSchedules && schedule.SubSchedules.length > 0) {
        schedule.SubSchedules.forEach((subSchedule) => {
          daysInMonth.forEach((date) => {
            const key = `${schedule.id}_${subSchedule.id}_${date}`;
            const seatAvailability = getBestSeatAvailability(key);
            const total_real_passengers = realPassengerMap[key] || 0;

            results.push({
              date,
              schedule_id: schedule.id,
              subschedule_id: subSchedule.id,
              total_passengers: seatAvailability.total_passengers,
              total_real_passengers: total_real_passengers,
              seatavailability_id: seatAvailability.id,
              route: buildRouteFromSchedule2Adjusted(schedule, subSchedule),
              days_of_week: subSchedule.days_of_week,
              boat_name: schedule.Boat?.boat_name || "",
              capacity: schedule.Boat?.capacity || 0,
            });
          });
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching schedules with sub-schedules:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schedules for the specified month and boat.",
      error: error.message,
    });
  }
};

//  * Helper function to get all days in a month
//  */

const getScheduleSubschedule = async (req, res) => {
  const { boat_id } = req.query;

  try {
    let schedules;

    // Fetch schedules by boat_id, or all schedules if no boat_id provided
    if (boat_id) {
      schedules = await Schedule.findAll({
        where: { boat_id, availability: true },
        include: [
          {
            model: Destination,
            as: "FromDestination",
            attributes: ["id", "name"],
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
          },
          {
            model: Destination,
            as: "ToDestination",
            attributes: ["id", "name"],
          },
          { model: Boat, as: "Boat", attributes: ["id", "boat_name"] },
        ],
        // logging: console.log,
      });

      if (schedules.length === 0) {
        return res.status(404).json({
          status: "error",
          message: `No schedules found for boat_id ${boat_id}`,
        });
      }
    } else {
      schedules = await Schedule.findAll({
        include: [
          {
            model: Destination,
            as: "FromDestination",
            attributes: ["id", "name"],
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
          {
            model: Destination,
            as: "ToDestination",
            attributes: ["id", "name"],
          },
          { model: Boat, as: "Boat", attributes: ["id", "boat_name"] },
        ],
        // logging: console.log,
      });
    }

    const scheduleIds = schedules.map((schedule) => schedule.id);

    // Fetch related sub-schedules
    const subSchedules = await SubSchedule.findAll({
      where: {
        schedule_id: scheduleIds,
        availability: true,
      },
      include: getSubScheduleInclude(),
      // logging: console.log,
    });

    const formatDate = (dateStr) => {
      if (!dateStr) return "Invalid Date"; // atau bisa juga return "N/A"
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Invalid Date";;

      const day = String(date.getDate()).padStart(2, "0");
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();

      return `${day} ${month} ${year}`;
    };

    const calculateJourneyTime = (departure, arrival) => {
      if (departure && arrival) {
        const [depHours, depMinutes] = departure.split(":").map(Number);
        const [arrHours, arrMinutes] = arrival.split(":").map(Number);

        const departureInMinutes = depHours * 60 + depMinutes;
        const arrivalInMinutes = arrHours * 60 + arrMinutes;

        let difference = arrivalInMinutes - departureInMinutes;

        // Handle overnight trips (e.g., departure 23:00, arrival 02:00)
        if (difference < 0) difference += 24 * 60; // Add 24 hours in minutes

        // Convert total minutes to hours and minutes
        const hours = Math.floor(difference / 60);
        const minutes = difference % 60;

        // Format as HH:mm (e.g., 2 hours 0 minutes becomes "02:00")
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )}`;
      }
      return "N/A"; // Return "N/A" if either time is missing
    };
    // Format schedules and sub-schedules
    const formattedSchedules = schedules.map((schedule) => {
      const boat_name = schedule.Boat?.boat_name || "N/A";
      const main_route = `${schedule.FromDestination?.name || "N/A"} to ${
        schedule.ToDestination?.name || "N/A"
      }`;
      const days_of_week = getDayNamesFromBitmask(schedule.days_of_week);

      // Format the main schedule similarly to a sub-schedule
      const formattedMainSchedule = {
        id: schedule.id,
        schedule_id: schedule.id, // Main schedule has its own ID
        from: schedule.FromDestination?.name || "N/A",
        to: schedule.ToDestination?.name || "N/A",
        transits: schedule.Transits 
        ? schedule.Transits.map((transit) => ({
            destination: transit.Destination?.name || 
                        (transit.destination_id ? `Destination ${transit.Destination.name}` : "N/A"),
            departure_time: transit.departure_time || "N/A",
            arrival_time: transit.arrival_time || "N/A",
            journey_time: transit.journey_time || "N/A",
          }))
        : [],
        route_image: schedule.route_image || "N/A", // Add if schedule has an image
        departure_time: schedule.departure_time || "N/A",
        check_in_time: schedule.check_in_time || "N/A",
        arrival_time: schedule.arrival_time || "N/A",
        journey_time: schedule.journey_time
          ? calculateJourneyTime(schedule.departure_time, schedule.arrival_time)
          : "N/A",
        boat_id: schedule.Boat?.id || "N/A",
        low_season_price: schedule.low_season_price || "N/A",
        high_season_price: schedule.high_season_price || "N/A",
        peak_season_price: schedule.peak_season_price || "N/A",
        validity: `${formatDate(schedule.validity_start)} to ${formatDate(
          schedule.validity_end
        )}`,
      };

      // Filter subSchedules related to this schedule
      const scheduleSubSchedules = subSchedules.filter(
        (subSchedule) => subSchedule.schedule_id === schedule.id
      );

      // Format subSchedules, or leave an empty array if none exist
      const formattedSubSchedules =
        scheduleSubSchedules.length > 0
          ? scheduleSubSchedules.map((subSchedule) => {
              const lastTransit = schedule.Transits
                ? schedule.Transits[schedule.Transits.length - 1]
                : null;
              // console.log(`Using lastTransit: ${lastTransit}`);

              // Get timing data
              const departure_time = subSchedule.departure_time
                ? subSchedule.departure_time
                : subSchedule.TransitFrom?.departure_time
                ? subSchedule.TransitFrom.departure_time
                : schedule.departure_time
                ? schedule.departure_time
                : "N/A";

              const check_in_time = subSchedule.check_in_time
                ? subSchedule.check_in_time
                : subSchedule.TransitFrom?.check_in_time
                ? subSchedule.TransitFrom.check_in_time
                : schedule.check_in_time
                ? schedule.check_in_time
                : "N/A";

              const arrival_time = subSchedule.arrival_time
                ? subSchedule.arrival_time
                : subSchedule.TransitTo?.arrival_time
                ? subSchedule.TransitTo.arrival_time
                : schedule.arrival_time
                ? schedule.arrival_time
                : lastTransit?.arrival_time
                ? lastTransit.arrival_time
                : "N/A";
              // Calculate journey time if both departure and arrival times are available
              const journey_time =
                departure_time !== "N/A" && arrival_time !== "N/A"
                  ? calculateJourneyTime(departure_time, arrival_time)
                  : "N/A";

              return {
                id: subSchedule.id,
                schedule_id: subSchedule.schedule_id,
                from:
                  subSchedule.DestinationFrom?.name ||
                  subSchedule.TransitFrom?.Destination?.name ||
                  "N/A",
                to:
                  subSchedule.DestinationTo?.name ||
                  subSchedule.TransitTo?.Destination?.name ||
                  "N/A",
                transits: subSchedule.Transits
                  ? subSchedule.Transits.map((transit) => ({
                      destination: transit.Destination?.name || "N/A",
                      departure_time: transit.departure_time || "N/A",
                      arrival_time: transit.arrival_time || "N/A",
                      journey_time: transit.journey_time || "N/A",
                    }))
                  : [],
                route_image: subSchedule.route_image || "N/A",
                departure_time,
                check_in_time,
                arrival_time,
                journey_time,
                boat_id: subSchedule.Schedule?.Boat?.id || "N/A",
                low_season_price: subSchedule.low_season_price || "N/A",
                high_season_price: subSchedule.high_season_price || "N/A",
                peak_season_price: subSchedule.peak_season_price || "N/A",
                validity: `${formatDate(subSchedule.validity_start)} to ${formatDate(subSchedule.validity_end)}`,
              };
            })
          : []; // No sub-schedules found for this schedule

      // Combine main schedule and subSchedules into one array
      return {
        boat_name,
        main_route,
        days_of_week,
        allSchedules: [formattedMainSchedule, ...formattedSubSchedules], // Main schedule first, then sub-schedules (if any)
      };
    });

    // Return the response, ensuring an array of schedules is returned
    res.status(200).json({
      status: "success",
      data: formattedSchedules,
    });
  } catch (error) {
    console.error("Error fetching subschedules:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

const getScheduleFormatted = async (req, res) => {
  const { boat_id } = req.query;
  console.log("this is boat_id", boat_id);

  try {
    // Build where clause for Schedule
    const scheduleWhereClause = {
      availability: true,
    };

    // If boat_id is provided, add it to the where clause
    if (boat_id) {
      scheduleWhereClause.boat_id = boat_id;
    }

    // Fetch Schedules
    const schedules = await Schedule.findAll({
      where: scheduleWhereClause,
      attributes: [
        "id",
        "route_image",
        "departure_time",
        "check_in_time",
        "low_season_price",
        "high_season_price",
        "peak_season_price",
        "arrival_time",
        "journey_time",
        "validity_start",
        "validity_end",
        "days_of_week",
      ],
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
          attributes: ["id"], // Include only boat_id
        },
        {
          model: Transit,
          as: "Transits",
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
    });

    // Build where clause for SubSchedule
    const subScheduleWhereClause = {
      availability: true,
    };

    // Fetch SubSchedules
    let subSchedules = await SubSchedule.findAll({
      where: subScheduleWhereClause,
      attributes: [
        "id",
        "schedule_id",
        "destination_from_schedule_id",
        "destination_to_schedule_id",
        "transit_from_id",
        "transit_to_id",
        "transit_1",
        "low_season_price",
        "high_season_price",
        "peak_season_price",
        "transit_2",
        "transit_3",
        "validity_start",
        "validity_end",
        "transit_4",
        "route_image",
        "days_of_week",
      ],
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
            "check_in_time",
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
            "check_in_time",
            "arrival_time",
            "journey_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name"],
          },
        },
        // Transit associations
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
          attributes: [
            "id",
            "departure_time",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "boat_id",
            "route_image",
          ],
          include: [
            {
              model: Boat,
              as: "Boat",
              attributes: ["id"], // Include only boat_id
            },
          ],
        },
      ],
    });

    // If boat_id is provided, filter subSchedules by boat_id
    if (boat_id) {
      // Filter subSchedules where Schedule's boat_id matches
      subSchedules = subSchedules.filter(
        (subSchedule) => subSchedule.Schedule?.boat_id == boat_id
      );
    }

    // Return the formatted results
    res.status(200).json({
      status: "success",
      data: {
        schedules: formatSchedulesSimple(schedules),
        subSchedules: formatSubSchedulesSimple(subSchedules),
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

const createSeatAvailability = async (schedule, subschedule, date) => {

  console.log("start query", schedule, subschedule, date);
  try {
    // Get relevant boat and calculate public capacity
    const relevantBoat = schedule ? schedule.Boat : subschedule.Schedule.Boat;
    const publicCapacity = calculatePublicCapacity(relevantBoat);

    console.log("\n=== CREATE SEAT AVAILABILITY ===");
    console.log("Source:", schedule ? "Direct Schedule" : "SubSchedule");
    console.log(
      "Schedule ID:",
      schedule ? schedule.id : subschedule.Schedule.id
    );
    console.log("SubSchedule ID:", subschedule ? subschedule.id : null);
    console.log("Date:", date);
    console.log("Public Capacity:", publicCapacity);

    // Create the seat availability record
    const newSeatAvailability = await SeatAvailability.create({
      schedule_id: schedule ? schedule.id : subschedule.Schedule.id,
      subschedule_id: subschedule ? subschedule.id : null,
      available_seats: publicCapacity, // Using calculated public capacity
      availability: true,
      date: date,
      boost: false,
    });

    console.log("Created Seat Availability:", {
      id: newSeatAvailability.id,
      available_seats: newSeatAvailability.available_seats,
      schedule_id: newSeatAvailability.schedule_id,
      subschedule_id: newSeatAvailability.subschedule_id,
    });
    console.log("=== END CREATE SEAT AVAILABILITY ===\n");

    return newSeatAvailability;
  } catch (error) {
    console.error("\n=== ERROR CREATING SEAT AVAILABILITY ===");
    console.error("Error Details:", {
      schedule_id: schedule ? schedule.id : subschedule?.Schedule?.id || "null",
      subschedule_id: subschedule ? subschedule.id : "null",
      date: date,
      error: error.message,
    });
    throw new Error("Failed to create seat availability");
  }
};

// Controller function to fetch schedules and sub-schedules
// const searchSchedulesAndSubSchedules = async (req, res) => {
//   const { from, to, date, passengers_total } = req.query;

//   try {
//     const selectedDate = new Date(date);
//     const selectedDayOfWeek = getDay(selectedDate);

//     const schedules = await Schedule.findAll({
//       where: {
//         destination_from_id: from,
//         destination_to_id: to,
//         availability: 1,
//         validity_start: { [Op.lte]: selectedDate },
//         validity_end: { [Op.gte]: selectedDate },
//         [Op.and]: sequelize.literal(
//           `(Schedule.days_of_week & ${1 << selectedDayOfWeek}) != 0`
//         ),
//       },
//       include: [
//         {
//           model: Destination,
//           as: "FromDestination",
//           attributes: ["id", "name", "port_map_url", "image_url"],
//         },
//         {
//           model:SeatAvailability,
//           as: "SeatAvailabilities",
//         },
//         {
//           model: Destination,
//           as: "ToDestination",
//           attributes: ["id", "name", "port_map_url", "image_url"],
//         },
//         {
//           model: Boat,
//           as: "Boat",
//           attributes: ["id", "capacity", "boat_name"],
//         },
//         {
//           model: Transit,
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],
//           include: [
//             {
//               model: Destination,
//               as: "Destination",
//               attributes: ["id", "name"],
//             },
//           ],
//         },
//       ],
//       attributes: [
//         "id",
//         "route_image",
//         "low_season_price",
//         "high_season_price",
//         "peak_season_price",
//         "departure_time",
//         "check_in_time",
//         "arrival_time",
//         "journey_time",
//       ],
//     });

//     // Fetch SubSchedules
//     const subSchedules = await SubSchedule.findAll({
//       where: {
//         availability: true,
//         [Op.and]: [
//           {
//             [Op.or]: [
//               { destination_from_schedule_id: from },
//               { "$TransitFrom.destination_id$": from },
//             ],
//           },
//           {
//             [Op.or]: [
//               { destination_to_schedule_id: to },
//               { "$TransitTo.destination_id$": to },
//             ],
//           },
//           {
//             validity_start: { [Op.lte]: selectedDate },
//             validity_end: { [Op.gte]: selectedDate },
//             [Op.and]: sequelize.literal(
//               `(SubSchedule.days_of_week & ${1 << selectedDayOfWeek}) != 0`
//             ),
//           },
//         ],
//         availability: true,
//       },
//       include: [
//         {
//           model: Destination,
//           as: "DestinationFrom",
//           attributes: ["id", "name", "port_map_url", "image_url"],
//         },
//         {
//           model: Destination,
//           as: "DestinationTo",
//           attributes: ["id", "name", "port_map_url", "image_url"],
//         },
//         {
//           model: Transit,
//           as: "TransitFrom",
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],
//           include: {
//             model: Destination,
//             as: "Destination",
//             attributes: ["id", "name", "port_map_url", "image_url"],
//           },
//         },
//         {
//           model: Transit,
//           as: "TransitTo",
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],

//           include: {
//             model: Destination,
//             as: "Destination",
//             attributes: ["id", "name", "port_map_url", "image_url"],
//           },
//         },
//         // Add transit_1, transit_2, transit_3, transit_4 associations
//         {
//           model: Transit,
//           as: "Transit1",
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],
//           include: {
//             model: Destination,
//             as: "Destination",
//             attributes: ["id", "name", "port_map_url", "image_url"],
//           },
//         },
//         {
//           model: Transit,
//           as: "Transit2",
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],
//           include: {
//             model: Destination,
//             as: "Destination",
//             attributes: ["id", "name", "port_map_url", "image_url"],
//           },
//         },
//         {
//           model: Transit,
//           as: "Transit3",
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],
//           include: {
//             model: Destination,
//             as: "Destination",
//             attributes: ["id", "name", "port_map_url", "image_url"],
//           },
//         },
//         {
//           model: Transit,
//           as: "Transit4",
//           attributes: [
//             "id",
//             "destination_id",
//             "departure_time",
//             "arrival_time",
//             "journey_time",
//             "check_in_time",
//           ],
//           include: {
//             model: Destination,
//             as: "Destination",
//             attributes: ["id", "name", "port_map_url", "image_url"],
//           },
//         },
//         {
//           model:SeatAvailability,
//           as: "SeatAvailabilities",
//         },
//         {
//           model: Schedule,
//           as: "Schedule",
//           attributes: [
//             "id",
//             "departure_time",
//             "check_in_time",
//             "arrival_time",
//             "journey_time",
//           ],
//           include: [
//             {
//               model: Boat,
//               as: "Boat",
//               // attributes: ["id", "capacity", "boat_name",],
//             },
//           ],
//         },
//       ],
//     });

//     // Check Seat Availability for Schedules
//     for (const schedule of schedules) {
//       let seatAvailability = await SeatAvailability.findOne({
//         where: {
//           schedule_id: schedule.id,
//           date: selectedDate,
//           // availability: 1,
//           // available_seats: { [Op.gte]: passengers_total },
//         },
//       });
//       // console.log("🧠seat availability MAIN",seatAvailability)

//       // Create SeatAvailability if not found
//       if (!seatAvailability) {
//         seatAvailability = await createSeatAvailability(
//           schedule,
//           null,
//           selectedDate
//         );
//       }

//       schedule.dataValues.seatAvailability = {
//         id: seatAvailability.id,
//         available_seats: seatAvailability.available_seats,
//         availability: seatAvailability.availability,
//         date: selectedDate,
//       };

//       // Debugging log for schedules
//       // console.log(
//       //   `Schedule ID: ${schedule.id}, Seat Availability:`,
//       //   schedule.dataValues.seatAvailability
//       // );
//     }

//     // Check Seat Availability for SubSchedules
//     for (const subSchedule of subSchedules) {
//       let seatAvailability = await SeatAvailability.findOne({
//         where: {
//           subschedule_id: subSchedule.id,
//           date: selectedDate,
//           // availability: true,
        
//         },
//       });
//       // console.log("🧠seat availability SUB",seatAvailability)
      

//       // Create SeatAvailability if not found
//       if (!seatAvailability) {
//         seatAvailability = await createSeatAvailability(
//           null,
//           subSchedule,
//           selectedDate
//         );
//       }

//       // Attach seatAvailability to subSchedule dataValues
//       subSchedule.dataValues.seatAvailability = {
//         id: seatAvailability.id,
//         available_seats: seatAvailability.available_seats,
//         availability: seatAvailability.availability,
//         date: selectedDate,
//       };

//       // Debugging log for subschedules
//       // console.log(
//       //   `SubSchedule ID: ${subSchedule.id}, Seat Availability:`,
//       //   subSchedule.dataValues.seatAvailability
//       // );
//     }
//     // const availableSchedules = schedules.filter(schedule => 
//     //   schedule.dataValues.seatAvailability && 
//     //   schedule.dataValues.seatAvailability.available_seats > 0 
//     //   &&
//     //   schedule.dataValues.seatAvailability.availability === true
//     // );

//     // prepare to match with the passenger total
//     const availableSchedules = schedules.filter(schedule => 
//       schedule.dataValues.seatAvailability && 
//       schedule.dataValues.seatAvailability.available_seats >= parseInt(passengers_total) 
//       &&
//       schedule.dataValues.seatAvailability.availability === true
//     );

//     // console.log(
//     //   "🫁Available Schedules Jancuk:",
//     //   availableSchedules.map((schedule) => ({
//     //     id: schedule.id,
//     //     seatAvailability: schedule.dataValues.seatAvailability,
//     //   }))
//     // );
    
//     // Filter subSchedules dengan available_seats > 0
//     // const availableSubSchedules = subSchedules.filter(subSchedule => 
//     //   subSchedule.dataValues.seatAvailability && 
//     //   subSchedule.dataValues.seatAvailability.available_seats > 0 
//     //   &&
//     //   subSchedule.dataValues.seatAvailability.availability === true
//     // );

//     // prepare to match with passenger total

//     const availableSubSchedules = subSchedules.filter(subSchedule => 
//       subSchedule.dataValues.seatAvailability && 
//       subSchedule.dataValues.seatAvailability.available_seats >= parseInt(passengers_total) 
//       &&
//       subSchedule.dataValues.seatAvailability.availability === true
//     );
//     // console.log("🫁Available SubSchedules:", JSON.stringify(availableSubSchedules.SeatAvailabilities, null, 2));
    

//     // Step 6: Return the combined results with SeatAvailability details
//     res.status(200).json({
//       status: "success",
//       data: {
//         schedules: formatSchedules(availableSchedules, selectedDate),
//         subSchedules: formatSubSchedules(availableSubSchedules, selectedDate),
//       },
//     });
//   } catch (error) {
//     console.error("Error searching schedules and subschedules:", error);
//     res.status(500).json({
//       status: "error",
//       message: error.message,
//     });
//   }
// };



const searchSchedulesAndSubSchedules = async (req, res) => {
  const { from, to, date, passengers_total } = req.query;

  try {
    const selectedDate = new Date(date);
    const selectedDayOfWeek = getDay(selectedDate);
    
    // Helper function to check if date is in July or August
    const isJulyOrAugust = (date) => {
      const month = date.getMonth(); // 0-based: 6 = July, 7 = August
      return month === 6 || month === 7;
    };

    // Helper function to adjust available seats for boat ID 1 in July/August
const adjustAvailableSeats = (originalSeats, boatId, date, boost) => {
  if (boatId === 1 && isJulyOrAugust(date) && boost !== true) {
    const adjusted = Math.max(0, originalSeats - 4);
    // console.log(`🚢 Boat ID 1 - July/August seat adjustment (boost: ${boost}): Original: ${originalSeats}, Adjusted: ${adjusted}`);
    return adjusted;
  }
  return originalSeats;
};
    const schedules = await Schedule.findAll({
      where: {
        destination_from_id: from,
        destination_to_id: to,
        availability: 1,
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
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model:SeatAvailability,
          as: "SeatAvailabilities",
        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "capacity", "boat_name"],
        },
        {
          model: Transit,
          attributes: [
            "id",
            "destination_id",
            "departure_time",
            "arrival_time",
            "journey_time",
            "check_in_time",
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
        availability: true,
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
          attributes: [
            "id",
            "destination_id",
            "departure_time",
            "arrival_time",
            "journey_time",
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],

          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
          },
        },
        {
          model:SeatAvailability,
          as: "SeatAvailabilities",
        },
        {
          model: Schedule,
          as: "Schedule",
          attributes: [
            "id",
            "departure_time",
            "check_in_time",
            "arrival_time",
            "journey_time",
          ],
          include: [
            {
              model: Boat,
              as: "Boat",
              // attributes: ["id", "capacity", "boat_name",],
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
          // availability: 1,
          // available_seats: { [Op.gte]: passengers_total },
        },
      });
      // console.log("🧠seat availability MAIN",seatAvailability)

      // Create SeatAvailability if not found
      if (!seatAvailability) {
        seatAvailability = await createSeatAvailability(
          schedule,
          null,
          selectedDate
        );
      }

      // Apply boat ID 1 July/August reduction
   const adjustedAvailableSeats = adjustAvailableSeats(
  seatAvailability.available_seats,
  schedule.Boat?.id,
  selectedDate,
  seatAvailability.boost  // <- Parameter boost ditambahkan
);

      schedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: adjustedAvailableSeats,
        availability: seatAvailability.availability,
        date: selectedDate,
      };

      // Log untuk debugging kondisi khusus boat ID 1
      if (schedule.Boat?.id === 1 && isJulyOrAugust(selectedDate)) {
        console.log(
          `🚢 Boat ID 1 - July/August adjustment: Original seats: ${seatAvailability.available_seats}, Adjusted seats: ${adjustedAvailableSeats}`
        );
      }

      // Debugging log for schedules
      // console.log(
      //   `Schedule ID: ${schedule.id}, Seat Availability:`,
      //   schedule.dataValues.seatAvailability
      // );
    }

    // Check Seat Availability for SubSchedules
    for (const subSchedule of subSchedules) {
      let seatAvailability = await SeatAvailability.findOne({
        where: {
          subschedule_id: subSchedule.id,
          date: selectedDate,
          // availability: true,
        
        },
      });
      // console.log("🧠seat availability SUB",seatAvailability)
      

      // Create SeatAvailability if not found
      if (!seatAvailability) {
        seatAvailability = await createSeatAvailability(
          null,
          subSchedule,
          selectedDate
        );
      }

  // Untuk subSchedules
const adjustedAvailableSeats = adjustAvailableSeats(
  seatAvailability.available_seats,
  subSchedule.Schedule?.Boat?.id,
  selectedDate,
  seatAvailability.boost  // <- Parameter boost ditambahkan
);

      // Attach seatAvailability to subSchedule dataValues
      subSchedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: adjustedAvailableSeats,
        availability: seatAvailability.availability,
        date: selectedDate,
      };

      // Log untuk debugging kondisi khusus boat ID 1 pada SubSchedule
      if (subSchedule.Schedule?.Boat?.id === 1 && isJulyOrAugust(selectedDate)) {
        console.log(
          `🚢 SubSchedule Boat ID 1 - July/August adjustment: Original seats: ${seatAvailability.available_seats}, Adjusted seats: ${adjustedAvailableSeats}`
        );
      }

      // Debugging log for subschedules
      // console.log(
      //   `SubSchedule ID: ${subSchedule.id}, Seat Availability:`,
      //   subSchedule.dataValues.seatAvailability
      // );
    }

    // prepare to match with the passenger total
    const availableSchedules = schedules.filter(schedule => 
      schedule.dataValues.seatAvailability && 
      schedule.dataValues.seatAvailability.available_seats >= parseInt(passengers_total) 
      &&
      schedule.dataValues.seatAvailability.availability === true
    );

    // console.log(
    //   "🫁Available Schedules Jancuk:",
    //   availableSchedules.map((schedule) => ({
    //     id: schedule.id,
    //     seatAvailability: schedule.dataValues.seatAvailability,
    //   }))
    // );

    // prepare to match with passenger total
    const availableSubSchedules = subSchedules.filter(subSchedule => 
      subSchedule.dataValues.seatAvailability && 
      subSchedule.dataValues.seatAvailability.available_seats >= parseInt(passengers_total) 
      &&
      subSchedule.dataValues.seatAvailability.availability === true
    );
    // console.log("🫁Available SubSchedules:", JSON.stringify(availableSubSchedules.SeatAvailabilities, null, 2));
    

    // Step 6: Return the combined results with SeatAvailability details
    res.status(200).json({
      status: "success",
      data: {
        schedules: formatSchedules(availableSchedules, selectedDate),
        subSchedules: formatSubSchedules(availableSubSchedules, selectedDate),
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

const searchSchedulesAndSubSchedulesAgent = async (req, res) => {
  const { from, to, date, passengers_total } = req.query;

  try {
    const selectedDate = new Date(date);
    const selectedDayOfWeek = getDay(selectedDate);

    // Original schedules query remains the same
    const schedules = await Schedule.findAll({
      where: {
        destination_from_id: from,
        destination_to_id: to,
        availability: 1,
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
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model:SeatAvailability,
          as: "SeatAvailabilities",
        

        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "capacity", "boat_name"],
        },
        {
          model: Transit,
          attributes: [
            "id",
            "destination_id",
            "departure_time",
            "arrival_time",
            "journey_time",
            "check_in_time",
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

    // Original subSchedules query remains the same
    const subSchedules = await SubSchedule.findAll({
      where: {
        availability: true,
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
          attributes: ["id", "name", "port_map_url", "image_url"],
        },
        {
          model:SeatAvailability,
          as: "SeatAvailabilities",
        },
        {
          model: Destination,
          as: "DestinationTo",
          attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
          },
        },
        // Keep other transit includes
        {
          model: Transit,
          as: "Transit1",
          attributes: [
            "id",
            "destination_id",
            "departure_time",
            "arrival_time",
            "journey_time",
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
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
            "check_in_time",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name", "port_map_url", "image_url"],
          },
        },
        {
          model: Schedule,
          as: "Schedule",
          attributes: [
            "id",
            "departure_time",
            "check_in_time",
            "arrival_time",
            "journey_time",
          ],
          include: [
            {
              model: Boat,
              as: "Boat",
              attributes: ["id", "capacity", "boat_name"],
            },
          ],
        },
      ],
    });

    // Array untuk menyimpan semua ID SeatAvailability
    const seatAvailabilityIds = [];
    
    // Maps untuk memetakan SeatAvailability ID ke data terkait
    const seatAvailabilityData = new Map();

    // Process seat availability for schedules
    for (const schedule of schedules) {
      let seatAvailability = await SeatAvailability.findOne({
        where: {
          schedule_id: schedule.id,
          date: selectedDate,
          // availability: 1,
          // available_seats: { [Op.gte]: passengers_total },
        },
      });

      if (!seatAvailability) {
        seatAvailability = await createSeatAvailability(
          schedule,
          null,
          selectedDate
        );
      }

      // Simpan ID dan tambahkan ke schedule
      seatAvailabilityIds.push(seatAvailability.id);
      
      // Simpan data terkait untuk digunakan nanti
      seatAvailabilityData.set(seatAvailability.id, {
        boatData: schedule.Boat,
        boost: seatAvailability.boost,
        type: 'schedule'
      });

      schedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: seatAvailability.available_seats,
        date: selectedDate,
        availability:seatAvailability.availability
      };
    }

    // Process seat availability for subSchedules
    for (const subSchedule of subSchedules) {
      let seatAvailability = await SeatAvailability.findOne({
        where: {
          subschedule_id: subSchedule.id,
          date: selectedDate,
          // availability: true,
          // available_seats: { [Op.gte]: passengers_total },
        },
      });

      if (!seatAvailability) {
        seatAvailability = await createSeatAvailability(
          null,
          subSchedule,
          selectedDate
        );
      }

      // Simpan ID dan tambahkan ke subSchedule
      seatAvailabilityIds.push(seatAvailability.id);
      
      // Simpan data terkait untuk digunakan nanti
      seatAvailabilityData.set(seatAvailability.id, {
        boatData: subSchedule.Schedule?.Boat,
        boost: seatAvailability.boost,
        type: 'subSchedule'
      });

      subSchedule.dataValues.seatAvailability = {
        id: seatAvailability.id,
        available_seats: seatAvailability.available_seats,
        date: selectedDate,
        availability:seatAvailability.availability
      };
    }

    if (seatAvailabilityIds.length > 0) {
      // Inisialisasi objek untuk menyimpan nomor kursi berdasarkan seat_availability_id
      const bookedSeatsByAvailabilityId = {};
      const processedBookedSeatsByAvailabilityId = {};

      // Inisialisasi array kosong untuk setiap seat_availability_id
      seatAvailabilityIds.forEach((id) => {
        bookedSeatsByAvailabilityId[id] = [];
        processedBookedSeatsByAvailabilityId[id] = [];
      });

      try {
        // Query untuk mendapatkan booking dengan seat number
        const bookings = await Booking.findAll({
          attributes: ["id"],
          where: {
            payment_status: ["paid", "invoiced", "pending", "unpaid"],
          },
          include: [
            {
              model: SeatAvailability,
              as: "seatAvailabilities",
              required: true,
              where: {
                id: { [Op.in]: seatAvailabilityIds },
              },
              attributes: ["id"],
              through: { attributes: [] },
            },
            {
              model: Passenger,
              as: "passengers",
              attributes: ["id", "seat_number"],
              where: {
                seat_number: { [Op.ne]: null },
              },
            },
          ],
        });
        // console.log(
        //   "Bookings with seat numbers:",
        //   JSON.stringify(bookings, null, 2)
        // );

        // console.log(`Found ${bookings.length} bookings with seat numbers`);

        // Proses setiap booking untuk mengekstrak seat number
        bookings.forEach((booking) => {
          // Untuk setiap booking, lihat semua seat availability terkait
          booking.seatAvailabilities.forEach((seatAvail) => {
            // Untuk setiap seat availability, tambahkan seat number dari semua penumpang
            booking.passengers.forEach((passenger) => {
              if (passenger.seat_number) {
                // Pastikan array sudah diinisialisasi
                if (!bookedSeatsByAvailabilityId[seatAvail.id]) {
                  bookedSeatsByAvailabilityId[seatAvail.id] = [];
                }
                // Tambahkan seat number ke array
                bookedSeatsByAvailabilityId[seatAvail.id].push(
                  passenger.seat_number
                );
              }
            });
          });
        });

        // Log hasil untuk memastikan data telah diproses dengan benar
        // console.log(
        //   "Booked seats by availability ID before processing:",
        //   Object.fromEntries(
        //     Object.entries(bookedSeatsByAvailabilityId).map(([key, value]) => [
        //       key,
        //       `[${value.join(", ")}]`,
        //     ])
        //   )
        // );

        // Proses booked seats untuk mempertimbangkan kursi yang saling berhubungan
        for (const seatAvailId of seatAvailabilityIds) {
          const bookedSeats = bookedSeatsByAvailabilityId[seatAvailId] || [];
          const seatData = seatAvailabilityData.get(seatAvailId);
          
          if (seatData) {
            // Proses booked seats dengan fungsi processBookedSeats
            const processedSeats = processBookedSeats(
              new Set(bookedSeats),
              seatData.boost,
              seatData.boatData
            );
            
            // Simpan hasil pemrosesan
            processedBookedSeatsByAvailabilityId[seatAvailId] = processedSeats;
          } else {
            // Jika tidak ada data terkait, gunakan booked seats asli
            processedBookedSeatsByAvailabilityId[seatAvailId] = bookedSeats;
          }
        }

        // Log hasil pemrosesan
        // console.log(
        //   "Processed booked seats by availability ID:",
        //   Object.fromEntries(
        //     Object.entries(processedBookedSeatsByAvailabilityId).map(([key, value]) => [
        //       key,
        //       `[${value.join(", ")}]`,
        //     ])
        //   )
        // );

        // Tambahkan processedBookedSeatNumbers ke setiap schedule
        for (const schedule of schedules) {
          const seatAvailId = schedule.dataValues.seatAvailability.id;
          schedule.dataValues.seatAvailability.bookedSeatNumbers =
            processedBookedSeatsByAvailabilityId[seatAvailId] || [];
        }

        // Tambahkan processedBookedSeatNumbers ke setiap subSchedule
        for (const subSchedule of subSchedules) {
          const seatAvailId = subSchedule.dataValues.seatAvailability.id;
          subSchedule.dataValues.seatAvailability.bookedSeatNumbers =
            processedBookedSeatsByAvailabilityId[seatAvailId] || [];
        }

        const availableSchedules = schedules.filter(schedule => 
          schedule.dataValues.seatAvailability && 
          schedule.dataValues.seatAvailability.available_seats > 0 &&
          schedule.dataValues.seatAvailability.availability === true // <-- Tambahkan filter untuk availability
        );

        // console.log("🫁Available Schedules:", availableSchedules);
        
        
        // Filter subSchedules berdasarkan availability dan available_seats
        const availableSubSchedules = subSchedules.filter(subSchedule => 
          subSchedule.dataValues.seatAvailability && 
          subSchedule.dataValues.seatAvailability.available_seats > 0 &&
          subSchedule.dataValues.seatAvailability.availability === true // <-- Tambahkan filter untuk availability
        );
        // console.log("🫁Available Schedules:", availableSubSchedules);

        // Format schedules
        let formattedSchedules = formatSchedules(availableSchedules, selectedDate);

        // Tambahkan processedBookedSeatNumbers ke hasil yang sudah diformat
        formattedSchedules = formattedSchedules.map((formatted) => {
          // Cari schedule asli yang sesuai berdasarkan ID
          const originalSchedule = schedules.find((s) => s.id === formatted.id);
          if (
            originalSchedule &&
            originalSchedule.dataValues.seatAvailability
          ) {
            const seatAvailId = originalSchedule.dataValues.seatAvailability.id;
            // Modifikasi objek yang sudah diformat
            return {
              ...formatted,
              seatAvailability: {
                ...formatted.seatAvailability,
                bookedSeatNumbers:
                  processedBookedSeatsByAvailabilityId[seatAvailId] || [],
              },
            };
          }
          return formatted;
        });

        

        // Format subSchedules
        let formattedSubSchedules = formatSubSchedules(
          availableSubSchedules,
          selectedDate
        );

        // Tambahkan processedBookedSeatNumbers ke hasil yang sudah diformat
        formattedSubSchedules = formattedSubSchedules.map((formatted) => {
          // Cari subSchedule asli yang sesuai berdasarkan ID
          const originalSubSchedule = subSchedules.find(
            (s) => s.id === formatted.subschedule_id
          );
          if (
            originalSubSchedule &&
            originalSubSchedule.dataValues.seatAvailability
          ) {
            const seatAvailId =
              originalSubSchedule.dataValues.seatAvailability.id;
            // Modifikasi objek yang sudah diformat
            return {
              ...formatted,
              seatAvailability: {
                ...formatted.seatAvailability,
                bookedSeatNumbers:
                  processedBookedSeatsByAvailabilityId[seatAvailId] || [],
              },
            };
          }
          return formatted;
        });

        // Combine the results into a single array
        const combinedSchedules = [
          ...formattedSchedules,
          ...formattedSubSchedules,
        ];

        // Return the combined results
        res.status(200).json({
          status: "success",
          data: {
            schedules: combinedSchedules,
          },
        });

        // Jangan lanjutkan ke kode di bawah
        return;
      } catch (error) {
        console.error("Error fetching booked seats:", error.message);
        // Jika terjadi error, lanjutkan dengan kode format asli
      }
    }


    let availableSchedules, availableSubSchedules;

// Redefine if not already defined
if (!availableSchedules) {
  availableSchedules = schedules.filter(schedule => 
    schedule.dataValues.seatAvailability && 
    schedule.dataValues.seatAvailability.available_seats > 0 &&
    schedule.dataValues.seatAvailability.availability === 1
  );
}
// console.log("🫁Available Schedules:", availableSchedules);
if (!availableSubSchedules) {
  availableSubSchedules = subSchedules.filter(subSchedule => 
    subSchedule.dataValues.seatAvailability && 
    subSchedule.dataValues.seatAvailability.available_seats > 0 &&
    subSchedule.dataValues.seatAvailability.availability === true
  );
}


    

    // Kode asli, hanya dijalankan jika tidak ada seatAvailability atau terjadi error
    // Format schedules dan subSchedules
    const formattedSchedules = formatSchedules(availableSchedules, selectedDate);
    const formattedSubSchedules = formatSubSchedules(
      availableSubSchedules,
      selectedDate
    );

    // Combine the results into a single array
    const combinedSchedules = [...formattedSchedules, ...formattedSubSchedules];

    // Return the combined results
    res.status(200).json({
      status: "success",
      data: {
        schedules: combinedSchedules,
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

    // console.log("Received schedule data:", req.body);

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

      // console.log("Created schedule:", schedule);

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

          // console.log("Processing transit:", transit);

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

          // console.log("Created transit:", createdTransit);

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

          // console.log(
          //   "Transit with destination details:",
          //   transitWithDestination
          // );

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
    // Restart the server
    process.exit(1);
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
      attributes: ["id", "validity_start", "validity_end"],
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
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["id", "name"],
          },
        },
        {
          model: SubSchedule,
          as: "SubSchedules",
          attributes: ["id"],
          include: [
            { model: Destination, as: "DestinationFrom", attributes: ["name"] },
            { model: Destination, as: "DestinationTo", attributes: ["name"] },
            {
              model: Transit,
              as: "TransitFrom",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "TransitTo",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit1",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit2",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit3",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
            {
              model: Transit,
              as: "Transit4",
              include: {
                model: Destination,
                as: "Destination",
                attributes: ["name"],
              },
            },
          ],
        },
      ],
    });

    const response = [];

    schedules.forEach((schedule) => {
      // Main route: only from and to
      const route = [
        schedule.DestinationFrom?.name,
        schedule.DestinationTo?.name,
      ].filter(Boolean);

      response.push({
        schedule_id: schedule.id,
        subschedule_id: null,
        route,
        stops: schedule.Transits.length,
      });

      // SubSchedules: get first & last name only
      schedule.SubSchedules.forEach((sub) => {
        const orderedPoints = [
          sub.DestinationFrom?.name,
          sub.TransitFrom?.Destination?.name,
          sub.Transit1?.Destination?.name,
          sub.Transit2?.Destination?.name,
          sub.Transit3?.Destination?.name,
          sub.Transit4?.Destination?.name,
          sub.TransitTo?.Destination?.name,
          sub.DestinationTo?.name,
        ].filter(Boolean);

        const subRoute = [
          orderedPoints[0], // first
          orderedPoints[orderedPoints.length - 1], // last
        ].filter(Boolean);

        const subStops = [
          sub.TransitFrom,
          sub.Transit1,
          sub.Transit2,
          sub.Transit3,
          sub.Transit4,
          sub.TransitTo,
        ].filter(Boolean).length;

        response.push({
          schedule_id: schedule.id,
          subschedule_id: sub.id,
          route: subRoute,
          stops: subStops,
        });
      });
    });

    res.status(200).json(response);
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

    // console.log("DATA BODY YNG DITERMIMA`:", scheduleData);

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
      // console.log(JSON.stringify(schedule, null, 2));

      if (schedule.SubSchedules && schedule.SubSchedules.length > 0) {
        console.log("SubSchedules found:");
        schedule.SubSchedules.forEach((subSchedule, index) => {
          console.log(`SubSchedule ${index + 1}:`);
          // console.log(JSON.stringify(subSchedule, null, 2));
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

// controllers/scheduleController.js

// controllers/scheduleController.js

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
        } = row;;

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
  getAllSchedulesWithSubSchedules,
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
  getScheduleFormatted,
  getScheduleSubschedule,
  searchSchedulesAndSubSchedulesAgent,
  createSeatAvailability,
};

