const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Destination = sequelize.define('Destination', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    port_map_url: {
        type: DataTypes.TEXT,
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
    tableName: 'Destinations',
    timestamps: false
});

// Define associations
Destination.associate = (models) => {
    Destination.hasMany(models.Schedule, {
        as: 'FromSchedules',
        foreignKey: 'destination_from_id'
    });
    Destination.hasMany(models.Schedule, {
        as: 'ToSchedules',
        foreignKey: 'destination_to_id'
    });
};

module.exports = Destination;
