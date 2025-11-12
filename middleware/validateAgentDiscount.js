const Discount = require("../models/discount");

/**
 * Middleware to validate discount code for agent bookings
 * Checks if the discount code exists and if the agent is authorized to use it
 */
const validateAgentDiscount = async (req, res, next) => {
  try {
    // Extract discount_code and agent_id from request body
    const { discount_code, agent_id } = req.body;

    // If no discount_code provided, skip validation (discount is optional)
    if (!discount_code) {
      return next();
    }

    console.log(`🔍 Validating discount code: ${discount_code} for agent: ${agent_id}`);

    // Validate that agent_id is provided when discount_code is used
    if (!agent_id) {
      return res.status(400).json({
        success: false,
        message: "agent_id is required when using a discount code",
      });
    }

    // Fetch discount by code
    const discount = await Discount.findOne({
      where: { code: discount_code },
    });

    // Check if discount exists
    if (!discount) {
      console.log(`❌ Discount code '${discount_code}' not found`);
      return res.status(404).json({
        success: false,
        message: `Discount code '${discount_code}' not found`,
      });
    }

    // Check if discount has agent_ids restriction
    if (Array.isArray(discount.agent_ids) && discount.agent_ids.length > 0) {
      const agentIdInt = parseInt(agent_id);

      // Validate agent is authorized to use this discount
      if (!discount.agent_ids.includes(agentIdInt)) {
        console.log(
          `❌ Agent ${agent_id} is not authorized to use discount '${discount_code}'`
        );
        return res.status(403).json({
          success: false,
          message: `You are not authorized to use discount code '${discount_code}'`,
        });
      }

      console.log(
        `✅ Agent ${agent_id} is authorized to use discount '${discount_code}'`
      );
    } else {
      console.log(`✅ Discount '${discount_code}' has no agent restrictions`);
    }

    // Check if discount is within valid date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(discount.start_date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(discount.end_date);
    endDate.setHours(23, 59, 59, 999);

    if (today < startDate || today > endDate) {
      console.log(
        `❌ Discount '${discount_code}' is not valid today (${today.toDateString()})`
      );
      return res.status(400).json({
        success: false,
        message: `Discount code '${discount_code}' is not valid. Valid from ${discount.start_date} to ${discount.end_date}`,
      });
    }

    console.log(`✅ Discount '${discount_code}' is within valid date range`);

    // Attach discount to request object for use in controller
    req.discount = discount;

    next();
  } catch (error) {
    console.error("❌ Error validating discount:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while validating discount",
      error: error.message,
    });
  }
};

/**
 * Middleware to validate discount codes for round-trip bookings
 * Validates both departure and return discount codes with agent authorization
 */
const validateAgentRoundTripDiscount = async (req, res, next) => {
  try {
    const { departure, return: returnData } = req.body;

    // Validate departure discount if provided
    if (departure?.discount_code) {
      console.log(
        `🔍 Validating departure discount: ${departure.discount_code} for agent: ${departure.agent_id}`
      );

      if (!departure.agent_id) {
        return res.status(400).json({
          success: false,
          message: "departure.agent_id is required when using a discount code",
        });
      }

      const departureDiscount = await Discount.findOne({
        where: { code: departure.discount_code },
      });

      if (!departureDiscount) {
        return res.status(404).json({
          success: false,
          message: `Departure discount code '${departure.discount_code}' not found`,
        });
      }

      // Check agent authorization for departure discount
      if (
        Array.isArray(departureDiscount.agent_ids) &&
        departureDiscount.agent_ids.length > 0
      ) {
        const agentIdInt = parseInt(departure.agent_id);
        if (!departureDiscount.agent_ids.includes(agentIdInt)) {
          return res.status(403).json({
            success: false,
            message: `You are not authorized to use departure discount code '${departure.discount_code}'`,
          });
        }
      }

      // Check date validity for departure discount
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startDate = new Date(departureDiscount.start_date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(departureDiscount.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (today < startDate || today > endDate) {
        return res.status(400).json({
          success: false,
          message: `Departure discount code '${departure.discount_code}' is not valid. Valid from ${departureDiscount.start_date} to ${departureDiscount.end_date}`,
        });
      }

      console.log(`✅ Departure discount validated: ${departure.discount_code}`);
      req.departureDiscount = departureDiscount;
    }

    // Validate return discount if provided
    if (returnData?.discount_code) {
      console.log(
        `🔍 Validating return discount: ${returnData.discount_code} for agent: ${returnData.agent_id}`
      );

      if (!returnData.agent_id) {
        return res.status(400).json({
          success: false,
          message: "return.agent_id is required when using a discount code",
        });
      }

      const returnDiscount = await Discount.findOne({
        where: { code: returnData.discount_code },
      });

      if (!returnDiscount) {
        return res.status(404).json({
          success: false,
          message: `Return discount code '${returnData.discount_code}' not found`,
        });
      }

      // Check agent authorization for return discount
      if (
        Array.isArray(returnDiscount.agent_ids) &&
        returnDiscount.agent_ids.length > 0
      ) {
        const agentIdInt = parseInt(returnData.agent_id);
        if (!returnDiscount.agent_ids.includes(agentIdInt)) {
          return res.status(403).json({
            success: false,
            message: `You are not authorized to use return discount code '${returnData.discount_code}'`,
          });
        }
      }

      // Check date validity for return discount
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startDate = new Date(returnDiscount.start_date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(returnDiscount.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (today < startDate || today > endDate) {
        return res.status(400).json({
          success: false,
          message: `Return discount code '${returnData.discount_code}' is not valid. Valid from ${returnDiscount.start_date} to ${returnDiscount.end_date}`,
        });
      }

      console.log(`✅ Return discount validated: ${returnData.discount_code}`);
      req.returnDiscount = returnDiscount;
    }

    next();
  } catch (error) {
    console.error("❌ Error validating round-trip discounts:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while validating discounts",
      error: error.message,
    });
  }
};

module.exports = {
  validateAgentDiscount,
  validateAgentRoundTripDiscount,
};
