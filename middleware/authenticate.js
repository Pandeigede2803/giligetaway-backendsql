const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authenticate = async (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        req.user = await User.findByPk(decoded.id);
        if (!req.user) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized', error });
    }
};

module.exports = authenticate;;
