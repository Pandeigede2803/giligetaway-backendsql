const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgentCommission = sequelize.define('AgentCommission', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    booking_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Bookings',
            key: 'id'
        }
    },
    agent_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Agents',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    // agentComission.amount
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'AgentCommissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Association
AgentCommission.associate = (models) => {
    AgentCommission.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        targetKey: 'id'
    });
    AgentCommission.belongsTo(models.Agent, {
        foreignKey: 'agent_id',
        targetKey: 'id'
    });
};

module.exports = AgentCommission;
