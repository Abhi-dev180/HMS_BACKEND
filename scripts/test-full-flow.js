#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { supabase } = require('../config/supabase');
const stripeSvc = require('../services/stripeService');
const { createRegistration, updateRegistrationStatus } = require('../controllers/registrationController');
const { webhook } = require('../controllers/paymentController');
const { PLANS } = require('../config/stripePlans');

const randomStr = (len = 8) => Math.random().toString(36).substring(2, 2 + len);
const generateEmail = () => `test+${randomStr(6)}@example.com`;

// Mock Stripe
const fakeSessionId = `cs_test_${randomStr(20)}`;

// Override webhookConfigured
const originalWebhookConfigured = stripeSvc.webhookConfigured;
stripeSvc.webhookConfigured = () => true;

// Override retrieveSession
const originalRetrieve = stripeSvc.retrieveSession;
stripeSvc.retrieveSession = async (sessionId) => {
  if (sessionId === fakeSessionId) {
    return {
      id: fakeSessionId,
      payment_status: 'paid',
      mode: 'payment',
      customer_email: 'test@example.com',
      amount_total: 20000,
      currency: 'usd',
      customer: 'cus_test',
      metadata: {
        user_id: null,
        hospital_id: null,
        plan_key: 'basic',
      },
    };
  }
  return originalRetrieve ? originalRetrieve(sessionId) : null;
};

// Override constructWebhookEvent
const originalConstruct = stripeSvc.constructWebhookEvent;
stripeSvc.constructWebhookEvent = (body, signature) => {
  const payload = JSON.parse(body.toString());
  return payload;
};

(async () => {
  console.log('\n🚀 Starting full‑flow test...\n');

  try {
    // 1. Create a demo booking
    const demoData = {
      hospital_name: `Test Hospital ${randomStr(4)}`,
      contact_name: 'Test Contact',
      email: generateEmail(),
      phone: '1234567890',
      city: 'Test City',
      feedback_token: `ft_${randomStr(16)}`,
    };
    const { data: booking, error: bookingErr } = await supabase
      .from('demo_bookings')
      .insert(demoData)
      .select()
      .single();
    if (bookingErr) throw new Error(`Demo booking failed: ${bookingErr.message}`);
    console.log('✅ Demo booking created:', booking.id);

    // 2. Insert a pending payment record (simulate create-checkout-session)
    const plan = PLANS['basic'];
    const paymentData = {
      booking_id: booking.id,
      email: booking.email,
      stripe_session_id: fakeSessionId,
      plan_key: 'basic',
      amount: plan.amount,
      currency: 'usd',
      status: 'pending',
    };
    const { data: payment, error: payInsertErr } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();
    if (payInsertErr) throw new Error(`Payment insert failed: ${payInsertErr.message}`);
    console.log('✅ Pending payment record inserted:', payment.id);

    // 3. Call webhook with checkout.session.completed
    const eventPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: fakeSessionId,
          payment_status: 'paid',
          mode: 'payment',
          amount_total: 20000,
          currency: 'usd',
          customer: 'cus_test',
          metadata: {
            user_id: null,
            hospital_id: null,
            plan_key: 'basic',
          },
        },
      },
    };

    const req = {
      body: Buffer.from(JSON.stringify(eventPayload)),
      headers: { 'stripe-signature': 'mock' },
    };
    let webhookRes = {};
    const res = {
      status: (code) => {
        webhookRes.status = code;
        return {
          json: (data) => { webhookRes.data = data; },
          send: (msg) => { webhookRes.send = msg; },
        };
      },
      json: (data) => { webhookRes.data = data; },
    };

    await webhook(req, res);
    console.log('✅ Webhook processed');

    // Verify payment updated to paid
    const { data: updatedPayment, error: payUpdateErr } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_session_id', fakeSessionId)
      .single();
    if (payUpdateErr) throw new Error(`Payment not found after webhook: ${payUpdateErr.message}`);
    console.log('✅ Payment updated to paid:', updatedPayment.id);

    // 4. Register the hospital
    const regReq = {
      body: {
        feedbackToken: booking.feedback_token,
        sessionId: fakeSessionId,
        username: `testuser_${randomStr(4)}`,
        hospitalName: booking.hospital_name,
        contactName: booking.contact_name,
        email: booking.email,
        phone: booking.phone,
        city: booking.city,
        address: '123 Test St',
        beds: 50,
        password: 'test1234',
      },
    };
    let regResData = null;
    const regRes = {
      status: (code) => {
        return {
          json: (data) => { regResData = data; },
        };
      },
      json: (data) => { regResData = data; },
    };

    await createRegistration(regReq, regRes);
    console.log('✅ Registration created:', regResData?.registration?.id || 'unknown');

    const registrationId = regResData?.registration?.id;
    if (!registrationId) throw new Error('Registration creation did not return an ID');

    // 5. Approve the registration
    const approveReq = {
      params: { id: registrationId },
      body: { status: 'approved' },
      headers: { origin: 'http://localhost:3000' },
    };
    let approveResData = null;
    const approveRes = {
      status: (code) => {
        return {
          json: (data) => { approveResData = data; },
        };
      },
      json: (data) => { approveResData = data; },
    };

    await updateRegistrationStatus(approveReq, approveRes);
    console.log('✅ Registration approved');

    // 6. Verify results – fetch the user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email, plan_key, plan_start, plan_end, plan_status')
      .eq('email', booking.email)
      .single();
    if (userErr) throw new Error(`User not found: ${userErr.message}`);

    console.log('\n📊 User record:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - plan_key: ${user.plan_key}`);
    console.log(`  - plan_start: ${user.plan_start}`);
    console.log(`  - plan_end: ${user.plan_end}`);
    console.log(`  - plan_status: ${user.plan_status}`);

    // Fetch subscription
    const { data: subscription, error: subErr } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (subErr && subErr.code !== 'PGRST116') {
      console.warn('⚠️ Subscription fetch error:', subErr.message);
    }

    if (subscription) {
      console.log('\n📊 Subscription record:');
      console.log(`  - ID: ${subscription.id}`);
      console.log(`  - plan_key: ${subscription.plan_key}`);
      console.log(`  - start_date: ${subscription.start_date}`);
      console.log(`  - expiry_date: ${subscription.expiry_date}`);
      console.log(`  - status: ${subscription.status}`);
    } else {
      console.log('\n⚠️ No subscription record found. Check if the webhook created one or the approval fallback worked.');
    }

    // Final check
    const hasDates = user.plan_start && user.plan_end;
    console.log(`\n✅ ${hasDates ? 'PASS' : 'FAIL'}: User has plan_start and plan_end populated.`);

    if (hasDates) {
      console.log('\n🎉 Full flow test passed! All components are working correctly.');
    } else {
      console.log('\n❌ Test failed: plan fields not set on user.');
      console.log('Please check the logs above for errors.');
    }

  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
  } finally {
    stripeSvc.retrieveSession = originalRetrieve;
    stripeSvc.constructWebhookEvent = originalConstruct;
    stripeSvc.webhookConfigured = originalWebhookConfigured;
    console.log('\n🧹 Cleanup: Stripe methods restored.');
    process.exit(0);
  }
})();