// controllers/transitController.js
const { Transit, Schedule, Destination,sequelize } = require('../models');



const createTransit = async (req, res) => {
    try {
        const {
            schedule_id,
            destination_id,
            check_in_time,
            departure_time,
            arrival_time,
            journey_time
        } = req.body;

        // Log request body
        console.log('Request Body:', req.body);

        // Validasi schedule_id
        const schedule = await Schedule.findByPk(schedule_id);
        if (!schedule) {
            console.log(`Schedule ID ${schedule_id} not found.`);
            return res.status(400).json({ error: `Schedule ID ${schedule_id} not found.` });
        }

        // Validasi destination_id
        const destination = await Destination.findByPk(destination_id);
        if (!destination) {
            console.log(`Destination ID ${destination_id} not found.`);
            return res.status(400).json({ error: `Destination ID ${destination_id} not found.` });
        }

        // Membuat entri transit baru
        const transit = await Transit.create({
            schedule_id,
            destination_id,
            check_in_time,
            departure_time,
            arrival_time,
            journey_time
        });

        // Log success message
        console.log('Transit Created:', transit);

        res.status(201).json(transit);
    } catch (error) {
        // Log error
        console.log('Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};


const getAllTransits = async (req, res) => {
    try {
        const transits = await Transit.findAll({
            include: [{
                model: Destination,
                as: 'Destination',
                attributes: ['id', 'name', 'port_map_url', 'image_url']
            }]
        });
        res.status(200).json(transits);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getTransitById = async (req, res) => {
    try {
        const { id } = req.params;
        const transit = await Transit.findByPk(id, {
            include: [{
                model: Destination,
                as: 'Destination',
                attributes: ['id', 'name', 'port_map_url', 'image_url']
            }]
        });
        if (transit) {
            res.status(200).json(transit);
        } else {
            res.status(404).json({ error: 'Transit not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getTransitsBySchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const transits = await Transit.findAll({
            where: { schedule_id: scheduleId },
            include: [
                {
                    model: Destination,
                    as: 'Destination',
                    attributes: ['id', 'name', 'port_map_url', 'image_url'] // Include desired attributes
                }
            ]
        });
        res.status(200).json(transits);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateTransit = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const scheduleId = req.params.scheduleId;
        const transits = req.body.transits;

        console.log('Updating transits for schedule with ID:', scheduleId);
        console.log('Transits data received:', transits);

        const schedule = await Schedule.findByPk(scheduleId, {
            include: [Transit],
            transaction: t
        });

        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Delete existing transits
        await Transit.destroy({
            where: { schedule_id: schedule.id },
            transaction: t
        });
        console.log('Existing transits deleted for schedule ID:', schedule.id);

        // Create new transits
        const newTransits = [];
        for (const transit of transits) {
            const { destination_id, check_in_time, departure_time, arrival_time, journey_time } = transit;

            // Validate destination_id
            const destination = await Destination.findByPk(destination_id, { transaction: t });
            if (!destination) {
                throw new Error(`Destination ID ${destination_id} not found.`);
            }

            const newTransit = await Transit.create({
                schedule_id: schedule.id,
                destination_id,
                check_in_time,
                departure_time,
                arrival_time,
                journey_time
            }, { transaction: t });
            console.log('Transit created:', newTransit);

            newTransits.push(newTransit);
        }

        await t.commit();
        console.log('Transaction committed.');
        res.status(200).json({ message: 'Transits updated successfully', transits: newTransits });
    } catch (error) {
        await t.rollback();
        console.error('Error updating transits:', error);
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

