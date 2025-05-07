const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Boat = sequelize.define('Boat', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    boat_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    capacity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    boat_image: {
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
    },
    inside_seats: {
        type: DataTypes.JSON,
        allowNull: true
    },
    outside_seats: {
        type: DataTypes.JSON,
        allowNull: true
    },
    rooftop_seats: {
        type: DataTypes.JSON,
        allowNull: true
    },
    published_capacity: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
}, {
    tableName: 'Boats',
    timestamps: false
});

Boat.associate = (models) => {
    Boat.hasMany(models.Schedule, {
        foreignKey: 'boat_id',
        as: 'Schedules'
    });
};

module.exports = Boat;
