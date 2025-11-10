const { Schedule, SubSchedule } = require('../models'); // Adjust the path to your models

const validateScheduleAndSubSchedule = async (req, res, next) => {
  try {
    const { schedule_id, subschedule_id } = req.body;

    // console.log('Starting validation for schedule_id and subschedule_id...');
    // console.log(`Received schedule_id: ${schedule_id}`);
    // console.log(`Received subschedule_id: ${subschedule_id}`);

    // Step 1: Check if schedule_id exists in the Schedule table
    const schedule = await Schedule.findByPk(schedule_id);
    if (!schedule) {
      console.log(`Validation failed: schedule_id ${schedule_id} not found.`);
      return res.status(400).json({ error: 'Invalid schedule_id: Schedule not found.' });
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
        return res.status(400).json({ error: 'Invalid subschedule_id: SubSchedule not found or does not match the given schedule_id.' });
      }

      console.log(`Validation passed: subschedule_id ${subschedule_id} is correctly associated with schedule_id ${schedule_id}.`);
    } else {
      console.log('No valid subschedule_id provided (null or "N/A"); skipping subschedule validation.');
    }

    // If all validations pass, proceed to the next middleware or route handler
    console.log('Validation successful for both schedule_id and subschedule_id.');
    next();
  } catch (error) {
    console.error('Error during validation of schedule_id and subschedule_id:', error);
    return res.status(500).json({ error: 'Internal server error during validation.' });
  }
};

// create validation for departure and return scehdule id and subschedule id

const validateScheduleAndSubScheduleForRoundTrip = async (req, res, next) => {
  try {
    const { departure, return: returnData } = req.body;
    console.log('🚀 Starting validation for departure and return schedules...');

    // 🔹 Validate Departure Schedule
    const departureSchedule = await Schedule.findByPk(departure.schedule_id);
    if (!departureSchedule) {
      console.log(`❌ Validation failed: Departure schedule_id ${departure.schedule_id} not found.`);
      return res.status(400).json({ error: 'Invalid departure schedule_id: Schedule not found.' });
    }
    console.log(`✅ Validation passed: Departure schedule_id ${departure.schedule_id} exists.`);

    // 🔹 Validate Departure SubSchedule (if provided)
    if (
      departure.subschedule_id && // Ensure subschedule_id exists
      typeof departure.subschedule_id === 'string' && // Ensure it's a string before using .trim()
      departure.subschedule_id.trim() !== '' && // Ensure it's not empty
      departure.subschedule_id == 'N/A' // Ignore "N/A"
    ) {
      const departureSubSchedule = await SubSchedule.findOne({
        where: {
          id: departure.subschedule_id,
          schedule_id: departure.schedule_id, // Ensures it's linked to the correct schedule
        },
      });

      if (!departureSubSchedule) {
        console.log(`❌ Validation failed: Departure subschedule_id ${departure.subschedule_id} does not match schedule_id ${departure.schedule_id}.`);
        return res.status(400).json({ error: 'Invalid departure subschedule_id: SubSchedule not found or does not belong to the given departure schedule_id.' });
      }

      console.log(`✅ Validation passed: Departure subschedule_id ${departure.subschedule_id} is correctly associated.`);
    } else {
      console.log('ℹ️ No valid departure subschedule_id provided; treating as a main schedule booking.');
    }

    // 🔹 Validate Return Schedule
    const returnSchedule = await Schedule.findByPk(returnData.schedule_id);
    if (!returnSchedule) {
      console.log(`❌ Validation failed: Return schedule_id ${returnData.schedule_id} not found.`);
      return res.status(400).json({ error: 'Invalid return schedule_id: Schedule not found.' });
    }
    console.log(`✅ Validation passed: Return schedule_id ${returnData.schedule_id} exists.`);

    // 🔹 Validate Return SubSchedule (if provided)
    if (
      returnData.subschedule_id && // Ensure subschedule_id exists
      typeof returnData.subschedule_id === 'string' && // Ensure it's a string before using .trim()
      returnData.subschedule_id.trim() !== '' && // Ensure it's not empty
      returnData.subschedule_id !== 'N/A' // Ignore "N/A"
    ) {
      const returnSubSchedule = await SubSchedule.findOne({
        where: {
          id: returnData.subschedule_id,
          schedule_id: returnData.schedule_id, // Ensures it's linked to the correct schedule
        },
      });

      if (!returnSubSchedule) {
        console.log(`❌ Validation failed: Return subschedule_id ${returnData.subschedule_id} does not match schedule_id ${returnData.schedule_id}.`);
        return res.status(400).json({ error: 'Invalid return subschedule_id: SubSchedule not found or does not belong to the given return schedule_id.' });
      }

      console.log(`✅ Validation passed: Return subschedule_id ${returnData.subschedule_id} is correctly associated.`);
    } else {
      console.log('ℹ️ No valid return subschedule_id provided; treating as a main schedule booking.');
    }

    // ✅ If all validations pass, move to the next middleware
    console.log('🎉 Validation successful for both departure and return schedules.');
    next();
  } catch (error) {
    console.error('❌ Error during validation:', error);
    return res.status(500).json({ error: 'Internal server error during validation.' });
  }
};



module.exports = {
  validateScheduleAndSubSchedule,
  validateScheduleAndSubScheduleForRoundTrip
};
