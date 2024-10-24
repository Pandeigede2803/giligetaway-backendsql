const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const { Op } = require('sequelize');

/**
 * Validasi ketersediaan seat dari trips yang diberikan
 * @param {Array} trips - Array of trips. Each trip contains schedule_id, subschedule_id, booking_date
 * @param {Number} total_passengers - Total passengers to be checked for availability
 * @returns {Object} Result of the validation. Includes seat availability details or error message
 */



const validateSeatAvailability = async (trips, total_passengers) => {
  try {
    // Step 1: Log the trips and total passengers received
    console.log('Trips received:', trips);
    console.log('Total passengers:', total_passengers);

    // Step 2: Map the trip details
    const tripDetails = trips.map((trip) => ({
      schedule_id: trip.schedule_id,
      subschedule_id: trip.subschedule_id || null,
      booking_date: trip.booking_date,
    }));
    console.log('Mapped trip details:', tripDetails);

    // Step 3: Find seat availability for each trip
    const seatAvailabilities = await SeatAvailability.findAll({
      where: {
        [Op.or]: tripDetails.map((trip) => ({
          schedule_id: trip.schedule_id,
          subschedule_id: trip.subschedule_id, // null subschedule_id is okay
          date: trip.booking_date,
        })),
      },
    });
    console.log('Seat availabilities found:', seatAvailabilities);

    // Step 4: Check if seat availability is found
    if (!seatAvailabilities.length) {
      console.warn('No seat availability data found for the provided trips. Proceeding to create new availability in bookingQueue.');
      return {
        success: true,
        seatAvailabilities: [],
        warning: 'No seat availability found, will create new availability in bookingQueue.',
      };
    }

    // Step 5: Calculate total seat availability
    const totalSeatsAvailable = seatAvailabilities.reduce((total, seat) => {
      return total + seat.available_seats;
    }, 0);
    console.log('Total seats available:', totalSeatsAvailable);

    // Step 6: Check if available seats are less than total passengers
    if (totalSeatsAvailable < total_passengers) {
      console.error('Kursi tidak mencukupi untuk jumlah penumpang. Diperlukan:', total_passengers, 'Tersedia:', totalSeatsAvailable);
      return {
        error: 'Kursi tidak mencukupi untuk jumlah penumpang. Silakan periksa kembali.',
        availableSeats: totalSeatsAvailable,
      };
    }

    // Step 7: Return seat availability details if everything is okay
    console.log('Sufficient seats available, proceeding.');
    return {
      success: true,
      seatAvailabilities,
      totalSeatsAvailable,
    };
  } catch (error) {
    // Step 8: Catch and log any errors that occur
    console.error('Error validating seat availability:', error.message);
    return { error: 'Error validating seat availability. Please try again later.' };
  }
};





module.exports = validateSeatAvailability;