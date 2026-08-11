// test-payment-flow.js
require("dotenv").config({ path: "../.env" });

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { supabase } = require("../config/supabase");
const { verifySession } = require("../controllers/paymentController");

const randomString = (len = 8) => Math.random().toString(36).substring(2, 2 + len);

const getBaseUrl = () => {
  let raw = process.env.FRONTEND_REDIRECT_URL || process.env.FRONTEND_URL || "http://localhost:5173";
  return raw.replace(/\/+$/, "");
};

async function createDemoBooking() {
  const email = `test-${randomString(6)}@example.com`;
  const { data, error } = await supabase
    .from("demo_bookings")
    .insert({
      hospital_name: `Test Hospital ${randomString(4)}`,
      contact_name: `Test Contact ${randomString(4)}`,
      email,
      phone: "1234567890",
      city: "Test City",
      message: "Test message",
      status: "requested",
      feedback_token: randomString(32),
    })
    .select()
    .single();
  if (error) throw error;
  console.log(`✅ Demo booking created: ${data.id} (${email})`);
  return data;
}

async function createCheckoutSession(booking) {
  const baseUrl = getBaseUrl();

  // 1. Create a Payment Intent manually
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 50000,
    currency: "usd",
    metadata: { booking_id: booking.id },
    // We'll confirm it later with a test card
    payment_method_types: ["card"],
  });
  console.log(`✅ Payment Intent created: ${paymentIntent.id}`);

  // 2. Create Checkout session with that Payment Intent
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: booking.email,
    payment_intent: paymentIntent.id, // ✅ attach existing Payment Intent
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Demo – ${booking.hospital_name}`,
            description: `Onboarding for ${booking.contact_name}`,
          },
          unit_amount: 50000,
        },
        quantity: 1,
      },
    ],
    metadata: {
      demo_booking_id: booking.id,
      plan_key: "advanced",
    },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        metadata: { demo_booking_id: booking.id },
      },
    },
    success_url: `${baseUrl}/register/${booking.feedback_token}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing?canceled=true`,
  });

  console.log(`✅ Checkout session created: ${session.id}`);
  return { session, paymentIntent };
}

async function confirmPayment(paymentIntentId) {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      number: "4242424242424242",
      exp_month: 12,
      exp_year: 2030,
      cvc: "123",
    },
  });

  const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethod.id,
  });
  console.log(`✅ Payment confirmed: ${confirmed.status} (${confirmed.id})`);
  return confirmed;
}

async function callVerifySession(sessionId) {
  const req = { query: { session_id: sessionId } };
  let responseData;
  const res = {
    status: (code) => {
      console.log(`📤 Response status: ${code}`);
      return res;
    },
    json: (data) => {
      responseData = data;
      console.log("📤 verifySession response:", JSON.stringify(data, null, 2));
      return res;
    },
  };
  await verifySession(req, res);
  return responseData;
}

(async function run() {
  console.log("🚀 Starting real payment test...");
  try {
    const booking = await createDemoBooking();
    const { session, paymentIntent } = await createCheckoutSession(booking);
    await confirmPayment(paymentIntent.id);

    console.log("⏳ Waiting 5s for Stripe to process...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("📞 Calling verifySession...");
    await callVerifySession(session.id);

    console.log("\n✅ Test completed! Check your inbox for the invoice email.");
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    console.error(err);
    process.exit(1);
  }
})();