// controllers/boatController.js


const { Boat, Schedule, Booking } = require('../models'); // Adjust the import if needed


const createBoat = async (req, res) => {
    try {
        const boat = await Boat.create(req.body);
        console.log('Boat created:', boat);
        res.status(201).json(boat);
    } catch (error) {
        console.log('Error creating boat:', error.message);
        res.status(400).json({ error: error.message });
    }
};
const getBoats = async (req, res) => {
    try {
        const boats = await Boat.findAll({
            include: [
                {
                    model: Schedule,
                    as: 'Schedules',
                    include: [
                        {
                            model: Booking,
                            as: 'Bookings'
                        }
                    ]
                }
            ]
        });

        const boatsData = boats.map(boat => {
            const boatData = boat.toJSON();
            boatData.scheduleCount = boat.Schedules.length;
            boatData.bookingCount = boat.Schedules.reduce((total, schedule) => total + schedule.Bookings.length, 0);
            return boatData;
        });

        console.log('Boats retrieved:', boatsData);
        res.status(200).json(boatsData);
    } catch (error) {
        console.log('Error retrieving boats:', error.message);
        res.status(400).json({ error: error.message });
    }
};


const getBoatById = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id, {
            include: [
                {
                    model: Schedule,
                    as: 'Schedules',
                    include: [
                        {
                            model: Booking,
                            as: 'Bookings'
                        }
                    ]
                }
            ]
        });

        if (boat) {
            const boatData = boat.toJSON();
            boatData.scheduleCount = boat.Schedules.length;
            boatData.bookingCount = boat.Schedules.reduce((total, schedule) => total + schedule.Bookings.length, 0);

            console.log('Boat retrieved:', boatData);
            res.status(200).json(boatData);
        } else {
            console.log('Boat not found with id:', req.params.id);
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        console.log('Error retrieving boat:', error.message);
        res.status(400).json({ error: error.message });
    }
};


const updateBoat = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id);
        if (boat) {
            const updatedBoat = await boat.update(req.body);
            console.log('Boat updated from:', updatedBoat);
            res.status(200).json(updatedBoat);
        } else {
            console.log('Boat not found with id:', req.params.id);
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        console.log('Error updating boat:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const deleteBoat = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id, {
            include: [
                {
                    model: Schedule,
                    as: 'Schedules'
                }
            ]
        });
        if (boat && boat.Schedules.length === 0) {
            await boat.destroy();
            console.log('Boat deleted:', boat);
            res.status(204).json();
        } else {
            console.log('Error deleting Boat because there are schedules still running for it');
            res.status(400).json({ error: 'Error deleting Boat because there are schedules still running for it' });
        }
    } catch (error) {
        console.log('Error deleting boat:', error.message);
        if (error.message.includes('Cannot delete or update a parent row: a foreign key constraint fails')) {
            return res.status(400).json({ error: 'Cannot delete Boat because there are schedules still running for it' });
        }
        res.status(400).json({ error: error.message });;
    }
};

module.exports = {
    createBoat,
    getBoats,
    getBoatById,
    updateBoat,
    deleteBoat
};
