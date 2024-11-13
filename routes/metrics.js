const express = require('express');
const router = express.Router();

const metricsController = require('../controllers/metricsController');
const authenticate = require('../middleware/authenticate');


// get the metrics
router.get('/', authenticate,metricsController.getMetrics);



module.exports = router;
