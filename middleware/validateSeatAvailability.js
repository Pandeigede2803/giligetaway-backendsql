const { body, validationResult } = require('express-validator');

const validateSeatAvailability = [
  body('schedule_id')
    .notEmpty().withMessage('schedule_id is required')
    .isInt().withMessage('schedule_id must be an integer'),

  body('date')
    .notEmpty().withMessage('date is required')
    .isISO8601().withMessage('date must be in YYYY-MM-DD format'),

  body('subschedule_id')
    .optional()
    .isInt().withMessage('subschedule_id must be an integer'),

  body('transit_id')
    .optional()
    .isInt().withMessage('transit_id must be an integer'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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
