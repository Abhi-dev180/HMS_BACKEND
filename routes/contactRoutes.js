const express = require('express');
const {
  submitContact,
  listContacts,
  replyContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts
} = require('../controllers/contactController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — the contact form on the marketing site
router.post('/', submitContact);

// Super admin — review, respond, upload attachments and clean up
router.get('/', authMiddleware, roleMiddleware(['superadmin']), listContacts);
router.post('/:id/reply', authMiddleware, roleMiddleware(['superadmin']), replyContact);
router.patch('/:id', authMiddleware, roleMiddleware(['superadmin']), updateContact);
router.delete('/bulk', authMiddleware, roleMiddleware(['superadmin']), bulkDeleteContacts);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteContact);

module.exports = router;
