// models/BulkBookingUpload.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BulkBookingUpload = sequelize.define('BulkBookingUpload', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    total_bookings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    successful_bookings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    failed_bookings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'processing'
    },
    file_name: {
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
    tableName: 'bulk_booking_uploads',
    timestamps: false
});

BulkBookingUpload.associate = (models) => {
    BulkBookingUpload.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'User'
    });
    
    BulkBookingUpload.hasMany(models.BulkBookingResult, {
        foreignKey: 'bulk_upload_id',
        as: 'Results'
    });
};

module.exports = BulkBookingUpload;