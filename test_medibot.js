// test_medibot.js - Comprehensive 100% Automated Test Suite for MediBot
const { readDB, writeDB } = require('./models');
const { processChatMessage, getChatSuggestions } = require('./controllers/chatController');

let passed = 0;
let failed = 0;

const assert = (condition, title, details = '') => {
  if (condition) {
    passed++;
    console.log('✅ PASS:', title);
  } else {
    failed++;
    console.error('❌ FAIL:', title, details);
  }
};

const sendChat = async (message, context = {}, paymentInfo = null, user = null) => {
  let responseData = null;
  let statusCode = 200;
  const req = {
    body: { message, context, paymentInfo, history: [] },
    user: user || { id: 'test_user_1', name: 'Dr. Rajesh Sharma', email: 'rajesh.test@medpark.com', mobile: '9876543210' }
  };
  const res = {
    json: (d) => { responseData = d; return d; },
    status: (code) => { statusCode = code; return res; }
  };
  await processChatMessage(req, res);
  return { data: responseData, statusCode };
};

(async () => {
  console.log('====================================================');
  console.log('🚀 MEDIBOT 100% COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // --- TEST 1: Suggestions Endpoint ---
  let suggestionsData = null;
  const reqSugg = {};
  const resSugg = { json: (d) => { suggestionsData = d; return d; } };
  await getChatSuggestions(reqSugg, resSugg);
  assert(Array.isArray(suggestionsData?.suggestions) && suggestionsData.suggestions.length >= 15, 'GET /api/chat/suggestions returns rich prompt topics');

  // --- TEST 2: Greetings ---
  const t2 = await sendChat('Hi MediBot');
  assert(t2.data?.intent === 'greeting' && t2.data?.quickReplies?.length >= 4, 'Greetings reply and quick reply chips');

  // --- TEST 3: FAQs (Documents, Fasting, Visiting Hours, Fees, Insurance) ---
  const tDocs = await sendChat('What documents do I need to bring?');
  assert(tDocs.data?.reply?.includes('Photo ID') && tDocs.data?.reply?.includes('Previous Medical Records'), 'FAQ: Documents to bring');

  const tFast = await sendChat('Do I need to fast before a blood test?');
  assert(tFast.data?.reply?.includes('10–12 Hours Fasting') && tFast.data?.reply?.includes('Lipid Profile'), 'FAQ: Fasting guidelines');

  const tVisit = await sendChat('What are the hospital visiting hours?');
  assert(tVisit.data?.reply?.includes('Visiting Hours') && tVisit.data?.reply?.includes('ICU'), 'FAQ: Visiting hours');

  const tFees = await sendChat('What are doctor consultation fees?');
  assert(tFees.data?.reply?.includes('Consultation Fee') && tFees.data?.reply?.includes('Cardiologist'), 'FAQ: Consultation fees');

  const tInsur = await sendChat('Do you accept health insurance and cashless Mediclaim?');
  assert(tInsur.data?.reply?.includes('Insurance') && tInsur.data?.reply?.includes('Star Health'), 'FAQ: Insurance & TPA');

  const tCheckup = await sendChat('What full body master health checkup packages do you offer?');
  assert(tCheckup.data?.reply?.includes('Health Wellness') && tCheckup.data?.reply?.includes('Executive Master'), 'FAQ: Full body packages');

  const tVacc = await sendChat('Tell me about child and adult vaccination schedules');
  assert(tVacc.data?.reply?.includes('Vaccination') && tVacc.data?.reply?.includes('BCG'), 'FAQ: Vaccination schedules');

  const tMat = await sendChat('What are the maternity and delivery packages?');
  assert(tMat.data?.reply?.includes('Maternity Care') && tMat.data?.reply?.includes('C-Section'), 'FAQ: Maternity & delivery');

  // --- TEST 4: Emergency Helplines ---
  const tEmerg = await sendChat('Emergency contact ambulance');
  assert(tEmerg.data?.intent === 'emergency' && tEmerg.data?.action?.type === 'emergency_call', 'Emergency helpline & 1-click call action');

  // --- TEST 5: Hospitals Directory ---
  const tHosp = await sendChat('Explore hospitals and ICU beds');
  assert(tHosp.data?.intent === 'find_hospitals' && Array.isArray(tHosp.data?.hospitals), 'Hospitals directory and ICU bed count');

  // --- TEST 6: Pricing & Software Subscriptions ---
  const tPrice = await sendChat('What are hospital software pricing plans?');
  assert(tPrice.data?.intent === 'pricing_subscription' && tPrice.data?.reply?.includes('Quarterly'), 'Software pricing plans');

  // --- TEST 7: Cancellation & 90% Refund Policy ---
  const tRefund = await sendChat('How does cancellation and refund work?');
  assert(tRefund.data?.intent === 'cancellation_refund' && tRefund.data?.reply?.includes('90%'), 'Cancellation & 90% refund policy');

  // --- TEST 8: Full In-Chat Doctor Appointment Booking Multi-Step Wizard ---
  console.log('\n--- Testing Multi-Step Doctor Consultation Booking Wizard ---');
  // Step 1: Start booking
  const step1 = await sendChat('Book doctor appointment');
  assert(step1.data?.intent === 'booking_step_specialty', 'Booking Step 1: Specialty Prompt');

  // Step 2: Choose Cardiology
  const step2 = await sendChat('Cardiology ❤️', step1.data.context);
  assert(step2.data?.intent === 'booking_step_hospital' && step2.data?.context?.bookingState?.specialty === 'Cardiology', 'Booking Step 2: Hospital Prompt for Cardiology');

  // Step 3: Choose Hospital
  const step3 = await sendChat('Apollo Multi-Specialty Hospital', step2.data.context);
  assert(step3.data?.intent === 'booking_step_date' && step3.data?.context?.bookingState?.hospitalName === 'Apollo Multi-Specialty Hospital', 'Booking Step 3: Date Prompt');

  // Step 4: Choose Future Date
  const targetDate = '2026-10-15';
  const step4 = await sendChat(targetDate, step3.data.context);
  assert(step4.data?.intent === 'booking_step_time' && Array.isArray(step4.data?.availableSlots) && step4.data.availableSlots.length > 0, 'Booking Step 4: Time Slot List with Available Slots');

  // Step 5: Choose Open Time Slot
  const step5 = await sendChat('10:30 AM', step4.data.context);
  assert(step5.data?.intent === 'booking_step_confirm' && step5.data?.context?.bookingState?.time === '10:30', 'Booking Step 5: Patient Details / Confirmation');

  // Step 6: Confirm Details -> Payment Choice
  const step6 = await sendChat('✅ Confirm Details', step5.data.context);
  assert(step6.data?.intent === 'booking_step_payment_choice' && step6.data?.action?.type === 'open_payment_modal', 'Booking Step 6: Payment Options with Gateway Modal Trigger');

  // Step 7: Catch Payment / Verification
  const step7 = await sendChat('✅ Payment Completed (Stripe Card - ID: ST_TEST_DOC_101)', step6.data.context, {
    paymentId: 'ST_TEST_DOC_101',
    paymentMethod: 'Stripe Card (•••• 4242)',
    paymentAmount: 800
  });
  assert(step7.data?.intent === 'appointment_booked_success', 'Booking Step 7: Confirmed & Paid Booking Creation');
  assert(step7.data?.appointment?.appointment_number >= 1000, 'Booking Step 7: Unique 4-digit appointment # generated');
  assert(step7.data?.paymentDetails?.paymentId === 'ST_TEST_DOC_101', 'Booking Step 7: Payment Details Card data returned');
  assert(Array.isArray(step7.data?.nextOptions) && step7.data.nextOptions.length === 5, 'Booking Step 7: 5 Next Action Options provided');

  const createdDocApptId = step7.data?.appointment?.id;
  const createdDocApptNum = step7.data?.appointment?.appointment_number;

  // --- TEST 9: Appointment Tracking with the newly generated #number ---
  console.log('\n--- Testing Appointment Tracking ---');
  const tTrack = await sendChat('Track #' + createdDocApptNum);
  assert(tTrack.data?.intent === 'track_appointment' && Number(tTrack.data?.appointment?.appointment_number) === Number(createdDocApptNum), 'Live tracking found appointment #' + createdDocApptNum);

  // --- TEST 10: Invoice Download Query ---
  console.log('\n--- Testing Invoice Download Query ---');
  const tInv = await sendChat('Download invoice #' + createdDocApptNum);
  assert(tInv.data?.action?.type === 'download_invoice' || tInv.data?.action?.type === 'view_appointment', 'Invoice download query retrieves valid invoice action');

  // --- TEST 11: Dynamic Slot Exclusion & Booked Slot Validation ---
  console.log('\n--- Testing Slot Exclusion & Validation ---');
  // For date '2026-10-15' at Apollo, '10:30 AM' is now BOOKED!
  const stepCheckDate = await sendChat(targetDate, {
    bookingState: {
      step: 'date',
      hospitalId: '1',
      hospitalName: 'Apollo Multi-Specialty Hospital',
      specialty: 'Cardiology'
    }
  });
  const hasBooked1030 = stepCheckDate.data?.availableSlots?.some(s => s.time24 === '10:30' || s.label === '10:30 AM');
  assert(hasBooked1030 === false, 'Booked slot (10:30 AM) is STRICTLY EXCLUDED from available slots list');

  // Attempt to select the booked slot directly
  const stepAttemptBooked = await sendChat('10:30 AM', {
    bookingState: {
      step: 'time',
      date: targetDate,
      hospitalId: '1',
      hospitalName: 'Apollo Multi-Specialty Hospital',
      specialty: 'Cardiology'
    }
  });
  assert(stepAttemptBooked.data?.intent === 'booking_step_time_retry', 'Attempt to book taken slot was rejected with booking_step_time_retry');

  // --- TEST 12: In-Chat Diagnostic Lab Test Booking Flow ---
  console.log('\n--- Testing Diagnostic Lab Test Booking Flow ---');
  const tLabStart = await sendChat('Book Complete Blood Count (CBC)');
  assert(tLabStart.data?.intent === 'booking_step_hospital' && tLabStart.data?.context?.bookingState?.specialty === 'Complete Blood Count (CBC)', 'Lab Test Booking: Direct CBC test recognition');

  const tLabDate = await sendChat('Fortis Memorial Health Institute', tLabStart.data.context);
  assert(tLabDate.data?.intent === 'booking_step_date', 'Lab Test Booking: Fortis Hospital selected');

  const tLabTime = await sendChat('2026-10-20', tLabDate.data.context);
  assert(tLabTime.data?.intent === 'booking_step_time' && tLabTime.data?.availableSlots?.length > 0, 'Lab Test Booking: Live slots retrieved');

  const tLabConfirm = await sendChat('09:30 AM', tLabTime.data.context);
  assert(tLabConfirm.data?.intent === 'booking_step_confirm', 'Lab Test Booking: Slot confirmed');

  const tLabPayChoice = await sendChat('✅ Confirm Details', tLabConfirm.data.context);
  assert(tLabPayChoice.data?.intent === 'booking_step_payment_choice' && tLabPayChoice.data?.action?.bookingData?.amount === 350, 'Lab Test Booking: Exact CBC Fee ₹350 charged');

  const tLabPaid = await sendChat('✅ Payment Completed (UPI QR - ID: UTR_TEST_CBC_555)', tLabPayChoice.data.context, {
    paymentId: 'UTR_TEST_CBC_555',
    paymentMethod: 'Free UPI QR',
    paymentAmount: 350
  });
  assert(tLabPaid.data?.intent === 'appointment_booked_success' && tLabPaid.data?.appointment?.appointmentType === 'Lab Test', 'Lab Test Booking: Successfully created Lab Test appointment row');

  const createdLabApptId = tLabPaid.data?.appointment?.id;

  // --- TEST 13: Cancel Wizard Flow ---
  console.log('\n--- Testing Wizard Cancellation ---');
  const tWizardCancel = await sendChat('Cancel booking', { bookingState: { step: 'hospital', specialty: 'Neurology' } });
  assert(tWizardCancel.data?.intent === 'booking_cancelled' && tWizardCancel.data?.context?.bookingState === null, 'In-chat booking wizard cancelled cleanly');

  // --- CLEANUP TEST DATABASE ROWS ---
  const db = readDB();
  db.appointments = (db.appointments || []).filter(a => a.id !== createdDocApptId && a.id !== createdLabApptId);
  writeDB(db);
  console.log('\n🧹 Cleaned up test bookings from db.json');

  console.log('\n====================================================');
  console.log('🎉 TEST SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED (Total: ' + (passed + failed) + ')');
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
