const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const bookingGoogleDataController = require("../controllers/bookingGoogleDataController");
const seatAvailabilityController = require("../controllers/seatAvailabilityController");
const authenticate = require("../middleware/authenticate");

const bookingRateLimiter = require("../middleware/rateLimiter"); // Rate limiting middleware
const {
  validateScheduleAndSubSchedule,
  validateScheduleAndSubScheduleForRoundTrip,
} = require("../middleware/validateScheduleAndSubschedule");
const validateTrips = require("../middleware/validateTrips");
const {
  checkSeatAvailabilityForUpdate,
  checkSeatAvailabilityForUpdate2,
  validateBookingDate,
  validateRoundTripTicket,
  validateBookingDate2,
  checkBookingDateUpdate,
  validatePaymentUpdate,
  checkAgentPassword,
  checkBookingDateUpdate2,
  checkBookingDateUpdateDirect,
  validateSeatNumberConflictOnDateChange,
} = require("../middleware/checkSeatAvailabilityForUpdate");


const {
  validateBookingCreation,
  validateTransportData,
  validateMultipleBookingCreation,
  validateRoundTripBookingPost,
  validateSingleBookingGrossTotal,
  validateRoundTripGrossTotal,
} = require("../middleware/validateBookingcreation");
const bulkBookingController = require("../controllers/bulkBookingController");
const multer = require("multer");
const path = require("path");
const { generateOneWayTicketId } = require("../controllers/bookingController");
const {
  generateRoundTripTicketIds,
} = require("../controllers/bookingController");
const bookingSummaryCron = require("../util/bookingSummaryCron");
const validateScheduleForBookingChange = require("../middleware/validateScheduleForBookingChange");


// Setup multer untuk upload file

router.get("/send-miss-booking", bookingController.sendMissBooking);

// / Route untuk menjalankan laporan booking harian segera (untuk testing)
router.get("/test-daily-summary", async (req, res) => {
  try {
    console.log("🧪 Menjalankan test daily booking summary segera...");
    // Kemudian gunakan:
    await bookingSummaryCron.sendDailyBookingSummary();

    res.json({
      success: true,
      message:
        "Test daily booking summary berhasil dijalankan! Periksa email Anda.",
    });
  } catch (error) {
    console.error("❌ Error saat testing daily summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });;
  }
});
// CREATE booking
router.post("/", bookingController.createBooking);

// Route for booking with transit
router.post("/transit", bookingController.createBookingWithTransit);

// Route for booking with transit

router.post(
  "/transit-queue",
  authenticate,
  validateScheduleAndSubSchedule,
  validateBookingCreation,
  // validateSingleBookingGrossTotal,
  validateTransportData,
  bookingController.createBookingWithTransitQueue
);

// Route for booking with transit multiple
router.post(
  "/multi-queue",
  authenticate,
  bookingRateLimiter,
  validateMultipleBookingCreation,
  validateTrips,
  bookingController.createBookingMultiple
);
// Route for booking with transit multiple
router.post(
  "/round-queue",
  authenticate,
  bookingRateLimiter,
  validateScheduleAndSubScheduleForRoundTrip,
  validateRoundTripBookingPost,
  // validateRoundTripGrossTotal,
  bookingController.createRoundBookingWithTransitQueue
);

// Route for booking without transit
router.post("/non-transit", bookingController.createBookingWithoutTransit);

router.post(
  "/find-related-sub-schedules",
  bookingController.findRelatedSubSchedulesGet
);
router.get("/discounts",authenticate, bookingController.getBookingDiscounts);

//ROUTE FOR BOOKING WITH PAGINATION AND MONTHLY PARAMS
router.get(
  "/filtered-pagination",
  authenticate,
  bookingController.getFilteredBookingsPagination
);

//ROUTE FOR BOOKING WITH PAGINATION AND MONTHLY PARAMS
router.get("/filtered", authenticate, bookingController.getFilteredBookings);

// READ bookings
router.get("/", authenticate, bookingController.getBookings);

// get abandoned payment
router.get(
  "/abandoned-payments",
  authenticate,
  bookingController.getAbandonedPayments
);

router.get(
  "abandoned-payments/:id",
  authenticate,
  bookingController.getAbandonedPaymentById
);

router.get("/generate-id/oneway", generateOneWayTicketId);
router.get("/generate-id/roundtrip", generateRoundTripTicketIds);

// READ bookings
router.get("/date", authenticate, bookingController.getBookingsByDate);


// GET /bookings/google-data?page=1&limit=20
router.get("/google-data",authenticate, bookingGoogleDataController.getBookingsWithGoogleData);
router.get("/google-data/summary",authenticate, bookingGoogleDataController.getGoogleBookingsSummary);
// READ booking by id
router.get("/:id", bookingController.getBookingById);

//read booking by ticket id
router.get("/ticket/:ticket_id", bookingController.getBookingByTicketId);

//read booking by ticket id
router.get(
  "/ticket-related/:ticket_id",
  validateRoundTripTicket,
  bookingController.getRelatedBookingsByTicketId
);

// get booking discount data
//  getBookingDiscounts

//update multiple booking payment
router.put(
  "/multipayment",
  authenticate,
  bookingController.updateMultipleBookingPayment
);

// UPDATE booking
router.put("/:id", bookingController.updateBooking);

router.put("/edit/:id", authenticate, bookingController.editBooking);

// update Booking note
router.put("/note/:id", authenticate, bookingController.updateBookingNotes);

//upd
//update booking payment
router.put(
  "/payment/:id",
  authenticate,
  validatePaymentUpdate,
  bookingController.updateBookingPayment
);


// PATCH because we’re updating part of the booking (schedule/subschedule)
router.patch('/:id/update-schedule', authenticate,validateScheduleForBookingChange, bookingController.updateScheduleBooking);


router.put(
  "/date/:id",
  authenticate,
  validateBookingDate,
  // validateSeatNumberConflictOnDateChange,
  checkSeatAvailabilityForUpdate,
  checkBookingDateUpdateDirect,
  bookingController.updateBookingDate
);

router.put(
  "/date-agent/:booking_id",
  authenticate,
  checkBookingDateUpdate2,
  // validateSeatNumberConflictOnDateChange,
  validateBookingDate2,
  checkSeatAvailabilityForUpdate2,
  bookingController.updateBookingDateAgent
);

// cancen booking
router.put(
  "/:booking_id/cancel",
  authenticate,
  checkBookingDateUpdate2,
  bookingController.cancelBooking
);

// DELETE booking
router.delete("/:id", authenticate, bookingController.deleteBooking);

// send
router.post('/send-follow-up',authenticate, bookingController.sendFollowUpPendingBookingEmail);

// Check available seats
router.get(
  "/check-available-seats",
  authenticate,
  seatAvailabilityController.checkAvailableSeats
);

// Check all contact details from booking
router.get(
  "/contact/details",
  authenticate,
  bookingController.getBookingContact
);

// // Route for booking with transit
// router.post('/createBookingWithTransit', createBookingWithTransit);

// // Route for booking without transit
// router.post('/createBookingWithoutTransit', createBookingWithoutTransit);

// BULK BOOKING

router.post("/bulk-multi-csv", (req, res, next) => {
  bulkBookingController.bulkBookingFromMultiCSV(req, res, next);
});






// Route untuk bulk booking dengan CSV

// Route untuk mendapatkan history bulk booking
router.get(
  "/bulk-booking/history",
  authenticate,
  bulkBookingController.getBulkBookingHistory
);

// Route untuk mendapatkan detail bulk booking
router.get(
  "/bulk-details/:id",
  authenticate,
  bulkBookingController.getBulkBookingDetails
);

// Routes untuk mendapatkan template CSV
router.get(
  "/templates/bookings",
  authenticate,
  bulkBookingController.getBookingsTemplate
);

router.get(
  "/templates/passengers",
  authenticate,
  bulkBookingController.getPassengersTemplate
);

router.get(
  "/templates/transports",
  authenticate,
  bulkBookingController.getTransportsTemplate
);

// GET /bookings/google-data?page=1&limit=20






// Route untuk memeriksa status bulk booking

module.exports = router;
