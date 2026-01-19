const getNetPrice = ({ agent, tripType, price, discount = null }) => {
  if (!agent) {
    return { net_price: "N/A", discount_activated: false };
  }

  const priceValue = parseFloat(price);
  if (!Number.isFinite(priceValue)) {
    return { net_price: "N/A", discount_activated: false };
  }

  const commissionRate = parseFloat(agent.commission_rate) || 0;
  let commissionPerPassenger = 0;

  if (commissionRate > 0) {
    commissionPerPassenger = priceValue * (commissionRate / 100);
  } else {
    switch (tripType) {
      case "long":
        commissionPerPassenger = parseFloat(agent.commission_long) || 0;
        break;
      case "short":
        commissionPerPassenger = parseFloat(agent.commission_short) || 0;
        break;
      case "mid":
        commissionPerPassenger = parseFloat(agent.commission_mid) || 0;
        break;
      case "intermediate":
        commissionPerPassenger =
          parseFloat(agent.commission_intermediate) || 0;
        break;
      default:
        return { net_price: "N/A", discount_activated: false };
    }
  }

  if (!Number.isFinite(commissionPerPassenger) || commissionPerPassenger < 0) {
    return { net_price: "N/A", discount_activated: false };
  }

  // Calculate price after commission
  let netPrice = priceValue - commissionPerPassenger;
  let discountActivated = false;

  // Apply discount if provided and valid
  if (discount) {
    const discountValue =
      parseFloat(discount.discount_value ?? discount.value) || 0;
    const discountType = discount.discount_type ?? discount.type; // "percentage" or "fixed"

    if (discountValue > 0) {
      if (discountType === "percentage") {
        netPrice = netPrice - (netPrice * (discountValue / 100));
      } else {
        // fixed amount
        netPrice = netPrice - discountValue;
      }
      discountActivated = true;
    }
  }

  // Ensure net price is not negative
  if (netPrice < 0) {
    netPrice = 0;
  }

  return {
    net_price: Number.isFinite(netPrice) ? netPrice : "N/A",
    discount_activated: discountActivated,
  };
};

module.exports = {
  getNetPrice,
};
