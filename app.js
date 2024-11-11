const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const cors = require('cors');
const cronJobs = require('./util/cronJobs');
const { initWebSocketServer } = require('./config/websocket'); // Import fungsi WebSocket
const http = require('http');
// Konfigurasi CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowedDomains = [process.env.CORS_ORIGIN_1, process.env.CORS_ORIGIN_2];
    if (allowedDomains.indexOf(origin) !== -1 || !origin) {
      console.log(`CORS allowed from: ${origin}`);
      callback(null, true);
    } else {
      console.log(`CORS blocked from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
};

const app = express();
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
const agentComission = require('./routes/agentComission');
// Load routes
app.use('/api/users', userRoutes);
app.use('/api/boats', boatRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/transports', transportRoutes);
app.use('/api/transits', transitRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/agentsv2', agentComission);
app.use('/api/bookings', bookingRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/transport-bookings', transportBookingRoutes);
app.use('/api/subschedule', subscheduleRoutes);
app.use('/api/agent-metrics', agentMetricsRouter);
app.use('/api/seat', seatAvailabilityRoutes);
app.use('/api/booking-seat', bookingSeatAvailability);
app.use('/api/transactions', transactionRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/', (req, res) => {
  res.send('<h1>this is giligetaway my sql express backend</h1>');
});

// Middleware untuk menangani semua error
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    status: 'error',
    message: err.message,
  });
});



// Inisialisasi server HTTP
const server = http.createServer(app);

// Inisialisasi WebSocket server dengan menggunakan server HTTP
initWebSocketServer(server);

// Mulai server pada port yang ditentukan
const PORT = process.env.PORT || 8000;

sequelize.sync()
  .then(() => {
    console.log('Connected to the database');
    server.listen(PORT, () => {  // Ganti app.listen dengan server.listen
      console.log(`YAY Server is running on port ${PORT}`);
      cronJobs.handleExpiredBookings(); // Jalankan cron job saat server dimulai
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

