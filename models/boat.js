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
    }
}, {
    tableName: 'Boats',
    timestamps: false
}

);

Boat.associate = (models) => {
    Boat.hasMany(models.Schedule, {
        foreignKey: 'boat_id',
        as: 'Schedules'
    });
};

module.exports = Boat;
