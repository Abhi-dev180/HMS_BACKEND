// const express = require('express');
// const {
//   createBooking,
//   listBookings,
//   inviteToSchedule,
//   updateBooking,
//   completeBooking,
//   deleteBooking
// } = require('../controllers/demoController');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// const router = express.Router();

// // Public — the marketing-site book-a-demo form
// router.post('/', createBooking);

// // Super admin — demo management
// router.get('/', authMiddleware, roleMiddleware(['superadmin']), listBookings);
// router.post('/:id/invite', authMiddleware, roleMiddleware(['superadmin']), inviteToSchedule);
// router.patch('/:id', authMiddleware, roleMiddleware(['superadmin']), updateBooking);
// router.post('/:id/complete', authMiddleware, roleMiddleware(['superadmin']), completeBooking);
// router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteBooking);

// module.exports = router;



const express = require('express');
const {
  createBooking,
  listBookings,
  inviteToSchedule,
  updateBooking,
  completeBooking,
  deleteBooking
} = require('../controllers/demoController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — the marketing-site book-a-demo form
router.post('/', createBooking);

// Super admin — demo management
router.get('/', authMiddleware, roleMiddleware(['superadmin']), listBookings);
router.post('/:id/invite', authMiddleware, roleMiddleware(['superadmin']), inviteToSchedule);
router.patch('/:id', authMiddleware, roleMiddleware(['superadmin']), updateBooking);
router.post('/:id/complete', authMiddleware, roleMiddleware(['superadmin']), completeBooking);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteBooking);

module.exports = router;