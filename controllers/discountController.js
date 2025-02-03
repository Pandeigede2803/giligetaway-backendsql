const Discount = require('../models/discount');
const { fn, col } = require("sequelize");
const { Op } = require("sequelize");

// Create a new discount
exports.createDiscount = async (req, res) => {
    try {
        const discount = await Discount.create(req.body);
        res.status(201).json({ success: true, data: discount });
    } catch (error) {
        console.error('Error creating discount:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all discounts
exports.getAllDiscounts = async (req, res) => {
    try {
        const discounts = await Discount.findAll();
        res.status(200).json({ success: true, data: discounts });
    } catch (error) {
        console.error('Error fetching discounts:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get a discount by ID
exports.getDiscountById = async (req, res) => {
    try {
        const discount = await Discount.findByPk(req.params.id);
        if (!discount) {
            return res.status(404).json({ success: false, message: 'Discount not found' });
        }
        res.status(200).json({ success: true, data: discount });
    } catch (error) {
        console.error('Error fetching discount:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update a discount
exports.updateDiscount = async (req, res) => {
    try {
        const discount = await Discount.findByPk(req.params.id);
        if (!discount) {
            return res.status(404).json({ success: false, message: 'Discount not found' });
        }
        await discount.update(req.body);
        res.status(200).json({ success: true, data: discount });
    } catch (error) {
        console.error('Error updating discount:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// get discount by code
exports.getDiscountByCode = async (req, res) => {
    console.log('Request params:', req.params);
    try {
        // Strict equality for case-sensitive match
        const discount = await Discount.findOne({
            where: { code: { [Op.eq]: req.params.code } }, // Ensures exact and strict match
        });

        if (!discount) {
            console.log('Discount not found');
            return res.status(404).json({ success: false, message: 'Discount not found' });
        }

        res.status(200).json({ success: true, data: discount });
    } catch (error) {
        console.error('Error fetching discount:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
        
    }

// Delete a discount
exports.deleteDiscount = async (req, res) => {
    try {
        const discount = await Discount.findByPk(req.params.id);
        if (!discount) {
            return res.status(404).json({ success: false, message: 'Discount not found' });
        }
        await discount.destroy();
        res.status(200).json({ success: true, message: 'Discount deleted' });
    } catch (error) {
        console.error('Error deleting discount:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};