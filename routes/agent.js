// routes/agent.js
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const authenticate = require('../middleware/authenticate');

// GET all agents
router.get('/', authenticate, agentController.getAllAgents);

// GET agent by id
router.get('/:id', agentController.getAgentById);

// CREATE new agent
router.post('/', authenticate, agentController.createAgent);

// UPDATE agent
router.put('/:id', agentController.updateAgent);


router.delete('/deleteAll',authenticate, agentController.deleteAllAgentsAndResetMetrics); // Endpoint baru untuk menghapus semua agen dan mengatur ulang metrik

// POST route for agent login
router.post('/login', agentController.loginAgent);

// DELETE agent
router.delete('/:id', authenticate, agentController.deleteAgent);

// Route to request a password reset link
router.post('/request-password-reset', agentController.requestPasswordResetLink);

// Route to reset the password using the token
router.post('/reset-password',authenticate, agentController.resetPasswordWithToken);


module.exports = router;
