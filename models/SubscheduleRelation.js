const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SubSchedule= require('./SubSchedule'); // Import model SeatAvailability

const SubScheduleRelation = sequelize.define("SubScheduleRelation", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    main_subschedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "SubSchedules",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    related_subschedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "SubSchedules",
            key: "id",
        },
        onDelete: "CASCADE",
    },
}, { 
    tableName: "SubScheduleRelations",
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ["main_subschedule_id", "related_subschedule_id"],
            name: "subsch_rel_main_related_idx" // Nama constraint lebih pendek
        }
    ]
});

// This creates a relationship where you can access the related SubSchedule from a relation
SubScheduleRelation.belongsTo(SubSchedule, {
    as: 'RelatedSubSchedule',
    foreignKey: 'related_subschedule_id'
});

// This creates a relationship where you can access the main SubSchedule from a relation
SubScheduleRelation.belongsTo(SubSchedule, {
    as: 'MainSubSchedule',
    foreignKey: 'main_subschedule_id'
});




module.exports = SubScheduleRelation;