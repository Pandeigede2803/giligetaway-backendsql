const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op, fn, col } = require("sequelize");  // Import fn and col from Sequelize

const {sumTotalPassengers} = require('../util/sumTotalPassengers');
const {buildRoute ,  buildRouteFromSchedule} = require('../util/buildRoute');
const {getScheduleAndSubScheduleByDate} = require('../util/scheduleUtils');
// Fix date utility function
const getDaysInMonth = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate(); // Get number of days in the month
  return new Array(daysInMonth).fill('').map((_, i) => {
      const date = new Date(year, month - 1, i + 1); // Ensure we get correct dates for the month
      return date.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
  });
};;

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

const getSeatAvailabilityIncludes = require('../util/getSeatAvailabilityIncludes');

const getPassengerCountByMonth = async (req, res) => {
  const { month, year, boat_id } = req.query;  // boat_id sebagai parameter wajib

  if (!month || !year || !boat_id) {
      return res.status(400).json({
          success: false,
          message: 'Please provide month, year, and boat_id in the query parameters.'
      });
  }

  try {
      const daysInMonth = getDaysInMonth(month, year);

      // Query SeatAvailability berdasarkan bulan, tahun, dan boat_id
      const seatAvailabilities = await SeatAvailability.findAll({
          attributes: ['id', 'date', 'schedule_id', 'subschedule_id'],
          where: {
              [Op.and]: [
                  sequelize.where(fn('MONTH', col('SeatAvailability.date')), month),
                  sequelize.where(fn('YEAR', col('SeatAvailability.date')), year)
              ]
          },
          include: getSeatAvailabilityIncludes()  // Gunakan utilitas untuk include relasi
      });

      const formattedResults = await Promise.all(daysInMonth.map(async (date) => {
          const seatAvailability = seatAvailabilities.find(sa => sa.date === date);

          if (seatAvailability) {
              const totalPassengers = sumTotalPassengers(seatAvailability.BookingSeatAvailabilities);
              const route = buildRouteFromSchedule(seatAvailability.Schedule, seatAvailability.SubSchedule);

              return [{
                  seatavailability_id: seatAvailability.id,
                  date: seatAvailability.date,
                  schedule_id: seatAvailability.schedule_id,
                  subschedule_id: seatAvailability.subschedule_id,
                  total_passengers: totalPassengers,
                  route: route
              }];
          } else {
              // Query Schedule dan SubSchedule menggunakan utils, lalu filter berdasarkan boat_id
              const { schedules, subSchedules } = await getScheduleAndSubScheduleByDate(date);
              const filteredSchedules = schedules.filter(schedule => schedule.boat_id == boat_id);  // Filter berdasarkan boat_id
              let results = [];

              subSchedules.forEach(subSchedule => {
                  const relatedSchedule = filteredSchedules.find(schedule => schedule.id === subSchedule.schedule_id);
                  if (relatedSchedule) {
                      let route = buildRouteFromSchedule(relatedSchedule, subSchedule);
                      results.push({
                          seatavailability_id: null,
                          date: date,
                          schedule_id: relatedSchedule.id,
                          subschedule_id: subSchedule.id,
                          total_passengers: 0,
                          route: route
                      });
                  }
              });

              return results;
          }
      }));

      const finalResults = formattedResults.flat();

      return res.status(200).json({
          success: true,
          data: finalResults
      });
  } catch (error) {
      console.error('Error fetching passenger count by month:', error);
      return res.status(500).json({
          success: false,
          message: 'Failed to retrieve passenger count for the specified month.'
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
            res.status(404).json({ error: 'Passenger not found' });
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
            res.status(404).json({ error: 'Passenger not found' });
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
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



const getPassengersByScheduleAndSubSchedule = async (req, res) => {
    console.log('getPassengersByScheduleAndSubSchedule: start');
    const { selectedDate } = req.query;

    try {
        // Step 1: Filter bookings based on the selected date
        console.log('getPassengersByScheduleAndSubSchedule: filtering bookings by date');
        const bookings = await Booking.findAll({
            where: {
                booking_date: selectedDate
            },
            include: [
                {
                    association: 'passengers', // Include passengers associated with the bookings
                    attributes: ['id', 'name', 'nationality', 'passenger_type']
                }
            ]
        });

        // Step 2: Split bookings into two categories
        console.log('getPassengersByScheduleAndSubSchedule: splitting bookings by schedule and subschedule');
        const scheduleOnlyBookings = bookings.filter(booking => booking.schedule_id && !booking.subschedule_id);
        const subScheduleBookings = bookings.filter(booking => booking.schedule_id && booking.subschedule_id);

        // Step 3: Respond with the split data
        console.log('getPassengersByScheduleAndSubSchedule: sending response');
        res.status(200).json({
            scheduleOnlyBookings,
            subScheduleBookings
        });
    } catch (error) {
        console.log('getPassengersByScheduleAndSubSchedule: catch error');
        res.status(400).json({ error: error.message });
    }
};

// Controller to fetch total passengers by schedule/subschedule and date
const getPassengerCountByDate = async (req, res) => {
  const { date } = req.query;  // Expect the date in query parameters
  
  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a date in the query parameters.'
    });
  }

  try {
    const results = await SeatAvailability.findAll({
      attributes: [
        'date',
        'schedule_id',
        'sub_schedule_id',
        [Sequelize.fn('SUM', Sequelize.col('Bookings.total_passengers')), 'total_passengers']
      ],
      include: [
        {
          model: BookingSeatAvailability,
          include: [
            {
              model: Bookings,
              where: { payment_status: 'paid' },
              attributes: []
            }
          ]
        }
      ],
      where: {
        date: date  // Filter by the specific date provided in the query
      },
      group: ['SeatAvailability.date', 'SeatAvailability.schedule_id', 'SeatAvailability.sub_schedule_id']
    });

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching passenger count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve passenger count'
    });
  }
};

// Controller to fetch total passengers by schedule/subschedule and month
// Controller to fetch total passengers by schedule/subschedule and month with full date

module.exports = {
    createPassenger,
    getPassengerCountByDate,
    getPassengerCountByMonth,
    getPassengersByScheduleAndSubSchedule,
    getPassengers,
    getPassengerById,
    updatePassenger,
    deletePassenger
};
