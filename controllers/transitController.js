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
};;

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
    const transaction = await sequelize.transaction(); // Start transaction
    try {
        const { id } = req.params;
        const {
            destination_id,
            check_in_time,
            departure_time,
            arrival_time,
            journey_time,
            schedule_id // Add schedule_id to destructuring
        } = req.body;

        console.log(`Updating transit with ID: ${id}`);
        console.log("req body", req.body)

        let transit;

        if (id === "new") {
            // Create a new transit
            transit = await Transit.create({
                destination_id,
                check_in_time,
                departure_time,
                arrival_time,
                journey_time,
                schedule_id // Include schedule_id in the creation
            }, { transaction });
            console.log('Created new transit:', transit);
        } else {
            // Find the existing transit
            transit = await Transit.findByPk(id, { transaction });
            if (!transit) {
                await transaction.rollback(); // Rollback if not found
                console.error('Transit not found');
                return res.status(404).json({ error: 'Transit not found' });
            }

            // Validation (Destination only):
            if (destination_id) { // Check if destination_id was provided
                const destination = await Destination.findByPk(destination_id, { transaction });
                if (!destination) {
                    await transaction.rollback(); // Rollback if invalid destination
                    console.error(`Destination ID ${destination_id} not found.`);
                    return res.status(400).json({ error: `Destination ID ${destination_id} not found.` });
                }
            }

            // Update the transit
            await transit.update({
                destination_id, // Only update destination_id if provided
                check_in_time,
                departure_time,
                arrival_time,
                journey_time
            }, { transaction });
            console.log('Updated transit:', transit);
        }

        await transaction.commit(); // Commit changes
        res.status(200).json(transit);
    } catch (error) {
        await transaction.rollback(); // Rollback on error
        console.error('Error updating transit:', error);
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