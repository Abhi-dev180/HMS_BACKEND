

// const express = require('express');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
// const {
//   bookAppointment,
//   bookPublicAppointment,
//   getAppointments,
//   updateAppointmentStatus,
//   updateAppointment,
//   deleteAppointment,
//   getBookedSlots
// } = require('../controllers/appointmentController');

// const router = express.Router();

// // Public — get booked slots for a given date (Google Calendar + DB)
// router.get('/booked-slots', getBookedSlots);

// // Public — book an appointment from the marketing site (no login)
// router.post('/public', bookPublicAppointment);

// router.post('/', authMiddleware, bookAppointment);
// router.get('/', authMiddleware, getAppointments);
// router.put('/:id/status', authMiddleware, roleMiddleware(['superadmin', 'admin']), updateAppointmentStatus);
// router.put('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), updateAppointment);
// router.delete('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), deleteAppointment);

// module.exports = router;


const express = require('express');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const {
  bookAppointment,
  bookPublicAppointment,
  getAppointments,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  getBookedSlots,
  lookupAppointments,
  reschedulePublicAppointment,
  cancelPublicAppointment
} = require('../controllers/appointmentController');

const router = express.Router();

// Public routes
router.get('/booked-slots', getBookedSlots);
router.post('/public', bookPublicAppointment);

// Public "manage my booking" — ownership proven by mobile + email in the body
router.post('/lookup', lookupAppointments);
router.put('/public/:id', reschedulePublicAppointment);
router.delete('/public/:id', cancelPublicAppointment);

// Authenticated routes
router.post('/', authMiddleware, bookAppointment);
router.get('/', authMiddleware, getAppointments);

// Status update – admin/superadmin only
router.put('/:id/status', authMiddleware, roleMiddleware(['superadmin', 'admin']), updateAppointmentStatus);

// Full update – users can update their own appointments
router.put('/:id', authMiddleware, updateAppointment);

// Delete – admin/superadmin only 
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), deleteAppointment);

module.exports = router;