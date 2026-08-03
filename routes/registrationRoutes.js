const express = require('express');
const {
  createRegistration,
  getPrefill,
  listRegistrations,
  updateRegistrationStatus,
  assignHospital,
  deleteRegistration
} = require('../controllers/registrationController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — prefill data + submit registration after payment
router.get('/prefill/:token', getPrefill);
router.post('/', createRegistration);

// Super admin — review / approve / deny / activate / assign
router.get('/', authMiddleware, roleMiddleware(['superadmin']), listRegistrations);
router.patch('/:id', authMiddleware, roleMiddleware(['superadmin']), updateRegistrationStatus);
router.post('/:id/assign-hospital', authMiddleware, roleMiddleware(['superadmin', 'admin']), assignHospital);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteRegistration);

module.exports = router;
