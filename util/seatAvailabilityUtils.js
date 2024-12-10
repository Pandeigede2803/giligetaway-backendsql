const { SeatAvailability, Schedule, SubSchedule, Boat } = require("../models");

const { calculatePublicCapacity } = require('./getCapacityReduction');


// Create SeatAvailability if it does not exist
const createSeatAvailability = async (schedule_id, date, isSubSchedule = false) => {
  try {
    let schedule;
    
    // Fetch the schedule or subschedule and the boat capacity
    if (isSubSchedule) {
      schedule = await SubSchedule.findOne({
        where: { id: schedule_id },
        include: {
          model: Schedule,
          include: {
            model: Boat,
            attributes: ['capacity'],
          },
        },
      });
    } else {
      schedule = await Schedule.findOne({
        where: { id: schedule_id },
        include: {
          model: Boat,
          attributes: ['capacity'],
        },
      });
    }

    if (!schedule || !schedule.Boat) {
      throw new Error("Schedule or boat not found");
    }

    // Use the boat's capacity as the available seats
    const availableSeats = schedule.Boat.capacity;

    // Create the SeatAvailability entry
    const newSeatAvailability = await SeatAvailability.create({
      schedule_id,
      date,
      available_seats: availableSeats, // Use the boat capacity here
      availability: true
    });

    return newSeatAvailability;
  } catch (error) {
    throw new Error("Failed to create seat availability: " + error.message);
  }
};

// Check SeatAvailability based on schedule_id, passengers_total, and date
const checkSeatAvailability = async (schedule_id, passengers_total, date) => {
  const seatAvailability = await SeatAvailability.findOne({
    where: {
      schedule_id,
      date,
      available_seats: { [Op.gte]: passengers_total },
      availability: true
    }
  });

  return seatAvailability;
};;


const boostSeatAvailability = async ({ id, toggle, qty }) => {
  console.log(`🔍 Fetching seat availability record for ID: ${id || 'N/A'}`);

  if (!id) {
    console.error('❌ Seat availability ID is required.');
    throw new Error('Seat availability ID is required.');
  }

  // Fetch seat availability by ID
  const seatAvailability = await SeatAvailability.findByPk(id);
  if (!seatAvailability) {
    console.error(`❌ Seat availability not found for ID: ${id}`);
    throw new Error(`Seat availability not found for ID: ${id}`);
  }

  console.log(`✅ Seat availability found: ${seatAvailability.id}`);

  // Fetch the boat capacity for the schedule
  const schedule = await Schedule.findOne({
    where: { id: seatAvailability.schedule_id },
    include: { model: Boat, as: 'Boat', attributes: ['capacity'] },
  });

  if (!schedule || !schedule.Boat) {
    console.error(`❌ Boat capacity not found for Schedule ID: ${seatAvailability.schedule_id}`);
    throw new Error(`Boat capacity not found for Schedule ID: ${seatAvailability.schedule_id}`);
  }

  const boatCapacity = schedule.Boat.capacity;
  console.log(`🚤 Boat capacity: ${boatCapacity}`);

  if (toggle) {
    console.log('🔄 Toggling seat availability');
    // Handle toggle logic as before
    // ...
  } else if (qty) {
    // Add qty to current available seats, ensuring it doesn't exceed boatCapacity
    const newAvailableSeats = seatAvailability.available_seats + qty;
    if (newAvailableSeats > boatCapacity) {
      console.error('❌ Boost exceeds boat capacity.');
      throw new Error('Boost exceeds boat capacity.');
    }
    console.log(`🔧 Adding ${qty} to current available seats: ${seatAvailability.available_seats}`);
    seatAvailability.available_seats = newAvailableSeats;
  } else {
    console.log('🔼 Boosting seat availability to full capacity');
    seatAvailability.available_seats = boatCapacity;
  }

  await seatAvailability.save();
  console.log(`✅ Seat availability updated successfully. New available seats: ${seatAvailability.available_seats}`);

  return {
    id: seatAvailability.id,
    schedule_id: seatAvailability.schedule_id,
    date: seatAvailability.date,
    current_available_seats: seatAvailability.available_seats,
  };
};

const adjustSeatAvailability = async ({ id, schedule_id, date, toggle, qty }) => {
  console.log(`🔍 Fetching seat availability record for ID: ${id || 'N/A'}, Schedule ID: ${schedule_id || 'N/A'}, Date: ${date}, Qty: ${qty || 'N/A'}`);

  let seatAvailability;

  if (!id && !schedule_id) {
    console.error('❌ Scenario 7: Either "id" or "schedule_id" must be provided.');
    throw new Error('Either "id" or "schedule_id" is required.');
  }

  // Fetch seat availability by ID
  if (id) {
    seatAvailability = await SeatAvailability.findByPk(id);
    if (!seatAvailability) {
      console.error(`❌ Scenario 7: Seat availability not found for ID: ${id}`);
      throw new Error(`Seat availability not found for ID: ${id}`);
    }
    console.log(`✅ Scenario 1: Seat availability found by ID: ${id}`);
  }

  // Fetch schedule and boat capacity if needed
  let boatCapacity, publicCapacity;
  if (schedule_id || seatAvailability) {
    const schedule = await Schedule.findOne({
      where: { id: schedule_id || seatAvailability.schedule_id },
      include: { model: Boat, as: 'Boat', attributes: ['capacity'] },
    });

    if (!schedule || !schedule.Boat) {
      console.error(`❌ Scenario 7: Boat capacity not found for Schedule ID: ${schedule_id || seatAvailability.schedule_id}`);
      throw new Error(`Boat capacity not found for schedule ID ${schedule_id || seatAvailability.schedule_id}.`);
    }

    boatCapacity = schedule.Boat.capacity;
    publicCapacity = calculatePublicCapacity(schedule.Boat);
    console.log(`🚤 Boat capacity: ${boatCapacity}, Public capacity: ${publicCapacity}`);
  }

  // Handle toggle logic
  if (toggle) {
    console.log('🔄 Scenario 1: Toggling seat availability');
    if (seatAvailability.available_seats === boatCapacity) {
      console.log('🔽 Scenario 1.1: Reducing to public capacity');
      seatAvailability.available_seats = publicCapacity;
    } else if (seatAvailability.available_seats === publicCapacity) {
      console.log('🔼 Scenario 1.2: Boosting to full capacity');
      seatAvailability.available_seats = boatCapacity;
    } else {
      console.error('❌ Scenario 7: Invalid seat availability state for toggling.');
      throw new Error('Invalid seat availability state for toggling.');
    }
  } else if (qty) {
    // Handle dynamic capacity boost
    console.log(`🔧 Scenario 2: Adjusting seat availability to ${qty}`);
    if (qty > boatCapacity) {
      console.error('❌ Scenario 6: Requested capacity exceeds boat capacity.');
      throw new Error('Requested capacity exceeds boat capacity.');
    }
    seatAvailability.available_seats = qty;
  } else {
    // Default to full capacity boost
    console.log('🔼 Scenario 3: Boosting seat availability to full capacity');
    seatAvailability.available_seats = boatCapacity;
  }

  await seatAvailability.save();
  console.log(`✅ Scenario Complete: Seat availability updated successfully. New available seats: ${seatAvailability.available_seats}`);
  return seatAvailability;
};


module.exports = { createSeatAvailability,boostSeatAvailability, adjustSeatAvailability ,checkSeatAvailability };
