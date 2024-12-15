// models/Agent.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Agent = sequelize.define(
  "Agent",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    commission_long: {
      type: DataTypes.DECIMAL(10, 2), // 10 total digits, with 2 digits after the decimal point (e.g., 100000.00)
      allowNull: false,
      defaultValue: 0.0,
    },
    commission_short: {
      type: DataTypes.DECIMAL(10, 2), // 10 total digits, with 2 digits after the decimal point
      allowNull: false,
      defaultValue: 0.0,
    },
    commission_mid: {
      type: DataTypes.DECIMAL(10, 2), // 10 total digits, with 2 digits after the decimal point
      allowNull: true,
      defaultValue: 0.0,
    },
    commission_intermediate: {
      type: DataTypes.DECIMAL(10, 2), // 10 total digits, with 2 digits after the decimal point
      allowNull: true,
      defaultValue: 0.0,
    },
    commission_transport: {
      type: DataTypes.DECIMAL(10, 2), // 10 total digits, with 2 digits after the decimal point
      allowNull: true,
      defaultValue: 0.0,
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue:
        "https://ik.imagekit.io/m1akscp5q/Person-placeholder.jpg?updatedAt=1732263814558",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    // add contact person

    contact_person: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue:"unknown",
    },
  },
  {
    tableName: "Agents",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

Agent.associate = (models) => {
  Agent.hasMany(models.Booking, {
    foreignKey: "agent_id",
    as: "bookings",
  });
  Agent.hasOne(models.AgentMetrics, {
    foreignKey: "agent_id",
    as: "agentMetrics",
  });
  Agent.hasMany(models.AgentCommission, {
    foreignKey: "agent_id",
    as: "agentCommissions",
  });
};

module.exports = Agent;
