
// const secret = process.env.STRIPE_SECRET_KEY;
// const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// const { PLANS } = require('../config/stripePlans');


// const looksReal = (k) => typeof k === 'string' && k.startsWith('sk_') && !k.includes('...');

// let stripe = null;

// if (secret && looksReal(secret)) {
//   stripe = require('stripe')(secret);
// } else if (secret) {
//   console.warn('[stripe] STRIPE_SECRET_KEY looks like a placeholder — payments disabled until a real key is set.');
// } else {
//   console.warn('[stripe] STRIPE_SECRET_KEY not set — payment endpoints will return 503 until configured.');
// }

// const isConfigured = () => stripe !== null;

// const createCheckoutSession = async ({ booking, feedbackToken, planKey = 'basic' }) => {
//   if (!stripe) throw new Error('Stripe not configured');

//   const plan = PLANS[planKey];
//   if (!plan) throw new Error('Invalid plan');

//   const session = await stripe.checkout.sessions.create({
//     mode: 'payment',
//     payment_method_types: ['card'],
//     customer_email: booking.email,
//     line_items: [
//       {
//         price_data: {
//           currency: 'usd',
//           product_data: {
//             name: `Pet Hospital Portal — ${plan.name}`,
//             description: `Onboarding for ${booking.hospital_name || booking.hospital || 'Hospital'}`
//           },
//           unit_amount: plan.amount
//         },
//         quantity: 1
//       }
//     ],
//     metadata: {
//       booking_id: booking.id,
//       feedback_token: feedbackToken || '',
//       plan_key: planKey
//     },
//     success_url: `${FRONTEND_URL}/register/${feedbackToken}?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${FRONTEND_URL}/feedback/${feedbackToken}?payment=cancelled`
//   });

//   return session;
// };

// const retrieveSession = (id) => stripe.checkout.sessions.retrieve(id);

// const looksRealWebhook = (k) => typeof k === 'string' && k.startsWith('whsec_') && !k.includes('...');
// const webhookConfigured = () => !!(stripe && looksRealWebhook(WEBHOOK_SECRET));

// const constructWebhookEvent = (rawBody, signature) =>
//   stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

// module.exports = {
//   isConfigured,
//   createCheckoutSession,
//   retrieveSession,
//   webhookConfigured,
//   constructWebhookEvent
// };


// const secret = process.env.STRIPE_SECRET_KEY;
// const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// const { PLANS } = require('../config/stripePlans');

// // ─── Helper to ensure absolute URL with http(s) protocol ───
// const getBaseUrl = () => {
//   let raw =
//     process.env.FRONTEND_REDIRECT_URL ||
//     (process.env.FRONTEND_URL || 'https://hospital-management-sigma-six.vercel.app').split(',')[0]?.trim();
//   if (!raw) raw = 'https://hospital-management-sigma-six.vercel.app';
//   raw = raw.trim().replace(/\/+$/, '');
//   if (!/^https?:\/\//i.test(raw)) {
//     raw = `https://${raw}`;
//   }
//   return raw;
// };

// const looksReal = (k) => typeof k === 'string' && k.startsWith('sk_') && !k.includes('...');

// let stripe = null;

// if (secret && looksReal(secret)) {
//   stripe = require('stripe')(secret);
// } else if (secret) {
//   console.warn('[stripe] STRIPE_SECRET_KEY looks like a placeholder — payments disabled until a real key is set.');
// } else {
//   console.warn('[stripe] STRIPE_SECRET_KEY not set — payment endpoints will return 503 until configured.');
// }

// const isConfigured = () => stripe !== null;

// const createCheckoutSession = async ({ booking = {}, feedbackToken = '', planKey = 'basic' }) => {
//   if (!stripe) throw new Error('Stripe not configured');

//   const plan = PLANS[planKey] || PLANS['basic'];
//   const baseUrl = getBaseUrl();
//   const tokenPath = feedbackToken ? `/${encodeURIComponent(feedbackToken)}` : '';
//   const successUrl = `${baseUrl}/register${tokenPath}?session_id={CHECKOUT_SESSION_ID}`;
//   const cancelUrl = `${baseUrl}/pricing${tokenPath}?payment=cancelled`;

//   console.log('[stripe] Creating Checkout Session:');
//   console.log('  Base URL:', baseUrl);
//   console.log('  Success URL:', successUrl);
//   console.log('  Cancel URL:', cancelUrl);

//   const session = await stripe.checkout.sessions.create({
//     mode: 'payment',
//     payment_method_types: ['card'],
//     customer_email: booking.email || undefined,
//     line_items: [
//       {
//         price_data: {
//           currency: 'usd',
//           product_data: {
//             name: `Pet Hospital Portal — ${plan.name}`,
//             description: `Onboarding for ${booking.hospital_name || booking.hospitalName || booking.hospital || 'Pet Hospital'}`
//           },
//           unit_amount: plan.amount
//         },
//         quantity: 1
//       }
//     ],
//     metadata: {
//       booking_id: String(booking.id || ''),
//       feedback_token: String(feedbackToken || ''),
//       plan_key: String(planKey)
//     },
//     success_url: successUrl,
//     cancel_url: cancelUrl
//   });

//   return session;
// };

// const retrieveSession = (id) => stripe.checkout.sessions.retrieve(id);

// const looksRealWebhook = (k) => typeof k === 'string' && k.startsWith('whsec_') && !k.includes('...');
// const webhookConfigured = () => !!(stripe && looksRealWebhook(WEBHOOK_SECRET));

// const constructWebhookEvent = (rawBody, signature) =>
//   stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

// module.exports = {
//   isConfigured,
//   createCheckoutSession,
//   retrieveSession,
//   webhookConfigured,
//   constructWebhookEvent
// };


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
  cancelPath = '/pricing'
}) => {
  if (!stripe) throw new Error('Stripe not configured');

  const plan = PLANS[planKey];
  if (!plan) throw new Error(`Invalid plan: ${planKey}`);

  const baseUrl = getBaseUrl();
  const planType = plan.interval || 'monthly';
  const priceData = {
    currency: 'usd',
    product_data: {
      name: `Pet Hospital Portal — ${plan.name}`,
      description: `${plan.name} - ${plan.interval} subscription`
    },
    unit_amount: plan.amount,
    recurring: {
      interval: plan.interval,          // ✅ 'month', 'year', etc.
      interval_count: plan.interval_count || 1
    }
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price_data: priceData, quantity: 1 }],
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
    cancel_url: `${baseUrl}/pricing${tokenPath}?payment=cancelled`
  });

  return session;
};

const retrieveSession = (id) => stripe.checkout.sessions.retrieve(id);
const retrieveSubscription = (id) => stripe.subscriptions.retrieve(id);

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

module.exports = {
  isConfigured,
  createSubscriptionCheckout,
  createOneTimeCheckout,
  retrieveSession,
  retrieveSubscription,
  webhookConfigured,
  constructWebhookEvent,
  cancelSubscription,
  getSubscription,
};
