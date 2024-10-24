const { SeatAvailability } = require('../models');
const { Op } = require('sequelize');

/**
 * Validasi ketersediaan seat dari single trip yang diberikan
 * @param {Number} schedule_id - Schedule ID untuk trip
 * @param {Number} subschedule_id - SubSchedule ID (bisa null jika tidak ada sub-schedule)
 * @param {Date} booking_date - Tanggal pemesanan
 * @param {Number} total_passengers - Total penumpang untuk trip tersebut
 * @returns {Object} Result dari validasi, termasuk detail seat availability atau pesan error
 */
const validateSeatAvailabilitySingleTrip = async (schedule_id, subschedule_id, booking_date, total_passengers) => {
  try {
    // Step 1: Log the input data
    console.log('Schedule ID:', schedule_id);
    console.log('SubSchedule ID:', subschedule_id);
    console.log('Booking Date:', booking_date);
    console.log('Total Passengers:', total_passengers);

    // Step 2: Find seat availability for the provided schedule_id, subschedule_id, and booking_date
    const seatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id,
        subschedule_id,
        date: booking_date,
      },
    });

    console.log('Seat availability found:', seatAvailability);

    // Step 3: Check if seat availability is found
    if (!seatAvailability) {
      console.warn('No seat availability data found for the provided schedule and subschedule.');
      return {
        success: false,
        message: 'No seat availability found for the provided schedule and subschedule. Proceeding with booking is not possible.',
      };
    }

    // Step 4: Check if available seats are less than total passengers
    if (seatAvailability.available_seats < total_passengers) {
      console.warn(`Insufficient seats available. Required: ${total_passengers}, Available: ${seatAvailability.available_seats}`);
      return {
        success: false,
        message: `Insufficient seats available for the total passengers. Required: ${total_passengers}, Available: ${seatAvailability.available_seats}`,
      };
    }

    // Step 5: Return seat availability details if everything is okay
    console.log('Sufficient seats available, proceeding.');
    return {
      success: true,
      seatAvailability,
    };
  } catch (error) {
    // Step 6: Catch and log any errors that occur
    console.error('Error validating seat availability for single trip:', error.message);
    return { success: false, message: 'Error validating seat availability. Please try again later.' };
  }
};

module.exports = validateSeatAvailabilitySingleTrip;