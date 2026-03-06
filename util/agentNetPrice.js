const INVALID_RESULT = {
  net_price: "N/A",
  net_price_before_discount: "N/A",
  net_price_after_discount: "N/A",
  discount_amount: 0,
  discount_activated: false,
};

const parseNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCommissionPerPassenger = ({
  agent,
  tripType,
  priceValue,
  includeTransportCommission = false,
}) => {
  const commissionRate = parseNumber(agent.commission_rate) || 0;
  const commissionTransport = parseNumber(agent.commission_transport) || 0;
  let commission = 0;

  if (commissionRate > 0) {
    commission = priceValue * (commissionRate / 100);
  } else {
    switch (tripType) {
      case "long":
        commission = parseNumber(agent.commission_long) || 0;
        break;
      case "short":
        commission = parseNumber(agent.commission_short) || 0;
        break;
      case "mid":
        commission = parseNumber(agent.commission_mid) || 0;
        break;
      case "intermediate":
        commission = parseNumber(agent.commission_intermediate) || 0;
        break;
      default:
        return null;
    }
  }

  if (includeTransportCommission && commissionTransport > 0) {
    commission += commissionTransport;
  }

  return commission;
};

const calculateDiscountFromNet = (netBeforeDiscount, discount) => {
  if (!discount) {
    return { discountAmount: 0, discountActivated: false };
  }

  const discountValue = parseNumber(discount.discount_value ?? discount.value) || 0;
  const discountType = discount.discount_type ?? discount.type;
  const maxDiscount = parseNumber(discount.max_discount) || 0;
  const minPurchase = parseNumber(discount.min_purchase) || 0;

  if (discountValue <= 0 || netBeforeDiscount <= 0) {
    return { discountAmount: 0, discountActivated: false };
  }

  if (minPurchase > 0 && netBeforeDiscount < minPurchase) {
    return { discountAmount: 0, discountActivated: false };
  }

  let discountAmount = 0;
  if (discountType === "percentage") {
    discountAmount = (netBeforeDiscount * discountValue) / 100;
  } else if (discountType === "fixed") {
    discountAmount = discountValue;
  } else {
    return { discountAmount: 0, discountActivated: false };
  }

  if (maxDiscount > 0 && discountAmount > maxDiscount) {
    discountAmount = maxDiscount;
  }

  if (discountAmount > netBeforeDiscount) {
    discountAmount = netBeforeDiscount;
  }

  return {
    discountAmount,
    discountActivated: discountAmount > 0,
  };
};

const getNetPrice = ({
  agent,
  tripType,
  price,
  discount = null,
  includeTransportCommission = false,
}) => {
  if (!agent) {
    return INVALID_RESULT;
  }

  const priceValue = parseNumber(price);
  if (priceValue === null) {
    return INVALID_RESULT;
  }

  const commissionPerPassenger = getCommissionPerPassenger({
    agent,
    tripType,
    priceValue,
    includeTransportCommission,
  });

  if (!Number.isFinite(commissionPerPassenger) || commissionPerPassenger < 0) {
    return INVALID_RESULT;
  }

  const netBeforeDiscount = Math.max(0, priceValue - commissionPerPassenger);
  const { discountAmount, discountActivated } = calculateDiscountFromNet(
    netBeforeDiscount,
    discount
  );
  const netAfterDiscount = Math.max(0, netBeforeDiscount - discountAmount);

  return {
    // Keep `net_price` for backward compatibility.
    net_price: netAfterDiscount,
    net_price_before_discount: netBeforeDiscount,
    net_price_after_discount: netAfterDiscount,
    discount_amount: discountAmount,
    discount_activated: discountActivated,
  };
};

module.exports = {
  getNetPrice,
};
