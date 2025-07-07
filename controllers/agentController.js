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
const crypto = require('crypto');


// Create the HTML email template as a separate function
// Email template function - moved out for cleaner code
// Email template function with spam-prevention measures


// controllers/agentController.js

exports.generateApiKey = async (req, res) => {
  try {
    console.log('Generating API key...');
    const agent = req.agent;

    // Cek kalau sudah ada api_key
    // if (agent.api_key) {
    //   console.log('API key already exists for this agent');
    //   return res.status(400).json({ message: 'API key already exists for this agent' });
    // }

    console.log('Generating random API key...');
    const apiKey = crypto.randomBytes(32).toString('hex');

    console.log('Saving API key...');
    agent.api_key = apiKey;
    await agent.save();

    console.log('API key generated successfully');
    return res.status(200).json({
      message: 'API key generated successfully',
      agent_id: agent.id,
      api_key: apiKey,
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const createAgentWelcomeEmailTemplate = (agent, randomPassword) => {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Gili Getaway</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; color: #333;">
  <!-- Pre-header -->
  <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    Welcome to Gili Getaway! Your agent account has been created successfully. Here are your login credentials.
  </div>

  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background-color: #165297; padding: 25px 20px; text-align: center;">
      <img src="https://ik.imagekit.io/m1akscp5q/landing%20page%20giligetaway/giligetawayinverted.png" 
           alt="Gili Getaway Fast Boat Service" 
           style="max-width: 180px; margin-bottom: 10px; display: inline-block;" 
           width="180" height="60" />
      <h1 style="color: white; margin: 10px 0 5px; font-size: 22px;">Welcome to the Gili Getaway Team!</h1>
    </div>

    <!-- Body -->
    <div style="padding: 25px 20px;">
      <p style="font-size: 16px; line-height: 1.5;">Dear ${agent.name},</p>

      <p style="font-size: 16px; line-height: 1.5;">
        Congratulations! Your agent account has been successfully created, and you're now officially part of the Gili Getaway family.
      </p>

      <div style="background-color: #f0f7ff; border-left: 4px solid #165297; padding: 20px; margin: 25px 0; border-radius: 6px;">
        <p style="font-size: 16px; margin: 0 0 15px 0;"><strong>Your Login Credentials:</strong></p>
        <p style="font-size: 16px; margin: 5px 0;"><strong>Email:</strong> ${agent.email}</p>
        <p style="font-size: 16px; margin: 5px 0;"><strong>Temporary Password:</strong> ${randomPassword}</p>
      </div>n
      
      <div style="background-color: #fff8e1; border-left: 4px solid #FFBF00; padding: 15px; margin: 25px 0; border-radius: 6px;">
        <p style="font-size: 16px; margin: 0;">
          <strong>IMPORTANT:</strong> Please log in and change your password immediately for security purposes.
        </p>
      </div>

      <!-- Call to Action Button -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="https://giligetaway-widget.my.id/agent" style="background-color: #165297; color: white; padding: 14px 26px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 15px; font-size: 16px;">Log In to Your Account</a>
        <p style="font-size: 14px; color: #666;">Or copy this link: https://giligetaway-widget.my.id/agent</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5;">
        If you have any questions about using the system or need assistance, please contact our support team at <a href="mailto:officebali1@gmail.com" style="color: #165297;">officebali1@gmail.com</a>
      </p>

      <p style="font-size: 16px; line-height: 1.5; margin-bottom: 5px;">Warm regards,</p>
      <p style="font-size: 16px; font-weight: bold; margin-top: 0;">The Gili Getaway Team</p>
      <p style="font-size: 15px; color: #165297; margin-top: 5px;">Making island travel simple and reliable.</p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 25px 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; text-align: center;">
      <p style="margin: 6px 0;">Gili Getaway | Jl. Pantai Serangan, Serangan, Denpasar Selatan, Bali 80229, Indonesia</p>
      <p style="margin: 6px 0;">Contact: (+62) 812 3456 7890 | officebali1@gmail.com</p>
      <p style="margin: 6px 0;"><a href="https://giligetaway-widget.my.id/agent" style="color: #2991D6;">Access Your Agent Dashboard</a></p>
      <p style="margin: 6px 0;">© ${currentYear} Gili Getaway. All rights reserved.</p>
      <p style="margin: 6px 0; font-size: 12px;">This is a transactional email regarding your account creation.</p>
    </div>
  </div>
</body>
</html>
  `;
};

// Configure the email transporter
const configureTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST_BREVO,
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_LOGIN_BREVO,
      pass: process.env.EMAIL_PASS_BREVO,
    },
  });
};;

// Function to prepare agent data
const prepareAgentData = async (req) => {
  // Generate and hash password
  const randomPassword = generateRandomPassword(12); // Increased to 12 characters
  const hashedPassword = await bcrypt.hash(randomPassword, 10);
  
  // Determine image URL
  const imageUrl = req.file ? req.file.url : 'https://ik.imagekit.io/m1akscp5q/Person-placeholder.jpg?updatedAt=1732263814558';
  
  // Prepare agent data object
  const agentData = {
    ...req.body,
    password: hashedPassword,
    image_url: imageUrl,
  };
  
  return { agentData, randomPassword };
};

// Function to format agent response (without sensitive data)
const formatAgentResponse = (agent) => {
  return {
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
  };
};

// Function to send agent welcome email
const sendAgentWelcomeEmail = async (transporter, agent, randomPassword) => {
  const mailOptions = {
    from: `Gili Getaway <${process.env.EMAIL_USER_GMAIL}>`,
    to: agent.email,
    // CC removed to prevent spam triggers
    subject: 'Welcome to Gili Getaway - Your New Account',
    html: createAgentWelcomeEmailTemplate(agent, randomPassword)
  };
  
  return transporter.sendMail(mailOptions);
};

// Main function to create a new agent
// exports.createAgent = async (req, res) => {
//   const transporter = configureTransporter();
//   const transaction = await sequelize.transaction();

//   try {
//     // Step 1: Prepare agent data with password and image
//     const { agentData, randomPassword } = await prepareAgentData(req);
    
//     // Step 2: Save agent to database
//     const agent = await Agent.create(agentData, { transaction });
//     if (!agent) {
//       throw new Error("Failed to create agent");
//     }
    
//     // // Step 3: Send welcome email with credentials
//     // await sendAgentWelcomeEmail(transporter, agent, randomPassword);
    
//     // // Log email sending (without exposing content or credentials)
//     // console.log(`Email sent to ${agent.email} for new account creation`);
    
//     // Step 4: Commit transaction
//     await transaction.commit();
    
//     // Step 5: Send response
//     res.status(201).json({
//       agent: formatAgentResponse(agent),
//       message: "Agent created successfully. Login instructions sent via email.",
//     });

//   } catch (error) {
//     // Rollback transaction on error
//     await transaction.rollback();
//     console.error("Error creating agent:", error.message);
//     res.status(500).json({ message: error.message });
//   }
// };

// create controller to send the agent email invitation to login in to their account
// base on the agent id parameter

const createAgentInvitationEmailTemplate = (agent, randomPassword) => {
  const currentYear = new Date().getFullYear();
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Invitation</title>
  </head>
  <body style="font-family: Arial, sans-serif; margin: 0; padding: 10px; color: #333;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; border-radius: 5px;">
      
      <!-- Header -->
      <div style="background-color: #165297; padding: 15px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">You're Invited to Join Gili Getaway!</h1>
      </div>
      
      <!-- Body -->
      <div style="padding: 15px;">
        <p>Dear ${agent.name},</p>
        
        <p>We're excited to invite you as a Gili Getaway Partner! Your account is ready.</p>
        
        <div style="background-color: #f0f7ff; border-left: 3px solid #165297; padding: 10px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${agent.email}</p>
        </div>
        
        <div style="background-color: #fff8e1; border-left: 3px solid #FFBF00; padding: 10px; margin: 15px 0;">
          <p style="margin: 0;"><strong>IMPORTANT:</strong> Please create your password before logging in.</p>
        </div>
        
        <!-- Call to Action Button -->
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://giligetaway-widget.my.id/agent/reset-password" style="background-color: #165297; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Create Password</a>
        </div>
               <div style="text-align: center; margin: 20px 0;">
          <a href="https://giligetaway-widget.my.id/agent/reset-password" style="background-color: #165297; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">https://giligetaway-widget.my.id/agent/reset-password</a>
        </div>
        
        <p>Need help? Contact us at <a href="mailto:agentbookings@giligetaway.com" style="color: #165297;">agentbookings@giligetaway.com</a></p>
        
        <p>Warm regards,<br>
        <strong>The Gili Getaway Team</strong></p>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8f9fa; padding: 10px; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d; text-align: center;">
        <p style="margin: 3px 0;">Gili Getaway | Bali, Indonesia | (+62) 81337074147</p>
        <p style="margin: 3px 0;">© ${currentYear} Gili Getaway. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};


exports.sendAgentInvitationEmail = async (req, res) => {
  try {
    const { agentId } = req.body;
    console.log("😹Sending agent invitation email... with id:", agentId);
    
    // Check if agentId is valid
    if (!agentId || typeof agentId === 'object') {
      console.error("Invalid agentId provided:", agentId);
      return res.status(400).json({ 
        success: false, 
        message: `Invalid agent ID format: ${typeof agentId}` 
      });
    }

    // Find agent details by ID
    const agent = await Agent.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: `Agent with ID ${agentId} not found`
      });
    }
    
    // console.log("Agent found:", agent);

    // Create the transporter using your configuration function
    const transporter = configureTransporter();

    const mailOptions = {
      from: `Gili Getaway <${process.env.EMAIL_AGENT}>`,
      to: agent.email,
      subject: 'Welcome to Gili Getaway - Your New Account',
      html: createAgentInvitationEmailTemplate(agent),
    };

    await transporter.sendMail(mailOptions);
    
    return res.status(200).json({
      success: true,
      message: 'Invitation email sent successfully'
    });
    
  } catch (error) {
    console.error("Error sending agent invitation email:", error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invitation email',
      error: error.message
    });
  }
};

// Main function to create a new agent
exports.createAgent = async (req, res) => {
  const transporter = configureTransporter();
  const transaction = await sequelize.transaction();

  try {
    // Step 1: Prepare agent data with password and image
    const { agentData, randomPassword } = await prepareAgentData(req);
    console.log("📝 Agent Data prepared");
    
    // Step 2: Save agent to database
    const agent = await Agent.create(agentData, { transaction });
    if (!agent) {
      throw new Error("Failed to create agent");
    }
    console.log("✅ Agent Created: ID =", agent.id);
    
    // Step 3: Send welcome email with credentials
    const mailOptions = {
      from: `Gili Getaway <${process.env.EMAIL_USER_GMAIL}>`,
      to: agent.email,
      cc: process.env.EMAIL_USER_GMAIL,
      subject: 'Your Gili Getaway Agent Account Details',
      html: createAgentWelcomeEmailTemplate(agent, randomPassword)
    };
    
    // await transporter.sendMail(mailOptions);
    // console.log("📧 Email sent to:", agent.email);
    
    // Step 4: Commit transaction
    await transaction.commit();
    
    // Step 5: Send response
    res.status(201).json({
      agent: formatAgentResponse(agent),
      message: "Agent created successfully. Credentials sent via email.",
    });

  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("❌ Error creating agent:", error.message);
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
    console.log("Login request received for email:", email);
    console.log("Login request received for password:", password);
    const agent = await Agent.findOne({ where: { email } });
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Compare the hashed password
    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) {
      console.log("Password mismatch for email:", email);
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
      host: process.env.EMAIL_HOST_BREVO,
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_LOGIN_BREVO,
        pass: process.env.EMAIL_PASS_BREVO,
      },
      logger: true,
      debug: true, // show debug output
    });
    


    const mailOptions = {
      from: `${process.env.EMAIL_NOREPLY}`,
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
    // console.log("✅ Email sent successfully via SMTP to:", agent.email);
    // console.log("📩 SMTP response:", info.response);
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
    // console.log("Agent update successful:", agent.dataValues);

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
    // console.log("All agents retrieved:", agents);
    res.status(200).json(agents);
  } catch (error) {
    console.log("Error retrieving agents:", error.message);
    res.status(500).json({ message: error.message });
  }
};
exports.getAllAgentsOnly = async (req, res) => {
  try {
    const agents = await Agent.findAll({
      include: [
        // {
        //   model: Booking,
        //   as: "bookings",
        //   include: [
        //     {
        //       model: Schedule,
        //       as: "schedule",
        //       include: [
        //         {
        //           model: Destination,
        //           as: "FromDestination",
        //         },
        //         {
        //           model: Destination,
        //           as: "ToDestination",
        //         },
        //         {
        //           model: Boat,
        //           as: "Boat",
        //         },
        //       ],
        //     },
        //     {
        //       model: Passenger,
        //       as: "passengers",
        //     },
        //     {
        //       model: TransportBooking,
        //       as: "transportBookings",
        //       include: [
        //         {
        //           model: Transport,
        //           as: "transport",
        //         },
        //       ],
        //     },
        //   ],
        // },
        {
          model: AgentMetrics,
          as: "agentMetrics",
        },
      ],
    });
    // console.log("All agents retrieved:", agents);
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
    });;

    if (agent) {
      // console.log("Agent retrieved:", agent);
      res.status(200).json(agent);
    } else {
      console.log("Agent not found:", req.params.id);
      res.status(400).json({ message: "Agent not found" });
    }
  } catch (error) {
    console.log("Error retrieving agent:", error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.getAgentByIdSingle = async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id, {
      // include: [
      //   {
      //     model: Booking,
      //     as: "bookings",
      //     include: [
      //       {
      //         model: Schedule,
      //         as: "schedule",
      //         include: [
      //           {
      //             model: Destination,
      //             as: "FromDestination",
      //           },
      //           {
      //             model: Destination,
      //             as: "ToDestination",
      //           },
      //           {
      //             model: Boat,
      //             as: "Boat",
      //           },
      //         ],
      //       },
      //       {
      //         model: Passenger,
      //         as: "passengers",
      //       },
      //       {
      //         model: TransportBooking,
      //         as: "transportBookings",
      //         include: [
      //           {
      //             model: Transport,
      //             as: "transport",
      //           },
      //         ],
      //       },
      //       {
      //         model: AgentCommission,
      //         as: "agentCommission",
      //       },
      //     ],
      //   },
      //   {
      //     model: AgentMetrics,
      //     as: "agentMetrics",
      //   },
      // ],
    });;

    if (agent) {
      // console.log("Agent retrieved:", agent);
      res.status(200).json(agent);
    } else {
      // console.log("Agent not found:", req.params.id);
      res.status(400).json({ message: "Agent not found" });
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
