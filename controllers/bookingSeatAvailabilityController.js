const { SeatAvailability, BookingSeatAvailability,Boat, Booking, Passenger,Schedule,Destination,Transit, SubSchedule  } = require('../models');
const { Op } = require('sequelize');
const { findRelatedSubSchedulesGet, findRelatedSubSchedules } = require('../util/handleSubScheduleBooking');
const { findSeatAvailabilityWithDetails } = require('../util/findSeatQuery');
const {buildRouteFromSchedule} = require('../util/buildRoute');
//ReferenceError: sequelize is not defined
const sequelize = require('../config/database');

const findSeatAvailabilityById = async (req, res) => {
  const { id } = req.params;

  try {
      // Fetch seat availability by ID and include related bookings, passengers, and other necessary models
      const seatAvailability = await SeatAvailability.findOne({
          where: { id },
          include: [
              {
                  model: BookingSeatAvailability,
                  as: 'BookingSeatAvailabilities',
                  include: [
                      {
                          model: Booking,
                          where: { payment_status: 'paid' },  // Filter only paid bookings
                          include: [
                              {
                                  model: Passenger,
                                  as: 'passengers', // Include passengers related to the booking
                              },
                              {
                                  model: Schedule,
                                  as: 'schedule',
                                  attributes: ['id', 'destination_from_id', 'destination_to_id'],
                                  include: [
                                      {
                                          model: Destination,
                                          as: 'FromDestination',
                                          attributes: ['name'],
                                      },
                                      {
                                          model: Destination,
                                          as: 'ToDestination',
                                          attributes: ['name'],
                                      },
                                  ],
                              },
                              {
                                  model: SubSchedule,
                                  as: 'subSchedule',
                                  attributes: ['id'],
                                  include: [
                                      {
                                          model: Destination,
                                          as: 'DestinationFrom',
                                          attributes: ['name'],
                                      },
                                      {
                                          model: Destination,
                                          as: 'DestinationTo',
                                          attributes: ['name'],
                                      },
                                      {
                                          model: Transit,
                                          as: 'TransitFrom',
                                          attributes: ['id', 'schedule_id', 'destination_id'],
                                          include: [
                                              {
                                                  model: Destination,
                                                  as: 'Destination',
                                                  attributes: ['name'],
                                              },
                                          ],
                                      },
                                      {
                                          model: Transit,
                                          as: 'TransitTo',
                                          attributes: ['id', 'schedule_id', 'destination_id'],
                                          include: [
                                              {
                                                  model: Destination,
                                                  as: 'Destination',
                                                  attributes: ['name'],
                                              },
                                          ],
                                      },
                                      {
                                          model: Transit,
                                          as: 'Transit1',
                                          attributes: ['id', 'schedule_id', 'destination_id'],
                                          include: [
                                              {
                                                  model: Destination,
                                                  as: 'Destination',
                                                  attributes: ['name'],
                                              },
                                          ],
                                      },
                                      {
                                          model: Transit,
                                          as: 'Transit2',
                                          attributes: ['id', 'schedule_id', 'destination_id'],
                                          include: [
                                              {
                                                  model: Destination,
                                                  as: 'Destination',
                                                  attributes: ['name'],
                                              },
                                          ],
                                      },
                                      {
                                          model: Transit,
                                          as: 'Transit3',
                                          attributes: ['id', 'schedule_id', 'destination_id'],
                                          include: [
                                              {
                                                  model: Destination,
                                                  as: 'Destination',
                                                  attributes: ['name'],
                                              },
                                          ],
                                      },
                                      {
                                          model: Transit,
                                          as: 'Transit4',
                                          attributes: ['id', 'schedule_id', 'destination_id'],
                                          include: [
                                              {
                                                  model: Destination,
                                                  as: 'Destination',
                                                  attributes: ['name'],
                                              },
                                          ],
                                      },
                                      {
                                          model: SeatAvailability,
                                          as: 'SeatAvailabilities',
                                      },
                                  ],
                              },
                          ],
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

      // Extract booking and passenger data
      const bookings = seatAvailability.BookingSeatAvailabilities.map((bsa) => ({
          booking_id: bsa.booking_id,
          passengers: bsa.Booking.passengers, // Related passengers for each booking
      }));

      // Return seat availability details along with related booking and passenger data
      return res.status(200).json({
          status: 'success',
          message: 'Seat availability and related passengers retrieved successfully',
          seat_availability: {
              ...seatAvailability.get({ plain: true }),
              bookings,
          },
      });
  } catch (error) {
      console.log('Error finding seat availability:', error.message);
      return res.status(500).json({
          status: 'error',
          message: 'An error occurred while finding seat availability',
          error: error.message,
      });
  }
};


/**
 * Mengambil dan memfilter pemesanan (booking) berdasarkan `seat_availability_id` yang diberikan.
 *
 * @param {object} req - Objek permintaan (request) dari klien, berisi parameter `seat_availability_id` sebagai `id`.
 * @param {object} res - Objek respons (response) yang akan dikembalikan ke klien.
 *
 * Alur Kerja:
 * 1. Fungsi ini mengambil entri `SeatAvailability` berdasarkan `seat_availability_id` yang diberikan.
 * 2. Data yang diambil termasuk berbagai model terkait seperti:
 *    - `BookingSeatAvailability`: Tabel pivot yang menghubungkan pemesanan dengan ketersediaan kursi (seat availability).
 *    - `Booking`: Model pemesanan terkait yang berisi:
 *      - `Passenger`: Data penumpang yang terkait dengan pemesanan.
 *      - `Schedule`: Jadwal terkait pemesanan, termasuk `destination_from_id` dan `destination_to_id` serta rincian tujuan.
 *      - `SubSchedule`: Jika pemesanan terkait dengan sub-schedule (`subschedule_id`), maka rincian sub-schedule akan diambil, termasuk titik transit dan tujuan terkait.
 *      - `Transit`: Rincian transit untuk `TransitFrom` dan `TransitTo` di sub-schedule, beserta destinasi transit.
 *      - `SeatAvailability`: Jika sub-schedule memiliki ketersediaan kursi yang terkait, maka ini juga akan diambil.
 * 3. Jika tidak ditemukan `SeatAvailability` berdasarkan `seat_availability_id`, maka fungsi akan mengembalikan respons error 404.
 * 4. Pemesanan kemudian dipisah menjadi dua kategori:
 *    - `bookings_with_subschedule`: Pemesanan yang memiliki `subschedule_id` (berhubungan dengan sub-schedule).
 *    - `bookings_without_subschedule`: Pemesanan yang tidak memiliki `subschedule_id` (tidak berhubungan dengan sub-schedule).
 * 5. Hasil akhir termasuk pemesanan yang sudah difilter serta data ketersediaan kursi (`seatAvailability`) itu sendiri.
 *
 * Response:
 * - `bookings_with_subschedule`: Daftar pemesanan yang memiliki `subschedule_id`.
 * - `bookings_without_subschedule`: Daftar pemesanan yang tidak memiliki `subschedule_id`.
 * - `seatAvailability`: Objek ketersediaan kursi (`SeatAvailability`) yang ditemukan.
 *
 * @throws {Error} Jika terjadi kesalahan saat mengambil data.
 */
  const getFilteredBookingsBySeatAvailability = async (req, res) => {
      const { id } = req.params; // `id` di sini adalah `seat_availability_id`
    
      try {
        const seatAvailability = await SeatAvailability.findOne({
          where: { id },
          include: [
            {
              model: BookingSeatAvailability,
              as: 'BookingSeatAvailabilities',
              include: [
                {
                  model: Booking,
                  where:{payment_status:'paid'},
                  include: [
                    {
                      model: Passenger,
                      as: 'passengers',
                    },
                    {
                      model: Schedule,
                      as: 'schedule',
                      attributes: ['id', 'destination_from_id', 'destination_to_id'],
                      include: [
                        {
                          model: Destination,
                          as: 'FromDestination',
                          attributes: ['name']
                        },
                        {
                          model: Destination,
                          as: 'ToDestination',
                          attributes: ['name']
                        }
                      ]
                    },
                    {
                      model: SubSchedule,
                      as: 'subSchedule',
                      attributes: ['id'],
                      include: [
                        {
                          model: Destination,
                          as: 'DestinationFrom',
                          attributes: ['name']
                        },
                        {
                          model: Destination,
                          as: 'DestinationTo',
                          attributes: ['name']
                        },
                        {
                          model: Transit,
                          as: 'TransitFrom',
                          attributes: ['id', 'schedule_id', 'destination_id'],
                          include: [
                            {
                              model: Destination,
                              as: 'Destination',
                              attributes: ['name']
                            }
                          ]
                        },
                        {
                          model: Transit,
                          as: 'TransitTo',
                          attributes: ['id', 'schedule_id', 'destination_id'],
                          include: [
                            {
                              model: Destination,
                              as: 'Destination',
                              attributes: ['name']
                            }
                          ]
                        },
                        //add transit 1-4
                        {
                          model: Transit,
                          as: 'Transit1',
                          attributes: ['id', 'schedule_id', 'destination_id'],
                          include: [
                            {
                              model: Destination,
                              as: 'Destination',
                              attributes: ['name']
                            }
                          ]
                        },
                        {
                          model: Transit,
                          as: 'Transit2',
                          attributes: ['id', 'schedule_id', 'destination_id'],
                          include: [
                            {
                              model: Destination,
                              as: 'Destination',
                              attributes: ['name']
                            }
                          ]
                        },
                        {
                          model: Transit,
                          as: 'Transit3',
                          attributes: ['id', 'schedule_id', 'destination_id'],
                          include: [
                            {
                              model: Destination,
                              as: 'Destination',
                              attributes: ['name']
                            }
                          ],
                        
                        },
                        {
                          model: Transit,
                          as: 'Transit4',
                          attributes: ['id', 'schedule_id', 'destination_id'],
                          include: [
                            {
                              model: Destination,
                              as: 'Destination',
                              attributes: ['name']
                            }
                          ],
                        },

                        {
                          model: SeatAvailability,
                          as: 'SeatAvailabilities'
                        }
                      ]
                    },
                  ]
                },
          
              ]
            }
          ]
        });
    
        if (!seatAvailability) {
          return res.status(404).json({
            status: 'fail',
            message: `Seat availability not found for ID ${id}.`
          });
        }
    
        // Refactored functions to handle related passengers and bookings
        const { relatedPassenger, bookingsWithSubSchedule } = await fetchRelatedBookingsAndPassengers(
          seatAvailability.BookingSeatAvailabilities
        );
    
        // Handle bookings without SubSchedule
        const bookingsWithoutSubSchedule = seatAvailability.BookingSeatAvailabilities
          .filter(bsa => !bsa.Booking.subschedule_id)
          .map(bsa => bsa.Booking);
    
        return res.status(200).json({
          status: 'success',
          message: 'Filtered bookings retrieved successfully',
          bookings_with_subschedule: bookingsWithSubSchedule,
          bookings_without_subschedule: bookingsWithoutSubSchedule,
          relatedPassenger, // Only passengers related to Main Schedule + Related SubSchedules
          relatedPassengerCount: relatedPassenger.length,
          seatAvailability
        });
      } catch (error) {
        console.error('Error fetching filtered bookings:', error);
        return res.status(500).json({
          status: 'error',
          message: 'An error occurred while fetching filtered bookings',
          error: error.message
        });
      }
    };
    

 
  
  const getFilteredBookingsBySeatAvailability2 = async (req, res) => {
    const { id } = req.params; // `id` di sini adalah `seat_availability_id`
  
    try {
      // Fetch the specific SeatAvailability by ID
      const seatAvailability = await SeatAvailability.findOne({
        where: { id },
        include: [
          {
            model: BookingSeatAvailability,
            as: 'BookingSeatAvailabilities',
            include: [
              {
                model: Booking,
                where: { payment_status: 'paid' }, // Filter only paid bookings
                include: [
                  {
                    model: Passenger,
                    as: 'passengers',
                  },
                  {
                    model: Schedule,
                    as: 'schedule',
                    attributes: ['id', 'destination_from_id', 'destination_to_id'],
                    include: [
                      {
                        model: Destination,
                        as: 'FromDestination',
                        attributes: ['name'],
                      },
                      {
                        model: Destination,
                        as: 'ToDestination',
                        attributes: ['name'],
                      },
                    ],
                  },
                  {
                    model: SubSchedule,
                    as: 'subSchedule',
                    attributes: ['id'],
                    include: [
                      {
                        model: Destination,
                        as: 'DestinationFrom',
                        attributes: ['name'],
                      },
                      {
                        model: Destination,
                        as: 'DestinationTo',
                        attributes: ['name'],
                      },
                      {
                        model: Transit,
                        as: 'TransitFrom',
                        attributes: ['id', 'schedule_id', 'destination_id'],
                        include: [
                          {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'],
                          },
                        ],
                      },
                      {
                        model: Transit,
                        as: 'TransitTo',
                        attributes: ['id', 'schedule_id', 'destination_id'],
                        include: [
                          {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'],
                          },
                        ],
                      },
                      {
                        model: Transit,
                        as: 'Transit1',
                        attributes: ['id', 'schedule_id', 'destination_id'],
                        include: [
                          {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'],
                          },
                        ],
                      },
                      {
                        model: Transit,
                        as: 'Transit2',
                        attributes: ['id', 'schedule_id', 'destination_id'],
                        include: [
                          {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'],
                          },
                        ],
                      },
                      {
                        model: Transit,
                        as: 'Transit3',
                        attributes: ['id', 'schedule_id', 'destination_id'],
                        include: [
                          {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'],
                          },
                        ],
                      },
                      {
                        model: Transit,
                        as: 'Transit4',
                        attributes: ['id', 'schedule_id', 'destination_id'],
                        include: [
                          {
                            model: Destination,
                            as: 'Destination',
                            attributes: ['name'],
                          },
                        ],
                      },
                      {
                        model: SeatAvailability,
                        as: 'SeatAvailabilities',
                      },
                    ],
                  },
                ],
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
  
      // Fetch related seat availabilities with the same schedule_id and booking_date, and payment_status 'paid'
      const relatedSeatAvailabilities = await SeatAvailability.findAll({
        where: {
          schedule_id: seatAvailability.schedule_id,
          date: seatAvailability.date,
        },
        include: [
          {
            model: BookingSeatAvailability,
            as: 'BookingSeatAvailabilities',
            include: [
              {
                model: Booking,
                where: { payment_status: 'paid' }, // Filter only paid bookings
              },
            ],
          },
        ],
      });
  
      // Refactored functions to handle related passengers and bookings
      const bookingsWithSubSchedule = seatAvailability.BookingSeatAvailabilities.map((bsa) => ({
        booking_id: bsa.booking_id,
        passengers: bsa.Booking.passengers,
      }));
  
      // Handle bookings without SubSchedule
      const bookingsWithoutSubSchedule = seatAvailability.BookingSeatAvailabilities
        .filter(bsa => !bsa.Booking.subschedule_id)
        .map(bsa => bsa.Booking);
  
      // Return seat availability and related seat availabilities
      return res.status(200).json({
        status: 'success',
        message: 'Filtered bookings retrieved successfully',
        bookings_with_subschedule: bookingsWithSubSchedule,
        bookings_without_subschedule: bookingsWithoutSubSchedule,
        relatedSeatAvailabilities: relatedSeatAvailabilities.map(sa => sa.id), // Return related seat availability IDs
        seatAvailability,
      });
    } catch (error) {
      console.error('Error fetching filtered bookings:', error);
      return res.status(500).json({
        status: 'error',
        message: 'An error occurred while fetching filtered bookings',
        error: error.message,
      });
    }
  };
  

  
  // Refactored function to fetch related passengers and bookings
// Refactored function to fetch related passengers and bookings
const fetchRelatedBookingsAndPassengers = async (bookingSeatAvailabilities) => {
    const relatedPassenger = [];
    const bookingsWithSubSchedule = [];
  
    // Handle each booking availability in parallel
    await Promise.all(bookingSeatAvailabilities.map(async (bsa) => {
      const booking = bsa.Booking;
      const bookingDate = booking.booking_date;
  
      if (booking.subschedule_id) {
        const subSchedule = await SubSchedule.findByPk(booking.subschedule_id);
  
        if (subSchedule) {
          const relatedSubSchedules = await findRelatedSubSchedulesGet(booking.schedule_id, subSchedule, null);
  
          bookingsWithSubSchedule.push({
            ...booking.dataValues,
            relatedSubSchedules: relatedSubSchedules.map(sub => sub.id)
          });
  
          // Fetch passengers for related sub-schedules with 'paid' status
          await Promise.all(relatedSubSchedules.map(async (relatedSubSchedule) => {
            const relatedSubBookings = await Booking.findAll({
              where: {
                schedule_id: booking.schedule_id,
                subschedule_id: relatedSubSchedule.id,
                booking_date: bookingDate,
                payment_status: 'paid' // Filter hanya booking dengan status 'paid'
              },
              include: [{ model: Passenger, as: 'passengers' }]
            });
  
            // Add passengers from each related sub-schedule
            relatedSubBookings.forEach(relatedBooking => {
              relatedPassenger.push(...relatedBooking.passengers);
            });
          }));
        }
      } else {
        // Main Schedule passengers with 'paid' status
        if (booking.payment_status === 'paid') {
          relatedPassenger.push(...booking.passengers);
        }
      }
    }));
  
    return { relatedPassenger, bookingsWithSubSchedule };
  };


  //create new controller to filter relatedpassenger to usaing fetch relatedBookingandPassengers by input seatavailability id only

  const findRelatedPassengerBySeatAvailabilityId = async (req, res) => {
    const { id } = req.params;
  
    try {
      // Fetch seat availability and related details
      const seatAvailability = await findSeatAvailabilityWithDetails(id);
  
      if (!seatAvailability || !seatAvailability.Schedule) {
        return res.status(404).json({
          status: 'fail',
          message: `Seat availability or related schedule not found for ID ${id}.`,
        });
      }
  
      const { Schedule, BookingSeatAvailabilities, availability, } = seatAvailability;
  
      // Determine seat availability status
      const seatAvailabilityStatus = Boolean(availability);
  
      // Prepare route based on Schedule or SubSchedule
      let route = 'Unknown Route';
      const subSchedule = BookingSeatAvailabilities[0]?.Booking?.subSchedule || null;
      if (Schedule) {
        route = buildRouteFromSchedule(Schedule, subSchedule);
      }
  
    // Fetch all passengers related to the seat availability
    const passengers = [];
    BookingSeatAvailabilities.forEach((bsa) => {
      const { booking_date, ticket_id, payment_status, ...bookingDetails } = bsa.Booking.get({
        plain: true,
      });

      bsa.Booking.passengers.forEach((passenger) => {
        passengers.push({
          ...passenger.get({ plain: true }),
          booking_date,
          ticket_id,
          payment_status,
          bookingDetails, // Include all other booking details
        });
      });
    });
  
      return res.status(200).json({
        status: 'success',
        message: 'Related passengers retrieved successfully',
        route,
        seatAvailabilityStatus,
        relatedPassengers: passengers,
        relatedPassengerCount: passengers.length,
        availability,
        // schedule: Schedule,
        // seatAvailability,
      });
    } catch (error) {
      console.error('Error fetching related passengers:', error);
      return res.status(500).json({
        status: 'error',
        message: 'An error occurred while fetching related passengers',
        error: error.message,
      });
    }
  };
  


module.exports = {
    findSeatAvailabilityById,
    getFilteredBookingsBySeatAvailability,
    findRelatedPassengerBySeatAvailabilityId
};

