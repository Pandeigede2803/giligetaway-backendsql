const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgentMetrics = sequelize.define('AgentMetrics', {
    agent_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'Agents',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },

  
    total_revenue: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    total_customers: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_bookings: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    gross_revenue: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    net_profit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    gross_pending_payment: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    net_pending_profit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    unpaid_payment: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    pending_payment: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    outstanding: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    payout: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
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
    tableName: 'AgentMetrics',
    timestamps: false
});

// Association
AgentMetrics.associate = (models) => {
    AgentMetrics.belongsTo(models.Agent, {
        foreignKey: 'agent_id',
        targetKey: 'id'
    });
};

module.exports = AgentMetrics;
