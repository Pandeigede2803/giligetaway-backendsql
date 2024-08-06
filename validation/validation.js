const { body } = require('express-validator');

const updateSeatAvailabilityValidator = [
    body('id').isInt().withMessage('ID must be an integer'),
    body('schedule_id').isInt().withMessage('Schedule ID must be an integer'),
    body('available_seats').isInt().withMessage('Available seats must be an integer'),
    body('transit_id').optional().isInt().withMessage('Transit ID must be an integer'),
    body('subschedule_id').optional().isInt().withMessage('SubSchedule ID must be an integer'),
    body('availability').isBoolean().withMessage('Availability must be a boolean'),
    body('date').isISO8601().withMessage('Date must be a valid ISO8601 date')
];

module.exports = updateSeatAvailabilityValidator;
