const { supabase, isConfigured } = require('../config/supabase');
const scheduler = require('../services/schedulerService');
const calcom = require('../services/calcomService');
const { sendDemoConfirmation } = require('../services/emailService');

const TABLE = 'demo_bookings';

const notConfigured = (res) =>
  res.status(503).json({ message: 'Scheduling is not configured (Supabase).' });

const findByToken = (schedule_token) =>
  supabase.from(TABLE).select('*').eq('schedule_token', schedule_token).single();

// Times of other scheduled bookings, so the same instant can't clash (local mode).
const takenSlots = async (excludeId) => {
  let q = supabase.from(TABLE).select('scheduled_at').eq('status', 'scheduled').not('scheduled_at', 'is', null);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q;
  return (data || []).map((r) => r.scheduled_at);
};

const bookingView = (b) => ({
  id: b.id,
  hospitalName: b.hospital_name,
  contactName: b.contact_name,
  status: b.status,
  scheduledAt: b.scheduled_at,
  meetingLink: b.meeting_link
});

// GET /api/schedule/:token  (public) — booking summary + slots
const getScheduleInfo = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { token } = req.params;

  const { data: booking, error } = await findByToken(token);
  if (error || !booking) return res.status(404).json({ message: 'Invalid or expired scheduling link' });

  // If already scheduled, return booking info with no slots
  if (booking.status === 'scheduled' || booking.status === 'completed') {
    return res.json({
      booking: bookingView(booking),
      alreadyScheduled: true,
      scheduledAt: booking.scheduled_at,
      meetingLink: booking.meeting_link,
      slots: [],  // no slots to show
      provider: 'none'
    });
  }

  // Cal.com mode: full grid — green = available (→ Google Meet), red = already booked.
  if (calcom.isConfigured()) {
    try {
      const slots = await calcom.getSlotGrid(); // [{ iso, taken }]
      return res.json({ booking: bookingView(booking), slots, provider: 'calcom' });
    } catch (e) {
      console.error('[schedule] calcom slots failed, falling back to local:', e.message);
    }
  }

  // Local mode: our own grid with green/red availability.
  const taken = await takenSlots(booking.id);
  return res.json({ booking: bookingView(booking), slots: scheduler.slotsWithStatus(taken), provider: 'local' });
};

// POST /api/schedule/:token  (public) — book a chosen slot
const bookSlot = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { token } = req.params;
  const { slot } = req.body || {};
  if (!slot) return res.status(400).json({ message: 'A slot is required' });

  const { data: booking, error } = await findByToken(token);
  if (error || !booking) return res.status(404).json({ message: 'Invalid or expired scheduling link' });

  // revent double‑booking – check if already scheduled
  if (booking.status === 'scheduled' || booking.status === 'completed') {
    return res.status(409).json({ message: 'This demo is already scheduled.' });
  }

  let scheduledAt = new Date(slot).toISOString();
  let meetingLink = null;

  // Cal.com mode: create the real booking → Google Meet link.
  if (calcom.isConfigured()) {
    try {
      const cb = await calcom.createBooking({ start: slot, name: booking.contact_name, email: booking.email });
      meetingLink = cb.meetingUrl;
      if (cb.start) scheduledAt = new Date(cb.start).toISOString();
    } catch (e) {
      console.error('[schedule] calcom booking failed:', e.message);
      return res.status(409).json({ message: 'That time is no longer available. Please pick another slot.' });
    }
  } else {
    // Local mode: validate against our generated grid + taken set.
    const taken = await takenSlots(booking.id);
    if (!scheduler.isSlotValid(slot, taken)) {
      return res.status(409).json({ message: 'That time is no longer available. Please pick another slot.' });
    }
  }

  const { data, error: upErr } = await supabase
    .from(TABLE)
    .update({ status: 'scheduled', scheduled_at: scheduledAt, meeting_link: meetingLink, updated_at: new Date().toISOString() })
    .eq('id', booking.id)
    .select()
    .single();

  if (upErr) {
    if (upErr.code === '23505') return res.status(409).json({ message: 'That time was just taken. Please pick another slot.' });
    console.error('[schedule] book error:', upErr);
    return res.status(500).json({ message: 'Could not book that slot' });
  }

  sendDemoConfirmation({
    to: data.email,
    contactName: data.contact_name,
    hospitalName: data.hospital_name,
    scheduledAt: data.scheduled_at,
    meetingLink: data.meeting_link
  }).catch((e) => console.error('[schedule] confirmation email failed:', e));

  return res.json({
    message: 'Demo scheduled',
    booking: { scheduledAt: data.scheduled_at, meetingLink: data.meeting_link, hospitalName: data.hospital_name }
  });
};

module.exports = { getScheduleInfo, bookSlot };