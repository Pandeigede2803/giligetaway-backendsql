const { sequelize, Booking, BookingSeatAvailability, SeatAvailability } = require("../models");
const { QueryTypes } = require("sequelize");
const { sendTelegramMessage } = require("./telegram");

const pendingSeatIds = new Set();
let isProcessing = false;
let flushTimer = null;

const DEBOUNCE_MS = Number(process.env.SEAT_FIX_EVENT_DEBOUNCE_MS || 3000);
const BATCH_SIZE = Number(process.env.SEAT_FIX_EVENT_BATCH_SIZE || 100);
const BATCH_DELAY_MS = Number(process.env.SEAT_FIX_EVENT_BATCH_DELAY_MS || 50);
const ENABLE_LOG = String(process.env.SEAT_FIX_EVENT_LOG || "true").toLowerCase() === "true";
const ENABLE_TELEGRAM_ERROR =
  String(process.env.SEAT_FIX_EVENT_TELEGRAM_ERROR || "true").toLowerCase() ===
  "true";

const log = (...args) => {
  if (ENABLE_LOG) console.log("[SeatFixEventQueue]", ...args);
};

const normalizeSeatIds = (seatIds = []) => {
  const ids = Array.isArray(seatIds) ? seatIds : [seatIds];
  return ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fixSeatMismatchesBySeatIds = async (seatIds = []) => {
  const ids = normalizeSeatIds(seatIds);
  if (!ids.length) return { checked: 0, fixed: 0 };

  const seatRows = await sequelize.query(
    `
    SELECT
      sa.id,
      sa.available_seats,
      sa.boost,
      b.capacity,
      b.published_capacity
    FROM SeatAvailability sa
    JOIN Schedules s ON s.id = sa.schedule_id
    JOIN Boats b ON b.id = s.boat_id
    WHERE sa.id IN (:seatIds)
    `,
    {
      replacements: { seatIds: ids },
      type: QueryTypes.SELECT,
    }
  );

  if (!seatRows.length) return { checked: 0, fixed: 0 };

  const occupiedRows = await sequelize.query(
    `
    SELECT
      sa.id AS seat_availability_id,
      COUNT(
        DISTINCT UPPER(
          REPLACE(
            REPLACE(
              REPLACE(TRIM(p.seat_number), CHAR(13), ''),
            CHAR(10), ''),
          ' ', '')
        )
      ) AS occupied_seats
    FROM SeatAvailability sa
    LEFT JOIN BookingSeatAvailability bsa ON bsa.seat_availability_id = sa.id
    LEFT JOIN Bookings b
      ON b.id = bsa.booking_id
     AND b.payment_status IN ('paid', 'invoiced', 'unpaid')
    LEFT JOIN Passengers p
      ON p.booking_id = b.id
     AND (p.passenger_type IS NULL OR p.passenger_type <> 'infant')
     AND p.seat_number IS NOT NULL
     AND TRIM(p.seat_number) <> ''
    WHERE sa.id IN (:seatIds)
    GROUP BY sa.id
    `,
    {
      replacements: { seatIds: ids },
      type: QueryTypes.SELECT,
    }
  );

  const occupiedMap = new Map(
    occupiedRows.map((row) => [Number(row.seat_availability_id), Number(row.occupied_seats || 0)])
  );

  const updates = [];
  for (const row of seatRows) {
    const occupiedSeats = occupiedMap.get(Number(row.id)) || 0;
    const capacity = row.boost
      ? Number(row.capacity || 0)
      : Number(row.published_capacity || 0);
    const correctAvailableSeats = Math.max(0, capacity - occupiedSeats);

    if (Number(row.available_seats) !== correctAvailableSeats) {
      updates.push({ id: Number(row.id), availableSeats: correctAvailableSeats });
    }
  }

  if (updates.length) {
    await sequelize.transaction(async (t) => {
      for (const upd of updates) {
        await SeatAvailability.update(
          { available_seats: upd.availableSeats },
          {
            where: { id: upd.id },
            transaction: t,
          }
        );
      }
    });
  }

  return {
    checked: seatRows.length,
    fixed: updates.length,
  };
};

const flushSeatFixQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;
  const startedAt = Date.now();
  let totalChecked = 0;
  let totalFixed = 0;
  let batches = 0;

  try {
    while (pendingSeatIds.size > 0) {
      const batchIds = Array.from(pendingSeatIds).slice(0, BATCH_SIZE);
      batchIds.forEach((id) => pendingSeatIds.delete(id));
      batches += 1;

      const result = await fixSeatMismatchesBySeatIds(batchIds);
      totalChecked += result.checked;
      totalFixed += result.fixed;

      log(
        `batch=${batches} checked=${result.checked} fixed=${result.fixed} remaining=${pendingSeatIds.size}`
      );

      if (BATCH_DELAY_MS > 0) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    log(
      `done checked=${totalChecked} fixed=${totalFixed} batches=${batches} durationMs=${Date.now() - startedAt}`
    );
  } catch (error) {
    console.error("[SeatFixEventQueue] flush failed:", error.message);
    if (ENABLE_TELEGRAM_ERROR) {
      await sendTelegramMessage(
        [
          "❌ <b>SeatFix Event Queue Error</b>",
          `Checked: ${totalChecked}`,
          `Fixed: ${totalFixed}`,
          `Batches: ${batches}`,
          `Remaining: ${pendingSeatIds.size}`,
          `Error: ${error.message}`,
        ].join("\n")
      );
    }
  } finally {
    isProcessing = false;
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushSeatFixQueue();
  }, DEBOUNCE_MS);
};

const enqueueSeatFixBySeatIds = async (seatIds = [], context = {}) => {
  const ids = normalizeSeatIds(seatIds);
  if (!ids.length) return { enqueued: 0, pending: pendingSeatIds.size };

  ids.forEach((id) => pendingSeatIds.add(id));
  log(
    `enqueue seatIds=${ids.length} pending=${pendingSeatIds.size} reason=${context.reason || "n/a"}`
  );
  scheduleFlush();
  return { enqueued: ids.length, pending: pendingSeatIds.size };
};

const enqueueSeatFixByBookingId = async (bookingId, context = {}) => {
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) {
    return { enqueued: 0, pending: pendingSeatIds.size };
  }

  const bsaRows = await BookingSeatAvailability.findAll({
    where: { booking_id: id },
    attributes: ["seat_availability_id"],
    raw: true,
  });

  let seatIds = bsaRows.map((row) => row.seat_availability_id);

  // Fallback if BSA links are missing
  if (!seatIds.length) {
    const booking = await Booking.findByPk(id, {
      attributes: ["schedule_id", "subschedule_id", "booking_date"],
      raw: true,
    });

    if (booking) {
      const fallbackSeat = await SeatAvailability.findOne({
        where: {
          schedule_id: booking.schedule_id,
          subschedule_id: booking.subschedule_id,
          date: booking.booking_date,
        },
        attributes: ["id"],
        raw: true,
      });
      if (fallbackSeat?.id) seatIds = [fallbackSeat.id];
    }
  }

  return enqueueSeatFixBySeatIds(seatIds, {
    ...context,
    bookingId: id,
  });
};

const getSeatFixQueueStats = () => ({
  pending: pendingSeatIds.size,
  isProcessing,
  hasScheduledFlush: Boolean(flushTimer),
  debounceMs: DEBOUNCE_MS,
  batchSize: BATCH_SIZE,
  batchDelayMs: BATCH_DELAY_MS,
});

module.exports = {
  enqueueSeatFixBySeatIds,
  enqueueSeatFixByBookingId,
  flushSeatFixQueue,
  getSeatFixQueueStats,
  fixSeatMismatchesBySeatIds,
};

