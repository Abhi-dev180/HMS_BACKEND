
const { supabase, isConfigured: isSupabaseConfigured } = require('../config/supabase');
const stripeSvc = require('../services/stripeService');

const verifySession = async (req, res) => {
  const sessionId = req.query.session_id;

  if (!stripeSvc.isConfigured()) {
    return res.json({ configured: false, paid: false });
  }

  if (!sessionId) return res.status(400).json({ message: 'session_id is required' });

  try {
    const session = await stripeSvc.retrieveSession(sessionId);
    const paid = session.payment_status === 'paid';

    if (paid && isSupabaseConfigured()) {
      // Update payment record
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_session_id', sessionId);

      // If subscription, store subscription info
      if (session.mode === 'subscription') {
        const subscription = await stripeSvc.retrieveSubscription(session.subscription);
        await saveSubscription({
          userId: session.metadata.user_id,
          hospitalId: session.metadata.hospital_id,
          planKey: session.metadata.plan_key,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer,
          status: subscription.status,
          startDate: new Date(subscription.start_date * 1000).toISOString(),
          expiryDate: new Date(subscription.current_period_end * 1000).toISOString(),
          amount: subscription.items.data[0]?.price?.unit_amount || 0,
          currency: subscription.items.data[0]?.price?.currency || 'usd'
        });
      }
    }

    return res.json({
      configured: true,
      paid,
      mode: session.mode,
      email: session.customer_email,
      metadata: session.metadata,
      subscriptionId: session.subscription || null
    });
  } catch (e) {
    console.error('[payments] verify error:', e);
    return res.status(500).json({ message: 'Could not verify payment' });
  }
};

// ─── Save subscription to database ────────────────────────────
const saveSubscription = async ({
  userId,
  hospitalId,
  planKey,
  stripeSubscriptionId,
  stripeCustomerId,
  status,
  startDate,
  expiryDate,
  amount,
  currency
}) => {
  const plan = require('../config/stripePlans').PLANS[planKey];
  const planType = plan?.interval || 'monthly';

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      hospital_id: hospitalId,
      plan_key: planKey,
      plan_type: planType,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      status: status,
      start_date: startDate,
      expiry_date: expiryDate,
      amount: amount,
      currency: currency || 'usd',
      updated_at: new Date().toISOString()
    }, { onConflict: 'stripe_subscription_id' })
    .select()
    .single();

  if (error) {
    console.error('[payments] saveSubscription error:', error);
  } else {
    console.log('[payments] Subscription saved:', { subscriptionId: data?.id, user: userId });
  }
  return data;
};

// ─── Webhook Handler ──────────────────────────────────────────
const webhook = async (req, res) => {
  if (!stripeSvc.webhookConfigured()) {
    return res.status(200).json({ received: true, skipped: 'webhook not configured' });
  }

  let event;
  try {
    event = stripeSvc.constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (e) {
    console.error('[webhook] signature verification failed:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  console.log(`[webhook] Received event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`[webhook] Checkout completed: ${session.id}, mode: ${session.mode}`);

      if (isSupabaseConfigured()) {
        // Update payment status
        await supabase
          .from('payments')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('stripe_session_id', session.id);

        // If subscription, save it
        if (session.mode === 'subscription') {
          const subscription = await stripeSvc.retrieveSubscription(session.subscription);
          await saveSubscription({
            userId: session.metadata.user_id,
            hospitalId: session.metadata.hospital_id,
            planKey: session.metadata.plan_key,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer,
            status: subscription.status,
            startDate: new Date(subscription.start_date * 1000).toISOString(),
            expiryDate: new Date(subscription.current_period_end * 1000).toISOString(),
            amount: subscription.items.data[0]?.price?.unit_amount || 0,
            currency: subscription.items.data[0]?.price?.currency || 'usd'
          });
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      console.log(`[webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}`);

      if (isSupabaseConfigured()) {
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            expiry_date: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`[webhook] Subscription deleted: ${subscription.id}`);

      if (isSupabaseConfigured()) {
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
      }
      break;
    }

    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }

  return res.json({ received: true });
};

// ─── Get active subscription for a user ──────────────────────
const getUserSubscription = async (userId) => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expiry_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[payments] getUserSubscription error:', error);
  }
  return data || null;
};

// ─── Check for expiring subscriptions (cron job) ────────────
const getExpiringSubscriptions = async (daysBefore = 7) => {
  if (!isSupabaseConfigured()) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysBefore);

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('expiry_date', cutoff.toISOString())
    .gte('expiry_date', new Date().toISOString());

  if (error) {
    console.error('[payments] getExpiringSubscriptions error:', error);
    return [];
  }
  return data || [];
};

// ─── Get expired subscriptions ────────────────────────────────
const getExpiredSubscriptions = async () => {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .lt('expiry_date', new Date().toISOString());

  if (error) {
    console.error('[payments] getExpiredSubscriptions error:', error);
    return [];
  }
  return data || [];
};

module.exports = {
  verifySession,
  webhook,
  saveSubscription,
  getUserSubscription,
  getExpiringSubscriptions,
  getExpiredSubscriptions
};