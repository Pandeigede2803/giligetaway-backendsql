const { body, validationResult } = require('express-validator');
const { SeatAvailability } = require('../models');

const validateSeatAvailability = [
  body('schedule_id')
    .notEmpty().withMessage('schedule_id is required')
    .isInt().withMessage('schedule_id must be an integer'),

  body('date')
    .notEmpty().withMessage('date is required')
    .isISO8601().withMessage('date must be in YYYY-MM-DD format')
    .custom(async (value, { req }) => {
      const { schedule_id, subschedule_id, transit_id } = req.body;
      const existing = await SeatAvailability.findOne({
        where: {
          schedule_id,
          date: value,
          subschedule_id: subschedule_id || null,
          transit_id: transit_id || null,
        },
      });
      if (existing) {
        throw new Error('Seat availability for this date and schedule already exists.');
      }
      return true;
    }),

  body('subschedule_id')
    .optional()
    .isInt().withMessage('subschedule_id must be an integer'),

  body('transit_id')
    .optional()
    .isInt().withMessage('transit_id must be an integer'),

  (req, res, next) => {
    console.log('Request body:', req.body); // Tambahkan console log di sini
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array()); // Tambahkan console log di sini
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

module.exports = validateSeatAvailability;
