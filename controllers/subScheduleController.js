const { SubSchedule, Schedule,Boat, Transit, Destination,SeatAvailability } = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { sequelize } = require("../models");
const { mapTransitDetails } = require("../util/mapTransitDetails");;


const updateSubSchedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const subScheduleId = req.params.id;
    let subScheduleData = req.body;

    console.log('DATA BODY YNG DITERMIMA dan id`:' ,subScheduleId, subScheduleData);

    const subSchedule = await SubSchedule.findByPk(subScheduleId, {
      transaction: t
    });

    if (!subSchedule) {
      return res.status(404).json({ error: 'SubSchedule not found' });
    }

    // Convert 'None' strings to null
    for (let key in subScheduleData) {
      if (subScheduleData[key] === 'None') {
        subScheduleData[key] = null;
      }
    }

    // Ensure availability is a boolean
    if (typeof subScheduleData.availability === 'string') {
      subScheduleData.availability = subScheduleData.availability === 'true';
    }

    // Log processed data
    console.log('Processed data:', subScheduleData);

    // If there is a file, call middleware uploadImageToImageKit
    if (req.file) {
      await uploadImageToImageKit(req, res, async () => {
        if (req.file && req.file.url) {
          subScheduleData.route_image = req.file.url;
        }
        // Update schedule
        await subSchedule.update(subScheduleData, { transaction: t });
        console.log('SubSchedule updated with image:', subSchedule);

        await t.commit();
        console.log('Transaction committed.');
        res.status(200).json(subSchedule);
      });;
    } else {
      // Update schedule without file
      await subSchedule.update(subScheduleData, { transaction: t });
      console.log('SubSchedule updated without image:', subSchedule);

      await t.commit();
      console.log('Transaction committed.');
      res.status(200).json(subSchedule);;
    }
  } catch (error) {
    await t.rollback();
    console.error('Error updating subSchedule:', error);
    res.status(400).json({ error: error.message });
  }
};


const getAllSubSchedules = async (req, res) => {
  try {
    const subSchedules = await SubSchedule.findAll({
      include: [
        {
          model: Schedule,
          as: "Schedule",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_from_id",
            "destination_to_id",
          ],
          include: [
            {
              model: Destination,
              as: "DestinationFrom",
              attributes: ["id", "name"],
            },
            {
              model: Destination,
              as: "DestinationTo",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: Transit,
          as: "TransitFrom",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "TransitTo",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit1",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit2",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit3",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit4",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
      ],
    });

    const result = subSchedules.map(subSchedule => {
      const transits = [1, 2, 3, 4].reduce((acc, i) => {
        const transit = subSchedule[`Transit${i}`];
        if (transit) {
          acc[`transit_${i}`] = {
            id: transit.id,
            check_in_time: transit.check_in_time,
            arrival_time: transit.arrival_time,
            journey_time: transit.journey_time,
            departure_time: transit.departure_time,
            destination_id: transit.destination_id,
            destination_name: transit.Destination.name,
          };
        } else {
          acc[`transit_${i}`] = null;
        }
        return acc;
      }, {});

      const schedule = subSchedule.Schedule;
      const scheduleData = {
        ...schedule.toJSON(),
        destination_from: schedule.DestinationFrom ? {
          id: schedule.DestinationFrom.id,
          name: schedule.DestinationFrom.name,
        } : null,
        destination_to: schedule.DestinationTo ? {
          id: schedule.DestinationTo.id,
          name: schedule.DestinationTo.name,
        } : null,
      };

      delete scheduleData.DestinationFrom;
      delete scheduleData.DestinationTo;

      const subScheduleJSON = subSchedule.toJSON();
      delete subScheduleJSON.Transit1;
      delete subScheduleJSON.Transit2;
      delete subScheduleJSON.Transit3;
      delete subScheduleJSON.Transit4;
      delete subScheduleJSON.Schedule;

      return {
        ...subScheduleJSON,
        destination_from_schedule_id: subScheduleJSON.destination_from_schedule_id ? {
          id: subScheduleJSON.destination_from_schedule_id,
          name: scheduleData.destination_from ? scheduleData.destination_from.name : null,
        } : null,
        destination_to_schedule_id: subScheduleJSON.destination_to_schedule_id ? {
          id: subScheduleJSON.destination_to_schedule_id,
          name: scheduleData.destination_to ? scheduleData.destination_to.name : null,
        } : null,
        Schedule: scheduleData,
        transit_from_id: subScheduleJSON.transit_from_id ? {
          id: subScheduleJSON.transit_from_id,
          check_in_time: subSchedule.TransitFrom?.check_in_time || null,
          arrival_time: subSchedule.TransitFrom?.arrival_time || null,
          journey_time: subSchedule.TransitFrom?.journey_time || null,
          departure_time: subSchedule.TransitFrom?.departure_time || null,
          destination_id: subSchedule.TransitFrom?.destination_id || null,
          destination_name: subSchedule.TransitFrom?.Destination?.name || null,
        } : null,
        transit_to_id: subScheduleJSON.transit_to_id ? {
          id: subScheduleJSON.transit_to_id,
          check_in_time: subSchedule.TransitTo?.check_in_time || null,
          arrival_time: subSchedule.TransitTo?.arrival_time || null,
          journey_time: subSchedule.TransitTo?.journey_time || null,
          departure_time: subSchedule.TransitTo?.departure_time || null,
          destination_id: subSchedule.TransitTo?.destination_id || null,
          destination_name: subSchedule.TransitTo?.Destination?.name || null,
        } : null,
        ...transits
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching sub schedules:", error);
    res.status(500).json({ error: "An error occurred while fetching sub schedules" });
  }
};


const createSubSchedule = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      schedule_id,
      destination_from_schedule_id,
      destination_to_schedule_id,
      transit_from_id,
      transit_to_id,
      low_season_price,
      high_season_price,
      peak_season_price,
      return_low_season_price,
      return_high_season_price,
      return_peak_season_price,
      validity_start,
      validity_end,
      transit_1,
      transit_2,
      transit_3,
      transit_4,
      days_of_week,
    } = req.body;

    console.log("Received subschedule data:", req.body);

    // Call the upload middleware to handle image upload
    await uploadImageToImageKit(req, res, async () => {
      if (!req.file.url) {
        throw new Error("Image file is required");
      }

      // Check if the schedule_id exists
      const schedule = await Schedule.findByPk(schedule_id, { transaction: t });
      if (!schedule) {
        throw new Error("Schedule not found");
      }
      console.log("Schedule found:", schedule);

      // Create the new subschedule with availability set to true
      const newSubSchedule = await SubSchedule.create(
        {
          schedule_id,
          destination_from_schedule_id,
          destination_to_schedule_id,
          transit_from_id: transit_from_id || null,
          transit_to_id,
          low_season_price,
          high_season_price,
          peak_season_price,
          return_low_season_price,
          return_high_season_price,
          return_peak_season_price,
          validity_start,
          validity_end,
          route_image: req.file.url,
          availability: true,
          days_of_week,
          transit_1: transit_1 || null,
          transit_2: transit_2 || null,
          transit_3: transit_3 || null,
          transit_4: transit_4 || null,
        },
        { transaction: t }
      );

      await t.commit();
      res.status(201).json(newSubSchedule);
    });
  } catch (error) {
    await t.rollback();
    console.error("Error creating subschedule:", error.message);
    next(error); // Pass error to the error-handling middleware
  }
};
// Get a single subschedule by ID
const getSubScheduleById = async (req, res) => {
  const { id } = req.params;

  try {
    const subschedule = await SubSchedule.findByPk(id, {
      include: [
        {
          model: Schedule,
          as: "Schedule",
          attributes: [
            "id",
            "validity_start",
            "validity_end",
            "boat_id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_from_id",
            "destination_to_id",
          ],
          include: [
            {
              model: Boat,
              as: "Boat", // Include Boat details
              attributes: ["id", "boat_name", "capacity", "boat_image"],
            },
            
            {
              model: Destination,
              as: "DestinationFrom",
              attributes: ["id", "name"],
            },
            {
              model: Destination,
              as: "DestinationTo",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: SeatAvailability,
          as: "SeatAvailabilities",
        },
        {
          model: Transit,
          as: "Transit1",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit2",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit3",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
        {
          model: Transit,
          as: "Transit4",
          attributes: [
            "id",
            "check_in_time",
            "arrival_time",
            "journey_time",
            "departure_time",
            "destination_id",
          ],
          include: {
            model: Destination,
            as: "Destination",
            attributes: ["name"],
          },
        },
      ],
    });

    if (!subschedule) {
      return res.status(404).json({ error: "Subschedule not found" });
    }

    const transits = [1, 2, 3, 4].reduce((acc, i) => {
      const transit = subschedule[`Transit${i}`];
      if (transit) {
        acc[`transit_${i}`] = {
          id: transit.id,
          check_in_time: transit.check_in_time,
          arrival_time: transit.arrival_time,
          journey_time: transit.journey_time,
          departure_time: transit.departure_time,
          destination_id: transit.destination_id,
          destination_name: transit.Destination.name,
        };
      } else {
        acc[`transit_${i}`] = null;
      }
      return acc;
    }, {});

    const schedule = subschedule.Schedule;
    const scheduleData = {
      ...schedule.toJSON(),
      destination_from: schedule.DestinationFrom ? {
        id: schedule.DestinationFrom.id,
        name: schedule.DestinationFrom.name,
      } : null,
      destination_to: schedule.DestinationTo ? {
        id: schedule.DestinationTo.id,
        name: schedule.DestinationTo.name,
      } : null,
    };

    delete scheduleData.DestinationFrom;
    delete scheduleData.DestinationTo;

    const subscheduleJSON = subschedule.toJSON();
    delete subscheduleJSON.Transit1;
    delete subscheduleJSON.Transit2;
    delete subscheduleJSON.Transit3;
    delete subscheduleJSON.Transit4;
    delete subscheduleJSON.Schedule;

    const result = {
      ...subscheduleJSON,
      destination_from_schedule_id: subscheduleJSON.destination_from_schedule_id ? {
        id: subscheduleJSON.destination_from_schedule_id,
        name: scheduleData.destination_from ? scheduleData.destination_from.name : null,
      } : null,
      destination_to_schedule_id: subscheduleJSON.destination_to_schedule_id ? {
        id: subscheduleJSON.destination_to_schedule_id,
        name: scheduleData.destination_to ? scheduleData.destination_to.name : null,
      } : null,
      Schedule: scheduleData,
      ...transits
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching subschedule:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Update a subschedule

// Delete a subschedule
const deleteSubSchedule = async (req, res) => {
  const { id } = req.params;

  try {
    const subschedule = await SubSchedule.findByPk(id);

    if (!subschedule) {
      return res.status(404).json({ error: "Subschedule not found" });
    }

    await subschedule.destroy();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting subschedule:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createSubSchedule,
  getAllSubSchedules,
  getSubScheduleById,
  updateSubSchedule,
  deleteSubSchedule,
};
