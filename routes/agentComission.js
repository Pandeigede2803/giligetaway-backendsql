// routes/agent.js
const express = require('express');
const router = express.Router();
const agentCommissionsController = require('../controllers/agentComission');
const authenticate = require('../middleware/authenticate');
const checkAgentExist = require('../middleware/checkAgentExist');


// Route to get agent commissions based on month, year, and agent_id
router.get('/comissions', authenticate, agentCommissionsController.getCommissions);
router.get('/comissions', authenticate, agentCommissionsController.getAgentSalesReport);
router.get('/comissions-salesreport', authenticate, checkAgentExist,agentCommissionsController.getAgentSalesReport);



module.exports = router;    





