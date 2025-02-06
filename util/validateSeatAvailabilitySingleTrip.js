const { SeatAvailability } = require('../models');
const { Op } = require('sequelize');


const validateSeatAvailabilitySingleTrip = async (schedule_id, subschedule_id, booking_date, total_passengers) => {
  try {
   console.log("---VALIDATE SEATAVAILABILITY---")
    console.log('Schedule ID:', schedule_id);
    console.log('SubSchedule ID:', subschedule_id);
    console.log('Booking Date:', booking_date);
    console.log('Total Passengers:', total_passengers);

    // Step 2: Define the query conditionally based on the subschedule_id
    const seatAvailabilityQuery = {
      where: {
        schedule_id,
        date: booking_date,
      },
    };

    // Only include subschedule_id in the query if it's provided and valid
    if (subschedule_id !== undefined && subschedule_id !== 'N/A' && subschedule_id !== null) {
      seatAvailabilityQuery.where.subschedule_id = subschedule_id;
    }

    // Step 3: Find seat availability with the constructed query
    const seatAvailability = await SeatAvailability.findOne(seatAvailabilityQuery);
    console.log("this the data of seat availability", seatAvailability)

  

    // Step 4: Check if seat availability is found
    if (!seatAvailability) {
      console.warn('No seat availability data found for the provided schedule and subschedule.');
      // Return a neutral response without proceeding to block booking
      return {
        success: true,
        seatAvailability: null,
        message: 'No seat availability found, proceeding without it.',
      };
    }

    // Step 5: Check if available seats are less than total passengers
    if (seatAvailability.available_seats < total_passengers) {
      console.warn(`Insufficient seats available. Required: ${total_passengers}, Available: ${seatAvailability.available_seats}`);
      return {
        success: false,
        message: `Insufficient seats available for the total passengers. Required: ${total_passengers}, Available: ${seatAvailability.available_seats}`,
      };
    }

    // Step 6: Return seat availability details if everything is okay
    console.log('Sufficient seats available, proceeding PASSS.');
    return {
      success: true,
      seatAvailability,
    };
  } catch (error) {
    // Step 7: Catch and log any errors that occur
    console.error('Error validating seat availability for single trip:', error.message);
    return { success: false, message: 'Error validating seat availability. Please try again later.' };
  }
};



module.exports = validateSeatAvailabilitySingleTrip;