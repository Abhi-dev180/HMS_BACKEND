// const crypto = require('crypto');
// const { supabase, isConfigured } = require('../config/supabase');
// const {
//   sendDemoReceived,
//   sendScheduleInvite,
//   sendDemoConfirmation,
//   sendFeedbackRequest
// } = require('../services/emailService');
// const { PLANS } = require('../config/stripePlans'); 
// const TABLE = 'demo_bookings';
// const VALID_STATUS = ['requested', 'invited', 'scheduled', 'completed', 'cancelled'];

// const notConfigured = (res) =>
//   res.status(503).json({
//     message: 'Demo storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
//   });

// const token = () => crypto.randomBytes(24).toString('hex');

// const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

// const createBooking = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);

//   const { hospitalName, contactName, email, phone, city, message } = req.body || {};

//   if (!hospitalName || !contactName || !email) {
//     return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
//   }
//   if (!isValidEmail(email)) {
//     return res.status(400).json({ message: 'A valid email is required' });
//   }
//   if (phone && !/^\d{10}$/.test(String(phone).trim())) {
//     return res.status(400).json({ message: 'Phone must be a valid 10-digit mobile number' });
//   }

//   const schedule_token = token();
//   const row = {
//     hospital_name: String(hospitalName).trim(),
//     contact_name: String(contactName).trim(),
//     email: String(email).trim().toLowerCase(),
//     phone: phone ? String(phone).trim() : null,
//     city: city ? String(city).trim() : null,
//     message: message ? String(message).trim() : null,
//     status: 'invited',
//     schedule_token,
//     updated_at: new Date().toISOString()
//   };

//   console.log('[demos] insert row:', row);

//   const { data, error } = await supabase.from(TABLE).insert(row).select().single();
//   if (error) {
//     console.error('[demos] create error:', error);
//     return res.status(500).json({ message: 'Could not create booking' });
//   }

//   console.log('[demos] booking created:', data);
//   console.log('[demos] demo email to:', data?.email);
//   console.log('[demos] schedule email token:', schedule_token);

//   sendDemoReceived({
//     to: data.email,
//     contactName: data.contact_name,
//     hospitalName: data.hospital_name
//   }).catch((e) => console.error('[demos] received email failed:', e));

//   setTimeout(async () => {
//     try {
//       console.log('[demos] sending schedule invite after delay for:', data.email);
//       const scheduleResult = await sendScheduleInvite({
//         to: data.email,
//         contactName: data.contact_name,
//         hospitalName: data.hospital_name,
//         token: schedule_token
//       });
//       if (scheduleResult?.error || scheduleResult?.skipped) {
//         console.error('[demos] delayed invite email failed or skipped:', scheduleResult);
//       } else {
//         console.log('[demos] delayed invite email sent:', scheduleResult);
//       }
//     } catch (e) {
//       console.error('[demos] delayed invite flow failed:', e, { bookingId: data.id, schedule_token });
//     }
//   }, 10000);

//   return res.status(201).json({
//     message: 'Demo requested — scheduling invite queued',
//     booking: data,
//     scheduleEmailStatus: 'queued',
//     scheduleToken: schedule_token,
//     source: 'demoController-v2'
//   });
// };

// // ─── Enhanced listBookings with payment details ──────────────
// const listBookings = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);

//   const { status } = req.query;
//   let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
//   if (status && VALID_STATUS.includes(status)) query = query.eq('status', status);

//   const { data: bookings, error } = await query;
//   if (error) {
//     console.error('[demos] list error:', error);
//     return res.status(500).json({ message: 'Could not load bookings' });
//   }

//   // ─── Fetch payment info for each booking ──────────────────
//   const bookingIds = bookings.map(b => b.id).filter(id => id);
//   let paymentsMap = {};
//   if (bookingIds.length > 0) {
//     const { data: payments, error: payError } = await supabase
//       .from('payments')
//       .select('booking_id, amount, currency, status')
//       .in('booking_id', bookingIds);
//     if (!payError) {
//       paymentsMap = payments.reduce((acc, p) => {
//         acc[p.booking_id] = {
//           amount: p.amount,
//           currency: p.currency,
//           status: p.status
//         };
//         return acc;
//       }, {});
//     } else {
//       console.error('[demos] payment fetch error:', payError);
//     }
//   }

//   // ─── Map payment data and plan info to each booking ──────
//   const enhancedBookings = bookings.map(b => {
//     const payment = paymentsMap[b.id] || null;
//     let planName = null;
//     let planInterval = null;
//     if (payment) {
//       // Derive plan from amount using PLANS config
//       const matchedPlan = Object.entries(PLANS).find(([key, plan]) => plan.amount === payment.amount);
//       if (matchedPlan) {
//         const [key, plan] = matchedPlan;
//         planName = plan.name;
//         planInterval = plan.interval;
//       }
//     }
//     return {
//       ...b,
//       payment: payment ? {
//         amount: payment.amount,
//         currency: payment.currency,
//         status: payment.status,
//         plan: planName,
//         interval: planInterval
//       } : null
//     };
//   });

//   // ─── Counts (original logic) ──────────────────────────────
//   const counts = enhancedBookings.reduce(
//     (acc, b) => {
//       acc.total += 1;
//       acc[b.status] = (acc[b.status] || 0) + 1;
//       return acc;
//     },
//     { total: 0, requested: 0, invited: 0, scheduled: 0, completed: 0, cancelled: 0 }
//   );

//   return res.json({ bookings: enhancedBookings, counts });
// };

// // Note: scheduling invites are now sent automatically on booking creation.

// const updateBooking = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);

//   const { id } = req.params;
//   const { status, scheduledAt, meetingLink } = req.body || {};

//   const { data: existingBooking } = await supabase.from(TABLE).select('*').eq('id', id).single();
//   if (!existingBooking) return res.status(404).json({ message: 'Booking not found' });

//   const update = { updated_at: new Date().toISOString() };

//   if (status !== undefined) {
//     if (!VALID_STATUS.includes(status)) {
//       return res.status(400).json({ message: `status must be one of ${VALID_STATUS.join(', ')}` });
//     }
//     update.status = status;
//     if (status === 'completed' && !existingBooking.feedback_token) {
//       update.feedback_token = token();
//     }
//   }

//   if (scheduledAt !== undefined) update.scheduled_at = scheduledAt || null;
//   if (meetingLink !== undefined) update.meeting_link = meetingLink || null;

//   const { data, error } = await supabase.from(TABLE).update(update).eq('id', id).select().single();

//   if (error) {
//     if (error.code === '23505') {
//       return res.status(409).json({ message: 'That time is already booked. Choose another slot.' });
//     }
//     console.error('[demos] update error:', error);
//     return res.status(500).json({ message: 'Could not update booking' });
//   }

//   if (!data) return res.status(404).json({ message: 'Booking not found' });

//   if (status === 'completed' && data.email) {
//     const feedback_token = data.feedback_token || update.feedback_token;
//     sendFeedbackRequest({
//       to: data.email,
//       contactName: data.contact_name,
//       token: feedback_token
//     }).catch((e) => console.error('[demos] feedback email failed:', e));
//   }

//   if (meetingLink && String(meetingLink).trim() && data.status === 'scheduled') {
//     sendDemoConfirmation({
//       to: data.email,
//       contactName: data.contact_name,
//       hospitalName: data.hospital_name,
//       scheduledAt: data.scheduled_at,
//       meetingLink: data.meeting_link
//     }).catch((e) => console.error('[demos] meeting-link email failed:', e));
//   }

//   return res.json({ message: 'Booking updated', booking: data });
// };

// const completeBooking = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { id } = req.params;

//   const { data: booking, error: findErr } = await supabase.from(TABLE).select('*').eq('id', id).single();
//   if (findErr || !booking) return res.status(404).json({ message: 'Booking not found' });

//   const feedback_token = booking.feedback_token || token();

//   const { data, error } = await supabase
//     .from(TABLE)
//     .update({ status: 'completed', feedback_token, updated_at: new Date().toISOString() })
//     .eq('id', id)
//     .select()
//     .single();

//   if (error) {
//     console.error('[demos] complete error:', error);
//     return res.status(500).json({ message: 'Could not complete booking' });
//   }

//   sendFeedbackRequest({
//     to: data.email,
//     contactName: data.contact_name,
//     token: feedback_token
//   }).catch((e) => console.error('[demos] feedback email failed:', e));

//   return res.json({ message: 'Booking marked completed — feedback email sent', booking: data });
// };

// const deleteBooking = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { id } = req.params;
//   const { error } = await supabase.from(TABLE).delete().eq('id', id);

//   if (error) {
//     console.error('[demos] delete error:', error);
//     return res.status(500).json({ message: 'Could not delete booking' });
//   }

//   return res.json({ message: 'Booking deleted' });
// };

// module.exports = {
//   createBooking,
//   listBookings,
//   updateBooking,
//   completeBooking,
//   deleteBooking
// };


// controllers/demoController.js
const { supabase } = require('../config/supabase');
const { sendDemoReceived, sendScheduleInvite } = require('../services/emailService');

const TABLE = 'demo_bookings';

// ─── Create a new demo booking (public) ──────────────────────
const createBooking = async (req, res) => {
  const { hospitalName, contactName, email, phone, city, beds } = req.body;

  if (!hospitalName || !contactName || !email) {
    return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
  }

  try {
    // Generate a unique feedback token (you may already have this logic)
    const token = require('crypto').randomBytes(16).toString('hex');

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        hospital_name: hospitalName,
        contact_name: contactName,
        email,
        phone: phone || null,
        city: city || null,
        beds: beds || null,
        feedback_token: token,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation email
    await sendDemoReceived({ to: email, contactName, hospitalName });

    return res.status(201).json({
      message: 'Demo booking created successfully',
      booking: data,
      feedbackToken: token
    });
  } catch (error) {
    console.error('[demo] createBooking error:', error);
    return res.status(500).json({ message: 'Could not create booking' });
  }
};

// ─── List all demo bookings (superadmin only) ──────────────
const listBookings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('[demo] listBookings error:', error);
    return res.status(500).json({ message: 'Could not fetch bookings' });
  }
};

// ─── Invite to schedule (send scheduling link) ──────────────
const inviteToSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: booking, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Send scheduling invite email
    await sendScheduleInvite({
      to: booking.email,
      contactName: booking.contact_name,
      hospitalName: booking.hospital_name,
      token: booking.feedback_token
    });

    // Update status to invited
    await supabase
      .from(TABLE)
      .update({ status: 'invited', updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('[demo] inviteToSchedule error:', error);
    return res.status(500).json({ message: 'Could not send invitation' });
  }
};

// ─── Update booking details (superadmin) ────────────────────
const updateBooking = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Booking not found' });

    return res.json({ message: 'Booking updated successfully', booking: data });
  } catch (error) {
    console.error('[demo] updateBooking error:', error);
    return res.status(500).json({ message: 'Could not update booking' });
  }
};

// ─── Complete booking (mark as completed) ────────────────────
const completeBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Booking not found' });

    return res.json({ message: 'Booking completed successfully', booking: data });
  } catch (error) {
    console.error('[demo] completeBooking error:', error);
    return res.status(500).json({ message: 'Could not complete booking' });
  }
};

// ─── Delete booking (superadmin) ─────────────────────────────
const deleteBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('[demo] deleteBooking error:', error);
    return res.status(500).json({ message: 'Could not delete booking' });
  }
};

module.exports = {
  createBooking,
  listBookings,
  inviteToSchedule,
  updateBooking,
  completeBooking,
  deleteBooking   // ✅ now exported
};