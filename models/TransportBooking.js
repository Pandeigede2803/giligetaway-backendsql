const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TransportBooking = sequelize.define(
  "TransportBooking",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    booking_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Bookings",
        key: "id",
      },
    },
    transport_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Transports",
        key: "id",
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    transport_price: {
      // New field for transport price
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    transport_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded', 'booking-payment'),
      allowNull: false,
      defaultValue: 'booking-payment',
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'booking-payment',
    },

    
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "TransportBookings",
    timestamps: true, // Enable automatic timestamps
    createdAt: "created_at", // Define custom field name for createdAt
    updatedAt: "updated_at", // Define custom field name for updatedAt
  }
);



TransportBooking.associate = (models) => {
    TransportBooking.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        as: 'booking'
    });
    TransportBooking.belongsTo(models.Transport, {
        foreignKey: 'transport_id',
        as: 'transport'
    });
};

module.exports = TransportBooking;
