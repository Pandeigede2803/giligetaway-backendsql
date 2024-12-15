const moment = require('moment');
const {
    sequelize,

    Schedule,

  } = require("../models");


const validatePassengerCriteria = (req, res, next) => {
    const { date, schedule_id, sub_schedule_id } = req.query;

    // Validasi wajib
    if (!date) {
        return res.status(400).json({ error: 'Parameter "date" wajib diisi.' });
    }

    // Validasi opsional
    if (schedule_id && isNaN(schedule_id)) {
        return res.status(400).json({ error: 'Parameter "schedule_id" harus berupa angka.' });
    }

    if (sub_schedule_id && isNaN(sub_schedule_id)) {
        return res.status(400).json({ error: 'Parameter "sub_schedule_id" harus berupa angka.' });
    }

    // Jika validasi lolos, lanjutkan ke controller
    next();
};

const validateDaysOfWeekForDate = async (req, res, next) => {
    console.log('🔍 Validating date against days_of_week for Schedule...');

    try {
        const { schedule_id, date } = req.query; // Use params instead of body
        console.log("📅 Schedule ID:", schedule_id,date);
        // Validate required parameters
        if (!schedule_id || !date) {
            return res.status(400).json({
                success: false,
                message: "Schedule ID and Date are required.",
            });
        }

        console.log(`🔍 Validating Schedule ID: ${schedule_id} with Date: ${date}`);

        // Fetch schedule details
        const schedule = await Schedule.findOne({
            where: { id: schedule_id },
            attributes: ['days_of_week'],
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: `Schedule not found for ID: ${schedule_id}`,
            });
        }

        const { days_of_week } = schedule;
        console.log(`📅 Schedule Days of Week Bitmask: ${days_of_week}`);

        // Parse the provided date
        const providedDate = moment(date, "YYYY-MM-DD", true);
        if (!providedDate.isValid()) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Please use YYYY-MM-DD.",
            });
        }

        // Calculate the day of the week (0 = Sunday, ..., 6 = Saturday)
        const dayOfWeek = providedDate.day();
        console.log(`📅 Provided Date: ${date}, Day of Week: ${dayOfWeek}`);

        // Validate day of the week using bitmask
        if ((days_of_week & (1 << dayOfWeek)) === 0) {
            return res.status(400).json({
                success: false,
                message: `The provided date (${date}) does not match the allowed days of the week for this schedule.`,
            });
        }

        console.log("✅ Day of week validation passed. Proceeding to the next middleware.");
        next();
    } catch (error) {
        console.error("❌ Error in validateDaysOfWeekForDate middleware:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while validating the days of the week.",
            error: error.message,
        });
    }
};



module.exports = {
    validatePassengerCriteria,
    validateDaysOfWeekForDate,
};
