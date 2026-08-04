
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