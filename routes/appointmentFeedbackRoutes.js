// const express = require('express');
// const {
//   submitFeedback,
//   getFeedbacks,
//   createFeedbackByAdmin,
//   updateFeedback,
//   deleteFeedback
// } = require('../controllers/feedbackController');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// const router = express.Router();

// router.post('/', authMiddleware, roleMiddleware(['user']), submitFeedback);
// router.get('/', authMiddleware, roleMiddleware(['user', 'admin', 'superadmin']), getFeedbacks);

// // Admin CRUD
// router.post('/admin', authMiddleware, roleMiddleware(['admin', 'superadmin']), createFeedbackByAdmin);
// router.put('/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), updateFeedback);
// router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), deleteFeedback);

// module.exports = router;

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