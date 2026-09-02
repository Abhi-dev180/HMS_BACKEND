const express = require('express');
const router = express.Router();
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServiceCategories
} = require('../controllers/serviceController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Public / Authenticated read routes
router.get('/categories', getServiceCategories);
router.get('/', getServices);
router.get('/:id', getServiceById);

// SuperAdmin only write routes
router.post('/', authMiddleware, roleMiddleware(['superadmin']), createService);
router.put('/:id', authMiddleware, roleMiddleware(['superadmin']), updateService);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteService);

module.exports = router;
