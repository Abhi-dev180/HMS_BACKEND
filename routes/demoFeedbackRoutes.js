
const express = require('express');
const { getFeedbackInfo, submitFeedback } = require('../controllers/demoFeedbackController');
const { submitPublicFeedback } = require('../controllers/publicFeedbackController');

const router = express.Router();

// ─── Public appointment feedback (must come BEFORE /:token) ──
router.post('/public', submitPublicFeedback);   

// ─── Demo feedback (token-based) ──────────────────────────────
router.get('/:token', getFeedbackInfo);
router.post('/:token', submitFeedback);

module.exports = router;