// middlewares/validateScheduleForBookingChange.js
const { Booking, Schedule, SeatAvailability } = require('../models');

/** =========================
 * Helpers (SUN-FIRST bitmask)
 * 0=Sun..6=Sat  → bit = (1 << dow)
 * Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
 * ========================= */

// Compute weekday bit from a YYYY-MM-DD string (UTC, to avoid TZ drift)
function weekdayBitFromDateStrSunFirst(dateStr) {
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date format: ${dateStr}`);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0..6 (Sun..Sat)
  const bit = 1 << dow; // Sun=1, Mon=2, ..., Sat=64
  return { bit, dow };
}

// Decode a Sun-first days_of_week bitmask → array of day names
function getAvailableDaysSunFirst(daysOfWeek) {
  const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; // 0..6
  const n = Number(daysOfWeek || 0);
  const out = [];
  for (let dow = 0; dow < 7; dow++) {
    const bit = 1 << dow; // Sun-first
    if ((n & bit) === bit) out.push(names[dow]);
  }
  return out;
}

module.exports = async function validateScheduleForBookingChange(req, res, next) {
  try {
    console.log('\n[validateScheduleForBookingChange] === Starting middleware ===');

    const { id } = req.params;

    // Accept alias: booking_date -> new_booking_date (back-compat)
    const {
      new_schedule_id,
      new_subschedule_id = null,
      new_booking_date,
      booking_date: alias_booking_date,
    } = req.body || {};

    const targetDate = (new_booking_date || alias_booking_date || '').slice(0, 10);

    console.log('[validateScheduleForBookingChange] Request body ->', {
      new_schedule_id,
      new_subschedule_id,
      new_booking_date: targetDate,
    });

    if (!new_schedule_id || !targetDate) {
      console.error('[validateScheduleForBookingChange] Missing new_schedule_id/new_booking_date');
      return res.status(400).json({
        error: 'new_schedule_id and new_booking_date are required',
      });
    }

    // 0) Ensure booking exists
    const booking = await Booking.findByPk(id, { attributes: ['id'] });
    if (!booking) {
      console.error('[validateScheduleForBookingChange] ERROR: Booking not found');
      return res.status(404).json({ error: 'Booking not found' });
    }
    console.log('[validateScheduleForBookingChange] Booking found, id:', booking.id);

    // 1) Validate schedule exists and operates on the requested date
    const schedule = await Schedule.findByPk(new_schedule_id, { attributes: ['id', 'days_of_week'] });
    if (!schedule) {
      console.error('[validateScheduleForBookingChange] ERROR: Schedule not found');
      return res.status(404).json({ error: 'Schedule not found' });
    }
    console.log('[validateScheduleForBookingChange] Schedule found, id:', schedule.id);
    console.log('[validateScheduleForBookingChange] schedule.days_of_week:', Number(schedule.days_of_week || 0));

    const { bit: neededBit, dow } = weekdayBitFromDateStrSunFirst(targetDate);
    const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    console.log('[validateScheduleForBookingChange] Weekday(UTC):', weekdayNames[dow],
      '| neededBit:', neededBit,
      '| schedule.days_of_week:', Number(schedule.days_of_week || 0));

    const allowed = (Number(schedule.days_of_week || 0) & neededBit) === neededBit;
    if (!allowed) {
      const availableDays = getAvailableDaysSunFirst(schedule.days_of_week);
      console.error('[validateScheduleForBookingChange] ERROR: Schedule not operating on the requested new date');
      return res.status(400).json({
        error: 'Schedule is not operating on the requested new date',
        details: {
          schedule_id: new_schedule_id,
          new_booking_date: targetDate,
          needed_bit: neededBit,
          days_of_week: Number(schedule.days_of_week || 0),
          available_days: availableDays, // human-readable
        },
      });
    }
    console.log('[validateScheduleForBookingChange] ✅ Schedule operates on the requested date');

    // 2) Check SeatAvailability for the new date + route
    const sa = await SeatAvailability.findOne({
      where: {
        date: targetDate,
        schedule_id: new_schedule_id,
        subschedule_id: new_subschedule_id ?? null,
        availability: true,
      },
      attributes: ['id', 'available_seats', 'availability', 'date'],
    });

    if (!sa) {
      console.error('[validateScheduleForBookingChange] ERROR: No SeatAvailability for target route/date');
      return res.status(400).json({
        error: 'No SeatAvailability available for target route on new date',
        details: {
          schedule_id: new_schedule_id,
          subschedule_id: new_subschedule_id ?? null,
          date: targetDate,
          schedule_available_days: getAvailableDaysSunFirst(schedule.days_of_week),
        },
      });
    }
    console.log('[validateScheduleForBookingChange] SeatAvailability found, id:', sa.id);

    // 3) Save validated info for the controller
    req._validatedSchedule = { newBookingDate: targetDate, schedule, seatAvailability: sa };
    console.log('[validateScheduleForBookingChange] ✅ Validated data saved in req._validatedSchedule');

    return next();
  } catch (err) {
    console.error('[validateScheduleForBookingChange] UNCAUGHT ERROR:', err);
    return res.status(500).json({ error: 'Middleware error', details: err.message });
  }
};