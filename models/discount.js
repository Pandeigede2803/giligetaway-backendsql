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
    applicable_direction: {
      type: DataTypes.ENUM("departure", "return", "all"),
      allowNull: false,
      defaultValue: "all",
      comment: "Diskon ini berlaku untuk arah keberangkatan tertentu",
    },
    route_key: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Slug rute spesifik seperti 'gili-trawangan-gili-gede'",
    },
    schedule_ids: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of schedule IDs where the discount applies",
    },
    agent_ids: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of agent IDs who can use this discount",
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
