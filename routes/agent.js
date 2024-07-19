// routes/agent.js
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const authenticate = require('../middleware/authenticate');

// GET all agents
router.get('/', authenticate, agentController.getAllAgents);

// GET agent by id
router.get('/:id', authenticate, agentController.getAgentById);

// CREATE new agent
router.post('/', authenticate, agentController.createAgent);

// UPDATE agent
router.put('/:id', authenticate, agentController.updateAgent);


router.delete('/deleteAll',authenticate, agentController.deleteAllAgentsAndResetMetrics); // Endpoint baru untuk menghapus semua agen dan mengatur ulang metrik

// POST route for agent login
router.post('/login', agentController.loginAgent);

// DELETE agent
router.delete('/:id', authenticate, agentController.deleteAgent);


module.exports = router;
