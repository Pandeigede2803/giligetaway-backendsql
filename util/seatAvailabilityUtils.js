const { SeatAvailability, Schedule, SubSchedule, Boat } = require("../models");

const { calculatePublicCapacity } = require("./getCapacityReduction");

// Create SeatAvailability if it does not exist
const createSeatAvailability = async ({ schedule_id, date, qty }) => {

  console.log(
    `🔍 Starting creation for Schedule ID: ${schedule_id}, Date: ${date}, Qty: ${qty}`
  );
  try {
    // console.log(
    //   `🔍 Starting creation for Schedule ID: ${schedule_id}, Date: ${date}, Qty: ${qty}`
    // );

    // Fetch the main schedule and its boat capacity
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      include: [
        {
          model: Boat,
          as: "Boat",
          attributes: ["id","capacity"],
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

    console.log(`===boat===:`, schedule.Boat);

    const boat = schedule.Boat; // Extract the Boat object
    // Pass the complete Boat object to the calculatePublicCapacity utility
    const publicCapacity = calculatePublicCapacity(boat);

    // Calculate available seats
    const availableSeats =
    publicCapacity + qty <= boat.capacity
      ? publicCapacity + qty
      : boat.capacity;

  console.log(
    `🚤 Boat capacity: ${boat.capacity}, Public capacity: ${publicCapacity}, Calculated seats: ${availableSeats}`
  );

    // Create or update SeatAvailability for the main schedule
    let mainSeatAvailability;
    const mainSeat = await SeatAvailability.findOne({
      where: {
        schedule_id,
        date,
      },
    });

    if (mainSeat) {
      // console.log(
      //   `✅ Main seat availability exists. Updating ID: ${mainSeat.id}`
      // );
      mainSeat.available_seats = availableSeats;
      await mainSeat.save();
      mainSeatAvailability = {
        id: mainSeat.id,
        available_seats: mainSeat.available_seats,
        date: mainSeat.date,
      };
    } else {
      console.log(`🚨 Main seat availability does not exist. Creating new.`);
      const newMainSeatAvailability = await SeatAvailability.create({
        schedule_id,
        date,
        available_seats: availableSeats,
        availability: true,
        boost:false

      });
      console.log(
        `✅ Main seat availability created with ID: ${newMainSeatAvailability.id}`
      );
      mainSeatAvailability = {
        id: newMainSeatAvailability.id,
        available_seats: newMainSeatAvailability.available_seats,
        date: newMainSeatAvailability.date,
      };
    }

    // Process subschedules
    const subscheduleSeatAvailabilities = [];
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
        subscheduleSeatAvailabilities.push({
          id: subSeatAvailability.id,
          available_seats: subSeatAvailability.available_seats,
          date: subSeatAvailability.date,
        });
      } else {
        // console.log(
        //   `🚨 SubSchedule seat availability does not exist. Creating new.`
        // );
        const newSubSeatAvailability = await SeatAvailability.create({
          schedule_id,
          subschedule_id: subschedule.id,
          date,
          available_seats: availableSeats,
          availability: true,
          boost:false

        });
        // console.log(
        //   `✅ SubSchedule seat availability created with ID: ${newSubSeatAvailability.id}`
        // );
        subscheduleSeatAvailabilities.push({
          id: newSubSeatAvailability.id,
          available_seats: newSubSeatAvailability.available_seats,
          date: newSubSeatAvailability.date,
        });
      }
    }

    console.log("✅ All seat availabilities processed successfully.");
    return {
      mainSeatAvailability,
      subscheduleSeatAvailabilities,
    };
  } catch (error) {
    console.error("❌ Failed to create seat availabilities:", error.message);
    throw new Error("Failed to create seat availabilities: " + error.message);
  }
};


const createSeatAvailabilityMax = async ({ schedule_id, date }) => {
  try {
    console.log(
      `🔍 Starting creation for Schedule ID: ${schedule_id}, Date: ${date}`
    );

    // Fetch the main schedule and its boat capacity
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      include: [
        {
          model: Boat,
          as: "Boat",
          attributes: ["id", "capacity"],
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

    console.log(`🚤 Boat capacity: ${schedule.Boat.capacity}`);

    const boatCapacity = schedule.Boat.capacity;

    // Create or update SeatAvailability for the main schedule
    let mainSeatAvailability;
    const mainSeat = await SeatAvailability.findOne({
      where: {
        schedule_id,
        date,
      },
    });

    if (mainSeat) {
      console.log(
        `✅ Main seat availability exists. Updating ID: ${mainSeat.id}`
      );
      mainSeat.available_seats = boatCapacity;
      mainSeat.boost = true; // Set boost to TRUE
      await mainSeat.save();
      mainSeatAvailability = {
        id: mainSeat.id,
        available_seats: mainSeat.available_seats,
        boost: mainSeat.boost, // Include boost field
        date: mainSeat.date,
      };
    } else {
      console.log(`🚨 Main seat availability does not exist. Creating new.`);
      const newMainSeatAvailability = await SeatAvailability.create({
        schedule_id,
        date,
        available_seats: boatCapacity,
        availability: true,
        boost: true, // Set boost to TRUE
      });
      console.log(
        `✅ Main seat availability created with ID: ${newMainSeatAvailability.id}`
      );
      mainSeatAvailability = {
        id: newMainSeatAvailability.id,
        available_seats: newMainSeatAvailability.available_seats,
        boost: newMainSeatAvailability.boost, // Include boost field
        date: newMainSeatAvailability.date,
      };
    }

    // Process subschedules
    const subscheduleSeatAvailabilities = [];
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
        subSeatAvailability.available_seats = boatCapacity;
        subSeatAvailability.boost = true; // Set boost to TRUE
        await subSeatAvailability.save();
        subscheduleSeatAvailabilities.push({
          id: subSeatAvailability.id,
          available_seats: subSeatAvailability.available_seats,
          boost: subSeatAvailability.boost, // Include boost field
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
          available_seats: boatCapacity,
          availability: true,
          boost: true, // Set boost to TRUE
        });
        console.log(
          `✅ SubSchedule seat availability created with ID: ${newSubSeatAvailability.id}`
        );
        subscheduleSeatAvailabilities.push({
          id: newSubSeatAvailability.id,
          available_seats: newSubSeatAvailability.available_seats,
          boost: newSubSeatAvailability.boost, // Include boost field
          date: newSubSeatAvailability.date,
        });
      }
    }

    console.log("✅ All seat availabilities processed successfully.");
    return {
      mainSeatAvailability,
      subscheduleSeatAvailabilities,
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

const boostSeatAvailability = async ({ id, boost }) => {
  console.log(`🔍 Fetching seat availability record for ID: ${id || "N/A"}`);

  if (!id || boost !== true) {
    console.error("❌ Seat availability ID and boost flag are required.");
    throw new Error("Invalid input: ID and boost=true are required.");
  }

  // Fetch the main seat availability by ID
  const mainSeatAvailability = await SeatAvailability.findByPk(id);
  if (!mainSeatAvailability) {
    console.error(`❌ Seat availability not found for ID: ${id}`);
    throw new Error(`Seat availability not found for ID: ${id}`);
  }
  console.log(`✅ Main seat availability found. ID: ${mainSeatAvailability.id}`);

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
  const seatAvailabilityDate = mainSeatAvailability.date;
  console.log(`🚤 Boosting to Boat Capacity: ${boatCapacity}`);

  // Update the main schedule's seat availability
  mainSeatAvailability.available_seats = boatCapacity;
  mainSeatAvailability.boost = true; // Set boost to TRUE
  await mainSeatAvailability.save();
  console.log(
    `✅ Main schedule boosted. ID: ${mainSeatAvailability.id}, New Seats: ${mainSeatAvailability.available_seats}, Boost: ${mainSeatAvailability.boost}`
  );

  // Update or create seat availability for associated subschedules
  const subschedules = [];
  for (const subschedule of schedule.SubSchedules) {
    console.log(`🔄 Processing SubSchedule ID: ${subschedule.id}`);
    const subSeatAvailability = await SeatAvailability.findOne({
      where: {
        schedule_id: schedule.id,
        subschedule_id: subschedule.id,
        date: seatAvailabilityDate,
      },
    });

    if (subSeatAvailability) {
      // Update existing subschedule seat availability
      subSeatAvailability.available_seats = boatCapacity;
      subSeatAvailability.boost = true; // Set boost to TRUE
      await subSeatAvailability.save();
      console.log(
        `✅ SubSchedule boosted. ID: ${subSeatAvailability.id}, New Seats: ${subSeatAvailability.available_seats}, Boost: ${subSeatAvailability.boost}`
      );

      subschedules.push({
        id: subSeatAvailability.id,
        available_seats: subSeatAvailability.available_seats,
        boost: subSeatAvailability.boost, // Include boost field in the result
        date: subSeatAvailability.date,
      });
    } else {
      // Create new subschedule seat availability
      const newSubSeatAvailability = await SeatAvailability.create({
        schedule_id: schedule.id,
        subschedule_id: subschedule.id,
        date: seatAvailabilityDate,
        available_seats: boatCapacity,
        availability: true,
        boost: true, // Set boost to TRUE
      });
      console.log(
        `✅ New SubSchedule seat availability created. ID: ${newSubSeatAvailability.id}`
      );

      subschedules.push({
        id: newSubSeatAvailability.id,
        available_seats: newSubSeatAvailability.available_seats,
        boost: newSubSeatAvailability.boost, // Include boost field in the result
        date: newSubSeatAvailability.date,
      });
    }
  }

  console.log(`✅ Boost completed successfully.`);
  return {
    main_schedule: {
      id: mainSeatAvailability.id,
      available_seats: mainSeatAvailability.available_seats,
      boost: mainSeatAvailability.boost, // Include boost field in the result
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

const fetchSeatAvailability = async ({ date, schedule_id, sub_schedule_id }) => {
  try {
      // Query to fetch SeatAvailability
      const seatAvailability = await SeatAvailability.findOne({
          where: {
              date,
              schedule_id,
              ...(sub_schedule_id && { subschedule_id: sub_schedule_id }),
          },
      });

      return seatAvailability;
  } catch (error) {
      console.error("❌ Error fetching seat availability:", error.message);
      throw new Error("Failed to fetch seat availability.");
  }
};




module.exports = {
  createSeatAvailability,
  createSeatAvailabilityMax,
  fetchSeatAvailability,
  boostSeatAvailability,
  adjustSeatAvailability,
  checkSeatAvailability,

};
