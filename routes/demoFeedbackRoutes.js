// const express = require('express');
// const { getFeedbackInfo, submitFeedback } = require('../controllers/demoFeedbackController');

// const router = express.Router();

// // Public — post-demo feedback via the emailed link
// router.get('/:token', getFeedbackInfo);
// router.post('/:token', submitFeedback);

// module.exports = router;


const express = require('express');
const { getFeedbackInfo, submitFeedback } = require('../controllers/demoFeedbackController');
const { submitPublicFeedback } = require('../controllers/publicFeedbackController');

const router = express.Router();

router.post('/', submitPublicFeedback);
router.get('/:token', getFeedbackInfo);
router.post('/:token', submitFeedback);

module.exports = router;