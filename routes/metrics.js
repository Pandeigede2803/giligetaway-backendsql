const express = require('express');
const router = express.Router();

const metricsController = require('../controllers/metricsController');
const authenticate = require('../middleware/authenticate');


// get the metrics

// metrics for the booking is created
router.get('/', authenticate,metricsController.getMetrics);

// get the metrics by departure date (travel date)
router.get('/booking-date', authenticate,metricsController.getMetricsBookingDate)


router.get('/annualy', authenticate,metricsController.getAnnualyMetrics);

// get the metrics by agent id
router.get('/agent/:agent_id', authenticate,metricsController.getMetricsByAgentId); 
router.get('/agent-travel-date/:agent_id', authenticate,metricsController.getMetricsByAgentIdTravelDate); 
router.get('/agent/annualy/:agent_id', authenticate,metricsController.getAgentAnnualyMetrics);
router.get('/agent-statistics', authenticate,metricsController.getAgentStatistics);

router.get('/booking-source', authenticate,metricsController.getBookingMetricsBySource);
router.get('/booking-comparison', authenticate,metricsController.getBookingComparisonMetrics);  



module.exports = router;
