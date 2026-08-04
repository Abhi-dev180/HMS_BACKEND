#!/usr/bin/env node

/**
 * Full end‑to‑end test for appointment → feedback flow.
 * It uses the live backend API and Supabase.
 * 
 * Run: node scripts/test-appointment-feedback-flow.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const axios = require('axios');
const { supabase } = require('../config/supabase');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';

// ─── Helpers ──────────────────────────────────────────────────
const randomStr = (len = 6) => Math.random().toString(36).substring(2, 2 + len);
const generateEmail = () => `test+${randomStr()}@example.com`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Generate a future date 30 days from now
const getFutureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

// Generate a random time (e.g., 09:30, 10:15, 14:45, 16:20)
const getRandomTime = () => {
  const hours = Math.floor(Math.random() * 8) + 9; // 9-16
  const minutes = ['00','15','30','45'][Math.floor(Math.random() * 4)];
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

// ─── Main test ──────────────────────────────────────────────
(async () => {
  console.log('\n🧪 Starting appointment → feedback full flow test...\n');

  try {
    // 1. Get a hospital ID (use the first one from the DB)
    const { data: hospitals } = await supabase.from('hospitals').select('id').limit(1);
    if (!hospitals || hospitals.length === 0) {
      throw new Error('No hospitals found. Please create at least one hospital.');
    }
    const hospitalId = hospitals[0].id;
    console.log(`🏥 Using hospital: ${hospitalId}`);

    // 2. Book a public appointment with a unique date/time
    const patientEmail = generateEmail();
    const bookingDate = getFutureDate();
    const bookingTime = getRandomTime();
    const bookingPayload = {
      hospitalId,
      patientName: 'Test Patient',
      patientPhone: '9876543210',
      email: patientEmail,
      date: bookingDate,
      time: bookingTime,
      description: 'Test appointment for feedback flow',
      petName: 'Fluffy',
      species: 'Dog',
    };

    console.log(`📅 Booking appointment for ${bookingDate} at ${bookingTime}...`);
    const bookRes = await axios.post(`${API_BASE}/appointments/public`, bookingPayload);
    const appointment = bookRes.data.appointment;
    const appointmentNumber = appointment.appointment_number;
    console.log(`✅ Appointment booked: #${appointmentNumber} (ID: ${appointment.id})`);

    // 3. Verify appointment number is persisted in DB
    const { data: apptCheck } = await supabase
      .from('appointments')
      .select('appointment_number')
      .eq('id', appointment.id)
      .single();
    if (apptCheck?.appointment_number !== appointmentNumber) {
      throw new Error('Appointment number not persisted correctly.');
    }
    console.log('✅ Appointment number persisted.');

    // 4. Mark the appointment as Completed (simulate admin action via API)
    console.log('⏳ Marking appointment as Completed...');
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ status: 'Completed', updatedAt: new Date().toISOString() })
      .eq('id', appointment.id);
    if (updateErr) throw new Error(`Failed to update status: ${updateErr.message}`);
    console.log('✅ Appointment marked as Completed.');

    // 5. Wait for the async feedback invitation email to be sent (optional)
    await sleep(2000);

    // 6. Submit feedback using the public endpoint
    const feedbackPayload = {
      appointmentNumber: Number(appointmentNumber),
      rating: 5,
      message: 'Great service! Very friendly staff.',
      patientName: 'Test Patient',
      petName: 'Fluffy',
      date: bookingDate,
    };

    console.log('📝 Submitting feedback...');
    const fbRes = await axios.post(`${API_BASE}/feedback/public`, feedbackPayload);
    if (fbRes.status !== 201) {
      throw new Error(`Feedback submission failed: ${fbRes.data.message}`);
    }
    console.log('✅ Feedback submitted successfully.');

    // 7. Verify feedback is linked to the appointment
    const { data: feedbackCheck } = await supabase
      .from('appointment_feedbacks')
      .select('id, appointment_id, feedbacktext, rating')
      .eq('appointment_id', appointment.id)
      .single();
    if (!feedbackCheck) {
      throw new Error('Feedback not found for the appointment.');
    }
    console.log(`📝 Feedback recorded: "${feedbackCheck.feedbacktext}" (rating ${feedbackCheck.rating})`);

    // 8. Verify duplicate feedback is blocked
    try {
      await axios.post(`${API_BASE}/feedback/public`, feedbackPayload);
      throw new Error('Duplicate feedback was not blocked.');
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('✅ Duplicate feedback correctly blocked.');
      } else {
        throw new Error(`Unexpected error on duplicate submission: ${err.message}`);
      }
    }

    console.log('\n🎉 All tests passed! The appointment → feedback flow is working correctly.');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
    process.exit(1);
  }
})();