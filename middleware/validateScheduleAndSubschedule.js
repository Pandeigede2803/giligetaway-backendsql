const { Schedule, SubSchedule } = require('../models'); // Adjust the path to your models

const validateScheduleAndSubSchedule = async (req, res, next) => {
  try {
    const { schedule_id, subschedule_id } = req.body;

    console.log('Starting validation for schedule_id and subschedule_id...');
    console.log(`Received schedule_id: ${schedule_id}`);
    console.log(`Received subschedule_id: ${subschedule_id}`);

    // Step 1: Check if schedule_id exists in the Schedule table
    const schedule = await Schedule.findByPk(schedule_id);
    if (!schedule) {
      console.log(`Validation failed: schedule_id ${schedule_id} not found.`);
      return res.status(400).json({ error: 'Invalid schedule_id: Schedule not found.' });
    }
    console.log(`Validation passed: schedule_id ${schedule_id} exists in the Schedule table.`);

    // Step 2: If subschedule_id is provided, validate it and ensure it matches the given schedule_id
    if (subschedule_id) {
      const subSchedule = await SubSchedule.findOne({
        where: {
          id: subschedule_id,
          schedule_id: schedule_id, // Ensures subschedule belongs to the specified schedule
        },
      });

      if (!subSchedule) {
        console.log(`Validation failed: subschedule_id ${subschedule_id} does not match or belong to schedule_id ${schedule_id}.`);
        return res.status(400).json({ error: 'Invalid subschedule_id: SubSchedule not found or does not match the given schedule_id.' });
      }

      console.log(`Validation passed: subschedule_id ${subschedule_id} is correctly associated with schedule_id ${schedule_id}.`);
    } else {
      console.log('No subschedule_id provided; skipping subschedule validation.');
    }

    // If all validations pass, proceed to the next middleware or route handler
    console.log('Validation successful for both schedule_id and subschedule_id.');
    next();
  } catch (error) {
    console.error('Error during validation of schedule_id and subschedule_id:', error);
    return res.status(500).json({ error: 'Internal server error during validation.' });
  }
};

module.exports = validateScheduleAndSubSchedule;