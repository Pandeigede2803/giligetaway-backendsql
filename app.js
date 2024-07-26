const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const cors = require('cors');

// Load environment variables
// require('dotenv').config();

// Konfigurasi kebijakan CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN, // Menggunakan variabel lingkungan
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
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
