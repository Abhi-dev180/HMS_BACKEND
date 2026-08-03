const jwt = require('jsonwebtoken');
const Users = require('../db/users');
const { isConfigured } = require('../config/supabase');
const { sendPasswordResetOtp } = require('../services/emailService');

const SECRET = process.env.JWT_SECRET || 'secret123';

const publicUser = (u) => ({
  id: u.id, name: u.name || '', email: u.email, mobile: u.mobile || '',
  role: u.role, hospital: u.hospital || '', hospitalId: u.hospitalId || '',
  active: u.active !== false
});

const signToken = (u) =>
  jwt.sign(
    { id: u.id, role: u.role, name: u.name, mobile: u.mobile, hospitalId: u.hospitalId },
    SECRET,
    { expiresIn: '2h' }
  );

const login = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        message: 'Database connection not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env file.'
      });
    }

    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').toString().trim();

    const user = await Users.findByEmail(email);
    if (!user || (user.password || '').toString().trim() !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.active === false) {
      return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
    }

    return res.json({
      message: 'Login successful',
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    const netIssue = /fetch failed|timeout|ENOTFOUND|ECONNREFUSED|UND_ERR/i.test(String(error && error.message));
    return res.status(netIssue ? 503 : 500).json({
      message: netIssue
        ? 'Could not reach the server. Please check your internet connection and try again.'
        : 'Server error during login'
    });
  }
};

const register = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        message: 'Database connection not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env file.'
      });
    }
    const { name, email, mobile, password } = req.body;
    if (await Users.findByEmail(email)) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    if (!mobile || !/^\d{10}$/.test(mobile.toString().trim())) {
      return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
    }
    const newUser = await Users.insert({
      id: Date.now().toString(),
      name,
      email: (email || '').trim(),
      mobile: mobile.toString().trim(),
      password: (password || '').toString().trim(),
      role: 'user',
      active: true
    });
    return res.status(201).json({ message: 'Registration successful', token: signToken(newUser), user: publicUser(newUser) });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

const getAdmins = async (req, res) => {
  const admins = await Users.all({ role: 'admin' });
  return res.json(admins.map(publicUser));
};

const createAdmin = async (req, res) => {
  const { name, email, mobile, hospital } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });
  if (await Users.findByEmail(email)) return res.status(400).json({ message: 'User already exists' });
  const admin = await Users.insert({
    id: Date.now().toString(), name, email, mobile: mobile || '', password: '123',
    role: 'admin', hospital: hospital || 'Unassigned', hospitalId: '', active: true
  });
  return res.status(201).json(publicUser(admin));
};

const updateAdmin = async (req, res) => {
  const { id } = req.params;
  const { name, email, mobile, hospital } = req.body;
  const admin = await Users.findById(id);
  if (!admin || admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found' });
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });
  const dupe = await Users.findByEmail(email);
  if (dupe && dupe.id !== id) return res.status(400).json({ message: 'Another user already uses this email' });
  const updated = await Users.update(id, { name, email, mobile: mobile !== undefined ? mobile : admin.mobile, hospital: hospital || admin.hospital });
  return res.json(publicUser(updated));
};

const deleteAdmin = async (req, res) => {
  const { id } = req.params;
  const admin = await Users.findById(id);
  if (!admin || admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found' });
  await Users.remove(id);
  return res.json({ message: 'Admin deleted', admin: publicUser(admin) });
};

// ── Users management (superadmin) ──
const getAllUsers = async (req, res) => {
  const users = await Users.all();
  return res.json(users.map(publicUser));
};

const createUser = async (req, res) => {
  const { name, email, mobile, password, role, hospital } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ message: 'Name, email, password and role are required' });
  if (!['user', 'admin', 'superadmin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (await Users.findByEmail(email)) return res.status(400).json({ message: 'A user already exists with this email' });
  const user = await Users.insert({
    id: Date.now().toString(), name, email: email.trim(), mobile: mobile || '',
    password: String(password), role, hospital: hospital || '', hospitalId: '', active: true
  });
  return res.status(201).json(publicUser(user));
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, mobile, role, hospital, password, active } = req.body || {};
  const user = await Users.findById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (email) {
    const dupe = await Users.findByEmail(email);
    if (dupe && dupe.id !== id) return res.status(400).json({ message: 'Another user already uses this email' });
  }
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email.trim();
  if (mobile !== undefined) patch.mobile = mobile;
  if (role !== undefined && ['user', 'admin', 'superadmin'].includes(role)) patch.role = role;
  if (hospital !== undefined) patch.hospital = hospital;
  if (password) patch.password = String(password);
  if (active !== undefined) patch.active = !!active;
  const updated = await Users.update(id, patch);
  return res.json(publicUser(updated));
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const user = await Users.findById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'superadmin') return res.status(400).json({ message: 'Super admin accounts cannot be deleted' });
  await Users.remove(id);
  return res.json({ message: 'User deleted', user: publicUser(user) });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await Users.findByEmail(email);
    if (user) {
      const otp = String(Math.floor(1000 + Math.random() * 9000));
      await Users.update(user.id, { resetOtp: otp, resetOtpExpires: Date.now() + 10 * 60 * 1000 });
      sendPasswordResetOtp({ to: user.email, contactName: user.name, otp })
        .catch((e) => console.error('[auth] reset OTP email failed:', e));
    }
    return res.json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const otp = (req.body.otp || '').toString().trim();
    const newPassword = (req.body.newPassword || '').toString();
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, code and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await Users.findByEmail(email);
    if (!user || !user.resetOtp) return res.status(400).json({ message: 'Invalid or expired code' });
    if (Date.now() > (user.resetOtpExpires || 0)) return res.status(400).json({ message: 'Code expired. Please request a new one.' });
    if (String(user.resetOtp) !== otp) return res.status(400).json({ message: 'Incorrect code' });

    await Users.update(user.id, { password: newPassword, resetOtp: null, resetOtpExpires: null });
    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/refresh — refresh JWT token within 2 hours
const refreshToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.body?.token;
    if (!authHeader) return res.status(401).json({ message: 'Token is required' });
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    const decoded = jwt.verify(rawToken, SECRET, { ignoreExpiration: true });
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Invalid token' });

    const now = Math.floor(Date.now() / 1000);
    // 2 hours = 7200 seconds max window for token refresh
    if (decoded.exp && (now - decoded.exp > 7200)) {
      return res.status(401).json({ message: 'Refresh token expired (2 hours limit). Please log in again.' });
    }

    const user = await Users.findById(decoded.id);
    if (!user || user.active === false) {
      return res.status(403).json({ message: 'User account inactive or invalid' });
    }

    const newToken = signToken(user);
    return res.json({ token: newToken, user: publicUser(user), message: 'Token refreshed successfully' });
  } catch (err) {
    return res.status(401).json({ message: 'Token refresh failed' });
  }
};

module.exports = {
  login, register, refreshToken, getAdmins, createAdmin, updateAdmin, deleteAdmin,
  getAllUsers, createUser, updateUser, deleteUser, forgotPassword, resetPassword
};
