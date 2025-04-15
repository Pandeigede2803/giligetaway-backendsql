// models/BulkBookingResult.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BulkBookingResult = sequelize.define('BulkBookingResult', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    bulk_upload_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'bulk_booking_uploads',
            key: 'id'
        }
    },
    booking_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Bookings',
            key: 'id'
        }
    },
    ticket_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('success', 'failed'),
        allowNull: false
    },
    error_message: {
        type: DataTypes.TEXT,
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
    tableName: 'BulkBookingResults',
    timestamps: false
});

BulkBookingResult.associate = (models) => {
    BulkBookingResult.belongsTo(models.BulkBookingUpload, {
        foreignKey: 'bulk_upload_id',
        as: 'Upload'
    });
    
    BulkBookingResult.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        as: 'Booking'
    });
};

module.exports = BulkBookingResult;