// controllers/boatController.js
const { Boat } = require('../models');

const createBoat = async (req, res) => {
    try {
        const boat = await Boat.create(req.body);
        res.status(201).json(boat);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getBoats = async (req, res) => {
    try {
        const boats = await Boat.findAll();
        res.status(200).json(boats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getBoatById = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id);
        if (boat) {
            res.status(200).json(boat);
        } else {
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateBoat = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id);
        if (boat) {
            await boat.update(req.body);
            res.status(200).json(boat);
        } else {
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteBoat = async (req, res) => {
    try {
        const boat = await Boat.findByPk(req.params.id);
        if (boat) {
            await boat.destroy();
            res.status(204).json();
        } else {
            res.status(404).json({ error: 'Boat not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createBoat,
    getBoats,
    getBoatById,
    updateBoat,
    deleteBoat
};
