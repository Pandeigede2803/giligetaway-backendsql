// models/EmailSendLog.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmailSendLog = sequelize.define('EmailSendLog', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  scheduler_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'CustomEmailSchedulers',
      key: 'id'
    }
  },
  booking_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false
  },
  sent_to: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  sent_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'EmailSendLogs',
  timestamps: false
});

EmailSendLog.associate = (models) => {
  EmailSendLog.belongsTo(models.CustomEmailSchedulers, {
    foreignKey: 'scheduler_id',
    as: 'Scheduler'
  });
};

module.exports = EmailSendLog;