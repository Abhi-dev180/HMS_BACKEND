const secret = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const { PLANS } = require('../config/stripePlans');

// ─── Helper to ensure absolute URL with http(s) protocol ───
const getBaseUrl = () => {
  let raw =
    process.env.FRONTEND_REDIRECT_URL ||
    (process.env.FRONTEND_URL || 'https://hospital-management-sigma-six.vercel.app').split(',')[0]?.trim();
  if (!raw) raw = 'https://hospital-management-sigma-six.vercel.app';
  raw = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw;
};

const looksReal = (k) => typeof k === 'string' && k.startsWith('sk_') && !k.includes('...');

let stripe = null;

if (secret && looksReal(secret)) {
  stripe = require('stripe')(secret);
} else if (secret) {
  console.warn('[stripe] STRIPE_SECRET_KEY looks like a placeholder — payments disabled until a real key is set.');
} else {
  console.warn('[stripe] STRIPE_SECRET_KEY not set — payment endpoints will return 503 until configured.');
}

const isConfigured = () => stripe !== null;

// ─── Create a subscription checkout session ──────────────────
const createSubscriptionCheckout = async ({
  userId,
  hospitalId,
  planKey = 'basic',
  successPath = '/dashboard',
  cancelPath = '/pricing',
  booking = null
}) => {
  if (!stripe) throw new Error('Stripe not configured');

  const plan = PLANS[planKey];
  if (!plan) throw new Error(`Invalid plan: ${planKey}`);

  const baseUrl = getBaseUrl();
  const planType = plan.interval || 'monthly';
  
  let descriptionText = `${plan.name} - ${plan.interval} subscription`;
  if (booking) {
    descriptionText += `\n\nDemo Booking Info:
Hospital: ${booking.hospital_name || 'N/A'}
Contact: ${booking.contact_name || 'N/A'}
Email: ${booking.email || 'N/A'}`;
  }

  const priceData = {
    currency: 'usd',
    product_data: {
      name: `Pet Hospital Portal — ${plan.name}`,
      description: descriptionText
    },
    unit_amount: plan.amount,
    recurring: {
      interval: plan.interval,          
      interval_count: plan.interval_count || 1
    }
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price_data: priceData, quantity: 1 }],
    subscription_data: {
      description: descriptionText,
      metadata: {
        user_id: String(userId || ''),
        plan_key: planKey
      }
    },
    metadata: {
      user_id: String(userId || ''),
      hospital_id: String(hospitalId || ''),
      plan_key: planKey
    },
    success_url: `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${cancelPath}?canceled=true`,
    allow_promotion_codes: true
  });

  console.log('[stripe] Subscription checkout created:', {
    sessionId: session.id,
    plan: planKey,
    user: userId
  });

  return session;
};

// ─── Create a one-time payment checkout (for one-time plans) ──
const createOneTimeCheckout = async ({
  booking = {},
  feedbackToken = '',
  planKey = 'basic'
}) => {
  if (!stripe) throw new Error('Stripe not configured');

  const plan = PLANS[planKey] || PLANS['basic'];
  const baseUrl = getBaseUrl();
  const tokenPath = feedbackToken ? `/${encodeURIComponent(feedbackToken)}` : '';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: booking.email || undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Pet Hospital Portal — ${plan.name}`,
            description: `Onboarding for ${booking.hospital_name || booking.hospitalName || booking.hospital || 'Pet Hospital'}`
          },
          unit_amount: plan.amount
        },
        quantity: 1
      }
    ],
    metadata: {
      booking_id: String(booking.id || ''),
      feedback_token: String(feedbackToken || ''),
      plan_key: String(planKey),
      payment_type: 'one-time'
    },
    success_url: `${baseUrl}/register${tokenPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: feedbackToken 
      ? `${baseUrl}/pricing?token=${encodeURIComponent(feedbackToken)}&payment=cancelled`
      : `${baseUrl}/pricing?payment=cancelled`
  });

  return session;
};

// ─── Retrieve session with optional expand ──────────────────
const retrieveSession = (id, expand = []) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.checkout.sessions.retrieve(id, { expand });
};

// ─── Retrieve subscription ──────────────────────────────────
const retrieveSubscription = (id) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.subscriptions.retrieve(id);
};

// ─── Retrieve invoice (with expand) ─────────────────────────
const retrieveInvoice = (id, expand = []) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.invoices.retrieve(id, { expand });
};

// ─── Send invoice via Stripe ──────────────────────────────────
const sendInvoice = async (id) => {
  if (!stripe) throw new Error('Stripe not configured');
  try {
    return await stripe.invoices.sendInvoice(id);
  } catch (error) {
    console.error(`[stripe] Failed to send invoice ${id}:`, error.message);
    throw error;
  }
};

// ─── Retrieve payment intent ──────────────────────────────
const retrievePaymentIntent = (id, expand = []) => {
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.paymentIntents.retrieve(id, { expand });
};

const looksRealWebhook = (k) => typeof k === 'string' && k.startsWith('whsec_') && !k.includes('...');
const webhookConfigured = () => !!(stripe && looksRealWebhook(WEBHOOK_SECRET));

const constructWebhookEvent = (rawBody, signature) =>
  stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

// ─── Cancel subscription ──────────────────────────────────────
const cancelSubscription = async (subscriptionId) => {
  if (!stripe) throw new Error('Stripe not configured');
  return await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
};

// ─── Get subscription by ID ──────────────────────────────────
const getSubscription = async (subscriptionId) => {
  if (!stripe) throw new Error('Stripe not configured');
  return await stripe.subscriptions.retrieve(subscriptionId);
};

// ─── Create one-time appointment checkout session ──────────────
const createAppointmentCheckoutSession = async ({ bookingDetails, appointmentId, appointmentNumber }) => {
  if (!stripe) throw new Error('Stripe not configured');

  const baseUrl = getBaseUrl();
  const amountInr = Number(bookingDetails?.amount || bookingDetails?.servicePrice || 500);
  const isLab = bookingDetails?.appointmentType === 'Lab Test' || Boolean(bookingDetails?.serviceName);
  const serviceTitle = bookingDetails?.serviceName || (isLab ? 'Diagnostic Lab Test' : 'Veterinary Consultation');
  const patientTitle = bookingDetails?.petName ? `${bookingDetails.petName} (${bookingDetails.patientName || ''})` : (bookingDetails?.patientName || 'Patient');
  const safeApptId = String(appointmentId || bookingDetails?.appointmentId || bookingDetails?.id || '');
  const safeApptNumber = String(appointmentNumber || bookingDetails?.appointment_number || '');

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `${isLab ? '🧪 Lab Test' : '🩺 Consultation'}: ${serviceTitle}`,
            description: `Hospital: ${bookingDetails?.hospitalName || 'MEDPARK Hospital'} | Patient: ${patientTitle} | Slot: ${bookingDetails?.date || ''} ${bookingDetails?.time || ''}`
          },
          unit_amount: Math.round(amountInr * 100)
        },
        quantity: 1
      }
    ],
    metadata: {
      type: 'appointment',
      appointmentId: safeApptId,
      appointmentNumber: safeApptNumber,
      serviceName: serviceTitle,
      amount: String(amountInr),
      patientName: bookingDetails?.patientName || '',
      hospitalName: bookingDetails?.hospitalName || '',
      date: bookingDetails?.date || '',
      time: bookingDetails?.time || '',
      email: bookingDetails?.email || '',
      isLab: String(isLab)
    },
    customer_email: bookingDetails?.email || undefined,
    success_url: `${baseUrl}/dashboard/my-appointments?type=appointment&payment=success&session_id={CHECKOUT_SESSION_ID}&appointment_id=${safeApptId}`,
    cancel_url: `${baseUrl}/dashboard/my-appointments?type=appointment&payment=cancelled&session_id={CHECKOUT_SESSION_ID}&appointment_id=${safeApptId}`
  });

  return session;
};

// ─── Create refund for an appointment or charge ───────────────
const createRefund = async ({ paymentIntentId, sessionId, paymentId, amountInr, reason = 'requested_by_customer' }) => {
  let piId = paymentIntentId;

  // If sessionId is provided but no paymentIntentId, retrieve session to get payment_intent
  if (!piId && sessionId && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session && session.payment_intent) {
        piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
      }
    } catch (err) {
      console.warn('[stripe] Could not retrieve session for refund:', err.message);
    }
  }

  // If paymentId starts with pi_ or ch_, use it as piId
  if (!piId && paymentId && (paymentId.startsWith('pi_') || paymentId.startsWith('ch_'))) {
    piId = paymentId;
  }

  const refundAmountPaise = Math.round(Number(amountInr || 0) * 100);

  // If we have live Stripe and a valid Stripe Payment Intent / Charge ID
  if (stripe && piId && (piId.startsWith('pi_') || piId.startsWith('ch_'))) {
    try {
      const refundParams = {
        amount: refundAmountPaise > 0 ? refundAmountPaise : undefined,
        reason: reason === 'duplicate' || reason === 'fraudulent' ? reason : 'requested_by_customer'
      };
      if (piId.startsWith('pi_')) {
        refundParams.payment_intent = piId;
      } else {
        refundParams.charge = piId;
      }

      const refund = await stripe.refunds.create(refundParams);
      console.log('[stripe] ✅ Refund created successfully:', refund.id, 'Amount (paise):', refund.amount);
      return {
        success: true,
        refundId: refund.id,
        status: refund.status || 'succeeded',
        amount: (refund.amount || refundAmountPaise) / 100,
        currency: refund.currency || 'inr',
        raw: refund
      };
    } catch (error) {
      console.error('[stripe] ❌ Stripe refund API error:', error.message);
      if (error.code === 'resource_missing' || /no such payment_intent|no such charge/i.test(error.message)) {
        console.log('[stripe] ℹ️ Non-existent live Stripe ID, falling back to simulated refund for dev/testing');
        const simulatedRefundId = `re_sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          success: true,
          refundId: simulatedRefundId,
          status: 'succeeded',
          amount: Number(amountInr || 0),
          currency: 'inr',
          simulated: true
        };
      }
      throw error;
    }
  }

  // Fallback simulation for test environment / mock IDs (e.g. ST_..., TRX_..., Free UPI QR)
  console.log('[stripe] ℹ️ Simulating refund for non-Stripe/test transaction:', { paymentId, piId, amountInr });
  const simulatedRefundId = `re_sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    success: true,
    refundId: simulatedRefundId,
    status: 'succeeded',
    amount: Number(amountInr || 0),
    currency: 'inr',
    simulated: true
  };
};

module.exports = {
  isConfigured,
  createSubscriptionCheckout,
  createOneTimeCheckout,
  createAppointmentCheckoutSession,
  createRefund,
  retrieveSession,
  retrieveSubscription,
  retrieveInvoice,
  sendInvoice,
  retrievePaymentIntent,
  webhookConfigured,
  constructWebhookEvent,
  cancelSubscription,
  getSubscription,
};