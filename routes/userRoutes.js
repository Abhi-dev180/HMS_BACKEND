// const express = require('express');
// const router = express.Router();
// const { authMiddleware } = require('../middleware/authMiddleware');
// const { supabase } = require('../config/supabase');
// const { sendPasswordResetOtp } = require('../services/emailService'); // we'll reuse the OTP email function

// // Helper: generate 4-digit OTP
// const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

// // ─── Send OTP to new email ──────────────────────────────────
// router.post('/send-otp', authMiddleware, async (req, res) => {
//   const { email } = req.body;
//   const userId = req.user.id;

//   if (!email) return res.status(400).json({ message: 'Email is required' });

//   // Check if email already in use by another user
//   const { data: existing, error: checkErr } = await supabase
//     .from('users')
//     .select('id')
//     .eq('email', email)
//     .neq('id', userId)
//     .maybeSingle();

//   if (existing) {
//     return res.status(409).json({ message: 'Email already in use by another account' });
//   }

//   const otp = generateOtp();
//   const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

//   // Store OTP and pending email in users table (need columns pending_email, resetOtp, resetOtpExpires)
//   // We'll use resetOtp and resetOtpExpires for OTP, and we'll store the new email in a separate column 'pending_email' (add if missing)
//   // Alternatively, we can store in a separate table. But we can add columns.

//   // For now, we'll assume we have pending_email column, or we can store in a separate table.
//   // Let's add a new table or use existing columns: we'll add pending_email column.
//   // I'll provide SQL to add if not exists.

//   const { error } = await supabase
//     .from('users')
//     .update({
//       reset_otp: otp,
//       reset_otp_expires: expires,
//       pending_email: email
//     })
//     .eq('id', userId);

//   if (error) {
//     console.error('Error storing OTP:', error);
//     return res.status(500).json({ message: 'Failed to send OTP' });
//   }

//   // Send OTP email
//   try {
//     await sendPasswordResetOtp({
//       to: email,
//       contactName: req.user.name || 'User',
//       otp: otp
//     });
//   } catch (err) {
//     console.error('OTP email error:', err);
//     return res.status(500).json({ message: 'Failed to send OTP email' });
//   }

//   res.json({ message: 'OTP sent to your new email address' });
// });

// // ─── Verify OTP and update profile ──────────────────────────
// router.put('/profile', authMiddleware, async (req, res) => {
//   const { name, email, mobile, hospital, otp } = req.body;
//   const userId = req.user.id;

//   // Get current user data
//   const { data: user, error: fetchErr } = await supabase
//     .from('users')
//     .select('email, reset_otp, reset_otp_expires, pending_email')
//     .eq('id', userId)
//     .single();

//   if (fetchErr || !user) {
//     return res.status(404).json({ message: 'User not found' });
//   }

//   // Prepare updates
//   const updates = {};
//   if (name !== undefined) updates.name = name;
//   if (mobile !== undefined) updates.mobile = mobile;
//   if (hospital !== undefined) updates.hospital = hospital;

//   // Handle email change
//   if (email && email !== user.email) {
//     // Email is being changed
//     if (!otp) {
//       return res.status(400).json({ message: 'OTP is required to change email' });
//     }

//     // Check OTP validity
//     if (user.reset_otp !== otp) {
//       return res.status(400).json({ message: 'Invalid OTP' });
//     }
//     if (new Date(user.reset_otp_expires) < new Date()) {
//       return res.status(400).json({ message: 'OTP has expired' });
//     }

//     // Check if the email matches the pending email
//     if (user.pending_email !== email) {
//       return res.status(400).json({ message: 'Email does not match the pending email' });
//     }

//     // Update email
//     updates.email = email;
//     // Clear OTP fields
//     updates.reset_otp = null;
//     updates.reset_otp_expires = null;
//     updates.pending_email = null;
//   } else {
//     // If email not changed, we don't need OTP, but we should clear any pending OTP if present
//     if (user.reset_otp) {
//       // Clear any stale OTP
//       await supabase
//         .from('users')
//         .update({ reset_otp: null, reset_otp_expires: null, pending_email: null })
//         .eq('id', userId);
//     }
//   }

//   updates.updated_at = new Date().toISOString();

//   const { data, error } = await supabase
//     .from('users')
//     .update(updates)
//     .eq('id', userId)
//     .select('id, name, email, mobile, role, hospital')
//     .single();

//   if (error) {
//     console.error('Profile update error:', error);
//     return res.status(500).json({ message: 'Failed to update profile', error: error.message });
//   }

//   res.json({ user: data });
// });

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const { authMiddleware } = require('../middleware/authMiddleware');
// const { supabase } = require('../config/supabase');
// const { sendOtpEmail } = require('../services/emailService');

// // ─── Generate 4‑digit OTP ──────────────────────────────────
// const generateOtp = () => Math.floor(1000 + Math.random() * 9000);

// // ─── Send OTP to email ──────────────────────────────────────
// router.post('/send-otp', authMiddleware, async (req, res) => {
//   const { email } = req.body;
//   if (!email) return res.status(400).json({ message: 'Email is required' });

//   try {
//     // Check if email already taken by another user
//     const { data: existing } = await supabase
//       .from('users')
//       .select('id')
//       .eq('email', email)
//       .neq('id', req.user.id)
//       .maybeSingle();
//     if (existing) return res.status(409).json({ message: 'Email already in use' });

//     const otp = generateOtp();
//     const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

//     // Save OTP to user record (reuse resetOtp columns)
//     const { error } = await supabase
//       .from('users')
//       .update({ resetOtp: otp, resetOtpExpires: expires.toISOString() })
//       .eq('id', req.user.id);

//     if (error) throw error;

//     // Send OTP email via your existing email service
//     await sendOtpEmail({ to: email, otp });

//     res.json({ message: 'OTP sent successfully' });
//   } catch (err) {
//     console.error('[userRoutes] send-otp error:', err);
//     res.status(500).json({ message: 'Failed to send OTP' });
//   }
// });

// // ─── Verify OTP ──────────────────────────────────────────────
// router.post('/verify-otp', authMiddleware, async (req, res) => {
//   const { otp } = req.body;
//   if (!otp) return res.status(400).json({ message: 'OTP is required' });

//   try {
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('resetOtp, resetOtpExpires')
//       .eq('id', req.user.id)
//       .single();

//     if (error || !user) return res.status(404).json({ message: 'User not found' });

//     const storedOtp = user.resetOtp;
//     const expires = new Date(user.resetOtpExpires);
//     const now = new Date();

//     if (String(storedOtp) !== String(otp)) {
//       return res.status(400).json({ message: 'Invalid OTP' });
//     }
//     if (now > expires) {
//       return res.status(400).json({ message: 'OTP expired' });
//     }

//     res.json({ message: 'OTP verified successfully' });
//   } catch (err) {
//     console.error('[userRoutes] verify-otp error:', err);
//     res.status(500).json({ message: 'Failed to verify OTP' });
//   }
// });

// // ─── Update Profile ──────────────────────────────────────────
// router.put('/profile', authMiddleware, async (req, res) => {
//   const { name, email, mobile, otpVerified } = req.body;
//   const userId = req.user.id;

//   // Build update object
//   const updates = {};
//   if (name !== undefined) updates.name = name;
//   if (mobile !== undefined) updates.mobile = mobile;


//     const emailChanged = email !== undefined && email !== req.user.email;
//     if (emailChanged) {
//     // Check if email is already taken by another user
//     const { data: existing } = await supabase
//       .from('users')
//       .select('id')
//       .eq('email', email)
//       .neq('id', userId)
//       .maybeSingle();
//     if (existing) return res.status(409).json({ message: 'Email already in use' });
//      // Require OTP verification
//     if (!otpVerified) {
//       return res.status(400).json({ message: 'OTP verification required for email change' });
//     }
//     updates.email = email;
//   }

//   // Hospital cannot be changed via this endpoint – ignore if sent

//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .update(updates)
//       .eq('id', userId)
//       .select('id, name, email, mobile, role, hospital')
//       .single();

//     if (error) {
//       console.error('[userRoutes] profile update error:', error);
//       return res.status(500).json({ message: 'Failed to update profile', error: error.message });
//     }
//     // Send profile updated email (only if email changed or we have email)
//      if (data.email) {
//       await sendProfileUpdatedEmail({
//         to: data.email,
//         name: data.name,
//         email: data.email,
//         mobile: data.mobile,
//         role: data.role,
//         hospital: data.hospital
//       }).catch(err => console.error('Profile update email failed:', err));
//     }

//     res.json({ user: data });
//   } catch (err) {
//     console.error('[userRoutes] update error:', err);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// });

// // ─── Change Password ─────────────────────────────────────────
// router.put('/change-password', authMiddleware, async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   if (!currentPassword || !newPassword) {
//     return res.status(400).json({ message: 'Current and new password required' });
//   }

//   try {
//     // Fetch user with password
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('password')
//       .eq('id', req.user.id)
//       .single();

//     if (error || !user) return res.status(404).json({ message: 'User not found' });

//     // Verify current password (plain text comparison – adjust if hashed)
//     if (user.password !== currentPassword) {
//       return res.status(401).json({ message: 'Current password is incorrect' });
//     }

//     // Update password
//     const { error: updateError } = await supabase
//       .from('users')
//       .update({ password: newPassword })
//       .eq('id', req.user.id);

//     if (updateError) throw updateError;

//     res.json({ message: 'Password updated successfully' });
//   } catch (err) {
//     console.error('[userRoutes] change-password error:', err);
//     res.status(500).json({ message: 'Failed to change password' });
//   }
// });

// module.exports = router;

// const express = require('express');
// const router = express.Router();
// const { authMiddleware } = require('../middleware/authMiddleware');
// const { supabase } = require('../config/supabase');
// const { sendOtpEmail, sendProfileUpdateConfirmation } = require('../services/emailService');

// const generateOtp = () => Math.floor(1000 + Math.random() * 9000);

// // ─── Send OTP ────────────────────────────────────────────────
// router.post('/send-otp', authMiddleware, async (req, res) => {
//   const { email } = req.body;
//   if (!email) return res.status(400).json({ message: 'Email is required' });

//   try {
//     // Check if email already taken by another user
//     const { data: existing } = await supabase
//       .from('users')
//       .select('id')
//       .eq('email', email)
//       .neq('id', req.user.id)
//       .maybeSingle();
//     if (existing) return res.status(409).json({ message: 'Email already in use' });

//     const otp = generateOtp();
//     const expires = new Date(Date.now() + 10 * 60 * 1000);

//     const { error } = await supabase
//       .from('users')
//       .update({ resetOtp: otp, resetOtpExpires: expires.toISOString() })
//       .eq('id', req.user.id);

//     if (error) throw error;

//     await sendOtpEmail({ to: email, otp });

//     res.json({ message: 'OTP sent successfully' });
//   } catch (err) {
//     console.error('[userRoutes] send-otp error:', err);
//     res.status(500).json({ message: 'Failed to send OTP' });
//   }
// });

// // ─── Verify OTP ──────────────────────────────────────────────
// router.post('/verify-otp', authMiddleware, async (req, res) => {
//   const { otp } = req.body;
//   if (!otp) return res.status(400).json({ message: 'OTP is required' });

//   try {
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('resetOtp, resetOtpExpires')
//       .eq('id', req.user.id)
//       .single();

//     if (error || !user) return res.status(404).json({ message: 'User not found' });

//     const storedOtp = user.resetOtp;
//     const expires = new Date(user.resetOtpExpires);
//     const now = new Date();

//     if (String(storedOtp) !== String(otp)) {
//       return res.status(400).json({ message: 'Invalid OTP' });
//     }
//     if (now > expires) {
//       return res.status(400).json({ message: 'OTP expired' });
//     }

//     // Clear OTP after verification
//     await supabase
//       .from('users')
//       .update({ resetOtp: null, resetOtpExpires: null })
//       .eq('id', req.user.id);

//     res.json({ message: 'OTP verified successfully' });
//   } catch (err) {
//     console.error('[userRoutes] verify-otp error:', err);
//     res.status(500).json({ message: 'Failed to verify OTP' });
//   }
// });

// // ─── Update Profile ──────────────────────────────────────────
// router.put('/profile', authMiddleware, async (req, res) => {
//   const { name, email, mobile, otpVerified } = req.body;
//   const userId = req.user.id;
  

//   // Get current user data
//   const { data: currentUser, error: fetchError } = await supabase
//     .from('users')
//     .select('email')
//     .eq('id', userId)
//     .single();
//   if (fetchError || !currentUser) {
//     return res.status(404).json({ message: 'User not found' });
//   }

//   const updates = {};
//   if (name !== undefined) updates.name = name;
//   if (mobile !== undefined) updates.mobile = mobile;

//   // If email is being changed
//   const emailChanged = email !== undefined && email !== currentUser.email;
//   if (emailChanged) {
//     // Check if email already taken by another user
//     const { data: existing } = await supabase
//       .from('users')
//       .select('id')
//       .eq('email', email)
//       .neq('id', userId)
//       .maybeSingle();
//     if (existing) return res.status(409).json({ message: 'Email already in use' });
    
//     // Require OTP verification
//     if (!otpVerified) {
//       return res.status(400).json({ message: 'OTP verification required for email change' });
//     }
//     updates.email = email;
//   }

//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .update(updates)
//       .eq('id', userId)
//       .select('id, name, email, mobile, role, hospital')
//       .single();

//     if (error) {
//       console.error('[userRoutes] profile update error:', error);
//       return res.status(500).json({ message: 'Failed to update profile', error: error.message });
//     }

//     // ─── Send confirmation email (if any field changed) ──────
//     const changedFields = [];
//     if (name !== undefined && name !== currentUser.name) changedFields.push('Name');
//     if (mobile !== undefined && mobile !== currentUser.mobile) changedFields.push('Mobile');
//     if (emailChanged) changedFields.push('Email');

//     if (changedFields.length > 0 && data.email) {
//       await sendProfileUpdateConfirmation({
//         to: data.email,
//         name: data.name,
//         changedFields,
//         updatedAt: new Date().toISOString()
//       }).catch(err => console.error('[userRoutes] profile update email error:', err));
//     }

//     res.json({ user: data });
//   } catch (err) {
//     console.error('[userRoutes] update error:', err);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// });

// // ─── Change Password ─────────────────────────────────────────
// router.put('/change-password', authMiddleware, async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   if (!currentPassword || !newPassword) {
//     return res.status(400).json({ message: 'Current and new password required' });
//   }

//   try {
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('password')
//       .eq('id', req.user.id)
//       .single();

//     if (error || !user) return res.status(404).json({ message: 'User not found' });

//     if (user.password !== currentPassword) {
//       return res.status(401).json({ message: 'Current password is incorrect' });
//     }

//     const { error: updateError } = await supabase
//       .from('users')
//       .update({ password: newPassword })
//       .eq('id', req.user.id);

//     if (updateError) throw updateError;

//     res.json({ message: 'Password updated successfully' });
//   } catch (err) {
//     console.error('[userRoutes] change-password error:', err);
//     res.status(500).json({ message: 'Failed to change password' });
//   }
// });

// module.exports = router;






// const express = require('express');
// const router = express.Router();
// const { authMiddleware } = require('../middleware/authMiddleware');
// const { supabase } = require('../config/supabase');
// const { sendOtpEmail, sendProfileUpdatedEmail } = require('../services/emailService');

// // ─── Generate 4‑digit OTP ──────────────────────────────────
// const generateOtp = () => Math.floor(1000 + Math.random() * 9000);

// // ─── Send OTP to email ──────────────────────────────────────
// // router.post('/send-otp', authMiddleware, async (req, res) => {
// //   const { email } = req.body;
// //   if (!email) return res.status(400).json({ message: 'Email is required' });

// //   try {
// //     // Check if email already taken by another user
// //     const { data: existing } = await supabase
// //       .from('users')
// //       .select('id')
// //       .eq('email', email)
// //       .neq('id', req.user.id)
// //       .maybeSingle();
// //     if (existing) return res.status(409).json({ message: 'Email already in use' });

// //     const otp = generateOtp();
// //     const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

// //     // Save OTP to user record (reuse resetOtp columns)
// //     const { error } = await supabase
// //       .from('users')
// //       .update({ resetOtp: otp, resetOtpExpires: expires.toISOString() })
// //       .eq('id', req.user.id);

// //     if (error) throw error;

// //     // Send OTP email
// //     await sendOtpEmail({ to: email, otp });

// //     res.json({ message: 'OTP sent successfully' });
// //   } catch (err) {
// //     console.error('[userRoutes] send-otp error:', err);
// //     res.status(500).json({ message: 'Failed to send OTP' });
// //   }
// // })



// // ─── Send OTP ──────────────────────────────────────────────
// router.post('/send-otp', authMiddleware, async (req, res) => {
//   const { email } = req.body;
//   if (!email) return res.status(400).json({ message: 'Email is required' });

//   try {
//     const { data: existing } = await supabase
//       .from('users')
//       .select('id')
//       .eq('email', email)
//       .neq('id', req.user.id)
//       .maybeSingle();
//     if (existing) return res.status(409).json({ message: 'Email already in use' });

//     const otp = generateOtp();
//     const expires = Date.now() + 10 * 60 * 1000; 

//     // Store as numbers
//     const { error } = await supabase
//       .from('users')
//       .update({ resetOtp: otp, resetOtpExpires: expires })
//       .eq('id', req.user.id);

//     if (error) throw error;

//     await sendOtpEmail({ to: email, otp });

//     res.json({ message: 'OTP sent successfully' });
//   } catch (err) {
//     console.error('[userRoutes] send-otp error:', err);
//     res.status(500).json({ message: 'Failed to send OTP' });
//   }
// });

// // ─── Verify OTP ──────────────────────────────────────────────
// router.post('/verify-otp', authMiddleware, async (req, res) => {
//   const { otp } = req.body;
//   if (!otp) return res.status(400).json({ message: 'OTP is required' });

//   try {
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('resetOtp, resetOtpExpires')
//       .eq('id', req.user.id)
//       .single();

//     if (error || !user) return res.status(404).json({ message: 'User not found' });

//     const storedOtp = user.resetOtp;
//     const expires = user.resetOtpExpires; 
//     if (String(storedOtp) !== String(otp)) {
//       return res.status(400).json({ message: 'Invalid OTP' });
//     }
//     if (Date.now() > expires) {
//       return res.status(400).json({ message: 'OTP expired' });
//     }

//     res.json({ message: 'OTP verified successfully' });
//   } catch (err) {
//     console.error('[userRoutes] verify-otp error:', err);
//     res.status(500).json({ message: 'Failed to verify OTP' });
//   }
// });


// // ─── Update Profile ──────────────────────────────────────────
// router.put('/profile', authMiddleware, async (req, res) => {
//   const { name, email, mobile, otpVerified } = req.body;
//   const userId = req.user.id;

//   const updates = {};
//   const changes = [];

//   if (name !== undefined && name !== req.user.name) {
//     updates.name = name;
//     changes.push('Name');
//   }
//   if (mobile !== undefined && mobile !== req.user.mobile) {
//     updates.mobile = mobile;
//     changes.push('Mobile');
//   }

//   // Email change requires OTP verification
//   if (email !== undefined && email !== req.user.email) {
//     const { data: existing } = await supabase
//       .from('users')
//       .select('id')
//       .eq('email', email)
//       .neq('id', userId)
//       .maybeSingle();
//     if (existing) return res.status(409).json({ message: 'Email already in use' });

//     if (!otpVerified) {
//       return res.status(400).json({ message: 'OTP verification required for email change' });
//     }
//     updates.email = email;
//     changes.push('Email');
//   }

//   if (Object.keys(updates).length === 0) {
//     return res.status(400).json({ message: 'No changes to update' });
//   }

//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .update(updates)
//       .eq('id', userId)
//       .select('id, name, email, mobile, role, hospital')
//       .single();

//     if (error) {
//       console.error('[userRoutes] profile update error:', error);
//       return res.status(500).json({ message: 'Failed to update profile', error: error.message });
//     }

//     // Send confirmation email
//     const finalEmail = data.email || req.user.email;
//     await sendProfileUpdatedEmail({
//       to: finalEmail,
//       name: data.name || req.user.name,
//       changes: changes.join(', '),
//       updatedAt: new Date().toISOString()
//     }).catch(err => console.error('[userRoutes] profile update email failed:', err));

//     res.json({ user: data });
//   } catch (err) {
//     console.error('[userRoutes] update error:', err);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// });

// // ─── Change Password ─────────────────────────────────────────
// router.put('/change-password', authMiddleware, async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   if (!currentPassword || !newPassword) {
//     return res.status(400).json({ message: 'Current and new password required' });
//   }

//   try {
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('password')
//       .eq('id', req.user.id)
//       .single();

//     if (error || !user) return res.status(404).json({ message: 'User not found' });

//     if (user.password !== currentPassword) {
//       return res.status(401).json({ message: 'Current password is incorrect' });
//     }

//     const { error: updateError } = await supabase
//       .from('users')
//       .update({ password: newPassword })
//       .eq('id', req.user.id);

//     if (updateError) throw updateError;

//     res.json({ message: 'Password updated successfully' });
//   } catch (err) {
//     console.error('[userRoutes] change-password error:', err);
//     res.status(500).json({ message: 'Failed to change password' });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { supabase } = require('../config/supabase');
const { readDB } = require('../models');
const { sendOtpEmail, sendProfileUpdatedEmail } = require('../services/emailService');
const { getLatestSubscription, publicUser } = require('../controllers/authController');

// ─── Get Current User Profile & Subscription Details ─────────
const getProfileHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let userRecord = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) userRecord = data;
      } catch (e) {}
    }

    if (!userRecord) {
      const db = readDB();
      userRecord = (db.users || []).find((u) => String(u.id) === String(userId)) || req.user;
    }

    if (!userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Resolve hospital, city, address, beds from registrations or hospitals if missing
    if (userRecord.email) {
      if (supabase) {
        try {
          const { data: reg } = await supabase
            .from('registrations')
            .select('hospital_name, contact_name, phone, city, address, beds')
            .eq('email', userRecord.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (reg) {
            if (!userRecord.hospital && reg.hospital_name) userRecord.hospital = reg.hospital_name;
            if (!userRecord.city && reg.city) userRecord.city = reg.city;
            if (!userRecord.address && reg.address) userRecord.address = reg.address;
            if (!userRecord.beds && reg.beds) userRecord.beds = reg.beds;
            if (!userRecord.contact_name && reg.contact_name) userRecord.contact_name = reg.contact_name;
          }
        } catch (_) {}

        if (!userRecord.hospital || !userRecord.city || !userRecord.address || !userRecord.beds) {
          try {
            const { data: hosp } = await supabase
              .from('hospitals')
              .select('name, location, beds, contact')
              .or(`admin_email.eq.${userRecord.email},email.eq.${userRecord.email}`)
              .limit(1)
              .maybeSingle();
            if (hosp) {
              if (!userRecord.hospital && hosp.name) userRecord.hospital = hosp.name;
              if (!userRecord.address && hosp.location) userRecord.address = hosp.location;
              if (!userRecord.beds && hosp.beds) userRecord.beds = hosp.beds;
            }
          } catch (_) {}
        }

        if (!userRecord.hospital) {
          try {
            const { data: demo } = await supabase
              .from('demo_bookings')
              .select('hospital_name, city')
              .eq('email', userRecord.email)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (demo) {
              if (demo.hospital_name) userRecord.hospital = demo.hospital_name;
              if (!userRecord.city && demo.city) userRecord.city = demo.city;
            }
          } catch (_) {}
        }
      }

      const db = readDB();
      const reg = (db.registrations || []).find((r) => r.email === userRecord.email);
      if (reg) {
        if (!userRecord.hospital && reg.hospital_name) userRecord.hospital = reg.hospital_name;
        if (!userRecord.city && reg.city) userRecord.city = reg.city;
        if (!userRecord.address && reg.address) userRecord.address = reg.address;
        if (!userRecord.beds && reg.beds) userRecord.beds = reg.beds;
      }
      const hosp = (db.hospitals || []).find((h) => h.admin_email === userRecord.email || h.email === userRecord.email);
      if (hosp) {
        if (!userRecord.hospital && hosp.name) userRecord.hospital = hosp.name;
        if (!userRecord.address && hosp.location) userRecord.address = hosp.location;
        if (!userRecord.beds && hosp.beds) userRecord.beds = hosp.beds;
      }
    }

    const subscription = await getLatestSubscription(userId);
    const fullUser = publicUser(userRecord, subscription);

    return res.json({ user: fullUser, subscription });
  } catch (err) {
    console.error('[userRoutes] get profile error:', err);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

router.get('/profile', authMiddleware, getProfileHandler);
router.get('/me', authMiddleware, getProfileHandler);

// ─── Generate 4‑digit OTP ──────────────────────────────────
const generateOtp = () => Math.floor(1000 + Math.random() * 9000);

// ─── Send OTP ──────────────────────────────────────────────
router.post('/send-otp', authMiddleware, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    // 1. Check if email is already taken by another user
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', req.user.id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // 2. Get user's name for personalisation
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', req.user.id)
      .single();

    if (userError) throw userError;

    // 3. Generate OTP and expiry (milliseconds)
    const otp = generateOtp();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 4. Save OTP to user record
    const { error: updateError } = await supabase
      .from('users')
      .update({ resetOtp: otp, resetOtpExpires: expires })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    // 5. Send OTP email
    await sendOtpEmail({
      to: email,
      name: user?.name || 'User',
      otp
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('[userRoutes] send-otp error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// ─── Verify OTP ──────────────────────────────────────────────
router.post('/verify-otp', authMiddleware, async (req, res) => {
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ message: 'OTP is required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('resetOtp, resetOtpExpires')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const storedOtp = user.resetOtp;
    const expires = user.resetOtpExpires;

    if (String(storedOtp) !== String(otp)) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (Date.now() > expires) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('[userRoutes] verify-otp error:', err);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

// ─── Update Profile ──────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  const {
    name, contactName, email, mobile, phone,
    hospital, hospitalName, city, address, beds,
    gender, bloodGroup, dob, age, emergencyContact,
    specialty, emergency, department, otpVerified
  } = req.body;
  const userId = req.user.id;

  const finalName = (name !== undefined ? name : contactName);
  const finalMobile = (mobile !== undefined ? mobile : phone);
  const finalHospital = (hospital !== undefined ? hospital : hospitalName);

  const updates = {};
  const changes = [];

  if (finalName !== undefined && finalName !== req.user.name) {
    updates.name = finalName;
    changes.push('Name');
  }
  if (finalMobile !== undefined && finalMobile !== req.user.mobile) {
    updates.mobile = finalMobile;
    changes.push('Mobile');
  }
  if (finalHospital !== undefined && finalHospital !== req.user.hospital) {
    updates.hospital = finalHospital;
    changes.push('Hospital');
  }
  if (city !== undefined && city !== req.user.city) {
    updates.city = city;
    changes.push('City');
  }
  if (address !== undefined && address !== req.user.address) {
    updates.address = address;
    changes.push('Address');
  }
  if (beds !== undefined && beds !== req.user.beds) {
    updates.beds = beds;
    changes.push('Beds');
  }
  if (gender !== undefined && gender !== req.user.gender) {
    updates.gender = gender;
    changes.push('Gender');
  }
  if (bloodGroup !== undefined && bloodGroup !== req.user.bloodGroup) {
    updates.bloodGroup = bloodGroup;
    changes.push('Blood Group');
  }
  if (dob !== undefined && dob !== req.user.dob) {
    updates.dob = dob;
    changes.push('Date of Birth');
  }
  if (age !== undefined && age !== req.user.age) {
    updates.age = age;
    changes.push('Age');
  }
  if (emergencyContact !== undefined && emergencyContact !== req.user.emergencyContact) {
    updates.emergencyContact = emergencyContact;
    changes.push('Emergency Contact');
  }
  if (specialty !== undefined && specialty !== req.user.specialty) {
    updates.specialty = specialty;
    changes.push('Specialty');
  }
  if (emergency !== undefined && emergency !== req.user.emergency) {
    updates.emergency = emergency;
    changes.push('Emergency');
  }
  if (department !== undefined && department !== req.user.department) {
    updates.department = department;
    changes.push('Department');
  }

  if (email !== undefined && email !== req.user.email) {
    // Check if email already taken
    if (supabase) {
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }

    if (!otpVerified) {
      return res.status(400).json({ message: 'OTP verification required for email change' });
    }
    updates.email = email;
    changes.push('Email');
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No changes to update' });
  }

  try {
    let data = null;
    if (supabase) {
      const { data: updated, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        console.warn('[userRoutes] Supabase update error, falling back to local:', error.message);
      } else {
        data = updated;
      }
    }

    const { readDB, writeDB } = require('../models');
    const db = readDB();
    const userIndex = (db.users || []).findIndex((u) => String(u.id) === String(userId));
    if (userIndex !== -1) {
      db.users[userIndex] = { ...db.users[userIndex], ...updates };
      if (!data) data = db.users[userIndex];
    }

    // Sync registrations table if email matched
    const targetEmail = req.user.email;
    if (supabase) {
      const regUpdates = {};
      if (updates.hospital) regUpdates.hospital_name = updates.hospital;
      if (updates.name) regUpdates.contact_name = updates.name;
      if (updates.mobile) regUpdates.phone = updates.mobile;
      if (updates.city) regUpdates.city = updates.city;
      if (updates.address) regUpdates.address = updates.address;
      if (updates.beds) regUpdates.beds = updates.beds;
      if (updates.email) regUpdates.email = updates.email;

      if (Object.keys(regUpdates).length > 0) {
        await supabase
          .from('registrations')
          .update(regUpdates)
          .or(`email.eq.${targetEmail},admin_user_id.eq.${userId}`);
      }
    }

    // Sync hospitals table if admin
    if (supabase && (updates.hospital || updates.address || updates.beds || updates.mobile)) {
      const hospUpdates = {};
      if (updates.hospital) hospUpdates.name = updates.hospital;
      if (updates.address) hospUpdates.location = updates.address;
      if (updates.beds) hospUpdates.beds = updates.beds;
      if (updates.mobile) hospUpdates.contact = updates.mobile;

      await supabase
        .from('hospitals')
        .update(hospUpdates)
        .or(`admin_email.eq.${targetEmail},email.eq.${targetEmail}`);
    }

    writeDB(db);

    const subscription = await getLatestSubscription(userId);
    const fullUser = publicUser(data || { ...req.user, ...updates }, subscription);

    // ─── Send confirmation email ────────────────────────────
    const finalEmail = fullUser.email || req.user.email;
    await sendProfileUpdatedEmail({
      to: finalEmail,
      name: fullUser.name || req.user.name,
      changes: changes.join(', '),
      updatedAt: new Date().toISOString()
    }).catch((err) => console.error('[userRoutes] profile update email failed:', err));

    return res.json({ user: fullUser, subscription, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[userRoutes] update error:', err);
    return res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// ─── Change Password ─────────────────────────────────────────
router.put('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ message: 'User not found' });

    if (user.password !== currentPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[userRoutes] change-password error:', err);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

module.exports = router;