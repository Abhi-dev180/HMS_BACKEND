const express = require('express');
const { getCalendarEvents } = require('../controllers/calendarController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/events', authMiddleware, getCalendarEvents);

module.exports = router;
