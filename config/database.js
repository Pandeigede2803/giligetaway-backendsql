// require('dotenv').config();
// const { Sequelize } = require('sequelize');



// const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     dialect: process.env.DB_DIALECT,
//     timezone: '+08:00',

//     logging: false, // This will turn off SQL logging
// });

// module.exports = sequelize;


require('dotenv').config();
const { Sequelize } = require('sequelize');
const { sendTelegramMessage } = require('../util/telegram'); // ⬅️ tambahkan ini


const isProduction = process.env.NODE_ENV === 'production';

const DB_CONFIG = {
  database: isProduction ? process.env.DB_NAME : process.env.DEV_DB_NAME,
  username: isProduction ? process.env.DB_USER : process.env.DEV_DB_USER,
  password: isProduction ? process.env.DB_PASSWORD : process.env.DEV_DB_PASSWORD,
  host: isProduction ? process.env.DB_HOST : process.env.DEV_DB_HOST,
  port: isProduction ? process.env.DB_PORT : process.env.DEV_DB_PORT,
  dialect: isProduction ? process.env.DB_DIALECT : process.env.DEV_DB_DIALECT,
};

const sequelize = new Sequelize(DB_CONFIG.database, DB_CONFIG.username, DB_CONFIG.password, {
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  dialect: DB_CONFIG.dialect,
  timezone: '+08:00',
  logging: false,
});

sequelize
  .authenticate()
  .then(() => {
    console.log(`✅ Database Connected: ${DB_CONFIG.database}`);
  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);

    // Kirim ke Telegram jika gagal koneksi
    const msg = `
❌ <b>Sequelize Connection Error</b>
<pre>${err.message}</pre>
📦 DB: <code>${DB_CONFIG.database}</code>
🖥️ Host: <code>${DB_CONFIG.host}</code>
🕒 ${new Date().toLocaleString()}
    `.trim();

    sendTelegramMessage(msg);
  });

module.exports = sequelize;
