const express = require('express');
const router = express.Router();
const boatController = require('../controllers/boatController');
const authenticate = require('../middleware/authenticate');

// CREATE boat
router.post('/', authenticate, boatController.createBoat);

// READ boats
router.get('/', authenticate, boatController.getBoats);

// READ boat by id
router.get('/:id', authenticate, boatController.getBoatById);

// UPDATE boat
router.put('/:id', authenticate, boatController.updateBoat);

// DELETE boat
router.delete('/:id', authenticate, boatController.deleteBoat);

module.exports = router;
