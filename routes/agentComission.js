// routes/agent.js
const express = require('express');
const router = express.Router();
const agentCommissionsController = require('../controllers/agentComission');
const authenticate = require('../middleware/authenticate');
const checkAgentExist = require('../middleware/checkAgentExist');


// Route to get agent commissions based on month, year, and agent_id
router.get('/comissions', authenticate, agentCommissionsController.getCommissions);
router.get('/comissions-pagination', authenticate, agentCommissionsController.getCommissionsPagination);
router.get('/comissions', authenticate, agentCommissionsController.getAgentSalesReport);
router.get('/comissions-salesreport', authenticate, checkAgentExist,agentCommissionsController.getAgentSalesReport);

// router.get('/comissions-salesreport', authenticate, checkAgentExist,agentCommissionsController.getAgentSalesReport);
router.get('/comissions-all-agent', authenticate,agentCommissionsController.getMonthlyAgentSummary);

// Route: Update AgentCommission by ID
router.put(
    "/comissions/:id",
    authenticate,
    agentCommissionsController.updateCommission
  );

// add agent comission
router.post(
    "/comissions",
    authenticate,
    agentCommissionsController.createAgentComission
  );

  router.post(
    "/comissions/",
    authenticate,
    agentCommissionsController.createAgentComission
  );

router.delete(
  '/comissions',
  authenticate,
  agentCommissionsController.deleteAgentCommission
);


module.exports = router;;





