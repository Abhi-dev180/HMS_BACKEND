// const express = require('express');
// const { login, register, getAdmins, createAdmin, updateAdmin, deleteAdmin } = require('../controllers/authController');
// const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// const router = express.Router();

// router.post('/login', login);
// router.post('/register', register);
// router.get('/admins', authMiddleware, roleMiddleware(['superadmin']), getAdmins);
// router.post('/admins', authMiddleware, roleMiddleware(['superadmin']), createAdmin);
// router.put('/admins/:id', authMiddleware, roleMiddleware(['superadmin']), updateAdmin);
// router.delete('/admins/:id', authMiddleware, roleMiddleware(['superadmin']), deleteAdmin);

// module.exports = router;

const express = require('express');
const {
  login,
  register,
  refreshToken,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Users management (superadmin)
router.get('/users', authMiddleware, roleMiddleware(['superadmin']), getAllUsers);
router.post('/users', authMiddleware, roleMiddleware(['superadmin']), createUser);
router.put('/users/:id', authMiddleware, roleMiddleware(['superadmin']), updateUser);
router.delete('/users/:id', authMiddleware, roleMiddleware(['superadmin']), deleteUser);
router.get('/admins', authMiddleware, roleMiddleware(['superadmin']), getAdmins);
router.post('/admins', authMiddleware, roleMiddleware(['superadmin']), createAdmin);
router.put('/admins/:id', authMiddleware, roleMiddleware(['superadmin']), updateAdmin);
router.delete('/admins/:id', authMiddleware, roleMiddleware(['superadmin']), deleteAdmin);

module.exports = router;