/**
 * querySchedulesHelperV4.js
 * V4 — Raw SQL approach menggantikan Sequelize ORM untuk performa maksimal.
 * Menggantikan v3 yang lambat karena N+1 Transit queries dan multiple ORM overhead.
 */

const { SeatAvailability, sequelize } = require('../models');
const { processBookedSeats } = require('./seatUtils');
const { getDay } = require('date-fns');

// ─────────────────────────────────────────────
// 1. QUERY SCHEDULES (direct)
// ─────────────────────────────────────────────

/**
 * Raw SQL: ambil semua direct schedules + boat + destinations + seat availability.
 * Transits di-fetch terpisah via queryScheduleTransitsRaw (batch, bukan per-schedule).
 */
const querySchedulesRaw = async (from, to, selectedDate, dayBit) => {
  const dateStr = selectedDate.toISOString().slice(0, 10);
  return sequelize.query(`
    SELECT
      s.id,
      s.route_image,
      s.low_season_price, s.high_season_price, s.peak_season_price,
      s.departure_time,   s.check_in_time,      s.arrival_time,  s.journey_time,
      s.trip_type,

      d1.id   AS from_id,   d1.name AS from_name,
      d2.id   AS to_id,     d2.name AS to_name,

      b.id    AS boat_id,   b.capacity,           b.boat_name,   b.boat_image,
      b.inside_seats,       b.outside_seats,      b.rooftop_seats, b.published_capacity,

      sa.id              AS sa_id,
      sa.available_seats AS sa_available_seats,
      sa.availability    AS sa_availability,
      sa.boost           AS sa_boost

    FROM Schedules s
    INNER JOIN Destinations d1 ON d1.id = s.destination_from_id
    INNER JOIN Destinations d2 ON d2.id = s.destination_to_id
    INNER JOIN Boats b         ON b.id  = s.boat_id
    LEFT  JOIN SeatAvailability sa
           ON sa.schedule_id    = s.id
          AND sa.subschedule_id IS NULL
          AND sa.date           = :date

    WHERE s.destination_from_id = :from
      AND s.destination_to_id   = :to
      AND s.availability        = 1
      AND s.validity_start     <= :date
      AND s.validity_end        > :date
      AND (s.days_of_week & :dayBit) != 0
  `, {
    replacements: { from, to, date: dateStr, dayBit },
    type: sequelize.QueryTypes.SELECT
  });
};

/**
 * Raw SQL: batch ambil semua transits untuk sekumpulan schedule IDs.
 * Satu query, bukan N queries (fix N+1).
 */
const queryScheduleTransitsRaw = async (scheduleIds) => {
  if (!scheduleIds.length) return [];
  return sequelize.query(`
    SELECT
      t.id,
      t.schedule_id,
      t.departure_time, t.arrival_time, t.journey_time, t.check_in_time,
      d.name AS destination_name
    FROM Transits t
    INNER JOIN Destinations d ON d.id = t.destination_id
    WHERE t.schedule_id IN (:scheduleIds)
    ORDER BY t.schedule_id, t.id
  `, {
    replacements: { scheduleIds },
    type: sequelize.QueryTypes.SELECT
  });
};

// ─────────────────────────────────────────────
// 2. QUERY SUB-SCHEDULES
// ─────────────────────────────────────────────

/**
 * Raw SQL: ambil semua sub-schedules dengan SEMUA join dalam satu query.
 * Menggantikan 6 Transit associations terpisah (TransitFrom, TransitTo, Transit1-4).
 * Fix utama N+1 problem v3.
 */
const querySubSchedulesRaw = async (from, to, selectedDate, dayBit) => {
  const dateStr = selectedDate.toISOString().slice(0, 10);
  return sequelize.query(`
    SELECT
      sub.id              AS subschedule_id,
      sub.schedule_id,
      sub.route_image,
      sub.low_season_price, sub.high_season_price, sub.peak_season_price,
      sub.trip_type,
      sub.destination_from_schedule_id,
      sub.destination_to_schedule_id,
      sub.transit_from_id,
      sub.transit_to_id,
      sub.transit_1, sub.transit_2, sub.transit_3, sub.transit_4,

      sch.departure_time  AS sch_dep_time,
      sch.check_in_time   AS sch_check_in,
      sch.arrival_time    AS sch_arr_time,
      sch.journey_time    AS sch_journey_time,

      b.id                AS boat_id,
      b.capacity,         b.boat_name,   b.boat_image,
      b.inside_seats,     b.outside_seats, b.rooftop_seats, b.published_capacity,

      df.name             AS from_name,
      dt.name             AS to_name,

      tf.id               AS tf_id,
      tf.departure_time   AS tf_dep_time,
      tf.check_in_time    AS tf_check_in,
      tf.arrival_time     AS tf_arr_time,
      tf.journey_time     AS tf_journey,
      tf.destination_id   AS tf_dest_id,
      df_tf.name          AS tf_dest_name,

      tt.id               AS tt_id,
      tt.departure_time   AS tt_dep_time,
      tt.arrival_time     AS tt_arr_time,
      tt.journey_time     AS tt_journey,
      tt.destination_id   AS tt_dest_id,
      dt_tt.name          AS tt_dest_name,

      t1.id               AS t1_id,
      t1.departure_time   AS t1_dep,  t1.arrival_time AS t1_arr,  t1.journey_time AS t1_journey,
      d_t1.name           AS t1_dest,

      t2.id               AS t2_id,
      t2.departure_time   AS t2_dep,  t2.arrival_time AS t2_arr,  t2.journey_time AS t2_journey,
      d_t2.name           AS t2_dest,

      t3.id               AS t3_id,
      t3.departure_time   AS t3_dep,  t3.arrival_time AS t3_arr,  t3.journey_time AS t3_journey,
      d_t3.name           AS t3_dest,

      t4.id               AS t4_id,
      t4.departure_time   AS t4_dep,  t4.arrival_time AS t4_arr,  t4.journey_time AS t4_journey,
      d_t4.name           AS t4_dest,

      sa.id              AS sa_id,
      sa.available_seats AS sa_available_seats,
      sa.availability    AS sa_availability,
      sa.boost           AS sa_boost

    FROM SubSchedules sub
    INNER JOIN Schedules    sch    ON sch.id    = sub.schedule_id
    INNER JOIN Boats        b      ON b.id      = sch.boat_id
    LEFT  JOIN Destinations df     ON df.id     = sub.destination_from_schedule_id
    LEFT  JOIN Destinations dt     ON dt.id     = sub.destination_to_schedule_id
    LEFT  JOIN Transits     tf     ON tf.id     = sub.transit_from_id
    LEFT  JOIN Destinations df_tf  ON df_tf.id  = tf.destination_id
    LEFT  JOIN Transits     tt     ON tt.id     = sub.transit_to_id
    LEFT  JOIN Destinations dt_tt  ON dt_tt.id  = tt.destination_id
    LEFT  JOIN Transits     t1     ON t1.id     = sub.transit_1
    LEFT  JOIN Destinations d_t1   ON d_t1.id   = t1.destination_id
    LEFT  JOIN Transits     t2     ON t2.id     = sub.transit_2
    LEFT  JOIN Destinations d_t2   ON d_t2.id   = t2.destination_id
    LEFT  JOIN Transits     t3     ON t3.id     = sub.transit_3
    LEFT  JOIN Destinations d_t3   ON d_t3.id   = t3.destination_id
    LEFT  JOIN Transits     t4     ON t4.id     = sub.transit_4
    LEFT  JOIN Destinations d_t4   ON d_t4.id   = t4.destination_id
    LEFT  JOIN SeatAvailability sa
           ON sa.schedule_id    = sub.schedule_id
          AND sa.subschedule_id = sub.id
          AND sa.date           = :date

    WHERE sub.availability  = 1
      AND sub.validity_start <= :date
      AND sub.validity_end    > :date
      AND (sub.days_of_week & :dayBit) != 0
      AND (
            sub.destination_from_schedule_id = :from
         OR tf.destination_id               = :from
          )
      AND (
            sub.destination_to_schedule_id   = :to
         OR tt.destination_id               = :to
          )
  `, {
    replacements: { from, to, date: dateStr, dayBit },
    type: sequelize.QueryTypes.SELECT
  });
};

// ─────────────────────────────────────────────
// 3. SEAT AVAILABILITY
// ─────────────────────────────────────────────

/**
 * Buat SeatAvailability yang belum ada, batch insert.
 * Mutates: set sa_id, sa_available_seats, sa_availability, sa_boost pada rows yang missing.
 */
const createMissingSeatAvailabilityV4 = async (schedules, subSchedules, selectedDate) => {
  const toCreate = [];
  const refs = [];

  schedules.forEach(s => {
    if (!s.sa_id) {
      toCreate.push({
        schedule_id: s.id,
        subschedule_id: null,
        date: selectedDate,
        available_seats: s.capacity || 0,
        availability: true,
        boost: false
      });
      refs.push({ type: 'schedule', id: s.id });
    }
  });

  subSchedules.forEach(sub => {
    if (!sub.sa_id) {
      if (!sub.schedule_id) {
        console.warn(`[v4] skip create: subschedule_id=${sub.subschedule_id} has no schedule_id`);
        return;
      }
      toCreate.push({
        schedule_id: sub.schedule_id,
        subschedule_id: sub.subschedule_id,
        date: selectedDate,
        available_seats: sub.capacity || 0,
        availability: true,
        boost: false
      });
      refs.push({ type: 'subSchedule', id: sub.subschedule_id });
    }
  });

  if (!toCreate.length) {
    console.log('[v4] createMissing: skip — no missing seat availabilities');
    return;
  }

  console.log(`[v4] createMissing: creating count=${toCreate.length}`);
  const created = await SeatAvailability.bulkCreate(toCreate, { returning: true });

  created.forEach((newSa, i) => {
    const ref = refs[i];
    const row = ref.type === 'schedule'
      ? schedules.find(s => s.id === ref.id)
      : subSchedules.find(s => s.subschedule_id === ref.id);

    if (row) {
      row.sa_id             = newSa.id;
      row.sa_available_seats = newSa.available_seats;
      row.sa_availability    = newSa.availability;
      row.sa_boost           = newSa.boost;
    }
  });
};

/**
 * Raw SQL: batch ambil booked seats (reuse logic sama dengan v3).
 */
const getBookedSeatsOptimizedV4 = async (seatAvailabilityIds) => {
  if (!seatAvailabilityIds.length) return {};

  const rows = await sequelize.query(`
    SELECT
      bsa.seat_availability_id,
      p.seat_number
    FROM BookingSeatAvailability bsa
    JOIN Bookings b  ON bsa.booking_id = b.id
    JOIN Passengers p ON p.booking_id  = b.id
    WHERE bsa.seat_availability_id IN (:ids)
      AND b.payment_status IN ('paid', 'invoiced', 'pending', 'unpaid')
      AND p.seat_number IS NOT NULL
  `, {
    replacements: { ids: seatAvailabilityIds },
    type: sequelize.QueryTypes.SELECT
  });

  const result = {};
  seatAvailabilityIds.forEach(id => { result[id] = []; });
  rows.forEach(({ seat_availability_id, seat_number }) => {
    if (result[seat_availability_id]) result[seat_availability_id].push(seat_number);
  });
  return result;
};

// ─────────────────────────────────────────────
// 4. MAIN FUNCTION
// ─────────────────────────────────────────────

const getSchedulesAndSubSchedulesV4 = async (from, to, date) => {
  console.log('[v4] getSchedulesAndSubSchedules start — from:', from, 'to:', to, 'date:', date);
  const selectedDate = new Date(date);
  const dayBit = 1 << getDay(selectedDate);

  // Parallel: schedules + sub-schedules
  const [schedules, subSchedules] = await Promise.all([
    querySchedulesRaw(from, to, selectedDate, dayBit),
    querySubSchedulesRaw(from, to, selectedDate, dayBit)
  ]);
  console.log(`[v4] query done — schedules=${schedules.length} subSchedules=${subSchedules.length}`);

  // Batch transit fetch untuk schedules (satu query)
  const scheduleIds = schedules.map(s => s.id);
  const allTransits = await queryScheduleTransitsRaw(scheduleIds);
  const transitsByScheduleId = {};
  allTransits.forEach(t => {
    if (!transitsByScheduleId[t.schedule_id]) transitsByScheduleId[t.schedule_id] = [];
    transitsByScheduleId[t.schedule_id].push(t);
  });
  schedules.forEach(s => { s._transits = transitsByScheduleId[s.id] || []; });
  console.log(`[v4] transits fetched — total=${allTransits.length}`);

  // Create missing seat availabilities
  await createMissingSeatAvailabilityV4(schedules, subSchedules, selectedDate);

  // Collect all sa_ids
  const allSaIds = [
    ...schedules.filter(s => s.sa_id).map(s => s.sa_id),
    ...subSchedules.filter(s => s.sa_id).map(s => s.sa_id)
  ];
  console.log(`[v4] sa_ids collected — count=${allSaIds.length}`);

  // Build seat data map (untuk processBookedSeats)
  const seatDataMap = new Map();
  schedules.forEach(s => {
    if (s.sa_id) {
      seatDataMap.set(s.sa_id, {
        boost: !!s.sa_boost,
        boatData: {
          inside_seats:  s.inside_seats,
          outside_seats: s.outside_seats,
          rooftop_seats: s.rooftop_seats
        }
      });
    }
  });
  subSchedules.forEach(sub => {
    if (sub.sa_id) {
      seatDataMap.set(sub.sa_id, {
        boost: !!sub.sa_boost,
        boatData: {
          inside_seats:  sub.inside_seats,
          outside_seats: sub.outside_seats,
          rooftop_seats: sub.rooftop_seats
        }
      });
    }
  });

  // Booked seats
  const rawBookedSeats = await getBookedSeatsOptimizedV4(allSaIds);
  const processedBookedSeats = {};
  for (const saId of allSaIds) {
    const raw      = rawBookedSeats[saId] || [];
    const seatData = seatDataMap.get(saId);
    processedBookedSeats[saId] = seatData
      ? processBookedSeats(new Set(raw), seatData.boost, seatData.boatData)
      : raw;
  }

  // Attach booked seat numbers
  schedules.forEach(s => {
    s._bookedSeatNumbers = s.sa_id ? (processedBookedSeats[s.sa_id] || []) : [];
  });
  subSchedules.forEach(sub => {
    sub._bookedSeatNumbers = sub.sa_id ? (processedBookedSeats[sub.sa_id] || []) : [];
  });

  console.log('[v4] getSchedulesAndSubSchedules done');
  return { schedules, subSchedules, selectedDate };
};

module.exports = {
  getSchedulesAndSubSchedulesV4,
};
