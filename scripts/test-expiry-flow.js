#!/usr/bin/env node

/**
 * Test script for subscription expiration and renewal flow.
 * Run with: node scripts/test-expiry-flow.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { supabase } = require('../config/supabase');
const { runDailyExpiryChecks } = require('../cronJobs');
const { annotateUserWithSubscription } = require('../controllers/paymentController');
const { generateRenewalLink } = require('../controllers/subscriptionController');
const emailService = require('../services/emailService'); // import the module

// ─── Store original functions ──────────────────────────────
const originalSendExpired = emailService.sendSubscriptionExpired;
const originalSendReminder = emailService.sendSubscriptionExpiryReminder;
let emailCalls = [];

// ─── Override with mocks ────────────────────────────────────
emailService.sendSubscriptionExpired = async (params) => {
  emailCalls.push({ type: 'expired', ...params });
  console.log(`[mock] sendSubscriptionExpired called for ${params.to}`);
};

emailService.sendSubscriptionExpiryReminder = async (params) => {
  emailCalls.push({ type: 'reminder', ...params });
  console.log(`[mock] sendSubscriptionExpiryReminder called for ${params.to} (${params.daysLeft} days)`);
};

// ─── Helpers ──────────────────────────────────────────────────
const randomStr = (len = 8) => Math.random().toString(36).substring(2, 2 + len);
const generateEmail = () => `test+${randomStr(6)}@example.com`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Main test ──────────────────────────────────────────────
(async () => {
  console.log('\n🧪 Starting expiry flow test...\n');

  try {
    // 1. Create a test user and subscription
    const email = generateEmail();
    const userId = Date.now().toString();

    // Insert a test user (minimal fields)
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        name: 'Test User',
        plan_key: 'basic',
        plan_start: new Date().toISOString(),
        plan_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // valid for 30 days
        plan_status: 'active',
        active: true
      })
      .select()
      .single();
    if (userErr) throw new Error(`User insert failed: ${userErr.message}`);
    console.log('✅ Test user created:', userId);

    // Insert a subscription record with expiry_date set to yesterday (so it's expired)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expiryDate = yesterday.toISOString();

    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        hospital_id: null,
        plan_key: 'basic',
        plan_type: 'monthly',
        stripe_subscription_id: `test_sub_${randomStr(10)}`,
        stripe_customer_id: null,
        status: 'active',      // still active in our table but expired by date
        start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: expiryDate,
        amount: 20000,
        currency: 'usd',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (subErr) throw new Error(`Subscription insert failed: ${subErr.message}`);
    console.log('✅ Test subscription created with expiry:', expiryDate);

    // 2. Verify initial state
    const { data: initialUser } = await supabase
      .from('users')
      .select('plan_status, plan_end')
      .eq('id', userId)
      .single();
    console.log(`📊 Initial user status: ${initialUser.plan_status}, plan_end: ${initialUser.plan_end}`);

    // 3. Run the cron job (expiry checks)
    console.log('\n⏳ Running expiry checks...');
    await runDailyExpiryChecks();
    console.log('✅ Expiry checks completed');

    // 4. Check user status after cron
    const { data: updatedUser, error: fetchErr } = await supabase
      .from('users')
      .select('plan_status, plan_end')
      .eq('id', userId)
      .single();
    if (fetchErr) throw new Error(`Failed to fetch user: ${fetchErr.message}`);

    console.log(`\n📊 After cron - user status: ${updatedUser.plan_status}, plan_end: ${updatedUser.plan_end}`);

    // 5. Check subscription status
    const { data: updatedSub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('id', sub.id)
      .single();
    console.log(`📊 After cron - subscription status: ${updatedSub?.status}`);

    // 6. Verify email calls
    console.log(`\n📧 Email calls: ${emailCalls.length}`);
    emailCalls.forEach(call => {
      console.log(`  - ${call.type} email to ${call.to}${call.daysLeft ? ` (${call.daysLeft} days left)` : ''}`);
    });

    // 7. Generate a renewal link (to test that functionality)
    const renewalLink = await generateRenewalLink(userId);
    console.log(`\n🔗 Renewal link generated: ${renewalLink}`);

    // 8. Verification results
    const passed = updatedUser.plan_status === 'expired' && updatedSub?.status === 'expired';
    console.log(`\n✅ ${passed ? 'PASS' : 'FAIL'}: Subscription and user status correctly set to expired.`);
    if (passed) {
      console.log('🎉 Expiry flow test passed!');
    } else {
      console.log('❌ Expiry flow test failed. Check logs above.');
    }

  } catch (err) {
    console.error('\n❌ Test error:', err);
  } finally {
    // Restore original email functions
    emailService.sendSubscriptionExpired = originalSendExpired;
    emailService.sendSubscriptionExpiryReminder = originalSendReminder;
    console.log('\n🧹 Cleanup: email functions restored.');
    process.exit(0);
  }
})();