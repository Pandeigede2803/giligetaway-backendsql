const { sequelize, Booking, SeatAvailability, Destination, SubSchedule, Transport, Schedule, Passenger, Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../../models');

const { Op, fn, col } = require('sequelize');

// /**
//  * Utility function to get total passengers for a specific schedule and subschedule on a given date.
//  * @param {number} schedule_id - The ID of the schedule.
//  * @param {number|null} subschedule_id - The ID of the subschedule (can be null).
//  * @param {string} date - The date to check for bookings (in 'YYYY-MM-DD' format).
//  * @returns {Promise<number>} - The total number of passengers for the given schedule and date.
//  */

const getTotalPassengers = async (schedule_id, subschedule_id, date) => {
  console.log("query schedule", schedule_id, subschedule_id);
  try {
    // Ambil total jumlah penumpang berdasarkan SeatAvailability
    const seatAvailabilities = await SeatAvailability.findAll({
      where: {
        schedule_id,
        subschedule_id: subschedule_id || { [Op.is]: null },
        date,
      },
      attributes: [
        "id", // Ambil ID dari SeatAvailability
        [
          fn("COALESCE", fn("SUM", col("BookingSeatAvailabilities.Booking.total_passengers")), 0),
          "passengersSum"
        ]
      ],
      include: [
        {
          model: BookingSeatAvailability,
          as: 'BookingSeatAvailabilities',
          required: false,
          attributes: [],
          include: [
            {
              model: Booking,
              as: "Booking",
              where: {
                payment_status: ['paid', 'invoiced']
              },
              attributes: []
            }
          ]
        }
      ],
      group: ["SeatAvailability.id"],
    });

    // Ambil daftar Booking yang terkait dengan SeatAvailability
    const bookingDetails = await Booking.findAll({
      where: {
        schedule_id: schedule_id,
        subschedule_id: subschedule_id || { [Op.is]: null },
        booking_date: {
          [Op.eq]: date
        },
        payment_status: ['paid', 'invoiced']
      },
      attributes: ["id", "schedule_id", "subschedule_id", "total_passengers"],
    });

    // console.log("Raw Query Result:", JSON.stringify(seatAvailabilities, null, 2));
    // console.log("Booking Details:", JSON.stringify(bookingDetails, null, 2));

    let totalPassengers = 0;
    let totalRealPassengers = 0;
    const seatAvailabilityIds = [];

    seatAvailabilities.forEach((sa) => {
      const passengers = parseInt(sa.getDataValue("passengersSum"), 10);
      totalPassengers += passengers;
      if (passengers > 0) {
        seatAvailabilityIds.push(sa.id);
      }
    });

    bookingDetails.forEach((booking) => {
      totalRealPassengers += booking.total_passengers;
    });

    return {
      totalPassengers,
      totalRealPassengers,
      seatAvailabilityIds,
      bookings: bookingDetails
    };
  } catch (error) {
    console.error('Error fetching passengers and seat availability:', error);
    return {
      totalPassengers: 0,
      totalRealPassengers: 0,
      seatAvailabilityIds: [],
      bookings: []
    };
  }
};



// const getTotalPassengers = async (schedule_id, subschedule_id, date) => {
//   console.log("query schedule", schedule_id, subschedule_id);
//   try {
//     const seatAvailabilities = await SeatAvailability.findAll({
//       where: {
//         schedule_id,
//         // Jika subschedule_id tidak diberikan, gunakan kondisi IS NULL
//         subschedule_id: subschedule_id || { [Op.is]: null },
//         date,
//       },
//       attributes: [
//         "id", // Ambil ID dari SeatAvailability
//         // Hitung total penumpang dari Booking.total_passengers
//         [
//           fn(
//             "COALESCE",
//             fn("SUM", col("BookingSeatAvailabilities->Booking.total_passengers")),
//             0
//           ),
//           "passengersSum"
//         ],
//         // Gabungkan Booking.id dalam satu string (dipisahkan koma)
//         [
//           fn(
//             "COALESCE",
//             fn("GROUP_CONCAT", col("BookingSeatAvailabilities->Booking.id")),
//             ''
//           ),
//           "bookingIds"
//         ]
//       ],
//       include: [
//         {
//           model: BookingSeatAvailability,
//           as: 'BookingSeatAvailabilities',
//           required: false, // Tetap ambil SeatAvailability meskipun tidak ada booking
//           attributes: [],  // Tidak memilih kolom tambahan dari BookingSeatAvailability
//           include: [
//             {
//               model: Booking,
//               as: 'Booking',
//               attributes: ["id", "schedule_id", "subschedule_id"] // Ambil Booking.id, Booking.schedule_id, Booking.subschedule_id
//             }
//           ]
//         }
//       ],
//       // Grouping hanya berdasarkan SeatAvailability.id
//       group: ["SeatAvailability.id"],
//     });

//     console.log("Raw Query Result:", JSON.stringify(seatAvailabilities, null, 2));

//     let totalPassengers = 0;
//     const seatAvailabilityIds = [];
//     const bookings = [];

//     seatAvailabilities.forEach((sa) => {
//       // Ambil nilai agregasi dan konversi ke integer
//       const passengers = parseInt(sa.getDataValue("passengersSum"), 10);
//       totalPassengers += passengers;
//       if (passengers > 0) {
//         seatAvailabilityIds.push(sa.id);
//       }

//       // Ambil data booking
//       if (sa.BookingSeatAvailabilities) {
//         sa.BookingSeatAvailabilities.forEach(bsa => {
//           if (bsa.Booking) {
//             bookings.push({
//               id: bsa.Booking.id,
//               schedule_id: bsa.Booking.schedule_id,
//               subschedule_id: bsa.Booking.subschedule_id
//             });
//           }
//         });
//       }
//     });

//     return {
//       totalPassengers,
//       seatAvailabilityIds,
//       bookings
//     };
//   } catch (error) {
//     console.error('Error fetching passengers and seat availability:', error);
//     return {
//       totalPassengers: 0,
//       seatAvailabilityIds: [],
//       bookings: []
//     };
//   }
// };



  module.exports = {
    getTotalPassengers
  };;