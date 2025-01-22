const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const authenticate = require('../middleware/authenticate');

// Create a new discount
router.post('/discounts',authenticate, discountController.createDiscount);

// Get all discounts
router.get('/discounts',authenticate, discountController.getAllDiscounts);

// Get a discount by ID
router.get('/discounts/:id',authenticate, discountController.getDiscountById);

// Update a discount
router.put('/discounts/:id',authenticate, discountController.updateDiscount);

// Delete a discount
router.delete('/discounts/:id',authenticate, discountController.deleteDiscount);

module.exports = router;