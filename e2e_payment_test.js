const fetch = globalThis.fetch;
require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const API_URL = 'http://localhost:5000';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const gateways = ['stripe', 'paypal', 'razorpay'];

async function runTest() {
  console.log('========================================================');
  console.log('🚀 Starting End-to-End Payment Gateway Tests');
  console.log('========================================================\n');

  for (const gateway of gateways) {
    try {
      console.log(`\n--- Testing flow for: [${gateway.toUpperCase()}] ---`);

      // 1. Create a demo booking
      console.log(`[1] Creating a new demo booking...`);
      const createRes = await fetch(`${API_URL}/api/demos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: `Test Hospital ${gateway}`,
          contactName: 'E2E Tester',
          email: `rajdevfree@gmail.com`,
          phone: '9999999999',
          city: 'Test City'
        })
      });

      if (!createRes.ok) throw new Error(await createRes.text());
      const createData = await createRes.json();
      const booking = createData.booking;
      const feedbackToken = booking.feedback_token;
      console.log(`    ✅ Created Booking ID: ${booking.id}`);

      // 2. Schedule Timing
      console.log(`[2] Fetching available slots...`);
      const slotsRes = await fetch(`${API_URL}/api/schedule/${feedbackToken}`);
      if (!slotsRes.ok) throw new Error(await slotsRes.text());
      const slotsData = await slotsRes.json();

      let validSlot = null;
      for (const slot of slotsData.slots) {
        if (!slot.taken) {
          validSlot = slot.iso;
          break;
        }
      }

      if (!validSlot) throw new Error("No available slots found!");

      console.log(`    Picking slot: ${validSlot}`);
      const scheduleRes = await fetch(`${API_URL}/api/schedule/${feedbackToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: validSlot,
          message: 'Test scheduling message'
        })
      });
      if (!scheduleRes.ok) throw new Error(await scheduleRes.text());
      console.log(`    ✅ Successfully scheduled demo.`);

      // 3. Mark as Completed (Simulate SuperAdmin action directly via Supabase)
      console.log(`[3] Simulating SuperAdmin marking demo as completed...`);
      const { error: updErr } = await supabase
        .from('demo_bookings')
        .update({ status: 'completed' })
        .eq('id', booking.id);

      if (updErr) throw new Error(updErr.message);
      console.log(`    ✅ Demo marked as completed in database.`);

      // 4. Submit Feedback (Interested)
      console.log(`[4] Submitting feedback as 'Interested'...`);
      const feedbackRes = await fetch(`${API_URL}/api/feedback/${feedbackToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          interested: true,
          comment: 'Great demo, ready to buy.'
        })
      });
      if (!feedbackRes.ok) throw new Error(await feedbackRes.text());
      console.log(`    ✅ Feedback submitted successfully.`);

      // 5. Test Payment Gateway
      console.log(`[5] Creating payment order via ${gateway.toUpperCase()}...`);
      let endpoint = '';
      let body = {
        booking: {
          id: booking.id,
          email: booking.email,
          hospital_name: booking.hospital_name
        },
        planKey: 'mini',
        feedbackToken: feedbackToken
      };

      if (gateway === 'stripe') {
        endpoint = '/api/payments/create-checkout-session';
      } else if (gateway === 'paypal') {
        endpoint = '/api/payments/paypal/create-order';
        body.returnUrl = 'http://localhost:5173/return';
        body.cancelUrl = 'http://localhost:5173/cancel';
      } else if (gateway === 'razorpay') {
        endpoint = '/api/payments/razorpay/create-order';
      }

      const paymentRes = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!paymentRes.ok) throw new Error(await paymentRes.text());
      const paymentData = await paymentRes.json();

      console.log(`    ✅ Successfully initiated payment with ${gateway.toUpperCase()}!`);

      // 6. Simulate Successful Payment (Capture/Verify)
      console.log(`[6] Simulating successful payment completion...`);
      let verifyEndpoint = '';
      let verifyBody = {
        booking: { id: booking.id, email: booking.email },
        planKey: 'mini'
      };

      if (gateway === 'paypal') {
        verifyEndpoint = '/api/payments/paypal/capture-order';
        verifyBody.orderId = paymentData.id;
      } else if (gateway === 'razorpay') {
        verifyEndpoint = '/api/payments/razorpay/verify-payment';
        verifyBody.razorpay_order_id = paymentData.id;
        verifyBody.razorpay_payment_id = `pay_${Date.now()}`;
        verifyBody.razorpay_signature = 'dummy_signature';
      }

      if (verifyEndpoint) {
        const verifyRes = await fetch(`${API_URL}${verifyEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody)
        });
        if (!verifyRes.ok) throw new Error(await verifyRes.text());
        console.log(`    ✅ Successfully verified/captured payment!`);
      } else {
        console.log(`    ✅ (Stripe verification is handled asynchronously via webhooks)`);
      }

    } catch (error) {
      console.error(`    ❌ FAILED testing ${gateway.toUpperCase()}:`, error.message);
    }
  }

  console.log('\n========================================================');
  console.log('🏁 End-to-End Tests Completed');
  console.log('========================================================');
}

runTest();
