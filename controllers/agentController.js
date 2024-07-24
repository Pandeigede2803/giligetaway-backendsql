// const { sequelize } = require('../config/database'); // Pastikan jalur impor benar
const { Agent,Boat, AgentMetrics,Booking,sequelize,Destination ,Schedule,Transport,Passenger,TransportBooking} = require('../models'); // Pastikan jalur impor benar
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Setup your mail transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Get all agents

// Login Route
exports.loginAgent = async (req, res) => {
    try {
        const { email, password } = req.body;
        const agent = await Agent.findOne({ where: { email } });
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        if (agent.password !== password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        res.status(200).json({ message: 'Login successful', agent: agent.dataValues });
    } catch (error) {
        console.error('Error during agent login:', error.message);
        res.status(500).json({ message: error.message });
    }
};

exports.getAllAgents = async (req, res) => {
    try {
        const agents = await Agent.findAll({
            include: [
                {
                    model: Booking,
                    as: 'bookings',
                    include: [
                        {
                            model: Schedule,
                            as: 'schedule',
                            include: [
                                {
                                    model: Destination,
                                    as: 'FromDestination'
                                },
                                {
                                    model: Destination,
                                    as: 'ToDestination'
                                },
                                {
                                    model: Boat,
                                    as: 'Boat'
                                }
                            ]
                        },
                        {
                            model: Passenger,
                            as: 'passengers'
                        },
                        {
                            model: TransportBooking,
                            as: 'transportBookings',
                            include: [
                                {
                                    model: Transport,
                                    as: 'transport'
                                }
                            ]
                        }
                    ]
                },
                {
                    model: AgentMetrics,
                    as: 'agentMetrics'
                }
            ]
        });
        console.log('All agents retrieved:', agents);
        res.status(200).json(agents);
    } catch (error) {
        console.log('Error retrieving agents:', error.message);
        res.status(500).json({ message: error.message });
    }
}

exports.getAgentById = async (req, res) => {
    try {
        const agent = await Agent.findByPk(req.params.id, {
            include: [
                {
                    model: Booking,
                    as: 'bookings',
                    include: [
                        {
                            model: Schedule,
                            as: 'schedule',
                            include: [
                                {
                                    model: Destination,
                                    as: 'FromDestination'
                                },
                                {
                                    model: Destination,
                                    as: 'ToDestination'
                                },
                                {
                                    model:Boat,
                                    as: 'Boat',
                                }


                            ]
                        },
                        {
                            model: Passenger,
                            as: 'passengers'
                        },
                        {
                            model: TransportBooking,
                            as: 'transportBookings',
                            include: [
                                {
                                    model: Transport,
                                    as: 'transport'
                                }
                            ]
                        }
                    ]
                },
                {
                    model: AgentMetrics,
                    as: 'agentMetrics'
                }
            ]
        });

        if (agent) {
            console.log('Agent retrieved:', agent);
            res.status(200).json(agent);
        } else {
            console.log('Agent not found:', req.params.id);
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log('Error retrieving agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};


// Create agent
exports.createAgent = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        console.log('Data received for creating agent:', req.body);

        // Create the agent
        const agent = await Agent.create(req.body, { transaction });
        console.log('Agent created:', agent);

        // Create corresponding AgentMetrics entry
        const agentMetrics = await AgentMetrics.create({
            agent_id: agent.id,
            total_revenue: 0.00,
            total_customers: 0,
            total_bookings: 0,
            gross_revenue: 0.00,
            net_profit: 0.00,
            gross_pending_payment: 0.00,
            net_pending_profit: 0.00,
            unpaid_payment: 0.00,
            pending_payment: 0.00,
            outstanding: 0.00,
            payout: 0.00
        }, { transaction });
        console.log('AgentMetrics created:', agentMetrics);

        // Commit the transaction
        await transaction.commit();

        res.status(201).json(agent);
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();

        console.log('Error creating agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Update agent
exports.updateAgent = async (req, res) => {
    try {
        const [updated] = await Agent.update(req.body, {
            where: { id: req.params.id }
        });
        if (updated) {
            const updatedAgent = await Agent.findByPk(req.params.id);
            console.log('Agent updated:', updatedAgent);
            res.status(200).json(updatedAgent);
        } else {
            console.log('Agent not found:', req.params.id);
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log('Error updating agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Delete agent
exports.deleteAgent = async (req, res) => {
    try {
        const deleted = await Agent.destroy({
            where: { id: req.params.id }
        });
        if (deleted) {
            console.log('Agent deleted:', req.params.id);
            res.status(204).json({ message: 'Agent deleted' });
        } else {
            console.log('Agent not found:', req.params.id);
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log('Error deleting agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};


exports.deleteAllAgentsAndResetMetrics = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Hapus semua entri di AgentMetrics
        await AgentMetrics.destroy({
            where: {},
            transaction
        });

        // Hapus semua entri di Agents
        await Agent.destroy({
            where: {},
            transaction
        });

        // Commit the transaction
        await transaction.commit();

        console.log('All agents and their metrics deleted');
        res.status(204).json({ message: 'All agents and their metrics deleted' });
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();

        console.log('Error deleting all agents and resetting metrics:', error.message);
        res.status(500).json({ message: error.message });
    }
};



exports.requestPasswordResetLink = async (req, res) => {
    const { email } = req.body;
    try {
        const agent = await Agent.findOne({ where: { email } });
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        // Generate a JWT for the reset link
        const resetToken = jwt.sign(
            { id: agent.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        const resetLink = `http://localhost:3000/signin/reset-password/${resetToken}`;

        // Send reset link via email
        const mailOptions = {
            from: 'yourEmail@example.com',
            to: agent.email,
            subject: 'Password Reset Request',
            text: `Please click on the following link to reset your password: ${resetLink}`,
            html: `<p>Please click on the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
        };

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending reset link' });
            } else {
                console.log('Email sent:', info.response);
                res.status(200).json({ message: 'Reset link sent to your email.' });
            }
        });

    } catch (error) {
        console.error('Error requesting password reset link:', error.message);
        res.status(500).json({ message: error.message });
    }
};


exports.resetPasswordWithToken = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        // Decode the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const agent = await Agent.findByPk(decoded.id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        agent.password = hashedPassword;
        await agent.save();

        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('Error resetting password:', error.message);
        res.status(500).json({ message: error.message });
    }
};
