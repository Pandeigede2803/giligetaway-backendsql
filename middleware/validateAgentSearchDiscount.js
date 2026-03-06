const Discount = require("../models/discount");
const { Op } = require("sequelize");

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

const parseIntSafe = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const isAllowedByAgent = (discount, agentId) => {
  if (!Array.isArray(discount.agent_ids) || discount.agent_ids.length === 0) {
    return true;
  }
  const agentIds = discount.agent_ids
    .map((id) => parseIntSafe(id))
    .filter((id) => id !== null);
  return agentIds.includes(agentId);
};

const isWithinDateRange = (discount, targetDate) => {
  const startDate = stripTime(discount.start_date);
  const endDate = new Date(discount.end_date);
  if (!startDate || Number.isNaN(endDate.getTime())) {
    return false;
  }
  endDate.setHours(23, 59, 59, 999);
  return targetDate >= startDate && targetDate <= endDate;
};

const findAutoDiscountForSearch = async ({ agentId, searchDate }) => {
  const dateYmd = searchDate.toISOString().split("T")[0];
  const candidates = await Discount.findAll({
    where: {
      start_date: { [Op.lte]: dateYmd },
      end_date: { [Op.gte]: dateYmd },
      applicable_types: { [Op.in]: ["one_way", "round_trip", "all"] },
      applicable_direction: { [Op.in]: ["departure", "all"] },
    },
    order: [["id", "DESC"]],
  });

  for (const discount of candidates) {
    if (!Array.isArray(discount.agent_ids) || discount.agent_ids.length === 0) {
      continue;
    }
    if (!isAllowedByAgent(discount, agentId)) {
      continue;
    }
    if (!isWithinDateRange(discount, searchDate)) {
      continue;
    }
    return discount;
  }

  return null;
};

const validateAgentSearchDiscount = async (req, res, next) => {
  let { discount_code } = req.query;
  const { agent_id, date } = req.query;
  console.log(`🔍 Validating discount code '${discount_code}' for agent ${agent_id} on date '${date}'`);

  if (!agent_id) {
    return next();
  }

  try {
    const searchDate = resolveSearchDate(date);
    const parsedAgentId = parseIntSafe(agent_id);
    if (!parsedAgentId) {
      return next();
    }

    let discount = null;

    if (!discount_code) {
      discount = await findAutoDiscountForSearch({
        agentId: parsedAgentId,
        searchDate,
      });

      if (!discount) {
        return next();
      }

      discount_code = discount.code;
      req.query.discount_code = discount.code;
      console.log(
        `Auto discount assigned for search: agent_id=${parsedAgentId} code=${discount.code}`
      );
    } else {
      discount = await Discount.findOne({
        where: { code: discount_code },
      });
    }

    if (!discount) {
      console.log(`⚠️ Discount code '${discount_code}' not found`);
      return next();
    }

    let isAuthorized = true;
    if (Array.isArray(discount.agent_ids) && discount.agent_ids.length > 0) {
      isAuthorized = isAllowedByAgent(discount, parsedAgentId);
    }

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
