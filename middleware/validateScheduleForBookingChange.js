// middlewares/validateScheduleForBookingChange.js
const { Booking, Schedule, SeatAvailability } = require('../models');

/**
 * Mapping bitmask days_of_week:
 * Sen = 1, Sel = 2, Rab = 4, Kam = 8, Jum = 16, Sab = 32, Min = 64
 */
function dayToBit(dateStrOrDate) {
  const d = new Date(dateStrOrDate);
  const dow = d.getDay(); // 0 = Min, 1 = Sen, ..., 6 = Sab
  const map = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32, 0: 64 };
  return map[dow];
}

module.exports = async function validateScheduleForBookingChange(req, res, next) {
  try {
    console.log('[validateScheduleForBookingChange] Starting middleware');

    const { id } = req.params;
    const { new_schedule_id, new_subschedule_id = null, new_booking_date } = req.body;

    console.log('[validateScheduleForBookingChange] Request body:', req.body);

    if (!new_schedule_id || !new_booking_date) {
      return res.status(400).json({ error: 'new_schedule_id and new_booking_date are required' });
    }

    // 0) Ambil booking untuk validasi eksistensi
    const booking = await Booking.findByPk(id, { attributes: ['id'] });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    console.log('[validateScheduleForBookingChange] Booking found, id:', booking.id);

    // 1) Cek days_of_week dari schedule
    const schedule = await Schedule.findByPk(new_schedule_id, {
      attributes: ['id', 'days_of_week'],
    });
    console.log('[validateScheduleForBookingChange] Schedule found, id:', schedule.id);

    const neededBit = dayToBit(new_booking_date);
    const allowed = (Number(schedule.days_of_week || 0) & neededBit) === neededBit;
    if (!allowed) {
      return res.status(400).json({
        error: 'Schedule is not operating on the requested new date',
        details: {
          schedule_id: new_schedule_id,
          new_booking_date,
          days_of_week: schedule.days_of_week,
          needed_bit: neededBit,
        },
      });
    }

    console.log('[validateScheduleForBookingChange] Schedule is operating on the requested new date');

    // 2) Cek seat availability untuk tanggal baru
    const sa = await SeatAvailability.findOne({
      where: {
        date: new_booking_date,
        schedule_id: new_schedule_id,
        subschedule_id: new_subschedule_id ?? null,
        availability: true,
      },
      attributes: ['id', 'available_seats', 'availability', 'date'],
    });

    console.log('[validateScheduleForBookingChange] SeatAvailability found, id:', sa.id);

    if (!sa) {
      return res.status(400).json({
        error: 'No SeatAvailability available for target route on new date',
        details: {
          schedule_id: new_schedule_id,
          subschedule_id: new_subschedule_id ?? null,
          date: new_booking_date,
        },
      });
    }

    // simpan data validasi di req
    req._validatedSchedule = { newBookingDate: new_booking_date, schedule, seatAvailability: sa };

    console.log('[validateScheduleForBookingChange] Validated data saved in req');

    return next();
  } catch (err) {
    console.error('[validateScheduleForBookingChange] ERROR:', err);
    return res.status(500).json({ error: 'Middleware error', details: err.message });
  }
};
