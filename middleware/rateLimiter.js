// const rateLimit = require('express-rate-limit');

// const bookingRateLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // Limit each IP to 10 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
//   onLimitReached: (req, res, options) => {
//     console.log(
//       `Rate limit reached for IP ${req.ip}, too many requests from this IP, please try again later.`
//     );
//   },
// });

// module.exports = bookingRateLimiter;


const rateLimit = require('express-rate-limit');

const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 10 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.log(`Rate limit reached for IP ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  },
});

module.exports = bookingRateLimiter;