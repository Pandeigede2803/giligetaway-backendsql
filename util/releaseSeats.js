const {
  sequelize,
  Booking,
  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  //   AgentCommission,
  Agent,
  BookingSeatAvailability,
  Boat,
} = require("../models");
const { fn, col } = require("sequelize");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");

const releaseMainScheduleSeats = require("../util/releaseMainScheduleSeats");
const releaseSubScheduleSeats = require("../util/releaseSubScheduleSeats");
const { createSeatAvailability } = require("../controllers/scheduleController");
const { findRelatedSubSchedules } = require("../util/handleSubScheduleBooking");

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
  const { schedule_id, subschedule_id, total_passengers, booking_date } =
    booking;
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

    console.log(
      `Successfully released ${total_passengers} seats for Booking ID: ${booking.id}`
    );
    return releasedSeatIds; // Return semua ID SeatAvailability yang dirilis
  } catch (error) {
    console.error(
      `Failed to release seats for Booking ID: ${booking.id}`,
      error
    );
    throw error;
  }
};

// release Booking seat baru

const releaseBookingSeats = async (bookingId, transaction) => {
  console.log(`\n🔄 Starting releaseBookingSeats for booking ID: ${bookingId}`);

  // Step 1: Get the booking details to know how many passengers to release
  const booking = await Booking.findByPk(bookingId, {
    attributes: [
      "id",
      "schedule_id",
      "subschedule_id",
      "total_passengers",
      "booking_date",
    ],
    transaction,
  });

  if (!booking) {
    throw new Error(`Booking with ID ${bookingId} not found`);
  }

  const totalPassengersToRelease = booking.total_passengers || 0;
  console.log(`📊 Total passengers to release: ${totalPassengersToRelease}`);

  if (totalPassengersToRelease <= 0) {
    console.log("⚠️ No passengers to release");
    return [];
  }

  // Step 2: Find all BookingSeatAvailability records for this booking
  const bookingSeatAvailabilities = await BookingSeatAvailability.findAll({
    where: { booking_id: bookingId },
    include: [
      {
        model: SeatAvailability,
        attributes: [
          "id",
          "available_seats",
          "schedule_id",
          "subschedule_id",
          "date",
        ],
      },
    ],
    transaction,
  });

  if (!bookingSeatAvailabilities.length) {
    console.log("⚠️ No BookingSeatAvailability records found for this booking");

    // Jika tidak ada BookingSeatAvailability, cari SeatAvailability berdasarkan schedule, subschedule, dan tanggal
    const seatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id: booking.schedule_id,
        subschedule_id: booking.subschedule_id,
        date: booking.booking_date,
      },
      transaction,
    });

    if (!seatAvailability) {
      console.log("⚠️ No matching SeatAvailability found");
      return [];
    }

    // Update available_seats langsung
    const newAvailableSeats =
      seatAvailability.available_seats + totalPassengersToRelease;
    await seatAvailability.update(
      { available_seats: newAvailableSeats },
      { transaction }
    );

    console.log(
      `✅ Updated SeatAvailability ID ${seatAvailability.id}: available_seats increased by ${totalPassengersToRelease} to ${newAvailableSeats}`
    );
    return [seatAvailability.id];
  }

  console.log(
    `📊 Found ${bookingSeatAvailabilities.length} BookingSeatAvailability records`
  );

  // Step 3: Group BookingSeatAvailability by SeatAvailability.id
  const seatAvailabilityMap = {};

  bookingSeatAvailabilities.forEach((bsa) => {
    if (bsa.SeatAvailability) {
      const saId = bsa.SeatAvailability.id;
      if (!seatAvailabilityMap[saId]) {
        seatAvailabilityMap[saId] = {
          seatAvailability: bsa.SeatAvailability,
          bookingSeatAvailabilityIds: [],
        };
      }
      seatAvailabilityMap[saId].bookingSeatAvailabilityIds.push(bsa.id);
    }
  });

  // Step 4: Update each SeatAvailability record
  const updatedSeatAvailabilityIds = [];

  // Jika ada beberapa SeatAvailability, distribusikan total_passengers
  if (Object.keys(seatAvailabilityMap).length > 1) {
    console.log(
      `⚠️ Multiple SeatAvailability records found (${Object.keys(seatAvailabilityMap).length}). Using booking.total_passengers for all.`
    );
  }

  for (const saId in seatAvailabilityMap) {
    try {
      const { seatAvailability } = seatAvailabilityMap[saId];

      // Untuk setiap SeatAvailability, tambahkan total_passengers ke available_seats
      const newAvailableSeats =
        seatAvailability.available_seats + totalPassengersToRelease;

      await SeatAvailability.update(
        { available_seats: newAvailableSeats },
        {
          where: { id: seatAvailability.id },
          transaction,
        }
      );

      console.log(
        `✅ Updated SeatAvailability ID ${seatAvailability.id}: available_seats increased by ${totalPassengersToRelease} to ${newAvailableSeats}`
      );
      updatedSeatAvailabilityIds.push(seatAvailability.id);
    } catch (error) {
      console.error(`❌ Error updating SeatAvailability ID ${saId}:`, error);
      throw error; // Re-throw to trigger transaction rollback
    }
  }

  // // Step 5: Delete the BookingSeatAvailability records
  // const deletedCount = await BookingSeatAvailability.destroy({
  //   where: { booking_id: bookingId },
  //   transaction
  // });

  // Step 5: Skip deletion of BookingSeatAvailability
  console.log(
    `ℹ️ BookingSeatAvailability records NOT deleted to preserve historical data`
  );

  // Return the IDs of updated SeatAvailability records
  return updatedSeatAvailabilityIds;
};

const allocateBookingSeats = async (bookingId, transaction) => {
  console.log(`\n🔄 Starting allocateBookingSeats for booking ID: ${bookingId}`);

  const booking = await Booking.findByPk(bookingId, {
    include: [
      {
        model: Schedule,
        as: 'schedule',
        include: [{ model: Boat, as: 'Boat' }]
      },
      {
        model: SubSchedule,
        as: 'subSchedule',
        include: [
          {
            model: Schedule,
            as: 'Schedule',
            include: [{ model: Boat, as: 'Boat' }]
          }
        ]
      }
    ],
    transaction
  });

  if (!booking) throw new Error(`Booking with ID ${bookingId} not found`);
  const totalPassengers = booking.total_passengers || 0;
  if (totalPassengers <= 0) return [];

  const selectedSubSchedule = booking.subschedule_id ? booking.subSchedule : null;
  const allocatedSeatAvailabilityIds = [];

  // Step 1: Cek apakah BookingSeatAvailability sudah ada
  const existingBSA = await BookingSeatAvailability.findAll({
    where: { booking_id: booking.id },
    include: [{ model: SeatAvailability, as: 'SeatAvailability' }],
    transaction
  });

  if (existingBSA.length > 0) {
    console.log(`🔎 Found ${existingBSA.length} existing BookingSeatAvailability records. Adjusting SeatAvailability...`);

    for (const bsa of existingBSA) {
      const sa = bsa.SeatAvailability;
      if (!sa) continue;

      const updatedSeats = sa.available_seats - totalPassengers;
      if (updatedSeats < 0) {
        throw new Error(`❌ Not enough seats in SeatAvailability ID ${sa.id}. Needed: ${totalPassengers}, Available: ${sa.available_seats}`);
      }

      await sa.update({ available_seats: updatedSeats }, { transaction });
      console.log(`✅ SeatAvailability ID ${sa.id} updated: -${totalPassengers} → ${updatedSeats}`);

      allocatedSeatAvailabilityIds.push(sa.id);
    }

    return allocatedSeatAvailabilityIds;
  }

  // Step 2: Jika belum ada BSA, cari relasi subschedule dan buat SA + BSA
  let subSchedulesToProcess = [selectedSubSchedule];
  if (selectedSubSchedule) {
    console.log("🔍 Looking for related SubSchedules...");
    const related = await findRelatedSubSchedulesGet(booking.schedule_id, selectedSubSchedule, transaction);
    subSchedulesToProcess = [selectedSubSchedule, ...related];
    console.log(`📦 Found ${related.length} related SubSchedules`);
  }

  for (const ss of subSchedulesToProcess) {
    let sa = await SeatAvailability.findOne({
      where: {
        schedule_id: booking.schedule_id,
        subschedule_id: ss.id,
        date: booking.booking_date
      },
      transaction
    });

    if (!sa) {
      console.log(`ℹ️ SeatAvailability not found for SubSchedule ID ${ss.id}, creating...`);
      sa = await createSeatAvailability(null, ss, booking.booking_date);
    }

    if (sa.available_seats < totalPassengers) {
      throw new Error(`❌ Not enough seats in SubSchedule ID ${ss.id}. Needed: ${totalPassengers}, Available: ${sa.available_seats}`);
    }

    const newAvailable = sa.available_seats - totalPassengers;
    await sa.update({ available_seats: newAvailable }, { transaction });
    console.log(`✅ SeatAvailability ID ${sa.id} updated: -${totalPassengers} → ${newAvailable}`);

    // 🔥 Buat BookingSeatAvailability untuk setiap SeatAvailability yang diproses
    const link = await BookingSeatAvailability.create({
      booking_id: booking.id,
      seat_availability_id: sa.id
    }, { transaction });

    console.log(`📝 Linked BookingSeatAvailability ID: ${link.id}`);
    allocatedSeatAvailabilityIds.push(sa.id);
  }

  return allocatedSeatAvailabilityIds;
};

module.exports = { releaseSeats, releaseBookingSeats, allocateBookingSeats };
