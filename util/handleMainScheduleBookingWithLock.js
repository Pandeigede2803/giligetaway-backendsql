const { sequelize, Booking, SeatAvailability, Destination, SubSchedule, Transport, Schedule, Passenger, Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');
const { Op } = require('sequelize');
const { calculatePublicCapacity } = require('../util/getCapacityReduction');

/**
 * handleMainScheduleBookingWithLock - Versi dengan proper row-level locking
 * untuk menghindari race condition / lock timeout
 * Khusus untuk updateScheduleBooking
 */
const handleMainScheduleBookingWithLock = async (
  schedule_id,
  booking_date,
  total_passengers,
  t
) => {
  console.log("we enter the handleMainScheduleBookingWithLock function");

  // Step 1: Fetch the schedule and ensure Boat is available
  const schedule = await Schedule.findByPk(schedule_id, {
    where: { availability: true },
    include: [
      {
        model: Boat,
        as: 'Boat',
      },
      {
        model: SubSchedule,
        as: 'SubSchedules',
        where: { availability: true },
      },
    ],
    transaction: t,
  });

  if (!schedule) {
    throw new Error('Jadwal tidak tersedia');
  }
  console.log(`Step 1: Schedule found with ID: ${schedule.id}`);

  // Step 2: Ensure the Boat has capacity
  if (!schedule.Boat || !schedule.Boat.capacity) {
    throw new Error('Boat capacity tidak ditemukan');
  }
  const publicCapacity = calculatePublicCapacity(schedule.Boat);

  // Step 3: Format the date (YYYY-MM-DD)
  const formattedDate = booking_date.split('T')[0];

  // Step 4: Check if SeatAvailability exists for MainSchedule dengan LOCK
  let seatAvailability = await SeatAvailability.findOne({
    where: {
      schedule_id: schedule_id,
      transit_id: null,
      subschedule_id: null,
      date: formattedDate,
    },
    transaction: t,
    lock: t.LOCK.UPDATE, // 🔒 LOCK ditambahkan
  });

  // Step 5: If not found, create new
  if (!seatAvailability) {
    console.log(
      `Step 5: SeatAvailability not found. Creating new entry for MainSchedule ID: ${schedule_id} on date: ${formattedDate}`
    );
    seatAvailability = await SeatAvailability.create(
      {
        schedule_id: schedule_id,
        transit_id: null,
        subschedule_id: null,
        available_seats: publicCapacity,
        date: formattedDate,
        availability: true,
      },
      { transaction: t }
    );
  } else {
    console.log(
      `Step 5: Found existing SeatAvailability with ID: ${seatAvailability.id}`
    );
    console.log(
      `Step 5: Existing available seats before subtraction: ${seatAvailability.available_seats}`
    );
  }

  // Step 6: Check capacity
  if (seatAvailability.available_seats < total_passengers) {
    throw new Error('Kursi tidak cukup tersedia');
  }

  // Step 7: Subtract seats
  seatAvailability.available_seats -= total_passengers;
  if (seatAvailability.available_seats < 0) {
    throw new Error('Seat availability cannot go below zero for the main schedule');
  }

  // Step 8: Save
  await seatAvailability.save({ transaction: t });

  // Kumpulkan semua seatAvailabilities di array
  const allSeatAvailabilities = [];
  // Push main seatAvailability
  allSeatAvailabilities.push(seatAvailability);

  // Step 9: Update each SubSchedule seat availability dengan LOCK
  for (const subSchedule of schedule.SubSchedules) {
    let subScheduleSeatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id: schedule_id,
        transit_id: null,
        subschedule_id: subSchedule.id,
        date: formattedDate,
      },
      transaction: t,
      lock: t.LOCK.UPDATE, // 🔒 LOCK ditambahkan
    });

    if (!subScheduleSeatAvailability) {
      subScheduleSeatAvailability = await SeatAvailability.create(
        {
          schedule_id: schedule_id,
          transit_id: null,
          subschedule_id: subSchedule.id,
          available_seats: seatAvailability.available_seats,
          date: formattedDate,
          availability: true,
        },
        { transaction: t }
      );
    } else {
      subScheduleSeatAvailability.available_seats = seatAvailability.available_seats;

      if (subScheduleSeatAvailability.available_seats < 0) {
        throw new Error(
          `Seat availability cannot go below zero for SubSchedule ID: ${subSchedule.id}`
        );
      }

      await subScheduleSeatAvailability.save({ transaction: t });
      console.log(
        `Step 9: Updated SeatAvailability for SubSchedule ID: ${subSchedule.id}, Available seats: ${subScheduleSeatAvailability.available_seats}`
      );
    }

    // Masukkan subSchedule seat availability ke array
    allSeatAvailabilities.push(subScheduleSeatAvailability);
  }

  // Kembalikan semua seatAvailabilities (main + subSchedules) dalam array
  return allSeatAvailabilities;
};

module.exports = handleMainScheduleBookingWithLock;
