const { Schedule, SubSchedule } = require('../models'); // Adjust the path to your models

const validateTrips = async (req, res, next) => {
  try {
    const { trips } = req.body;

    console.log('Starting validation for trips array...');
    if (!Array.isArray(trips)) {
      return res.status(400).json({ error: 'Trips should be an array.' });
    }

    // Iterate over each trip in the trips array and validate
    for (const trip of trips) {
      const { schedule_id, subschedule_id } = trip;

      console.log(`Validating schedule_id: ${schedule_id} and subschedule_id: ${subschedule_id}`);

      // Step 1: Check if schedule_id exists in the Schedule table
      const schedule = await Schedule.findByPk(schedule_id);
      if (!schedule) {
        console.log(`Validation failed: schedule_id ${schedule_id} not found.`);
        return res.status(400).json({ error: `Invalid schedule_id: Schedule not found for schedule_id ${schedule_id}.` });
      }
      console.log(`Validation passed: schedule_id ${schedule_id} exists in the Schedule table.`);

      // Step 2: If subschedule_id is provided and is not null or "N/A", validate it
      if (subschedule_id && subschedule_id !== 'N/A' && subschedule_id !== null) {
        const subSchedule = await SubSchedule.findOne({
          where: {
            id: subschedule_id,
            schedule_id: schedule_id, // Ensures subschedule belongs to the specified schedule
          },
        });

        if (!subSchedule) {
          console.log(`Validation failed: subschedule_id ${subschedule_id} does not match or belong to schedule_id ${schedule_id}.`);
          return res.status(400).json({ error: `Invalid subschedule_id: SubSchedule ${subschedule_id} not found or does not match schedule_id ${schedule_id}.` });
        }

        console.log(`Validation passed: subschedule_id ${subschedule_id} is correctly associated with schedule_id ${schedule_id}.`);
      } else {
        console.log('No valid subschedule_id provided (null or "N/A"); skipping subschedule validation.');
      }
    }

    // If all trips are valid, proceed to the next middleware or route handler
    console.log('Validation successful for all trips in the array.');
    next();
  } catch (error) {
    console.error('Error during validation of trips:', error);
    return res.status(500).json({ error: 'Internal server error during validation.' });
  }
};

module.exports = validateTrips;
