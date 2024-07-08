const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TransportBooking = sequelize.define('TransportBooking', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    booking_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Bookings',
            key: 'id'
        }
    },
    transport_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Transports',
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    transport_price: { // New field for transport price
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    transport_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    note: {
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
    tableName: 'TransportBookings',
    timestamps: true
});

TransportBooking.associate = (models) => {
    TransportBooking.belongsTo(models.Booking, { foreignKey: 'booking_id' });
    TransportBooking.belongsTo(models.Transport, { foreignKey: 'transport_id' });
};

module.exports = TransportBooking;
