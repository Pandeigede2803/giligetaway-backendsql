const express = require('express');
const router = express.Router();
const { getAllAgentMetrics, getAgentMetricById } = require('../controllers/agentMetricsController');
const authenticate = require('../middleware/authenticate');

// Route to get all agent metrics
router.get('/',authenticate, getAllAgentMetrics);

// Route to get a specific agent metric by agent_id
router.get('/:agent_id',authenticate, getAgentMetricById);

module.exports = router;
