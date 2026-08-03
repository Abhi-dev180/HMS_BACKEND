const express = require('express');
const { getCalendarEvents } = require('../controllers/calendarController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Any signed-in role — the controller scopes the results to who is asking.
router.get('/events', authMiddleware, getCalendarEvents);

module.exports = router;
