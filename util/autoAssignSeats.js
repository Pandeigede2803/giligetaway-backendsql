const { QueryTypes } = require("sequelize");
const {
  sequelize,
  Schedule,
  Boat,
  SeatAvailability,
  Passenger,
} = require("../models");
const { processBookedSeats } = require("./seatUtils");

const ACTIVE_BOOKING_STATUSES = ["paid", "invoiced", "pending", "unpaid"];
const ACTIVE_STATUS_SQL = ACTIVE_BOOKING_STATUSES.map((status) => `'${status}'`).join(",");

const normalizeSeat = (value = "") => {
  if (!value || typeof value !== "string") return null;
  return value.replace(/\s+/g, "").replace(/\r|\n/g, "").toUpperCase();
};

const extractSeatValue = (entry) => {
  if (!entry && entry !== 0) return null;
  if (typeof entry === "string") return entry.trim();
  if (typeof entry === "number") return String(entry);
  if (typeof entry === "object") {
    return (
      entry.seat_number ||
      entry.code ||
      entry.label ||
      entry.name ||
      entry.value ||
      entry.seat ||
      null
    );
  }
  return null;
};

const parseSeatCollection = (value) => {
  if (!value) return [];
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (err) {
      parsed = value.split(",").map((item) => item.trim());
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(extractSeatValue)
    .filter((seat) => typeof seat === "string" && seat.trim() !== "");
};

const buildSeatCatalog = (boat) => {
  const sections = [boat.inside_seats, boat.outside_seats, boat.rooftop_seats];
  const catalog = [];
  const seen = new Set();

  for (const section of sections) {
    const seats = parseSeatCollection(section);
    for (const seat of seats) {
      const normalized = normalizeSeat(seat);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      catalog.push({ raw: seat, normalized });
    }
  }
  return catalog;
};

const passengerNeedsSeat = (passenger = {}) =>
  (passenger.passenger_type || "").toLowerCase() !== "infant";

const getSeatContextForSchedule = async (scheduleId) => {
  const schedule = await Schedule.findByPk(scheduleId, {
    include: [{ model: Boat, as: "Boat" }],
  });

  if (!schedule || !schedule.Boat) {
    throw new Error(`Boat untuk schedule ${scheduleId} tidak ditemukan.`);
  }

  const catalog = buildSeatCatalog(schedule.Boat);
  if (!catalog.length) {
    throw new Error(
      `Boat ${schedule.Boat.id} belum memiliki daftar kursi (inside/outside/rooftop seats).`
    );
  }

  return { catalog, boat: schedule.Boat };
};

const findSeatAvailabilityRow = async ({
  scheduleId,
  subscheduleId,
  travelDate,
}) => {
  if (!travelDate) return null;

  const where = {
    schedule_id: scheduleId,
    date: travelDate,
  };

  if (subscheduleId == null) {
    where.subschedule_id = null;
  } else {
    where.subschedule_id = subscheduleId;
  }

  return SeatAvailability.findOne({ where });
};

const querySeatsByAvailability = async (seatAvailabilityId, bookingId) => {
  const rows = await sequelize.query(
    `
    SELECT DISTINCT p.seat_number AS seat_number
    FROM BookingSeatAvailability bsa
    JOIN Bookings b ON bsa.booking_id = b.id
    JOIN Passengers p ON p.booking_id = b.id
    WHERE bsa.seat_availability_id = :seatAvailabilityId
      AND b.payment_status IN (${ACTIVE_STATUS_SQL})
      AND p.seat_number IS NOT NULL
      AND b.id <> :bookingId
  `,
    {
      replacements: { seatAvailabilityId, bookingId },
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((row) => row.seat_number).filter(Boolean);
};

const querySeatsBySchedule = async ({
  scheduleId,
  subscheduleId,
  travelDate,
  bookingId,
}) => {
  const subscheduleFilter = subscheduleId != null ? "= :subscheduleId" : "IS NULL";
  const rows = await sequelize.query(
    `
    SELECT DISTINCT p.seat_number AS seat_number
    FROM Passengers p
    JOIN Bookings b ON p.booking_id = b.id
    WHERE p.seat_number IS NOT NULL
      AND b.schedule_id = :scheduleId
      AND b.subschedule_id ${subscheduleFilter}
      AND DATE(b.booking_date) = :travelDate
      AND b.payment_status IN (${ACTIVE_STATUS_SQL})
      AND b.id <> :bookingId
  `,
    {
      replacements: { scheduleId, travelDate, subscheduleId, bookingId },
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((row) => row.seat_number).filter(Boolean);
};

const fetchUsedSeatSet = async ({
  scheduleId,
  subscheduleId,
  travelDate,
  boat,
  bookingId,
}) => {
  const seatAvailability = await findSeatAvailabilityRow({
    scheduleId,
    subscheduleId,
    travelDate,
  });

  let rawSeats = [];
  let boost = false;

  if (seatAvailability) {
    rawSeats = await querySeatsByAvailability(seatAvailability.id, bookingId);
    boost = Boolean(seatAvailability.boost);
  } else {
    rawSeats = await querySeatsBySchedule({
      scheduleId,
      subscheduleId,
      travelDate,
      bookingId,
    });
  }

  const processed = processBookedSeats(new Set(rawSeats), boost, boat);
  const usedSeats = new Set();
  processed.forEach((seat) => {
    const normalized = normalizeSeat(seat);
    if (normalized) usedSeats.add(normalized);
  });
  return usedSeats;
};

const assignSeatToPassenger = ({
  passenger,
  catalog,
  lookup,
  usedSeats,
  cursorRef,
}) => {
  const existingSeat = passenger.seat_number;
  const normalizedExisting = normalizeSeat(existingSeat);

  if (normalizedExisting && lookup.has(normalizedExisting)) {
    if (!usedSeats.has(normalizedExisting)) {
      usedSeats.add(normalizedExisting);
      return existingSeat;
    }
  }

  let assigned = null;
  while (cursorRef.index < catalog.length && !assigned) {
    const candidate = catalog[cursorRef.index++];
    if (!usedSeats.has(candidate.normalized)) {
      assigned = candidate.raw;
      usedSeats.add(candidate.normalized);
    }
  }

  return assigned;
};

const autoAssignSeatsForBooking = async ({
  bookingId,
  scheduleId,
  subscheduleId,
  travelDate,
}) => {
  const { catalog, boat } = await getSeatContextForSchedule(scheduleId);
  const lookup = new Map(catalog.map((seat) => [seat.normalized, seat.raw]));
  const usedSeats = await fetchUsedSeatSet({
    scheduleId,
    subscheduleId,
    travelDate,
    boat,
    bookingId,
  });

  const passengers = await Passenger.findAll({
    where: { booking_id: bookingId },
    order: [["id", "ASC"]],
  });

  const updates = [];
  const changes = [];
  const cursorRef = { index: 0 };
  let needsSeatCount = 0;

  for (const passenger of passengers) {
    if (!passengerNeedsSeat(passenger)) continue;
    needsSeatCount++;

    let seatToUse = assignSeatToPassenger({
      passenger,
      catalog,
      lookup,
      usedSeats,
      cursorRef,
    });

    if (!seatToUse) {
      throw new Error(
        `Kursi penuh untuk schedule ${scheduleId} di tanggal ${travelDate}.`
      );
    }

    if (seatToUse !== passenger.seat_number) {
      updates.push(passenger.update({ seat_number: seatToUse }));
      changes.push({
        passenger_id: passenger.id,
        name: passenger.name,
        before: passenger.seat_number,
        after: seatToUse,
      });
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  return {
    updatedPassengers: updates.length,
    totalPassengers: needsSeatCount,
    changes,
  };
};

module.exports = {
  autoAssignSeatsForBooking,
  normalizeSeat,
};
