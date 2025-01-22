// routes/csvUploadRoutes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const csvUploadController = require("../controllers/csvUploadController");
const authenticate = require("../middleware/authenticate");

// Tentukan folder untuk menyimpan file upload secara sementara
const upload = multer({ dest: "uploads/" });

// Definisikan route POST untuk upload 3 file CSV
router.post(
  "/upload-multiple-csv",
  upload.fields([
    { name: "bookingsCsv", maxCount: 1 },
    { name: "passengersCsv", maxCount: 1 },
    { name: "transportsCsv", maxCount: 1 },
  ]),authenticate,
  csvUploadController.uploadMultipleCsv
);

module.exports = router;