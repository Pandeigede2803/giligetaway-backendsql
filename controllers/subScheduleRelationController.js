const {
  sequelize,
  Booking,
  SeatAvailability,
  Destination,
  Transport,
  Schedule,
  SubSchedule,
  Transaction,
  Passenger,
  Transit,
  TransportBooking,
  AgentMetrics,
  //   AgentCommission,
  Agent,
  BookingSeatAvailability,
  Boat,
} = require("../models");
const { fn, col } = require("sequelize");
const nodemailer = require("nodemailer");

const { Op } = require("sequelize");
const { SubScheduleRelation } = require('../models');

// ✅ 1. Membuat SubScheduleRelation
exports.createSubScheduleRelation = async (req, res) => {
    try {
        const { main_subschedule_id, related_subschedule_id } = req.body;

        const newRelation = await SubScheduleRelation.create({ main_subschedule_id, related_subschedule_id });

        return res.status(201).json({ message: 'SubSchedule Relation berhasil dibuat', data: newRelation });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Terjadi kesalahan server', error: error.message });
    }
};

// ✅ 2. Mendapatkan SubScheduleRelation berdasarkan SubSchedule ID

exports.getSubScheduleRelations = async (req, res) => {
    try {
        const { id: subscheduleId } = req.params;
        
        const relations = await SubScheduleRelation.findAll({
            where: {
                main_subschedule_id: subscheduleId
            },
            include: [
                {
                    model: SubSchedule,
                    as: "RelatedSchedule",
                    attributes: ["id"],
                    where: {
                        availability: true
                    },
                    include: [
                        {
                            model: Destination,
                            as: "DestinationFrom",
                            attributes: ["id", "name"]
                        },
                        {
                            model: Transit,
                            as: "TransitFrom",
                            attributes: ["id"],
                            include: [
                                {
                                    model: Destination,
                                    as: "Destination",
                                    attributes: ["id", "name"]
                                }
                            ]
                        },
                 
                        {
                            model: Transit,
                            as: "Transit1",
                            attributes: ["id"],
                            include: [
                                {
                                    model: Destination,
                                    as: "Destination",
                                    attributes: ["id", "name"]
                                }
                            ]
                        },
                        {
                            model: Transit,
                            as: "Transit2",
                            attributes: ["id"],
                            include: [
                                {
                                    model: Destination,
                                    as: "Destination",
                                    attributes: ["id", "name"]
                                }
                            ]
                        },
                        {
                            model: Transit,
                            as: "Transit3",
                            attributes: ["id"],
                            include: [
                                {
                                    model: Destination,
                                    as: "Destination",
                                    attributes: ["id", "name"]
                                }
                            ]
                        },
                        {
                            model: Transit,
                            as: "Transit4",
                            attributes: ["id"],
                            include: [
                                {
                                    model: Destination,
                                    as: "Destination",
                                    attributes: ["id", "name"]
                                }
                            ]
                        },
                        {
                            model: Transit,
                            as: "TransitTo",
                            attributes: ["id"],
                            include: [
                                {
                                    model: Destination,
                                    as: "Destination",
                                    attributes: ["id", "name"]
                                }
                            ]
                        },
                        {
                            model: Destination,
                            as: "DestinationTo",
                            attributes: ["id", "name"]
                        },
                    ]
                }
            ]
        });

     
        const plainRelations = relations.map(relation => relation.get({ plain: true }));

        // Add route string to each relation object
        const enhancedRelations = plainRelations.map(relation => {
            const relatedSchedule = relation.RelatedSchedule;
            
            // Get all potential destination points
            const allDestinations = [
                relatedSchedule.DestinationFrom?.name,
                relatedSchedule.TransitFrom?.Destination?.name,
                relatedSchedule.Transit1?.Destination?.name,
                relatedSchedule.Transit2?.Destination?.name,
                relatedSchedule.Transit3?.Destination?.name,
                relatedSchedule.Transit4?.Destination?.name,
                relatedSchedule.TransitTo?.Destination?.name,
                relatedSchedule.DestinationTo?.name
            ];
            
            // Filter out null/undefined values
            const validDestinations = allDestinations.filter(dest => dest !== undefined && dest !== null);
            
            // Create route string by joining with arrows
            const routeString = validDestinations.join(" → ");
            
            // Add route to the relation object directly
            return {
                ...relation,
                route: routeString || "No route information"
            };
        });

        return res.status(200).json({ 
            message: 'Data ditemukan', 
            data: enhancedRelations
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            message: 'Terjadi kesalahan server', 
            error: error.message 
        });
    }
};

exports.getSubSchedulesByScheduleId = async (req, res) => {
    try {
        const { id: scheduleId } = req.params;
        
        // First, find all subschedules belonging to this schedule
        const subschedules = await SubSchedule.findAll({
            where: {
                schedule_id: scheduleId,
                availability: true
            },
            // attributes: ["id", "schedule_id"],
            include: [
                {
                    model: Destination,
                    as: "DestinationFrom",
                    attributes: ["id", "name"]
                },
                {
                    model: Transit,
                    as: "TransitFrom",
                    attributes: ["id"],
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id", "name"]
                        }
                    ]
                },
                {
                    model: Transit,
                    as: "Transit1",
                    attributes: ["id"],
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id", "name"]
                        }
                    ]
                },
                {
                    model: Transit,
                    as: "Transit2",
                    attributes: ["id"],
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id", "name"]
                        }
                    ]
                },
                {
                    model: Transit,
                    as: "Transit3",
                    attributes: ["id"],
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id", "name"]
                        }
                    ]
                },
                {
                    model: Transit,
                    as: "Transit4",
                    attributes: ["id"],
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id", "name"]
                        }
                    ]
                },
                {
                    model: Transit,
                    as: "TransitTo",
                    attributes: ["id"],
                    include: [
                        {
                            model: Destination,
                            as: "Destination",
                            attributes: ["id", "name"]
                        }
                    ]
                },
                {
                    model: Destination,
                    as: "DestinationTo",
                    attributes: ["id", "name"]
                }
            ]
        });

        // Convert to plain objects
        const plainSubschedules = subschedules.map(sub => sub.get({ plain: true }));

        // For each subschedule, find its relations
        const result = await Promise.all(plainSubschedules.map(async (subschedule) => {
            // Find relations where this subschedule is the main one
            const relations = await SubScheduleRelation.findAll({
                where: {
                    main_subschedule_id: subschedule.id
                },
                include: [
                    {
                        model: SubSchedule,
                        as: "RelatedSchedule",
                        attributes: ["id"],
                        where: {
                            availability: true
                        },
                        include: [
                            {
                                model: Destination,
                                as: "DestinationFrom",
                                attributes: ["id", "name"]
                            },
                            {
                                model: Transit,
                                as: "TransitFrom",
                                attributes: ["id"],
                                include: [
                                    {
                                        model: Destination,
                                        as: "Destination",
                                        attributes: ["id", "name"]
                                    }
                                ]
                            },
                            {
                                model: Transit,
                                as: "Transit1",
                                attributes: ["id"],
                                include: [
                                    {
                                        model: Destination,
                                        as: "Destination",
                                        attributes: ["id", "name"]
                                    }
                                ]
                            },
                            {
                                model: Transit,
                                as: "Transit2",
                                attributes: ["id"],
                                include: [
                                    {
                                        model: Destination,
                                        as: "Destination",
                                        attributes: ["id", "name"]
                                    }
                                ]
                            },
                            {
                                model: Transit,
                                as: "Transit3",
                                attributes: ["id"],
                                include: [
                                    {
                                        model: Destination,
                                        as: "Destination",
                                        attributes: ["id", "name"]
                                    }
                                ]
                            },
                            {
                                model: Transit,
                                as: "Transit4",
                                attributes: ["id"],
                                include: [
                                    {
                                        model: Destination,
                                        as: "Destination",
                                        attributes: ["id", "name"]
                                    }
                                ]
                            },
                            {
                                model: Transit,
                                as: "TransitTo",
                                attributes: ["id"],
                                include: [
                                    {
                                        model: Destination,
                                        as: "Destination",
                                        attributes: ["id", "name"]
                                    }
                                ]
                            },
                            {
                                model: Destination,
                                as: "DestinationTo",
                                attributes: ["id", "name"]
                            },
                        ]
                    }
                ]
            });
            
            // Convert to plain objects
            const plainRelations = relations.map(relation => relation.get({ plain: true }));
            
            // Add route string to each relation
            const enhancedRelations = plainRelations.map(relation => {
                const relatedSchedule = relation.RelatedSchedule;
                
                // Get all potential destination points
                const allDestinations = [
                    relatedSchedule.DestinationFrom?.name,
                    relatedSchedule.TransitFrom?.Destination?.name,
                    relatedSchedule.Transit1?.Destination?.name,
                    relatedSchedule.Transit2?.Destination?.name,
                    relatedSchedule.Transit3?.Destination?.name,
                    relatedSchedule.Transit4?.Destination?.name,
                    relatedSchedule.TransitTo?.Destination?.name,
                    relatedSchedule.DestinationTo?.name
                ];
                
                // Filter out null/undefined values
                const validDestinations = allDestinations.filter(dest => dest !== undefined && dest !== null);
                
                // Create route string
                const routeString = validDestinations.join(" → ");
                
                // Add route to the relation object
                return {
                    ...relation,
                    route: routeString || "No route information"
                };
            });
            
            // Generate route string for the main subschedule
            const mainAllDestinations = [
                subschedule.DestinationFrom?.name,
                subschedule.TransitFrom?.Destination?.name,
                subschedule.Transit1?.Destination?.name,
                subschedule.Transit2?.Destination?.name,
                subschedule.Transit3?.Destination?.name,
                subschedule.Transit4?.Destination?.name,
                subschedule.TransitTo?.Destination?.name,
                subschedule.DestinationTo?.name
            ].filter(dest => dest !== undefined && dest !== null);
            
            const mainRouteString = mainAllDestinations.join(" → ");
            
            // Return the subschedule with its route and relations
            return {
                ...subschedule,
                route: mainRouteString || "No route information",
                relations: enhancedRelations
            };
        }));
        
        return res.status(200).json({ 
            message: 'Data ditemukan', 
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            message: 'Terjadi kesalahan server', 
            error: error.message 
        });
    }
};
// ✅ 3. Mengupdate atau Membuat SubScheduleRelation jika belum ada
exports.updateOrCreateSubScheduleRelation = async (req, res) => {
    try {
        const { id } = req.params;
        const { related_subschedule_ids } = req.body;

        console.log("related_subschedule_ids:", related_subschedule_ids);

        // Find all existing relations for this main subschedule
        const existingRelations = await SubScheduleRelation.findAll({
            where: {
                main_subschedule_id: id
            }
        });

        // If the array is empty or not provided, delete all existing relations
        if (!related_subschedule_ids || !Array.isArray(related_subschedule_ids) || related_subschedule_ids.length === 0) {
            // Count existing relations for reporting
            const deletedCount = existingRelations.length;
            
            // Delete all existing relations for this main_subschedule_id
            if (deletedCount > 0) {
                await SubScheduleRelation.destroy({
                    where: {
                        main_subschedule_id: id
                    }
                });
            }
            
            return res.status(200).json({ 
                message: 'All relations deleted successfully',
                result: {
                    total_requests: 0,
                    created_count: 0,
                    updated_count: 0,
                    deleted_count: deletedCount,
                    failed_count: 0
                }
            });
        }

        // Find relations to remove (existing relations not in the new list)
        const existingIds = existingRelations.map(rel => rel.related_subschedule_id.toString());
        const idsToRemove = existingIds.filter(existingId => 
            !related_subschedule_ids.includes(existingId)
        );

        // Delete relations that are no longer needed
        if (idsToRemove.length > 0) {
            await SubScheduleRelation.destroy({
                where: {
                    main_subschedule_id: id,
                    related_subschedule_id: idsToRemove
                }
            });
        }

        // Track results for response
        const results = {
            created: [],
            updated: [],
            deleted: idsToRemove.length,
            errors: []
        };

        // Process each related subschedule ID
        await Promise.all(related_subschedule_ids.map(async (related_subschedule_id) => {
            try {
                // Check if relation already exists
                let relation = await SubScheduleRelation.findOne({
                    where: {
                        main_subschedule_id: id,
                        related_subschedule_id
                    }
                });

                if (relation) {
                    // If exists, update it
                    await relation.update({ related_subschedule_id });
                    results.updated.push(relation);
                } else {
                    // If doesn't exist, create new
                    const newRelation = await SubScheduleRelation.create({
                        main_subschedule_id: id,
                        related_subschedule_id
                    });
                    results.created.push(newRelation);
                }
            } catch (error) {
                // Track individual errors
                results.errors.push({
                    related_subschedule_id,
                    error: error.message
                });
            }
        }));

        // Log the result
        console.log('Result of updateOrCreateSubScheduleRelation:');
        // console.log(JSON.stringify(results, null, 2));

        // Return appropriate response
        if (results.errors.length === related_subschedule_ids.length) {
            // All operations failed
            return res.status(500).json({ 
                message: 'Semua operasi gagal', 
                errors: results.errors 
            });
        } else {
            // At least some operations succeeded
            return res.status(200).json({ 
                message: 'Operation completed',
                result: {
                    total_requests: related_subschedule_ids.length,
                    created_count: results.created.length,
                    updated_count: results.updated.length,
                    deleted_count: results.deleted,
                    failed_count: results.errors.length
                },
                data: {
                    created: results.created,
                    updated: results.updated
                },
                errors: results.errors.length > 0 ? results.errors : undefined
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            message: 'Terjadi kesalahan server', 
            error: error.message 
        });
    }
};
// ✅ 4. Menghapus SubScheduleRelation berdasarkan ID
exports.deleteSubScheduleRelation = async (req, res) => {
    try {
        const { id } = req.params;

        const relation = await SubScheduleRelation.findByPk(id);

        if (!relation) {
            return res.status(404).json({ message: 'SubSchedule Relation tidak ditemukan' });
        }

        await relation.destroy();
        return res.status(200).json({ message: 'SubSchedule Relation berhasil dihapus' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Terjadi kesalahan server', error: error.message });
    }
};