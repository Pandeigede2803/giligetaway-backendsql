const Discount = require("../models/discount");
const { fn, col } = require("sequelize");
const { Op } = require("sequelize");

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
  const { type, booking_date, schedule_id_departure, schedule_id_return } =
    req.query;
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

    const result = {
      discount,
      schedule_ids: discount.schedule_ids || [],
      valid_schedule_departure: true,
      valid_schedule_return: false,
    };

    console.log("Discount has schedule_ids:", result.schedule_ids);

    if (Array.isArray(discount.schedule_ids)) {
      if (schedule_id_departure) {
        result.valid_schedule_departure = discount.schedule_ids.includes(
          parseInt(schedule_id_departure)
        );
        console.log(
          `Schedule ID departure ${schedule_id_departure} is ${
            result.valid_schedule_departure ? "" : "not "
          }in the list of valid schedule IDs.`
        );
      }
      if (schedule_id_return) {
        result.valid_schedule_return = discount.schedule_ids.includes(
          parseInt(schedule_id_return)
        );
        console.log(
          `Schedule ID return ${schedule_id_return} is ${
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
