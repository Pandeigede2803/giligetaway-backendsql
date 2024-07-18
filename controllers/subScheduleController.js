const { SubSchedule, Schedule, Transit, Destination } = require("../models");
const { uploadImageToImageKit } = require("../middleware/upload");
const { sequelize } = require("../models");
const { mapTransitDetails } = require("../util/mapTransitDetails");;

const updateSubSchedule = async (req, res) => {
  const { id } = req.params;
  const {
    schedule_id,
    sub_schedule_name,
    departure_time,
    arrival_time,
    low_season_price,
    high_season_price,
    peak_season_price,
    return_low_season_price,
    return_high_season_price,
    return_peak_season_price,
    validity_start,
    validity_end,
    check_in_time,
    route_image,
    availability,
    transit_from_id,
    transit_to_id,
    transit_1,
    transit_2,
    transit_3,
    transit_4
  } = req.body;

  try {
    console.log(`Updating SubSchedule with ID: ${id}`);

    // Mengambil sub-schedule berdasarkan ID
    const subschedule = await SubSchedule.findByPk(id, {
      include: [
        { model: Schedule, as: 'Schedule' },
        { model: Transit, as: 'TransitFrom' },
        { model: Transit, as: 'TransitTo' },
        { model: Transit, as: 'Transit1' },
        { model: Transit, as: 'Transit2' },
        { model: Transit, as: 'Transit3' },
        { model: Transit, as: 'Transit4' },
      ]
    });

    if (!subschedule) {
      console.log(`SubSchedule with ID: ${id} not found.`);
      return res.status(404).json({ status: 'error', message: 'SubSchedule not found' });
    }

    let uploadedImageUrl = route_image;

    if (req.file) {
      console.log("Uploading new route image...");
      const uploadedImage = await uploadImageToImageKit(req.file);
      uploadedImageUrl = uploadedImage.url;
      console.log("Image uploaded successfully:", uploadedImageUrl);
    }

    // Build the update object dynamically
    const updateFields = {};

    if (schedule_id !== undefined) updateFields.schedule_id = schedule_id;
    if (sub_schedule_name !== undefined) updateFields.sub_schedule_name = sub_schedule_name;
    if (departure_time !== undefined) updateFields.departure_time = departure_time;
    if (arrival_time !== undefined) updateFields.arrival_time = arrival_time;
    if (low_season_price !== undefined) updateFields.low_season_price = low_season_price;
    if (high_season_price !== undefined) updateFields.high_season_price = high_season_price;
    if (peak_season_price !== undefined) updateFields.peak_season_price = peak_season_price;
    if (return_low_season_price !== undefined) updateFields.return_low_season_price = return_low_season_price;
    if (return_high_season_price !== undefined) updateFields.return_high_season_price = return_high_season_price;
    if (return_peak_season_price !== undefined) updateFields.return_peak_season_price = return_peak_season_price;
    if (validity_start !== undefined) updateFields.validity_start = validity_start;
    if (validity_end !== undefined) updateFields.validity_end = validity_end;
    if (check_in_time !== undefined) updateFields.check_in_time = check_in_time;
    if (uploadedImageUrl !== undefined) updateFields.route_image = uploadedImageUrl;
    if (availability !== undefined) updateFields.availability = availability;
    if (transit_from_id !== undefined) updateFields.transit_from_id = transit_from_id;
    if (transit_to_id !== undefined) updateFields.transit_to_id = transit_to_id;
    if (transit_1 !== undefined) updateFields.transit_1 = transit_1;
    if (transit_2 !== undefined) updateFields.transit_2 = transit_2;
    if (transit_3 !== undefined) updateFields.transit_3 = transit_3;
    if (transit_4 !== undefined) updateFields.transit_4 = transit_4;

    await subschedule.update(updateFields);

    console.log(`SubSchedule with ID: ${id} updated successfully.`);;``
    const updatedSubSchedule = await SubSchedule.findByPk(id, {
      include: [
        { model: Schedule, as: 'Schedule' },
        { model: Transit, as: 'TransitFrom' },
        { model: Transit, as: 'TransitTo' },
        { model: Transit, as: 'Transit1' },
        { model: Transit, as: 'Transit2' },
        { model: Transit, as: 'Transit3' },
        { model: Transit, as: 'Transit4' },
      ]
    });
    console.log("Updated SubSchedule data:", updatedSubSchedule);
    return res.status(200).json({ status: 'success', data: updatedSubSchedule });

  } catch (error) {
    console.error("Error updating SubSchedule:", error.message);
    return res.status(500).json({ status: 'error', message: error.message });
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

    res.status(200).json(subSchedules);
  } catch (error) {
    console.error("Error fetching sub schedules:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching sub schedules" });
  }
};

;

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
      include: [{ model: Schedule, as: "Schedule" }],
    });

    if (!subschedule) {
      return res.status(404).json({ error: "Subschedule not found" });
    }

    res.status(200).json(subschedule);
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
