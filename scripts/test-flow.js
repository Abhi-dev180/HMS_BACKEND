// scripts/test-flow.js
const axios = require('axios');

// ==========================================
// 1. CONFIGURATION (Edit these 3 lines!)
// ==========================================
const API_BASE = 'http://localhost:5000/api'; // Change if hosted elsewhere

// 🔴 REPLACE THESE WITH YOUR REAL DATABASE CREDENTIALS
const SUPERADMIN_EMAIL = 'superadmin@hospital.com';        // <-- Change this
const SUPERADMIN_PASSWORD = '123';    // <-- Change this

const ADMIN_EMAIL = 'rahulkhannafree@gmail.com';            // <-- Change this
const ADMIN_PASSWORD = 'Amneet@99';        // <-- Change this

// 🔴 REPLACE THIS WITH A REAL HOSPITAL ID FROM YOUR SUPABASE 'hospitals' TABLE
const HOSPITAL_ID = '1785382305925'; // <-- Change this

// ==========================================
// 2. VARIABLES
// ==========================================
let superAdminToken = '';
let adminToken = '';
let userId = '';
let appointmentId = '';
let feedbackId = '';

// Helper to log steps clearly
const log = (step, data) => {
  console.log(`\n✅ [${step}]`, data || 'Success');
};

const logError = (step, error) => {
  console.error(`\n❌ [${step}] Failed:`, error.response?.data || error.message);
};

// ==========================================
// 3. RUN THE FULL E2E FLOW
// ==========================================
const runFullFlow = async () => {
  try {
    console.log('\n🚀 Starting E2E Hospital System Test...\n');

    // 1. SUPERADMIN LOGIN
    log('1. SuperAdmin Login');
    const saLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD
    });
    superAdminToken = saLogin.data.token;
    log('SuperAdmin Token', superAdminToken ? 'Acquired ✅' : 'Failed ❌');

    // 2. ADMIN LOGIN
    log('2. Admin Login');
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    adminToken = adminLogin.data.token;
    log('Admin Token', adminToken ? 'Acquired ✅' : 'Failed ❌');

    // 3. REGISTRATION (Generates a unique user every time so it NEVER fails)
    const uniqueId = Date.now(); 
    log('3. Registering a new Hospital');
    const regRes = await axios.post(`${API_BASE}/registrations`, {
      hospitalName: `Test Hospital ${uniqueId}`,
      contactName: `Test Admin ${uniqueId}`,
      email: `hospitaladmin_${uniqueId}@example.com`,
      phone: '9999999999',
      password: 'TestPassword123',
      hospitalId: HOSPITAL_ID,
      sessionId: 'cs_test_dummy_1234567890ABCDEF'
    });

    userId = regRes.data.registration?.id; 
    
    if (!userId) {
      throw new Error('Registration succeeded but did not return an ID. Check your backend response structure.');
    }
    
    log('Hospital Registered', `ID: ${userId}`);

    // 4. SUPERADMIN APPROVES REGISTRATION (Using PATCH to match your router)
    log('4. Superadmin Approving Registration');
    await axios.patch(
      `${API_BASE}/registrations/${userId}`,
      { status: 'approved' },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    log('Registration Approved');

    // 5. CONTACT FORM SUBMISSION
    log('5. Submitting a Contact Request');
    await axios.post(`${API_BASE}/contacts`, {
      name: 'Test Contact',
      email: 'contact@test.com',
      message: 'This is an automated test contact request.'
    });
    log('Contact Submitted');

          // 6. DEMO BOOKING (Updated to match validation)
    log('6. Booking a Demo');
    const demoRes = await axios.post(`${API_BASE}/demos`, {
      hospitalName: 'Test Hospital1',      // Instead of "name"
      contactName: 'Test Demo User1',      // Instead of "name" (your controller likely needs this)
      email: 'demo1@test.com',
      company: 'Test Hospital1',           // Optional based on your schema
      date: new Date().toISOString().split('T')[0]
    });
    log('Demo Booked', `ID: ${demoRes.data.id}`);
    
     // 7. APPOINTMENT BOOKING (Guaranteed free slot)
    log('7. Booking an Appointment');
    const apptRes = await axios.post(
      `${API_BASE}/appointments`,
      {
        patientName: 'Test Patient Flow',
        patientPhone: '9999999999',
        petName: 'Fluffy',
        appointmentType: 'Consult',
        // ✅ 7 days in the future at 9 AM (should be totally free)
        date: new Date(new Date().getTime() + 604800000).toISOString().split('T')[0], 
        time: '09:00',
        hospitalId: HOSPITAL_ID,
        email: 'testflow@example.com'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    appointmentId = apptRes.data.appointment?.id || apptRes.data.id;
    log('Appointment Booked', `ID: ${appointmentId}`);

    

    // 8. FEEDBACK SUBMISSION
    log('8. Submitting Feedback');
    const fbRes = await axios.post(
      `${API_BASE}/appointment-feedbacks`,
      {
        patientName: 'Test Patient Flow',
        petName: 'Fluffy',
        appointmentType: 'Consult',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        feedbackStatus: 'Pending',
        feedbackGiven: true,
        feedbackText: 'Great service! Automated test.',
        appointment_id: appointmentId
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    feedbackId = fbRes.data.id;
    log('Feedback Submitted', `ID: ${feedbackId}`);

    // 9. RESCHEDULE APPOINTMENT (Use a time that is definitely not booked)
    log('9. Rescheduling Appointment');
    await axios.put(
      `${API_BASE}/appointments/${appointmentId}`,
      {
        date: new Date(new Date().getTime() + 172800000).toISOString().split('T')[0], // Day after tomorrow
        time: '15:00' // 👈 Changed from 14:00 to 15:00 to avoid conflicts
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    log('Appointment Rescheduled');


       // 10. CANCEL APPOINTMENT (Admin cancels using the 'status' endpoint)
    log('10. Cancelling Appointment');
    await axios.put(
      `${API_BASE}/appointments/${appointmentId}/status`,
      { status: 'Cancelled' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    log('Appointment Cancelled');


    // 11. CHECK SUPERADMIN STATS (Badge Testing)
    log('11. Fetching Superadmin Dashboard Stats');
    const statsRes = await axios.get(
      `${API_BASE}/stats/overview`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );
    console.log('   📊 Stats Received:', statsRes.data);

    console.log('\n🎉🎉🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉🎉🎉');
    
  } catch (error) {
    logError('Critical Flow Error', error);
    console.log('\n❌ Test flow stopped due to an error.');
    console.log('\n💡 TIP: Double-check your email, password, and hospitalId in the script.');
  }
};

// Execute the script
runFullFlow();