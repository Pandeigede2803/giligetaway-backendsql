const { Passenger } = require('../models');

const createPassenger = async (req, res) => {
    try {
        const passenger = await Passenger.create(req.body);
        res.status(201).json(passenger);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getPassengers = async (req, res) => {
    try {
        const passengers = await Passenger.findAll();
        res.status(200).json(passengers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getPassengerById = async (req, res) => {
    try {
        const passenger = await Passenger.findByPk(req.params.id);
        if (passenger) {
            res.status(200).json(passenger);
        } else {
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updatePassenger = async (req, res) => {
    try {
        const passenger = await Passenger.findByPk(req.params.id);
        if (passenger) {
            await passenger.update(req.body);
            res.status(200).json(passenger);
        } else {
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deletePassenger = async (req, res) => {
    try {
        const passenger = await Passenger.findByPk(req.params.id);
        if (passenger) {
            await passenger.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Passenger not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createPassenger,
    getPassengers,
    getPassengerById,
    updatePassenger,
    deletePassenger
};
