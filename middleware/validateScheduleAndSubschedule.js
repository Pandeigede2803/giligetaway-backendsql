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
    console.log('Starting validation for departure and return schedule_id and subschedule_id...');
    console.log(`Received departure schedule_id: ${departure.schedule_id}`);
    console.log(`Received departure subschedule_id: ${departure.subschedule_id}`);
    console.log(`Received return schedule_id: ${returnData.schedule_id}`);
    console.log(`Received return subschedule_id: ${returnData.subschedule_id}`);

    // Step 1: Check if schedule_id exists in the Schedule table
    const departureSchedule = await Schedule.findByPk(departure.schedule_id);
    if (!departureSchedule) {
      console.log(`Validation failed: departure schedule_id ${departure.schedule_id} not found.`);
      return res.status(400).json({ error: 'Invalid departure schedule_id: Schedule not found.' });
    }
    console.log(`Validation passed: departure schedule_id ${departure.schedule_id} exists in the Schedule table.`);

    // Step 2: If subschedule_id is provided and is not null or "N/A", validate it
    if (departure.subschedule_id && departure.subschedule_id !== 'N/A' && departure.subschedule_id !== null) {
      const departureSubSchedule = await SubSchedule.findOne({
        where: {
          id: departure.subschedule_id,
          schedule_id: departure.schedule_id, // Ensures subschedule belongs to the specified schedule
        },
      });;

      if (!departureSubSchedule) {
        console.log(`Validation failed: departure subschedule_id ${departure.subschedule_id} does not match or belong to departure schedule_id ${departure.schedule_id}.`);
        return res.status(400).json({ error: 'Invalid departure subschedule_id: SubSchedule not found or does not match the given departure schedule_id.' });
      }

      console.log(`Validation passed: departure subschedule_id ${departure.subschedule_id} is correctly associated with departure schedule_id ${departure.schedule_id}.`);
    } else {
      console.log('No valid departure subschedule_id provided (null or "N/A"); skipping departure subschedule validation.');
    }

    // Step 3: Check if return schedule_id exists in the Schedule table
    const returnSchedule = await Schedule.findByPk(returnData.schedule_id);
    if (!returnSchedule) {
      console.log(`Validation failed: return schedule_id ${returnData.schedule_id} not found.`);
      return res.status(400).json({ error: 'Invalid return schedule_id: Schedule not found.' });
    }
    console.log(`Validation passed: return schedule_id ${returnData.schedule_id} exists in the Schedule table.`);

    // Step 4: If subschedule_id is provided and is not null or "N/A", validate it
    if (returnData.subschedule_id && returnData.subschedule_id !== 'N/A' && returnData.subschedule_id !== null) {
      const returnSubSchedule = await SubSchedule.findOne({
        where: {
          id: returnData.subschedule_id,
          schedule_id: returnData.schedule_id, // Ensures subschedule belongs to the specified schedule
        },
      });

      if (!returnSubSchedule) {
        console.log(`Validation failed: return subschedule_id ${returnData.subschedule_id} does not match or belong to return schedule_id ${returnData.schedule_id}.`);
        return res.status(400).json({ error: 'Invalid return subschedule_id: SubSchedule not found or does not match the given return schedule_id.' });
      }

      console.log(`Validation passed: return subschedule_id ${returnData.subschedule_id} is correctly associated with return schedule_id ${returnData.schedule_id}.`);
    } else {
      console.log('No valid return subschedule_id provided (null or "N/A"); skipping return subschedule validation.');
    }

    // If all validations pass, proceed to the next middleware or route handler
    console.log('Validation successful for both departure and return schedule_id and subschedule_id.');
    next();
  } catch (error) {
    console.error('Error during validation of departure and return schedule_id and subschedule_id:', error);
    return res.status(500).json({ error: 'Internal server error during validation.' });
  }
};




module.exports = {
  validateScheduleAndSubSchedule,
  validateScheduleAndSubScheduleForRoundTrip
};
