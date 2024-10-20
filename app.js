const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const cors = require('cors');
const cronJobs = require('./util/cronJobs');

// Middleware dan route configuration lainnya...



// Load environment variables
// require('dotenv').config();

// Konfigurasi kebijakan CORS
// const corsOptions = {
//   origin: process.env.CORS_ORIGIN, // Menggunakan variabel lingkungan
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   allowedHeaders: 'Content-Type,Authorization',
// };

// konfigurasi cors 2 domain
const corsOptions = {
  origin: (origin, callback) => {
    const allowedDomains = [process.env.CORS_ORIGIN_1, process.env.CORS_ORIGIN_2]; // Mengambil dua domain dari variabel lingkungan
    if (allowedDomains.indexOf(origin) !== -1 || !origin) {
      console.log(`CORS allowed from: ${origin}`);
      callback(null, true); // Mengizinkan jika origin cocok atau tidak ada origin (untuk request dari same-origin)
    } else {
      console.log(`CORS blocked from: ${origin}`);
      callback(new Error('Not allowed by CORS')); // Menolak jika origin tidak ada di daftar
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
};

const app = express();

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Middleware to parse URL-encoded form data

// Routes
const userRoutes = require('./routes/user');
const boatRoutes = require('./routes/boat');
const destinationRoutes = require('./routes/destination');
const scheduleRoutes = require('./routes/schedule');
const transportRoutes = require('./routes/transport');
const transitRoutes = require('./routes/transit');
const agentRoutes = require('./routes/agent');
const bookingRoutes = require('./routes/booking');
const passengerRoutes = require('./routes/passenger');
const transportBookingRoutes = require('./routes/transportBookingRoutes');
const subscheduleRoutes = require('./routes/subScheduleRoutes');
const agentMetricsRouter = require('./routes/agentMetrics');
const seatAvailabilityRoutes = require('./routes/SeatAvailability');
const bookingSeatAvailability = require('./routes/bookingSeatAvailability');
const transactionRoutes = require('./routes/transactionRoutes');
const emailRoutes = require('./routes/email');
const paymentRoutes = require('./routes/payment');


// Load routes
app.use('/api/users', userRoutes);
app.use('/api/boats', boatRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/transports', transportRoutes);
app.use('/api/transits', transitRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/transport-bookings', transportBookingRoutes);
app.use('/api/subschedule', subscheduleRoutes);
app.use('/api/agent-metrics', agentMetricsRouter);
// Use the seatAvailability routes
app.use('/api/seat', seatAvailabilityRoutes);

app.use('/api/booking-seat',bookingSeatAvailability);
app.use('/api/transactions', transactionRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/payment', paymentRoutes);

//api/agents/reset-password

app.get('/', (req, res) => {
  res.send('<h1>this is giligetaway my sql express backend</h1>');
});

// Middleware untuk menangani semua error harus diletakkan setelah semua route handlers
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    status: 'error',
    message: err.message,
  });
});

const PORT = process.env.PORT || 8000;

sequelize.sync()
  .then(() => {
    console.log('Connected to the database');
    app.listen(PORT, () => {
      console.log(`YAY Server is running on port ${PORT}`);

      // Jalankan cron job saat server dimulai
      cronJobs.handleExpiredBookings();
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
