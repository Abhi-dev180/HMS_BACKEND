const { supabase, isConfigured } = require('../config/supabase');
const stripeSvc = require('../services/stripeService');

const TABLE = 'demo_bookings';

const notConfigured = (res) =>
  res.status(503).json({ message: 'Feedback storage is not configured (Supabase).' });

const findByFeedbackToken = (feedback_token) =>
  supabase.from(TABLE).select('*').eq('feedback_token', feedback_token).single();

// GET /api/feedback/:token  (public) — booking summary for the feedback page
const getFeedbackInfo = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { token } = req.params;

  const { data: booking, error } = await findByFeedbackToken(token);
  if (error || !booking) return res.status(404).json({ message: 'Invalid or expired feedback link' });

  const { data: existing } = await supabase
    .from('demo_feedback')
    .select('id, rating, interested')
    .eq('booking_id', booking.id)
    .maybeSingle();

  return res.json({
    booking: { 
      id: booking.id,
      hospitalName: booking.hospital_name, 
      contactName: booking.contact_name,
      email: booking.email
    },
    alreadySubmitted: !!existing,
    stripeEnabled: stripeSvc.isConfigured(),
    price: { amount: stripeSvc.AMOUNT, currency: stripeSvc.CURRENCY }
  });
};

// POST /api/feedback/:token  (public) — submit rating/interest; if interested → Stripe checkout
const submitFeedback = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { token } = req.params;
  const { rating, interested, comment } = req.body || {};

  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ message: 'Rating must be an integer from 1 to 5' });
  }

  const { data: booking, error } = await findByFeedbackToken(token);
  if (error || !booking) return res.status(404).json({ message: 'Invalid or expired feedback link' });

  const { error: insErr } = await supabase.from('demo_feedback').insert({
    booking_id: booking.id,
    rating: r,
    interested: !!interested,
    comment: comment ? String(comment).trim() : null
  });
  if (insErr) {
    console.error('[feedback] insert error:', insErr);
    return res.status(500).json({ message: 'Could not save feedback' });
  }

  // Not interested → thank-you, no payment.
  if (!interested) {
    return res.json({ message: 'Thanks for your feedback!', interested: false });
  }

  // Interested → redirect user to the 3-tier payment plan page (/pricing?token=...)
  return res.json({
    message: 'Feedback received! Please select a payment plan.',
    interested: true,
    redirectUrl: `/pricing?token=${token}`
  });
};

module.exports = { getFeedbackInfo, submitFeedback };
