// routes/appointmentRoutes.js
const express = require('express');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const {
  bookAppointment,
  bookPublicAppointment,
  getAppointments,
  updateAppointmentStatus,
  updateAppointment,
  cancelAppointment,
  deleteAppointment,
  getBookedSlots,
  lookupAppointments,
  reschedulePublicAppointment,
  getAppointmentByNumber,
  downloadAppointmentInvoice,
  downloadCancellationInvoice
} = require('../controllers/appointmentController');

const { cancelPublicAppointment } = require('../controllers/cancelAppointmentController');

const router = express.Router();
console.log('✅ appointmentRoutes loaded and router created.');
// ─── Public routes ───────────────────────────────────────────
router.get('/booked-slots', getBookedSlots);
router.post('/public', bookPublicAppointment);
router.get('/by-number/:number', getAppointmentByNumber);
router.get('/:id/invoice', downloadAppointmentInvoice);
router.get('/:id/cancellation-invoice', downloadCancellationInvoice);

// Public "manage my booking" — ownership proven by mobile + email in the body
router.post('/lookup', lookupAppointments);
router.put('/public/:id', reschedulePublicAppointment);
router.delete('/public/:id', cancelPublicAppointment);

// ─── Authenticated routes ────────────────────────────────────
router.post('/', authMiddleware, bookAppointment);
router.get('/', authMiddleware, getAppointments);

// Cancel & refund appointment
router.post('/:id/cancel', authMiddleware, cancelAppointment);

// Status update – admin/superadmin only
router.put('/:id/status', authMiddleware, roleMiddleware(['superadmin', 'admin']), updateAppointmentStatus);

// Full update – users can update their own appointments
router.put('/:id', authMiddleware, updateAppointment);

// Delete – admin/superadmin only 
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), deleteAppointment);
console.log('📤 appointmentRoutes exported:', typeof router);
module.exports = router;