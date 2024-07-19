const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authenticate = async (req, res, next) => {
    console.log('authenticate middleware called');
    const token = req.headers['authorization'];
    console.log('token:', token);
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        console.log('decoded:', decoded);
        req.user = await User.findByPk(decoded.id);
        console.log('req.user:', req.user);
        if (!req.user) {
            console.log('Invalid token');
            return res.status(401).json({ message: 'Invalid token' });
        }
        next();
    } catch (error) {
        console.log('Unauthorized', error);
        res.status(401).json({ message: 'Unauthorized', error });
    }
};

module.exports = authenticate;

