const { Transport } = require('../models');

const createTransport = async (req, res) => {
    try {
        console.log('Create transport started');
        const transport = await Transport.create(req.body);
        console.log('Create transport success');
        res.status(201).json(transport);
    } catch (error) {
        console.log('Create transport error', error.message);
        res.status(400).json({ error: error.message });
    }
};

const getTransports = async (req, res) => {
    try {
        console.log('Get transports started');
        const transports = await Transport.findAll();
        console.log('Get transports success');
        res.status(200).json(transports);
    } catch (error) {
        console.log('Get transports error', error.message);
        res.status(400).json({ error: error.message });
    }
};

const getTransportById = async (req, res) => {
    try {
        console.log('Get transport by id started');
        const transport = await Transport.findByPk(req.params.id);
        if (transport) {
            console.log('Get transport by id success');
            res.status(200).json(transport);
        } else {
            console.log('Get transport by id not found');
            res.status(404).json({ error: 'Transport not found' });
        }
    } catch (error) {
        console.log('Get transport by id error', error.message);
        res.status(400).json({ error: error.message });
    }
};

// CREATE multiple transports
const createMultipleTransports = async (req, res) => {
    try {
        console.log('Create multiple transports started');
        const transports = await Transport.bulkCreate(req.body);
        console.log('Create multiple transports success');
        res.status(201).json(transports);
    } catch (error) {
        console.log('Create multiple transports error', error.message);
        res.status(500).json({ error: error.message });
    }
};

const updateTransport = async (req, res) => {
    try {
        console.log('Update transport started');
        const transport = await Transport.findByPk(req.params.id);
        if (transport) {
            await transport.update(req.body);
            console.log('Update transport success');
            res.status(200).json(transport);
        } else {
            console.log('Update transport not found');
            res.status(404).json({ error: 'Transport not found' });
        }
    } catch (error) {
        console.log('Update transport error', error.message);
        res.status(400).json({ error: error.message });
    }
};

const deleteTransport = async (req, res) => {
    try {
        console.log('Delete transport started');
        const transport = await Transport.findByPk(req.params.id);
        if (transport) {
            await transport.destroy();
            console.log('Delete transport success');
            res.status(204).json();
        } else {
            console.log('Delete transport not found');
            res.status(404).json({ error: 'Transport not found' });
        }
    } catch (error) {
        console.log('Delete transport error', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createTransport,
    getTransports,
    getTransportById,
    updateTransport,
    deleteTransport,
    createMultipleTransports
};

