const Discount = require("../models/discount");

const stripTime = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseYmdDate = (dateInput) => {
  if (typeof dateInput !== "string") {
    return null;
  }

  const match = dateInput.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, month - 1, day);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveSearchDate = (dateInput) => {
  if (!dateInput) {
    return stripTime(new Date());
  }
  const parsedYmd = parseYmdDate(dateInput);
  if (parsedYmd) {
    return stripTime(parsedYmd);
  }
  return stripTime(dateInput) || stripTime(new Date());
};

const validateAgentSearchDiscount = async (req, res, next) => {
  const { discount_code, agent_id, date } = req.query;
  console.log(`🔍 Validating discount code '${discount_code}' for agent ${agent_id} on date '${date}'`);

  if (!discount_code || !agent_id) {
    return next();
  }

  try {
    const discount = await Discount.findOne({
      where: { code: discount_code },
    });

    if (!discount) {
      console.log(`⚠️ Discount code '${discount_code}' not found`);
      return next();
    }

    let isAuthorized = true;
    if (Array.isArray(discount.agent_ids) && discount.agent_ids.length > 0) {
      const agentIdInt = parseInt(agent_id, 10);
      isAuthorized = discount.agent_ids.includes(agentIdInt);
    }

    const searchDate = resolveSearchDate(date);
    const startDate = stripTime(discount.start_date);
    const endDate = new Date(discount.end_date);
    endDate.setHours(23, 59, 59, 999);
    const isValidDate = searchDate >= startDate && searchDate <= endDate;

    console.log(`📅 Discount date validation for '${discount_code}':`);
    console.log(`   Search Date: ${searchDate ? searchDate.toISOString().split('T')[0] : 'N/A'}`);
    console.log(`   Discount Start: ${startDate ? startDate.toISOString().split('T')[0] : 'N/A'}`);
    console.log(`   Discount End: ${endDate.toISOString().split('T')[0]}`);
    console.log(`   Is Valid Date: ${isValidDate}`);

    if (isAuthorized && isValidDate) {
      req.discount = discount;
      console.log(`✅ Discount '${discount_code}' validated for agent ${agent_id}`);
    } else {
      console.log(
        `⚠️ Discount '${discount_code}' not valid: authorized=${isAuthorized}, validDate=${isValidDate}`
      );
    }

    return next();
  } catch (error) {
    console.error("❌ Error validating search discount:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while validating discount",
      error: error.message,
    });
  }
};

module.exports = validateAgentSearchDiscount;
