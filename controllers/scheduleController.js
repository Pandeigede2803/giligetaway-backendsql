// controllers/scheduleController.js
const { Schedule, User, Boat, Destination } = require('../models');
const { Op } = require('sequelize');

// Create a new schedule (existing function)
const createSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.create(req.body);
        res.status(201).json(schedule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all schedules (existing function)
const getSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.findAll();
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedule by ID (existing function)
const getScheduleById = async (req, res) => {
    try {
        const schedule = await Schedule.findByPk(req.params.id);
        if (schedule) {
            res.status(200).json(schedule);
        } else {
            res.status(404).json({ error: 'Schedule not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by destination
const getSchedulesByDestination = async (req, res) => {
    try {
        const { destinationId } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                [Op.or]: [
                    { destination_from_id: destinationId },
                    { destination_to_id: destinationId }
                ]
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by validity period
const getSchedulesByValidity = async (req, res) => {
    try {
        const { validity } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                validity_period: validity
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by boat ID
const getSchedulesByBoat = async (req, res) => {
    try {
        const { boatId } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                boat_id: boatId
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get schedules by user ID
const getSchedulesByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const schedules = await Schedule.findAll({
            where: {
                user_id: userId
            }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update schedule (existing function)
const updateSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findByPk(req.params.id);
        if (schedule) {
            await schedule.update(req.body);
            res.status(200).json(schedule);
        } else {
            res.status(404).json({ error: 'Schedule not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete schedule (existing function)
const deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findByPk(req.params.id);
        if (schedule) {
            await schedule.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Schedule not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Upload schedules (existing function)
const uploadSchedules = async (req, res) => {
    const schedules = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream.pipe(csvParser())
        .on('data', async (row) => {
            try {
                const { boat_id, destination_from_id, destination_to_id, user_id, validity_period, check_in_time, low_season_price, high_season_price, peak_season_price, return_low_season_price, return_high_season_price, return_peak_season_price, arrival_time, journey_time, route_image, available_seats } = row;

                // Validate IDs
                const user = await User.findByPk(user_id);
                const boat = await Boat.findByPk(boat_id);
                const destinationFrom = await Destination.findByPk(destination_from_id);
                const destinationTo = await Destination.findByPk(destination_to_id);

                if (!user || !boat || !destinationFrom || !destinationTo) {
                    throw new Error('Invalid ID(s) provided.');
                }

                schedules.push({
                    boat_id,
                    destination_from_id,
                    destination_to_id,
                    user_id,
                    validity_period,
                    check_in_time,
                    low_season_price,
                    high_season_price,
                    peak_season_price,
                    return_low_season_price,
                    return_high_season_price,
                    return_peak_season_price,
                    arrival_time,
                    journey_time,
                    route_image,
                    available_seats,
                });
            } catch (error) {
                console.log('Error processing row:', error.message);
            }
        })
        .on('end', async () => {
            try {
                await Schedule.bulkCreate(schedules);
                res.status(201).json({ message: 'Schedules uploaded successfully', schedules });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        })
        .on('error', (error) => {
            console.log('Error reading CSV:', error.message);
            res.status(500).json({ error: error.message });
        });
};

module.exports = {
    createSchedule,
    getSchedules,
    getScheduleById,
    getSchedulesByDestination,
    getSchedulesByValidity,
    getSchedulesByBoat,
    getSchedulesByUser,
    updateSchedule,
    deleteSchedule,
    uploadSchedules
};
