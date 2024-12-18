// routes/agent.js
const express = require('express');
const router = express.Router();
const agentCommissionsController = require('../controllers/agentComission');
const authenticate = require('../middleware/authenticate');


// Route to get agent commissions based on month, year, and agent_id
router.get('/comissions', authenticate, agentCommissionsController.getCommissions);
router.get('/comissions-invoicedd', authenticate, agentCommissionsController.getCommissionsInvoiced);



module.exports = router;    





