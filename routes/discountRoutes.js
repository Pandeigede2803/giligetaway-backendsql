const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const authenticate = require('../middleware/authenticate');
const validateDiscount = require('../middleware/validateDiscountQuery');

// Create a new discount
router.post('/',authenticate, discountController.createDiscount);

// Get all discounts
router.get('/',authenticate, discountController.getAllDiscounts);

// get discount by code
router.get('/:code',authenticate,validateDiscount, discountController.getDiscountByCode);

// Get a discount by ID
router.get('/:id',authenticate, discountController.getDiscountById);

// Update a discount
router.put('/:id',authenticate, discountController.updateDiscount);

// Delete a discount
router.delete('/:id',authenticate, discountController.deleteDiscount);

module.exports = router;