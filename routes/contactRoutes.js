const express = require('express');
const {
  submitContact,
  listContacts,
  updateContact,
  deleteContact
} = require('../controllers/contactController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — the contact form on the marketing site
router.post('/', submitContact);

// Super admin — review, respond and clean up
router.get('/', authMiddleware, roleMiddleware(['superadmin']), listContacts);
router.patch('/:id', authMiddleware, roleMiddleware(['superadmin']), updateContact);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteContact);

module.exports = router;
