// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { processChatMessage, getChatSuggestions } = require('../controllers/chatController');
const jwt = require('jsonwebtoken');
const Users = require('../db/users');

// Optional authentication resolver middleware
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      if (decoded && decoded.id) {
        const user = await Users.findById(decoded.id);
        if (user) req.user = user;
      }
    } catch (_) {}
  }
  next();
};

router.post('/message', optionalAuth, processChatMessage);
router.get('/suggestions', optionalAuth, getChatSuggestions);

module.exports = router;
