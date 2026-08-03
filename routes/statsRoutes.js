const express = require('express');
const { getOverviewStats } = require('../controllers/statsController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Super admin — live counters polled by the dashboard
router.get('/overview', authMiddleware, roleMiddleware(['superadmin']), getOverviewStats);

module.exports = router;
