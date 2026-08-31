const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const {
  getFeedbacks,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  createPublicFeedback
} = require('../controllers/appointmentFeedbackController');


router.post('/public', createPublicFeedback);


router.get('/', authMiddleware, getFeedbacks);
router.post('/', authMiddleware, createFeedback);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), updateFeedback);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteFeedback);
module.exports = router;