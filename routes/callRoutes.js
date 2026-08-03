const express = require('express');
const {
  createCallLog,
  getCallLogs,
  getTranscriptions,
  createTranscription,
  updateTranscription,
  deleteTranscription
} = require('../controllers/callController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware(['user']), createCallLog);
router.get('/', authMiddleware, roleMiddleware(['user', 'admin', 'superadmin']), getCallLogs);

// Transcriptions
router.get('/transcriptions', authMiddleware, roleMiddleware(['user', 'admin', 'superadmin']), getTranscriptions);
router.post('/transcriptions', authMiddleware, roleMiddleware(['admin', 'superadmin']), createTranscription);
router.put('/transcriptions/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), updateTranscription);
router.delete('/transcriptions/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), deleteTranscription);

module.exports = router;
