const { sequelize, Booking, SeatAvailability, Destination, SubSchedule, Transport, Schedule, Passenger, Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../../models');
const { Op } = require('sequelize');

// /**
//  * Utility function to get total passengers for a specific schedule and subschedule on a given date.
//  * @param {number} schedule_id - The ID of the schedule.
//  * @param {number|null} subschedule_id - The ID of the subschedule (can be null).
//  * @param {string} date - The date to check for bookings (in 'YYYY-MM-DD' format).
//  * @returns {Promise<number>} - The total number of passengers for the given schedule and date.
//  */
// const getTotalPassengers = async (schedule_id, subschedule_id, date) => {
//     try {
//       // Fetch all bookings that match the schedule, subschedule, and date
//       const bookings = await Booking.findAll({
//         where: {
//           schedule_id: schedule_id,
//           subschedule_id: subschedule_id || { [Op.is]: null }, // Jika subschedule_id null, handle dengan { Op.is: null }
//           booking_date: {
//             [Op.eq]: date
//           },
//           payment_status: ['paid','invoiced'] // Hanya menghitung bookings dengan payment_status 'paid' dan 'invoiced'
//         },
//         attributes: ['total_passengers'] // Hanya mengambil field total_passengers
//       });
  
//       // Menghitung total penumpang dengan mengiterasi hasil
//       let totalPassengers = 0;
//       bookings.forEach(booking => {
//         totalPassengers += booking.total_passengers;
//       });
  
//       console.log(`Total passengers for schedule ${schedule_id}, subschedule ${subschedule_id || 'N/A'}, and date ${date}: ${totalPassengers}`);
      
//       return totalPassengers; // Mengembalikan total penumpang yang dihitung
//     } catch (error) {
//       console.error('Error fetching total passengers:', error);
//       return 0; // Mengembalikan 0 jika terjadi kesalahan
//     }
//   };
  
//   module.exports = {
//     getTotalPassengers
//   };;
  


const getTotalPassengers = async (schedule_id, subschedule_id, date) => {
  try {
    const seatAvailabilities = await SeatAvailability.findAll({
      where: {
        schedule_id: schedule_id,
        // Jika subschedule_id tidak diberikan, gunakan kondisi IS NULL
        subschedule_id: subschedule_id || { [Op.is]: null },
        date: date,
      },
      attributes: [
        "id",
        [
          // Hitung jumlah total penumpang dari Booking yang digabungkan melalui BookingSeatAvailability
          sequelize.fn(
            "COALESCE",
            sequelize.fn("SUM", sequelize.col("BookingSeatAvailabilities->Booking.total_passengers")),
            0
          ),
          "passengersSum"
        ]
      ],
      include: [
        {
          model: BookingSeatAvailability,
          as: 'BookingSeatAvailabilities',
          required: false, // Izinkan hasil meskipun tidak ada data booking
          attributes: [], // Jangan select kolom apapun dari BookingSeatAvailability
          include: [
            {
              model: Booking,
              as: 'Booking',
              where: {
                payment_status: ['paid', 'invoiced'] // Hanya ambil booking dengan status ini
              },
              attributes: [] // Jangan select kolom apapun dari Booking
            },
          ],
        },
      ],
      group: ["SeatAvailability.id"],
    });

    let totalPassengers = 0;
    const seatAvailabilityIds = [];

    seatAvailabilities.forEach((sa) => {
      // Ambil hasil agregasi dan konversi ke integer
      const passengers = parseInt(sa.getDataValue("passengersSum"), 10);
      totalPassengers += passengers;
      // Jika ada penumpang, masukkan id SeatAvailability ke dalam array
      if (passengers > 0) {
        seatAvailabilityIds.push(sa.id);
      }
    });

    return {
      totalPassengers,
      seatAvailabilityIds,
    };
  } catch (error) {
    console.error('Error fetching passengers and seat availability:', error);
    return {
      totalPassengers: 0,
      seatAvailabilityIds: [],
    };
  }
};
  module.exports = {
    getTotalPassengers
  };;