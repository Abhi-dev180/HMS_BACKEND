// const express = require('express');
// const { getOverviewStats } = require('../controllers/statsController');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// const router = express.Router();

// // Super admin — live counters polled by the dashboard
// router.get('/overview', authMiddleware, roleMiddleware(['superadmin']), getOverviewStats);

// module.exports = router;


const express = require('express');
const { getOverviewStats } = require('../controllers/statsController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ✅ FIXED: Allowed for BOTH superadmin AND admin
router.get('/overview', authMiddleware, roleMiddleware(['superadmin', 'admin']), getOverviewStats);

module.exports = router;