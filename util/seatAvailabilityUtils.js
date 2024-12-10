const { SeatAvailability, Schedule, SubSchedule, Boat } = require("../models");

const { calculatePublicCapacity } = require("./getCapacityReduction");

// Create SeatAvailability if it does not exist
const createSeatAvailability = async ({
  schedule_id,
  date,
  qty,
}) => {
  try {
    console.log(
      `🔍 Starting creation for Schedule ID: ${schedule_id}, Date: ${date}, Qty: ${qty}`
    );

    // Fetch the main schedule and its boat capacity
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      include: [
        {
          model: Boat,
          attributes: ["capacity"],
        },
        {
          model: SubSchedule,
          as: "SubSchedules",
        },
      ],
    });

    if (!schedule || !schedule.Boat) {
      throw new Error("Schedule or boat not found.");
    }

    const boatCapacity = schedule.Boat.capacity;
    const publicCapacity = calculatePublicCapacity(schedule.Boat);

    // Calculate available seats
    const availableSeats =
      publicCapacity + qty <= boatCapacity
        ? publicCapacity + qty
        : boatCapacity;

    console.log(
      `🚤 Boat capacity: ${boatCapacity}, Public capacity: ${publicCapacity}, Calculated seats: ${availableSeats}`
    );

    // Create or update SeatAvailability for the main schedule
    const mainSeatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id,
        date,
      },
    });

    if (mainSeatAvailability) {
      console.log(
        `✅ Main seat availability exists. Updating ID: ${mainSeatAvailability.id}`
      );
      mainSeatAvailability.available_seats = availableSeats;
      await mainSeatAvailability.save();
    } else {
      console.log(`🚨 Main seat availability does not exist. Creating new.`);
      const newMainSeatAvailability = await SeatAvailability.create({
        schedule_id,
        date,
        available_seats: availableSeats,
        availability: true,
      });
      console.log(
        `✅ Main seat availability created with ID: ${newMainSeatAvailability.id}`
      );
    }

    // Process subschedules
    const subschedules = [];
    for (const subschedule of schedule.SubSchedules) {
      console.log(`🔄 Processing SubSchedule ID: ${subschedule.id}`);
      const subSeatAvailability = await SeatAvailability.findOne({
        where: {
          schedule_id,
          subschedule_id: subschedule.id,
          date,
        },
      });

      if (subSeatAvailability) {
        console.log(
          `✅ SubSchedule seat availability exists. Updating ID: ${subSeatAvailability.id}`
        );
        subSeatAvailability.available_seats = availableSeats;
        await subSeatAvailability.save();
        subschedules.push({
          id: subSeatAvailability.id,
          available_seats: subSeatAvailability.available_seats,
          date: subSeatAvailability.date,
        });
      } else {
        console.log(
          `🚨 SubSchedule seat availability does not exist. Creating new.`
        );
        const newSubSeatAvailability = await SeatAvailability.create({
          schedule_id,
          subschedule_id: subschedule.id,
          date,
          available_seats: availableSeats,
          availability: true,
        });
        console.log(
          `✅ SubSchedule seat availability created with ID: ${newSubSeatAvailability.id}`
        );
        subschedules.push({
          id: newSubSeatAvailability.id,
          available_seats: newSubSeatAvailability.available_seats,
          date: newSubSeatAvailability.date,
        });
      }
    }

    console.log("✅ All seat availabilities processed successfully.");
    return {
      main_schedule: {
        id: mainSeatAvailability?.id || newMainSeatAvailability?.id,
        schedule_id,
        date,
        available_seats:availableSeats,
      },
      subschedules,
    };
  } catch (error) {
    console.error("❌ Failed to create seat availabilities:", error.message);
    throw new Error("Failed to create seat availabilities: " + error.message);
  }
};

// Check SeatAvailability based on schedule_id, passengers_total, and date
const checkSeatAvailability = async (schedule_id, passengers_total, date) => {
  const seatAvailability = await SeatAvailability.findOne({
    where: {
      schedule_id,
      date,
      available_seats: { [Op.gte]: passengers_total },
      availability: true,
    },
  });

  return seatAvailability;
};

const boostSeatAvailability = async ({ id, toggle, qty }) => {
  console.log(`🔍 Fetching seat availability record for ID: ${id || "N/A"}`);

  if (!id) {
    console.error("❌ Seat availability ID is required.");
    throw new Error("Seat availability ID is required.");
  }

  // Fetch main seat availability by ID
  const mainSeatAvailability = await SeatAvailability.findByPk(id);
  if (!mainSeatAvailability) {
    console.error(`❌ Seat availability not found for ID: ${id}`);
    throw new Error(`Seat availability not found for ID: ${id}`);
  }

  console.log(`✅ Main seat availability found: ${mainSeatAvailability.id}`);

  // Fetch the main schedule and associated subschedules
  const schedule = await Schedule.findOne({
    where: { id: mainSeatAvailability.schedule_id },
    include: [
      { model: SubSchedule, as: "SubSchedules" },
      { model: Boat, as: "Boat", attributes: ["capacity"] },
    ],
  });

  if (!schedule || !schedule.Boat) {
    console.error(
      `❌ Boat capacity not found for Schedule ID: ${mainSeatAvailability.schedule_id}`
    );
    throw new Error(
      `Boat capacity not found for Schedule ID: ${mainSeatAvailability.schedule_id}`
    );
  }

  const boatCapacity = schedule.Boat.capacity;
  const publicCapacity = calculatePublicCapacity(schedule.Boat);
  const seatAvailabilityDate = mainSeatAvailability.date;
  console.log(
    `🚤 Boat capacity: ${boatCapacity}, Public capacity: ${publicCapacity}, Seat Availability Date: ${seatAvailabilityDate}`
  );

  // Boost or toggle main schedule seat availability
  if (toggle) {
    console.log("🔄 Toggling seat availability for main schedule");
    if (mainSeatAvailability.available_seats === boatCapacity) {
      console.log("🔽 Reducing to public capacity");
      mainSeatAvailability.available_seats = publicCapacity;
    } else if (mainSeatAvailability.available_seats === publicCapacity) {
      console.log("🔼 Boosting to full capacity");
      mainSeatAvailability.available_seats = boatCapacity;
    } else {
      console.error("❌ Invalid seat availability state for toggling.");
      throw new Error("Invalid seat availability state for toggling.");
    }
    await mainSeatAvailability.save();
  } else if (qty) {
    console.log(
      `🔧 Adding ${qty} to current available seats: ${mainSeatAvailability.available_seats}`
    );
    const newAvailableSeats =
      mainSeatAvailability.available_seats + qty <= boatCapacity
        ? mainSeatAvailability.available_seats + qty
        : boatCapacity;

    mainSeatAvailability.available_seats = newAvailableSeats;
    await mainSeatAvailability.save();
  }

  console.log(
    `✅ Main schedule seat availability updated: ${mainSeatAvailability.available_seats}`
  );

  // Handle subschedules for the same date
  console.log("🔍 Processing subschedules...");
  const subschedules = [];
  for (const subschedule of schedule.SubSchedules) {
    console.log(`🔄 Checking subschedule ID: ${subschedule.id}`);
    const subSeatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id: schedule.id,
        subschedule_id: subschedule.id,
        date: seatAvailabilityDate, // Match the date of the main seat availability
      },
    });

    if (subSeatAvailability) {
      console.log(
        `✅ Subschedule seat availability found: ${subSeatAvailability.id}`
      );
      const newSubSeats =
        subSeatAvailability.available_seats + qty <= boatCapacity
          ? subSeatAvailability.available_seats + qty
          : boatCapacity;

      subSeatAvailability.available_seats = newSubSeats;
      await subSeatAvailability.save();
      console.log(
        `✅ Subschedule seat availability updated: ${subSeatAvailability.available_seats}`
      );
      subschedules.push({
        id: subSeatAvailability.id,
        available_seats: subSeatAvailability.available_seats, // Include updated seats
        date: subSeatAvailability.date,
      });
    } else {
      console.log(
        `🚨 No seat availability found for subschedule ID: ${subschedule.id} on date: ${seatAvailabilityDate}`
      );
      const newSubSeatAvailability = await SeatAvailability.create({
        schedule_id: schedule.id,
        subschedule_id: subschedule.id,
        date: seatAvailabilityDate, // Use the same date as the main seat availability
        available_seats: publicCapacity + qty <= boatCapacity
          ? publicCapacity + qty
          : boatCapacity,
        availability: true,
      });
      console.log(
        `✅ New subschedule seat availability created: ${newSubSeatAvailability.id}`
      );
      subschedules.push({
        id: newSubSeatAvailability.id,
        available_seats: newSubSeatAvailability.available_seats,
        date: newSubSeatAvailability.date,
      });
    }
  }

  console.log(`✅ All seat availabilities processed successfully.`);

  return {
    main_schedule: {
      id: mainSeatAvailability.id,
      available_seats: mainSeatAvailability.available_seats, // Include updated seats
      date: mainSeatAvailability.date,
    },
    subschedules,
  };
};

const adjustSeatAvailability = async ({
  id,
  schedule_id,
  date,
  toggle,
  qty,
}) => {
  console.log(
    `🔍 Fetching seat availability record for ID: ${
      id || "N/A"
    }, Schedule ID: ${schedule_id || "N/A"}, Date: ${date}, Qty: ${
      qty || "N/A"
    }`
  );

  let seatAvailability;

  if (!id && !schedule_id) {
    console.error(
      '❌ Scenario 7: Either "id" or "schedule_id" must be provided.'
    );
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
      include: { model: Boat, as: "Boat", attributes: ["capacity"] },
    });

    if (!schedule || !schedule.Boat) {
      console.error(
        `❌ Scenario 7: Boat capacity not found for Schedule ID: ${
          schedule_id || seatAvailability.schedule_id
        }`
      );
      throw new Error(
        `Boat capacity not found for schedule ID ${
          schedule_id || seatAvailability.schedule_id
        }.`
      );
    }

    boatCapacity = schedule.Boat.capacity;
    publicCapacity = calculatePublicCapacity(schedule.Boat);
    console.log(
      `🚤 Boat capacity: ${boatCapacity}, Public capacity: ${publicCapacity}`
    );
  }

  // Handle toggle logic
  if (toggle) {
    console.log("🔄 Scenario 1: Toggling seat availability");
    if (seatAvailability.available_seats === boatCapacity) {
      console.log("🔽 Scenario 1.1: Reducing to public capacity");
      seatAvailability.available_seats = publicCapacity;
    } else if (seatAvailability.available_seats === publicCapacity) {
      console.log("🔼 Scenario 1.2: Boosting to full capacity");
      seatAvailability.available_seats = boatCapacity;
    } else {
      console.error(
        "❌ Scenario 7: Invalid seat availability state for toggling."
      );
      throw new Error("Invalid seat availability state for toggling.");
    }
  } else if (qty) {
    // Handle dynamic capacity boost
    console.log(`🔧 Scenario 2: Adjusting seat availability to ${qty}`);
    if (qty > boatCapacity) {
      console.error("❌ Scenario 6: Requested capacity exceeds boat capacity.");
      throw new Error("Requested capacity exceeds boat capacity.");
    }
    seatAvailability.available_seats = qty;
  } else {
    // Default to full capacity boost
    console.log("🔼 Scenario 3: Boosting seat availability to full capacity");
    seatAvailability.available_seats = boatCapacity;
  }

  await seatAvailability.save();
  console.log(
    `✅ Scenario Complete: Seat availability updated successfully. New available seats: ${seatAvailability.available_seats}`
  );
  return seatAvailability;
};

module.exports = {
  createSeatAvailability,
  boostSeatAvailability,
  adjustSeatAvailability,
  checkSeatAvailability,
};
