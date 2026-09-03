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
const createAppointmentCheckoutSession = async ({ bookingDetails }) => {
  if (!stripe) throw new Error('Stripe not configured');

  const baseUrl = getBaseUrl();
  const amountInr = Number(bookingDetails?.amount || 500);
  const serviceTitle = bookingDetails?.serviceName || 'Veterinary Appointment';
  const patientTitle = bookingDetails?.petName ? `${bookingDetails.petName} (${bookingDetails.patientName || ''})` : (bookingDetails?.patientName || 'Patient');

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `Appointment Fee: ${serviceTitle}`,
            description: `Hospital: ${bookingDetails?.hospitalName || 'Pet Hospital'} | Patient: ${patientTitle} | Slot: ${bookingDetails?.date || ''} ${bookingDetails?.time || ''}`
          },
          unit_amount: Math.round(amountInr * 100)
        },
        quantity: 1
      }
    ],
    metadata: {
      type: 'appointment',
      serviceName: serviceTitle,
      amount: String(amountInr),
      patientName: bookingDetails?.patientName || '',
      hospitalName: bookingDetails?.hospitalName || '',
      date: bookingDetails?.date || '',
      time: bookingDetails?.time || ''
    },
    customer_email: bookingDetails?.email || undefined,
    success_url: `${baseUrl}/user/my-appointments?type=appointment&payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/user/my-appointments?type=appointment&payment=cancelled`
  });

  return session;
};

module.exports = {
  isConfigured,
  createSubscriptionCheckout,
  createOneTimeCheckout,
  createAppointmentCheckoutSession,
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