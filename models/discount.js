const { DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Adjust path to your Sequelize instance

const Discount = sequelize.define(
  "Discount",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    discount_type: {
      type: DataTypes.ENUM("percentage", "fixed"),
      allowNull: false,
    },
    discount_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    min_purchase: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    max_discount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    applicable_types: {
      type: DataTypes.ENUM("one_way", "round_trip", "all"),
      allowNull: false,
      defaultValue: "all",
      comment: "Jenis tiket yang berlaku untuk diskon ini",
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: DataTypes.NOW,
    },
  },
  {
    tableName: "Discount",
    timestamps: false, // Set to true if you want Sequelize to manage `createdAt` and `updatedAt`
  }
);

module.exports = Discount;
