const { Agent } = require('../models'); // Adjust based on where your models are located

const checkEmailUnique = async (req, res, next) => {
  try {
    // Check if the email exists in the database
    const existingAgent = await Agent.findOne({ where: { email: req.body.email } });

    if (existingAgent) {
      // If the email exists, return a 400 error
      return res.status(400).json({ message: '❌ The email is already in use by another agent.' });
    }

    // If email is unique, proceed to the next middleware/handler
    next();
  } catch (error) {
    console.error("❌ Error checking email uniqueness:", error.message);
    return res.status(500).json({ message: '❌ An error occurred while checking the email.' });
  }
};

module.exports = checkEmailUnique;
