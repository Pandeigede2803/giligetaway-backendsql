const express = require("express");
const router = express.Router();
const {
  getAllSeatAvailabilityScheduleAndSubSchedule,
  checkAvailableSeats,
  getSeatAvailabilityByMonthYear,
 getSeatAvailabilityMonthlyView
 ,
  deleteSeatAvailabilityByIds,
  updateSeatAvailability,
  checkAllAvailableSeats,
  getFilteredSeatAvailabilityById,
  checkAllAvailableSeatsBookingCount,
  handleSeatAvailability,createOrGetSeatAvailability,
  fixSeatMismatch,
findMissingRelatedBySeatId,
  fixSeatMismatchBatch, getDuplicateSeatReport,
  fixSeatMismatchBatch2,setAllSeatsAvailabilityById
} = require("../controllers/seatAvailabilityController"); // Adjust the path as needed

const authenticate = require("../middleware/authenticate");
// Route to check available seats for a specific schedule and date
const { body } = require("express-validator");
// module.exports = boostSeatMiddleware;
// const 
const boostSeatMiddleware = require("../middleware/boostSeatMiddleware");
const { checkMaximumCapacity,validateSeatAvailabilityDate,validateSeatAvailabilityExist } = require("../middleware/checkSeatAvailabilityForUpdate");
const validateSeatAvailability = require("../middleware/validateSeatAvailability");







router.post('/create-or-get',authenticate, validateSeatAvailabilityExist, createOrGetSeatAvailability);

router.get("/get-month", authenticate, getSeatAvailabilityByMonthYear);
router.get("/get-monthly-view", authenticate,  getSeatAvailabilityMonthlyView);
router.delete("/delete", authenticate, deleteSeatAvailabilityByIds);

router.get("/test/duplicate-seat", getDuplicateSeatReport); // ✅ hit this from Postman

router.get("/check-available", authenticate, checkAvailableSeats);



router.get('/missing-related-seat-availability',findMissingRelatedBySeatId);

// Route to check all available seats for a specific schedule and date
router.get("/check-all", authenticate, checkAllAvailableSeats);
// Fix seat mismatch for a single seat availability
router.post('/fix-mismatch/:id', authenticate, fixSeatMismatch);

// Fix seat mismatch for multiple seat availabilities
router.post('/fix-mismatch-batch', authenticate, fixSeatMismatchBatch2);

// updateseatavailability

router.put("/update-seat/:id", authenticate, updateSeatAvailability);


// update availability all seat in a day
router.patch("/update-all-seat/set-availability",authenticate, setAllSeatsAvailabilityById);


router.get("/related-seat/:id", authenticate, getFilteredSeatAvailabilityById);

// Route to check all available seats for a specific schedule and date
router.get(
  "/check-all/booking-count",
  authenticate,
  checkAllAvailableSeatsBookingCount
);;

// updateseatavailability

router.get(
  "/get-all-seat-availability-schedule-and-subschedule",
  authenticate,
  getAllSeatAvailabilityScheduleAndSubSchedule
);

router.post(
    "/boost-seat-availability",
    authenticate,
    // checkMaximumCapacity,
    validateSeatAvailabilityDate,
    [
      body("schedule_id")
        .optional()
        .isInt()
        .withMessage("Schedule ID must be an integer"),
      body("subschedule_id")
        .optional()
        .isInt()
        .withMessage("Subschedule ID must be an integer"),
      body("date")
        .notEmpty()
        .isISO8601()
        .withMessage("Date must be a valid ISO 8601 date"),
    ],
    // boostSeatMiddleware,
   handleSeatAvailability
  );

module.exports = router;
