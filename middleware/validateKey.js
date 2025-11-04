const { Agent } = require('../models');

const validateApiKey = async (req, res, next) => {
  const agent_id = req.body.agent_id || req.query.agent_id;
  const api_key = req.body.api_key || req.query.api_key;
  // console.log('Validating API key... agent_id:', agent_id, 'api_key:', api_key);
  // console.log("req.body", JSON.stringify(req.body, null, 2));

  if (!agent_id || !api_key) {
    console.log(
      'Validation failed: agent_id and api_key are required',
    );
    return res.status(400).json({
      success: false,
      message: 'agent_id and api_key are required',
    });
  }

  try {
    const agent = await Agent.findByPk(agent_id, {
      attributes: ['id', 'api_key'],
    });

    if (!agent) {
      console.log(
        `Validation failed: Agent with id ${agent_id} not found`,
      );
      return res.status(404).json({
        success: false,
        message: `Agent with id ${agent_id} not found`,
      });
    }

    if (agent.api_key !== api_key) {
      console.log('Validation failed: Invalid API key');
      return res.status(403).json({
        success: false,
        message: 'Invalid API key',
      });
    }

    console.log('Validation success -> next()');
    next(); // Valid -> lanjut ke controller
  } catch (err) {
    console.error('Error in validateApiKey middleware:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

module.exports = validateApiKey;
