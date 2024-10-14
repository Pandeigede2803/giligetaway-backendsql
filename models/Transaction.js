const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    transaction_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'transaction_id'
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'payment_method'
    },
    payment_gateway: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'payment_gateway'
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'amount'
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'currency'
    },
    amount_in_usd: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        field: 'amount_in_usd'
    },
    exchange_rate: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
        defaultValue: null,
        field: 'exchange_rate'
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        field: 'status'
    },
    transaction_type: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'transaction_type'
    },
    transaction_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'transaction_date'
    },
    failure_reason: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'failure_reason'
    },
    refund_reason: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'refund_reason'
    },
    booking_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Bookings',
            key: 'id'
        },
        allowNull: false,
        field: 'booking_id'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'Transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Transaction.associate = (models) => {
    Transaction.belongsTo(models.Booking, { foreignKey: 'booking_id', as: 'booking' });
};

module.exports = Transaction;
