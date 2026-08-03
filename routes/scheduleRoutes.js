const express = require('express');
const { getScheduleInfo, bookSlot } = require('../controllers/scheduleController');

const router = express.Router();

// Public — prospect picks a demo slot via the emailed link
router.get('/:token', getScheduleInfo);
router.post('/:token', bookSlot);

module.exports = router;
