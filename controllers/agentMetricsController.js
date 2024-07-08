const AgentMetrics = require('../models/agentMetrics');

const getAllAgentMetrics = async (req, res) => {
    try {
        const metrics = await AgentMetrics.findAll();
        res.status(200).json(metrics);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving agent metrics', error });
    }
};

const getAgentMetricById = async (req, res) => {
    const { agent_id } = req.params;
    try {
        const metric = await AgentMetrics.findOne({ where: { agent_id } });
        if (metric) {
            res.status(200).json(metric);
        } else {
            res.status(404).json({ message: 'Agent metric not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving agent metric', error });
    }
};

module.exports = {
    getAllAgentMetrics,
    getAgentMetricById
};
