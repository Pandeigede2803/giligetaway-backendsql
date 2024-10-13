const { Destination } = require('../models');

const createDestination = async (req, res) => {
    try {
        const destination = await Destination.create(req.body);
        res.status(201).json(destination);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getDestinations = async (req, res) => {
    try {
        const destinations = await Destination.findAll();
        res.status(200).json(destinations);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const createMultipleDestinations = async (req, res) => {
    try {
        const destinations = await Destination.bulkCreate(req.body);
        res.status(201).json(destinations);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getDestinationById = async (req, res) => {
    try {
        const destination = await Destination.findByPk(req.params.id);
        if (destination) {
            res.status(200).json(destination);
        } else {
            res.status(404).json({ error: 'Destination not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
const updateDestination = async (req, res) => {
    try {
        const destination = await Destination.findByPk(req.params.id);
        if (destination) {
            console.log('Updating destination with ID:', req.params.id);
            console.log('Request body:', req.body);
            await destination.update(req.body);
            res.status(200).json(destination);
        } else {
            res.status(404).json({ error: 'Destination not found' });
        }
    } catch (error) {
        console.error('Error updating destination:', error);
        res.status(400).json({ error: error.message });
    }
};

const deleteDestination = async (req, res) => {
    try {
        const destination = await Destination.findByPk(req.params.id);
        if (destination) {
            await destination.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Destination not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createDestination,
    getDestinations,
    getDestinationById,
    updateDestination,
    deleteDestination,
    createMultipleDestinations
};
