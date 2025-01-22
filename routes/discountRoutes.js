const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');

// Create a new discount
router.post('/discounts', discountController.createDiscount);

// Get all discounts
router.get('/discounts', discountController.getAllDiscounts);

// Get a discount by ID
router.get('/discounts/:id', discountController.getDiscountById);

// Update a discount
router.put('/discounts/:id', discountController.updateDiscount);

// Delete a discount
router.delete('/discounts/:id', discountController.deleteDiscount);

module.exports = router;