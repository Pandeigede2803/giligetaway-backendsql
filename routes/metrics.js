const express = require('express');
const router = express.Router();

const metricsController = require('../controllers/metricsController');
const authenticate = require('../middleware/authenticate');


// get the metrics
router.get('/', authenticate,metricsController.getMetrics);
router.get('/annualy', authenticate,metricsController.getAnnualyMetrics);

// get the metrics by agent id
router.get('/agent/:agent_id', authenticate,metricsController.getMetricsByAgentId); 
router.get('/agent/annualy/:agent_id', authenticate,metricsController.getAgentAnnualyMetrics);
router.get('/booking-source', authenticate,metricsController.getBookingMetricsBySource);



module.exports = router;
