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

    // If agent_id missing, skip discount validation
    if (!agent_id) {
      console.log(`⚠️ Missing agent_id for discount '${discount_code}', skipping`);
      req.body.discount_code = null;
      return next();
    }

    // Fetch discount by code
    const discount = await Discount.findOne({
      where: { code: discount_code },
    });

    // Check if discount exists
    if (!discount) {
      console.log(`⚠️ Discount code '${discount_code}' not found, skipping`);
      req.body.discount_code = null;
      return next();
    }

    // Check if discount has agent_ids restriction
    if (Array.isArray(discount.agent_ids) && discount.agent_ids.length > 0) {
      const agentIdInt = parseInt(agent_id);

      // Validate agent is authorized to use this discount
      if (!discount.agent_ids.includes(agentIdInt)) {
        console.log(
          `⚠️ Agent ${agent_id} is not authorized to use discount '${discount_code}', skipping`
        );
        req.body.discount_code = null;
        return next();
      }

      console.log(
        `✅ Agent ${agent_id} is authorized to use discount '${discount_code}'`
      );
    } else {
      console.log(`✅ Discount '${discount_code}' has no agent restrictions`);
    }

    // Check if discount has schedule_ids restriction
    if (Array.isArray(discount.schedule_ids) && discount.schedule_ids.length > 0) {
      const scheduleId = parseInt(req.body.schedule_id?.value || req.body.schedule_id, 10);
      if (!scheduleId || Number.isNaN(scheduleId)) {
        console.log(
          `⚠️ Missing schedule_id for schedule-restricted discount '${discount_code}', skipping`
        );
        req.body.discount_code = null;
        return next();
      }

      const allowedScheduleIds = discount.schedule_ids.map((id) => parseInt(id, 10));
      if (!allowedScheduleIds.includes(scheduleId)) {
        console.log(
          `⚠️ Discount '${discount_code}' is not valid for schedule_id ${scheduleId}, skipping`
        );
        req.body.discount_code = null;
        return next();
      }

      console.log(`✅ Discount '${discount_code}' valid for schedule_id ${scheduleId}`);
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
        `⚠️ Discount '${discount_code}' is not valid today (${today.toDateString()}), skipping`
      );
      req.body.discount_code = null;
      return next();
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
      let departureValid = true;
      let departureDiscount = null;
      console.log(
        `🔍 Validating departure discount: ${departure.discount_code} for agent: ${departure.agent_id}`
      );

      if (!departure.agent_id) {
        console.log(
          `⚠️ Missing departure.agent_id for discount '${departure.discount_code}', skipping`
        );
        departureValid = false;
      }

      if (departureValid) {
        departureDiscount = await Discount.findOne({
          where: { code: departure.discount_code },
        });

        if (!departureDiscount) {
          console.log(
            `⚠️ Departure discount code '${departure.discount_code}' not found, skipping`
          );
          departureValid = false;
        }
      }

      // Check agent authorization for departure discount
      if (
        departureValid &&
        Array.isArray(departureDiscount.agent_ids) &&
        departureDiscount.agent_ids.length > 0
      ) {
        const agentIdInt = parseInt(departure.agent_id);
        if (!departureDiscount.agent_ids.includes(agentIdInt)) {
          console.log(
            `⚠️ Agent ${departure.agent_id} not authorized for departure discount '${departure.discount_code}', skipping`
          );
          departureValid = false;
        }
      }

      // Check schedule restriction for departure discount
      if (
        departureValid &&
        Array.isArray(departureDiscount.schedule_ids) &&
        departureDiscount.schedule_ids.length > 0
      ) {
        const departureScheduleId = parseInt(
          departure.schedule_id?.value || departure.schedule_id,
          10
        );
        if (!departureScheduleId || Number.isNaN(departureScheduleId)) {
          console.log(
            `⚠️ Missing departure.schedule_id for discount '${departure.discount_code}', skipping`
          );
          departureValid = false;
        }
        const allowedScheduleIds = departureDiscount.schedule_ids.map((id) =>
          parseInt(id, 10)
        );
        if (departureValid && !allowedScheduleIds.includes(departureScheduleId)) {
          console.log(
            `⚠️ Departure discount '${departure.discount_code}' not valid for schedule_id ${departureScheduleId}, skipping`
          );
          departureValid = false;
        }
      }

      // Check date validity for departure discount
      if (departureValid) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(departureDiscount.start_date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(departureDiscount.end_date);
        endDate.setHours(23, 59, 59, 999);

        if (today < startDate || today > endDate) {
          console.log(
            `⚠️ Departure discount '${departure.discount_code}' is not valid today, skipping`
          );
          departureValid = false;
        }
      }

      if (departureValid) {
        console.log(`✅ Departure discount validated: ${departure.discount_code}`);
        req.departureDiscount = departureDiscount;
      } else {
        departure.discount_code = null;
      }
    }

    // Validate return discount if provided
    if (returnData?.discount_code) {
      let returnValid = true;
      let returnDiscount = null;
      console.log(
        `🔍 Validating return discount: ${returnData.discount_code} for agent: ${returnData.agent_id}`
      );

      if (!returnData.agent_id) {
        console.log(
          `⚠️ Missing return.agent_id for discount '${returnData.discount_code}', skipping`
        );
        returnValid = false;
      }

      if (returnValid) {
        returnDiscount = await Discount.findOne({
          where: { code: returnData.discount_code },
        });

        if (!returnDiscount) {
          console.log(
            `⚠️ Return discount code '${returnData.discount_code}' not found, skipping`
          );
          returnValid = false;
        }
      }

      // Check agent authorization for return discount
      if (
        returnValid &&
        Array.isArray(returnDiscount.agent_ids) &&
        returnDiscount.agent_ids.length > 0
      ) {
        const agentIdInt = parseInt(returnData.agent_id);
        if (!returnDiscount.agent_ids.includes(agentIdInt)) {
          console.log(
            `⚠️ Agent ${returnData.agent_id} not authorized for return discount '${returnData.discount_code}', skipping`
          );
          returnValid = false;
        }
      }

      // Check schedule restriction for return discount
      if (
        returnValid &&
        Array.isArray(returnDiscount.schedule_ids) &&
        returnDiscount.schedule_ids.length > 0
      ) {
        const returnScheduleId = parseInt(
          returnData.schedule_id?.value || returnData.schedule_id,
          10
        );
        if (!returnScheduleId || Number.isNaN(returnScheduleId)) {
          console.log(
            `⚠️ Missing return.schedule_id for discount '${returnData.discount_code}', skipping`
          );
          returnValid = false;
        }
        const allowedScheduleIds = returnDiscount.schedule_ids.map((id) =>
          parseInt(id, 10)
        );
        if (returnValid && !allowedScheduleIds.includes(returnScheduleId)) {
          console.log(
            `⚠️ Return discount '${returnData.discount_code}' not valid for schedule_id ${returnScheduleId}, skipping`
          );
          returnValid = false;
        }
      }

      // Check date validity for return discount
      if (returnValid) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(returnDiscount.start_date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(returnDiscount.end_date);
        endDate.setHours(23, 59, 59, 999);

        if (today < startDate || today > endDate) {
          console.log(
            `⚠️ Return discount '${returnData.discount_code}' is not valid today, skipping`
          );
          returnValid = false;
        }
      }

      if (returnValid) {
        console.log(`✅ Return discount validated: ${returnData.discount_code}`);
        req.returnDiscount = returnDiscount;
      } else {
        returnData.discount_code = null;
      }
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
