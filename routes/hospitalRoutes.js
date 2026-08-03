// const express = require('express');
// const { getHospitals, getHospitalById, createHospital, updateHospital, deleteHospital } = require('../controllers/hospitalController');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// const router = express.Router();

// router.get('/', getHospitals);
// router.get('/:id', getHospitalById);
// router.post('/', authMiddleware, roleMiddleware(['superadmin']), createHospital);
// router.put('/:id', authMiddleware, roleMiddleware(['superadmin']), updateHospital);
// router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteHospital);

// module.exports = router;

// const express = require('express');
// const {
//   getHospitals,
//   getHospitalById,
//   createHospital,
//   updateHospital,
//   deleteHospital,
// } = require('../controllers/hospitalController');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// const router = express.Router();

// router.get('/', getHospitals);
// router.get('/:id', getHospitalById);
// router.post('/', authMiddleware, roleMiddleware(['superadmin']), createHospital);
// router.put('/:id', authMiddleware, roleMiddleware(['superadmin']), updateHospital);
// router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteHospital);

// module.exports = router;



const express = require('express');
const {
  getHospitals,
  getHospitalById,
  createHospital,
  updateHospital,
  updateOwnHospitalTimings,
  deleteHospital
} = require('../controllers/hospitalController');

const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getHospitals);
router.get('/:id', getHospitalById);
router.post('/', authMiddleware, roleMiddleware(['superadmin']), createHospital);
router.put('/admin/update-timings', authMiddleware, roleMiddleware(['admin']), updateOwnHospitalTimings);
router.put('/:id', authMiddleware, roleMiddleware(['superadmin']), updateHospital);
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteHospital);

module.exports = router;