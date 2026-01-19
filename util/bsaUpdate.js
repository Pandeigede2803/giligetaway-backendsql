// utils/bsaDelete.jsconst { Op } = require('sequelize');
const {

  SeatAvailability,
  Destination,
  Passenger,
  Booking,
  BookingSeatAvailability,
  sequelize,
} = require("../models");
const { Op, fn, col, literal } = require('sequelize');
const {
  handleSubScheduleBooking,
} = require("../util/handleSubScheduleBooking");
const handleMainScheduleBooking = require("../util/handleMainScheduleBooking");

// Import versi dengan lock untuk updateScheduleBooking
const { handleSubScheduleBookingWithLock } = require("../util/handleSubScheduleBookingWithLock");
const handleMainScheduleBookingWithLock = require("../util/handleMainScheduleBookingWithLock");


/**
 * Release seats from current SA rows & delete BSA links for a booking.
 * Returns { releasedSaIds: number[] }
 */
async function deleteOldBookingSeatLinks(booking, t, options = {}) {
  const { totalPassengers: count = Number(booking.total_passengers) } = options;

  // lock BSA + SA to avoid races
  const links = await BookingSeatAvailability.findAll({
    where: { booking_id: booking.id },
    include: [{ model: SeatAvailability, as: 'SeatAvailability', required: true }],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!links.length) {
    console.log(`[BSA:DELETE] No existing links for booking #${booking.id}`);
    return { releasedSaIds: [] };
  }

  // release seats back to each SA (simple: same count to every SA; adjust if split logic applies)
  for (const link of links) {
    const sa = link.SeatAvailability;
    await SeatAvailability.update(
      { available_seats: sequelize.literal(`GREATEST(available_seats + ${count}, 0)`) },
      { where: { id: sa.id }, transaction: t }
    );
  }

  // delete links
  await BookingSeatAvailability.destroy({
    where: { booking_id: booking.id },
    transaction: t,
  });

  const releasedSaIds = links.map(l => l.seat_availability_id);
  console.log(`[BSA:DELETE] Booking #${booking.id} released + deleted links:`, releasedSaIds);
  return { releasedSaIds };
};


async function createBookingSeatLinksForRoute(booking, params, t, opts = {}) {
  const { scheduleId, subscheduleId = null, date } = params;
  const { requireSameDate = false, useLock = true } = opts; // default useLock = true untuk updateScheduleBooking

  // 1) Get the correct, correlated SeatAvailability rows via your helpers.
  //    These helpers are expected to ensure/create SA rows, check capacity,
  //    and decrement availability as needed.
  let saList;
  if (subscheduleId) {
    // Gunakan versi dengan lock untuk mencegah race condition
    if (useLock) {
      saList = await handleSubScheduleBookingWithLock(
        scheduleId,
        subscheduleId,
        date,
        booking.total_passengers,
        t
      );
    } else {
      saList = await handleSubScheduleBooking(
        scheduleId,
        subscheduleId,
        date,
        booking.total_passengers,
        null,            // keep your original signature
        t
      );
    }
  } else {
    // Gunakan versi dengan lock untuk mencegah race condition
    if (useLock) {
      saList = await handleMainScheduleBookingWithLock(
        scheduleId,
        date,
        booking.total_passengers,
        t
      );
    } else {
      saList = await handleMainScheduleBooking(
        scheduleId,
        date,
        booking.total_passengers,
        t
      );
    }
  }

  // Normalize to array
  saList = Array.isArray(saList) ? saList : [saList].filter(Boolean);

  if (!saList.length) {
    throw new Error('No SeatAvailability rows returned by correlation helper');
  }

  // Optional safety: enforce same date
  if (requireSameDate) {
    for (const sa of saList) {
      if (String(sa.date) !== String(date)) {
        throw new Error(`SeatAvailability#${sa.id} has date ${sa.date} != ${date}`);
      }
    }
  }

  // 2) Deduplicate SA ids (defensive if helper returns duplicates)
  const saIds = [...new Set(saList.map(sa => sa.id))];

  // 3) Create BookingSeatAvailability links (bulk)
  const rows = saIds.map((id) => ({
    booking_id: booking.id,
    seat_availability_id: id,
  }));

  // If your table has a UNIQUE (booking_id, seat_availability_id), you can use ignoreDuplicates
  await BookingSeatAvailability.bulkCreate(rows, { transaction: t /*, ignoreDuplicates: true */ });

  // Logging is up to you; keep it terse for debugging
  // console.log(`[BSA:CREATE] booking=${booking.id} saIds=${saIds.join(',')}`);

  return { createdSaIds: saIds };
}



async function checkDuplicateSeatNumbers(bookingId, t) {
  // 1) group by seat_number to see which ones repeat
  const grouped = await Passenger.findAll({
    attributes: [
      'seat_number',
      [fn('COUNT', col('seat_number')), 'count'],
    ],
    where: {
      booking_id: bookingId,
      seat_number: { [Op.ne]: null },
    },
    group: ['seat_number'],
    having: literal('COUNT(seat_number) > 1'),
    transaction: t,
  });

  if (!grouped.length) {
    return { hasDuplicates: false, duplicates: [] };
  }

  // 2) fetch passenger ids for the duplicated seat_numbers
  const dupSeatNums = grouped.map(g => String(g.get('seat_number')));
  const dupPassengers = await Passenger.findAll({
    attributes: ['id', 'seat_number', 'full_name'], // adjust field names if needed
    where: {
      booking_id: bookingId,
      seat_number: { [Op.in]: dupSeatNums },
    },
    transaction: t,
  });

  // 3) map seat_number => passenger_ids
  const map = new Map(); // seat_number -> { count, passenger_ids: [], passengers: [] }
  for (const g of grouped) {
    const sn = String(g.get('seat_number'));
    map.set(sn, { count: Number(g.get('count')), passenger_ids: [], passengers: [] });
  }
  for (const p of dupPassengers) {
    const sn = String(p.seat_number);
    if (!map.has(sn)) continue;
    map.get(sn).passenger_ids.push(p.id);
    map.get(sn).passengers.push({ id: p.id, name: p.full_name ?? null, seat_number: sn });
  }

  const duplicates = [...map.entries()].map(([seat_number, info]) => ({
    seat_number,
    count: info.count,
    passenger_ids: info.passenger_ids,
    passengers: info.passengers,
  }));

  return { hasDuplicates: true, duplicates };
}




module.exports = { deleteOldBookingSeatLinks, createBookingSeatLinksForRoute,checkDuplicateSeatNumbers };