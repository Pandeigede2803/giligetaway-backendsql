// const { sequelize } = require('../config/database'); // Pastikan jalur impor benar
const { Agent, AgentMetrics,sequelize } = require('../models'); // Pastikan jalur impor benar

// Get all agents
exports.getAllAgents = async (req, res) => {
    try {
        const agents = await Agent.findAll();
        console.log('All agents retrieved:', agents);
        res.status(200).json(agents);
    } catch (error) {
        console.log('Error retrieving agents:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Get agent by id
exports.getAgentById = async (req, res) => {
    try {
        const agent = await Agent.findByPk(req.params.id);
        if (agent) {
            console.log('Agent retrieved:', agent);
            res.status(200).json(agent);
        } else {
            console.log('Agent not found:', req.params.id);
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log('Error retrieving agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Create agent
exports.createAgent = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        console.log('Data received for creating agent:', req.body);

        // Create the agent
        const agent = await Agent.create(req.body, { transaction });
        console.log('Agent created:', agent);

        // Create corresponding AgentMetrics entry
        const agentMetrics = await AgentMetrics.create({
            agent_id: agent.id,
            total_revenue: 0.00,
            total_customers: 0,
            total_bookings: 0,
            gross_revenue: 0.00,
            net_profit: 0.00,
            gross_pending_payment: 0.00,
            net_pending_profit: 0.00,
            unpaid_payment: 0.00,
            pending_payment: 0.00,
            outstanding: 0.00,
            payout: 0.00
        }, { transaction });
        console.log('AgentMetrics created:', agentMetrics);

        // Commit the transaction
        await transaction.commit();

        res.status(201).json(agent);
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();

        console.log('Error creating agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Update agent
exports.updateAgent = async (req, res) => {
    try {
        const [updated] = await Agent.update(req.body, {
            where: { id: req.params.id }
        });
        if (updated) {
            const updatedAgent = await Agent.findByPk(req.params.id);
            console.log('Agent updated:', updatedAgent);
            res.status(200).json(updatedAgent);
        } else {
            console.log('Agent not found:', req.params.id);
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log('Error updating agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Delete agent
exports.deleteAgent = async (req, res) => {
    try {
        const deleted = await Agent.destroy({
            where: { id: req.params.id }
        });
        if (deleted) {
            console.log('Agent deleted:', req.params.id);
            res.status(204).json({ message: 'Agent deleted' });
        } else {
            console.log('Agent not found:', req.params.id);
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log('Error deleting agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Delete all agents and reset all agent metrics
// Delete all agents and reset all agent metrics
// Delete all agents and reset all agent metrics
exports.deleteAllAgentsAndResetMetrics = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Hapus semua entri di AgentMetrics
        await AgentMetrics.destroy({
            where: {},
            transaction
        });

        // Hapus semua entri di Agents
        await Agent.destroy({
            where: {},
            transaction
        });

        // Commit the transaction
        await transaction.commit();

        console.log('All agents and their metrics deleted');
        res.status(204).json({ message: 'All agents and their metrics deleted' });
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();

        console.log('Error deleting all agents and resetting metrics:', error.message);
        res.status(500).json({ message: error.message });
    }
};