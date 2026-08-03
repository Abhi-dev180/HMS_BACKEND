const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  createSubscription,
  getMySubscription,
  cancelSubscription
} = require('../controllers/subscriptionController');

router.post('/create-checkout', authMiddleware, createSubscription);
router.get('/my-subscription', authMiddleware, getMySubscription);
router.post('/cancel', authMiddleware, cancelSubscription);

module.exports = router;