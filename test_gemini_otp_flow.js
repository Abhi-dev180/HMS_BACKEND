// test_gemini_otp_flow.js
// Automated test suite for Gemini AI integration & Unauthenticated OTP Cancellation Flow
require('dotenv').config();
const { processChatMessage } = require('./controllers/chatController');
const { generateChatResponse } = require('./services/geminiService');
const { readDB, writeDB } = require('./models');

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
    user: user || null
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
  console.log('🧪 TESTING GOOGLE GEMINI AI & CANCELLATION OTP FLOW');
  console.log('====================================================\n');

  // ──────────────────────────────────────────────────
  // TEST 1: Direct Google Gemini Service Call
  // ──────────────────────────────────────────────────
  console.log('--- TEST 1: Gemini Service Direct Call ---');
  const geminiDirect = await generateChatResponse({
    message: 'What are 3 quick remedies for mild acidity or heartburn?',
    history: []
  });
  assert(
    geminiDirect && geminiDirect.reply && geminiDirect.source === 'gemini',
    'Gemini API generates intelligent healthcare response using configured API key',
    geminiDirect?.reply?.slice(0, 100)
  );

  // ──────────────────────────────────────────────────
  // TEST 2: Chatbot Fallback / General Query via Gemini
  // ──────────────────────────────────────────────────
  console.log('\n--- TEST 2: MediBot Conversational AI via Gemini ---');
  const geminiChat = await sendChat('What are the common symptoms of migraine vs tension headache?');
  assert(
    geminiChat.data?.intent === 'gemini_ai_response' && geminiChat.data?.source === 'gemini',
    'Chatbot routes general medical question to Google Gemini AI',
    geminiChat.data?.reply?.slice(0, 100)
  );

  // ──────────────────────────────────────────────────
  // TEST 3: Booking Flow WITHOUT Login -> Asks for Gmail
  // ──────────────────────────────────────────────────
  console.log('\n--- TEST 3: Booking WITHOUT Login (Requires Gmail) ---');
  // Step 1: Start booking
  const bStep1 = await sendChat('Book doctor appointment', {}, null, null);
  // Step 2: Choose specialty
  const bStep2 = await sendChat('Cardiology ❤️', bStep1.data.context, null, null);
  // Step 3: Choose hospital
  const bStep3 = await sendChat('MEDPARK Super Specialty Hospital', bStep2.data.context, null, null);
  // Step 4: Choose date
  const bStep4 = await sendChat('Tomorrow', bStep3.data.context, null, null);
  // Step 5: Choose time slot
  const slotToPick = bStep4.data.availableSlots?.[0]?.time || '10:00 AM';
  const bStep5 = await sendChat(slotToPick, bStep4.data.context, null, null);

  assert(
    bStep5.data?.intent === 'booking_step_patient_details' &&
    bStep5.data?.reply?.includes('Gmail') &&
    bStep5.data?.reply?.includes('OTP'),
    'Booking without login explicitly asks for Patient Name, Mobile, and Gmail for OTP'
  );

  // If user only enters name & phone without email, bot insists on Gmail
  const bStep5NoEmail = await sendChat('Vikas Sharma, 9876543210', bStep5.data.context, null, null);
  assert(
    bStep5NoEmail.data?.intent === 'booking_step_patient_details' &&
    bStep5NoEmail.data?.reply?.includes('Gmail Address Required'),
    'Bot prompts specifically for Gmail if missing during unauthenticated booking'
  );

  // Now user provides Gmail
  const bStep6 = await sendChat('vikas.sharma@gmail.com', bStep5NoEmail.data.context, null, null);
  assert(
    bStep6.data?.intent === 'booking_step_payment_choice' &&
    bStep6.data?.action?.bookingData?.email === 'vikas.sharma@gmail.com',
    'Gmail captured and included in booking data'
  );

  // Complete booking at counter
  const bStep7 = await sendChat('🏥 Pay at Hospital Counter', bStep6.data.context, null, null);
  const unauthAppt = bStep7.data?.appointment;
  assert(
    unauthAppt && unauthAppt.appointment_number && unauthAppt.email === 'vikas.sharma@gmail.com',
    'Unauthenticated appointment successfully created with patient Gmail'
  );

  // ──────────────────────────────────────────────────
  // TEST 4: Booking Flow WITH Login -> Skips Gmail & OTP Prompt
  // ──────────────────────────────────────────────────
  console.log('\n--- TEST 4: Booking WITH Login (Skips Gmail & OTP prompt) ---');
  const loggedInUser = {
    id: 'user_auth_123',
    name: 'Dr. Ananya Roy',
    email: 'ananya.roy@medpark.com',
    mobile: '9812345678'
  };

  const aStep1 = await sendChat('Book doctor appointment', {}, null, loggedInUser);
  const aStep2 = await sendChat('Orthopedics 🦴', aStep1.data.context, null, loggedInUser);
  const aStep3 = await sendChat('MEDPARK Super Specialty Hospital', aStep2.data.context, null, loggedInUser);
  const aStep4 = await sendChat('Tomorrow', aStep3.data.context, null, loggedInUser);
  const aSlot = aStep4.data.availableSlots?.[0]?.time || '11:00 AM';
  const aStep5 = await sendChat(aSlot, aStep4.data.context, null, loggedInUser);

  assert(
    aStep5.data?.intent === 'booking_step_confirm' &&
    aStep5.data?.reply?.includes('Dr. Ananya Roy') &&
    aStep5.data?.reply?.includes('ananya.roy@medpark.com'),
    'Logged in user skips Gmail prompt; details auto-filled'
  );

  const aStep6 = await sendChat('✅ Confirm Details', aStep5.data.context, null, loggedInUser);
  const aStep7 = await sendChat('🏥 Pay at Hospital Counter', aStep6.data.context, null, loggedInUser);
  const authAppt = aStep7.data?.appointment;
  assert(
    authAppt && authAppt.appointment_number && authAppt.email === 'ananya.roy@medpark.com',
    'Logged-in booking successfully completed'
  );

  // ──────────────────────────────────────────────────
  // TEST 5: Cancellation Flow WITHOUT Login (Requires 4-Digit OTP)
  // ──────────────────────────────────────────────────
  console.log('\n--- TEST 5: Cancellation WITHOUT Login (Requires 4-digit OTP) ---');
  // User initiates cancellation for unauthenticated appointment #unauthAppt.appointment_number
  const cReq = await sendChat(`Cancel #${unauthAppt.appointment_number}`, {}, null, null);
  assert(
    cReq.data?.intent === 'cancellation_otp_prompt' &&
    cReq.data?.context?.cancellationState?.step === 'verify_otp' &&
    cReq.data?.context?.cancellationState?.otp?.length === 4 &&
    cReq.data?.reply?.includes('4-digit verification OTP'),
    'Cancellation without login generates 4-digit OTP and asks user to verify'
  );

  const generatedOtp = cReq.data.context.cancellationState.otp;
  console.log('   Generated 4-digit OTP sent to Gmail:', generatedOtp);

  // Try wrong OTP
  const cWrong = await sendChat('9999', cReq.data.context, null, null);
  assert(
    cWrong.data?.intent === 'cancellation_otp_mismatch' &&
    cWrong.data?.reply?.includes('Incorrect 4-Digit OTP'),
    'Wrong 4-digit OTP is rejected'
  );

  // Test Resend OTP
  const cResend = await sendChat('🔄 Resend OTP', cReq.data.context, null, null);
  assert(
    cResend.data?.intent === 'cancellation_otp_resent' &&
    cResend.data?.context?.cancellationState?.otp?.length === 4,
    'Resend OTP generates new 4-digit OTP and updates state'
  );
  const newOtp = cResend.data.context.cancellationState.otp;

  // Provide correct new OTP
  const cCorrect = await sendChat(newOtp, cResend.data.context, null, null);
  assert(
    cCorrect.data?.intent === 'cancellation_success' &&
    cCorrect.data?.reply?.includes('OTP Verified Successfully') &&
    cCorrect.data?.reply?.includes('Cancelled Successfully'),
    'Valid 4-digit OTP successfully verifies and cancels appointment'
  );

  // ──────────────────────────────────────────────────
  // TEST 6: Cancellation Flow WITH Login (Skips OTP)
  // ──────────────────────────────────────────────────
  console.log('\n--- TEST 6: Cancellation WITH Login (Skips OTP) ---');
  const cAuthReq = await sendChat(`Cancel #${authAppt.appointment_number}`, {}, null, loggedInUser);
  assert(
    cAuthReq.data?.intent === 'cancellation_confirm_prompt' &&
    cAuthReq.data?.context?.cancellationState?.step === 'confirm_reason' &&
    cAuthReq.data?.reply?.includes('identity OTP verification is skipped'),
    'Logged in user skips OTP and gets direct confirmation prompt'
  );

  const cAuthConfirm = await sendChat('✅ Yes, Cancel & Refund', cAuthReq.data.context, null, loggedInUser);
  assert(
    cAuthConfirm.data?.intent === 'cancellation_success' &&
    cAuthConfirm.data?.reply?.includes('Cancelled Successfully'),
    'Logged in user cancellation confirmed and executed directly'
  );

  // Clean up test appointments from db.json
  const db = readDB();
  db.appointments = (db.appointments || []).filter(
    a => String(a.appointment_number) !== String(unauthAppt.appointment_number) &&
         String(a.appointment_number) !== String(authAppt.appointment_number)
  );
  writeDB(db);

  console.log('\n====================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('====================================================\n');
})();
