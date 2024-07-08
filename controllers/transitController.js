// controllers/transitController.js
const { Transit, Schedule, Destination } = require('../models');

const createTransit = async (req, res) => {
    try {
        const { schedule_id, destination_id, available_seats } = req.body;

        // Validasi schedule_id
        const schedule = await Schedule.findByPk(schedule_id);
        if (!schedule) {
            return res.status(400).json({ error: `Schedule ID ${schedule_id} not found.` });
        }

        // Validasi destination_id
        const destination = await Destination.findByPk(destination_id);
        if (!destination) {
            return res.status(400).json({ error: `Destination ID ${destination_id} not found.` });
        }

        const transit = await Transit.create({ schedule_id, destination_id, available_seats });
        res.status(201).json(transit);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getAllTransits = async (req, res) => {
    try {
        const transits = await Transit.findAll();
        res.status(200).json(transits);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getTransitsBySchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const transits = await Transit.findAll({
            where: { schedule_id: scheduleId }
        });
        res.status(200).json(transits);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getTransitById = async (req, res) => {
    try {
        const { id } = req.params;
        const transit = await Transit.findByPk(id);
        if (transit) {
            res.status(200).json(transit);
        } else {
            res.status(404).json({ error: 'Transit not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateTransit = async (req, res) => {
    try {
        const { id } = req.params;
        const { destination_id, available_seats } = req.body;

        const transit = await Transit.findByPk(id);
        if (transit) {
            await transit.update({ destination_id, available_seats, updated_at: new Date() });
            res.status(200).json(transit);
        } else {
            res.status(404).json({ error: 'Transit not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteTransit = async (req, res) => {
    try {
        const { id } = req.params;
        const transit = await Transit.findByPk(id);
        if (transit) {
            await transit.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Transit not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createTransit,
    getAllTransits,
    getTransitsBySchedule,
    getTransitById,
    updateTransit,
    deleteTransit
};

