const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

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


const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log(`User ${user.name} logged in successfully`);
        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { id: user.id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (error) {
        res.status(400).json({ message: 'Error logging in', error });
    }
};

// const changePassword = async (req, res) => {
//     const { email, oldPassword, newPassword } = req.body;
//     console.log("Changing password for user:", email);
//     try {
//         const user = await User.findOne({ where: { email } });
//         if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
//             return res.status(401).json({ message: 'Incorrect email or old password' });
//         }
//         const hashedPassword = await bcrypt.hash(newPassword, 10);
//         user.password = hashedPassword;
//         await user.save();
//         console.log("Password changed successfully for user:", email);
//         res.status(200).json({ message: 'Password changed successfully' });
//     } catch (error) {
//         console.log("Error changing password for user:", email, error);
//         res.status(400).json({ message: 'Error changing password', error });
//     }
// };


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
    const { id } = req.params;
    const { name, email, role } = req.body;
    try {
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.name = name;
        user.email = email;
        user.role = role;
        await user.save();
        res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(400).json({ message: 'Error updating user', error });
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

module.exports = {
    createUser,
    loginUser,
    changePassword,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
};
