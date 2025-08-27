// routes/waitingListRoutes.js
const express = require('express');
const router = express.Router();
const waitingListController = require('../controllers/waitingListController');
// const triggerManual = require('../util/waitingListNotify');

// Create a new waiting list entry
router.post('/', waitingListController.createv2);
// router.post('/', waitingListController.create);
// Get all waiting list entries
router.get('/', waitingListController.findAll);

// Get waiting list entries with upcoming follow-ups
router.get('/upcoming-followups', waitingListController.getUpcomingFollowUps);

// // Manual trigger untuk waiting list notification
// router.post('/trigger-manual', triggerManual);

// Get a single waiting list entry
router.get('/:id', waitingListController.findOne);

// Update a waiting list entry
router.put('/:id', waitingListController.update);

// Update status and add follow-up
router.patch('/:id/status', waitingListController.updateStatus);

// Delete a waiting list entry
router.delete('/:id', waitingListController.delete);

module.exports = router;