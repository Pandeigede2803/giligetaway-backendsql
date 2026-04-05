const Discount = require("../models/discount");
const SubSchedule = require("../models/SubSchedule");
const { fn, col } = require("sequelize");
const { Op } = require("sequelize");

const STATIC_SUBSCHEDULE_EXCEPTION_IDS = new Set(
  String(process.env.DISCOUNT_STATIC_SUBSCHEDULE_EXCEPTION_IDS || "")
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id))
);

const getDiscountExceptionSet = (discount) => {
  if (Array.isArray(discount?.sub_id_exception)) {
    return new Set(
      discount.sub_id_exception
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id))
    );
  }
  return STATIC_SUBSCHEDULE_EXCEPTION_IDS;
};

// Create a new discount
exports.createDiscount = async (req, res) => {
  try {
    console.log("Discount created:", req.body);
    const discount = await Discount.create(req.body);

    res.status(201).json({ success: true, data: discount });
  } catch (error) {
    console.error("Error creating discount:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};



// Get all discounts
exports.getAllDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.findAll();
    res.status(200).json({ success: true, data: discounts });
  } catch (error) {
    console.error("Error fetching discounts:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get a discount by ID
exports.getDiscountById = async (req, res) => {
  try {
    const discount = await Discount.findByPk(req.params.id);
    if (!discount) {
      return res
        .status(404)
        .json({ success: false, message: "Discount not found" });
    }
    res.status(200).json({ success: true, data: discount });
  } catch (error) {
    console.error("Error fetching discount:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a discount
exports.updateDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByPk(req.params.id);
    if (!discount) {
      return res
        .status(404)
        .json({ success: false, message: "Discount not found" });
    }
    await discount.update(req.body);
    res.status(200).json({ success: true, data: discount });
  } catch (error) {
    console.error("Error updating discount:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// get discount by code
exports.getDiscountByCode = async (req, res) => {
  console.log("Request params:", req.params);
  console.log("Request query:", req.query);
  const {
    type,
    booking_date,
    schedule_id_departure,
    schedule_id_return,
    subschedule_id_departure,
    subschedule_id_return,
    sub_schedule_id_departure,
    sub_schedule_id_return,
  } = req.query;
  try {
    // Strict equality for case-sensitive match
    console.log("Finding discount by code:", req.params.code);
    const discount = await Discount.findOne({
      where: { code: { [Op.eq]: req.params.code } }, // Ensures exact and strict match
    });

    if (!discount) {
      console.log("Discount not found");
      return res
        .status(404)
        .json({ success: false, message: "Discount not found" });
    }

    const parseId = (value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const parsedDepartureScheduleId = parseId(schedule_id_departure);
    const parsedReturnScheduleId = parseId(schedule_id_return);
    const parsedDepartureSubScheduleId = parseId(
      sub_schedule_id_departure ?? subschedule_id_departure
    );
    const parsedReturnSubScheduleId = parseId(
      sub_schedule_id_return ?? subschedule_id_return
    );

    const departureSubSchedule = parsedDepartureSubScheduleId
      ? await SubSchedule.findByPk(parsedDepartureSubScheduleId)
      : null;
    const returnSubSchedule = parsedReturnSubScheduleId
      ? await SubSchedule.findByPk(parsedReturnSubScheduleId)
      : null;

    const effectiveDepartureScheduleId =
      departureSubSchedule?.schedule_id || parsedDepartureScheduleId || null;
    const effectiveReturnScheduleId =
      returnSubSchedule?.schedule_id || parsedReturnScheduleId || null;
    const discountExceptionSet = getDiscountExceptionSet(discount);
    const isDepartureSubscheduleException =
      parsedDepartureSubScheduleId !== null &&
      discountExceptionSet.has(parsedDepartureSubScheduleId);
    const isReturnSubscheduleException =
      parsedReturnSubScheduleId !== null &&
      discountExceptionSet.has(parsedReturnSubScheduleId);

    const result = {
      discount,
      schedule_ids: discount.schedule_ids || [],
      valid_schedule_departure: true,
      valid_schedule_return: false,
      effective_schedule_id_departure: effectiveDepartureScheduleId,
      effective_schedule_id_return: effectiveReturnScheduleId,
      subschedule_departure_exception: isDepartureSubscheduleException,
      subschedule_return_exception: isReturnSubscheduleException,
    };

    console.log("Discount has schedule_ids:", result.schedule_ids);

    if (Array.isArray(discount.schedule_ids)) {
      if (effectiveDepartureScheduleId) {
        result.valid_schedule_departure =
          !isDepartureSubscheduleException &&
          discount.schedule_ids.includes(effectiveDepartureScheduleId);
        console.log(
          `Schedule ID departure ${effectiveDepartureScheduleId} is ${
            result.valid_schedule_departure ? "" : "not "
          }in the list of valid schedule IDs.`
        );
      }
      if (effectiveReturnScheduleId) {
        result.valid_schedule_return =
          !isReturnSubscheduleException &&
          discount.schedule_ids.includes(effectiveReturnScheduleId);
        console.log(
          `Schedule ID return ${effectiveReturnScheduleId} is ${
            result.valid_schedule_return ? "" : "not "
          }in the list of valid schedule IDs.`
        );
      }
    }

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching discount:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a discount
exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByPk(req.params.id);
    if (!discount) {
      return res
        .status(404)
        .json({ success: false, message: "Discount not found" });
    }
    await discount.destroy();
    res.status(200).json({ success: true, message: "Discount deleted" });
  } catch (error) {
    console.error("Error deleting discount:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
