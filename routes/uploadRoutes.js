const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/uploadController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Keep the file in memory (5 MB max); we forward the buffer to Supabase Storage.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware(['superadmin', 'admin']), upload.single('image'), uploadImage);

module.exports = router;
