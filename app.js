const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const cors = require('cors');
const cronJobs = require('./util/cronJobs');
const bookingSummaryCron = require('./util/bookingSummaryCron');
const customEmailSchedulerCron = require('./util/customEmailJob');
const seatFixCron = require('./util/seatFixCron');
const waitingListCron = require('./util/waitingListCron');
const unpaidReminderCronJobs = require('./util/unpaidReminderCronJobs');
const cronFrequencySeatDuplicates = require('./util/cronFrequencySeatDuplicates');
const {scheduleSeatCapacityCron, scheduleSeatCapacityCron70} = require('./util/seatCapacityCron');
const { initWebSocketServer } = require('./config/websocket');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');
const { sendTelegramMessage } = require('./util/telegram');

dotenv.config();
console.log('NODE_ENV:', process.env.NODE_ENV);

// ========== CORS OPTIONS ==========
const corsOptions = {
  origin: (origin, callback) => {
    const allowedDomains = [
      process.env.CORS_ORIGIN_1, 
      process.env.CORS_ORIGIN,
      process.env.CORS_ORIGIN_2,
      process.env.CORS_ORIGIN_3,
      process.env.CORS_ORIGIN_4
  
    ];
    
    if (allowedDomains.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
};

const app = express();

// ========== CUSTOM CORS MIDDLEWARE ==========
app.use((req, res, next) => {
  // SPECIAL HANDLING: /api/agent-access dapat diakses dari domain manapun
  if (req.path.startsWith('/api/agent-access')) {
    // console.log(`🌍 PUBLIC API Access: ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
    
    // Set CORS headers untuk public access
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Max-Age', '3600');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      console.log('✈️ Preflight OK for public agent API');
      return res.status(200).end();
    }
    
    return next();
  }
  
  // Apply restricted CORS untuk routes lainnya
  cors(corsOptions)(req, res, next);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========== IMPORT ROUTES ==========
const agentRoutesApi = require('./routes/agentRoutesApi');
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
const metrics = require('./routes/metrics');
const csvUploadRoutes = require('./routes/csvUploadRoutes');
const discountRoutes = require('./routes/discountRoutes');
const subSchedulesRelationRoutes = require('./routes/subScheduleRelationsRoute');
const waitingListRoutes = require('./routes/waitingtListRoutes');
const customEmailSchedulerRoutes = require('./routes/customEmailSchedulerRoutes');
const emailLogRoutes = require('./routes/emailLogRoutes');

// ========== ROUTES ==========
// PUBLIC API AGENT (sudah di-handle CORS di middleware atas)
app.use('/api/agent-access', (req, res, next) => {
  // console.log(`🔑 Agent API: ${req.method} ${req.originalUrl}`);
  next();
}, agentRoutesApi);

// PROTECTED ROUTES (dengan CORS terbatas)
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
app.use('/api/metrics', metrics);
app.use("/api/upload-multiple-csv-booking", csvUploadRoutes);
app.use("/api/discount", discountRoutes);
app.use("/api/subschedules-relation", subSchedulesRelationRoutes);
app.use('/api/waiting-list', waitingListRoutes);;
app.use('/api/custom-email-scheduler', customEmailSchedulerRoutes);
app.use('/api/email-logs', emailLogRoutes);

app.get('/', (req, res) => {
  res.send('<h1>this is giligetaway my sql express backend</h1>');
});

// Error handling
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).send({
//     status: 'error',
//     message: err.message,
//   });
// });

app.use((err, req, res, next) => {
  console.error(err.stack);

  const message = `
❗️<b>Express Error</b>
<pre>${err.message}</pre>
📍<code>${req.method} ${req.originalUrl}</code>
🕒 ${new Date().toLocaleString()}
  `.trim();

  sendTelegramMessage(message);

  res.status(500).json({
    status: 'error',
    message: err.message,
  });
});;


const url = process.env.MIDTRANS_API_BASE_URL;
console.log("  😻   😻 Midtrans API URL:", url);

const server = http.createServer(app);
initWebSocketServer(server);

const PORT = process.env.PORT || 8000;

sequelize.sync()
  .then(() => {
    console.log('Connected to the database');
    server.listen(PORT, () => {
      console.log(`YAY Server is running on port ${PORT}`);
      cronJobs.handleExpiredBookings();
      bookingSummaryCron.scheduleDailySummary();
      // console.log('✅ Daily booking summary cronjob registered');
      seatFixCron.scheduleSeatFixJob();
      // console.log('✅ SeatFixCron registered');
      waitingListCron.scheduleWaitingListCron();
      // console.log('⛑️ ==== Waiting List Cron registered =====');
      unpaidReminderCronJobs.sendUnpaidReminders();
      // console.log(' 🐰Unpaid reminder cronjob registered');
      cronFrequencySeatDuplicates.scheduleDuplicateSeatJob();
      // console.log('🕒 Duplicate seat checker cronjob registered');
      cronFrequencySeatDuplicates.seatBoostedJob();

      customEmailSchedulerCron.scheduleCustomEmailJob();
// console.log('📧 Custom Email Scheduler cron registered'); 
 
      scheduleSeatCapacityCron();
            //  console.log('🗣️ SeatCapacityCron registered');

      scheduleSeatCapacityCron70();
            //  console.log('🗣️ SeatCapacityCron70 registered');

    


    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });



//   const express = require('express');
// const bodyParser = require('body-parser');
// const sequelize = require('./config/database');
// const cors = require('cors');
// const cronJobs = require('./util/cronJobs');
// const bookingSummaryCron = require('./util/bookingSummaryCron');
// const seatFixCron = require('./util/seatFixCron');
// const waitingListCron = require('./util/waitingListCron');
// const unpaidReminderCronJobs = require('./util/unpaidReminderCronJobs');
// const { initWebSocketServer } = require('./config/websocket');
// const http = require('http');
// const dotenv = require('dotenv');
// const path = require('path');

// dotenv.config();
// console.log('NODE_ENV:', process.env.NODE_ENV);

// // ========== CORS OPTIONS ==========
// const corsOptions = {
//   origin: (origin, callback) => {
//     const allowedDomains = [
//       process.env.CORS_ORIGIN_1, 
//       process.env.CORS_ORIGIN,
//       process.env.CORS_ORIGIN_2,
//       process.env.CORS_ORIGIN_3,
//       process.env.CORS_ORIGIN_4,
  
//     ];
    
//     if (allowedDomains.indexOf(origin) !== -1 || !origin) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   allowedHeaders: 'Content-Type,Authorization',
// };

// const app = express();

// // ========== CUSTOM CORS MIDDLEWARE ==========
// app.use((req, res, next) => {
//   // SPECIAL HANDLING: /api/agent-access dapat diakses dari domain manapun
//   if (req.path.startsWith('/api/agent-access')) {
//     // console.log(`🌍 PUBLIC API Access: ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
    
//     // Set CORS headers untuk public access
//     res.header('Access-Control-Allow-Origin', '*');
//     res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
//     res.header('Access-Control-Max-Age', '3600');
    
//     // Handle preflight OPTIONS request
//     if (req.method === 'OPTIONS') {
//       console.log('✈️ Preflight OK for public agent API');
//       return res.status(200).end();
//     }
    
//     return next();
//   }
  
//   // Apply restricted CORS untuk routes lainnya
//   cors(corsOptions)(req, res, next);
// });

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // ========== IMPORT ROUTES ==========
// const agentRoutesApi = require('./routes/agentRoutesApi');
// const userRoutes = require('./routes/user');
// const boatRoutes = require('./routes/boat');
// const destinationRoutes = require('./routes/destination');
// const scheduleRoutes = require('./routes/schedule');
// const transportRoutes = require('./routes/transport');
// const transitRoutes = require('./routes/transit');
// const agentRoutes = require('./routes/agent');
// const bookingRoutes = require('./routes/booking');
// const passengerRoutes = require('./routes/passenger');
// const transportBookingRoutes = require('./routes/transportBookingRoutes');
// const subscheduleRoutes = require('./routes/subScheduleRoutes');
// const agentMetricsRouter = require('./routes/agentMetrics');
// const seatAvailabilityRoutes = require('./routes/SeatAvailability');
// const bookingSeatAvailability = require('./routes/bookingSeatAvailability');
// const transactionRoutes = require('./routes/transactionRoutes');
// const emailRoutes = require('./routes/email');
// const paymentRoutes = require('./routes/payment');
// const agentComission = require('./routes/agentComission');
// const metrics = require('./routes/metrics');
// const csvUploadRoutes = require('./routes/csvUploadRoutes');
// const discountRoutes = require('./routes/discountRoutes');
// const subSchedulesRelationRoutes = require('./routes/subScheduleRelationsRoute');
// const waitingListRoutes = require('./routes/waitingtListRoutes');

// // ========== ROUTES ==========
// // PUBLIC API AGENT (sudah di-handle CORS di middleware atas)
// app.use('/api/agent-access', (req, res, next) => {
//   console.log(`🔑 Agent API: ${req.method} ${req.originalUrl}`);
//   next();
// }, agentRoutesApi);

// // PROTECTED ROUTES (dengan CORS terbatas)
// app.use('/api/users', userRoutes);
// app.use('/api/boats', boatRoutes);
// app.use('/api/destinations', destinationRoutes);
// app.use('/api/schedules', scheduleRoutes);
// app.use('/api/transports', transportRoutes);
// app.use('/api/transits', transitRoutes);
// app.use('/api/agents', agentRoutes);
// app.use('/api/agentsv2', agentComission);
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/passengers', passengerRoutes);
// app.use('/api/transport-bookings', transportBookingRoutes);
// app.use('/api/subschedule', subscheduleRoutes);
// app.use('/api/agent-metrics', agentMetricsRouter);
// app.use('/api/seat', seatAvailabilityRoutes);
// app.use('/api/booking-seat', bookingSeatAvailability);
// app.use('/api/transactions', transactionRoutes);
// app.use('/api/email', emailRoutes);
// app.use('/api/payment', paymentRoutes);
// app.use('/api/metrics', metrics);
// app.use("/api/upload-multiple-csv-booking", csvUploadRoutes);
// app.use("/api/discount", discountRoutes);
// app.use("/api/subschedules-relation", subSchedulesRelationRoutes);
// app.use('/api/waiting-list', waitingListRoutes);

// app.get('/', (req, res) => {
//   res.send('<h1>this is giligetaway my sql express backend</h1>');
// });

// // Error handling
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).send({
//     status: 'error',
//     message: err.message,
//   });
// });

// const url = process.env.MIDTRANS_API_BASE_URL;
// console.log("  😻   😻 Midtrans API URL:", url);

// const server = http.createServer(app);
// initWebSocketServer(server);

// const PORT = process.env.PORT || 8000;

// sequelize.sync()
//   .then(() => {
//     console.log('Connected to the database');
//     server.listen(PORT, () => {
//       console.log(`YAY Server is running on port ${PORT}`);
//       cronJobs.handleExpiredBookings();
//       bookingSummaryCron.scheduleDailySummary();
//       console.log('✅ Daily booking summary cronjob registered');
//       seatFixCron.scheduleSeatFixJob();
//       console.log('✅ SeatFixCron registered');
//       waitingListCron.scheduleWaitingListCron();
//       console.log('⛑️ ==== Waiting List Cron registered =====');
//       unpaidReminderCronJobs.sendUnpaidReminders();
//       console.log(' 🐰Unpaid reminder cronjob registered');
//     });
//   })
//   .catch(err => {
//     console.error('Unable to connect to the database:', err);
//   });