// models/CustomEmailSchedulers.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CustomEmailSchedulers = sequelize.define(
  "CustomEmailSchedulers",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT("medium"),
      allowNull: false,
    },
    delay_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    booking_status: {
      type: DataTypes.ENUM(
        "pending",
        "paid",
        "cancelled",
        "abandoned",
        "completed",
        "invoiced",
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    payment_method: {
      type: DataTypes.ENUM("midtrans", "paypal", "manual", "doku","invoice"),
      allowNull: true,
    },
    target_type: {
      type: DataTypes.ENUM("customer", "agent", "all"),
      allowNull: false,
      defaultValue: "customer",
    },
    send_once: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    repeatable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    repeat_interval_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    template_type: {
      type: DataTypes.ENUM("reminder", "follow_up", "custom", "marketing"),
      allowNull: false,
      defaultValue: "custom",
    },
    schedule_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    subschedule_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "CustomEmailSchedulers",
    timestamps: false,
  }
);

CustomEmailSchedulers.associate = (models) => {
  CustomEmailSchedulers.hasMany(models.EmailSendLog, {
    foreignKey: "scheduler_id",
    as: "SendLogs",
  });
};

module.exports = CustomEmailSchedulers;
