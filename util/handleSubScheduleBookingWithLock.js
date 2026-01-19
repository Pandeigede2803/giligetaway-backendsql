const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule, SubSchedule,Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat,SubScheduleRelation } = require('../models');
const { Op } = require('sequelize');

const { calculatePublicCapacity } = require('../util/getCapacityReduction');
const { isException, checkExceptions } = require('./isExceptionV2');


const findRelatedSubSchedules = async (schedule_id, subSchedule, t) => {
  // First, find all relations for this subschedule
  console.log("masuk findRelatedSubSchedules");
  const relations = await SubScheduleRelation.findAll({
    where: {
      main_subschedule_id: subSchedule.id
    },
    transaction: t
  });

  // Extract the IDs of related subschedules
  const relatedIds = relations.map(relation => relation.related_subschedule_id);

  // Query both the main subschedule and its related subschedules
  let allSubSchedules = await SubSchedule.findAll({
    where: {
      schedule_id: schedule_id,
      id: [...relatedIds, subSchedule.id] // Include both the main subschedule ID and related IDs
    },
    transaction: t
  });

  return allSubSchedules;
};


/**
 * handleSubScheduleBookingWithLock - Versi dengan proper row-level locking
 * untuk menghindari race condition / lock timeout
 * Khusus untuk updateScheduleBooking
 */
const handleSubScheduleBookingWithLock = async (
  schedule_id,
  subschedule_id,
  booking_date,
  total_passengers,
  t
) => {
  console.log("masuk handleSubScheduleBookingWithLock");

  // ── 1. Ambil Schedule + Boat ───────────────────────────────
  const schedule = await Schedule.findByPk(schedule_id, {
    include: [{ model: sequelize.models.Boat, as: "Boat" }],
    transaction: t,
  });
  if (!schedule || !schedule.Boat)
    throw new Error("Boat information is missing or invalid");

  const publicCapacity = calculatePublicCapacity(schedule.Boat);

  // ── 2. Ambil SubSchedule ──────────────────────────────────
  const subSchedule = await SubSchedule.findOne({
    where: { id: subschedule_id, schedule_id },
    transaction: t,
  });
  if (!subSchedule) throw new Error("SubSchedule not found");

  const seatAvailabilities = [];

  // ── 3. Main Schedule SeatAvailability dengan LOCK ─────────
  if (subschedule_id !== schedule_id) {
    let mainSeat = await SeatAvailability.findOne({
      where: { schedule_id, subschedule_id: null, date: booking_date },
      transaction: t,
      lock: t.LOCK.UPDATE, // 🔒 LOCK ditambahkan
    });

    if (!mainSeat) {
      mainSeat = await SeatAvailability.create(
        {
          schedule_id,
          subschedule_id: null,
          transit_id: null,
          available_seats: publicCapacity,
          date: booking_date,
          availability: true,
        },
        { transaction: t }
      );
    }

    mainSeat.available_seats -= total_passengers;
    await mainSeat.save({ transaction: t });

    seatAvailabilities.push(mainSeat);
  }

  // ── 4. Related SubSchedules dengan LOCK ───────────────────
  const relatedSubSchedules = await findRelatedSubSchedules(
    schedule_id,
    subSchedule,
    t
  );

  for (const relSub of relatedSubSchedules) {
    if (relSub.id === subschedule_id) continue;

    let relSeat = await SeatAvailability.findOne({
      where: { schedule_id, subschedule_id: relSub.id, date: booking_date },
      transaction: t,
      lock: t.LOCK.UPDATE, // 🔒 LOCK ditambahkan
    });

    if (!relSeat) {
      relSeat = await SeatAvailability.create(
        {
          schedule_id,
          subschedule_id: relSub.id,
          transit_id: null,
          available_seats: publicCapacity,
          date: booking_date,
          availability: true,
        },
        { transaction: t }
      );
    }

    relSeat.available_seats -= total_passengers;
    await relSeat.save({ transaction: t });

    seatAvailabilities.push(relSeat);
  }

  // ── 5. Selected SubSchedule dengan LOCK ───────────────────
  let selectedSeat = await SeatAvailability.findOne({
    where: { schedule_id, subschedule_id, transit_id: null, date: booking_date },
    transaction: t,
    lock: t.LOCK.UPDATE, // 🔒 LOCK ditambahkan
  });

  if (!selectedSeat) {
    selectedSeat = await SeatAvailability.create(
      {
        schedule_id,
        subschedule_id,
        transit_id: null,
        available_seats: publicCapacity,
        date: booking_date,
        availability: true,
      },
      { transaction: t }
    );
  }

  selectedSeat.available_seats -= total_passengers;
  await selectedSeat.save({ transaction: t });

  seatAvailabilities.push(selectedSeat);

  // ── 6. Return All ─────────────────────────────────────────
  return seatAvailabilities;
};

module.exports = {
  handleSubScheduleBookingWithLock,
};
