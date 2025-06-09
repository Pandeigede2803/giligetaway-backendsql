// controllers/waitingListController.js
const { WaitingList, Schedule, SubSchedule, SeatAvailability,Boat,Destination } = require('../models');
const nodemailer = require("nodemailer");

const {
sendAdminNotificationEmail,sendWaitingListConfirmationEmail
} = require("../util/sendPaymentEmail");
// Create a new waiting list entry


exports.create = async (req, res) => {
  try {
    const {
      contact_name,
      contact_phone,
      contact_email,
      schedule_id,
      subschedule_id,
      booking_date,
      total_passengers,
      adult_passengers,
      child_passengers,
      infant_passengers,
      status,
      follow_up_notes,
      follow_up_date
    } = req.body;

    // Validate required fields
    if (!contact_name || !contact_phone || !contact_email || !schedule_id || 
        !booking_date || !total_passengers) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields' 
      });
    }

    // Find seat availability based on booking_date, schedule_id, and subschedule_id
    const whereClause = {
      date: booking_date,
      schedule_id: schedule_id
    };
    
    // Add subschedule_id to the where clause if it's provided
    if (subschedule_id) {
      whereClause.subschedule_id = subschedule_id;
    }
    
    let seatAvailability = await SeatAvailability.findOne({
      where: whereClause
    });

    // If seat availability not found, create a new one
    if (!seatAvailability) {
      // First, fetch the schedule to get capacity info
      const schedule = await Schedule.findByPk(schedule_id);
      if (!schedule) {
        return res.status(404).json({ 
          success: false,
          message: 'Schedule not found' 
        });
      }

      // Get boat capacity from the schedule's boat
      const boat = await Boat.findByPk(schedule.boat_id);
      if (!boat) {
        return res.status(404).json({ 
          success: false,
          message: 'Boat not found for the given schedule' 
        });
      }

      // Create a new seat availability entry
      seatAvailability = await SeatAvailability.create({
        schedule_id,
        subschedule_id: subschedule_id || null,
        date: booking_date,
        available_seats: boat.capacity, // Set initial available seats to boat capacity
        availability: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log(`Created new seat availability with ID: ${seatAvailability.id}`);
    }

    // Create the waiting list entry
    const waitingList = await WaitingList.create({
      contact_name,
      contact_phone,
      contact_email,
      schedule_id,
      subschedule_id,
      seat_availability_id: seatAvailability.id,
      booking_date,
      total_passengers,
      adult_passengers: adult_passengers || 0,
      child_passengers: child_passengers || 0,
      infant_passengers: infant_passengers || 0,
      status: status || 'pending',
      follow_up_notes,
      follow_up_date,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Get schedule details for the email
    const schedule = await Schedule.findByPk(schedule_id, {
      include: [
        { model: Destination, as: 'DestinationFrom' },
        { model: Destination, as: 'DestinationTo' }
      ]
    });

    // Format date for display
    const formattedDate = new Date(booking_date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Set up email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST_BREVO,
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_LOGIN_BREVO,
        pass: process.env.EMAIL_PASS_BREVO,
      },
    });

    // Send email to the customer
    await sendWaitingListConfirmationEmail(
      transporter,
      contact_email,
      contact_name,
      schedule,
      formattedDate,
      total_passengers,
      follow_up_notes
    );

    // Send notification email to admin
    await sendAdminNotificationEmail(
      transporter,
      waitingList,
      schedule,
      formattedDate,
      follow_up_notes
    );

    return res.status(201).json({
      success: true,
      data: waitingList,
      seat_availability: seatAvailability,
      seat_availability_created: !seatAvailability
    });
  } catch (error) {
    console.error('Error creating waiting list:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};
// Function to send confirmation email to the customer
// Get all waiting list entries
exports.findAll = async (req, res) => {
  try {
    const { status, schedule_id, booking_date } = req.query;
    
    // Build where clause based on query parameters
    const whereClause = {};
    if (status) whereClause.status = status;
    if (schedule_id) whereClause.schedule_id = schedule_id;
    if (booking_date) whereClause.booking_date = booking_date;

    const waitingLists = await WaitingList.findAll({
      where: whereClause,
      include: [
        { model: Schedule, as: 'WaitingListSchedule' },
        { model: SubSchedule, as: 'WaitingListSubSchedule' },
        { model: SeatAvailability, as: 'WaitingListSeatAvailability' }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: waitingLists.length,
      data: waitingLists
    });
  } catch (error) {
    console.error('Error fetching waiting lists:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};
// Get a single waiting list entry by ID
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    
    const waitingList = await WaitingList.findByPk(id, {
      include: [
        { model: Schedule, as: 'WaitingListSchedule' },
        { model: SubSchedule, as: 'WaitingListSubSchedule' },
        { model: SeatAvailability, as: 'WaitingListSeatAvailability' }
      ]
    });

    if (!waitingList) {
      return res.status(404).json({ 
        success: false,
        message: 'Waiting list entry not found' 
      });
    }

    return res.status(200).json({
      success: true,
      data: waitingList
    });
  } catch (error) {
    console.error('Error fetching waiting list:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// Update a waiting list entry
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      contact_name,
      contact_phone,
      contact_email,
      schedule_id,
      subschedule_id,
      seat_availability_id,
      booking_date,
      total_passengers,
      adult_passengers,
      child_passengers,
      infant_passengers,
      status,
      follow_up_notes,
      follow_up_date,
      last_contact_date
    } = req.body;

    // Check if waiting list entry exists
    const waitingList = await WaitingList.findByPk(id);
    if (!waitingList) {
      return res.status(404).json({ 
        success: false,
        message: 'Waiting list entry not found' 
      });
    }

    // If seat_availability_id is changed, check if it exists
    if (seat_availability_id && seat_availability_id !== waitingList.seat_availability_id) {
      const seatAvailability = await SeatAvailability.findByPk(seat_availability_id);
      if (!seatAvailability) {
        return res.status(404).json({ 
          success: false,
          message: 'Seat availability not found' 
        });
      }
    }

    // Update the waiting list entry
    const updatedData = {
      contact_name,
      contact_phone,
      contact_email,
      schedule_id,
      subschedule_id,
      seat_availability_id,
      booking_date,
      total_passengers,
      adult_passengers,
      child_passengers,
      infant_passengers,
      status,
      follow_up_notes,
      follow_up_date,
      last_contact_date,
      updated_at: new Date()
    };

    // Remove undefined values
    Object.keys(updatedData).forEach(key => {
      if (updatedData[key] === undefined) {
        delete updatedData[key];
      }
    });

    await waitingList.update(updatedData);

    // Get the updated record with associations
    const updatedWaitingList = await WaitingList.findByPk(id, {
      include: [
        { model: Schedule, as: 'WaitingListSchedule' },
        { model: SubSchedule, as: 'WaitingListSubSchedule' },
        { model: SeatAvailability, as: 'WaitingListSeatAvailability' }
      ]
    });

    return res.status(200).json({
      success: true,
      data: updatedWaitingList
    });
  } catch (error) {
    console.error('Error updating waiting list:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// Delete a waiting list entry
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const waitingList = await WaitingList.findByPk(id);
    if (!waitingList) {
      return res.status(404).json({ 
        success: false,
        message: 'Waiting list entry not found' 
      });
    }

    await waitingList.destroy();

    return res.status(200).json({
      success: true,
      message: 'Waiting list entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting waiting list:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// Update status and add follow-up
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, follow_up_notes, follow_up_date } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false,
        message: 'Status is required' 
      });
    }

    const waitingList = await WaitingList.findByPk(id);
    if (!waitingList) {
      return res.status(404).json({ 
        success: false,
        message: 'Waiting list entry not found' 
      });
    }

    const updateData = {
      status,
      updated_at: new Date(),
      last_contact_date: new Date()
    };

    if (follow_up_notes) {
      updateData.follow_up_notes = waitingList.follow_up_notes 
        ? `${waitingList.follow_up_notes}\n\n${new Date().toISOString().split('T')[0]}: ${follow_up_notes}`
        : `${new Date().toISOString().split('T')[0]}: ${follow_up_notes}`;
    }

    if (follow_up_date) {
      updateData.follow_up_date = follow_up_date;
    }

    await waitingList.update(updateData);

    // Get the updated record with associations
    const updatedWaitingList = await WaitingList.findByPk(id, {
      include: [
        { model: Schedule, as: 'WaitingListSchedule' },
        { model: SubSchedule, as: 'WaitingListSubSchedule' },
        { model: SeatAvailability, as: 'WaitingListSeatAvailability' }
      ]
    });

    return res.status(200).json({
      success: true,
      data: updatedWaitingList
    });
  } catch (error) {
    console.error('Error updating waiting list status:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// Get waiting list entries with upcoming follow-up dates
exports.getUpcomingFollowUps = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const waitingLists = await WaitingList.findAll({
      where: {
        follow_up_date: {
          [Op.gte]: today
        },
        status: {
          [Op.notIn]: ['cancelled', 'booked']
        }
      },
      include: [
        { model: Schedule, as: 'WaitingListSchedule' },
        { model: SubSchedule, as: 'WaitingListSubSchedule' },
        { model: SeatAvailability, as: 'WaitingListSeatAvailability' }
      ],
      order: [['follow_up_date', 'ASC']]
    });
    return res.status(200).json({
      success: true,
      count: waitingLists.length,
      data: waitingLists
    });
  } catch (error) {
    console.error('Error fetching upcoming follow-ups:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};;