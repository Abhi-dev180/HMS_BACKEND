const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const {
  getFeedbacks,
  createFeedback,
  updateFeedback,
  deleteFeedback
} = require('../controllers/appointmentFeedbackController');

router.get('/', authMiddleware, getFeedbacks);
router.post('/', authMiddleware, roleMiddleware(['admin', 'superadmin']), createFeedback);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), updateFeedback);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteFeedback);

module.exports = router;