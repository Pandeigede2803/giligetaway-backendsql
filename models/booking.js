
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
        },
        allowNull: false
    },
    subschedule_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'SubSchedules',
            key: 'id'
        },
        allowNull: true // Nullable as not every booking may have a sub_schedule_id
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

    currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'IDR'
    },
    gross_total_in_usd: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    exchange_rate: {
        type: DataTypes.DECIMAL(15, 6),
        allowNull: true
    },
    ticket_total: {
        type: DataTypes.DECIMAL(10, 2),  // New field for ticket total
        allowNull: false,
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
    expiration_time: {
        type: DataTypes.DATE,
        allowNull: true // This will store the time until the booking is held
    },
    ticket_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bank_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    abandoned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Flag to indicate if the booking was abandoned'
    },
    note : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes for the booking'
    },
    final_state: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Final state of the booking after all processes'
    },
    discount_data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Data related to discounts applied to the booking'
    },
    booked_by:{
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'User who booked the ticket'
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

Booking.associate = (models) => {
    Booking.belongsToMany(models.SeatAvailability, {
        through: models.BookingSeatAvailability,
        foreignKey: 'booking_id',
        otherKey: 'seat_availability_id',
        as: 'seatAvailabilities'
    });


    
    Booking.belongsTo(models.Schedule, {
        foreignKey: 'schedule_id',
        as: 'schedule'
    });
    Booking.belongsTo(models.SubSchedule, {
        foreignKey: 'subschedule_id',
        as: 'subSchedule'
    });


    Booking.belongsToMany(models.Transport, {
        through: 'TransportBookings',
        foreignKey: 'booking_id',
        as: 'transports'
    });

    Booking.belongsTo(models.Agent, {
        foreignKey: 'agent_id'
    });

    Booking.hasMany(models.Passenger, {
        foreignKey: 'booking_id',
        as: 'passengers'
    });

    Booking.hasMany(models.TransportBooking, {
        foreignKey: 'booking_id',
        as: 'transportBookings'
    });

    Booking.hasOne(models.AgentCommission, {
        foreignKey: 'booking_id',
        as: 'agentCommission'
    });
      // **Adding Transaction Association**:
    // One Booking can have many Transactions (for different payment attempts, refunds, etc.)
    Booking.hasMany(models.Transaction, {
        foreignKey: 'booking_id',
        as: 'transactions' // Alias for accessing related transactions
    });




    // new

    Booking.hasMany(models.BulkBookingResult, {
        foreignKey: 'booking_id',
        as: 'BookingResults'
    });
};

module.exports = Booking;
