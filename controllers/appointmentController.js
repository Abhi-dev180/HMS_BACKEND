
// controllers/appointmentController.js
const jwt = require('jsonwebtoken');
const Users = require('../db/users');
const { supabase } = require('../config/supabase');
const { readDB, writeDB } = require('../models');
const {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate,
  sendAppointmentNewToSuperAdmin,
  sendAppointmentRescheduled,
  sendAppointmentCancelled,
  sendAppointmentFeedbackInvitation
} = require('../services/emailService');
const { generateAppointmentInvoice, generateCancellationInvoice } = require('../services/invoiceService');
const {
  getBookedSlotsForDate,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} = require('../services/googleCalendarService');
const { broadcast } = require('../services/websocketService');
const { getDailyTimeSlots } = require('../services/schedulerService');
const { createRefund } = require('../services/stripeService');
const razorpaySvc = require('../services/razorpayService');
const payuSvc = require('../services/payuService');

const T = 'appointments';
const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
const LOCKED_STATUSES = ['Completed', 'Cancelled'];
const ALLOWED_SLOTS = getDailyTimeSlots();

// ─── Helper: Calculate cancellation fee and net refund amount ─
const calculateCancellationFeeAndRefund = (appointment) => {
  const isPaid = String(appointment.paymentStatus || '').toLowerCase() === 'paid';
  const amountPaid = Number(appointment.paymentAmount || appointment.servicePrice || 0);

  if (!isPaid || amountPaid <= 0) {
    return {
      isPaid: false,
      amountPaid: 0,
      cancellationFee: 0,
      refundAmount: 0,
      refundStatus: 'No Refund'
    };
  }

  // 10% standard cancellation fee
  const cancellationFee = Math.round(amountPaid * 0.10 * 100) / 100;
  const refundAmount = Math.max(0, Math.round((amountPaid - cancellationFee) * 100) / 100);

  return {
    isPaid: true,
    amountPaid,
    cancellationFee,
    refundAmount,
    refundStatus: refundAmount > 0 ? 'Refunded' : 'No Refund'
  };
};

// ─── Helper: Execute complete cancellation workflow ───────────
const executeAppointmentCancellation = async ({ appointment, reason = '', cancelledBy = 'user' }) => {
  const refundCalc = calculateCancellationFeeAndRefund(appointment);
  let refundId = null;

  if (refundCalc.isPaid && refundCalc.refundAmount > 0) {
    const isRazorpay =
      String(appointment.paymentMethod || '').toLowerCase().includes('razorpay') ||
      (appointment.paymentId && String(appointment.paymentId).startsWith('pay_'));

    const isPayU =
      String(appointment.paymentMethod || '').toLowerCase().includes('payu') ||
      (appointment.paymentId && String(appointment.paymentId).startsWith('PAYU_')) ||
      (appointment.id && String(appointment.id).startsWith('payu_'));

    try {
      if (isPayU) {
        const payuRefund = await payuSvc.createRefund({
          paymentId: appointment.payu_mihpayid || appointment.paymentId,
          amountInr: refundCalc.refundAmount,
          notes: {
            appointmentNumber: appointment.appointment_number,
            reason: reason || 'Appointment cancellation'
          }
        });
        refundId = payuRefund.refundId || `payu_rfnd_${Date.now()}`;
      } else if (isRazorpay) {
        const rzpRefund = await razorpaySvc.createRefund({
          paymentId: appointment.paymentId,
          amountInr: refundCalc.refundAmount,
          notes: {
            appointmentNumber: appointment.appointment_number,
            reason: reason || 'Appointment cancellation'
          }
        });
        refundId = rzpRefund.refundId || `rfnd_${Date.now()}`;
      } else {
        const refundRes = await createRefund({
          paymentIntentId: (appointment.paymentId && String(appointment.paymentId).startsWith('pi_')) ? appointment.paymentId : null,
          sessionId: appointment.stripe_session_id || (appointment.paymentId && String(appointment.paymentId).startsWith('cs_') ? appointment.paymentId : null),
          paymentId: appointment.paymentId || null,
          amountInr: refundCalc.refundAmount,
          reason: 'requested_by_customer'
        });
        refundId = refundRes.refundId || `re_${Date.now()}`;
      }
    } catch (err) {
      console.error('[appointments] Gateway refund error:', err.message);
      refundId = `re_err_${Date.now()}`;
      refundCalc.refundStatus = 'Refund Failed / Pending Manual Review';
    }
  }

  // Delete Google Calendar event if present
  if (appointment.google_event_id) {
    try {
      await deleteCalendarEvent(appointment.google_event_id);
    } catch (calErr) {
      console.error('[appointments] Google calendar deletion error:', calErr.message);
    }
  }

  const now = new Date().toISOString();
  const safeReason = reason && String(reason).trim() ? String(reason).trim() : `Cancelled by ${cancelledBy}`;
  const patch = {
    status: 'Cancelled',
    cancellationReason: safeReason,
    cancellationFee: refundCalc.cancellationFee,
    refundAmount: refundCalc.refundAmount,
    refundStatus: refundCalc.refundStatus,
    refundId: refundId,
    cancelledAt: now,
    updatedAt: now,
    google_event_id: null
  };

  let updatedAppointment = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).update(patch).eq('id', appointment.id).select().single();
      if (!error && data) updatedAppointment = data;
    } catch (e) {
      console.warn('[appointments] Supabase cancel update warning:', e.message);
    }
  }

  const db = readDB();
  db.appointments = db.appointments || [];
  const idx = db.appointments.findIndex((a) => String(a.id) === String(appointment.id));
  if (idx !== -1) {
    db.appointments[idx] = { ...db.appointments[idx], ...patch };
    writeDB(db);
    if (!updatedAppointment) updatedAppointment = db.appointments[idx];
  } else if (!updatedAppointment) {
    updatedAppointment = { ...appointment, ...patch };
  }

  // Sync payments table if there is an associated payment record
  try {
    const payPatch = {
      status: 'refunded',
      refund_id: refundId,
      refund_amount: refundCalc.refundAmount,
      updated_at: now
    };
    if (supabase) {
      if (appointment.stripe_session_id) {
        await supabase.from('payments').update(payPatch).eq('stripe_session_id', appointment.stripe_session_id);
      }
      if (appointment.paymentId) {
        await supabase.from('payments').update(payPatch).eq('stripe_session_id', appointment.paymentId);
        await supabase.from('payments').update(payPatch).eq('payment_id', appointment.paymentId);
      }
      if (appointment.id) {
        await supabase.from('payments').update(payPatch).eq('booking_id', appointment.id);
      }
    }
    if (db && Array.isArray(db.payments)) {
      db.payments.forEach((p) => {
        if (
          (appointment.stripe_session_id && p.stripe_session_id === appointment.stripe_session_id) ||
          (appointment.paymentId && (p.stripe_session_id === appointment.paymentId || p.paymentId === appointment.paymentId || p.payment_id === appointment.paymentId)) ||
          (appointment.id && String(p.booking_id) === String(appointment.id))
        ) {
          Object.assign(p, payPatch);
        }
      });
      writeDB(db);
    }
  } catch (payErr) {
    console.warn('[appointments] Payments table refund sync warning:', payErr.message);
  }

  // Generate cancellation invoice PDF
  let cancellationPdfBuffer = null;
  try {
    cancellationPdfBuffer = await generateCancellationInvoice(updatedAppointment);
  } catch (pdfErr) {
    console.error('[appointments] Failed to generate cancellation invoice PDF:', pdfErr);
  }

  // Send cancellation and refund receipt email
  const userEmail = await getUserEmail(updatedAppointment);
  if (userEmail) {
    sendAppointmentCancelled({
      to: userEmail,
      appointment: updatedAppointment,
      invoicePdfBuffer: cancellationPdfBuffer,
      patientName: updatedAppointment.patientName,
      hospitalName: updatedAppointment.hospital,
      date: updatedAppointment.date,
      time: updatedAppointment.time,
      reason: updatedAppointment.cancellationReason,
      appointmentNumber: updatedAppointment.appointment_number,
      appointmentType: updatedAppointment.appointmentType,
      serviceName: updatedAppointment.serviceName,
      serviceCategory: updatedAppointment.serviceCategory,
      sampleType: updatedAppointment.sampleType,
      doctorName: updatedAppointment.doctorName,
      petName: updatedAppointment.petName,
      species: updatedAppointment.species,
      breed: updatedAppointment.breed,
      paymentStatus: updatedAppointment.paymentStatus,
      paymentAmount: updatedAppointment.paymentAmount,
      paymentMethod: updatedAppointment.paymentMethod,
      cancellationFee: updatedAppointment.cancellationFee,
      refundAmount: updatedAppointment.refundAmount,
      refundId: updatedAppointment.refundId,
      refundStatus: updatedAppointment.refundStatus
    }).catch((e) => console.error('[appointments] cancellation email failed:', e));
  }

  // Send notification to superadmin
  sendAppointmentNewToSuperAdmin({
    patientName: updatedAppointment.patientName,
    patientPhone: updatedAppointment.patientPhone,
    email: userEmail || '',
    hospitalName: updatedAppointment.hospital,
    date: updatedAppointment.date,
    time: updatedAppointment.time,
    petName: updatedAppointment.petName,
    description: `CANCELLED (${cancelledBy}). Reason: ${updatedAppointment.cancellationReason}. Refund: ₹${updatedAppointment.refundAmount} (Fee: ₹${updatedAppointment.cancellationFee})`,
    source: 'cancellation',
    appointmentNumber: updatedAppointment.appointment_number
  }).catch((e) => console.error('[appointments] superadmin cancel notification failed:', e));

  broadcast('appointment_updated', updatedAppointment);
  broadcast('appointment_cancelled', { id: updatedAppointment.id, appointmentNumber: updatedAppointment.appointment_number, date: updatedAppointment.date, hospitalId: updatedAppointment.hospitalId });
  broadcast('slots_updated', { date: updatedAppointment.date, hospitalId: updatedAppointment.hospitalId });

  return updatedAppointment;
};

// ─── Helper: format time string to HH:mm ──────────────────────
const formatTimeString = (t) => {
  if (!t) return '';
  const clean = String(t).trim();
  const m = clean.match(/^(\d{1,2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (m) {
    const [h, mm] = m[1].split(':');
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  return clean;
};

// ─── Helper: generate unique 4‑digit appointment number ──────
const generateAppointmentNumber = async () => {
  let number, exists;
  do {
    number = Math.floor(1000 + Math.random() * 9000);
    exists = false;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from(T)
          .select('id')
          .eq('appointment_number', number)
          .limit(1);
        if (!error && data && data.length > 0) exists = true;
      } catch (e) {
        exists = false;
      }
    }
    if (!exists) {
      const db = readDB();
      exists = (db.appointments || []).some(a => Number(a.appointment_number) === number);
    }
  } while (exists);
  return number;
};

// ─── Helper: send feedback invitation ─────────────────────────
const sendFeedbackInvitation = async (appointment) => {
  try {
    const userEmail = await getUserEmail(appointment);
    if (!userEmail) return;
    const FRONTEND_REDIRECT_URL =
      process.env.FRONTEND_REDIRECT_URL ||
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
      'http://localhost:5173';
    const feedbackLink = `${FRONTEND_REDIRECT_URL}/feedback/appointment/${appointment.appointment_number}`;
    await sendAppointmentFeedbackInvitation({
      to: userEmail,
      patientName: appointment.patientName,
      hospitalName: appointment.hospital,
      appointmentNumber: appointment.appointment_number,
      date: appointment.date,
      time: appointment.time,
      feedbackLink
    });
  } catch (e) {
    console.error('[appointments] feedback invitation email failed:', e);
  }
};

// ─── Helper: get hospital name ────────────────────────────────
const hospitalName = async (hospitalId) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('hospitals').select('name').eq('id', hospitalId).limit(1);
      if (!error && data && data[0]) return data[0].name;
    } catch (e) { }
  }
  const db = readDB();
  const h = (db.hospitals || []).find((x) => String(x.id) === String(hospitalId));
  return h ? h.name : '';
};

// ─── Helper: get user email from appointment ──────────────────
const getUserEmail = async (appointment) => {
  if (appointment.email) return appointment.email;
  if (appointment.userId) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('email').eq('id', appointment.userId).single();
        if (!error && data?.email) return data.email;
      } catch (e) { }
    }
    const db = readDB();
    const u = (db.users || []).find((x) => String(x.id) === String(appointment.userId));
    return u?.email || null;
  }
  return null;
};

// ─── Helper: Google Calendar sync ─────────────────────────────
const syncGoogleCalendar = async (action, appointment, patch = {}) => {
  try {
    const pad = (v) => String(v).padStart(2, '0');
    const formatLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    const startObj = new Date(`${appointment.date}T${appointment.time}:00`);
    const startTime = formatLocal(startObj);
    const endTime = formatLocal(new Date(startObj.getTime() + 30 * 60000));

    const description = `
Appointment Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 Hospital: ${appointment.hospital || 'N/A'}
👤 Patient: ${appointment.patientName || 'N/A'}
📱 Phone: ${appointment.patientPhone || 'N/A'}
📧 Email: ${appointment.email || 'N/A'}
🐾 Pet Name: ${appointment.petName || 'N/A'}
🐶 Species: ${appointment.species || 'N/A'}
⚥ Sex: ${appointment.sex || 'N/A'}
📝 Breed: ${appointment.breed || 'N/A'}
📅 Date: ${appointment.date || 'N/A'}
⏰ Time: ${appointment.time || 'N/A'}
📋 Reason: ${appointment.reason || 'No additional details'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Appointment #${appointment.appointment_number}
Scheduled via Pet Hospital Portal
`.trim();

    if (action === 'create') {
      const event = await createCalendarEvent({
        summary: `Appointment - ${appointment.patientName}`,
        description: description,
        start: startTime,
        end: endTime,
        attendees: appointment.email ? [appointment.email] : []
      });
      await supabase
        .from(T)
        .update({ google_event_id: event.id })
        .eq('id', appointment.id);
      console.log('[googleCalendar] Event created:', event.id);
      return event;
    }

    if (action === 'update' && appointment.google_event_id) {
      const newStartObj = new Date(`${patch.date}T${patch.time}:00`);
      const newStart = formatLocal(newStartObj);
      const newEnd = formatLocal(new Date(newStartObj.getTime() + 30 * 60000));
      await updateCalendarEvent(appointment.google_event_id, {
        summary: `Appointment - ${appointment.patientName}`,
        description: description,
        start: newStart,
        end: newEnd
      });
      console.log('[googleCalendar] Event updated:', appointment.google_event_id);
    }

    if (action === 'delete' && appointment.google_event_id) {
      await deleteCalendarEvent(appointment.google_event_id);
      await supabase
        .from(T)
        .update({ google_event_id: null })
        .eq('id', appointment.id);
      console.log('[googleCalendar] Event deleted:', appointment.google_event_id);
    }
  } catch (err) {
    console.error('[googleCalendar] sync error:', err);
  }
};

// ─── GET /api/appointments/booked-slots ──────────────────────
const getBookedSlots = async (req, res) => {
  const { date, hospitalId } = req.query;
  if (!date) return res.status(400).json({ message: 'date query parameter is required' });

  try {
    const bookedSlots = await getBookedSlotsForDate(date, hospitalId);

    // Calculate past slots if date is today or in past
    const todayStr = new Date().toISOString().split('T')[0];
    let pastSlots = [];
    if (date < todayStr) {
      pastSlots = [...ALLOWED_SLOTS];
    } else if (date === todayStr) {
      const now = new Date();
      // At least 1 hour lead time from now
      const minValidTime = new Date(now.getTime() + 60 * 60 * 1000);
      const minHour = minValidTime.getHours();
      const minMinute = minValidTime.getMinutes();
      const minTimeStr = `${String(minHour).padStart(2, '0')}:${String(minMinute).padStart(2, '0')}`;

      pastSlots = ALLOWED_SLOTS.filter((slot) => slot < minTimeStr);
    }

    const allUnavailable = Array.from(new Set([...(bookedSlots || []), ...pastSlots]));
    const freeSlots = ALLOWED_SLOTS.filter((slot) => !allUnavailable.includes(slot));

    return res.json({
      date,
      hospitalId: hospitalId || null,
      bookedSlots: allUnavailable,
      availableSlots: freeSlots
    });
  } catch (err) {
    console.error('[appointments] booked-slots error:', err);
    return res.status(500).json({ message: 'Could not fetch booked slots' });
  }
};

// ─── POST /api/appointments (authenticated) ──────────────────
const bookAppointment = async (req, res) => {
  const {
    doctorName,
    date,
    time,
    patientName,
    patientPhone,
    reason,
    petName,
    species,
    sex,
    breed,
    appointmentType,
    serviceId,
    serviceName,
    serviceCategory,
    servicePrice,
    sampleType,
    fastingRequired,
    fastingDetails,
    turnaroundTime,
    paymentStatus,
    paymentId,
    paymentAmount,
    paymentMethod
  } = req.body;
  const hospitalId = req.body.hospitalId || (req.user.role === 'admin' ? req.user.hospitalId : undefined);
  if (!hospitalId || !patientName || !patientPhone || !date || !time) {
    return res.status(400).json({ message: 'Hospital, patient name, mobile number, date and time are required' });
  }

  const cleanTime = formatTimeString(time);

  // Validate appointment is not in past
  const appointmentDateTime = new Date(`${date}T${cleanTime}:00`);
  if (appointmentDateTime.getTime() < Date.now()) {
    return res.status(400).json({ message: 'Cannot book an appointment for a past date or time.' });
  }

  // 🛡️ Business hours validation
  if (!ALLOWED_SLOTS.includes(cleanTime)) {
    return res.status(400).json({ message: 'Selected time is outside business hours.' });
  }

  try {
    const booked = await getBookedSlotsForDate(date, hospitalId);
    if (Array.isArray(booked) && booked.includes(cleanTime)) {
      return res.status(409).json({ message: 'That slot is already booked. Please choose another time.' });
    }
  } catch (err) {
    console.error('[appointments] slot check failed:', err);
  }

  const appointmentNumber = await generateAppointmentNumber();

  const row = {
    id: Date.now().toString(),
    userId: req.user.id,
    hospitalId,
    hospital: await hospitalName(hospitalId),
    doctorName: doctorName || (serviceName ? `Lab: ${serviceName}` : 'Any Available Doctor'),
    date,
    time: cleanTime,
    patientName,
    patientPhone,
    email: req.body.email || req.user?.email || '',
    reason: reason || (serviceName ? `Diagnostic Test: ${serviceName}` : ''),
    petName: petName || '',
    species: species || '',
    sex: sex || '',
    breed: breed || '',
    appointmentType: appointmentType || (serviceName ? 'Lab Test' : 'Consult'),
    serviceId: serviceId || null,
    serviceName: serviceName || null,
    serviceCategory: serviceCategory || null,
    servicePrice: servicePrice !== undefined ? Number(servicePrice) : null,
    sampleType: sampleType || null,
    fastingRequired: Boolean(fastingRequired),
    fastingDetails: fastingDetails || '',
    turnaroundTime: turnaroundTime || '',
    status: 'Pending',
    paymentStatus: paymentStatus || 'Paid',
    paymentId: paymentId || `TRX_${Date.now()}`,
    paymentAmount: paymentAmount !== undefined ? Number(paymentAmount) : (servicePrice ? Number(servicePrice) : 500),
    paymentMethod: paymentMethod || 'Free UPI QR',
    appointment_number: appointmentNumber
  };

  let data = null;
  if (supabase) {
    try {
      const resIns = await supabase.from(T).insert(row).select().single();
      if (!resIns.error && resIns.data) data = resIns.data;
      else if (resIns.error) console.warn('[appointments] Supabase book insert warning:', resIns.error);
    } catch (err) {
      console.warn('[appointments] Supabase book failed, using db.json:', err.message || err);
    }
  }

  if (!data) {
    const db = readDB();
    db.appointments = db.appointments || [];
    db.appointments.unshift(row);
    writeDB(db);
    data = row;
  }

  // ─── Send confirmation email with appointment number & invoice ──────
  const recipientEmail = data.email || req.user?.email || req.body?.email;
  if (recipientEmail) {
    (async () => {
      let invoicePdfBuffer = null;
      if (String(data.paymentStatus).toLowerCase() === 'paid') {
        try {
          invoicePdfBuffer = await generateAppointmentInvoice(data);
        } catch (pdfErr) {
          console.error('[appointments] invoice PDF generation failed:', pdfErr);
        }
      }

      return sendAppointmentConfirmation({
        to: recipientEmail,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        hospitalName: data.hospital,
        date: data.date,
        time: data.time,
        petName: data.petName,
        species: data.species,
        sex: data.sex,
        breed: data.breed,
        appointmentType: data.appointmentType,
        serviceName: data.serviceName,
        serviceCategory: data.serviceCategory,
        sampleType: data.sampleType,
        fastingRequired: data.fastingRequired,
        fastingDetails: data.fastingDetails,
        turnaroundTime: data.turnaroundTime,
        paymentStatus: data.paymentStatus,
        paymentAmount: data.paymentAmount,
        paymentMethod: data.paymentMethod,
        description: data.reason,
        email: recipientEmail,
        appointmentNumber: data.appointment_number,
        invoicePdfBuffer
      });
    })().catch((e) => console.error('[appointments] confirmation email failed:', e));
  }

  // ─── Send admin notification with appointment number ──────
  sendAppointmentNewToSuperAdmin({
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    email: req.user?.email || '',
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    petName: data.petName,
    description: data.reason,
    source: 'dashboard',
    appointmentNumber: data.appointment_number
  }).catch((e) => console.error('[appointments] superadmin new-booking email failed:', e));

  syncGoogleCalendar('create', data).catch((e) => console.error('[appointments] google calendar create failed:', e));
  broadcast('appointment_created', data);
  return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
};

// ─── POST /api/appointments/public (unauthenticated) ─────────
const bookPublicAppointment = async (req, res) => {
  const {
    hospitalId,
    patientName,
    patientPhone,
    email,
    date,
    time,
    description,
    petName,
    species,
    sex,
    breed,
    appointmentType,
    serviceId,
    serviceName,
    serviceCategory,
    servicePrice,
    sampleType,
    fastingRequired,
    fastingDetails,
    turnaroundTime,
    paymentStatus,
    paymentId,
    paymentAmount,
    paymentMethod
  } = req.body || {};
  if (!hospitalId || !patientName || !patientPhone || !date || !time) {
    return res.status(400).json({ message: 'Hospital, patient name, mobile number, date and time are required' });
  }
  if (!/^\d{10}$/.test(String(patientPhone).trim())) {
    return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
  }

  const cleanTime = formatTimeString(time);

  // Validate appointment is not in past
  const appointmentDateTime = new Date(`${date}T${cleanTime}:00`);
  if (appointmentDateTime.getTime() < Date.now()) {
    return res.status(400).json({ message: 'Cannot book an appointment for a past date or time.' });
  }

  // 🛡️ Business hours validation
  if (!ALLOWED_SLOTS.includes(cleanTime)) {
    return res.status(400).json({ message: 'Selected time is outside business hours.' });
  }

  const name = await hospitalName(hospitalId);
  if (!name) return res.status(404).json({ message: 'Selected hospital not found' });

  try {
    const booked = await getBookedSlotsForDate(date, String(hospitalId));
    if (Array.isArray(booked) && booked.includes(cleanTime)) {
      return res.status(409).json({ message: 'That slot is already booked. Please choose another time.' });
    }
  } catch (err) {
    console.error('[appointments] public slot check failed:', err);
  }

  let resolvedUserId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      if (decoded && decoded.id) resolvedUserId = String(decoded.id);
    } catch (e) { }
  }
  if (!resolvedUserId && email) {
    try {
      const existingUser = await Users.findByEmail(email);
      if (existingUser && existingUser.id) resolvedUserId = String(existingUser.id);
    } catch (e) { }
  }

  const appointmentNumber = await generateAppointmentNumber();

  const row = {
    id: Date.now().toString(),
    userId: resolvedUserId,
    hospitalId: String(hospitalId),
    hospital: name,
    patientName: String(patientName).trim(),
    patientPhone: String(patientPhone).trim(),
    email: email ? String(email).trim() : '',
    date,
    time: cleanTime,
    reason: description ? String(description).trim() : (serviceName ? `Diagnostic Test: ${serviceName}` : ''),
    petName: petName || '',
    species: species || '',
    sex: sex || '',
    breed: breed || '',
    appointmentType: appointmentType || (serviceName ? 'Lab Test' : 'Consult'),
    serviceId: serviceId || null,
    serviceName: serviceName || null,
    serviceCategory: serviceCategory || null,
    servicePrice: servicePrice !== undefined ? Number(servicePrice) : null,
    sampleType: sampleType || null,
    fastingRequired: Boolean(fastingRequired),
    fastingDetails: fastingDetails || '',
    turnaroundTime: turnaroundTime || '',
    status: 'Pending',
    source: resolvedUserId ? 'dashboard' : 'public',
    paymentStatus: paymentStatus || 'Paid',
    paymentId: paymentId || `TRX_${Date.now()}`,
    paymentAmount: paymentAmount !== undefined ? Number(paymentAmount) : (servicePrice ? Number(servicePrice) : 500),
    paymentMethod: paymentMethod || 'Free UPI QR',
    appointment_number: appointmentNumber,
    createdAt: new Date().toISOString()
  };

  let data = null;
  if (supabase) {
    try {
      const res = await supabase.from(T).insert(row).select().single();
      if (!res.error && res.data) data = res.data;
    } catch (err) {
      console.warn('[appointments] Supabase public book failed, using db.json:', err.message || err);
    }
  }

  if (!data) {
    const db = readDB();
    db.appointments = db.appointments || [];
    db.appointments.unshift(row);
    writeDB(db);
    data = row;
  }

  // ─── Send confirmation email with appointment number & invoice ──────
  if (data.email) {
    (async () => {
      let invoicePdfBuffer = null;
      if (String(data.paymentStatus).toLowerCase() === 'paid') {
        try {
          invoicePdfBuffer = await generateAppointmentInvoice(data);
        } catch (pdfErr) {
          console.error('[appointments] invoice PDF generation failed:', pdfErr);
        }
      }

      return sendAppointmentConfirmation({
        to: data.email,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        hospitalName: data.hospital,
        date: data.date,
        time: data.time,
        petName: data.petName,
        description: data.reason,
        email: data.email,
        appointmentNumber: data.appointment_number,
        species: data.species,
        sex: data.sex,
        breed: data.breed,
        appointmentType: data.appointmentType,
        serviceName: data.serviceName,
        serviceCategory: data.serviceCategory,
        sampleType: data.sampleType,
        fastingRequired: data.fastingRequired,
        fastingDetails: data.fastingDetails,
        turnaroundTime: data.turnaroundTime,
        paymentStatus: data.paymentStatus,
        paymentAmount: data.paymentAmount,
        paymentMethod: data.paymentMethod,
        invoicePdfBuffer
      });
    })().catch((e) => console.error('[appointments] confirmation email failed:', e));
  }

  // ─── Send admin notification with appointment number ──────
  sendAppointmentNewToSuperAdmin({
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    email: data.email,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    petName: data.petName,
    description: data.reason,
    source: 'public',
    appointmentNumber: data.appointment_number
  }).catch((e) => console.error('[appointments] superadmin new-booking email failed:', e));

  await syncGoogleCalendar('create', data);
  broadcast('appointment_created', data);
  return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
};

const isNetErr = (err) =>
  /fetch failed|timeout|ENOTFOUND|ECONNREFUSED|UND_ERR/i.test(String(err && (err.message || err.details || err)));

const filterLocalAppointments = (dbAppointments, req) => {
  let list = dbAppointments || [];
  if (req.user?.role === 'admin') {
    list = list.filter((a) => String(a.hospitalId) === String(req.user.hospitalId));
  } else if (req.user?.role !== 'superadmin') {
    const uid = String(req.user?.id || '');
    const uemail = String(req.user?.email || '').trim().toLowerCase();
    const uphone = String(req.user?.mobile || req.user?.phone || '').replace(/\D/g, '');

    list = list.filter((a) => {
      const matchId = Boolean(uid && String(a.userId) === uid);
      const matchEmail = Boolean(uemail && a.email && String(a.email).trim().toLowerCase() === uemail);
      const matchPhone = Boolean(uphone && a.patientPhone && String(a.patientPhone).replace(/\D/g, '') === uphone);
      return matchId || matchEmail || matchPhone;
    });
  }
  const { from, to, search, status, type, page, limit } = req.query || {};
  if (from && to) {
    list = list.filter((a) => a.date >= from && a.date <= to);
  }
  if (status && status !== 'all') {
    list = list.filter((a) => a.status === status);
  }
  if (type && type !== 'all') {
    if (type === 'test') {
      list = list.filter((a) => a.appointmentType === 'Lab Test' || Boolean(a.serviceName));
    } else if (type === 'consult') {
      list = list.filter((a) => a.appointmentType !== 'Lab Test' && !a.serviceName);
    } else if (type === 'refunds') {
      list = list.filter((a) => a.status === 'Cancelled' || (a.refundAmount && a.refundAmount > 0) || a.refundStatus === 'Refunded');
    }
  }
  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter((a) =>
      (a.patientName || '').toLowerCase().includes(term) ||
      (a.petName || '').toLowerCase().includes(term) ||
      (a.email || '').toLowerCase().includes(term) ||
      (a.patientPhone || '').toLowerCase().includes(term) ||
      (a.hospital || '').toLowerCase().includes(term) ||
      (a.serviceName || '').toLowerCase().includes(term) ||
      (a.serviceCategory || '').toLowerCase().includes(term) ||
      (a.sampleType || '').toLowerCase().includes(term) ||
      (a.doctorName || '').toLowerCase().includes(term) ||
      (a.appointmentType || '').toLowerCase().includes(term) ||
      (a.refundId || '').toLowerCase().includes(term) ||
      (a.cancellationReason || '').toLowerCase().includes(term) ||
      (a.refundStatus || '').toLowerCase().includes(term) ||
      (a.paymentMethod || '').toLowerCase().includes(term) ||
      (a.appointment_number ? String(a.appointment_number).includes(term) : false)
    );
  }
  list.sort((a, b) => {
    const getCreationTime = (item) => {
      if (!item) return 0;
      if (item.createdAt) {
        const t = new Date(item.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (item.id && !isNaN(item.id) && Number(item.id) > 1000000000000) {
        return Number(item.id);
      }
      if (item.id && typeof item.id === 'string') {
        const m = item.id.match(/\d{13}/);
        if (m) return Number(m[0]);
      }
      if (item.appointment_number) {
        return Number(item.appointment_number) || 0;
      }
      return 0;
    };
    return getCreationTime(b) - getCreationTime(a);
  });
  if (page) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const fromIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(fromIndex, fromIndex + limitNum);
    return { appointments: paginated, total: list.length, page: pageNum, limit: limitNum };
  }
  return list;
};

// ─── GET /api/appointments ────────────────────────────────────
const getAppointments = async (req, res) => {
  try {
    let allAppointments = [];

    // 1. Fetch from Supabase if available
    if (supabase) {
      try {
        const { data, error } = await supabase.from(T).select('*').order('createdAt', { ascending: false });
        if (!error && Array.isArray(data)) {
          allAppointments = [...data];
        }
      } catch (err) {
        console.warn('[appointments] Supabase getAppointments query warning:', err.message || err);
      }
    }

    // 2. Combine with local db.json appointments (deduplicating by id)
    const db = readDB();
    const localList = db.appointments || [];
    const idSet = new Set(allAppointments.map((a) => String(a.id)));

    localList.forEach((la) => {
      if (la && la.id && !idSet.has(String(la.id))) {
        allAppointments.push(la);
        idSet.add(String(la.id));
      }
    });

    // 3. Apply role filtering, search, status, and pagination
    const result = filterLocalAppointments(allAppointments, req);
    return res.json(result);
  } catch (err) {
    console.error('[appointments] getAppointments unexpected error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /api/appointments/:id/cancel (authenticated) ───────
const cancelAppointment = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    let appointment = null;
    if (supabase) {
      try {
        const { data } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
        if (data) appointment = data;
      } catch (_) {}
    }
    if (!appointment) {
      const db = readDB();
      appointment = (db.appointments || []).find((a) => String(a.id) === String(id));
    }

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Role ownership check
    if (req.user?.role === 'user') {
      const uid = String(req.user.id || '');
      const uemail = String(req.user.email || '').trim().toLowerCase();
      const uphone = req.user.phone ? String(req.user.phone).replace(/\D/g, '') : '';
      const matchId = appointment.userId && String(appointment.userId) === uid;
      const matchEmail = appointment.email && String(appointment.email).trim().toLowerCase() === uemail;
      const matchPhone = uphone && appointment.patientPhone && String(appointment.patientPhone).replace(/\D/g, '') === uphone;
      if (!matchId && !matchEmail && !matchPhone) {
        return res.status(403).json({ message: 'Forbidden: You can only cancel your own appointments' });
      }
    } else if (req.user?.role === 'admin') {
      if (String(appointment.hospitalId) !== String(req.user.hospitalId)) {
        return res.status(403).json({ message: 'Forbidden: You can only cancel appointments for your hospital' });
      }
    }

    if (appointment.status === 'Cancelled') {
      return res.status(409).json({ message: 'This appointment is already cancelled.' });
    }
    if (appointment.status === 'Completed') {
      return res.status(409).json({ message: 'A completed appointment cannot be cancelled.' });
    }

    const updated = await executeAppointmentCancellation({
      appointment,
      reason: reason || 'Cancelled by patient',
      cancelledBy: req.user?.role || 'user'
    });

    return res.json({
      message: 'Appointment cancelled and refund processed successfully.',
      appointment: updated
    });
  } catch (error) {
    console.error('[appointments] cancelAppointment error:', error);
    return res.status(500).json({ message: error.message || 'Failed to cancel appointment' });
  }
};

// ─── PUT /api/appointments/:id/status ────────────────────────
const updateAppointmentStatus = async (req, res) => {
  const { status, reason, message } = req.body;
  if (!status || !STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
  }

  let existing = null;
  if (supabase) {
    try {
      const { data, error: fetchError } = await supabase
        .from(T)
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (!fetchError && data) existing = data;
    } catch (_) {}
  }
  if (!existing) {
    const db = readDB();
    existing = (db.appointments || []).find((a) => String(a.id) === String(req.params.id));
  }

  if (!existing) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  // If cancelling, execute full refund and cancellation flow
  if (status === 'Cancelled') {
    const updated = await executeAppointmentCancellation({
      appointment: existing,
      reason: reason || message || 'Status updated to Cancelled by admin',
      cancelledBy: req.user?.role || 'admin'
    });
    return res.json({ message: 'Appointment cancelled and refund processed', appointment: updated });
  }

  if (existing.google_event_id && status === 'Cancelled') {
    await syncGoogleCalendar('delete', existing);
  }

  let data = null;
  if (supabase) {
    try {
      const resUpd = await supabase
        .from(T)
        .update({ status, updatedAt: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (!resUpd.error && resUpd.data) data = resUpd.data;
    } catch (_) {}
  }

  if (!data) {
    const db = readDB();
    const idx = (db.appointments || []).findIndex((a) => String(a.id) === String(req.params.id));
    if (idx !== -1) {
      db.appointments[idx].status = status;
      db.appointments[idx].updatedAt = new Date().toISOString();
      writeDB(db);
      data = db.appointments[idx];
    } else {
      data = { ...existing, status, updatedAt: new Date().toISOString() };
    }
  }

  const userEmail = await getUserEmail(existing);
  if (userEmail) {
    sendAppointmentStatusUpdate({
      to: userEmail,
      patientName: existing.patientName,
      hospitalName: existing.hospital,
      date: existing.date,
      time: existing.time,
      status: status,
      message: message || undefined,
      appointmentNumber: existing.appointment_number
    }).catch((e) => console.error('[appointments] status update email failed:', e));
  }

  if (status === 'Completed') {
    await sendFeedbackInvitation(existing);
  }

  broadcast('appointment_updated', data);
  return res.json({ message: 'Appointment status updated', appointment: data });
};

// ─── PUT /api/appointments/:id (full update) ──────────────────
const updateAppointment = async (req, res) => {
  const { id } = req.params;
  let appt = null;
  if (supabase) {
    try {
      const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
      if (arr && arr[0]) appt = arr[0];
    } catch (_) {}
  }
  if (!appt) {
    const db = readDB();
    appt = (db.appointments || []).find((a) => String(a.id) === String(id));
  }

  if (!appt) return res.status(404).json({ message: 'Appointment not found' });
  if (req.user.role === 'user') {
    const uid = String(req.user.id || '');
    const uemail = String(req.user.email || '').trim().toLowerCase();
    const uphone = req.user.phone ? String(req.user.phone).replace(/\D/g, '') : '';
    const matchId = appt.userId && String(appt.userId) === uid;
    const matchEmail = appt.email && String(appt.email).trim().toLowerCase() === uemail;
    const matchPhone = uphone && appt.patientPhone && String(appt.patientPhone).replace(/\D/g, '') === uphone;
    if (!matchId && !matchEmail && !matchPhone) {
      return res.status(403).json({ message: 'Forbidden: You can only update your own appointments' });
    }
  }

  if (req.body.status === 'Cancelled' && appt.status !== 'Cancelled') {
    const updated = await executeAppointmentCancellation({
      appointment: appt,
      reason: req.body.reason || req.body.cancellationReason || 'Cancelled by user',
      cancelledBy: req.user.role || 'user'
    });
    return res.json({ message: 'Appointment cancelled and refund processed successfully', appointment: updated });
  }

  const fields = [
    'date', 'time', 'patientName', 'patientPhone', 'reason', 'petName', 'species',
    'sex', 'breed', 'appointmentType', 'status', 'doctorName',
    'serviceId', 'serviceName', 'serviceCategory', 'servicePrice',
    'sampleType', 'fastingRequired', 'fastingDetails', 'turnaroundTime'
  ];
  const patch = { updatedAt: new Date().toISOString() };
  let statusChanged = false;
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      patch[f] = req.body[f];
      if (f === 'status') statusChanged = true;
    }
  });

  if ((patch.date || patch.time) && appt.hospitalId) {
    const newDate = patch.date || appt.date;
    const newTime = patch.time || appt.time;
    const movingSlot = newDate !== appt.date || newTime !== appt.time;
    if (movingSlot) {
      // 🛡️ Business hours validation for the new time
      if (!ALLOWED_SLOTS.includes(newTime)) {
        return res.status(400).json({ message: 'Selected time is outside business hours.' });
      }

      try {
        const booked = await getBookedSlotsForDate(newDate, appt.hospitalId);
        if (Array.isArray(booked) && booked.includes(newTime)) {
          return res.status(409).json({ message: 'That slot is already booked. Please choose another time.' });
        }
      } catch (err) {
        console.error('[appointments] update slot check failed:', err);
      }
    }
  }

  let data = null;
  if (supabase) {
    try {
      const resUpd = await supabase.from(T).update(patch).eq('id', id).select().single();
      if (!resUpd.error && resUpd.data) data = resUpd.data;
    } catch (_) {}
  }

  if (!data) {
    const db = readDB();
    const idx = (db.appointments || []).findIndex((a) => String(a.id) === String(id));
    if (idx !== -1) {
      db.appointments[idx] = { ...db.appointments[idx], ...patch };
      writeDB(db);
      data = db.appointments[idx];
    } else {
      data = { ...appt, ...patch };
    }
  }

  if (patch.date && patch.time && appt.google_event_id) {
    if (patch.date !== appt.date || patch.time !== appt.time) {
      await syncGoogleCalendar('update', appt, { date: patch.date, time: patch.time });
    }
  }

  if (statusChanged && patch.status && patch.status !== appt.status) {
    const userEmail = await getUserEmail(appt);
    if (userEmail) {
      sendAppointmentStatusUpdate({
        to: userEmail,
        patientName: appt.patientName,
        hospitalName: appt.hospital,
        date: appt.date,
        time: appt.time,
        status: patch.status,
        message: req.body.message || undefined,
        appointmentNumber: appt.appointment_number
      }).catch((e) => console.error('[appointments] status update email failed:', e));
    }

    if (patch.status === 'Completed') {
      await sendFeedbackInvitation(appt);
    }
  }

  broadcast('appointment_updated', data);
  return res.json({ message: 'Appointment updated successfully', appointment: data });
};

// ─── GET /api/appointments/:id ────────────────────────────────
const getAppointmentById = async (req, res) => {
  const { id } = req.params;
  try {
    let appt = null;
    const isNum = !isNaN(id) && String(id).trim() !== '';

    if (supabase) {
      try {
        const { data } = await supabase
          .from(T)
          .select('*')
          .or(`id.eq.${id}${isNum ? `,appointment_number.eq.${Number(id)}` : ''}`)
          .maybeSingle();
        if (data) appt = data;
      } catch (err) {
        console.warn('[appointments] Supabase select error on getAppointmentById:', err.message);
      }
    }

    if (!appt) {
      const db = readDB();
      appt = (db.appointments || []).find((a) => String(a.id) === String(id) || String(a.appointment_number) === String(id));
    }

    if (!appt) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    return res.json({ success: true, appointment: appt, ...appt });
  } catch (err) {
    console.error('[appointments] getAppointmentById error:', err);
    return res.status(500).json({ message: 'Server error retrieving appointment' });
  }
};

// ─── DELETE /api/appointments/:id ────────────────────────────
const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    let appt = null;
    const isNum = !isNaN(id) && String(id).trim() !== '';

    // 1. Try Supabase lookup
    if (supabase) {
      try {
        let q = supabase.from(T).select('id, google_event_id, appointment_number, date, hospitalId');
        if (isNum) {
          q = q.or(`id.eq.${id},appointment_number.eq.${Number(id)}`);
        } else {
          q = q.eq('id', id);
        }
        const { data } = await q.maybeSingle();
        if (data) appt = data;
      } catch (err) {
        console.warn('[appointments] Supabase select error on delete:', err.message);
      }
    }

    // 2. Fallback to local db.json lookup
    if (!appt) {
      const db = readDB();
      appt = (db.appointments || []).find((a) => String(a.id) === String(id) || String(a.appointment_number) === String(id));
    }

    const targetId = appt?.id ? String(appt.id) : String(id);
    const targetNum = appt?.appointment_number ? Number(appt.appointment_number) : (isNum ? Number(id) : null);

    // 3. Delete Google Calendar event if present
    if (appt?.google_event_id) {
      try {
        await deleteCalendarEvent(appt.google_event_id);
      } catch (calErr) {
        console.warn('[appointments] Google Calendar delete warning:', calErr.message);
      }
    }

    // 4. Delete from Supabase
    if (supabase) {
      try {
        if (targetId) {
          await supabase.from(T).delete().eq('id', targetId);
        }
        if (id && String(id) !== targetId) {
          await supabase.from(T).delete().eq('id', id);
        }
        if (targetNum !== null) {
          await supabase.from(T).delete().eq('appointment_number', targetNum);
        }
      } catch (supErr) {
        console.warn('[appointments] Supabase delete warning:', supErr.message);
      }
    }

    // 5. Delete from local db.json
    const db = readDB();
    db.appointments = (db.appointments || []).filter(
      (a) => String(a.id) !== targetId &&
             String(a.id) !== String(id) &&
             (targetNum === null || Number(a.appointment_number) !== targetNum) &&
             String(a.appointment_number || '') !== String(id)
    );
    writeDB(db);

    // 6. Broadcast deletion to all connected clients
    broadcast('appointment_deleted', { id: targetId, appointmentNumber: targetNum });
    if (appt?.date && appt?.hospitalId) {
      broadcast('slots_updated', { date: appt.date, hospitalId: appt.hospitalId });
    }

    return res.json({ success: true, message: 'Appointment deleted successfully', id: targetId });
  } catch (err) {
    console.error('[appointments] deleteAppointment error:', err);
    return res.status(500).json({ message: 'Failed to delete appointment', error: err.message });
  }
};

// ─── GET /api/appointments/by-number/:number ──────────────────
const getAppointmentByNumber = async (req, res) => {
  const { number } = req.params;
  const { email, phone } = req.query;

  if (!number || isNaN(number)) {
    return res.status(400).json({ message: 'Valid appointment number is required' });
  }

  const num = Number(number);
  console.log(`🔍 Looking for appointment number: ${num} (type: ${typeof num})`);

  const { data, error } = await supabase
    .from(T)
    .select('id, patientName, patientPhone, email, petName, date, time, hospital, appointmentType, reason, status')
    .eq('appointment_number', num)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase error:', error);
    return res.status(500).json({ message: 'Database error' });
  }

  if (!data) {
    console.log(`❌ Appointment not found for number: ${num}`);
    const { data: all } = await supabase
      .from(T)
      .select('id, appointment_number')
      .not('appointment_number', 'is', null)
      .limit(10);
    console.log('📋 Existing numbers in DB:', all?.map(r => r.appointment_number) || []);
    return res.status(404).json({ message: `Appointment not found for number: ${num}` });
  }

  if (email || phone) {
    const matchEmail = !email || (data.email && data.email.toLowerCase() === email.toLowerCase());
    const matchPhone = !phone || (data.patientPhone && data.patientPhone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!matchEmail || !matchPhone) {
      return res.status(403).json({ message: 'Invalid credentials for this appointment' });
    }
  }

  return res.json({
    appointmentNumber: num,
    patientName: data.patientName,
    petName: data.petName,
    date: data.date,
    time: data.time,
    hospital: data.hospital,
    status: data.status
  });
};

// ─── Public "manage my booking" helpers ──────────────────────
const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

const publicAppointmentView = (a) => ({
  appointmentNumber: a.appointment_number,
  id: a.id,
  hospital: a.hospital,
  hospitalId: a.hospitalId,
  patientName: a.patientName,
  patientPhone: a.patientPhone,
  email: a.email || '',
  petName: a.petName || '',
  species: a.species || '',
  sex: a.sex || '',
  breed: a.breed || '',
  doctorName: a.doctorName || '',
  date: a.date || '',
  time: a.time || '',
  reason: a.reason || '',
  appointmentType: a.appointmentType || 'Consult',
  status: a.status,
  createdAt: a.createdAt || null,
  updatedAt: a.updatedAt || null,
  canModify: !LOCKED_STATUSES.includes(a.status)
});

const findOwnedAppointments = async ({ patientPhone, email }) => {
  const phone = normalizePhone(patientPhone);
  const mail = normalizeEmail(email);

  let results = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(T)
        .select('*')
        .order('date', { ascending: false });

      if (!error && Array.isArray(data)) {
        results = data.filter((a) => normalizePhone(a.patientPhone) === phone && normalizeEmail(a.email) === mail);
      }
    } catch (e) {
      console.warn('[appointments] Supabase findOwnedAppointments warning:', e.message || e);
    }
  }

  const db = readDB();
  const localList = (db.appointments || []).filter(
    (a) => normalizePhone(a.patientPhone) === phone && normalizeEmail(a.email) === mail
  );

  const idSet = new Set(results.map((r) => String(r.id)));
  localList.forEach((la) => {
    if (la && la.id && !idSet.has(String(la.id))) {
      results.push(la);
      idSet.add(String(la.id));
    }
  });

  return results;
};

const lookupAppointments = async (req, res) => {
  const { patientPhone, email } = req.body || {};

  const phone = normalizePhone(patientPhone);
  const mail = normalizeEmail(email);

  if (!phone || !mail) {
    return res.status(400).json({ message: 'Both mobile number and email are required.' });
  }
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  try {
    const owned = await findOwnedAppointments({ patientPhone: phone, email: mail });
    return res.json({
      count: owned.length,
      appointments: owned.map(publicAppointmentView)
    });
  } catch (err) {
    console.error('[appointments] lookup error:', err);
    return res.status(500).json({ message: 'Could not look up your appointments' });
  }
};

const loadOwnedAppointment = async (id, { patientPhone, email }) => {
  const phone = normalizePhone(patientPhone);
  const mail = normalizeEmail(email);

  if (!phone || !mail) {
    return { error: { status: 400, message: 'Both mobile number and email are required.' } };
  }

  let appointment = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
      if (!error && data) appointment = data;
    } catch (e) {
      console.warn('[appointments] Supabase public load error:', e.message || e);
    }
  }

  if (!appointment) {
    const db = readDB();
    appointment = (db.appointments || []).find((a) => String(a.id) === String(id) || String(a.appointment_number) === String(id));
  }

  if (!appointment) return { error: { status: 404, message: 'Appointment not found' } };

  const matches = normalizePhone(appointment.patientPhone) === phone && normalizeEmail(appointment.email) === mail;
  if (!matches) {
    return { error: { status: 404, message: 'Appointment not found' } };
  }

  return { appointment };
};

const reschedulePublicAppointment = async (req, res) => {
  const { patientPhone, email, date, time, petName, reason, patientName } = req.body || {};

  const { appointment, error: guard } = await loadOwnedAppointment(req.params.id, { patientPhone, email });
  if (guard) return res.status(guard.status).json({ message: guard.message });

  if (LOCKED_STATUSES.includes(appointment.status)) {
    return res.status(409).json({
      message: `This appointment is already ${appointment.status.toLowerCase()} and can no longer be changed.`
    });
  }

  if (!date || !time) {
    return res.status(400).json({ message: 'A new date and time are required to reschedule.' });
  }

  try {
    const booked = await getBookedSlotsForDate(date, appointment.hospitalId);
    const movingSlot = date !== appointment.date || time !== appointment.time;
    if (movingSlot && Array.isArray(booked) && booked.includes(time)) {
      return res.status(409).json({ message: 'That slot is already booked. Please pick another time.' });
    }
  } catch (e) {
    console.error('[appointments] reschedule slot check failed:', e);
  }

  const patch = {
    date,
    time,
    status: 'Pending',
    updatedAt: new Date().toISOString()
  };
  if (petName !== undefined) patch.petName = String(petName).trim();
  if (reason !== undefined) patch.reason = String(reason).trim();
  if (patientName !== undefined && String(patientName).trim()) patch.patientName = String(patientName).trim();

  const { data, error } = await supabase.from(T).update(patch).eq('id', appointment.id).select().single();
  if (error) {
    console.error('[appointments] reschedule error:', error);
    return res.status(500).json({ message: 'Could not reschedule the appointment' });
  }

  if (appointment.google_event_id) {
    await syncGoogleCalendar('update', appointment, { date, time });
  }

  sendAppointmentRescheduled({
    to: data.email,
    patientName: data.patientName,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    previousDate: appointment.date,
    previousTime: appointment.time
  }).catch((e) => console.error('[appointments] reschedule email failed:', e));

  sendAppointmentNewToSuperAdmin({
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    email: data.email,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    petName: data.petName,
    description: `Rescheduled by the patient (was ${appointment.date || 'n/a'} ${appointment.time || ''}). ${data.reason || ''}`.trim(),
    source: 'public'
  }).catch((e) => console.error('[appointments] superadmin reschedule email failed:', e));

  return res.json({
    message: 'Appointment rescheduled — the hospital will confirm the new slot.',
    appointment: publicAppointmentView(data)
  });
};

// ─── GET /api/appointments/:id/invoice ───────────────────────
const downloadAppointmentInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    let appointment = null;
    if (supabase) {
      try {
        const isNum = !isNaN(id) && String(id).trim() !== '';
        const { data } = await supabase
          .from(T)
          .select('*')
          .or(`id.eq.${id}${isNum ? `,appointment_number.eq.${Number(id)}` : ''}`)
          .maybeSingle();
        if (data) appointment = data;
      } catch (_) {}
    }
    if (!appointment) {
      const db = readDB();
      appointment = (db.appointments || []).find((a) => String(a.id) === String(id) || String(a.appointment_number) === String(id));
    }
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const pdfBuffer = await generateAppointmentInvoice(appointment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${appointment.appointment_number || appointment.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[appointments] download invoice error:', err);
    return res.status(500).json({ message: 'Could not generate invoice PDF' });
  }
};

// ─── GET /api/appointments/:id/cancellation-invoice ──────────
const downloadCancellationInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    let appointment = null;
    if (supabase) {
      try {
        const isNum = !isNaN(id) && String(id).trim() !== '';
        const { data } = await supabase
          .from(T)
          .select('*')
          .or(`id.eq.${id}${isNum ? `,appointment_number.eq.${Number(id)}` : ''}`)
          .maybeSingle();
        if (data) appointment = data;
      } catch (_) {}
    }
    if (!appointment) {
      const db = readDB();
      appointment = (db.appointments || []).find((a) => String(a.id) === String(id) || String(a.appointment_number) === String(id));
    }
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const pdfBuffer = await generateCancellationInvoice(appointment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cancellation_invoice_${appointment.appointment_number || appointment.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[appointments] download cancellation invoice error:', err);
    return res.status(500).json({ message: 'Could not generate cancellation invoice PDF' });
  }
};

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  bookAppointment,
  bookPublicAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  updateAppointment,
  cancelAppointment,
  executeAppointmentCancellation,
  calculateCancellationFeeAndRefund,
  deleteAppointment,
  getBookedSlots,
  lookupAppointments,
  reschedulePublicAppointment,
  getAppointmentByNumber,
  downloadAppointmentInvoice,
  downloadCancellationInvoice
};
