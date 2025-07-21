const { Op } = require("sequelize");
const { Booking, BookingSeatAvailability,Schedule } = require('../models'); // sesuaikan path jika perlu

const validateDuplicateScheduleInput = async (req, res, next) => {
  const { validity_start, validity_end, days_of_week } = req.body;
  const scheduleId = req.params.id;

  // Basic validation
  if (!validity_start || !validity_end || days_of_week === undefined) {
    return res.status(400).json({
      error: "validity_start, validity_end, and days_of_week are required",
    });
  }

  const start = new Date(validity_start);
  const end = new Date(validity_end);

  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  if (start >= end) {
    return res.status(400).json({
      error: "`validity_start` must be earlier than `validity_end`",
    });
  }

  if (typeof days_of_week !== "number") {
    return res.status(400).json({ error: "days_of_week must be a number" });
  }

  // Check for boat_id (from original schedule)
  const originalSchedule = await Schedule.findByPk(scheduleId);
  if (!originalSchedule) {
    return res.status(404).json({ error: "Original schedule not found" });
  }

  const { boat_id } = originalSchedule;

  // Check for schedule conflicts (optional)
  const conflict = await Schedule.findOne({
    where: {
      boat_id,
      days_of_week,
      [Op.or]: [
        {
          validity_start: {
            [Op.between]: [start, end],
          },
        },
        {
          validity_end: {
            [Op.between]: [start, end],
          },
        },
        {
          validity_start: {
            [Op.lte]: start,
          },
          validity_end: {
            [Op.gte]: end,
          },
        },
      ],
    },
  });

  if (conflict) {
    return res.status(409).json({
      error: "Schedule conflict detected with another schedule for this boat",
    });
  }

  next();
};

module.exports = validateDuplicateScheduleInput;