// models/Agent.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Agent = sequelize.define('Agent', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    commission_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'Agents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Agent.associate = (models) => {
    Agent.hasMany(models.Booking, {
        foreignKey: 'agent_id',
        as: 'bookings'
    });
    Agent.hasOne(models.AgentMetrics, {
        foreignKey: 'agent_id',
        as: 'agentMetrics'
    });
    Agent.hasMany(models.AgentCommission, {
        foreignKey: 'agent_id',
        as: 'agentCommissions'
    });
};

module.exports = Agent;