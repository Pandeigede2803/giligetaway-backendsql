const SeatAvailability = require('../models/SeatAvailability');
const SubSchedule = require('../models/SubSchedule');

const releaseMainScheduleSeats = require('../util/releaseMainScheduleSeats');
const releaseSubScheduleSeats = require('../util/releaseSubScheduleSeats');
/**
 * Mengembalikan kursi yang sebelumnya telah dipesan untuk SubSchedule dan SubSchedules terkait,
 * serta Main Schedule jika terkait.
 *
 * @param {number} schedule_id - ID dari Main Schedule.
 * @param {number} subschedule_id - ID dari SubSchedule yang dipilih.
 * @param {string} booking_date - Tanggal pemesanan dalam format YYYY-MM-DD.
 * @param {number} total_passengers - Jumlah total penumpang yang akan mengembalikan kursi.

 *
 * @throws {Error} Jika SubSchedule atau SeatAvailability tidak ditemukan.
 *
 * @returns {Set} Set yang berisi ID dari SubSchedules yang telah diperbarui.
 */
const releaseSeats = async (booking, transaction) => {
    const { schedule_id, subschedule_id, total_passengers, booking_date } = booking;
    const releasedSeatIds = []; // Array untuk menyimpan ID SeatAvailability yang dirilis
  
    try {
      if (subschedule_id) {
        // Release seats for SubSchedule
        const releasedIds = await releaseSubScheduleSeats(
          schedule_id,
          subschedule_id,
          booking_date,
          total_passengers,
          transaction
        );
        releasedSeatIds.push(...releasedIds); // Add released IDs for SubSchedule
      } else {
        // Release seats for Main Schedule
        const releasedIds = await releaseMainScheduleSeats(
          schedule_id,
          booking_date,
          total_passengers,
          transaction
        );
        releasedSeatIds.push(...releasedIds); // Add released IDs for Main Schedule
      }
  
  
      console.log(`Successfully released ${total_passengers} seats for Booking ID: ${booking.id}`);
      return releasedSeatIds; // Return semua ID SeatAvailability yang dirilis
    } catch (error) {
      console.error(`Failed to release seats for Booking ID: ${booking.id}`, error);
      throw error;
    }
  };
  
  module.exports = releaseSeats;  