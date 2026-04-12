const { Sequelize } = require('sequelize');

/**
 * Create database configuration (single connection)
 * @param {Object} baseConfig - Base database configuration
 * @returns {Sequelize} Sequelize instance
 */
function createDatabaseConfig(baseConfig) {
  console.log('Using single database connection to:', baseConfig.host);

  return new Sequelize(baseConfig.database, baseConfig.username, baseConfig.password, {
    host: baseConfig.host,
    port: baseConfig.port,
    dialect: baseConfig.dialect,
    timezone: '+08:00',
    logging: false,
  });
}

/**
 * Get connection status logs
 */
function getConnectionSuccessLogs(baseConfig) {
  return `Database connected: ${baseConfig.database} (${baseConfig.dialect})`;
}

function getConnectionErrorLogs(baseConfig, error) {
  return `Database connection failed: ${baseConfig.database} @ ${baseConfig.host} - ${error.message}`;
}

module.exports = {
  createDatabaseConfig,
  getConnectionSuccessLogs,
  getConnectionErrorLogs,
};
