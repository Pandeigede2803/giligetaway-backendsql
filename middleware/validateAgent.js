const {
  sequelize,
  Booking,

  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  //   AgentCommission,
  Agent,
  BookingSeatAvailability,
  Boat,
} = require("../models");
const { Op } = require("sequelize");

// middlewares/validateAgent.js

/**
 * Middleware to validate agent data before controller processes it
 */
const validateAgent = async (req, res, next) => {
  console.log("Starting agent validation...");
  const { name, email, phone, address, commission_rate } = req.body;
  const errors = [];

  // Validate name (required)
  console.log("Validating name...");
  if (!name || name.trim() === '') {
    errors.push('Name is required');
  }

  // Validate email (required and format)
  console.log("Validating email...");
  if (!email || email.trim() === '') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please enter a valid email address');
  } else {
    // Check if email already exists in the database
    console.log("Checking for duplicate email...");
    try {
      const existingAgent = await Agent.findOne({ where: { email } });
      if (existingAgent) {
        errors.push('Email address is already in use');
      }
    } catch (error) {
      console.error('Error checking for duplicate email:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while validating email',
      });
    }
  }

  // Validate phone (required)
  console.log("Validating phone...");
  if (!phone || phone.trim() === '') {
    errors.push('Phone number is required');
  }

  // Validate address (required)
  console.log("Validating address...");
  if (!address || address.trim() === '') {
    errors.push('Address is required');
  }

  // Validate commission rate (required and must be a number)
  console.log("Validating commission rate...");
  if (commission_rate === undefined || commission_rate === null || commission_rate.toString().trim() === '') {
    errors.push('Commission rate is required');
  } else {
    const numValue = parseFloat(commission_rate);
    if (isNaN(numValue) || numValue < 0) {
      errors.push('Commission rate must be a valid positive number');
    }
  }

  // Check additional commission fields if they exist
  console.log("Validating additional commission fields...");
  const commissionFields = [
    { field: 'commission_long', label: 'Long commission' },
    { field: 'commission_short', label: 'Short commission' },
    { field: 'commission_mid', label: 'Mid commission' },
    { field: 'commission_intermediate', label: 'Intermediate commission' },
    { field: 'commission_transport', label: 'Transport commission' }
  ];

  commissionFields.forEach(({ field, label }) => {
    const value = req.body[field];
    
    if (value !== undefined && value !== null) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        errors.push(`${label} must be a valid positive number`);
      }
    }
  });

  // If there are validation errors, return a 400 response with the errors
  if (errors.length > 0) {
    console.log("Validation errors found:", errors);
    return res.status(400).json({ 
      status: 'error',
      message: 'Validation failed',
      errors: errors 
    });
  }

  console.log("Agent validation passed.");
  // If validation passes, continue to the next middleware or controller
  next();
};

module.exports = validateAgent;