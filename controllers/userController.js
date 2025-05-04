const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const nodemailer = require('nodemailer'); // Untuk mengirim email
const createUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    console.log("Received data:", { name, email, password, role }); // Add this line for debugging
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role });
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        res.status(400).json({ message: 'Error creating user', error });
    }
};

// Controller Forgot Password
const resetPasswordWithToken = async (req, res) => {
    const { token, newPassword } = req.body;

    console.log('Received reset password request:', { token, newPassword });

    try {
        // Verifikasi token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', decoded);

        // Cari user berdasarkan ID yang ada di token
        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Perbarui password pengguna
        user.password = hashedPassword;
        await user.save();

        console.log('Password reset successfully for user:', user.email);

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error in resetPasswordWithToken:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Token has expired' });
        }
        res.status(500).json({ message: 'Internal server error', error });
    }
};

const forgotPassword = async (req, res) => {
    console.log('Received forgot password request:', req.body);
    const { email } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log('User not found:', email);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User found:', user);

        // Generate token
        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('Generated reset token:', resetToken);

        // Buat URL reset password
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        console.log('Reset URL:', resetUrl);

        // Kirim email ke pengguna
        const transporter = nodemailer.createTransport({
            host: 'mail.headlessexploregilis.my.id', // Update as required
            port: 465, // Secure port for SMTP
            secure: true, // Use TLS
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Reset Password Gili Getaway',
            html: `
                <p>Hello ${user.name},</p>
                <p>We received a request to reset your password. Click the link below to reset it:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>If you did not request this, please ignore this email.</p>
                <p>Thanks,</p>
                <p>The Gili Getaway Team</p>
            `
        };

        console.log('Sending email with options:', mailOptions);
        await transporter.sendMail(mailOptions);

        console.log('Email sent successfully');

        res.status(200).json({ message: 'Reset password link sent to email', resetUrl });
    } catch (error) {
        console.error('Error in forgotPassword:', error.message);
        res.status(500).json({ message: 'Internal server error', error });
    }
};


// const loginUser = async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         const user = await User.findOne({ where: { email } });
//         if (!user || !(await bcrypt.compare(password, user.password))) {
//             return res.status(401).json({ message: 'Invalid email or password' });
//         }
//         console.log('Generating token for user:', user.email);
//         const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
//         console.log('Token generated:', token);
      
//         res.status(200).json({ 
//             message: 'Login successful', 
//             token, 
//             user: { id: user.id, name: user.name, email: user.email, role: user.role } 
//         });
//     } catch (error) {
//         console.error('Error logging in:', error.message);
//         res.status(400).json({ message: 'Error logging in', error });
//     }
// };

// Global token cache at backend
const tokenCache = new Map();

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if token exists in cache and is still valid
        const cachedTokenData = tokenCache.get(email);
        if (cachedTokenData) {
            // Decode token to check expiry
            try {
                const decoded = jwt.verify(cachedTokenData.token, process.env.JWT_SECRET);
                const currentTime = Math.floor(Date.now() / 1000);
                
                // If token is still valid (not expired)
                if (decoded.exp > currentTime) {
                    console.log(`Using cached token for: ${email}`);
                    console.log(`Token will expire in: ${(decoded.exp - currentTime) / 60} minutes`);
                    
                    // Verify password first for security
                    const user = await User.findOne({ where: { email } });
                    if (!user || !(await bcrypt.compare(password, user.password))) {
                        return res.status(401).json({ message: 'Invalid email or password' });
                    }
                    
                    return res.status(200).json({ 
                        message: 'Login successful (cached token)', 
                        token: cachedTokenData.token, 
                        user: { id: user.id, name: user.name, email: user.email, role: user.role },
                        fromCache: true
                    });
                } else {
                    // Token has expired, remove from cache
                    console.log(`Cached token expired for: ${email}, removing from cache`);
                    tokenCache.delete(email);
                }
            } catch (err) {
                // Token is invalid or verification error
                console.log(`Error verifying cached token: ${err.message}`);
                tokenCache.delete(email);
            }
        }
        
        // If no token in cache or token expired, perform normal login
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        console.log('Generating new token for user:', user.email);
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        console.log('New token generated:', token);
        
        // Save new token in cache
        tokenCache.set(email, {
            token,
            createdAt: Date.now()
        });
        console.log(`Token successfully stored in cache for: ${email}`);
        
        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            fromCache: false
        });
    } catch (error) {
        console.error('Error during login process:', error.message);
        res.status(400).json({ message: 'Login error', error });
    }
};



const changePassword = async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;
    console.log("Changing password for user:", email);
    try {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
            return res.status(401).json({ message: 'Incorrect email or old password' });
        }

        if (await bcrypt.compare(newPassword, user.password)) {
            return res.status(400).json({ message: 'New password cannot be the same as the old password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        console.log("Password changed successfully for user:", email);
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.log("Error changing password for user:", email, error);
        res.status(400).json({ message: 'Error changing password', error });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        res.status(400).json({ message: 'Error fetching users', error });
    }
};

const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: 'Error fetching user', error });
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params; // Get user ID from the request parameters
    const { name, email, role } = req.body; // Get the updated user data from the request body

    try {
        // Find user by ID
        const user = await User.findByPk(id);

        // If user is not found, return a 404 response
        if (!user) {
            return res.status(404).json({
                message: "User not found",
                details: `No user found with the ID: ${id}`,
            });
        }

        // Update user fields if a value is provided
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;

        // Save changes to the database
        await user.save();

        // Return a success response
        return res.status(200).json({
            message: "User updated successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                updatedAt: user.updatedAt, // Include the updated timestamp
            },
        });
    } catch (error) {
        // Handle potential database or server errors
        return res.status(500).json({
            message: "Error updating user",
            error: error.message,
            details: "An unexpected error occurred while updating the user. Please try again later.",
        });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await user.destroy();
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Error deleting user', error });
    }
};

// Controller Forgot Password
// const forgotPassword = async (req, res) => {
//     console.log('Received forgot password request:', req.body);
//     const { email } = req.body;
//     try {
//         const user = await User.findOne({ where: { email } });
//         if (!user) {
//             console.log('User not found:', email);
//             return res.status(404).json({ message: 'User not found' });
//         }

//         console.log('User found:', user);

//         // Generate token
//         const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
//         console.log('Generated reset token:', resetToken);

//         // Simpan token di database (opsional: bisa tambahkan kolom di tabel user untuk menyimpan token reset)
//         user.resetPasswordToken = resetToken; // Pastikan ada field resetPasswordToken di model
//         user.resetPasswordExpires = Date.now() + 3600000; // Token berlaku 1 jam
//         console.log('Saving reset token to user:', user);
//         await user.save();

//         console.log('User saved:', user);

//         // Buat URL reset password
//         const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
//         console.log('Reset URL:', resetUrl);
        
//         // Kirim email ke pengguna
//         const transporter = nodemailer.createTransport({
//             host: 'mail.headlessexploregilis.my.id', // Update as required
//             port: 465, // Secure port for SMTP
//             secure: true, // Use TLS
//             auth: {
//               user: process.env.EMAIL_USER ,
//               pass: process.env.EMAIL_PASSWORD 
//             },
//           });

//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: user.email,
//             subject: 'Reset Password Gili Getaway',
//             html: `
//                 <p>Hello ${user.name},</p>
//                 <p>We received a request to reset your password. Click the link below to reset it:</p>
//                 <a href="${resetUrl}">${resetUrl}</a>
//                 <p>If you did not request this, please ignore this email.</p>
//                 <p>Thanks,</p>
//                 <p>The Gili Getaway Team</p>
//             `
//         };

//         console.log('Sending email with options:', mailOptions);
//         await transporter.sendMail(mailOptions);

//         console.log('Email sent successfully');

//         res.status(200).json({ message: 'Reset password link sent to email', resetUrl });
//     } catch (error) {
//         console.error('Error in forgotPassword:', error.message);
//         res.status(500).json({ message: 'Internal server error', error });
//     }
// };

module.exports = {
    createUser,
    loginUser,
    changePassword,
    forgotPassword,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    resetPasswordWithToken
};
