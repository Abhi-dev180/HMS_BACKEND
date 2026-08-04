const { supabase, isConfigured: isSupabaseConfigured } = require('../config/supabase');
const stripeSvc = require('../services/stripeService');
const { PLANS } = require('../config/stripePlans');

// ─── Helper: compute expiry from plan ─────────────────────────
const computeExpiry = (startIso, planMeta) => {
  try {
    const start = startIso ? new Date(startIso) : new Date();
    const interval = planMeta?.interval || planMeta?.intervalLabel || 'month';
    const count = Number(planMeta?.interval_count || planMeta?.intervalCount || 1) || 1;
    if (/year/i.test(interval)) {
      start.setFullYear(start.getFullYear() + count);
    } else {
      start.setMonth(start.getMonth() + count);
    }
    return start.toISOString();
  } catch (e) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString();
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
  const plan = PLANS[planKey];
  const planType = plan?.interval || 'monthly';

  const start = startDate || new Date().toISOString();
  const expiry = expiryDate || computeExpiry(start, plan || { interval: 'month', interval_count: 1 });

  console.log('[saveSubscription] Computed dates:', { start, expiry, planKey, userId });

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId || null,               // NULL allowed
      hospital_id: hospitalId,
      plan_key: planKey,
      plan_type: planType,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      status: status,
      start_date: start,
      expiry_date: expiry,
      amount: amount,
      currency: currency || 'usd',
      updated_at: new Date().toISOString()
    }, { onConflict: 'stripe_subscription_id' })
    .select()
    .single();

  if (error) {
    console.error('[payments] saveSubscription error:', error);
  } else {
    console.log('[payments] Subscription saved:', { subscriptionId: data?.id, user: userId, start, expiry });
  }
  return data;
};

// ─── Annotate user row with subscription details ──────────────
const annotateUserWithSubscription = async ({ userId, planKey, startDate, expiryDate, status }) => {
  if (!userId) {
    console.warn('[annotateUserWithSubscription] No userId provided, skipping');
    return null;
  }

  // If dates missing, try to fetch from subscriptions
  if (!startDate || !expiryDate) {
    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('start_date, expiry_date, plan_key')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (subData) {
        startDate = startDate || subData.start_date;
        expiryDate = expiryDate || subData.expiry_date;
        planKey = planKey || subData.plan_key;
      }
    } catch (e) { /* ignore */ }
  }

  // Final fallback
  if (!startDate) startDate = new Date().toISOString();
  if (!expiryDate) {
    const def = new Date();
    def.setFullYear(def.getFullYear() + 1);
    expiryDate = def.toISOString();
  }

  try {
    const patch = {
      plan_key: planKey || null,
      plan_start: startDate,
      plan_end: expiryDate,
      plan_status: status || 'active'
      // removed updated_at – not present in users table
    };
    const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select().single();
    if (error) {
      console.error('[payments] annotateUserWithSubscription error:', error);
      return null;
    }
    console.log('[annotateUserWithSubscription] User updated:', { userId, patch });
    return data;
  } catch (e) {
    console.error('[payments] annotateUserWithSubscription failed:', e);
    return null;
  }
};

// ─── Verify session ────────────────────────────────────────────
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
      await supabase
        .from('payments')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('stripe_session_id', sessionId);

      if (session.mode === 'subscription') {
        const subscription = await stripeSvc.retrieveSubscription(session.subscription);
        const saved = await saveSubscription({
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
        if (saved?.id) {
          await supabase.from('payments').update({ subscription_id: saved.id, updated_at: new Date().toISOString() })
            .eq('stripe_session_id', sessionId);
        }
        if (session.metadata.user_id) {
          await annotateUserWithSubscription({
            userId: session.metadata.user_id,
            planKey: session.metadata.plan_key,
            startDate: saved?.start_date,
            expiryDate: saved?.expiry_date,
            status: subscription.status
          });
        }
      } else if (session.mode === 'payment' && session.metadata?.plan_key) {
        const saved = await saveSubscription({
          userId: session.metadata.user_id,
          hospitalId: session.metadata.hospital_id,
          planKey: session.metadata.plan_key,
          stripeSubscriptionId: `one_time_${session.id}`,
          stripeCustomerId: session.customer || null,
          status: 'active',
          amount: session.amount_total || 0,
          currency: session.currency || 'usd'
        });
        if (saved?.id) {
          await supabase.from('payments').update({ subscription_id: saved.id, updated_at: new Date().toISOString() })
            .eq('stripe_session_id', sessionId);
        }
        if (session.metadata.user_id) {
          await annotateUserWithSubscription({
            userId: session.metadata.user_id,
            planKey: session.metadata.plan_key,
            startDate: saved?.start_date,
            expiryDate: saved?.expiry_date,
            status: 'active'
          });
        }
      }
    }

    // Fetch subscription record for response
    let subscriptionRecord = null;
    try {
      if (isSupabaseConfigured()) {
        if (session.subscription) {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('stripe_subscription_id', session.subscription)
            .maybeSingle();
          subscriptionRecord = subData || null;
        }
        if (!subscriptionRecord && sessionId) {
          const { data: payData } = await supabase
            .from('payments')
            .select('subscription_id')
            .eq('stripe_session_id', sessionId)
            .maybeSingle();
          if (payData?.subscription_id) {
            const { data: subData } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('id', payData.subscription_id)
              .maybeSingle();
            subscriptionRecord = subData || null;
          }
        }
      }
    } catch (e) { /* ignore */ }

    return res.json({
      configured: true,
      paid,
      mode: session.mode,
      email: session.customer_email,
      metadata: session.metadata,
      subscriptionId: session.subscription || null,
      paymentIntentId: session.payment_intent || null,
      planKey: session.metadata?.plan_key || null,
      subscriptionRecord
    });
  } catch (e) {
    console.error('[payments] verify error:', e);
    return res.status(500).json({ message: 'Could not verify payment' });
  }
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
        await supabase
          .from('payments')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('stripe_session_id', session.id);

        if (session.metadata?.plan_key) {
          await supabase
            .from('payments')
            .update({ plan_key: session.metadata.plan_key, updated_at: new Date().toISOString() })
            .eq('stripe_session_id', session.id);
        }

        if (session.mode === 'subscription') {
          const subscription = await stripeSvc.retrieveSubscription(session.subscription);
          const saved = await saveSubscription({
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
          if (saved?.id) {
            await supabase.from('payments').update({ subscription_id: saved.id, updated_at: new Date().toISOString() })
              .eq('stripe_session_id', session.id);
          }
          if (session.metadata.user_id) {
            await annotateUserWithSubscription({
              userId: session.metadata.user_id,
              planKey: session.metadata.plan_key,
              startDate: saved?.start_date,
              expiryDate: saved?.expiry_date,
              status: subscription.status
            });
          }
        } else if (session.mode === 'payment' && session.metadata?.plan_key) {
          const saved = await saveSubscription({
            userId: session.metadata.user_id,
            hospitalId: session.metadata.hospital_id,
            planKey: session.metadata.plan_key,
            stripeSubscriptionId: `one_time_${session.id}`,
            stripeCustomerId: session.customer || null,
            status: 'active',
            amount: session.amount_total || 0,
            currency: session.currency || 'usd'
          });
          if (saved?.id) {
            await supabase.from('payments').update({ subscription_id: saved.id, updated_at: new Date().toISOString() })
              .eq('stripe_session_id', session.id);
          }
          if (session.metadata.user_id) {
            await annotateUserWithSubscription({
              userId: session.metadata.user_id,
              planKey: session.metadata.plan_key,
              startDate: saved?.start_date,
              expiryDate: saved?.expiry_date,
              status: 'active'
            });
          }
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

        try {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('user_id, plan_key, start_date')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          if (subData?.user_id) {
            await annotateUserWithSubscription({
              userId: subData.user_id,
              planKey: subData.plan_key,
              startDate: subData.start_date,
              expiryDate: new Date(subscription.current_period_end * 1000).toISOString(),
              status: subscription.status
            });
          }
        } catch (e) { /* ignore */ }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`[webhook] Subscription deleted: ${subscription.id}`);

      if (isSupabaseConfigured()) {
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);

        try {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('user_id, plan_key, start_date, expiry_date')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          if (subData?.user_id) {
            await annotateUserWithSubscription({
              userId: subData.user_id,
              planKey: subData.plan_key,
              startDate: subData.start_date,
              expiryDate: subData.expiry_date,
              status: 'cancelled'
            });
          }
        } catch (e) { /* ignore */ }
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

// ─── Get expiring subscriptions ──────────────────────────────
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

// ─── Admin sync session ──────────────────────────────────────
const syncSession = async (sessionId) => {
  if (!stripeSvc.isConfigured()) throw new Error('stripe not configured');
  const session = await stripeSvc.retrieveSession(sessionId);
  if (!session) throw new Error('session not found');

  try {
    await supabase.from('payments').update({
      stripe_payment_intent_id: session.payment_intent || null,
      plan_key: session.metadata?.plan_key || null,
      updated_at: new Date().toISOString()
    }).eq('stripe_session_id', session.id);
  } catch (e) { /* ignore */ }

  if (session.subscription) {
    const subscription = await stripeSvc.retrieveSubscription(session.subscription);
    const saved = await saveSubscription({
      userId: session.metadata?.user_id,
      hospitalId: session.metadata?.hospital_id,
      planKey: session.metadata?.plan_key,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      startDate: new Date(subscription.start_date * 1000).toISOString(),
      expiryDate: new Date(subscription.current_period_end * 1000).toISOString(),
      amount: subscription.items.data[0]?.price?.unit_amount || 0,
      currency: subscription.items.data[0]?.price?.currency || 'usd'
    });
    if (saved?.id) {
      await supabase.from('payments').update({ subscription_id: saved.id, updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session.id);
    }
    if (session.metadata?.user_id) {
      await annotateUserWithSubscription({
        userId: session.metadata.user_id,
        planKey: session.metadata.plan_key,
        startDate: saved?.start_date,
        expiryDate: saved?.expiry_date,
        status: subscription.status
      });
    }
  } else if (session.mode === 'payment' && session.metadata?.plan_key) {
    const saved = await saveSubscription({
      userId: session.metadata?.user_id,
      hospitalId: session.metadata?.hospital_id,
      planKey: session.metadata.plan_key,
      stripeSubscriptionId: `one_time_${session.id}`,
      stripeCustomerId: session.customer || null,
      status: 'active',
      amount: session.amount_total || 0,
      currency: session.currency || 'usd'
    });
    if (saved?.id) {
      await supabase.from('payments').update({ subscription_id: saved.id, updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session.id);
    }
    if (session.metadata?.user_id) {
      await annotateUserWithSubscription({
        userId: session.metadata.user_id,
        planKey: session.metadata.plan_key,
        startDate: saved?.start_date,
        expiryDate: saved?.expiry_date,
        status: 'active'
      });
    }
  }
  return { ok: true };
};

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  verifySession,
  webhook,
  saveSubscription,
  getUserSubscription,
  getExpiringSubscriptions,
  getExpiredSubscriptions,
  syncSession,
  annotateUserWithSubscription
};