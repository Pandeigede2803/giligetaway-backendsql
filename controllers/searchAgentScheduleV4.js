/**
 * searchAgentScheduleV4.js
 * Controller untuk GET /api/agent-access/search-schedule/v4
 *
 * Optimisasi vs v3:
 * - Raw SQL menggantikan Sequelize ORM (hilangkan ORM overhead)
 * - Sub-schedule: 1 query besar dengan semua JOIN vs 6+ queries terpisah (fix N+1)
 * - Schedule transits: 1 batch query vs per-schedule query
 * - Single formatting pass (vs 3 pass di v3)
 * - SeatAvailability filter sudah include schedule_id di query level
 */

const { Agent } = require('../models');
const { getSchedulesAndSubSchedulesV4 } = require('../util/querySchedulesHelperV4');
const {
  formatRouteTimeline,
  formatRouteString,
  formatRouteSteps,
} = require('../util/querySchedulesHelper');
const { getSeasonPrice } = require('../util/formatSchedules');
const { getNetPrice } = require('../util/agentNetPrice');

// ─────────────────────────────────────────────
// Helper: bentuk objek "shaped" untuk formatRouteTimeline
// (fungsi itu expect struktur Sequelize-like)
// ─────────────────────────────────────────────

const buildScheduleRouteShape = (s) => ({
  FromDestination:  { name: s.from_name },
  ToDestination:    { name: s.to_name },
  departure_time:   s.departure_time,
  arrival_time:     s.arrival_time,
  journey_time:     s.journey_time,
  check_in_time:    s.check_in_time,
  Transits: (s._transits || []).map(t => ({
    Destination:    { name: t.destination_name },
    departure_time: t.departure_time,
    arrival_time:   t.arrival_time,
    journey_time:   t.journey_time,
  }))
});

const buildSubScheduleRouteShape = (sub) => ({
  subschedule_id: sub.subschedule_id,
  DestinationFrom: sub.from_name  ? { name: sub.from_name }    : null,
  DestinationTo:   sub.to_name    ? { name: sub.to_name }      : null,
  TransitFrom: sub.tf_id ? {
    departure_time: sub.tf_dep_time,
    check_in_time:  sub.tf_check_in,
    Destination:    { name: sub.tf_dest_name }
  } : null,
  TransitTo: sub.tt_id ? {
    arrival_time:   sub.tt_arr_time,
    journey_time:   sub.tt_journey,
    Destination:    { name: sub.tt_dest_name }
  } : null,
  Schedule: {
    departure_time: sub.sch_dep_time,
    check_in_time:  sub.sch_check_in,
    arrival_time:   sub.sch_arr_time,
    journey_time:   sub.sch_journey_time,
  },
  Transits: [
    sub.t1_id ? { id: sub.t1_id, Destination: { name: sub.t1_dest }, departure_time: sub.t1_dep, arrival_time: sub.t1_arr, journey_time: sub.t1_journey } : null,
    sub.t2_id ? { id: sub.t2_id, Destination: { name: sub.t2_dest }, departure_time: sub.t2_dep, arrival_time: sub.t2_arr, journey_time: sub.t2_journey } : null,
    sub.t3_id ? { id: sub.t3_id, Destination: { name: sub.t3_dest }, departure_time: sub.t3_dep, arrival_time: sub.t3_arr, journey_time: sub.t3_journey } : null,
    sub.t4_id ? { id: sub.t4_id, Destination: { name: sub.t4_dest }, departure_time: sub.t4_dep, arrival_time: sub.t4_arr, journey_time: sub.t4_journey } : null,
  ].filter(Boolean)
});

// ─────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────

const normalizePrice = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : value;
};

/**
 * Format satu schedule row (raw SQL flat) ke response shape yang sama dengan v3.
 * Single pass — tidak ada triple-map seperti v3.
 */
const formatScheduleRow = (s, selectedDate, agent, validDiscount) => {
  const routeShape = buildScheduleRouteShape(s);
  const routeInfo  = formatRouteTimeline(routeShape);
  const price      = normalizePrice(
    getSeasonPrice(selectedDate, s.low_season_price, s.high_season_price, s.peak_season_price)
  );
  const boost = !!s.sa_boost;

  return {
    id:             s.id,
    schedule_id:    s.id,
    subschedule_id: 'N/A',
    from:           s.from_name || 'N/A',
    to:             s.to_name   || 'N/A',
    route_image:    s.route_image || 'N/A',
    price,
    ...getNetPrice({
      agent,
      tripType: s.trip_type,
      price,
      discount: validDiscount,
      includeTransportCommission: true,
    }),

    boat: {
      id:       s.boat_id,
      name:     s.boat_name,
      capacity: boost ? s.capacity : s.published_capacity,
      image:    s.boat_image,
      seat_layout: {
        inside_seats:  s.inside_seats  || [],
        outside_seats: s.outside_seats || [],
        rooftop_seats: s.rooftop_seats || [],
      }
    },

    seatAvailability: {
      schedule_id:     s.id,
      subschedule_id:  'N/A',
      available_seats: s.sa_available_seats,
      date:            s.sa_id
        ? new Date(selectedDate).toLocaleDateString()
        : 'N/A',
      bookedSeatNumbers: s._bookedSeatNumbers || [],
    },

    route_timeline:   routeInfo.timeline,
    route_description: formatRouteString(routeShape),
    route_steps:       formatRouteSteps(routeShape),
    route_summary:     routeInfo.route_summary,
    route_type:        routeInfo.route_type,
    stops_count:       routeInfo.stops_count,
  };
};

/**
 * Format satu sub-schedule row (raw SQL flat) ke response shape yang sama dengan v3.
 */
const formatSubScheduleRow = (sub, selectedDate, agent, validDiscount) => {
  const routeShape = buildSubScheduleRouteShape(sub);
  const routeInfo  = formatRouteTimeline(routeShape);
  const price      = normalizePrice(
    getSeasonPrice(selectedDate, sub.low_season_price, sub.high_season_price, sub.peak_season_price)
  );
  const boost = !!sub.sa_boost;

  return {
    id:             sub.subschedule_id,
    schedule_id:    sub.schedule_id,
    subschedule_id: sub.subschedule_id,
    from:           sub.from_name || sub.tf_dest_name || 'N/A',
    to:             sub.to_name   || sub.tt_dest_name || 'N/A',
    route_image:    sub.route_image || 'N/A',
    price,
    ...getNetPrice({
      agent,
      tripType: sub.trip_type,
      price,
      discount: validDiscount,
      includeTransportCommission: true,
    }),

    boat: {
      id:       sub.boat_id,
      name:     sub.boat_name,
      capacity: boost ? sub.capacity : sub.published_capacity,
      image:    sub.boat_image,
      seat_layout: {
        inside_seats:  sub.inside_seats  || [],
        outside_seats: sub.outside_seats || [],
        rooftop_seats: sub.rooftop_seats || [],
      }
    },

    seatAvailability: {
      schedule_id:     sub.schedule_id,
      subschedule_id:  sub.subschedule_id,
      available_seats: sub.sa_available_seats,
      date:            sub.sa_id
        ? new Date(selectedDate).toLocaleDateString()
        : 'N/A',
      bookedSeatNumbers: sub._bookedSeatNumbers || [],
    },

    route_timeline:    routeInfo.timeline,
    route_description: formatRouteString(routeShape),
    route_steps:       formatRouteSteps(routeShape),
    route_summary:     routeInfo.route_summary,
    route_type:        routeInfo.route_type,
    stops_count:       routeInfo.stops_count,
  };
};

// ─────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────

const searchSchedulesAndSubSchedulesAgentV4 = async (req, res) => {
  const { from, to, date, passengers_total } = req.query;
  const agentId        = req.query.agent_id || req.body?.agent_id;
  const passengerCount = Number.parseInt(passengers_total, 10);
  const hasPassengers  = Number.isFinite(passengerCount) && passengerCount > 0;
  const validDiscount  = req.discount || null;

  console.log('[v4] searchSchedulesAndSubSchedulesAgentV4 — params:', { from, to, date, passengers_total });

  try {
    const startMs = Date.now();

    // Agent lookup (paralel dengan query schedule di getSchedulesAndSubSchedulesV4 tidak bisa
    // karena perlu agent di formatting, tapi agent lookup cepat)
    const agent = agentId
      ? await Agent.findByPk(agentId, {
          attributes: [
            'id', 'commission_rate',
            'commission_long', 'commission_short',
            'commission_mid', 'commission_intermediate',
            'commission_transport',
          ]
        })
      : null;

    const { schedules, subSchedules, selectedDate } =
      await getSchedulesAndSubSchedulesV4(from, to, date);

    // Debug: cek nilai sa_availability dari raw SQL
    if (schedules.length) {
      console.log('[v4] sample sa_availability:', schedules[0].sa_availability, typeof schedules[0].sa_availability);
    }
    if (subSchedules.length) {
      console.log('[v4] sample sub sa_availability:', subSchedules[0].sa_availability, typeof subSchedules[0].sa_availability);
    }

    // Filter: hanya yang available + available_seats > 0
    // Pakai !! karena MySQL2 bisa return boolean true/false ATAU number 1/0
    const availableSchedules = schedules.filter(
      s => !!s.sa_availability && s.sa_available_seats > 0
    );
    const availableSubSchedules = subSchedules.filter(
      sub => !!sub.sa_availability && sub.sa_available_seats > 0
    );

    console.log(`[v4] after filter — availableSchedules=${availableSchedules.length} availableSubSchedules=${availableSubSchedules.length}`);

    // Filter: passenger count
    let filteredSchedules    = availableSchedules;
    let filteredSubSchedules = availableSubSchedules;

    if (hasPassengers) {
      filteredSchedules = availableSchedules.filter(
        s => (s.sa_available_seats || 0) >= passengerCount
      );
      filteredSubSchedules = availableSubSchedules.filter(
        sub => (sub.sa_available_seats || 0) >= passengerCount
      );

      if (!filteredSchedules.length && !filteredSubSchedules.length) {
        return res.status(200).json({
          status: 'success',
          message: `No schedules available for ${passengerCount} passengers. All selected schedules are full.`,
          data: {
            schedules: [],
            passenger_count_requested: passengerCount,
            seats_availability_issue: true,
          }
        });
      }
    }

    // Single-pass format (v3 butuh 3 pass)
    const formattedSchedules = filteredSchedules.map(s =>
      formatScheduleRow(s, selectedDate, agent, validDiscount)
    );
    const formattedSubSchedules = filteredSubSchedules.map(sub =>
      formatSubScheduleRow(sub, selectedDate, agent, validDiscount)
    );

    const combined = [...formattedSchedules, ...formattedSubSchedules];

    console.log(`[v4] done — ${Date.now() - startMs}ms, results=${combined.length}`);

    return res.status(200).json({
      status: 'success',
      data: {
        schedules: combined,
        ...(hasPassengers && { passenger_count_requested: passengerCount }),
      }
    });
  } catch (error) {
    console.error('[v4] error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { searchSchedulesAndSubSchedulesAgentV4 };
