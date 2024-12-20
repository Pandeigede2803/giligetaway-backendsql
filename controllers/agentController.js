// const { sequelize } = require('../config/database'); // Pastikan jalur impor benar
const {
  Agent,
  Boat,
  AgentMetrics,
  Booking,
  sequelize,
  Destination,
  Schedule,
  Transport,
  Passenger,
  TransportBooking,
  AgentCommission,
} = require("../models"); // Pastikan jalur impor benar
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");


exports.createAgent = async (req, res) => {
  console.log("req body:", req.body);
  const transaction = await sequelize.transaction();

  try {
    console.log("Data received for creating agent:", req.body);

    // Generate random password
    const randomPassword = generateRandomPassword(10);
    console.log("Generated random password:", randomPassword);

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    console.log("Hashed password:", hashedPassword);

    // Set image URL
    let imageUrl = req.file ? req.file.url : 'https://ik.imagekit.io/m1akscp5q/Person-placeholder.jpg?updatedAt=1732263814558';
    console.log("Image URL to be used:", imageUrl);

    // Create the agent with the hashed password and image URL
    const agentData = {
      ...req.body,
      password: hashedPassword, // Store hashed password
      image_url: imageUrl, // Use uploaded image or default image
    };
    console.log("Agent data to be created:", agentData);

    const agent = await Agent.create(agentData, { transaction });
    if (!agent) {
      throw new Error("Failed to create agent");
    }
    console.log("Agent created with ID:", agent.id);

    // Commit the transaction
    await transaction.commit();

    // Return the agent and the random password
    console.log("Returning agent and random password");
    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        commission_rate: agent.commission_rate,
        commission_long: agent.commission_long,
        commission_short: agent.commission_short,
        commission_long_transport: agent.commission_long_transport,
        commission_short_transport: agent.commission_short_transport,
        address: agent.address,
        image_url: agent.image_url,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
      randomPassword: randomPassword, // Return the plain random password for admin use
    });
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();

    console.log("Error creating agent:", error.message);
    res.status(500).json({ message: error.message });
  }
};
// exports.createAgent = async (req, res) => {
//   console.log("req body:", req.body);
//   const transaction = await sequelize.transaction();

//   try {
//     console.log("Data received for creating agent:", req.body);

//     // Generate random password
//     const randomPassword = generateRandomPassword(10);
//     console.log("Generated random password:", randomPassword);

//     let imageUrl = null;

//     if (req.file) {
//       // Upload image and get the URL
//       imageUrl = req.file.url;
//       console.log("Uploaded image URL:", imageUrl);
//     }

//     // Create the agent with the generated password and optional image URL
//     const agentData = {
//       ...req.body,
//       password: randomPassword,
//       image_url: imageUrl,
//     };
//     console.log("Agent data to be created:", agentData);

//     const agent = await Agent.create(agentData, { transaction });
//     if (!agent) {
//       throw new Error("Failed to create agent");
//     }
//     console.log("Agent created with ID:", agent.id);

//     // Create corresponding AgentMetrics entry
//     // const agentMetrics = await AgentMetrics.create(
//     //   {
//     //     agent_id: agent.id,
//     //     total_revenue: 0.0,
//     //     total_customers: 0,
//     //     total_bookings: 0,
//     //     gross_revenue: 0.0,
//     //     net_profit: 0.0,
//     //     gross_pending_payment: 0.0,
//     //     net_pending_profit: 0.0,
//     //     unpaid_payment: 0.0,
//     //     pending_payment: 0.0,
//     //     outstanding: 0.0,
//     //     payout: 0.0,
//     //   },
//     //   { transaction }
//     // );
//     // if (!agentMetrics) {
//     //   throw new Error("Failed to create agent metrics");
//     // }
//     // console.log("AgentMetrics created with agent_id:", agentMetrics.agent_id);

//     // Commit the transaction
//     await transaction.commit();

//     // Return the agent and the random password
//     console.log("Returning agent and random password");
//     res.status(201).json({
//       agent: {
//         id: agent.id,
//         name: agent.name,
//         email: agent.email,
//         phone: agent.phone,
//         commission_rate: agent.commission_rate,
//         commission_long: agent.commission_long,
//         commission_short: agent.commission_short,
//         commission_long_transport: agent.commission_long_transport,
//         commission_short_transport: agent.commission_short_transport,
//         address: agent.address,
//         image_url: agent.image_url,
//         created_at: agent.created_at,
//         updated_at: agent.updated_at,
//       },
//       randomPassword: randomPassword,
//     });
//   } catch (error) {
//     // Rollback the transaction in case of error
//     await transaction.rollback();

//     console.log("Error creating agent:", error.message);
//     res.status(500).json({ message: error.message });
//   }
// };
exports.loginAgent = async (req, res) => {
  try {
    const { email, password } = req.body;
    const agent = await Agent.findOne({ where: { email } });
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Compare the hashed password
    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: agent.id, email: agent.email }, // payload
      process.env.JWT_SECRET, // secret key
      { expiresIn: "1h" } // expiration time
    );

    res.status(200).json({
      message: "Login successful",
      agent: agent.dataValues,
      token: token, // return the token
    });
  } catch (error) {
    console.error("Error during agent login:", error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.requestPasswordResetLink = async (req, res) => {
  const { email } = req.body;
  console.log("Password reset request received for email:", email);
  try {
    const agent = await Agent.findOne({ where: { email } });
    if (!agent) {
      console.log("Agent not found for email:", email);
      return res.status(404).json({ message: "Agent not found" });
    }

    // Generate a JWT for the reset link
    const resetToken = jwt.sign(
      { id: agent.id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Token expires in 1 hour
    );
    console.log("Generated reset token for agent ID:", agent.id);

    const resetLink = `${process.env.FRONTEND_URL}/agent/change-password/${resetToken}`;
    console.log("Password reset link generated:", resetLink);

    // Send reset link via email
    const transporter = nodemailer.createTransport({
      host: 'mail.headlessexploregilis.my.id',  // SMTP Server
      port: 465,  // Gunakan port 465 untuk SSL
      secure: true, // true karena kita menggunakan SSL
      auth: {
         user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
      },
    });
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: agent.email,
      subject: "Password Reset Request",
      text: `Please click on the following link to reset your password: ${resetLink}`,
      html: `<p>Please click on the link below to reset your password:</p><p><a href="${resetLink}">reset your password</a></p>`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("Error sending email:", error);
        return res.status(500).json({ message: "Error sending reset link" });
      } else {
        console.log("Email sent successfully to:", agent.email);
        console.log("SMTP response:", info.response);
        res.status(200).json({ message: "Reset link sent to your email." });
      }
    });
  } catch (error) {
    console.error("Error requesting password reset link:", error.message);
    res.status(500).json({ message: error.message });
  }
};
// EMAIL_USER =bajuboss21@gmail.com
// EMAIL_PASSWORD =sxnuexolgfzvbbjm

exports.updateAgent = async (req, res) => {
  console.log("Agent update request received:", req.body);

  // Start transaction
  const t = await sequelize.transaction();
  try {
    const agentId = req.params.id;
    if (!agentId) {
      console.log("Error: Agent ID not provided");
      await t.rollback();
      return res.status(400).json({ message: "Agent ID not provided" });
    }

    console.log("Updating agent ID:", agentId);

    // Fetch agent by primary key
    const agent = await Agent.findByPk(agentId, { transaction: t });
    console.log(
      agent ? `Agent found: ${agentId}` : `No agent found with ID: ${agentId}`
    );

    if (!agent) {
      console.log("Error: Agent not found");
      await t.rollback();
      return res.status(404).json({ message: "Agent not found" });
    }

    const agentData = req.body || {};

    if (req.file && req.file.url) {
      agentData.image_url = req.file.url;
      console.log("Uploaded image URL:", agentData.image_url);
    }

    // Attempt to update the agent
    await agent.update(agentData, { transaction: t });
    console.log("Agent update successful:", agent.dataValues);

    // Commit transaction
    await t.commit();

    return res.status(200).json({
      message: "Agent updated and image uploaded",
      data: agent.dataValues,
    });
  } catch (error) {
    console.log("Error during update process:", error);
    console.error("Detailed Error:", error);

    await t.rollback();

    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.deleteAgent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const agentId = req.params.id;

    // Delete the related AgentMetrics first
    const deletedMetrics = await AgentMetrics.destroy({
      where: { agent_id: agentId },
      transaction,
    });

    // Delete the agent
    const deletedAgent = await Agent.destroy({
      where: { id: agentId },
      transaction,
    });

    if (deletedAgent) {
      console.log(`Agent with ID: ${agentId} and its metrics deleted`);
      await transaction.commit();
      res.status(200).json({ message: "Agent and its metrics deleted" });
    } else {
      console.log(`Agent with ID: ${agentId} not found`);
      await transaction.rollback();
      res.status(404).json({ message: "Agent not found" });
    }
  } catch (error) {
    console.log(
      `Error deleting agent with ID: ${req.params.id}`,
      error.message
    );
    await transaction.rollback();
    res.status(500).json({ message: error.message });
  }
};

// Function to generate a random password
const generateRandomPassword = (length) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};


// Get all agents

exports.getAllAgents = async (req, res) => {
  try {
    const agents = await Agent.findAll({
      include: [
        {
          model: Booking,
          as: "bookings",
          include: [
            {
              model: Schedule,
              as: "schedule",
              include: [
                {
                  model: Destination,
                  as: "FromDestination",
                },
                {
                  model: Destination,
                  as: "ToDestination",
                },
                {
                  model: Boat,
                  as: "Boat",
                },
              ],
            },
            {
              model: Passenger,
              as: "passengers",
            },
            {
              model: TransportBooking,
              as: "transportBookings",
              include: [
                {
                  model: Transport,
                  as: "transport",
                },
              ],
            },
          ],
        },
        {
          model: AgentMetrics,
          as: "agentMetrics",
        },
      ],
    });
    console.log("All agents retrieved:", agents);
    res.status(200).json(agents);
  } catch (error) {
    console.log("Error retrieving agents:", error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id, {
      include: [
        {
          model: Booking,
          as: "bookings",
          include: [
            {
              model: Schedule,
              as: "schedule",
              include: [
                {
                  model: Destination,
                  as: "FromDestination",
                },
                {
                  model: Destination,
                  as: "ToDestination",
                },
                {
                  model: Boat,
                  as: "Boat",
                },
              ],
            },
            {
              model: Passenger,
              as: "passengers",
            },
            {
              model: TransportBooking,
              as: "transportBookings",
              include: [
                {
                  model: Transport,
                  as: "transport",
                },
              ],
            },
            {
              model: AgentCommission,
              as: "agentCommissions",
            },
          ],
        },
        {
          model: AgentMetrics,
          as: "agentMetrics",
        },
      ],
    });

    if (agent) {
      console.log("Agent retrieved:", agent);
      res.status(200).json(agent);
    } else {
      console.log("Agent not found:", req.params.id);
      res.status(404).json({ message: "Agent not found" });
    }
  } catch (error) {
    console.log("Error retrieving agent:", error.message);
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
      transaction,
    });

    // Hapus semua entri di Agents
    await Agent.destroy({
      where: {},
      transaction,
    });

    // Commit the transaction
    await transaction.commit();

    console.log("All agents and their metrics deleted");
    res.status(204).json({ message: "All agents and their metrics deleted" });
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();

    console.log(
      "Error deleting all agents and resetting metrics:",
      error.message
    );
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
      return res.status(404).json({ message: "Agent not found" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    agent.password = hashedPassword;
    await agent.save();

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Error resetting password:", error.message);
    res.status(500).json({ message: error.message });
  }
};
