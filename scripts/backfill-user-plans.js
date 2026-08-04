#!/usr/bin/env node

/**
 * Backfill user plan fields from existing payments/subscriptions.
 * For users with payment but no subscription, create a subscription.
 * Run: node scripts/backfill-user-plans.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { supabase } = require('../config/supabase');
const { annotateUserWithSubscription } = require('../controllers/paymentController');
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
  } catch {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString();
  }
};

const backfill = async () => {
  console.log('🔄 Starting backfill of user plan fields...\n');

  // 1. Get all users with null plan_key
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, email')
    .is('plan_key', null);

  if (userErr) {
    console.error('❌ Failed to fetch users:', userErr.message);
    return;
  }

  console.log(`📊 Found ${users.length} users with missing plan fields.`);

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    console.log(`\n🔍 Processing user ${user.id} (${user.email})`);

    // 2. Find a payment record for this user (by user_id or email)
    let payment = null;
    if (user.id) {
      const { data: p } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = p || null;
    }
    if (!payment && user.email) {
      const { data: p } = await supabase
        .from('payments')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = p || null;
    }

    if (!payment) {
      console.log(`   ⏭️  No payment found, skipping.`);
      skipped++;
      continue;
    }

    // 3. Find subscription linked to this payment
    let subscription = null;
    if (payment.subscription_id) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', payment.subscription_id)
        .maybeSingle();
      subscription = sub || null;
    }
    // Also try by stripe_session_id (one-time fallback)
    if (!subscription && payment.stripe_session_id) {
      const fallbackKey = `one_time_${payment.stripe_session_id}`;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', fallbackKey)
        .maybeSingle();
      subscription = sub || null;
    }

    // 4. If no subscription, create one from the payment
    if (!subscription && payment.plan_key) {
      console.log(`   📝 No subscription found, creating one from payment...`);
      const plan = PLANS[payment.plan_key];
      const start = payment.created_at || new Date().toISOString();
      const end = computeExpiry(start, plan);

      const { data: newSub, error: insertErr } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          hospital_id: payment.hospital_id || null,
          plan_key: payment.plan_key,
          plan_type: plan?.interval || 'monthly',
          stripe_subscription_id: `one_time_${payment.stripe_session_id || 'manual'}`,
          stripe_customer_id: null,
          status: 'active',
          start_date: start,
          expiry_date: end,
          amount: payment.amount || 0,
          currency: payment.currency || 'usd',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`   ❌ Failed to create subscription: ${insertErr.message}`);
        skipped++;
        continue;
      }
      subscription = newSub;
      // Link payment to subscription
      await supabase.from('payments').update({ subscription_id: newSub.id, updated_at: new Date().toISOString() }).eq('id', payment.id);
      console.log(`   ✅ Subscription created: ${subscription.id}`);
    }

    if (!subscription) {
      console.log(`   ⏭️  No subscription found and could not create one, skipping.`);
      skipped++;
      continue;
    }

    // 5. If subscription has no user_id, link it
    if (!subscription.user_id) {
      console.log(`   🔗 Linking subscription ${subscription.id} to user ${user.id}`);
      await supabase
        .from('subscriptions')
        .update({ user_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', subscription.id);
      subscription.user_id = user.id;
    }

    // 6. Annotate user
    const result = await annotateUserWithSubscription({
      userId: user.id,
      planKey: subscription.plan_key,
      startDate: subscription.start_date,
      expiryDate: subscription.expiry_date,
      status: subscription.status
    });

    if (result) {
      updated++;
      console.log(`   ✅ Updated user ${user.id}`);
    } else {
      console.log(`   ❌ Failed to update user ${user.id}`);
    }
  }

  console.log(`\n✅ Backfill complete. Updated ${updated} users, skipped ${skipped}.`);
  process.exit(0);
};

backfill().catch(err => {
  console.error('❌ Backfill error:', err);
  process.exit(1);
});