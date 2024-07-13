const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transport = sequelize.define('Transport', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    pickup_area: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    pickup_time: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    check_in_time: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    pickup_time_2: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    check_in_time_2: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    pickup_time_3: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    check_in_time_3: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    pickup_time_4: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    check_in_time_4: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    interval_time: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    description: {
        type: DataTypes.STRING(255),
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
    tableName: 'Transports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Transport.associate = (models) => {
    Transport.hasMany(models.TransportBooking, { foreignKey: 'transport_id' });
};

module.exports = Transport;
