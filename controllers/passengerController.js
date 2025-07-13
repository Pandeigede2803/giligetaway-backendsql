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
} = require("../models");;
const { Op, fn, col } = require("sequelize"); // Import fn and col from Sequelize
const { calculatePublicCapacity } = require("../util/getCapacityReduction");
const { sumTotalPassengers } = require("../util/sumTotalPassengers");
const { buildRoute, buildRouteFromSchedule } = require("../util/buildRoute");
const { getScheduleAndSubScheduleByDate } = require("../util/scheduleUtils");
const {
  fetchSeatAvailability,
  createSeatAvailability,
} = require("../util/seatAvailabilityUtils");
const { findRelatedSubSchedules } = require("../util/handleSubScheduleBooking");

const getSeatAvailabilityIncludes = require("../util/getSeatAvailabilityIncludes");
const { processBookedSeats, processBookedSeatsWithDuplicates } = require("../util/seatUtils");
const { add } = require("../queue/bookingQueue");
const { all } = require("../routes/passenger");
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
  // console.log(
  //   `📅 Filtering days in month ${month}-${year} for days of week:`,
  //   daysOfWeek
  // );
  const daysInMonth = getDaysInMonth(month, year); // Existing utility function
  // console.log(`📅 All days in month ${month}-${year}:`, daysInMonth);

  const filteredDays = daysInMonth.filter((date) => {
    const dayOfWeek = new Date(date).getDay(); // Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    const isMatch = daysOfWeek.includes(dayOfWeek);
    // console.log(
    //   `📅 Date: ${date}, Day of Week: ${dayOfWeek}, Match: ${isMatch}`
    // );
    return isMatch;
  });

  console.log(`📅 Filtered days in month ${month}-${year}:`, filteredDays);
  return filteredDays;
};

const getFullMonthRange = (year, month) => {
  // Konversi month ke angka dan pastikan dua digit
  const monthPadded = month.toString().padStart(2, "0");
  // Bulan di JavaScript dimulai dari 0, jadi untuk mendapatkan hari terakhir, buat tanggal ke bulan berikutnya dan ambil tanggal 0
  const lastDay = new Date(year, month, 0).getDate(); // Jika month = 2, maka lastDay = 28 (untuk tahun 2025)
  const startFullDate = `${year}-${monthPadded}-01`;
  const endFullDate = `${year}-${monthPadded}-${lastDay
    .toString()
    .padStart(2, "0")}`;
  return { startFullDate, endFullDate };
};

// Contoh penggunaan:
const { startFullDate, endFullDate } = getFullMonthRange(2025, 2);
// console.log("Full month range:", startFullDate, endFullDate); // Output: 2025-02-01 2025-02-28



const getPassengerCountBySchedule = async (req, res) => {
  // Extract query parameters
  const { month, year, schedule_id } = req.query;
  if (!month || !year) {
    console.log("Missing required parameters");
    return res.status(400).json({
      success: false,
      message: "Please provide month and year in the query parameters.",
    });
  }

  try {
    // Konversi schedule_id (jika ada) ke number
    const scheduleId = schedule_id ? Number(schedule_id) : null;

    // Fetch schedule untuk mendapatkan days_of_week (jika schedule_id diberikan)
    const scheduleData = scheduleId
      ? await Schedule.findOne({
          where: { id: scheduleId },
          attributes: ["days_of_week"],
        })
      : null;

    // Fungsi decode bitmap untuk hari dalam seminggu
    const decodeDaysOfWeekBitmap = (bitmap) => {
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        if ((bitmap & (1 << i)) !== 0) {
          daysOfWeek.push(i); // 0 = Minggu, ..., 6 = Sabtu
        }
      }
      return daysOfWeek;
    };

    // Jika scheduleData tidak ada, default ke semua hari
    const scheduleDaysOfWeek = scheduleData
      ? decodeDaysOfWeekBitmap(scheduleData.days_of_week)
      : [0, 1, 2, 3, 4, 5, 6];

    // Ambil daftar tanggal dalam bulan (dengan filter hari sesuai scheduleDaysOfWeek)
    const daysInMonth = getDaysInMonthWithDaysOfWeek(
      month,
      year,
      scheduleDaysOfWeek
    );
    // Ambil rentang tanggal penuh (pastikan endFullDate valid, misalnya '2025-02-28' untuk Februari 2025)
    const { startFullDate, endFullDate } = getFullMonthRange(year, month);
    console.log("📅 Full month range:", startFullDate, endFullDate);

    // Fetch semua SeatAvailability untuk rentang tanggal dan (jika ada) filter schedule_id
    const seatAvailabilities = await SeatAvailability.findAll({
      attributes: [
        "id",
        "date",
        "schedule_id",
        "available_seats",
        "subschedule_id",
        "boost",
        "availability",
      ],
      where: {
        date: {
          [Op.between]: [startFullDate, endFullDate],
        },
        ...(scheduleId && { schedule_id: scheduleId }),
      },
      include: getSeatAvailabilityIncludes(),
    });

  
    seatAvailabilities.forEach((sa) => {
      // console.log(
      //   `SeatAvailability ID: ${sa.id}, Date: ${sa.date}, Available Seats: ${sa.available_seats}`
      // );
    });

    // Kelompokkan seat availabilities berdasarkan tanggal untuk lookup cepat
    const seatAvailabilitiesByDate = seatAvailabilities.reduce((acc, sa) => {
      acc[sa.date] = acc[sa.date] || [];
      acc[sa.date].push(sa);
      return acc;
    }, {});

    // --- Optimasi: Ambil semua Schedule dan SubSchedule yang valid untuk rentang bulan ---
    // Kita ambil schedule yang valid selama rentang bulan
    const schedulesForMonth = await Schedule.findAll({
      where: {
        validity_start: { [Op.lte]: endFullDate },
        validity_end: { [Op.gte]: startFullDate },
        ...(scheduleId && { id: scheduleId }),
      },
      include: [
        {
          model: Destination,
          as: "FromDestination",
          attributes: ["name"],
        },
        {
          model: Destination,
          as: "ToDestination",
          attributes: ["name"],
        },
        {
          model: Transit,
          as: "Transits",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
        {
          model: Boat,
          as: "Boat",
          // attributes: ["id", "boat_name", "capacity"],
        },
      ],
    });

    // Ambil semua SubSchedule yang valid untuk rentang bulan
    const subSchedulesForMonth = await SubSchedule.findAll({
      where: {
        validity_start: { [Op.lte]: endFullDate },
        validity_end: { [Op.gte]: startFullDate },
        ...(scheduleId && { schedule_id: scheduleId }),
      },
      include: [
        {
          model: Schedule,
          as: "Schedule",
          include: [
            {
              model: Boat,
              as: "Boat",
              attributes: ["capacity"],
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
          model: Transit,
          as: "TransitFrom",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
        {
          model: Transit,
          as: "TransitTo",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
        {
          model: Transit,
          as: "Transit1",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
        {
          model: Transit,
          as: "Transit2",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
        {
          model: Transit,
          as: "Transit3",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
        {
          model: Transit,
          as: "Transit4",
          include: [
            { model: Destination, as: "Destination", attributes: ["name"] },
          ],
        },
      ],
    });

    // Buat lookup object untuk SubSchedule berdasarkan schedule_id
    const subSchedulesByScheduleId = subSchedulesForMonth.reduce((acc, ss) => {
      if (!acc[ss.schedule_id]) {
        acc[ss.schedule_id] = [];
      }
      acc[ss.schedule_id].push(ss);
      return acc;
    }, {});

    // --- Proses tiap tanggal (dari daysInMonth) ---
    const finalResults = [];
    for (const date of daysInMonth) {
      // Ubah string date ke objek Date untuk perbandingan
      const dateObj = new Date(date);

      // Filter schedule yang valid pada tanggal ini:
      const validSchedules = schedulesForMonth.filter((sch) => {
        const validityStart = new Date(sch.validity_start);
        const validityEnd = new Date(sch.validity_end);
        return validityStart <= dateObj && validityEnd >= dateObj;
      });

      // Ambil seat availabilities untuk tanggal ini (jika ada)
      const seatAvailabilityForDate = seatAvailabilitiesByDate[date] || [];

      // Proses tiap schedule yang valid
      validSchedules.forEach((schedule) => {

        
        // Cari seat availability utama (tanpa subschedule) untuk schedule ini
        const mainAvailability = seatAvailabilityForDate.find(
          (sa) => sa.schedule_id === schedule.id && !sa.subschedule_id
        );

        const totalPassengers = mainAvailability
          ? sumTotalPassengers(mainAvailability.BookingSeatAvailabilities)
          : 0;

        const capacity =
          mainAvailability?.boost && schedule.Boat
            ? schedule.Boat.capacity
            : schedule.Boat
            ? schedule.Boat.published_capacity
            : 0;

        const remainingSeats = capacity - totalPassengers;

        // Bangun route untuk schedule utama
        const route = buildRouteFromSchedule(schedule, null);

        // Proses subschedule untuk schedule ini (ambil dari lookup object)
        const relevantSubSchedules =
          subSchedulesByScheduleId[schedule.id] || [];
        const subschedules = relevantSubSchedules.map((subSchedule) => {
          // Cari seat availability untuk subschedule
          const subAvailability = seatAvailabilityForDate.find(
            (sa) =>
              sa.schedule_id === schedule.id &&
              sa.subschedule_id === subSchedule.id
          );

          // console.log("====subAvailability====", JSON.stringify(subAvailability, null, 2));


          // Ambil subschedule_id dari seatAvailability yang sedang diperiksa
          const subScheduleId = subAvailability?.subschedule_id || "nothing";

         

          // Filter Booking yang benar-benar cocok dengan subschedule_id
          const realPassengersBookings =
            subAvailability?.BookingSeatAvailabilities?.filter((bsa) => {
              return (
                bsa?.Booking && bsa.Booking.subschedule_id === subScheduleId
              );
            }) || [];

         
       
          // Hitung total real passengers dari booking yang cocok
          const totalRealPassengers =
            realPassengersBookings.length > 0
              ? realPassengersBookings.reduce((sum, bsa) => {
                  return sum + (bsa.Booking?.total_passengers || 0);
                }, 0)
              : 0;

     

          const subTotalPassengers = subAvailability
            ? sumTotalPassengers(subAvailability.BookingSeatAvailabilities)
            : 0;
          const subCapacity = subAvailability
            ? subAvailability.available_seats + subTotalPassengers
            : schedule.Boat
            ? schedule.Boat.published_capacity
            : 0;
          const subRemainingSeats = subCapacity - subTotalPassengers;

          return {
            seatavailability_id: subAvailability ? subAvailability.id : null,
            date,
            availability: subAvailability?.availability ,
            schedule_id: schedule.id,
            subschedule_id: subSchedule.id,
            boost: subAvailability?.boost || false,
            total_passengers: subTotalPassengers,
            capacity: subCapacity,
            total_real_passengers:totalRealPassengers,

            remainingSeats: subRemainingSeats,
            route: buildRouteFromSchedule(schedule, subSchedule),
          };
        });

        finalResults.push({
          seatavailability_id: mainAvailability ? mainAvailability.id : null,
          date,
          schedule_id: schedule.id,
          subschedule_id: null,
          route,
          availability: mainAvailability?.availability ,
          boost: mainAvailability?.boost || false,
          capacity,
          remainingSeats,
          total_passengers: totalPassengers,

          departure_time: schedule.departure_time,
          arrival_time: schedule.arrival_time,
          journey_time: schedule.journey_time,
          subschedules,
        });
      });
    }

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

const getPassengerCountByBookingDateAndSchedule = async (req, res) => {
  const { booking_date, schedule_id } = req.query;

  if (!booking_date || !schedule_id) {
    return res.status(400).json({
      success: false,
      message: "Please provide booking_date and schedule_id.",
    });
  }

  try {
    const date = booking_date;

    // Fetch Schedule with associations
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      include: [
        { model: Boat, as: "Boat" },
        { model: Destination, as: "FromDestination", attributes: ["name"] },
        { model: Destination, as: "ToDestination", attributes: ["name"] },
        {
          model: Transit,
          as: "Transits",
          include: [{ model: Destination, as: "Destination", attributes: ["name"] }],
        },
      ],
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found." });
    }

    // Fetch SubSchedules for this schedule and date
    const subSchedules = await SubSchedule.findAll({
      where: {
        schedule_id,
        validity_start: { [Op.lte]: date },
        validity_end: { [Op.gte]: date },
      },
      include: [
        { model: Destination, as: "DestinationFrom", attributes: ["name"] },
        { model: Destination, as: "DestinationTo", attributes: ["name"] },
        {
          model: Schedule,
          as: "Schedule",
          include: [{ model: Boat, as: "Boat", attributes: ["capacity", "published_capacity"] }],
        },
      ],
    });

    // Fetch SeatAvailabilities for the date, schedule_id, and subschedules
    const seatAvailabilities = await SeatAvailability.findAll({
      where: {
        date,
        schedule_id,
      },
      include: [
        {
          model: BookingSeatAvailability,
          as: "BookingSeatAvailabilities",
          include: [{ model: Booking, attributes: ["subschedule_id", "total_passengers"] }],
        },
      ],
    });

    const seatAvailabilitiesBySubschedule = seatAvailabilities.reduce((acc, sa) => {
      acc[sa.subschedule_id || 'main'] = sa;
      return acc;
    }, {});

    const mainAvailability = seatAvailabilitiesBySubschedule['main'];

    const totalPassengersMain = mainAvailability
      ? mainAvailability.BookingSeatAvailabilities.reduce(
          (sum, bsa) => sum + (bsa.Booking.total_passengers || 0),
          0
        )
      : 0;

    const capacityMain = mainAvailability?.boost
      ? schedule.Boat.capacity
      : schedule.Boat.published_capacity;

    const remainingSeatsMain = capacityMain - totalPassengersMain;

    const subschedulesResult = subSchedules.map((sub) => {
      const sa = seatAvailabilitiesBySubschedule[sub.id];

      const totalPassengersSub = sa
        ? sa.BookingSeatAvailabilities.reduce(
            (sum, bsa) =>
              bsa.Booking.subschedule_id === sub.id
                ? sum + (bsa.Booking.total_passengers || 0)
                : sum,
            0
          )
        : 0;

      const capacitySub = sa
        ? sa.available_seats + totalPassengersSub
        : schedule.Boat.published_capacity;

      const remainingSeatsSub = capacitySub - totalPassengersSub;

      return {
        seatavailability_id: sa?.id || null,
        date,
        availability: sa?.availability,
        schedule_id,
        subschedule_id: sub.id,
        boost: sa?.boost || false,
        total_passengers: totalPassengersSub,
        capacity: capacitySub,
        remainingSeats: remainingSeatsSub,
        route: buildRouteFromSchedule(schedule, sub),
      };
    });

    const result = {
      seatavailability_id: mainAvailability?.id || null,
      date,
      schedule_id,
      subschedule_id: null,
      route: buildRouteFromSchedule(schedule, null),
      availability: mainAvailability?.availability,
      boost: mainAvailability?.boost || false,
      capacity: capacityMain,
      remainingSeats: remainingSeatsMain,
      total_passengers: totalPassengersMain,
      departure_time: schedule.departure_time,
      arrival_time: schedule.arrival_time,
      journey_time: schedule.journey_time,
      subschedules: subschedulesResult,
    };

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve passenger count.",
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
    // Periksa apakah kapal ada
    const boatExists = await Boat.findByPk(boat_id);
    if (!boatExists) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Dapatkan daftar tanggal dalam bulan tersebut dan rentang tanggal penuh
    const daysInMonth = getDaysInMonth(month, year); // Misal: ['2025-02-01', '2025-02-02', ...]
    const { startFullDate, endFullDate } = getFullMonthRange(year, month);
    console.log("📅 Full month range:", startFullDate, endFullDate);

    // Jalankan query secara paralel untuk seluruh bulan
    const [seatAvailabilities, schedules, subSchedules] = await Promise.all([
      // Ambil data SeatAvailability dalam rentang bulan
      SeatAvailability.findAll({
        attributes: [
          "id",
          "date",
          "schedule_id",
          "subschedule_id",
          "available_seats",
          "boost",
          "availability",
        ],
        where: {
          date: { [Op.between]: [startFullDate, endFullDate] },
        },
        include: [
          {
            model: Schedule,
            as: "Schedule",
            attributes: [
              "id",
              "boat_id",
              "validity_start",
              "validity_end",
              "departure_time",
              "arrival_time",
              "journey_time",
            ],
            where: { boat_id },
            include: [
              {
                model: Destination,
                as: "FromDestination",
                attributes: ["name"],
              },
              { model: Destination, as: "ToDestination", attributes: ["name"] },
            ],
          },
          {
            model: BookingSeatAvailability,
            as: "BookingSeatAvailabilities",
            attributes: ["id", "booking_id"],
            include: [
              {
                model: Booking,
                as: "Booking",
                attributes: ["total_passengers","schedule_id","subschedule_id"],
                where: { payment_status: ["paid", "invoiced", "pending", "unpaid","refund_50",'cancel_100_charge'] },
              },
            ],
          },
          {
            model: SubSchedule,
            as: "SubSchedule",
            attributes: ["id"],
          },
        ],
      }),
      // Ambil semua Schedule yang valid untuk rentang bulan dan boat_id
      Schedule.findAll({
        where: {
          validity_start: { [Op.lte]: endFullDate },
          validity_end: { [Op.gte]: startFullDate },
          boat_id: boat_id,
        },
        attributes: [
          "id",
          "validity_start",
          "validity_end",
          "departure_time",
          "arrival_time",
          "journey_time",
        ],
        include: [
          { model: Destination, as: "FromDestination", attributes: ["name"] },
          { model: Destination, as: "ToDestination", attributes: ["name"] },
          {
            model: Transit,
            as: "Transits",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Boat,
            as: "Boat",
            attributes: ["id", "boat_name", "capacity"],
          },
        ],
      }),
      // Ambil semua SubSchedule yang valid untuk rentang bulan dan untuk schedule dari boat_id
      SubSchedule.findAll({
        where: {
          validity_start: { [Op.lte]: endFullDate },
          validity_end: { [Op.gte]: startFullDate },
        },
        attributes: ["id", "schedule_id"],
        include: [
          {
            model: Schedule,
            as: "Schedule",
            where: { boat_id },
            include: [{ model: Boat, as: "Boat", attributes: ["capacity"] }],
          },
          { model: Destination, as: "DestinationFrom", attributes: ["name"] },
          { model: Destination, as: "DestinationTo", attributes: ["name"] },
          {
            model: Transit,
            as: "TransitFrom",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Transit,
            as: "TransitTo",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Transit,
            as: "Transit1",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Transit,
            as: "Transit2",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Transit,
            as: "Transit3",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
          {
            model: Transit,
            as: "Transit4",
            include: [
              { model: Destination, as: "Destination", attributes: ["name"] },
            ],
          },
        ],
      }),
    ]);



    console.log("Seat Availabilities Fetched:", seatAvailabilities.length);

    // Buat lookup: Kelompokkan SeatAvailability berdasarkan tanggal
    const seatAvailabilitiesByDate = seatAvailabilities.reduce((acc, sa) => {
      acc[sa.date] = acc[sa.date] || [];
      acc[sa.date].push(sa);
      return acc;
    }, {});

    // Buat lookup untuk SubSchedule berdasarkan schedule_id
    const subschedulesByScheduleId = subSchedules.reduce((acc, ss) => {
      const sid = ss.schedule_id;
      if (!acc[sid]) acc[sid] = [];
      acc[sid].push(ss);
      return acc;
    }, {});

    // Proses setiap tanggal dalam bulan
    let finalResults = [];
    for (const date of daysInMonth) {
      if (seatAvailabilitiesByDate[date]) {
        // Jika ada data seat availability, gunakan data tersebut
        finalResults.push(
          ...seatAvailabilitiesByDate[date].map((sa) => {
            // console.log(JSON.stringify(sa.BookingSeatAvailabilities));
            const totalPassengers = sumTotalPassengers(
              sa.BookingSeatAvailabilities
            );

            // bookingSeatAvailability.Booking?.total_passengers
            // =====bookingSeatAvailabilities====== [
            //   {
            //     "id": 1320,
            //     "booking_id": 1444,
            //     "Booking": {
            //       "total_passengers": 3,
            //       "schedule_id": 63,
            //       "subschedule_id": null
            //     }
            //   },
            const realPassengers = sa.BookingSeatAvailabilities.filter(bsa =>
              bsa.Booking.schedule_id === sa.schedule_id &&
              bsa.Booking.subschedule_id === sa.subschedule_id
            );
        
            const totalRealPassengers = realPassengers.reduce((sum, bsa) => sum + (bsa.Booking.total_passengers || 0), 0);



            const route = buildRouteFromSchedule(sa.Schedule, sa.SubSchedule);
            return {
              seatavailability_id: sa.id,
              date: sa.date,
              schedule_id: sa.schedule_id,
              subschedule_id: sa.subschedule_id,
              total_passengers: totalRealPassengers,
              total_real_passengers: 0,
              route: route,
            };
          })
        );
      } else {
        // Jika tidak ada seat availability untuk tanggal itu, filter schedule yang valid pada tanggal tersebut
        const dateObj = new Date(date);
        const validSchedules = schedules.filter((sch) => {
          const validityStart = new Date(sch.validity_start);
          const validityEnd = new Date(sch.validity_end);
          return validityStart <= dateObj && validityEnd >= dateObj;
        });

        validSchedules.forEach((schedule) => {
          // Hasil default untuk schedule tanpa seat availability
          finalResults.push({
            seatavailability_id: null,
            date: date,
            schedule_id: schedule.id,
            subschedule_id: null,
            total_passengers: 0,
            route: buildRouteFromSchedule(schedule, null),
          });

          // Tambahkan data untuk setiap subschedule yang terkait (jika ada)
          const relevantSubs = subschedulesByScheduleId[schedule.id] || [];
          relevantSubs.forEach((subSchedule) => {
            finalResults.push({
              seatavailability_id: null,
              date: date,
              schedule_id: schedule.id,
              subschedule_id: subSchedule.id,
              total_passengers: 0,
              route: buildRouteFromSchedule(schedule, subSchedule),
            });
          });
        });
      }
    }

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
    const { booking_id, ...passengerData } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: "booking_id is required" });
    }

    const booking = await Booking.findByPk(booking_id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const selectedSubSchedule = booking.subschedule_id;
    let subSchedulesToProcess = [];

    if (selectedSubSchedule) {
      const selectedSS = await SubSchedule.findByPk(selectedSubSchedule);
      const related = await findRelatedSubSchedules(booking.schedule_id, selectedSS);
      subSchedulesToProcess = [selectedSS, ...related];
      console.log(`📦 Found ${related.length} related SubSchedules`);
    } else {
      subSchedulesToProcess = [null];
    }

    const affectedSeatAvailabilityIds = [];

    for (const ss of subSchedulesToProcess) {
      const subscheduleId = ss ? ss.id : null;

      let sa = await SeatAvailability.findOne({
        where: {
          schedule_id: booking.schedule_id,
          subschedule_id: subscheduleId,
          date: booking.booking_date
        }
      });

      if (!sa) {
        console.warn(`⚠️ No SeatAvailability found for subschedule_id=${subscheduleId} on ${booking.booking_date}`);
        continue;
      }

      const existingBSA = await BookingSeatAvailability.findOne({
        where: {
          booking_id: booking_id,
          seat_availability_id: sa.id
        }
      });

      if (!existingBSA) {
        await BookingSeatAvailability.create({
          booking_id: booking_id,
          seat_availability_id: sa.id
        });
        console.log(`✅ Linked Booking ID ${booking_id} to SeatAvailability ID ${sa.id}`);
      }

      affectedSeatAvailabilityIds.push(sa.id);
    }

    // === Buat Passenger ===
    const passenger = await Passenger.create({
      booking_id,
      ...passengerData
    });

    // === Kurangi available_seats jika tipe penumpang perlu kursi ===
    const seatTypesRequiringSeat = ['adult', 'child'];
    const passengerType = passenger.passenger_type || 'adult';

    if (seatTypesRequiringSeat.includes(passengerType)) {
      for (const saId of affectedSeatAvailabilityIds) {
        const sa = await SeatAvailability.findByPk(saId);

        if (sa && sa.available_seats > 0) {
          await sa.update({ available_seats: sa.available_seats - 1 });
          console.log(`🪑 Decreased seat on SA ${sa.id} -> now ${sa.available_seats - 1}`);
        } else {
          console.warn(`❌ Cannot reduce seats — SA ID ${saId} has no available seats`);
        }
      }
    }

    // === Update total_passengers di booking ===
    const passengerCount = await Passenger.count({ where: { booking_id } });
    if (passengerCount !== booking.total_passengers) {
      await booking.update({ total_passengers: passengerCount });
    }

    res.status(201).json({
      success: true,
      message: "Passenger created successfully",
      data: passenger
    });

  } catch (error) {
    console.error("Error creating passenger:", error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};


// const createPassenger = async (req, res) => {
//   try {
//     const { booking_id, ...passengerData } = req.body;
    
//     // Validasi booking_id
//     if (!booking_id) {
//       return res.status(400).json({ error: "booking_id is required" });
//     }
    
//     // Periksa apakah booking ada
//     const booking = await Booking.findByPk(booking_id, {
//       include: [
//         {
//           model: Schedule,
//           as: "Schedule",
//           required: true
//         }
//       ]
//     });
    
//     if (!booking) {
//       return res.status(404).json({ error: "Booking not found" });
//     }
    
//     // Cari SeatAvailability yang sesuai dengan booking
//     const seatAvailability = await SeatAvailability.findOne({
//       where: {
//         schedule_id: booking.schedule_id,
//         subschedule_id: booking.subschedule_id || null,
//         date: booking.booking_date
//       }
//     });
    
//     if (!seatAvailability) {
//       console.warn(`No SeatAvailability found for booking ${booking_id} with schedule ${booking.schedule_id}, subschedule ${booking.subschedule_id}, date ${booking.booking_date}`);
//       // Opsional: Buat SeatAvailability jika belum ada
//       // const newSeatAvailability = await SeatAvailability.create({...});
//     } else {
//       // Periksa apakah BookingSeatAvailability sudah ada
//       const existingBSA = await BookingSeatAvailability.findOne({
//         where: {
//           booking_id: booking_id,
//           seat_availability_id: seatAvailability.id
//         }
//       });
      
//       // Jika belum ada, buat BookingSeatAvailability baru
//       if (!existingBSA) {
//         await BookingSeatAvailability.create({
//           booking_id: booking_id,
//           seat_availability_id: seatAvailability.id
//         });
//         console.log(`Created BookingSeatAvailability for booking ${booking_id} and seat ${seatAvailability.id}`);
//       }
//     }
    
//     // Buat passenger
//     const passenger = await Passenger.create({
//       booking_id,
//       ...passengerData
//     });
    
//     // Update total_passengers di booking jika perlu
//     const passengerCount = await Passenger.count({ where: { booking_id } });
//     if (passengerCount !== booking.total_passengers) {
//       await booking.update({ total_passengers: passengerCount });
//     }
    
//     res.status(201).json({
//       success: true,
//       message: "Passenger created successfully",
//       data: passenger
//     });
//   } catch (error) {
//     console.error("Error creating passenger:", error);
//     res.status(400).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// };

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
  console.log("Starting updatePassenger function...");
  console.log("Request Params:", req.params);
  console.log("Request Body:", req.body);

  try {
    console.log("Fetching passenger with ID:", req.params.id);
    const passenger = await Passenger.findByPk(req.params.id);

    if (passenger) {
      console.log("Passenger found:", passenger);
      console.log("Updating passenger with data:", req.body);
      await passenger.update(req.body);
      console.log("Passenger updated successfully:", passenger);
      res.status(200).json(passenger);
    } else {
      console.log("Passenger not found with ID:", req.params.id);
      res.status(404).json({ error: "Passenger not found" });
    }
  } catch (error) {
    console.error("Error updating passenger:", error.message);
    res.status(400).json({ error: error.message });
  }
};

// const deletePassenger = async (req, res) => {
//   try {
//     const passenger = await Passenger.findByPk(req.params.id);
//     if (passenger) {
//       await passenger.destroy();
//       res.status(204).json();
//     } else {
//       res.status(404).json({ error: "Passenger not found" });
//     }
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// controllers/passengerController.js
const addPassenger = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { booking_id } = req.params;
    const passengerData = req.body;

    console.log("Adding passengers:", passengerData);
    console.log("😽Booking ID:", booking_id);
    
    // Validasi input
    if (!booking_id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }
    
    // Jika input adalah array, gunakan itu, jika tidak, buat array dengan satu item
    const passengersToAdd = Array.isArray(passengerData) ? passengerData : [passengerData];
    
    if (passengersToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No passenger data provided"
      });
    }
    
    // Cari booking untuk memastikan ada
    const booking = await Booking.findByPk(booking_id, { transaction });
    
    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }
    
    // Temukan semua SeatAvailability yang terkait dengan booking ini
    const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
      where: { booking_id },
      include: [{
        model: SeatAvailability,
        include: [{
          model: Schedule,
          include: [{
            model: Boat,
            as: "Boat"
          }]
        }]
      }],
      transaction
    });
    
    if (bookingSeatAvailabilities.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No seat availabilities found for this booking"
      });
    }
    
    // Hitung penumpang berdasarkan jenis untuk pembaruan booking
    let newAdultCount = 0;
    let newChildCount = 0;
    let newInfantCount = 0;
    
    passengersToAdd.forEach(passenger => {
      const passengerType = passenger.passenger_type || 'adult';
      
      if (passengerType === 'adult') {
        newAdultCount++;
      } else if (passengerType === 'child') {
        newChildCount++;
      } else if (passengerType === 'infant') {
        newInfantCount++;
      }
    });
    
    // Tidak perlu cek kapasitas kursi karena ini adalah penambahan missing passenger
    // Kursi sudah dialokasikan di proses booking awal
    
    // Buat penumpang baru
    const addedPassengers = [];
    for (const passengerItem of passengersToAdd) {
      const passengerWithType = {
        ...passengerItem,
        passenger_type: passengerItem.passenger_type || 'adult',
        booking_id
      };
      
      const passenger = await Passenger.create(passengerWithType, { transaction });
      addedPassengers.push(passenger);
    }
    
    // ❌ Tidak perlu kurangi seat lagi, hanya tampilkan kondisi sekarang
    const updatedSeatAvailabilities = bookingSeatAvailabilities.map(bsa => {
      return {
        seat_availability_id: bsa.SeatAvailability.id,
        available_seats: bsa.SeatAvailability.available_seats
      };
    });

    // PENTING: Update jumlah penumpang di model Booking (sementara di-comment karena akan dilakukan manual)
    /*
    const updatedBookingData = {
      adult_passengers: booking.adult_passengers + newAdultCount,
      child_passengers: booking.child_passengers + newChildCount,
      infant_passengers: booking.infant_passengers + newInfantCount,
      total_passengers: booking.total_passengers + newAdultCount + newChildCount 
    };

    await Booking.update(updatedBookingData, {
      where: { id: booking_id },
      transaction
    });
    */
    
    // Hitung jumlah penumpang berdasarkan tipe setelah penambahan
    const passengerCounts = await getPassengerCounts(booking_id, transaction);
    
    // Commit transaction jika semuanya berhasil
    await transaction.commit();
    
    return res.status(201).json({
      success: true,
      message: `${addedPassengers.length} passenger(s) added to booking successfully`,
      booking_id,
      added_passengers: addedPassengers,
      updated_seat_availabilities: updatedSeatAvailabilities,
      passenger_counts: passengerCounts
      // updated_booking: updatedBookingData
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding passengers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add passengers",
      error: error.message
    });
  }
};



// const addPassenger = async (req, res) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { booking_id } = req.params;
//     const passengerData = req.body;

//     console.log("Adding passengers:", passengerData);
//     console.log("😽Booking ID:", booking_id);
    
//     // Validasi input
//     if (!booking_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Booking ID is required"
//       });
//     }
    
//     // Jika input adalah array, gunakan itu, jika tidak, buat array dengan satu item
//     const passengersToAdd = Array.isArray(passengerData) ? passengerData : [passengerData];
    
//     if (passengersToAdd.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No passenger data provided"
//       });
//     }
    
//     // Cari booking untuk memastikan ada
//     const booking = await Booking.findByPk(booking_id, { transaction });
    
//     if (!booking) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found"
//       });
//     }
    
//     // Temukan semua SeatAvailability yang terkait dengan booking ini
//     const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
//       where: { booking_id },
//       include: [{
//         model: SeatAvailability,
//         include: [{
//           model: Schedule,
//           include: [{
//             model: Boat,
//             as: "Boat"
//           }]
//         }]
//       }],
//       transaction
//     });
    
//     if (bookingSeatAvailabilities.length === 0) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No seat availabilities found for this booking"
//       });
//     }
    
//     // Hitung penumpang berdasarkan jenis untuk pembaruan booking
//     let newAdultCount = 0;
//     let newChildCount = 0;
//     let newInfantCount = 0;
    
//     // Hitung jumlah penumpang yang akan menempati kursi (adult dan child)
//     let seatOccupyingPassengersCount = 0;
    
//     passengersToAdd.forEach(passenger => {
//       const passengerType = passenger.passenger_type || 'adult';
      
//       if (passengerType === 'adult') {
//         newAdultCount++;
//         seatOccupyingPassengersCount++;
//       } else if (passengerType === 'child') {
//         newChildCount++;
//         seatOccupyingPassengersCount++;
//       } else if (passengerType === 'infant') {
//         newInfantCount++;
//         // Infant biasanya tidak menempati kursi sendiri
//       }
//     });
    
//     // Verifikasi bahwa ada cukup kursi tersedia untuk semua penumpang yang membutuhkan kursi
//     for (const bsa of bookingSeatAvailabilities) {
//       const seatAvailability = bsa.SeatAvailability;
      
//       // Hitung kapasitas yang benar berdasarkan boost
//       const correctCapacity = seatAvailability.boost ? 
//         seatAvailability.Schedule.Boat.capacity : 
//         seatAvailability.Schedule.Boat.published_capacity;
      
//       // Verifikasi apakah masih cukup kursi tersedia - hanya untuk penumpang yang butuh kursi
//       if (seatAvailability.available_seats < seatOccupyingPassengersCount) {
//         await transaction.rollback();
//         return res.status(400).json({
//           success: false,
//           message: `Not enough available seats (${seatAvailability.available_seats}) for ${seatOccupyingPassengersCount} new passengers requiring seats`,
//           seat_availability_id: seatAvailability.id,
//           available_seats: seatAvailability.available_seats,
//           passengers_requiring_seats: seatOccupyingPassengersCount
//         });
//       }
//     }
    
//     // Buat penumpang baru
//     const addedPassengers = [];
//     for (const passengerItem of passengersToAdd) {
//       // Default passenger_type ke 'adult' jika tidak ditentukan
//       const passengerWithType = {
//         ...passengerItem,
//         passenger_type: passengerItem.passenger_type || 'adult',
//         booking_id
//       };
      
//       const passenger = await Passenger.create(passengerWithType, { transaction });
      
//       addedPassengers.push(passenger);
//     }
    
//     // Update available_seats di semua SeatAvailability terkait - hanya kurangi untuk penumpang yang butuh kursi
//     const updatePromises = bookingSeatAvailabilities.map(async (bsa) => {
//       const seatAvailability = bsa.SeatAvailability;
      
//       // Kurangi available_seats sesuai jumlah penumpang yang membutuhkan kursi
//       const newAvailableSeats = Math.max(0, seatAvailability.available_seats - seatOccupyingPassengersCount);
      
//       await SeatAvailability.update({ 
//         available_seats: newAvailableSeats 
//       }, { 
//         where: { id: seatAvailability.id },
//         transaction
//       });
      
//       return {
//         seat_availability_id: seatAvailability.id,
//         previous_available_seats: seatAvailability.available_seats,
//         new_available_seats: newAvailableSeats
//       };
//     });
    
//     const updatedSeatAvailabilities = await Promise.all(updatePromises);
    
//     // PENTING: Update jumlah penumpang di model Booking
// // PENTING: Update jumlah penumpang di model Booking (sementara di-comment karena akan dilakukan manual)
// /*
// const updatedBookingData = {
//   adult_passengers: booking.adult_passengers + newAdultCount,
//   child_passengers: booking.child_passengers + newChildCount,
//   infant_passengers: booking.infant_passengers + newInfantCount,
//   total_passengers: booking.total_passengers + newAdultCount + newChildCount 
// };

// await Booking.update(updatedBookingData, {
//   where: { id: booking_id },
//   transaction
// });
// */
    
//     // Hitung jumlah penumpang berdasarkan tipe setelah penambahan
//     const passengerCounts = await getPassengerCounts(booking_id, transaction);
    
//     // Commit transaction jika semuanya berhasil
//     await transaction.commit();
    
//     return res.status(201).json({
//       success: true,
//       message: `${addedPassengers.length} passenger(s) added to booking successfully`,
//       booking_id,
//       added_passengers: addedPassengers,
//       updated_seat_availabilities: updatedSeatAvailabilities,
//       passenger_counts: passengerCounts,
//       // updated_booking: updatedBookingData
//     });
    
//   } catch (error) {
//     // Rollback transaction jika terjadi error
//     await transaction.rollback();
    
//     console.error("Error adding passengers:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to add passengers",
//       error: error.message
//     });
//   }
// };

/**
 * Menghapus penumpang dari booking dan menyesuaikan available_seats
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
// const deletePassenger = async (req, res) => {
//   // Mulai transaction untuk memastikan atomic operation
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { booking_id } = req.params;
//     const { passenger_ids } = req.body;
    
//     console.log("Deleting passengers:", passenger_ids);
    
//     // Validasi input
//     if (!booking_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Booking ID is required"
//       });
//     }
    
//     if (!passenger_ids || !Array.isArray(passenger_ids) || passenger_ids.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Passenger IDs array is required"
//       });
//     }
    
//     // Cari booking untuk memastikan ada
//     const booking = await Booking.findByPk(booking_id, { transaction });
    
//     if (!booking) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found"
//       });
//     }
    
//     // Verifikasi bahwa penumpang yang akan dihapus terkait dengan booking ini
//     const passengers = await Passenger.findAll({
//       where: {
//         id: { [Op.in]: passenger_ids },
//         booking_id
//       },
//       transaction
//     });
    
//     if (passengers.length !== passenger_ids.length) {
//       await transaction.rollback();
//       return res.status(400).json({
//         success: false,
//         message: `Some passenger IDs are not associated with booking ${booking_id}`,
//         found_passengers: passengers.length,
//         requested_passengers: passenger_ids.length
//       });
//     }
    
//     // Temukan semua SeatAvailability yang terkait dengan booking ini
//     const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
//       where: { booking_id },
//       include: [{
//         model: SeatAvailability,
//         include: [{
//           model: Schedule,
//           include: [{
//             model: Boat,
//             as: "Boat"
//           }]
//         }]
//       }],
//       transaction
//     });
    
//     if (bookingSeatAvailabilities.length === 0) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No seat availabilities found for this booking"
//       });
//     }
    
//     // Hapus penumpang
//     await Passenger.destroy({
//       where: {
//         id: { [Op.in]: passenger_ids },
//         booking_id
//       },
//       transaction
//     });
    
//     // Update available_seats di semua SeatAvailability terkait
//     const updatePromises = bookingSeatAvailabilities.map(async (bsa) => {
//       const seatAvailability = bsa.SeatAvailability;
      
//       // Dapatkan kapasitas yang benar berdasarkan boost
//       const correctCapacity = seatAvailability.boost ? 
//         seatAvailability.Schedule.Boat.capacity : 
//         seatAvailability.Schedule.Boat.published_capacity;
      
//       // Tambahkan available_seats sesuai jumlah penumpang yang dihapus
//       // Pastikan tidak melebihi kapasitas maksimum
//       const newAvailableSeats = Math.min(
//         seatAvailability.available_seats + passengers.length,
//         correctCapacity
//       );
      
//       await SeatAvailability.update({ 
//         available_seats: newAvailableSeats 
//       }, { 
//         where: { id: seatAvailability.id },
//         transaction 
//       });
      
//       return {
//         seat_availability_id: seatAvailability.id,
//         previous_available_seats: seatAvailability.available_seats,
//         new_available_seats: newAvailableSeats,
//         max_capacity: correctCapacity
//       };
//     });
    
//     const updatedSeatAvailabilities = await Promise.all(updatePromises);
    
//     // Hitung jumlah penumpang berdasarkan tipe setelah penghapusan
//     const passengerCounts = await getPassengerCounts(booking_id, transaction);
    
//     // Commit transaction jika semuanya berhasil
//     await transaction.commit();
    
//     return res.status(200).json({
//       success: true,
//       message: `${passengers.length} passenger(s) deleted from booking successfully`,
//       booking_id,
//       deleted_passenger_count: passengers.length,
//       deleted_passenger_ids: passenger_ids,
//       updated_seat_availabilities: updatedSeatAvailabilities,
//       passenger_counts: passengerCounts
//     });
    
//   } catch (error) {
//     // Rollback transaction jika terjadi error
//     await transaction.rollback();
    
//     console.error("Error deleting passengers:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete passengers",
//       error: error.message
//     });
//   }
// };


const deletePassenger = async (req, res) => {
  // Mulai transaction untuk memastikan atomic operation
  const transaction = await sequelize.transaction();
  
  try {
    const { booking_id } = req.params;
    const { passenger_ids } = req.body;
    
    console.log("Deleting passengers:", passenger_ids);
    
    // Validasi input
    if (!booking_id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }
    
    if (!passenger_ids || !Array.isArray(passenger_ids) || passenger_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Passenger IDs array is required"
      });
    }
    
    // Cari booking untuk memastikan ada
    const booking = await Booking.findByPk(booking_id, { transaction });
    
    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }
    
    // Verifikasi bahwa penumpang yang akan dihapus terkait dengan booking ini
    // Tambahkan informasi passenger_type untuk menghitung jenis penumpang yang dihapus
    const passengers = await Passenger.findAll({
      where: {
        id: { [Op.in]: passenger_ids },
        booking_id
      },
      attributes: ['id', 'passenger_type', 'seat_number'],
      transaction
    });
    
    if (passengers.length !== passenger_ids.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Some passenger IDs are not associated with booking ${booking_id}`,
        found_passengers: passengers.length,
        requested_passengers: passenger_ids.length
      });
    }
    
    // Hitung jumlah tiap jenis penumpang yang akan dihapus
    let deletedAdultCount = 0;
    let deletedChildCount = 0;
    let deletedInfantCount = 0;
    
    // Hitung juga penumpang yang menempati kursi untuk pembaruan ketersediaan kursi
    let seatOccupyingPassengersCount = 0;
    
    passengers.forEach(passenger => {
      const passengerType = passenger.passenger_type || 'adult';
      
      if (passengerType === 'adult') {
        deletedAdultCount++;
        seatOccupyingPassengersCount++;
      } else if (passengerType === 'child') {
        deletedChildCount++;
        seatOccupyingPassengersCount++;
      } else if (passengerType === 'infant') {
        deletedInfantCount++;
        // Infant biasanya tidak menempati kursi sendiri
      }
    });
    
    // Temukan semua SeatAvailability yang terkait dengan booking ini
    const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
      where: { booking_id },
      include: [{
        model: SeatAvailability,
        include: [{
          model: Schedule,
          include: [{
            model: Boat,
            as: "Boat"
          }]
        }]
      }],
      transaction
    });
    
    if (bookingSeatAvailabilities.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No seat availabilities found for this booking"
      });
    }
    
    // Hapus penumpang
    await Passenger.destroy({
      where: {
        id: { [Op.in]: passenger_ids },
        booking_id
      },
      transaction
    });
    
    // Update available_seats di semua SeatAvailability terkait
    const updatePromises = bookingSeatAvailabilities.map(async (bsa) => {
      const seatAvailability = bsa.SeatAvailability;
      
      // Dapatkan kapasitas yang benar berdasarkan boost
      const correctCapacity = seatAvailability.boost ? 
        seatAvailability.Schedule.Boat.capacity : 
        seatAvailability.Schedule.Boat.published_capacity;
      
      // Tambahkan available_seats sesuai jumlah penumpang yang menempati kursi yang dihapus
      // Pastikan tidak melebihi kapasitas maksimum
      const newAvailableSeats = Math.min(
        seatAvailability.available_seats + seatOccupyingPassengersCount,
        correctCapacity
      );
      
      await SeatAvailability.update({ 
        available_seats: newAvailableSeats 
      }, { 
        where: { id: seatAvailability.id },
        transaction 
      });
      
      return {
        seat_availability_id: seatAvailability.id,
        previous_available_seats: seatAvailability.available_seats,
        new_available_seats: newAvailableSeats,
        seat_occupying_passengers_removed: seatOccupyingPassengersCount,
        max_capacity: correctCapacity
      };
    });
    
    const updatedSeatAvailabilities = await Promise.all(updatePromises);
    
    // PENTING: Update jumlah penumpang di model Booking
    // Pastikan jumlah tidak kurang dari 0
    const updatedBookingData = {
      adult_passengers: Math.max(0, booking.adult_passengers - deletedAdultCount),
      child_passengers: Math.max(0, booking.child_passengers - deletedChildCount),
      infant_passengers: Math.max(0, booking.infant_passengers - deletedInfantCount),
      total_passengers: Math.max(0, booking.total_passengers - (deletedAdultCount + deletedChildCount))
    };
    
    await Booking.update(updatedBookingData, {
      where: { id: booking_id },
      transaction
    });
    
    // Hitung jumlah penumpang berdasarkan tipe setelah penghapusan
    const passengerCounts = await getPassengerCounts(booking_id, transaction);
    
    // Commit transaction jika semuanya berhasil
    await transaction.commit();
    
    return res.status(200).json({
      success: true,
      message: `${passengers.length} passenger(s) deleted from booking successfully`,
      booking_id,
      deleted_passenger_count: passengers.length,
      deleted_passenger_ids: passenger_ids,
      deleted_passenger_types: {
        adult: deletedAdultCount,
        child: deletedChildCount,
        infant: deletedInfantCount,
        total: deletedAdultCount + deletedChildCount + deletedInfantCount
      },
      updated_seat_availabilities: updatedSeatAvailabilities,
      passenger_counts: passengerCounts,
      updated_booking: updatedBookingData
    });
    
  } catch (error) {
    // Rollback transaction jika terjadi error
    await transaction.rollback();
    
    console.error("Error deleting passengers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete passengers",
      error: error.message
    });
  }
};
/**
 * Menghitung jumlah penumpang berdasarkan tipe
 * @param {number} bookingId - ID booking
 * @param {Transaction} transaction - Sequelize transaction
 * @returns {Promise<object>} - Jumlah penumpang berdasarkan tipe
 */
const getPassengerCounts = async (bookingId, transaction) => {
  // Dapatkan semua penumpang untuk booking ini
  const passengers = await Passenger.findAll({
    where: { booking_id: bookingId },
    transaction
  });
  
  // Hitung jumlah berdasarkan tipe
  let adultCount = 0;
  let childCount = 0;
  let infantCount = 0;
  
  passengers.forEach(passenger => {
    const passengerType = passenger.passenger_type || 'adult'; // Default ke 'adult' jika tidak ada
    
    if (passengerType.toLowerCase() === 'adult') {
      adultCount++;
    } else if (passengerType.toLowerCase() === 'child') {
      childCount++;
    } else if (passengerType.toLowerCase() === 'infant') {
      infantCount++;
    } else {
      // Untuk tipe yang tidak dikenal, masukkan ke adult
      adultCount++;
    }
  });
  
  return {
    total_passengers: passengers.length,
    adult_passengers: adultCount,
    child_passengers: childCount,
    infant_passengers: infantCount
  };
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
              where: { payment_status: ["paid", "unpaid", "invoiced"] },
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
const updateBookingPassengers = async (req, res) => {
  const { booking_id } = req.params;
  const passengersToUpdate = req.body.passengers; // array of passenger data

  console.log("Step 1: Received request to update booking passengers.");
  console.log("Booking ID:", booking_id);
  console.log("Passengers to update:", passengersToUpdate);

  try {
    // 1. Ambil data Booking
    console.log("Step 2: Fetching booking data.");
    const booking = await Booking.findByPk(booking_id, {
      include: [{ model: Passenger, as: "passengers" }],
    });

    if (!booking) {
      console.log("Step 3: Booking not found.");
      return res.status(404).json({ message: "Booking not found." });
    }

    console.log("Step 3: Booking found:", booking);
    const currentPassengerCount = booking.passengers.length;
    const newPassengerCount = passengersToUpdate.length;

    // 2. Validasi: Tidak boleh melebihi total_passengers
    console.log("Step 4: Validating passenger count.");
    if (currentPassengerCount + newPassengerCount > booking.total_passengers) {
      console.log(
        `Validation failed: Cannot add ${newPassengerCount} passengers. Only ${
          booking.total_passengers - currentPassengerCount
        } seat(s) left.`
      );
      return res.status(400).json({
        message: `Cannot add ${newPassengerCount} passengers. Only ${
          booking.total_passengers - currentPassengerCount
        } seat(s) left.`,
      });
    }

    console.log("Step 5: Validation passed. Proceeding to add passengers.");

    // 3. Tambahkan passenger baru
    console.log("Step 6: Creating new passengers.");
    const createdPassengers = await Promise.all(
      passengersToUpdate.map((data) =>
        Passenger.create({
          ...data,
          booking_id: booking.id,
        })
      )
    );

    console.log("Step 7: Passengers created successfully:", createdPassengers);

    return res.status(200).json({
      message: "Passengers added successfully.",
      data: createdPassengers,
    });
  } catch (error) {
    console.error("Error updating passengers:", error);
    res.status(500).json({ message: "Failed to update passengers." });
  }
};



const getPassengersSeatNumber = async (req, res) => {
  const { date, schedule_id, sub_schedule_id } = req.query;
  // console.log("Query Params:", { date, schedule_id, sub_schedule_id });

  try {
    // Check SeatAvailability for skenario 1
    let seatAvailability = await fetchSeatAvailability({
      date,
      schedule_id,
      sub_schedule_id,
    });
    // console.log(
    //   `SeatAvailability found for ${date}, Schedule ID: ${schedule_id}, SubSchedule ID: ${sub_schedule_id}:`,
    //   JSON.stringify(seatAvailability, null, 2)
    // );

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
            payment_status: ["paid", "invoiced", "pending","unpaid"],
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
          ],
        },
      ],
    });

    // query boat information from req query schedule-id
    console.log(`Fetching schedule with ID: ${schedule_id}`);
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

    // Extract boat details
    const boatData = schedule?.Boat || null; // Ensure Boat data exists
    // console.log("===boatdata===", boatData);

    // Prepare response data
    const bookedSeats = passengers.map((p) => p.seat_number).filter(Boolean);
    // console.log("===bookedseat===", bookedSeats);
    // Filter and add push some booked seats
    // Create utils IF the Seat number with A1&A2 is throw = R1&R2 too
    // Create utils IF the Seat number with X1,X2,X3&X4 is Exist trhow R1 R2 R3,R4
    const processedBookedSeats = processBookedSeats(
      new Set(bookedSeats),
      seatAvailability.boost,
      boatData
    );

    console.log("🦁===processedbookedseat=== FINAL", processedBookedSeats);

    const totalSeats = seatAvailability.available_seats || 0;
    // console.log("===totalseat===", totalSeats);

    // Custom response
    const response = {
      status: "success",
      message: "Seat information retrieved successfully.",
      alreadyBooked: processedBookedSeats,
      totalSeats: totalSeats,
      boatDetails: schedule.Boat,
      availableSeatCount: totalSeats - bookedSeats.length,
      bookedSeatCount: bookedSeats.length,
      seatAvailability: seatAvailability,
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

const assignSeatAvailabilityToBooking = async (bookingId) => {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw new Error("Booking not found");

  const scheduleId = booking.schedule_id;
  const subScheduleId = booking.sub_schedule_id || null;
  const date = booking.booking_date;

  console.log("📋 Booking info:", { bookingId, scheduleId, subScheduleId, date });

  // 1. Cek apakah seat availability sudah ada
  let seatAvailability = await SeatAvailability.findOne({
    where: {
      schedule_id: scheduleId,
      subschedule_id: subScheduleId,
      date,
    },
  });

  // 2. Kalau belum ada, buat baru
  if (!seatAvailability) {
    console.log("🆕 Creating new seat availability...");

    const schedule = await Schedule.findByPk(scheduleId, {
      include: [{ model: Boat, as: "Boat" }],
    });

    if (!schedule || !schedule.Boat) {
      throw new Error("Schedule or Boat not found.");
    }

    const boat = schedule.Boat;

    // Gunakan published_capacity jika boost false
    const availableSeats = boat.published_capacity || boat.capacity;

    seatAvailability = await SeatAvailability.create({
      schedule_id: scheduleId,
      subschedule_id: subScheduleId,
      available_seats: availableSeats,
      date,
      boost: false, // default false saat create
    });

    console.log("✅ SeatAvailability created with ID:", seatAvailability.id);
  } else {
    console.log("🔁 Found existing seat availability ID:", seatAvailability.id);
  }

  // 3. Link ke Booking melalui BookingSeatAvailability
  const [link, created] = await BookingSeatAvailability.findOrCreate({
    where: {
      booking_id: bookingId,
      seat_availability_id: seatAvailability.id,
    },
  });

  console.log(`🔗 Seat availability ${created ? "linked" : "already linked"} to booking ${bookingId}`);
};


// 1
// const getPassengersSeatNumberByBookingId = async (req, res) => {
//   const { booking_id } = req.query;

//   if (!booking_id) {
//     console.log("❌ Missing booking_id in query.");
//     return res.status(400).json({ error: "Missing booking_id parameter." });
//   }

//   try {
//     let booking = await Booking.findByPk(booking_id, {
//       include: [
//         {
//           model: Passenger,
//           as: "passengers",
//           attributes: ["id", "name", "seat_number"],
//         },
//         {
//           model: Schedule,
//           as: "schedule",
//           include: [{ model: Boat, as: "Boat" }],
//         },
//         {
//           model: SeatAvailability,
//           as: "seatAvailabilities",
//           through: BookingSeatAvailability,
//         },
//       ],
//     });

//     if (!booking) {
//       return res.status(404).json({ error: "Booking not found." });
//     }

//     if (!booking.seatAvailabilities || booking.seatAvailabilities.length === 0) {
//       await assignSeatAvailabilityToBooking(booking_id);
//       booking = await Booking.findByPk(booking_id, {
//         include: [
//           {
//             model: Passenger,
//             as: "passengers",
//             attributes: ["id", "name", "seat_number"],
//           },
//           {
//             model: Schedule,
//             as: "schedule",
//             include: [{ model: Boat, as: "Boat" }],
//           },
//           {
//             model: SeatAvailability,
//             as: "seatAvailabilities",
//             through: BookingSeatAvailability,
//           },
//         ],
//       });
//       if (!booking.seatAvailabilities || booking.seatAvailabilities.length === 0) {
//         return res.status(404).json({ error: "Seat availability still missing after assignment." });
//       }
//     }

//     const seatAvailability = booking.seatAvailabilities[0];
//     const boat = booking.schedule?.Boat;

//     if (!boat) {
//       return res.status(404).json({ error: "Boat not found from schedule." });
//     }

//     const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
//       where: {
//         seat_availability_id: seatAvailability.id,
//       },
//       include: [
//         {
//           model: Booking,
//           where: {
//             payment_status: ["paid", "invoiced", "pending", "unpaid"],
//           },
//           include: [
//             {
//               model: Passenger,
//               as: "passengers",
//               attributes: ["id", "name", "seat_number"],
//             },
//           ],
//         },
//       ],
//     });

//     const allBookedSeats = [];
//     bookingSeatAvailabilities.forEach((bsa) => {
//       if (bsa.Booking && bsa.Booking.passengers) {
//         bsa.Booking.passengers.forEach((p) => {
//           if (p.seat_number) {
//             allBookedSeats.push(p.seat_number);
//           }
//         });
//       }
//     });

//     const currentBookingSeats = booking.passengers
//       .map((p) => p.seat_number)
//       .filter(Boolean);

//     const processedBookedSeats = processBookedSeats(
//       new Set(allBookedSeats),
//       seatAvailability.boost,
//       boat
//     );

//     return res.status(200).json({
//       status: "success",
//       message: "Seat information retrieved successfully.",
//       alreadyBooked: processedBookedSeats,
//       totalSeats: seatAvailability.available_seats,
//       bookedSeatCount: allBookedSeats.length,
//       availableSeatCount: seatAvailability.available_seats - allBookedSeats.length,
//       currentBookingSeats,
//       boatDetails: boat,
//       seatAvailability,
//     });
//   } catch (error) {
//     console.error("🔥 Error in getPassengersSeatNumberByBookingId:", error);
//     return res.status(500).json({
//       error: "Failed to retrieve seat information.",
//     });
//   }
// };


// 2
const getPassengersSeatNumberByBookingId = async (req, res) => {
  const { booking_id } = req.query;

  if (!booking_id) {
    console.log("❌ Missing booking_id in query.");
    return res.status(400).json({ error: "Missing booking_id parameter." });
  }

  try {
    let booking = await Booking.findByPk(booking_id, {
      include: [
        {
          model: Passenger,
          as: "passengers",
          attributes: ["id", "name", "seat_number"],
        },
        {
          model: Schedule,
          as: "schedule",
          include: [{ model: Boat, as: "Boat" }],
        },
        {
          model: SeatAvailability,
          as: "seatAvailabilities",
          through: BookingSeatAvailability,
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const boat = booking.schedule?.Boat;
    if (!boat) {
      return res.status(404).json({ error: "Boat not found from schedule." });
    }

    const { booking_date, schedule_id, subschedule_id } = booking;

    // Fetch or create seat availability
    let seatAvailability = await fetchSeatAvailability({
      date: booking_date,
      schedule_id,
      sub_schedule_id: subschedule_id,
    });

    if (!seatAvailability) {
      const result = await createSeatAvailability({
        schedule_id,
        date: booking_date,
        qty: 0,
      });
      seatAvailability = result.mainSeatAvailability;
    }

    // Get all passengers whose bookings share this seatAvailability
    const passengers = await Passenger.findAll({
      include: [
        {
          model: Booking,
          as: "booking",
          required: true,
          where: {
            payment_status: ["paid", "invoiced", "pending", "unpaid"],
          },
          include: [
            {
              model: SeatAvailability,
              as: "seatAvailabilities",
              required: true,
              where: {
                date: booking_date,
                schedule_id,
                ...(subschedule_id && { subschedule_id }),
              },
            },
          ],
        },
      ],
    });

    const bookedSeats = passengers.map((p) => p.seat_number).filter(Boolean);
    const currentBookingSeats = booking.passengers.map((p) => p.seat_number).filter(Boolean);

    const processedBookedSeats = processBookedSeatsWithDuplicates(
      bookedSeats,
      seatAvailability.boost,
      boat
    );

    return res.status(200).json({
      status: "success",
      message: "Seat information retrieved successfully.",
      alreadyBooked: processedBookedSeats,
      totalSeats: seatAvailability.available_seats,
      bookedSeatCount: bookedSeats.length,
      availableSeatCount: seatAvailability.available_seats - bookedSeats.length,
      currentBookingSeats,
      boatDetails: boat,
      seatAvailability,
    });
  } catch (error) {
    console.error("🔥 Error in getPassengersSeatNumberByBookingId:", error);
    return res.status(500).json({
      error: "Failed to retrieve seat information.",
    });
  }
};



// const getPassengersSeatNumberByBookingId = async (req, res) => {
//   const { booking_id } = req.query;

//   if (!booking_id) {
//     return res.status(400).json({ error: "Missing booking_id parameter." });
//   }

//   try {
//     // 1️⃣ Ambil Booking termasuk relasi Schedule & Boat
//     const booking = await Booking.findByPk(booking_id, {
//       include: [
//         {
//           model: Passenger,
//           as: "passengers",
//           attributes: ["id", "name", "seat_number"],
//         },
//         {
//           model: Schedule,
//           as: "schedule",
//           include: [{ model: Boat, as: "Boat" }],
//         },
//       ],
//     });;

//     if (!booking) {
//       return res.status(404).json({ error: "Booking not found." });
//     }

//     const { schedule_id, subschedule_id, booking_date } = booking;
//     const boat = booking.schedule?.Boat;

//     if (!boat) {
//       return res.status(404).json({ error: "Boat not found from schedule." });
//     }

//     // 2️⃣ Cek atau buat SeatAvailability
//     let seatAvailability = await fetchSeatAvailability({
//       date: booking_date,
//       schedule_id,
//       sub_schedule_id: subschedule_id,
//     });

//     if (!seatAvailability) {
//       return res.status(404).json({ error: "Seat availability not found." });;
//     }

//     // 3️⃣ Ambil seat_number dari Passenger
//     const bookedSeats = booking.passengers
//       .map((p) => p.seat_number)
//       .filter(Boolean); // Only defined seat numbers

//     const processedBookedSeats = processBookedSeats(
//       new Set(bookedSeats),
//       seatAvailability.boost,
//       boat
//     );

//     return res.status(200).json({
//       status: "success",
//       message: "Seat information retrieved successfully.",
//       alreadyBooked: processedBookedSeats,
//       totalSeats: seatAvailability.available_seats,
//       bookedSeatCount: bookedSeats.length,
//       availableSeatCount: seatAvailability.available_seats - bookedSeats.length,
//       boatDetails: boat,
//       seatAvailability,
//     });
//   } catch (error) {
//     console.error("Error in getPassengersSeatNumberByBookingId:", error);
//     return res.status(500).json({
//       error: "Failed to retrieve seat information.",
//     });
//   }
// };


module.exports = {
  createPassenger,
  addPassenger,
  getPassengerCountByDate,
  getPassengerCountByMonth,
  getPassengersByScheduleAndSubSchedule,
  getPassengerCountBySchedule,
  getPassengers,
  getPassengerById,
  updatePassenger,
  deletePassenger,
  getPassengersSeatNumber,
  updateBookingPassengers,
  getPassengersSeatNumberByBookingId,
  getPassengerCountByBookingDateAndSchedule
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

// const getPassengerCountByMonth = async (req, res) => {
//   const { month, year, boat_id } = req.query;

//   // Validasi input
//   if (!month || !year || !boat_id) {
//     return res.status(400).json({
//       success: false,
//       message: "Please provide month, year, and boat_id in the query parameters.",
//     });
//   }

//   try {
//     // Periksa apakah kapal ada
//     const boatExists = await Boat.findByPk(boat_id);
//     if (!boatExists) {
//       return res.status(200).json({ success: true, data: [] });
//     }

//     // Ambil daftar tanggal dalam bulan ini
//     const daysInMonth = getDaysInMonth(month, year); // Contoh: ['2025-02-01', '2025-02-02', ...]

//     // Dapatkan rentang tanggal penuh (pastikan endFullDate valid, misalnya '2025-02-28' untuk Februari 2025)
//     const { startFullDate, endFullDate } = getFullMonthRange(year, month);
//     console.log("📅 Full month range:", startFullDate, endFullDate);

//     // Query untuk mengambil SeatAvailability dalam rentang tanggal
//     const seatAvailabilities = await SeatAvailability.findAll({
//       attributes: ["id", "date", "schedule_id", "subschedule_id"],
//       where: {
//         date: {
//           [Op.between]: [startFullDate, endFullDate],
//         }
//       },
//       include: [
//         {
//           model: Schedule,
//           as: "Schedule",
//           attributes: ["id", "boat_id"],
//           // Filter schedule langsung di query berdasarkan boat_id
//           where: { boat_id },
//           include: [
//             { model: Destination, as: "FromDestination", attributes: ["name"] },
//             { model: Destination, as: "ToDestination", attributes: ["name"] },
//           ],
//         },
//         {
//           model: BookingSeatAvailability,
//           as: "BookingSeatAvailabilities",
//           attributes: ["id", "booking_id"],
//           include: [
//             {
//               model: Booking,
//               as: "Booking",
//               attributes: ["total_passengers"],
//               where: { payment_status: ["paid", "invoiced", "pending"] },
//             },
//           ],
//         },
//         {
//           model: SubSchedule,
//           as: "SubSchedule",
//           attributes: ["id"],
//         },
//       ],
//     });

//     console.log("Seat Availabilities Fetched:", seatAvailabilities.length);
//     seatAvailabilities.forEach((sa) =>
//       console.log(
//         `SeatAvailability ID: ${sa.id}, Date: ${sa.date}, Schedule ID: ${sa.schedule_id}`
//       )
//     );

//     // Kelompokkan seat availabilities berdasarkan tanggal untuk lookup yang cepat
//     let resultsByDate = {};
//     seatAvailabilities.forEach((sa) => {
//       const date = sa.date;
//       if (!resultsByDate[date]) {
//         resultsByDate[date] = [];
//       }
//       // Hitung total penumpang dari booking yang terkait
//       const totalPassengers = sumTotalPassengers(sa.BookingSeatAvailabilities);
//       // Bangun route dari Schedule dan SubSchedule (jika ada)
//       const route = buildRouteFromSchedule(sa.Schedule, sa.SubSchedule);
//       resultsByDate[date].push({
//         seatavailability_id: sa.id,
//         date: sa.date,
//         schedule_id: sa.schedule_id,
//         subschedule_id: sa.subschedule_id,
//         total_passengers: totalPassengers,
//         route: route,
//       });
//     });

//     // Persiapkan array hasil akhir
//     let finalResults = [];
//     for (const date of daysInMonth) {
//       if (resultsByDate[date]) {
//         // Jika untuk tanggal tersebut sudah ada SeatAvailability, masukkan langsung ke hasil
//         finalResults.push(...resultsByDate[date]);
//       } else {
//         // Jika tidak ada SeatAvailability, ambil data schedule dan subschedule untuk tanggal tersebut
//         console.log("No seat availability for date:", date, "- Fetching schedule and subschedule for boat:", boat_id);
//         const { schedules, subSchedules } = await getScheduleAndSubScheduleByDate(date, boat_id);

//         // Proses setiap schedule
//         schedules.forEach((schedule) => {
//           const route = buildRouteFromSchedule(schedule, null);
//           finalResults.push({
//             seatavailability_id: null,
//             date: date,
//             schedule_id: schedule.id,
//             subschedule_id: null,
//             total_passengers: 0,
//             route: route,
//           });

//           // Proses setiap subschedule yang terkait dengan schedule
//           subSchedules.forEach((subSchedule) => {
//             if (schedule.id === subSchedule.schedule_id) {
//               const route = buildRouteFromSchedule(schedule, subSchedule);
//               finalResults.push({
//                 seatavailability_id: null,
//                 date: date,
//                 schedule_id: schedule.id,
//                 subschedule_id: subSchedule.id,
//                 total_passengers: 0,
//                 route: route,
//               });
//             }
//           });
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       data: finalResults,
//     });
//   } catch (error) {
//     console.error("Error fetching passenger count by month:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve passenger count for the specified month.",
//     });
//   }
// };


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


// const getPassengerCountBySchedule = async (req, res) => {
//   // extract query
//   const { month, year, schedule_id } = req.query;

//   // validation
//   if (!month || !year) {
//     console.log("Missing required parameters");
//     return res.status(400).json({
//       success: false,
//       message: "Please provide month and year in the query parameters.",
//     });
//   }

//   try {
//     // Fetch days of week for the given schedule_id from the Schedule table
//     const schedule = await Schedule.findOne({
//       where: { id: schedule_id },
//       attributes: ["days_of_week"],
//     });

//     const decodeDaysOfWeekBitmap = (bitmap) => {
//       const daysOfWeek = [];
//       for (let i = 0; i < 7; i++) {
//         if ((bitmap & (1 << i)) !== 0) {
//           daysOfWeek.push(i); // Add day (0=Sunday, ..., 6=Saturday) if bit is active
//         }
//       }
//       return daysOfWeek;
//     };

//     const scheduleDaysOfWeek = schedule
//       ? decodeDaysOfWeekBitmap(schedule.days_of_week)
//       : [0, 1, 2, 3, 4, 5, 6]; // Default to all days if not found

//     const daysInMonth = getDaysInMonthWithDaysOfWeek(
//       month,
//       year,
//       scheduleDaysOfWeek
//     );
//     const startDate = `${year}-${month.padStart(2, "0")}-01`;
//     const endDate = `${year}-${month.padStart(2, "0")}-${daysInMonth.length}`;

//     // Gunakan fungsi getFullMonthRange agar range query sebulan penuh
//     const { startFullDate, endFullDate } = getFullMonthRange(year, month);
//     console.log("📅 Full month range:", startFullDate, endFullDate);

//     // Fetch seat availabilities within the date range and for the specified schedule_id
//     const seatAvailabilities = await SeatAvailability.findAll({
//       attributes: [
//         "id",
//         "date",
//         "schedule_id",
//         "available_seats",
//         "subschedule_id",
//         "boost",
//         "availability",
//       ],
//       where: {
//         date: {
//           [Op.between]: [startFullDate, endFullDate],
//         },
//         ...(schedule_id && { schedule_id }),
//       },
//       include: getSeatAvailabilityIncludes(),
//     });

//     console.log("Seat Availabilities Fetched:", seatAvailabilities.length);
//     seatAvailabilities.forEach((sa) =>
//       console.log(
//         `SeatAvailability ID: ${sa.id}, Date: ${sa.date}, Available Seats: ${sa.available_seats}`
//       )
//     );

//     // Group seat availabilities by date for quick lookup

//     const seatAvailabilitiesByDate = seatAvailabilities.reduce((acc, sa) => {
//       acc[sa.date] = acc[sa.date] || [];
//       acc[sa.date].push(sa);
//       return acc;
//     }, {});

//     // Prepare the final results array
//     const finalResults = [];
//     for (const date of daysInMonth) {
//       const seatAvailabilityForDate = seatAvailabilitiesByDate[date] || [];

//       // Fetch related schedules and subschedules for the given date

//       const { schedules, subSchedules } = await getScheduleAndSubScheduleByDate(
//         date
//       );

//       // process each schedules
//       schedules
//         .filter(
//           (schedule) => !schedule_id || schedule.id === parseInt(schedule_id)
//         )
//         // find main seat availabilites for the schedules
//         .forEach((schedule) => {
//           const mainAvailability = seatAvailabilityForDate.find(
//             (sa) => sa.schedule_id === schedule.id && !sa.subschedule_id
//           );

//           const totalPassengers = mainAvailability
//             ? sumTotalPassengers(mainAvailability.BookingSeatAvailabilities)
//             : 0;

//           const capacity = mainAvailability
//             ? mainAvailability.available_seats + totalPassengers // Use available_seats if SeatAvailability exists
//             : calculatePublicCapacity(schedule.dataValues.Boat) || 0; // Default to Boat capacity, or 0 if no Boat is associated

//           const remainingSeats = capacity - totalPassengers;

//           // build route
//           const route = buildRouteFromSchedule(schedule, null);

//           const relevantSubSchedules = subSchedules.filter(
//             (subSchedule) => subSchedule.schedule_id === schedule.id
//           );
//           // Filter subschedules related to the current schedule

//           const subschedules = relevantSubSchedules.map((subSchedule) => {
//             const subAvailability = seatAvailabilityForDate.find(
//               (sa) =>
//                 sa.schedule_id === schedule.id &&
//                 sa.subschedule_id === subSchedule.id
//             );
//             // Process each subschedule
//             const subTotalPassengers = subAvailability
//               ? sumTotalPassengers(subAvailability.BookingSeatAvailabilities)
//               : 0;

//             const subCapacity = subAvailability
//               ? subAvailability.available_seats + subTotalPassengers
//               : calculatePublicCapacity(schedule.dataValues.Boat); // Default capacity

//             // Calculate the total number of passengers
//             const subRemainingSeats = subCapacity - subTotalPassengers;

//             return {
//               seatavailability_id: subAvailability ? subAvailability.id : null,
//               date,
//               availability: subAvailability?.availability || true,
//               schedule_id: schedule.id,
//               subschedule_id: subSchedule.id,
//               boost: subAvailability?.boost || false,
//               total_passengers: subTotalPassengers,
//               capacity: subCapacity || 0,
//               remainingSeats: subRemainingSeats,
//               route: buildRouteFromSchedule(schedule, subSchedule),
//             };
//           });

//           // Add the processed schedule data to the final results
//           finalResults.push({
//             seatavailability_id: mainAvailability ? mainAvailability.id : null,
//             date,
//             schedule_id: schedule.id,
//             subschedule_id: null,
//             route,
//             availability: mainAvailability?.availability || true,
//             boost: mainAvailability?.boost || false,
//             capacity,
//             remainingSeats,
//             total_passengers: totalPassengers,
//             departure_time: schedule.dataValues.departure_time,
//             arrival_time: schedule.dataValues.arrival_time,
//             journey_time: schedule.dataValues.journey_time,
//             subschedules,
//           });
//         });
//     }

//     // Send the final results in the response
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

// const getPassengerCountByMonth = async (req, res) => {
//   const { month, year, boat_id } = req.query;

//   if (!month || !year || !boat_id) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "Please provide month, year, and boat_id in the query parameters.",
//     });
//   }

//   try {
//     // Check if the boat exists
//     const boatExists = await Boat.findByPk(boat_id);
//     if (!boatExists) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//       });
//     }

//     const daysInMonth = getDaysInMonth(month, year); // Returns an array of all dates in 'YYYY-MM-DD' format

//     // Fetch seat availability for the month, year, and boat_id
//     const seatAvailabilities = await SeatAvailability.findAll({
//       attributes: ["id", "date", "schedule_id", "subschedule_id"],
//       where: {
//         [Op.and]: [
//           sequelize.where(
//             sequelize.fn("MONTH", sequelize.col("SeatAvailability.date")),
//             month
//           ),
//           sequelize.where(
//             sequelize.fn("YEAR", sequelize.col("SeatAvailability.date")),
//             year
//           ),
//         ],
//       },
//       include: getSeatAvailabilityIncludes(),
//     });

//     // Filter seat availabilities by boat_id
//     const filteredSeatAvailabilities = seatAvailabilities.filter(
//       (sa) => sa.Schedule && sa.Schedule.boat_id == boat_id
//     );

//     const formattedResults = await Promise.all(
//       daysInMonth.map(async (date) => {
//         // Check if there's seat availability for the date
//         const seatAvailability = filteredSeatAvailabilities.find(
//           (sa) => sa.date === date
//         );

//         if (seatAvailability) {
//           const totalPassengers = sumTotalPassengers(
//             seatAvailability.BookingSeatAvailabilities
//           );
//           const route = buildRouteFromSchedule(
//             seatAvailability.Schedule,
//             seatAvailability.SubSchedule
//           );

//           return {
//             seatavailability_id: seatAvailability.id,
//             date: seatAvailability.date,
//             schedule_id: seatAvailability.schedule_id,
//             subschedule_id: seatAvailability.subschedule_id,
//             total_passengers: totalPassengers,
//             route: route,
//           };
//         } else {
//           // If no seat availability, fetch schedules and subschedules
//           const { schedules, subSchedules } =
//             await getScheduleAndSubScheduleByDate(date);
//           const filteredSchedules = schedules.filter(
//             (schedule) => schedule.boat_id == boat_id
//           );

//           let results = [];

//           filteredSchedules.forEach((schedule) => {
//             const route = buildRouteFromSchedule(schedule, null);
//             results.push({
//               seatavailability_id: null,
//               date: date,
//               schedule_id: schedule.id,
//               subschedule_id: null,
//               total_passengers: 0,
//               route: route,
//             });

//             subSchedules.forEach((subSchedule) => {
//               const relatedSchedule = filteredSchedules.find(
//                 (sch) => sch.id === subSchedule.schedule_id
//               );
//               if (relatedSchedule) {
//                 const route = buildRouteFromSchedule(
//                   relatedSchedule,
//                   subSchedule
//                 );
//                 results.push({
//                   seatavailability_id: null,
//                   date: date,
//                   schedule_id: relatedSchedule.id,
//                   subschedule_id: subSchedule.id,
//                   total_passengers: 0,
//                   route: route,
//                 });
//               }
//             });
//           });

//           return results;
//         }
//       })
//     );

//     // Flatten the array of results
//     const finalResults = formattedResults.flat();

//     return res.status(200).json({
//       success: true,
//       data: finalResults,
//     });
//   } catch (error) {
//     console.error("Error fetching passenger count by month:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve passenger count for the specified month.",
//     });
//   }
// };