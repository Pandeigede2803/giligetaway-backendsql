const { Schedule, SubSchedule, Booking } = require('../models');

// 🔹 Validasi input scheduler utama
exports.validateSchedulerInput = (req, res, next) => {
  const {
    name,
    subject,
    body,
    delay_minutes,
    booking_status,
    target_type,
  } = req.body;

  const errors = [];

  if (!name) errors.push('Name is required');
  if (!subject) errors.push('Subject is required');
  if (!body) errors.push('Body (HTML) is required');
  if (delay_minutes === undefined || delay_minutes < 0)
    errors.push('Delay minutes must be >= 0');
  if (!['pending', 'paid', 'cancelled', 'abandoned', 'completed'].includes(booking_status))
    errors.push('Invalid booking status');
  if (!['customer', 'agent', 'all'].includes(target_type))
    errors.push('Invalid target type');

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  next();
};

// 🔹 Validasi apakah schedule_id valid (boleh array atau single)
exports.validateScheduleExistence = async (req, res, next) => {
  try {
    const { schedule_ids } = req.body;
    if (!schedule_ids || schedule_ids.length === 0) return next();

    const ids = Array.isArray(schedule_ids) ? schedule_ids : [schedule_ids];
    const found = await Schedule.findAll({ where: { id: ids } });

    if (found.length !== ids.length) {
      const foundIds = found.map(s => s.id);
      const missing = ids.filter(x => !foundIds.includes(x));
      return res.status(400).json({
        message: 'Some schedule IDs not found',
        missing_ids: missing,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error validating schedule IDs', error });
  }
};

// 🔹 Validasi apakah subschedule_id valid (boleh array atau single)
exports.validateSubScheduleExistence = async (req, res, next) => {
  try {
    const { subschedule_ids } = req.body;
    if (!subschedule_ids || subschedule_ids.length === 0) return next();

    const ids = Array.isArray(subschedule_ids) ? subschedule_ids : [subschedule_ids];
    const found = await SubSchedule.findAll({ where: { id: ids } });

    if (found.length !== ids.length) {
      const foundIds = found.map(s => s.id);
      const missing = ids.filter(x => !foundIds.includes(x));
      return res.status(400).json({
        message: 'Some subschedule IDs not found',
        missing_ids: missing,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error validating subschedule IDs', error });
  }
};

// 🔹 Validasi booking untuk test email (optional)
exports.validateBookingExistence = async (req, res, next) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return next();

    const booking = await Booking.findOne({ where: { ticket_id: booking_id } });
    if (!booking)
      return res.status(404).json({ message: `Booking with ID ${booking_id} not found` });

    req.booking = booking; // inject ke req agar bisa dipakai controller
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error validating booking ID', error });
  }
};