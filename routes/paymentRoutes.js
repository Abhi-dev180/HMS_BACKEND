const express = require('express');
const router = express.Router();

const { verifySession, verifyUpiPayment, webhook } = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');
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
router.post('/verify-upi', verifyUpiPayment);

// Stripe webhook – must be mounted with express.raw in app.js on this exact path
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// Admin-only: re-sync a Stripe session into payments/subscriptions (helpful for backfill)
router.post('/sync-session', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ message: 'session_id is required' });
    const result = await require('../controllers/paymentController').syncSession(session_id);
    return res.json(result);
  } catch (e) {
    console.error('[payments] sync-session error:', e);
    return res.status(500).json({ message: 'sync failed' });
  }
});

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

    // Insert a pending payment record with the correct booking_id
    const plan = PLANS[planKey] || PLANS['basic'];
    const { error: insertError } = await supabase.from('payments').insert({
      booking_id: bookingId,      // now uses the real booking ID (or null if not found)
      email: booking.email,
      stripe_session_id: session.id,
      plan_key: planKey || 'basic',
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

// ─── PayPal Routes ─────────────────────────────────────────────
const paypalSvc = require('../services/paypalService');
const razorpaySvc = require('../services/razorpayService');
const { generateInvoice } = require('../services/invoiceService');
const emailSvc = require('../services/emailService');
const { broadcast } = require('../services/websocketService');

router.post('/paypal/create-order', async (req, res) => {
  try {
    const { booking, planKey, returnUrl, cancelUrl } = req.body;
    
    // Prevent double payments
    if (booking?.id && isValidUUID(booking.id)) {
      const { data: dbPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('booking_id', booking.id)
        .eq('status', 'paid')
        .maybeSingle();
      if (dbPayment) {
        return res.status(400).json({ message: 'Payment already completed for this booking' });
      }
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const order = await paypalSvc.createOrder({ booking, planKey, amount: plan.amount, returnUrl, cancelUrl });
    
    if (booking?.id && isValidUUID(booking.id)) {
      await supabase.from('payments').insert({
        booking_id: booking.id,
        email: booking.email || 'customer@example.com',
        paypal_order_id: order.id,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'pending'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('[PayPal] create order error:', error);
    res.status(500).json({ message: 'Failed to create PayPal order' });
  }
});

router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { orderId, booking, planKey } = req.body;
    const capture = await paypalSvc.captureOrder(orderId);
    const plan = PLANS[planKey] || PLANS['basic'];

    // Mark as completed in DB
    let updatedDemo = null;
    let validBookingId = booking?.id && isValidUUID(booking.id) ? booking.id : null;

    if (validBookingId) {
      const { data } = await supabase
        .from("demo_bookings")
        .update({
          status: "completed",
          stripe_invoice_id: capture.id, // using capture ID as transaction/billing ID
          amount: plan.amount,
          currency: 'usd',
          updated_at: new Date().toISOString(),
        })
        .eq("id", validBookingId)
        .select()
        .single();
      
      updatedDemo = data;
    }

    // Update record in payments table so SuperAdmin UI sees it
    const { data: updatedPay, error: updErr } = await supabase.from('payments').update({
      stripe_session_id: capture.id,
      status: 'paid'
    }).eq('booking_id', validBookingId).select();
    
    if (updErr) console.error('[PayPal] Payment update error:', updErr);

    // Fallback: If no pending payment existed to update, insert a new one
    if (!updatedPay || updatedPay.length === 0) {
      await supabase.from('payments').insert({
        booking_id: validBookingId,
        email: booking?.email || 'customer@example.com',
        stripe_session_id: capture.id,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'paid'
      });
    }

    const startDate = new Date().toLocaleDateString();
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString();

    // Generate Invoice
    const invoicePdfBuffer = await generateInvoice({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'PayPal',
      transactionId: capture.id,
      date: new Date().toLocaleDateString(),
      startDate,
      endDate
    });

    // Send Invoice Email to Customer
    await emailSvc.sendInvoicePaidEmail({
      to: booking.email,
      contactName: booking.contact_name || 'User',
      hospitalName: booking.hospital_name || 'Hospital',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'PayPal',
      invoiceId: capture.id,
      startDate,
      endDate,
      invoicePdfBuffer
    });

    // Notify Superadmin
    await emailSvc.sendPaymentReceivedToSuperAdmin({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      email: booking.email || 'customer@example.com',
      phone: booking.phone || '',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'PayPal',
      invoiceId: capture.id,
      startDate,
      endDate
    });

    if (updatedDemo) {
      broadcast('demo_updated', updatedDemo);
    }

    res.json({ success: true, capture });
  } catch (error) {
    console.error('[PayPal] capture order error:', error);
    res.status(500).json({ message: 'Failed to capture PayPal order' });
  }
});

// ─── Razorpay Routes ───────────────────────────────────────────
router.post('/razorpay/create-order', async (req, res) => {
  try {
    const { booking, planKey } = req.body;

    // Prevent double payments
    if (booking?.id && isValidUUID(booking.id)) {
      const { data: dbPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('booking_id', booking.id)
        .eq('status', 'paid')
        .maybeSingle();
      if (dbPayment) {
        return res.status(400).json({ message: 'Payment already completed for this booking' });
      }
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const order = await razorpaySvc.createOrder({ booking, planKey, amount: plan.amount });
    
    if (booking?.id && isValidUUID(booking.id)) {
      await supabase.from('payments').insert({
        booking_id: booking.id,
        email: booking.email || 'customer@example.com',
        razorpay_order_id: order.id,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'pending'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('[Razorpay] create order error:', error);
    res.status(500).json({ message: 'Failed to create Razorpay order' });
  }
});

router.post('/razorpay/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking, planKey } = req.body;
    
    const isValid = razorpaySvc.verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const transactionId = razorpay_payment_id || `DUMMY_${Date.now()}`;

    // Mark as completed in DB
    let updatedDemo = null;
    let validBookingId = booking?.id && isValidUUID(booking.id) ? booking.id : null;

    if (validBookingId) {
      const { data } = await supabase
        .from("demo_bookings")
        .update({
          status: "completed",
          stripe_invoice_id: transactionId, 
          amount: plan.amount,
          currency: 'usd',
          updated_at: new Date().toISOString(),
        })
        .eq("id", validBookingId)
        .select()
        .single();
        
      updatedDemo = data;
    }

    // Update record in payments table so SuperAdmin UI sees it
    const { data: updatedPay, error: updErr } = await supabase.from('payments').update({
      stripe_session_id: transactionId,
      status: 'paid'
    }).eq('booking_id', validBookingId).select();
    
    if (updErr) console.error('[Razorpay] Payment update error:', updErr);

    // Fallback: If no pending payment existed to update, insert a new one
    if (!updatedPay || updatedPay.length === 0) {
      await supabase.from('payments').insert({
        booking_id: validBookingId,
        email: booking?.email || 'customer@example.com',
        stripe_session_id: transactionId,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'paid'
      });
    }

    const startDate = new Date().toLocaleDateString();
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString();

    // Generate Invoice
    const invoicePdfBuffer = await generateInvoice({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'Razorpay UPI',
      transactionId,
      date: new Date().toLocaleDateString(),
      startDate,
      endDate
    });

    // Send Invoice Email to Customer
    await emailSvc.sendInvoicePaidEmail({
      to: booking.email,
      contactName: booking.contact_name || 'User',
      hospitalName: booking.hospital_name || 'Hospital',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'Razorpay UPI',
      invoiceId: transactionId,
      startDate,
      endDate,
      invoicePdfBuffer
    });

    // Notify Superadmin
    await emailSvc.sendPaymentReceivedToSuperAdmin({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      email: booking.email || 'customer@example.com',
      phone: booking.phone || '',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'Razorpay UPI',
      invoiceId: transactionId,
      startDate,
      endDate
    });

    if (updatedDemo) {
      broadcast('demo_updated', updatedDemo);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Razorpay] verify payment error:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
});

module.exports = router;