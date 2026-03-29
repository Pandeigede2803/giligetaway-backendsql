module.exports = (req, res, next) => {
  const {
    contact_name,
    contact_phone,
    contact_email,
    schedule_id,
    booking_date,
    total_passengers,
  } = req.body || {};;

  const normalizedContactName =
    typeof contact_name === "string" ? contact_name.trim() : "";
  const normalizedContactPhone =
    typeof contact_phone === "string" ? contact_phone.trim() : "";
  const normalizedContactEmail =
    typeof contact_email === "string"
      ? contact_email.trim().toLowerCase()
      : "";

  if (
    !normalizedContactName ||
    !normalizedContactPhone ||
    !normalizedContactEmail ||
    !schedule_id ||
    !booking_date ||
    !total_passengers
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: contact_name, contact_phone, contact_email, schedule_id, booking_date, total_passengers",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedContactEmail)) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact_email format",
    });
  }

  const phoneRegex = /^[+]?[\d\s-]{8,}$/;
  if (!phoneRegex.test(normalizedContactPhone)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid contact_phone format. Use at least 8 digits (can include +, space, -).",
    });
  }

  req.body.contact_name = normalizedContactName;
  req.body.contact_phone = normalizedContactPhone;
  req.body.contact_email = normalizedContactEmail;

  return next();
};
