// models/Transit.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transit = sequelize.define('Transit', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    schedule_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Schedules',
            key: 'id'
        }
    },
    destination_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Destinations',
            key: 'id'
        }
    },
    available_seats: {  // Kolom baru untuk melacak ketersediaan kursi
        type: DataTypes.INTEGER,
        allowNull: false
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
    tableName: 'Transits',
    timestamps: false
});

module.exports = Transit;
