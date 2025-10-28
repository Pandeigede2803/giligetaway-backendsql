// controllers/emailSendLogController.js
const { EmailSendLog, CustomEmailSchedulers } = require('../models');

/**
 * Get all email send logs
 */
exports.getAllLogs = async (req, res) => {
  try {
    const logs = await EmailSendLog.findAll({
      order: [['sent_at', 'DESC']],
      include: [
        {
          model: CustomEmailSchedulers,
          as: 'Scheduler',
          attributes: ['id', 'name', 'subject']
        }
      ]
    });

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email logs',
      error
    });
  }
};

/**
 * Get a single log by ID
 */
exports.getLogById = async (req, res) => {
  try {
    const log = await EmailSendLog.findByPk(req.params.id, {
      include: [
        {
          model: CustomEmailSchedulers,
          as: 'Scheduler',
          attributes: ['id', 'name', 'subject', 'body']
        }
      ]
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log not found'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching log',
      error
    });
  }
};

/**
 * Create log manually (for testing purposes)
 */
exports.createLog = async (req, res) => {
  try {
    const { scheduler_id, booking_id, sent_to } = req.body;

    if (!scheduler_id || !booking_id || !sent_to) {
      return res.status(400).json({
        success: false,
        message: 'scheduler_id, booking_id, and sent_to are required'
      });
    }

    const log = await EmailSendLog.create({
      scheduler_id,
      booking_id,
      sent_to
    });

    res.json({
      success: true,
      message: 'Log created successfully',
      data: log
    });
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating log',
      error
    });
  }
};

/**
 * Delete a specific log
 */
exports.deleteLog = async (req, res) => {
  try {
    const log = await EmailSendLog.findByPk(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log not found'
      });
    }

    await log.destroy();

    res.json({
      success: true,
      message: 'Log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting log:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting log',
      error
    });
  }
};

/**
 * Clear all logs (admin only - use with caution)
 */
exports.clearAllLogs = async (req, res) => {
  try {
    const deletedCount = await EmailSendLog.destroy({
      where: {},
      truncate: true
    });

    res.json({
      success: true,
      message: `All email logs cleared successfully. ${deletedCount} records deleted.`,
      deletedCount
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing logs',
      error
    });
  }
};
