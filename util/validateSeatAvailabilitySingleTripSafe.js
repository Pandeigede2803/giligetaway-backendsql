const { SeatAvailability } = require("../models");

const validateSeatAvailabilitySingleTripSafe = async (
  schedule_id,
  subschedule_id,
  booking_date,
  total_passengers
) => {
  try {
    const parsedScheduleId = parseInt(schedule_id?.value || schedule_id, 10);
    if (!Number.isFinite(parsedScheduleId)) {
      return { success: false, message: "Invalid schedule_id" };
    }

    const parsedSubScheduleId = parseInt(
      subschedule_id?.value || subschedule_id,
      10
    );

    const seatAvailabilityQuery = {
      where: {
        schedule_id: parsedScheduleId,
        date: booking_date,
        availability: true,
      },
    };

    if (Number.isFinite(parsedSubScheduleId) && subschedule_id !== "N/A") {
      seatAvailabilityQuery.where.subschedule_id = parsedSubScheduleId;
    }

    const seatAvailability = await SeatAvailability.findOne(seatAvailabilityQuery);

    if (!seatAvailability) {
      return {
        success: true,
        seatAvailability: null,
        message: "No seat availability found, proceeding without it.",
      };
    }

    if (seatAvailability.available_seats < total_passengers) {
      return {
        success: false,
        message: `Insufficient seats available for the total passengers. Required: ${total_passengers}, Available: ${seatAvailability.available_seats}`,
      };
    }

    return {
      success: true,
      seatAvailability,
    };
  } catch (error) {
    console.error(
      "Error validating seat availability for single trip (safe):",
      error.message
    );
    return {
      success: false,
      message: "Error validating seat availability. Please try again later.",
    };
  }
};

module.exports = validateSeatAvailabilitySingleTripSafe;
