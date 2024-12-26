const {
  sequelize,
  Booking,
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
const { Op, fn, col } = require("sequelize"); // Import fn and col from Sequelize
const { calculatePublicCapacity } = require("../util/getCapacityReduction");
const { sumTotalPassengers } = require("../util/sumTotalPassengers");
const { buildRoute, buildRouteFromSchedule } = require("../util/buildRoute");
const { getScheduleAndSubScheduleByDate } = require("../util/scheduleUtils");
const {
  fetchSeatAvailability,
  createSeatAvailability,
} = require("../util/seatAvailabilityUtils");

const getSeatAvailabilityIncludes = require("../util/getSeatAvailabilityIncludes");
// Fix date utility function
const getDaysInMonth = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate(); // Get number of days in the month
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const monthString = String(month).padStart(2, "0");
    const dayString = String(day).padStart(2, "0");
    return `${year}-${monthString}-${dayString}`; // Format date as 'YYYY-MM-DD'
  });
};

// Fungsi untuk memeriksa apakah hari dari sebuah date cocok dengan days_of_week bitmap
const isDayAvailable = (date, daysOfWeek) => {
  // Dapatkan hari dalam minggu (0 untuk Minggu, 1 untuk Senin, dst.)
  const dayOfWeek = new Date(date).getDay();

  // daysOfWeek adalah bitmap (misalnya, 0b0111110 untuk Senin-Jumat)
  // Periksa apakah hari tersebut tersedia berdasarkan bitmap
  return (daysOfWeek & (1 << dayOfWeek)) !== 0;
};

// for availabity seat transit

// const getPassengerCountBySchedule = async (req, res) => {
//   const { month, year, schedule_id } = req.query;

//   if (!month || !year) {
//     return res.status(400).json({
//       success: false,
//       message: "Please provide month and year in the query parameters.",
//     });
//   }

//   try {
//     const daysInMonth = getDaysInMonth(month, year);
//     const startDate = `${year}-${month.padStart(2, "0")}-01`;
//     const endDate = `${year}-${month.padStart(2, "0")}-${daysInMonth.length}`;

//     const seatAvailabilities = await SeatAvailability.findAll({
//       attributes: ["id", "date", "schedule_id", "subschedule_id"],
//       where: {
//         date: {
//           [Op.between]: [startDate, endDate],
//         },
//         ...(schedule_id && { schedule_id }), // Filter by schedule_id only if provided
//       },
//       include: getSeatAvailabilityIncludes(),
//     });

//     const seatAvailabilitiesByDate = seatAvailabilities.reduce((acc, sa) => {
//       acc[sa.date] = acc[sa.date] || [];
//       acc[sa.date].push(sa);
//       return acc;
//     }, {});

//     const finalResults = [];
//     for (const date of daysInMonth) {
//       const seatAvailabilityForDate = seatAvailabilitiesByDate[date] || [];

//       // Fetch schedules and sub-schedules for the date
//       const { schedules, subSchedules } = await getScheduleAndSubScheduleByDate(
//         date
//       );

//       schedules
//         .filter(
//           (schedule) => !schedule_id || schedule.id === parseInt(schedule_id)
//         ) // Ensure relevance to the queried schedule_id
//         .forEach((schedule) => {
//           const mainAvailability = seatAvailabilityForDate.find(
//             (sa) => sa.schedule_id === schedule.id && !sa.subschedule_id
//           );

//           const totalPassengers = mainAvailability
//             ? sumTotalPassengers(mainAvailability.BookingSeatAvailabilities)
//             : 0;

//           const route = buildRouteFromSchedule(schedule, null);

//           // Filter subschedules relevant to this schedule_id
//           const relevantSubSchedules = subSchedules.filter(
//             (subSchedule) => subSchedule.schedule_id === schedule.id
//           );

//           const subschedules = relevantSubSchedules.map((subSchedule) => {
//             const subAvailability = seatAvailabilityForDate.find(
//               (sa) =>
//                 sa.schedule_id === schedule.id &&
//                 sa.subschedule_id === subSchedule.id
//             );

//             return {
//               seatavailability_id: subAvailability ? subAvailability.id : null,
//               date,
//               schedule_id: schedule.id,
//               subschedule_id: subSchedule.id,
//               total_passengers: subAvailability
//                 ? sumTotalPassengers(subAvailability.BookingSeatAvailabilities)
//                 : 0,
//               route: buildRouteFromSchedule(schedule, subSchedule),
//             };
//           });

//           finalResults.push({
//             seatavailability_id: mainAvailability ? mainAvailability.id : null,
//             date,
//             schedule_id: schedule.id,
//             subschedule_id: null,
//             total_passengers: totalPassengers,
//             route,
//             subschedules,
//           });
//         });
//     }

//     return res.status(200).json({
//       success: true,
//       data: finalResults,
//     });
//   } catch (error) {
//     console.error("Error fetching passenger count by schedule:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve passenger count for the specified month.",
//     });
//   }
// };

// const getPassengerCountBySchedule = async (req, res) => {
//   const { month, year, schedule_id } = req.query;

//   if (!month || !year) {
//     return res.status(400).json({
//       success: false,
//       message: "Please provide month and year in the query parameters.",
//     });
//   }

//   try {
//     const daysInMonth = getDaysInMonth(month, year);
//     const startDate = `${year}-${month.padStart(2, "0")}-01`;
//     const endDate = `${year}-${month.padStart(2, "0")}-${daysInMonth.length}`;

//     const seatAvailabilities = await SeatAvailability.findAll({
//       attributes: ["id", "date", "schedule_id", "subschedule_id"],
//       where: {
//         date: {
//           [Op.between]: [startDate, endDate],
//         },
//         ...(schedule_id && { schedule_id }),
//       },
//       include: getSeatAvailabilityIncludes(),
//     });

//     const seatAvailabilitiesByDate = seatAvailabilities.reduce((acc, sa) => {
//       acc[sa.date] = acc[sa.date] || [];
//       acc[sa.date].push(sa);
//       return acc;
//     }, {});

//     const finalResults = [];
//     for (const date of daysInMonth) {
//       const seatAvailabilityForDate = seatAvailabilitiesByDate[date] || [];

//       const { schedules, subSchedules } = await getScheduleAndSubScheduleByDate(
//         date
//       );

//       schedules
//         .filter(
//           (schedule) => !schedule_id || schedule.id === parseInt(schedule_id)
//         )
//         .forEach((schedule) => {
//           const mainAvailability = seatAvailabilityForDate.find(
//             (sa) => sa.schedule_id === schedule.id && !sa.subschedule_id
//           );

//           const totalPassengers = mainAvailability
//             ? sumTotalPassengers(mainAvailability.BookingSeatAvailabilities)
//             : 0;

//           const route = buildRouteFromSchedule(schedule, null);

//           const relevantSubSchedules = subSchedules.filter(
//             (subSchedule) => subSchedule.schedule_id === schedule.id
//           );

//           const subschedules = relevantSubSchedules.map((subSchedule) => {
//             const subAvailability = seatAvailabilityForDate.find(
//               (sa) =>
//                 sa.schedule_id === schedule.id &&
//                 sa.subschedule_id === subSchedule.id
//             );

//             return {
//               seatavailability_id: subAvailability ? subAvailability.id : null,
//               date,
//               schedule_id: schedule.id,
//               subschedule_id: subSchedule.id,
//               // booking_ids: subBookingId, // Add booking IDs for subschedules
//               total_passengers: subAvailability
//                 ? sumTotalPassengers(subAvailability.BookingSeatAvailabilities)
//                 : 0,
//               capacity: schedule.dataValues.Boat?.capacity || 0,
//               route: buildRouteFromSchedule(schedule, subSchedule),
//             };
//           });

//           finalResults.push({
//             seatavailability_id: mainAvailability ? mainAvailability.id : null,
//             date,
//             schedule_id: schedule.id,
//             subschedule_id: null,
//             route,

//             capacity: schedule.dataValues.Boat?.capacity || 0,
//             // i need booking_id

//             total_passengers: totalPassengers,
//             departure_time: schedule.dataValues.departure_time, // Add departure_time
//             arrival_time: schedule.dataValues.arrival_time, // Add arrival_time
//             journey_time: schedule.dataValues.journey_time, // Add journey_timeroute,
//             subschedules,
//           });
//         });
//     }

//     return res.status(200).json({
//       success: true,
//       data: finalResults,
//     });
//   } catch (error) {
//     console.error("Error fetching passenger count by schedule:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve passenger count for the specified month.",
//     });
//   }
// };

const getDaysInMonthWithDaysOfWeek = (month, year, daysOfWeek) => {
  console.log(
    `📅 Filtering days in month ${month}-${year} for days of week:`,
    daysOfWeek
  );
  const daysInMonth = getDaysInMonth(month, year); // Existing utility function
  console.log(`📅 All days in month ${month}-${year}:`, daysInMonth);

  const filteredDays = daysInMonth.filter((date) => {
    const dayOfWeek = new Date(date).getDay(); // Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    const isMatch = daysOfWeek.includes(dayOfWeek);
    console.log(
      `📅 Date: ${date}, Day of Week: ${dayOfWeek}, Match: ${isMatch}`
    );
    return isMatch;
  });

  console.log(`📅 Filtered days in month ${month}-${year}:`, filteredDays);
  return filteredDays;
};

const getPassengerCountBySchedule = async (req, res) => {
  // extract query
  const { month, year, schedule_id } = req.query;
  console.log("Request Parameters:", { month, year, schedule_id });

  // validation
  if (!month || !year) {
    console.log("Missing required parameters");
    return res.status(400).json({
      success: false,
      message: "Please provide month and year in the query parameters.",
    });
  }

  try {
    // Fetch days of week for the given schedule_id from the Schedule table
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      attributes: ["days_of_week"],
    });

    const decodeDaysOfWeekBitmap = (bitmap) => {
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        if ((bitmap & (1 << i)) !== 0) {
          daysOfWeek.push(i); // Add day (0=Sunday, ..., 6=Saturday) if bit is active
        }
      }
      return daysOfWeek;
    };

    const scheduleDaysOfWeek = schedule
      ? decodeDaysOfWeekBitmap(schedule.days_of_week)
      : [0, 1, 2, 3, 4, 5, 6]; // Default to all days if not found

    const daysInMonth = getDaysInMonthWithDaysOfWeek(
      month,
      year,
      scheduleDaysOfWeek
    );
    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDate = `${year}-${month.padStart(2, "0")}-${daysInMonth.length}`;
    console.log("Date Range:", { startDate, endDate });

    // Fetch seat availabilities within the date range and for the specified schedule_id
    const seatAvailabilities = await SeatAvailability.findAll({
      attributes: [
        "id",
        "date",
        "schedule_id",
        "available_seats",
        "subschedule_id",
      ],
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        ...(schedule_id && { schedule_id }),
      },
      include: getSeatAvailabilityIncludes(),
    });

    console.log("Total seat availabilities found:", seatAvailabilities.length);

    // Group seat availabilities by date for quick lookup

    const seatAvailabilitiesByDate = seatAvailabilities.reduce((acc, sa) => {
      acc[sa.date] = acc[sa.date] || [];
      acc[sa.date].push(sa);
      return acc;
    }, {});

    // Prepare the final results array
    const finalResults = [];
    for (const date of daysInMonth) {
      const seatAvailabilityForDate = seatAvailabilitiesByDate[date] || [];
      console.log(
        `Processing date: ${date}, Found availabilities:`,
        seatAvailabilityForDate.length
      );

      // Fetch related schedules and subschedules for the given date

      const { schedules, subSchedules } = await getScheduleAndSubScheduleByDate(
        date
      );
      console.log(
        `Found schedules: ${schedules.length}, subSchedules: ${subSchedules.length}`
      );
      // process each schedules
      schedules
        .filter(
          (schedule) => !schedule_id || schedule.id === parseInt(schedule_id)
        )
        // find main seat availabilites for the schedules
        .forEach((schedule) => {
          const mainAvailability = seatAvailabilityForDate.find(
            (sa) => sa.schedule_id === schedule.id && !sa.subschedule_id
          );

          // Determine capacity from availability or use boat capacity as default

          const capacity = mainAvailability
            ? mainAvailability.available_seats // Use available_seats if SeatAvailability exists
            : calculatePublicCapacity(schedule.dataValues.Boat); // Default to Boat capacity

          console.log("Schedule details:", {
            scheduleId: schedule.id,
            capacity,
            availableSeats: mainAvailability
              ? mainAvailability.available_seats
              : "Not Found",
          });
          // Calculate the total number of passengers from booking seat availabilities

          const totalPassengers = mainAvailability
            ? sumTotalPassengers(mainAvailability.BookingSeatAvailabilities)
            : 0;
          const remainingSeats = capacity - totalPassengers;

          // build route
          const route = buildRouteFromSchedule(schedule, null);

          const relevantSubSchedules = subSchedules.filter(
            (subSchedule) => subSchedule.schedule_id === schedule.id
          );
          // Filter subschedules related to the current schedule

          const subschedules = relevantSubSchedules.map((subSchedule) => {
            const subAvailability = seatAvailabilityForDate.find(
              (sa) =>
                sa.schedule_id === schedule.id &&
                sa.subschedule_id === subSchedule.id
            );
            // Process each subschedule

            const subCapacity = subAvailability
              ? subAvailability.available_seats
              : calculatePublicCapacity(schedule.dataValues.Boat); // Default capacity

            const subTotalPassengers = subAvailability
              ? sumTotalPassengers(subAvailability.BookingSeatAvailabilities)
              : 0;
            // Calculate the total number of passengers
            const subRemainingSeats = subCapacity - subTotalPassengers;

            return {
              seatavailability_id: subAvailability ? subAvailability.id : null,
              date,
              schedule_id: schedule.id,
              subschedule_id: subSchedule.id,
              total_passengers: subTotalPassengers,
              capacity: subCapacity || 0,
              remainingSeats: subRemainingSeats,
              route: buildRouteFromSchedule(schedule, subSchedule),
            };
          });
          // Add the processed schedule data to the final results
          finalResults.push({
            seatavailability_id: mainAvailability ? mainAvailability.id : null,
            date,
            schedule_id: schedule.id,
            subschedule_id: null,
            route,
            capacity,
            remainingSeats,
            total_passengers: totalPassengers,
            departure_time: schedule.dataValues.departure_time,
            arrival_time: schedule.dataValues.arrival_time,
            journey_time: schedule.dataValues.journey_time,
            subschedules,
          });
        });
    }

    console.log("Final results count:", finalResults.length);
    // Send the final results in the response
    return res.status(200).json({
      success: true,
      data: finalResults,
    });
  } catch (error) {
    console.error("Error fetching passenger count by schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve passenger count for the specified month.",
    });
  }
};

const getPassengerCountByMonth = async (req, res) => {
  const { month, year, boat_id } = req.query;

  if (!month || !year || !boat_id) {
    return res.status(400).json({
      success: false,
      message:
        "Please provide month, year, and boat_id in the query parameters.",
    });
  }

  try {
    // Check if the boat exists
    const boatExists = await Boat.findByPk(boat_id);
    if (!boatExists) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const daysInMonth = getDaysInMonth(month, year); // Returns an array of all dates in 'YYYY-MM-DD' format

    // Fetch seat availability for the month, year, and boat_id
    const seatAvailabilities = await SeatAvailability.findAll({
      attributes: ["id", "date", "schedule_id", "subschedule_id"],
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.fn("MONTH", sequelize.col("SeatAvailability.date")),
            month
          ),
          sequelize.where(
            sequelize.fn("YEAR", sequelize.col("SeatAvailability.date")),
            year
          ),
        ],
      },
      include: getSeatAvailabilityIncludes(),
    });

    // Filter seat availabilities by boat_id
    const filteredSeatAvailabilities = seatAvailabilities.filter(
      (sa) => sa.Schedule && sa.Schedule.boat_id == boat_id
    );

    const formattedResults = await Promise.all(
      daysInMonth.map(async (date) => {
        // Check if there's seat availability for the date
        const seatAvailability = filteredSeatAvailabilities.find(
          (sa) => sa.date === date
        );

        if (seatAvailability) {
          const totalPassengers = sumTotalPassengers(
            seatAvailability.BookingSeatAvailabilities
          );
          const route = buildRouteFromSchedule(
            seatAvailability.Schedule,
            seatAvailability.SubSchedule
          );

          return {
            seatavailability_id: seatAvailability.id,
            date: seatAvailability.date,
            schedule_id: seatAvailability.schedule_id,
            subschedule_id: seatAvailability.subschedule_id,
            total_passengers: totalPassengers,
            route: route,
          };
        } else {
          // If no seat availability, fetch schedules and subschedules
          const { schedules, subSchedules } =
            await getScheduleAndSubScheduleByDate(date);
          const filteredSchedules = schedules.filter(
            (schedule) => schedule.boat_id == boat_id
          );

          let results = [];

          filteredSchedules.forEach((schedule) => {
            const route = buildRouteFromSchedule(schedule, null);
            results.push({
              seatavailability_id: null,
              date: date,
              schedule_id: schedule.id,
              subschedule_id: null,
              total_passengers: 0,
              route: route,
            });

            subSchedules.forEach((subSchedule) => {
              const relatedSchedule = filteredSchedules.find(
                (sch) => sch.id === subSchedule.schedule_id
              );
              if (relatedSchedule) {
                const route = buildRouteFromSchedule(
                  relatedSchedule,
                  subSchedule
                );
                results.push({
                  seatavailability_id: null,
                  date: date,
                  schedule_id: relatedSchedule.id,
                  subschedule_id: subSchedule.id,
                  total_passengers: 0,
                  route: route,
                });
              }
            });
          });

          return results;
        }
      })
    );

    // Flatten the array of results
    const finalResults = formattedResults.flat();

    return res.status(200).json({
      success: true,
      data: finalResults,
    });
  } catch (error) {
    console.error("Error fetching passenger count by month:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve passenger count for the specified month.",
    });
  }
};

const createPassenger = async (req, res) => {
  try {
    const passenger = await Passenger.create(req.body);
    res.status(201).json(passenger);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getPassengers = async (req, res) => {
  try {
    const passengers = await Passenger.findAll();
    res.status(200).json(passengers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getPassengerById = async (req, res) => {
  try {
    const passenger = await Passenger.findByPk(req.params.id);
    if (passenger) {
      res.status(200).json(passenger);
    } else {
      res.status(404).json({ error: "Passenger not found" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updatePassenger = async (req, res) => {
  try {
    const passenger = await Passenger.findByPk(req.params.id);
    if (passenger) {
      await passenger.update(req.body);
      res.status(200).json(passenger);
    } else {
      res.status(404).json({ error: "Passenger not found" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deletePassenger = async (req, res) => {
  try {
    const passenger = await Passenger.findByPk(req.params.id);
    if (passenger) {
      await passenger.destroy();
      res.status(204).json();
    } else {
      res.status(404).json({ error: "Passenger not found" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getPassengersByScheduleAndSubSchedule = async (req, res) => {
  console.log("getPassengersByScheduleAndSubSchedule: start");
  const { selectedDate } = req.query;

  try {
    // Step 1: Filter bookings based on the selected date
    console.log(
      "getPassengersByScheduleAndSubSchedule: filtering bookings by date"
    );
    const bookings = await Booking.findAll({
      where: {
        booking_date: selectedDate,
      },
      include: [
        {
          association: "passengers", // Include passengers associated with the bookings
          attributes: ["id", "name", "nationality", "passenger_type"],
        },
      ],
    });

    // Step 2: Split bookings into two categories
    console.log(
      "getPassengersByScheduleAndSubSchedule: splitting bookings by schedule and subschedule"
    );
    const scheduleOnlyBookings = bookings.filter(
      (booking) => booking.schedule_id && !booking.subschedule_id
    );
    const subScheduleBookings = bookings.filter(
      (booking) => booking.schedule_id && booking.subschedule_id
    );

    // Step 3: Respond with the split data
    console.log("getPassengersByScheduleAndSubSchedule: sending response");
    res.status(200).json({
      scheduleOnlyBookings,
      subScheduleBookings,
    });
  } catch (error) {
    console.log("getPassengersByScheduleAndSubSchedule: catch error");
    res.status(400).json({ error: error.message });
  }
};

// Controller to fetch total passengers by schedule/subschedule and date
const getPassengerCountByDate = async (req, res) => {
  const { date } = req.query; // Expect the date in query parameters

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Please provide a date in the query parameters.",
    });
  }

  try {
    const results = await SeatAvailability.findAll({
      attributes: [
        "date",
        "schedule_id",
        "sub_schedule_id",
        [
          Sequelize.fn("SUM", Sequelize.col("Bookings.total_passengers")),
          "total_passengers",
        ],
      ],
      include: [
        {
          model: BookingSeatAvailability,
          include: [
            {
              model: Bookings,
              where: { payment_status: "paid" },
              attributes: [],
            },
          ],
        },
      ],
      where: {
        date: date, // Filter by the specific date provided in the query
      },
      group: [
        "SeatAvailability.date",
        "SeatAvailability.schedule_id",
        "SeatAvailability.sub_schedule_id",
      ],
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching passenger count:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve passenger count",
    });
  }
};

// const getPassengersSeatNumber = async (req, res) => {
//   const { date, schedule_id, sub_schedule_id } = req.query;

//   try {
//       // Query to get passengers, bookings, seat availability, and boat capacity
//       const passengers = await Passenger.findAll({
//           include: [
//               {
//                   model: Booking,
//                   as: 'booking', // Alias sesuai asosiasi di Passenger.js
//                   required: true,
//                   where: {
//                       payment_status: ['paid', 'invoiced'], // Filter status pembayaran
//                   },
//                   include: [
//                       {
//                           model: SeatAvailability,
//                           as: 'seatAvailabilities', // Alias sesuai asosiasi di Booking.js
//                           required: true,
//                           include: [
//                               {
//                                   model: Schedule,
//                                   as: 'Schedule', // Assuming SeatAvailability is associated with Schedule
//                                   required: true,
//                                   include: [
//                                       {
//                                           model: Boat,
//                                           as: 'Boat', // Assuming Schedule is associated with Boat
//                                           required: true,
//                                       },
//                                   ],
//                                   where: {
//                                       ...(schedule_id && { id: schedule_id }), // Tambahkan jika schedule_id diberikan
//                                   },
//                               },
//                           ],
//                           where: {
//                               date, // Filter tanggal
//                               ...(sub_schedule_id && { subschedule_id: sub_schedule_id }), // Tambahkan jika sub_schedule_id diberikan
//                           },
//                       },
//                   ],
//               },
//           ],
//       });

//       // Extract boat capacity from the query result
//       const boatCapacity =
//           passengers[0]?.booking?.seatAvailabilities[0]?.Schedule?.Boat?.capacity || 0;

//       if (boatCapacity === 0) {
//           return res.status(404).json({ error: 'Boat capacity not found for the given schedule.' });
//       }

//       // Prepare seat information
//       const bookedSeats = [];
//       const availableSeats = [];

//       // Collect booked seats from passengers
//       passengers.forEach(passenger => {
//           if (passenger.seat_number) {
//               bookedSeats.push(passenger.seat_number);
//           }
//       });

//       // Calculate available seats
//       for (let i = 1; i <= boatCapacity; i++) {
//           const seatNumber = `A${i}`;
//           if (!bookedSeats.includes(seatNumber)) {
//               availableSeats.push(seatNumber);
//           }
//       }

//       // Custom response
//       const response = {
//           status: 'success',
//           message: 'Seat information retrieved successfully.',
//           alreadyBooked: bookedSeats,
//           availableSeats,
//           availableSeatCount: boatCapacity - bookedSeats.length,
//           bookedSeatCount: bookedSeats.length,
//       };

//       res.json(response);
//   } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Terjadi kesalahan server.' });
//   }
// };

const getPassengersSeatNumber = async (req, res) => {
  const { date, schedule_id, sub_schedule_id } = req.query;

  try {
    // Check SeatAvailability for skenario 1
    let seatAvailability = await fetchSeatAvailability({
      date,
      schedule_id,
      sub_schedule_id,
    });

    // If no SeatAvailability found, handle skenario 2
    if (!seatAvailability) {
      console.log("🚨 SeatAvailability not found, creating new...");
      const result = await createSeatAvailability({
        schedule_id,
        date,
        qty: 0, // Use default quantity
      });
      seatAvailability = result.mainSeatAvailability; // Use created seat availability
    }

    // Query Passengers with updated SeatAvailability data
    const passengers = await Passenger.findAll({
      include: [
        {
          model: Booking,
          as: "booking",
          required: true,
          where: {
            payment_status: ["paid", "invoiced"],
          },

          include: [
            {
              model: SeatAvailability,
              as: "seatAvailabilities",
              required: true,
              where: {
                date,
                schedule_id,
                ...(sub_schedule_id && { subschedule_id: sub_schedule_id }),
              },
            },

            // {
            //     model: Schedule,
            //     as: 'schedule',
            //     required: true,
            //     include: [
            //         {
            //             model: Boat,
            //             as: 'Boat',
            //             required: true,
            //         },
            //     ],
            //     where: {
            //         ...(schedule_id && { id: schedule_id }),
            //     },

            // }
          ],
        },
      ],
    });

    // query boat information from req query schedule-id
    console.log(`Fetching boat with ID: ${schedule_id}`);
    const schedule = await Schedule.findByPk(schedule_id, {
      attributes: ["id"],
      include: [
        {
          model: Boat,
          as: "Boat",
          required: true,
        },
      ],
    });




    // Prepare response data
    const bookedSeats = passengers.map((p) => p.seat_number).filter(Boolean);
    const totalSeats = seatAvailability.available_seats || 0;
    console.log("===totalseat===", totalSeats);
    const availableSeats = [];

    for (let i = 1; i <= totalSeats; i++) {
      const seatNumber = `A${i}`;
      if (!bookedSeats.includes(seatNumber)) {
        availableSeats.push(seatNumber);
      }
    }

    // Custom response
    const response = {
      status: "success",
      message: "Seat information retrieved successfully.",
      alreadyBooked: bookedSeats,
      availableSeats,
      boatDetails: schedule.Boat,
      availableSeatCount: totalSeats - bookedSeats.length,
      bookedSeatCount: bookedSeats.length,
      seatAvailability:seatAvailability,
    };

    res.json(response);
  } catch (error) {
    console.error(
      "❌ Error fetching passengers or creating seats:",
      error.message
    );
    res.status(500).json({ error: "Failed to process seat information." });
  }
};

module.exports = {
  createPassenger,
  getPassengerCountByDate,
  getPassengerCountByMonth,
  getPassengersByScheduleAndSubSchedule,
  getPassengerCountBySchedule,
  getPassengers,
  getPassengerById,
  updatePassenger,
  deletePassenger,
  getPassengersSeatNumber,
};

// const getPassengerCountByMonth = async (req, res) => {
//     const { month, year } = req.query;

//     if (!month || !year) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide both month and year in the query parameters.'
//       });
//     }

//     try {
//       const results = await SeatAvailability.findAll({
//         attributes: ['id', 'date', 'schedule_id', 'subschedule_id'], // Pastikan 'id' disertakan
//         include: getSeatAvailabilityIncludes(),
//         where: {
//           [Op.and]: [
//             sequelize.where(fn('MONTH', col('SeatAvailability.date')), month),
//             sequelize.where(fn('YEAR', col('SeatAvailability.date')), year)
//           ]
//         }
//       });

//       // Format the results
//       const formattedResults = results.map(seatAvailability => {
//         const totalPassengers = sumTotalPassengers(seatAvailability.BookingSeatAvailabilities);
//         const route = buildRoute(seatAvailability);

//         return {
//           seatavailability_id: seatAvailability.id, // Menggunakan 'seatavailability_id' alih-alih 'id'
//           date: seatAvailability.date,
//           schedule_id: seatAvailability.schedule_id,
//           subschedule_id: seatAvailability.subschedule_id,
//           total_passengers: totalPassengers,
//           route: route
//         };
//       });

//       return res.status(200).json({
//         success: true,
//         data: formattedResults
//       });
//     } catch (error) {
//       console.error('Error fetching passenger count by month:', error);
//       return res.status(500).json({
//         success: false,
//         message: 'Failed to retrieve passenger count for the specified month.'
//       });
//     }
//   };

// Controller untuk mendapatkan data penumpang berdasarkan bulan
