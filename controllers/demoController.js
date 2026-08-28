const { supabase } = require('../config/supabase');
const { sendDemoReceived, sendScheduleInvite, sendFeedbackRequest } = require('../services/emailService');
const { broadcast } = require('../services/websocketService');
const { readDB, writeDB } = require('../models');

const TABLE = 'demo_bookings';

// ─── Create a new demo booking (public) ──────────────────────
const createBooking = async (req, res) => {
  const { hospitalName, contactName, email, phone, city, message, beds } = req.body;

  if (!hospitalName || !contactName || !email) {
    return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
  }

  try {
    const token = require('crypto').randomBytes(16).toString('hex');

    const insertData = {
      hospital_name: hospitalName,
      contact_name: contactName,
      email,
      phone: phone || null,
      city: city || null,
      feedback_token: token,
      status: 'requested'
    };
    if (message) insertData.message = message;

    let data = null;
    if (supabase) {
      try {
        const resInsert = await supabase.from(TABLE).insert(insertData).select().single();
        if (!resInsert.error && resInsert.data) data = resInsert.data;
      } catch (e) {}
    }

    if (!data) {
      const db = readDB();
      db.demos = db.demos || [];
      data = { id: Date.now().toString(), ...insertData, created_at: new Date().toISOString() };
      db.demos.unshift(data);
      writeDB(db);
    }

    // Send immediate email with scheduling link
    await sendDemoReceived({
      to: email,
      contactName,
      hospitalName,
      token,
      bookingId: data.id
    }).catch((e) => console.error('[demo] sendDemoReceived failed:', e));

    broadcast('demo_created', data);
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
    const { readDB } = require('../models');
    const { PLANS } = require('../config/stripePlans');
    const db = readDB();

    // 1. Get Supabase demo bookings if available
    let supaBookings = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*, payments(*)')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) supaBookings = data;
      } catch (e) {}
    }

    // 2. Get local db.demos
    const localBookings = db.demos || [];

    // 3. Merge Supabase + local db.demos
    const demoMap = new Map();
    supaBookings.forEach((b) => demoMap.set(String(b.id), b));
    localBookings.forEach((b) => {
      if (!demoMap.has(String(b.id))) {
        demoMap.set(String(b.id), b);
      }
    });

    const rawList = Array.from(demoMap.values());
    const allPayments = db.payments || [];
    const allSubscriptions = db.subscriptions || [];

    const formattedData = await Promise.all(
      rawList.map(async (booking) => {
        let paymentInfo = null;

        // Check explicit attached payments first
        if (booking.payments && booking.payments.length > 0) {
          const payment = booking.payments.find((p) => p.status === 'paid') || booking.payments[0];
          const planKey = payment.plan_key || 'basic';
          const planObj = PLANS[planKey] || PLANS['basic'];

          paymentInfo = {
            plan: planObj?.name || 'Basic Plan',
            interval: planObj?.intervalLabel || 'quarterly',
            amount: payment.amount || planObj?.amount || 20000,
            currency: payment.currency || 'usd',
            status: payment.status || 'paid'
          };
        }

        // Check local or Supabase payments by email
        if (!paymentInfo && booking.email) {
          const matchedPay = allPayments.find(
            (p) => String(p.email || '').toLowerCase() === String(booking.email).toLowerCase()
          );
          if (matchedPay) {
            const planKey = matchedPay.plan_key || 'basic';
            const planObj = PLANS[planKey] || PLANS['basic'];
            paymentInfo = {
              plan: planObj?.name || 'Basic Plan',
              interval: planObj?.intervalLabel || 'quarterly',
              amount: matchedPay.amount || planObj?.amount || 20000,
              currency: matchedPay.currency || 'usd',
              status: matchedPay.status || 'paid'
            };
          }
        }

        // Check local or Supabase subscriptions by user email or user_id
        if (!paymentInfo && booking.email) {
          const matchedSub = allSubscriptions.find(
            (s) => String(s.user_id) === String(booking.id) || String(s.email || '').toLowerCase() === String(booking.email).toLowerCase()
          );
          if (matchedSub) {
            const planKey = matchedSub.plan_key || 'basic';
            const planObj = PLANS[planKey] || PLANS['basic'];
            paymentInfo = {
              plan: planObj?.name || 'Basic Plan',
              interval: planObj?.intervalLabel || 'quarterly',
              amount: matchedSub.amount || planObj?.amount || 20000,
              currency: matchedSub.currency || 'usd',
              status: matchedSub.status || 'active',
              startDate: matchedSub.start_date,
              endDate: matchedSub.expiry_date
            };
          }
        }

        // Check direct attributes on booking (amount, plan_key, status) or construct default
        if (!paymentInfo) {
          const planKey = booking.plan_key || 'basic';
          const planObj = PLANS[planKey] || PLANS['basic'];
          paymentInfo = {
            plan: planObj?.name || 'Basic Plan',
            interval: planObj?.intervalLabel || 'quarterly',
            amount: booking.amount || planObj?.amount || 20000,
            currency: booking.currency || 'usd',
            status: booking.status === 'completed' ? 'paid' : (booking.status === 'scheduled' ? 'paid' : 'pending')
          };
        }

        const { payments, ...rest } = booking;
        return {
          ...rest,
          payment: paymentInfo
        };
      })
    );

    const counts = rawList.reduce(
      (acc, item) => {
        acc.total += 1;
        const status = item.status || 'requested';
        if (acc[status] !== undefined) acc[status] += 1;
        return acc;
      },
      { total: 0, requested: 0, invited: 0, scheduled: 0, completed: 0, cancelled: 0 }
    );

    return res.json({ bookings: formattedData, counts });
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

    await sendScheduleInvite({
      to: booking.email,
      contactName: booking.contact_name,
      hospitalName: booking.hospital_name,
      token: booking.feedback_token
    });

    const { data: updatedData } = await supabase
      .from(TABLE)
      .update({ status: 'invited', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    broadcast('demo_updated', updatedData);
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

    broadcast('demo_updated', data);
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
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Fallback if 'completed_at' column missing
      if (error.message && error.message.includes('completed_at')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from(TABLE)
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        // Send feedback request email
        if (fallbackData?.email) {
          await sendFeedbackRequest({
            to: fallbackData.email,
            contactName: fallbackData.contact_name,
            token: fallbackData.feedback_token
          }).catch(e => console.error('[demo] feedback request email failed:', e));
        }
        broadcast('demo_updated', fallbackData);
        return res.json({ message: 'Booking completed successfully', booking: fallbackData });
      }
      throw error;
    }

    // Send feedback request email
    if (data.email) {
      await sendFeedbackRequest({
        to: data.email,
        contactName: data.contact_name,
        token: data.feedback_token
      }).catch(e => console.error('[demo] feedback request email failed:', e));
    }

    broadcast('demo_updated', data);
    return res.json({ message: 'Booking completed successfully', booking: data });
  } catch (error) {
    console.error('[demo] completeBooking error:', error);
    return res.status(500).json({ message: 'Could not complete booking' });
  }
};

// ─── DELETE: Delete booking (superadmin) ─────────────────────
const deleteBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;

    broadcast('demo_deleted', { id });
    return res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('[demo] deleteBooking error:', error);
    return res.status(500).json({ message: 'Could not delete booking' });
  }
};

// ─── NEW: Cal.com Webhook to save the Zoom Link AND SEND EMAIL ──
const handleCalWebhook = async (req, res) => {
  try {
    console.log('[demo] Cal.com Webhook received. Body:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    const payload = body.payload || body;

    const zoomLink = payload.location || payload.meetingUrl || payload.videoCallUrl;
    let email = payload.email;
    if (!email && payload.attendees && payload.attendees.length > 0) {
      email = payload.attendees[0].email;
    }
    const scheduledAt = payload.startTime || payload.start;

    if (!zoomLink || !email) {
      console.warn('[demo] Webhook missing email or link:', { email, zoomLink });
      return res.status(400).json({ message: 'Missing email or meeting link' });
    }

    // 1. Find the latest booking for this email to update
    const { data: latestBooking, error: findError } = await supabase
      .from(TABLE)
      .select('id, contact_name, hospital_name, status')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !latestBooking) {
      console.error('[demo] Webhook: No booking found for email:', email, findError);
      return res.status(404).json({ message: 'No booking found for email' });
    }

    // 2. Update the demo_bookings table, FORCE overwriting whatever is in meeting_link
    const { error, data } = await supabase
      .from(TABLE)
      .update({ 
        meeting_link: zoomLink, 
        status: 'scheduled',
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', latestBooking.id)
      .select()
      .single();

    if (error) {
      console.error('[demo] Webhook Update Error:', error);
      return res.status(500).json({ message: 'DB Update Failed' });
    }

    // 3. Trigger the EMAIL now that the Zoom link exists
    if (email && data) {
      const { sendDemoConfirmation } = require('../services/emailService');
      await sendDemoConfirmation({
        to: email,
        contactName: data.contact_name,
        hospitalName: data.hospital_name,
        scheduledAt: data.scheduled_at,
        meetingLink: zoomLink 
      }).catch(e => console.error('[demo] confirmation email failed:', e));
    }

    broadcast('demo_updated', data);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[demo] Webhook Error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  createBooking,
  listBookings,
  inviteToSchedule,
  updateBooking,
  completeBooking,
  deleteBooking,
  handleCalWebhook // <-- Export the webhook
};