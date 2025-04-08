// routes/agent.js
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const authenticate = require('../middleware/authenticate');
const validateAgent = require('../middleware/validateAgent');
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// const { upload,uploadImageToImageKit } = require('../middleware/upload');

const { createUploadMiddleware, uploadImageToImageKit } = require('../middleware/uploadImage');
const checkEmailUnique = require('../middleware/checkUniqueEmail');



router.put('/:id', createUploadMiddleware('image_url'), uploadImageToImageKit, agentController.updateAgent);

// GET all agents
// router.get('/', authenticate, agentController.getAllAgents);

router.get('/',  agentController.getAllAgents);
// GET agent by id
router.get('/:id', agentController.getAgentById);

// // CREATE new agent
// router.post('/', authenticate,upload, agentController.createAgent);

// CREATE new agent with dynamic field name
const uploadImageUrl = createUploadMiddleware('image_url'); // Assuming 'image_url' is the field name for agent images

router.post('/', authenticate, uploadImageUrl, uploadImageToImageKit, validateAgent,agentController.createAgent);




// UPDATE agent
router.put('/:id',authenticate, agentController.updateAgent);


router.delete('/deleteAll',authenticate, agentController.deleteAllAgentsAndResetMetrics); // Endpoint baru untuk menghapus semua agen dan mengatur ulang metrik

// POST route for agent login
router.post('/login', agentController.loginAgent);

// DELETE agent
router.delete('/:id', authenticate, agentController.deleteAgent);

// Route to request a password reset link
router.post('/request-password-reset', agentController.requestPasswordResetLink);

// Route to reset the password using the token
router.post('/reset-password', agentController.resetPasswordWithToken);




// Route POST → upload CSV
// Format form-data, field name: "agentCsv"
router.post(
  "/upload-csv",
  upload.single("agentCsv"),
  agentController.uploadAgentCsv
);



module.exports = router;
