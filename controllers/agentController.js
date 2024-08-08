// const { sequelize } = require('../config/database'); // Pastikan jalur impor benar
const { Agent,Boat, AgentMetrics,Booking,sequelize,Destination ,Schedule,Transport,Passenger,TransportBooking,AgentCommission} = require('../models'); // Pastikan jalur impor benar
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { uploadImageToImageKit } = require('../middleware/uploadImage');


exports.loginAgent = async (req, res) => {
    try {
        const { email, password } = req.body;
        const agent = await Agent.findOne({ where: { email } });
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        // Compare the hashed password
        const isMatch = await bcrypt.compare(password, agent.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        res.status(200).json({ message: 'Login successful', agent: agent.dataValues });
    } catch (error) {
        console.error('Error during agent login:', error.message);
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

        const resetLink = `http://localhost:3000/agent/change-password/${resetToken}`;

        // Send reset link via email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
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
// EMAIL_USER =bajuboss21@gmail.com
// EMAIL_PASSWORD =sxnuexolgfzvbbjm

exports.updateAgent = async (req, res) => {
    console.log('Agent update request received:', req.body);
    
    // Start transaction
    const t = await sequelize.transaction();
    try {
      const agentId = req.params.id;
      if (!agentId) {
        console.log('Error: Agent ID not provided');
        await t.rollback();
        return res.status(400).json({ message: 'Agent ID not provided' });
      }
      
      console.log('Updating agent ID:', agentId);
  
      // Fetch agent by primary key
      const agent = await Agent.findByPk(agentId, { transaction: t });
      console.log(agent ? `Agent found: ${agentId}` : `No agent found with ID: ${agentId}`);
  
      if (!agent) {
        console.log('Error: Agent not found');
        await t.rollback();
        return res.status(404).json({ message: 'Agent not found' });
      }
  
      const agentData = req.body || {};
  
      if (req.file && req.file.url) {
        agentData.image_url = req.file.url;
        console.log('Uploaded image URL:', agentData.image_url);
      }
  
      // Attempt to update the agent
      await agent.update(agentData, { transaction: t });
      console.log('Agent update successful:', agent.dataValues);
      
      // Commit transaction
      await t.commit();
      
      return res.status(200).json({
        message: 'Agent updated and image uploaded',
        data: agent.dataValues
      });
    } catch (error) {
      console.log('Error during update process:', error);
      await t.rollback();
      
      // Log the entire error object if possible
      console.error('Detailed Error:', error);
      
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  };


exports.deleteAgent = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const agentId = req.params.id;

        // Delete the related AgentMetrics first
        const deletedMetrics = await AgentMetrics.destroy({
            where: { agent_id: agentId },
            transaction
        });

        // Delete the agent
        const deletedAgent = await Agent.destroy({
            where: { id: agentId },
            transaction
        });

        if (deletedAgent) {
            console.log(`Agent with ID: ${agentId} and its metrics deleted`);
            await transaction.commit();
            res.status(200).json({ message: 'Agent and its metrics deleted' });
        } else {
            console.log(`Agent with ID: ${agentId} not found`);
            await transaction.rollback();
            res.status(404).json({ message: 'Agent not found' });
        }
    } catch (error) {
        console.log(`Error deleting agent with ID: ${req.params.id}`, error.message);
        await transaction.rollback();
        res.status(500).json({ message: error.message });
    }
};


// Function to generate a random password
const generateRandomPassword = (length) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
};

exports.createAgent = async (req, res) => {
    console.log('req body:', req.body);
    const transaction = await sequelize.transaction();

    try {
        console.log('Data received for creating agent:', req.body);

        // Generate random password
        const randomPassword = generateRandomPassword(10);
        console.log('Generated random password:', randomPassword);

        let imageUrl = null;

        if (req.file) {
            // Upload image and get the URL
            imageUrl = req.file.url;
            console.log('Uploaded image URL:', imageUrl);
        }

        // Create the agent with the generated password and optional image URL
        const agentData = { ...req.body, password: randomPassword, image_url: imageUrl };
        console.log('Agent data to be created:', agentData);

        const agent = await Agent.create(agentData, { transaction });
        if (!agent) {
            throw new Error('Failed to create agent');
        }
        console.log('Agent created with ID:', agent.id);

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
        if (!agentMetrics) {
            throw new Error('Failed to create agent metrics');
        }
        console.log('AgentMetrics created with agent_id:', agentMetrics.agent_id);

        // Commit the transaction
        await transaction.commit();

        // Return the agent and the random password
        console.log('Returning agent and random password');
        res.status(201).json({
            agent: {
                id: agent.id,
                name: agent.name,
                email: agent.email,
                phone: agent.phone,
                commission_rate: agent.commission_rate,
                address: agent.address,
                image_url: agent.image_url,
                created_at: agent.created_at,
                updated_at: agent.updated_at
            },
            randomPassword: randomPassword
        });
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();

        console.log('Error creating agent:', error.message);
        res.status(500).json({ message: error.message });
    }
};
// Get all agents



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
                                },
                             

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
                        },
                        {
                            model: AgentCommission,
                            as: 'agentCommissions'
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
// Delete agent
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


// Function to create an agent
// exports.createAgent = async (req, res) => {
//     console.log('req body:', req.body);
//     const transaction = await sequelize.transaction();
  
//     try {
//         console.log('Data received for creating agent:', req.body);
  
//         // Generate random password
//         const randomPassword = generateRandomPassword(10);
//         console.log('Generated random password:', randomPassword);
  
//         let imageUrl = null;
  
//         if (req.file) {
//             // Upload image and get the URL
//             imageUrl = req.file.url;
//             console.log('Uploaded image URL:', imageUrl);
//         }
  
//         // Create the agent with the generated password and optional image URL
//         const agentData = { ...req.body, password: randomPassword, image_url: imageUrl };
//         console.log('Agent data to be created:', agentData);
  
//         const agent = await Agent.create(agentData, { transaction });
//         console.log('Agent created with ID:', agent.id);
  
//         // Create corresponding AgentMetrics entry
//         const agentMetrics = await AgentMetrics.create({
//             agent_id: agent.id,
//             total_revenue: 0.00,
//             total_customers: 0,
//             total_bookings: 0,
//             gross_revenue: 0.00,
//             net_profit: 0.00,
//             gross_pending_payment: 0.00,
//             net_pending_profit: 0.00,
//             unpaid_payment: 0.00,
//             pending_payment: 0.00,
//             outstanding: 0.00,
//             payout: 0.00
//         }, { transaction });
//         console.log('AgentMetrics created with ID:', agentMetrics.id);
  
//         // Commit the transaction
//         await transaction.commit();
  
//         // Return the agent and the random password
//         console.log('Returning agent and random password');
//         res.status(201).json({
//             agent: {
//                 id: agent.id,
//                 name: agent.name,
//                 email: agent.email,
//                 phone: agent.phone,
//                 commission_rate: agent.commission_rate,
//                 address: agent.address,
//                 image_url: agent.image_url,
//                 created_at: agent.created_at,
//                 updated_at: agent.updated_at
//             },
//             randomPassword: randomPassword
//         });
//     } catch (error) {
//         // Rollback the transaction in case of error
//         await transaction.rollback();
  
//         console.log('Error creating agent:', error.message);
//         res.status(500).json({ message: error.message });
//     }
// };
// exports.updateAgent = async (req, res) => {
//     try {
//       const [updated] = await Agent.update(req.body, {
//         where: { id: req.params.id }
//       });
  
//       if (updated) {
//         const updatedAgent = await Agent.findByPk(req.params.id);
//         res.status(200).json(updatedAgent);
//       } else {
//         res.status(404).json({ message: 'Agent not found' });
//       }
//     } catch (error) {
//       res.status(500).json({ message: error.message });
//     }
//   };
  