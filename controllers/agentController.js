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
const { Resend } = require("resend");



// Configure Nodemailer
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST, // SMTP Server (e.g., smtp.gmail.com)
//   port: 465, // Use port 465 for SSL
//   secure: true, // Use SSL
//   auth: {
//     user: process.env.EMAIL_USER, // Your email
//     pass: process.env.EMAIL_PASSWORD, // Your email password or app password
//   },
// });

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_GMAIL, // SMTP Server (e.g., smtp.gmail.com)
  port: process.env.EMAIL_PORT_GMAIL, // Use port 465 for SSL
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER_GMAIL, // Your email
    pass: process.env.EMAIL_PASS_GMAIL, // Your email password or app password
  },
});

exports.createAgent = async (req, res) => {
  console.log("📩 Creating new agent:", req.body);
  const transaction = await sequelize.transaction();

  try {
    // Generate password acak
    const randomPassword = generateRandomPassword(10);
    console.log("🔑 Generated Password:", randomPassword);

    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    console.log("🔐 Hashed Password:", hashedPassword);

    // Tentukan URL gambar
    let imageUrl = req.file ? req.file.url : 'https://ik.imagekit.io/m1akscp5q/Person-placeholder.jpg?updatedAt=1732263814558';
    console.log("🖼️ Image URL:", imageUrl);

    // Membuat data agen
    const agentData = {
      ...req.body,
      password: hashedPassword, // Menyimpan password yang sudah di-hash
      image_url: imageUrl, // Menyimpan gambar atau gambar default
    };
    console.log("📝 Agent Data:", agentData);

    // Menyimpan agen ke database
    const agent = await Agent.create(agentData, { transaction });
    if (!agent) {
      throw new Error("❌ Failed to create agent");
    }
    console.log("✅ Agent Created: ID =", agent.id);

    // ✅ Mengirim email dengan kredensial login
    const mailOptions = {
      from: `Gili Getaway <${process.env.EMAIL_USER}>`,
      to: agent.email,
      subject: 'Your Gili Getaway Agent Account Details',
      html: `
        <h2>Welcome to Gili Getaway!</h2>
        <p>Dear ${agent.name},</p>
        <p>Your agent account has been successfully created. Below are your login details:</p>
        <ul>
          <li><strong>Email:</strong> ${agent.email}</li>
          <li><strong>Temporary Password:</strong> ${randomPassword}</li>
        </ul>
        <p>🔒 Please log in and change your password immediately for security purposes.</p>
        <p>Login here: <a href="https://giligetaway-widget.my.id/agent">Gili Getaway Agent Login</a></p>
        <p>Best regards,<br>Gili Getaway Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to:", agent.email);

    // Commit transaksi setelah agen dibuat dan email berhasil dikirim
    await transaction.commit();

    // Mengembalikan detail agen (tanpa password untuk keamanan)
    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        contact_person: agent.contact_person || "unknown",
        commission_rate: agent.commission_rate || 0,
        commission_long: agent.commission_long || 0,
        commission_short: agent.commission_short || 0,
        commission_long_transport: agent.commission_long_transport || 0,
        commission_short_transport: agent.commission_short_transport || 0,
        address: agent.address,
        image_url: agent.image_url,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
      message: "Agent created successfully. Credentials sent via email.",
    });

  } catch (error) {
    // Rollback transaksi jika terjadi error sebelum commit
    await transaction.rollback();
    console.error("❌ Error creating agent:", error.message);

    res.status(500).json({ message: error.message });
  }
}


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
    console.log("Creating transporter with email host:", process.env.EMAIL_HOST);
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      logger: true,
      debug: true, // show debug output
    });
    


    const mailOptions = {
      from: "Gili Getaway System <" + process.env.EMAIL_USER + ">",
      to: agent.email,
      subject: "Password Reset Request",
      text: `Please click on the following link to reset your password: ${resetLink}`,
      html: `<p>Please click on the link below to reset your password:</p><p><a href="${resetLink}">reset your password</a></p>`,
    };

    // Gili Getaway <onboarding@resend.dev>
     // Try sending email via SMTP

// 4️⃣ Coba kirim email menggunakan SMTP
transporter.sendMail(mailOptions, async (error, info) => {
  if (error) {
    console.log("❌ SMTP email sending failed. Trying Resend API...");
    
    // 5️⃣ Jika SMTP gagal, coba kirim dengan Resend API
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const resendResponse = await resend.emails.send({
        from: "Gili Getaway<onboarding@resend.dev>", // ✅ HARUS PAKAI DOMAIN VERIFIED
        to: agent.email,
        subject: "Password Reset Request",
        html: `<p>Hello ${agent.name},</p>
               <p>You requested a password reset. Click the link below to reset your password:</p>
               <p><a href="${resetLink}">Reset your password</a></p>
               <p>If you did not request this, please ignore this email.</p>`,
      });

      // ✅ Cek apakah email berhasil dikirim via Resend
      if (resendResponse?.data?.id) {
        console.log("✅ Email sent successfully via Resend API to:", agent.email);
        return res.status(200).json({ message: "Reset link sent to your email." });
      } else {
        console.error("❌ Failed to send email via Resend API:", resendResponse);
        return res.status(500).json({ message: "Error sending reset link." });
      }
    } catch (resendError) {
      console.log("🔥 Resend API failed:", resendError);
      return res.status(500).json({ message: "Error sending reset link via both SMTP and Resend API." });
    }
  } else {
    console.log("✅ Email sent successfully via SMTP to:", agent.email);
    console.log("📩 SMTP response:", info.response);
    return res.status(200).json({ message: "Reset link sent to your email." });
  }
});
} catch (error) {
console.error("🔥 Error requesting password reset link:", error.message);
return res.status(500).json({ message: "Internal server error." });
}
};
//     transporter.sendMail(mailOptions, function (error, info) {
//       if (error) {
//         console.log("Error sending email:", error);
//         return res.status(500).json({ message: "Error sending reset link" });
//       } else {
//         console.log("Email sent successfully to:", agent.email);
//         console.log("SMTP response:", info.response);
//         res.status(200).json({ message: "Reset link sent to your email." });
//       }
//     });
//   } catch (error) {
//     console.error("Error requesting password reset link:", error.message);
//     res.status(500).json({ message: error.message });
//   }
// };
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

    // Check if the agent exists
    const agent = await Agent.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      console.log(`Agent with ID: ${agentId} not found`);
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Agent with ID ${agentId} not found`,
      });
    }

    // Check if the agent has associated bookings
    const associatedBookings = await Booking.findOne({
      where: { agent_id: agentId },
    });

    if (associatedBookings) {
      console.log(
        `Agent with ID: ${agentId} cannot be deleted because it has associated bookings`
      );
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Agent with ID ${agentId} cannot be deleted because it has associated bookings. Please remove the bookings first.`,
      });
    }

    // Delete associated AgentMetrics first
    const deletedMetrics = await AgentMetrics.destroy({
      where: { agent_id: agentId },
      transaction,
    });
    console.log(
      `Deleted ${deletedMetrics} metrics associated with Agent ID: ${agentId}`
    );

    // Delete the agent
    const deletedAgent = await Agent.destroy({
      where: { id: agentId },
      transaction,
    });

    if (deletedAgent) {
      console.log(`Agent with ID: ${agentId} and its metrics deleted`);
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: `Agent with ID ${agentId} and its metrics have been deleted successfully`,
      });
    } else {
      console.log(`Agent with ID: ${agentId} not found for deletion`);
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Agent with ID ${agentId} not found for deletion`,
      });
    }
  } catch (error) {
    console.log(`Error deleting agent with ID: ${req.params.id}`, error.message);

    // Check if the error is related to database constraints
    if (error.name === "SequelizeForeignKeyConstraintError") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Agent with ID ${req.params.id} cannot be deleted because it has associated bookings or other.`,
      });
    }

    // Handle other errors
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `An error occurred while deleting the agent: ${error.message}`,
    });
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
              as: "agentCommission",
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

// controllers/agentCsvController.js

const fs = require("fs");
const { parse } = require("fast-csv");

/**
 * Fungsi helper untuk parse CSV
 * @param {string} filePath - Path fisik file CSV yang di-upload
 * @returns {Promise<Array>} - Mengembalikan array data dari CSV
 */
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(parse({ headers: true })) // Parse CSV dengan header sebagai kunci
      .on("error", (error) => reject(error)) // Tangani error saat parsing
      .on("data", (data) => rows.push(data)) // Tambahkan data ke array rows
      .on("end", () => resolve(rows)); // Resolusi promise setelah parsing selesai
  });
}

/**
 * Controller to handle CSV upload for agents
//  */
// exports.uploadAgentCsv = async (req, res) => {
//   const filePath = req.file?.path; // Lokasi file dari multer

//   try {
//     // 1. Validasi apakah file ada
//     if (!req.file) {
//       return res
//         .status(400)
//         .json({ success: false, error: "No CSV file uploaded" });
//     }

//     // 2. Parse CSV menggunakan fungsi helper
//     const agentsData = await parseCsvFile(filePath);

//     // 3. Insert data ke database
//     let insertedCount = 0;
//     const skippedRows = []; // Untuk mencatat baris yang dilewati karena error atau tidak valid

//     for (let i = 0; i < agentsData.length; i++) {
//       const row = agentsData[i];

//       // Validasi data
//       if (!row.name || !row.email) {
//         skippedRows.push({ row: i + 1, reason: "Missing name or email" });
//         continue;
//       }

//       // Cek apakah name sudah ada
//       const existingAgent = await Agent.findOne({ where: { name: row.name } });
//       if (existingAgent) {
//         skippedRows.push({
//           row: i + 1,
//           reason: `Name "${row.name}" already exists`,
//         });
//         continue;
//       }

//       // Hash password default jika tidak disediakan
//       const passwordToHash =
//         row.password?.trim() || "DefaultPassword123";
//       const hashedPassword = await bcrypt.hash(passwordToHash, 10);

//       try {
//         // Insert ke database
//         await Agent.create({
//           name: row.name,
//           contact_person: row.contact_person,
//           email: row.email,
//           password: hashedPassword,
//           phone: row.phone,
//           commission_rate: row.commission_rate || 0,
//           commission_long: row.commission_long || 0,
//           commission_mid: row.commission_mid || 0,
//           commission_short: row.commission_short || 0,
//           commission_transport: row.commission_transport || 0,
//         });
//         insertedCount++;
//       } catch (err) {
//         skippedRows.push({ row: i + 1, reason: err.message });
//       }
//     }

//     // 4. Hapus file setelah selesai
//     await fs.unlink(filePath);

//     // 5. Kirimkan response
//     return res.json({
//       success: true,
//       message: `CSV uploaded. Inserted ${insertedCount} Agents.`,
//       skippedRows, // Rincian baris yang dilewati
//     });
//   } catch (error) {
//     console.error("Error uploading agent CSV:", error.message);

//     // Hapus file jika terjadi error
//     if (filePath) {
//       await fs.unlink(filePath).catch((err) =>
//         console.error("Error deleting file:", err.message)
//       );
//     }

//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

exports.uploadAgentCsv = async (req, res) => {
  try {
    // 1. Check if a file was uploaded
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No CSV file uploaded" });
    }

    const filePath = req.file.path;

    // 2. Parse the CSV file
    const agentsData = await parseCsvFile(filePath);

    // 3. Insert data into the database
    let insertedCount = 0;
    const validationErrors = []; // Track rows with validation errors

    for (let i = 0; i < agentsData.length; i++) {
      const row = agentsData[i];

      // Validate required fields
      if (!row.name || !row.email) {
        console.error(`Skipping row ${i + 1}: Missing name or email.`);
        validationErrors.push({ row: i + 1, data: row, reason: "Missing name or email" });
        continue;
      }

      // Check if the name already exists in the database
      const existingAgent = await Agent.findOne({ where: { name: row.name } });
      if (existingAgent) {
        console.error(
          `Skipping row ${i + 1}: Name "${row.name}" already exists.`
        );
        validationErrors.push({
          row: i + 1,
          data: row,
          reason: `Name "${row.name}" already exists`,
        });
        continue;
      }

      // Default password if not provided
      const passwordToHash =
        row.password && row.password.trim() !== ""
          ? row.password
          : "DefaultPassword123";

      // Hash the password
      const hashedPassword = await bcrypt.hash(passwordToHash, 10);

      try {
        // Create a new record in the Agent table
        await Agent.create({
          name: row.name,
          contact_person: row.contact_person,
          email: row.email,
          password: hashedPassword,
          phone: row.phone,
          commission_rate: row.commission_rate || 0,
          commission_long: row.commission_long || 150000,
          commission_mid: row.commission_mid || 150000,
          commission_short: row.commission_short || 100000,
          commission_transport: row.commission_transport || 0,
          commission_intermediate: row.commission_intermediate || 100000,
        });
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting row ${i + 1}:`, err.message);
        validationErrors.push({ row: i + 1, data: row, reason: err.message });
      }
    }

    // 4. Return a response
    return res.json({
      success: true,
      message: `CSV uploaded. Inserted ${insertedCount} Agents.`,
      validationErrors, // Include details of validation errors
    });
  } catch (error) {
    console.error("Error uploading agent CSV:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
