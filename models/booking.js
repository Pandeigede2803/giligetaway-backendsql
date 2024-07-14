const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    contact_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    contact_phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    contact_passport_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    contact_nationality: {
        type: DataTypes.STRING,
        allowNull: true
    },
    contact_email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    schedule_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Schedules',
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
    agent_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'Agents',
            key: 'id'
        },
        allowNull: true
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: true
    },
    gross_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    total_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    adult_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    child_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    infant_passengers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    payment_status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    booking_source: {
        type: DataTypes.STRING,
        allowNull: true
    },
    booking_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    ticket_id: {
        type: DataTypes.STRING,
        allowNull: false // Make sure this field is not null
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
    tableName: 'Bookings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Many-to-many relationship with Transits

Booking.associate = (models) => {
    Booking.belongsToMany(models.SeatAvailability, {
        through: 'BookingSeatAvailability',
        foreignKey: 'booking_id'
    });
    Booking.belongsTo(models.Schedule, {
        foreignKey: 'schedule_id'
    });
    Booking.belongsTo(models.Transport, {
        foreignKey: 'transport_id'
    });
    Booking.belongsTo(models.Agent, {
        foreignKey: 'agent_id'
    });
    Booking.hasMany(models.Passenger, {
        foreignKey: 'booking_id',
        as: 'passengers'
    });
};

module.exports = Booking;
