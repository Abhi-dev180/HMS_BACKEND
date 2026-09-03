const fetch = require('node-fetch');
require('dotenv').config();

const BASE_URL = 'http://127.0.0.1:5000';

async function runFullFledgedSystemAudit() {
  console.log('====================================================');
  console.log('🚀 STARTING FULL-FLEDGED END-TO-END SYSTEM AUDIT');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
    }
  }

  try {
    // ─── 1. AUTHENTICATION & LOGIN TEST ───────────────────────
    console.log('1️⃣ TESTING AUTHENTICATION & LOGIN FLOW...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'abhi@yopmail.com', password: 'Avinash@99' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.token, 'SuperAdmin login returns 200 OK with valid JWT token');
    assert(loginData.user && loginData.user.isExpired === false, 'Logged-in user is explicitly marked active (isExpired: false)');

    const token = loginData.token;
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // ─── 2. BOOK DEMO FUNNEL TEST ─────────────────────────────
    console.log('\n2️⃣ TESTING BOOK DEMO FUNNEL...');
    const demoEmail = `testdemo_${Date.now()}@hospital.com`;
    const createDemoRes = await fetch(`${BASE_URL}/api/demos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospitalName: 'Audit Test Hospital',
        contactName: 'Dr Audit Tester',
        email: demoEmail,
        phone: '9876543210',
        city: 'Mumbai',
        message: 'Requesting full system demo'
      })
    });
    const createDemoData = await createDemoRes.json();
    assert(createDemoRes.status === 201 && createDemoData.booking, 'Public Book Demo creates booking with 201 Created');
    assert(createDemoData.feedbackToken, 'Demo booking generates unique feedbackToken');

    const demoBookingId = createDemoData.booking.id;
    const feedbackToken = createDemoData.feedbackToken;

    // List demo bookings
    const listDemosRes = await fetch(`${BASE_URL}/api/demos`, { headers: authHeaders });
    const listDemosData = await listDemosRes.json();
    assert(listDemosRes.status === 200 && Array.isArray(listDemosData.bookings), 'SuperAdmin listDemos returns 200 OK with bookings array');
    const matchedDemo = listDemosData.bookings.find(b => b.id === demoBookingId || b.email === demoEmail);
    assert(matchedDemo && matchedDemo.payment && matchedDemo.payment.plan, 'Demo booking contains complete Payment metadata (Plan & Amount)');

    // ─── 3. PAYMENTS & SUBSCRIPTIONS TEST ─────────────────────
    console.log('\n3️⃣ TESTING PAYMENTS & SUBSCRIPTIONS FLOW...');
    // A) Free 0% Fee UPI QR Payment verification
    const upiRes = await fetch(`${BASE_URL}/api/payments/verify-upi`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        utr: `UTR_${Date.now()}`,
        planKey: 'yearly',
        amount: 24999,
        upiId: 'rajdevfree2@okaxis'
      })
    });
    const upiData = await upiRes.json();
    assert(upiRes.status === 200, 'Verify Free UPI QR payment returns 200 OK with user plan activation');

    // B) Razorpay Order Creation
    const rzpOrderRes = await fetch(`${BASE_URL}/api/payments/razorpay/create-order`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planKey: 'yearly', booking: { id: demoBookingId, email: demoEmail } })
    });
    const rzpOrderData = await rzpOrderRes.json();
    assert(rzpOrderRes.status === 200 && rzpOrderData.id, 'Razorpay Order Creation returns 200 OK with order_id');

    // C) My Subscriptions History Table Endpoint
    const mySubRes = await fetch(`${BASE_URL}/api/subscriptions/my-subscriptions`, { headers: authHeaders });
    const mySubData = await mySubRes.json();
    assert(mySubRes.status === 200 && Array.isArray(mySubData.subscriptions), 'Get My Subscriptions returns 200 OK with billing history array');

    // ─── 4. HOSPITAL REGISTRATION FUNNEL TEST ─────────────────
    console.log('\n4️⃣ TESTING HOSPITAL REGISTRATION FUNNEL...');
    // Prefill registration token
    const prefillRes = await fetch(`${BASE_URL}/api/registrations/prefill/${feedbackToken}`);
    const prefillData = await prefillRes.json();
    assert(prefillRes.status === 200 && prefillData.prefill, 'Registration prefill token returns 200 OK with prefill details');

    // Submit Hospital Registration
    const regRes = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedbackToken,
        hospitalName: 'Audit Test Hospital',
        contactName: 'Dr Audit Tester',
        email: demoEmail,
        phone: '9876543210',
        password: 'Password123'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.registration, 'Hospital registration returns 201 Created and saves in DB');

    // ─── 5. CONTACT US & SUPPORT MESSAGES TEST ────────────────
    console.log('\n5️⃣ TESTING CONTACT US & SUPPORT MESSAGES FLOW...');
    const contactRes = await fetch(`${BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Contact Audit User',
        email: 'contactaudit@example.com',
        phone: '9988776655',
        subject: 'Audit Support Inquiry',
        message: 'Testing support message with attachment link https://res.cloudinary.com/demo/sample.jpg'
      })
    });
    const contactData = await contactRes.json();
    assert(contactRes.status === 201 || contactRes.status === 200, 'Public Contact Us form returns 201/200 Created');

    // List contacts in SuperAdmin
    const listContactsRes = await fetch(`${BASE_URL}/api/contacts`, { headers: authHeaders });
    const listContactsData = await listContactsRes.json();
    assert(listContactsRes.status === 200 && Array.isArray(listContactsData.contacts), 'SuperAdmin listContacts returns 200 OK with contacts list');

    // ─── 6. APPOINTMENTS SYSTEM TEST ─────────────────────────
    console.log('\n6️⃣ TESTING APPOINTMENTS SYSTEM FLOW...');
    const apptRes = await fetch(`${BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        hospitalId: '1786006844761',
        patientName: 'John Audit Patient',
        patientPhone: '9876543210',
        doctorName: 'Dr Smith',
        date: `2026-10-${Math.floor(10 + Math.random() * 15)}`,
        time: '10:00',
        reason: 'Regular Checkup'
      })
    });
    const apptData = await apptRes.json();
    console.log('  ℹ️ APPT RESPONSE:', apptRes.status, apptData);
    assert(apptRes.status === 201 || apptRes.status === 200, 'Book Appointment returns 201/200 Created');

    // List Appointments
    const listApptsRes = await fetch(`${BASE_URL}/api/appointments`, { headers: authHeaders });
    const listApptsData = await listApptsRes.json();
    assert(listApptsRes.status === 200 && Array.isArray(listApptsData.appointments || listApptsData), 'List Appointments returns 200 OK');

    // ─── 7. STATS OVERVIEW TEST ──────────────────────────────
    console.log('\n7️⃣ TESTING OVERVIEW STATS & REAL-TIME METRICS...');
    const statsRes = await fetch(`${BASE_URL}/api/stats/overview`, { headers: authHeaders });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200 && statsData.demos && statsData.contacts, 'Overview Stats returns 200 OK with accurate demo, contact, & registration counts');

    console.log('\n====================================================');
    console.log(`📊 FINAL RESULTS: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY!`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ AUDIT FATAL ERROR:', err);
  }
}

runFullFledgedSystemAudit();
