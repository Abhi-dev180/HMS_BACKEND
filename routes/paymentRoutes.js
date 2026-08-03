// const express = require('express');
// const { verifySession } = require('../controllers/paymentController');

// const router = express.Router();

// // Public — the registration page verifies the Stripe session before showing the form
// router.get('/verify', verifySession);

// module.exports = router;


// const express = require('express');
// const router = express.Router();

// const { verifySession, webhook } = require('../controllers/paymentController');
// const stripeSvc = require('../services/stripeService');

// // Public verify route
// router.get('/verify', verifySession);

// // Stripe webhook must be mounted with express.raw in app.js on this exact path
// router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// // Create checkout session
// router.post('/create-checkout-session', async (req, res) => {
//   try {
//     if (!stripeSvc.isConfigured()) {
//       return res.status(503).json({ message: 'Stripe not configured' });
//     }

//     const { booking, feedbackToken, planKey } = req.body;

//     if (!booking?.email) {
//       return res.status(400).json({ message: 'booking.email is required' });
//     }

//     const session = await stripeSvc.createCheckoutSession({
//       booking,
//       feedbackToken,
//       planKey
//     });

//     return res.json({
//       id: session.id,
//       url: session.url
//     });
//   } catch (error) {
//     console.error('[payments] create checkout error:', error);
//     return res.status(500).json({ message: error.message || 'Failed to create checkout session' });
//   }
// });

// module.exports = router;


// const express = require('express');
// const router = express.Router();

// const { verifySession, webhook } = require('../controllers/paymentController');
// const stripeSvc = require('../services/stripeService');

// // Public verify route
// router.get('/verify', verifySession);

// // Stripe webhook – must be mounted with express.raw in app.js on this exact path
// router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// // ─── Create one‑time checkout session ────────────────────────
// router.post('/create-checkout-session', async (req, res) => {
//   try {
//     if (!stripeSvc.isConfigured()) {
//       return res.status(503).json({ message: 'Stripe not configured' });
//     }

//     const { booking, feedbackToken, planKey } = req.body;

//     // Validate required fields
//     if (!booking) {
//       return res.status(400).json({ message: 'booking is required' });
//     }
//     if (!booking.email) {
//       return res.status(400).json({ message: 'booking.email is required' });
//     }

//     console.log('[payment] Creating checkout session:', { 
//       email: booking.email, 
//       hospital: booking.hospital_name,
//       plan: planKey 
//     });

//     // ✅ Use the correct function name – createOneTimeCheckout (not createCheckoutSession)
//     const session = await stripeSvc.createOneTimeCheckout({
//       booking,
//       feedbackToken,
//       planKey: planKey || 'basic'
//     });

//     return res.json({
//       id: session.id,
//       url: session.url
//     });
//   } catch (error) {
//     console.error('[payments] create checkout error:', error);
//     return res.status(500).json({ 
//       message: error.message || 'Failed to create checkout session' 
//     });
//   }
// });

// module.exports = router;

// const express = require('express');
// const router = express.Router();

// const { verifySession, webhook } = require('../controllers/paymentController');
// const stripeSvc = require('../services/stripeService');
// const { supabase } = require('../config/supabase');
// const { PLANS } = require('../config/stripePlans');

// // Public verify route
// router.get('/verify', verifySession);

// // Stripe webhook – must be mounted with express.raw in app.js on this exact path
// router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// // ─── Create one‑time checkout session ────────────────────────
// router.post('/create-checkout-session', async (req, res) => {
//   try {
//     if (!stripeSvc.isConfigured()) {
//       return res.status(503).json({ message: 'Stripe not configured' });
//     }

//     const { booking, feedbackToken, planKey } = req.body;

//     // Validate required fields
//     if (!booking) {
//       return res.status(400).json({ message: 'booking is required' });
//     }
//     if (!booking.email) {
//       return res.status(400).json({ message: 'booking.email is required' });
//     }

//     console.log('[payment] Creating checkout session:', { 
//       email: booking.email, 
//       hospital: booking.hospital_name,
//       plan: planKey 
//     });

//     // Create the Stripe session
//     const session = await stripeSvc.createOneTimeCheckout({
//       booking,
//       feedbackToken,
//       planKey: planKey || 'basic'
//     });

//     // ✅ Insert a pending payment record (THIS WAS MISSING)
//     const plan = PLANS[planKey] || PLANS['basic'];
//     const { error: insertError } = await supabase.from('payments').insert({
//       booking_id: booking.id || 'demo-booking',
//       email: booking.email,
//       stripe_session_id: session.id,
//       amount: plan.amount,
//       currency: 'usd',
//       status: 'pending'
//     });

//     if (insertError) {
//       console.error('[payments] insert error:', insertError);
//     } else {
//       console.log('[payments] Pending payment record inserted for session:', session.id);
//     }

//     return res.json({
//       id: session.id,
//       url: session.url
//     });
//   } catch (error) {
//     console.error('[payments] create checkout error:', error);
//     return res.status(500).json({ 
//       message: error.message || 'Failed to create checkout session' 
//     });
//   }
// });

// module.exports = router;



// const express = require('express');
// const router = express.Router();

// const { verifySession, webhook } = require('../controllers/paymentController');
// const stripeSvc = require('../services/stripeService');
// const { supabase } = require('../config/supabase');
// const { PLANS } = require('../config/stripePlans');

// // Helper: check if a string is a valid UUID
// const isValidUUID = (id) => {
//   return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
// };

// // Public verify route
// router.get('/verify', verifySession);

// // Stripe webhook – must be mounted with express.raw in app.js on this exact path
// router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// // ─── Create one‑time checkout session ────────────────────────
// router.post('/create-checkout-session', async (req, res) => {
//   try {
//     if (!stripeSvc.isConfigured()) {
//       return res.status(503).json({ message: 'Stripe not configured' });
//     }

//     const { booking, feedbackToken, planKey } = req.body;

//     // Validate required fields
//     if (!booking) {
//       return res.status(400).json({ message: 'booking is required' });
//     }
//     if (!booking.email) {
//       return res.status(400).json({ message: 'booking.email is required' });
//     }

//     console.log('[payment] Creating checkout session:', { 
//       email: booking.email, 
//       hospital: booking.hospital_name,
//       plan: planKey 
//     });

//     // Create the Stripe session
//     const session = await stripeSvc.createOneTimeCheckout({
//       booking,
//       feedbackToken,
//       planKey: planKey || 'basic'
//     });

//     // ✅ Insert a pending payment record – with valid UUID or null
//     const plan = PLANS[planKey] || PLANS['basic'];
//     const bookingId = (booking.id && isValidUUID(booking.id)) ? booking.id : null;

//     const { error: insertError } = await supabase.from('payments').insert({
//       booking_id: bookingId,      // ✅ null if invalid/absent
//       email: booking.email,
//       stripe_session_id: session.id,
//       amount: plan.amount,
//       currency: 'usd',
//       status: 'pending'
//     });

//     if (insertError) {
//       console.error('[payments] insert error:', insertError);
//     } else {
//       console.log('[payments] Pending payment record inserted for session:', session.id);
//     }

//     return res.json({
//       id: session.id,
//       url: session.url
//     });
//   } catch (error) {
//     console.error('[payments] create checkout error:', error);
//     return res.status(500).json({ 
//       message: error.message || 'Failed to create checkout session' 
//     });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();

const { verifySession, webhook } = require('../controllers/paymentController');
const stripeSvc = require('../services/stripeService');
const { supabase } = require('../config/supabase');
const { PLANS, getPublicPlans } = require('../config/stripePlans');

// Helper: check if a string is a valid UUID
const isValidUUID = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Public — pricing page reads its plans from here (config/stripePlans.js)
router.get('/plans', (req, res) => res.json({ plans: getPublicPlans() }));

// Public verify route
router.get('/verify', verifySession);

// Stripe webhook – must be mounted with express.raw in app.js on this exact path
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// ─── Create one‑time checkout session ────────────────────────
router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripeSvc.isConfigured()) {
      return res.status(503).json({ message: 'Stripe not configured' });
    }

    const { booking, feedbackToken, planKey } = req.body;

    // Validate required fields
    if (!booking) {
      return res.status(400).json({ message: 'booking is required' });
    }
    if (!booking.email) {
      return res.status(400).json({ message: 'booking.email is required' });
    }

    console.log('[payment] Creating checkout session:', {
      email: booking.email,
      hospital: booking.hospital_name,
      plan: planKey,
      feedbackToken
    });

    // ─── Get the real booking ID from the feedback token ───
    let bookingId = null;
    if (feedbackToken) {
      const { data: bookingData, error: bookingError } = await supabase
        .from('demo_bookings')
        .select('id')
        .eq('feedback_token', feedbackToken)
        .maybeSingle(); // use maybeSingle() to avoid error if not found
      if (!bookingError && bookingData) {
        bookingId = bookingData.id;
        console.log('[payment] Found booking ID from feedback token:', bookingId);
      } else {
        console.log('[payment] No booking found for feedback token:', feedbackToken);
      }
    }

    // If still null, try using the booking.id from the request if it's a valid UUID
    if (!bookingId && booking.id && isValidUUID(booking.id)) {
      bookingId = booking.id;
    }

    // Create the Stripe session
    const session = await stripeSvc.createOneTimeCheckout({
      booking,
      feedbackToken,
      planKey: planKey || 'basic'
    });

    // ✅ Insert a pending payment record with the correct booking_id
    const plan = PLANS[planKey] || PLANS['basic'];
    const { error: insertError } = await supabase.from('payments').insert({
      booking_id: bookingId,      // now uses the real booking ID (or null if not found)
      email: booking.email,
      stripe_session_id: session.id,
      amount: plan.amount,
      currency: 'usd',
      status: 'pending'
    });

    if (insertError) {
      console.error('[payments] insert error:', insertError);
    } else {
      console.log('[payments] Pending payment record inserted for session:', session.id, 'booking_id:', bookingId);
    }

    return res.json({
      id: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('[payments] create checkout error:', error);
    return res.status(500).json({
      message: error.message || 'Failed to create checkout session'
    });
  }
});

module.exports = router;