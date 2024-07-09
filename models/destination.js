// Sequelize model update
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
    tableName: 'Destinations',
    timestamps: false
});

module.exports = Destination;
