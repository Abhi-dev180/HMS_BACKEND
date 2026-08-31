
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
const {
  getBookedSlotsForDate,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} = require('../services/googleCalendarService');
const { broadcast } = require('../services/websocketService');
const { getDailyTimeSlots } = require('../services/schedulerService');

const T = 'appointments';
const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
const LOCKED_STATUSES = ['Completed', 'Cancelled'];
const ALLOWED_SLOTS = getDailyTimeSlots();

// ─── Helper: generate unique 4‑digit appointment number ──────
const generateAppointmentNumber = async () => {
  let number, exists;
  do {
    number = Math.floor(1000 + Math.random() * 9000);
    const { data } = await supabase
      .from(T)
      .select('id')
      .eq('appointment_number', number)
      .limit(1);
    exists = data && data.length > 0;
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
  const { doctorName, date, time, patientName, patientPhone, reason, petName, species, sex, breed, appointmentType } = req.body;
  const hospitalId = req.body.hospitalId || (req.user.role === 'admin' ? req.user.hospitalId : undefined);
  if (!hospitalId || !patientName || !patientPhone || !date || !time) {
    return res.status(400).json({ message: 'Hospital, patient name, mobile number, date and time are required' });
  }

  // Validate appointment is not in past
  const appointmentDateTime = new Date(`${date}T${time}:00`);
  if (appointmentDateTime.getTime() < Date.now()) {
    return res.status(400).json({ message: 'Cannot book an appointment for a past date or time.' });
  }

  // 🛡️ Business hours validation
  if (!ALLOWED_SLOTS.includes(time)) {
    return res.status(400).json({ message: 'Selected time is outside business hours.' });
  }

  try {
    const booked = await getBookedSlotsForDate(date, hospitalId);
    if (Array.isArray(booked) && booked.includes(time)) {
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
    doctorName: doctorName || 'Any Available Doctor',
    date,
    time,
    patientName,
    patientPhone,
    reason: reason || '',
    petName: petName || '',
    species: species || '',
    sex: sex || '',
    breed: breed || '',
    appointmentType: appointmentType || 'Consult',
    status: 'Pending',
    appointment_number: appointmentNumber
  };

  const { data, error } = await supabase.from(T).insert(row).select().single();
  if (error) {
    console.error('[appointments] book:', error);
    return res.status(500).json({ message: 'Could not book appointment' });
  }

  // ─── Send confirmation email with appointment number ──────
  if (req.user?.email) {
    sendAppointmentConfirmation({
      to: req.user.email,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      hospitalName: data.hospital,
      date: data.date,
      time: data.time,
      petName: data.petName,
      description: data.reason,
      email: req.user.email,
      appointmentNumber: data.appointment_number
    }).catch((e) => console.error('[appointments] confirmation email failed:', e));
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

  await syncGoogleCalendar('create', data);
  broadcast('appointment_created', data);
  return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
};

// ─── POST /api/appointments/public (unauthenticated) ─────────
const bookPublicAppointment = async (req, res) => {
  const { hospitalId, patientName, patientPhone, email, date, time, description, petName, species, sex, breed } = req.body || {};
  if (!hospitalId || !patientName || !patientPhone || !date || !time) {
    return res.status(400).json({ message: 'Hospital, patient name, mobile number, date and time are required' });
  }
  if (!/^\d{10}$/.test(String(patientPhone).trim())) {
    return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
  }

  // Validate appointment is not in past
  const appointmentDateTime = new Date(`${date}T${time}:00`);
  if (appointmentDateTime.getTime() < Date.now()) {
    return res.status(400).json({ message: 'Cannot book an appointment for a past date or time.' });
  }

  // 🛡️ Business hours validation
  if (!ALLOWED_SLOTS.includes(time)) {
    return res.status(400).json({ message: 'Selected time is outside business hours.' });
  }

  const name = await hospitalName(hospitalId);
  if (!name) return res.status(404).json({ message: 'Selected hospital not found' });

  try {
    const booked = await getBookedSlotsForDate(date, String(hospitalId));
    if (Array.isArray(booked) && booked.includes(time)) {
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
    } catch (e) {}
  }
  if (!resolvedUserId && email) {
    try {
      const existingUser = await Users.findByEmail(email);
      if (existingUser && existingUser.id) resolvedUserId = String(existingUser.id);
    } catch (e) {}
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
    time,
    reason: description ? String(description).trim() : '',
    petName: petName || '',
    species: species || '',
    sex: sex || '',
    breed: breed || '',
    appointmentType: 'Consult',
    status: 'Pending',
    source: resolvedUserId ? 'dashboard' : 'public',
    appointment_number: appointmentNumber
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

  // ─── Send confirmation email with appointment number ──────
  if (data.email) {
    sendAppointmentConfirmation({
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
      breed: data.breed
    }).catch((e) => console.error('[appointments] confirmation email failed:', e));
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
    list = list.filter((a) => String(a.userId) === String(req.user?.id));
  }
  const { from, to, search, status, page, limit } = req.query || {};
  if (from && to) {
    list = list.filter((a) => a.date >= from && a.date <= to);
  }
  if (status && status !== 'all') {
    list = list.filter((a) => a.status === status);
  }
  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter((a) =>
      (a.patientName || '').toLowerCase().includes(term) ||
      (a.petName || '').toLowerCase().includes(term) ||
      (a.email || '').toLowerCase().includes(term) ||
      (a.patientPhone || '').toLowerCase().includes(term) ||
      (a.hospital || '').toLowerCase().includes(term)
    );
  }
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
    const { from, to, page, limit, search, status } = req.query || {};

    if (supabase) {
      try {
        let q = supabase.from(T).select('*', { count: 'exact' });

        if (req.user.role === 'admin') {
          q = q.eq('hospitalId', req.user.hospitalId);
        } else if (req.user.role !== 'superadmin') {
          q = q.eq('userId', req.user.id);
        }

        if (from && to) {
          q = q.gte('date', from).lte('date', to);
        }

        if (status && status !== 'all') {
          q = q.eq('status', status);
        }

        if (search && search.trim()) {
          const term = search.trim();
          q = q.or(`patientName.ilike.%${term}%,petName.ilike.%${term}%,appointmentType.ilike.%${term}%,email.ilike.%${term}%,patientPhone.ilike.%${term}%,hospital.ilike.%${term}%`);
        }

        q = q.order('createdAt', { ascending: false });

        if (page) {
          const pageNum = parseInt(page) || 1;
          const limitNum = parseInt(limit) || 10;
          const fromIndex = (pageNum - 1) * limitNum;
          const toIndex = fromIndex + limitNum - 1;
          q = q.range(fromIndex, toIndex);
        }

        const { data, error, count } = await q;
        if (!error && Array.isArray(data)) {
          if (page) {
            return res.json({
              appointments: data || [],
              total: count || 0,
              page: parseInt(page),
              limit: parseInt(limit)
            });
          }
          return res.json(data || []);
        }
      } catch (err) {
        console.warn('[appointments] Supabase getAppointments failed, using db.json:', err.message || err);
      }
    }

    const db = readDB();
    const result = filterLocalAppointments(db.appointments || [], req);
    return res.json(result);
  } catch (err) {
    console.error('[appointments] getAppointments unexpected error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── PUT /api/appointments/:id/status ────────────────────────
const updateAppointmentStatus = async (req, res) => {
  const { status } = req.body;
  if (!status || !STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
  }

  const { data: existing, error: fetchError } = await supabase
    .from(T)
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (fetchError || !existing) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  if (status === 'Cancelled' && existing.google_event_id) {
    await syncGoogleCalendar('delete', existing);
  }

  const { data, error } = await supabase
    .from(T)
    .update({ status, updatedAt: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) {
    console.error('[appointments] updateStatus error:', error);
    return res.status(500).json({ message: 'Failed to update status' });
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
      message: req.body.message || undefined,
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
  const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
  const appt = arr && arr[0];
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });
  if (req.user.role === 'user' && appt.userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const fields = ['date', 'time', 'patientName', 'patientPhone', 'reason', 'petName', 'species', 'sex', 'breed', 'appointmentType', 'status', 'doctorName'];
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

  const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
  if (error) {
    console.error('[appointments] update error:', error);
    return res.status(500).json({ message: 'Could not update appointment' });
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

// ─── DELETE /api/appointments/:id ────────────────────────────
const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  const { data: arr } = await supabase.from(T).select('id, google_event_id').eq('id', id).limit(1);
  if (!arr || !arr.length) return res.status(404).json({ message: 'Appointment not found' });

  if (arr[0].google_event_id) {
    await deleteCalendarEvent(arr[0].google_event_id);
  }

  await supabase.from(T).delete().eq('id', id);
  broadcast('appointment_deleted', { id });
  return res.json({ message: 'Appointment deleted successfully' });
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

  const { data, error } = await supabase
    .from(T)
    .select('*')
    .eq('patientPhone', phone)
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).filter((a) => normalizeEmail(a.email) === mail);
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

  const { data, error } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[appointments] public load error:', error);
    return { error: { status: 500, message: 'Could not load the appointment' } };
  }
  if (!data) return { error: { status: 404, message: 'Appointment not found' } };

  const matches = normalizePhone(data.patientPhone) === phone && normalizeEmail(data.email) === mail;
  if (!matches) {
    return { error: { status: 404, message: 'Appointment not found' } };
  }

  return { appointment: data };
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

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  bookAppointment,
  bookPublicAppointment,
  getAppointments,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  getBookedSlots,
  lookupAppointments,
  reschedulePublicAppointment,
  getAppointmentByNumber
};
