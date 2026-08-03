// const { supabase } = require('../config/supabase');
// const {
//   sendAppointmentConfirmation,
//   sendAppointmentStatusUpdate,
//   sendAppointmentNewToSuperAdmin,
//   sendAppointmentRescheduled,
//   sendAppointmentCancelled
// } = require('../services/emailService');
// const {
//   getBookedSlotsForDate,
//   createCalendarEvent,
//   updateCalendarEvent,
//   deleteCalendarEvent
// } = require('../services/googleCalendarService');

// const T = 'appointments';
// const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];

// // Statuses a patient may no longer change from the public "manage booking" page.
// const LOCKED_STATUSES = ['Completed', 'Cancelled'];

// // ─── Helper: get hospital name by ID ──────────────────────────
// const hospitalName = async (hospitalId) => {
//   const { data } = await supabase.from('hospitals').select('name').eq('id', hospitalId).limit(1);
//   return data && data[0] ? data[0].name : '';
// };

// // ─── Helper: create/update/delete Google Calendar events ──────
// const syncGoogleCalendar = async (action, appointment, patch = {}) => {
//   try {
//     const startTime = new Date(`${appointment.date}T${appointment.time}:00`).toISOString();
//     const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();

//     if (action === 'create') {
//       const event = await createCalendarEvent({
//         summary: `Appointment - ${appointment.patientName}`,
//         description: appointment.reason || 'No additional details',
//         start: startTime,
//         end: endTime,
//         attendees: appointment.email ? [appointment.email] : []
//       });
//       // Store the event ID in the database
//       await supabase
//         .from(T)
//         .update({ google_event_id: event.id })
//         .eq('id', appointment.id);
//       console.log('[googleCalendar] Event created:', event.id);
//       return event;
//     }

//     if (action === 'update' && appointment.google_event_id) {
//       // patch contains new date/time
//       const newStart = new Date(`${patch.date}T${patch.time}:00`).toISOString();
//       const newEnd = new Date(new Date(newStart).getTime() + 30 * 60000).toISOString();
//       await updateCalendarEvent(appointment.google_event_id, {
//         summary: `Appointment - ${appointment.patientName}`,
//         start: newStart,
//         end: newEnd
//       });
//       console.log('[googleCalendar] Event updated:', appointment.google_event_id);
//     }

//     if (action === 'delete' && appointment.google_event_id) {
//       await deleteCalendarEvent(appointment.google_event_id);
//       // Clear the event ID from the database
//       await supabase
//         .from(T)
//         .update({ google_event_id: null })
//         .eq('id', appointment.id);
//       console.log('[googleCalendar] Event deleted:', appointment.google_event_id);
//     }
//   } catch (err) {
//     console.error('[googleCalendar] sync error:', err);
//     // Don't block the main flow; log and continue
//   }
// };

// // ─── GET /api/appointments/booked-slots ──────────────────────
// const getBookedSlots = async (req, res) => {
//   const { date, hospitalId } = req.query;
//   if (!date) return res.status(400).json({ message: 'date query parameter is required' });

//   try {
//     const bookedSlots = await getBookedSlotsForDate(date, hospitalId);
//     return res.json({ date, hospitalId: hospitalId || null, bookedSlots });
//   } catch (err) {
//     console.error('[appointments] booked-slots error:', err);
//     return res.status(500).json({ message: 'Could not fetch booked slots' });
//   }
// };

// // ─── POST /api/appointments (authenticated) ──────────────────
// const bookAppointment = async (req, res) => {
//   const { doctorName, date, time, patientName, patientPhone, reason, petName, species, appointmentType } = req.body;
//   const hospitalId = req.body.hospitalId || (req.user.role === 'admin' ? req.user.hospitalId : undefined);
//   if (!hospitalId || !patientName || !patientPhone) {
//     return res.status(400).json({ message: 'Hospital, patient name and mobile number are required' });
//   }

//   const row = {
//     id: Date.now().toString(),
//     userId: req.user.id,
//     hospitalId,
//     hospital: await hospitalName(hospitalId),
//     doctorName: doctorName || 'Any Available Doctor',
//     date: date || '',
//     time: time || '',
//     patientName,
//     patientPhone,
//     reason: reason || '',
//     petName: petName || '',
//     species: species || '',
//     appointmentType: appointmentType || 'Consult',
//     status: 'Pending'
//   };

//   const { data, error } = await supabase.from(T).insert(row).select().single();
//   if (error) {
//     console.error('[appointments] book:', error);
//     return res.status(500).json({ message: 'Could not book appointment' });
//   }

//   // ─── Send detailed confirmation email to the logged-in user ──
//   if (req.user?.email) {
//     sendAppointmentConfirmation({
//       to: req.user.email,
//       patientName: data.patientName,
//       patientPhone: data.patientPhone,
//       hospitalName: data.hospital,
//       date: data.date,
//       time: data.time,
//       petName: data.petName,
//       description: data.reason,
//       email: req.user.email
//     }).catch((e) => console.error('[appointments] confirmation email failed:', e));
//   }

//   // ─── Alert the superadmin about the new booking ──────────────
//   sendAppointmentNewToSuperAdmin({
//     patientName: data.patientName,
//     patientPhone: data.patientPhone,
//     email: req.user?.email || '',
//     hospitalName: data.hospital,
//     date: data.date,
//     time: data.time,
//     petName: data.petName,
//     description: data.reason,
//     source: 'dashboard'
//   }).catch((e) => console.error('[appointments] superadmin new-booking email failed:', e));

//   // ─── Create Google Calendar event ────────────────────────────
//   await syncGoogleCalendar('create', data);

//   return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
// };

// // ─── POST /api/appointments/public (unauthenticated) ──────────
// const bookPublicAppointment = async (req, res) => {
//   const { hospitalId, patientName, patientPhone, email, date, time, description, petName, species } = req.body || {};
//   if (!hospitalId || !patientName || !patientPhone) {
//     return res.status(400).json({ message: 'Hospital, patient name and mobile number are required' });
//   }
//   if (!/^\d{10}$/.test(String(patientPhone).trim())) {
//     return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
//   }

//   const name = await hospitalName(hospitalId);
//   if (!name) return res.status(404).json({ message: 'Selected hospital not found' });

//   const row = {
//     id: Date.now().toString(),
//     userId: null,
//     hospitalId: String(hospitalId),
//     hospital: name,
//     patientName: String(patientName).trim(),
//     patientPhone: String(patientPhone).trim(),
//     email: email ? String(email).trim() : '',
//     date: date || '',
//     time: time || '',
//     reason: description ? String(description).trim() : '',
//     petName: petName || '',
//     species: species || '',
//     appointmentType: 'Consult',
//     status: 'Pending',
//     source: 'public'
//   };

//   const { data, error } = await supabase.from(T).insert(row).select().single();
//   if (error) {
//     console.error('[appointments] public book:', error);
//     return res.status(500).json({ message: 'Could not book appointment' });
//   }

//   // ─── Send detailed confirmation email to the user ─────────────
//   if (data.email) {
//     sendAppointmentConfirmation({
//       to: data.email,
//       patientName: data.patientName,
//       patientPhone: data.patientPhone,
//       hospitalName: data.hospital,
//       date: data.date,
//       time: data.time,
//       petName: data.petName,
//       description: data.reason,
//       email: data.email
//     }).catch((e) => console.error('[appointments] confirmation email failed:', e));
//   }

//   // ─── Alert the superadmin about the new booking ──────────────
//   sendAppointmentNewToSuperAdmin({
//     patientName: data.patientName,
//     patientPhone: data.patientPhone,
//     email: data.email,
//     hospitalName: data.hospital,
//     date: data.date,
//     time: data.time,
//     petName: data.petName,
//     description: data.reason,
//     source: 'public'
//   }).catch((e) => console.error('[appointments] superadmin new-booking email failed:', e));

//   // ─── Create Google Calendar event ────────────────────────────
//   await syncGoogleCalendar('create', data);

//   return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
// };

// // ─── GET /api/appointments (role‑scoped) ─────────────────────
// const getAppointments = async (req, res) => {
//   let q = supabase.from(T).select('*').order('createdAt', { ascending: false });
//   if (req.user.role === 'admin') q = q.eq('hospitalId', req.user.hospitalId);
//   else if (req.user.role !== 'superadmin') q = q.eq('userId', req.user.id);
//   const { data, error } = await q;
//   if (error) {
//     console.error('[appointments] list:', error);
//     return res.status(500).json({ message: 'Could not load appointments' });
//   }
//   return res.json(data || []);
// };

// // ─── Helper: get user email from appointment ──────────────────
// const getUserEmail = async (appointment) => {
//   // 1. If the appointment has an email field (public bookings)
//   if (appointment.email) return appointment.email;
//   // 2. If it has a userId, fetch from users table
//   if (appointment.userId) {
//     const { data } = await supabase.from('users').select('email').eq('id', appointment.userId).single();
//     return data?.email || null;
//   }
//   return null;
// };

// // ─── PUT /api/appointments/:id/status ────────────────────────
// const updateAppointmentStatus = async (req, res) => {
//   const { status } = req.body;
//   if (!status || !STATUSES.includes(status)) {
//     return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
//   }

//   // Fetch existing appointment
//   const { data: existing, error: fetchError } = await supabase
//     .from(T)
//     .select('*')
//     .eq('id', req.params.id)
//     .single();
//   if (fetchError || !existing) {
//     return res.status(404).json({ message: 'Appointment not found' });
//   }

//   // ─── If cancelling, delete Google Calendar event ──────────
//   if (status === 'Cancelled' && existing.google_event_id) {
//     await syncGoogleCalendar('delete', existing);
//   }

//   // Update status
//   const { data, error } = await supabase
//     .from(T)
//     .update({ status, updatedAt: new Date().toISOString() })
//     .eq('id', req.params.id)
//     .select()
//     .single();
//   if (error) {
//     console.error('[appointments] updateStatus error:', error);
//     return res.status(500).json({ message: 'Failed to update status' });
//   }

//   // ─── Send status update email ──────────────────────────────
//   const userEmail = await getUserEmail(existing);
//   console.log('[appointments] updateStatus - userEmail:', userEmail);
//   if (userEmail) {
//     sendAppointmentStatusUpdate({
//       to: userEmail,
//       patientName: existing.patientName,
//       hospitalName: existing.hospital,
//       date: existing.date,
//       time: existing.time,
//       status: status,
//       message: req.body.message || undefined
//     }).catch((e) => console.error('[appointments] status update email failed:', e));
//   } else {
//     console.warn('[appointments] updateStatus - No email found for appointment:', req.params.id);
//   }

//   return res.json({ message: 'Appointment status updated', appointment: data });
// };

// // ─── PUT /api/appointments/:id (full update) ──────────────────
// const updateAppointment = async (req, res) => {
//   const { id } = req.params;
//   const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
//   const appt = arr && arr[0];
//   if (!appt) return res.status(404).json({ message: 'Appointment not found' });
//   if (req.user.role === 'user' && appt.userId !== req.user.id) {
//     return res.status(403).json({ message: 'Forbidden' });
//   }

//   const fields = ['date', 'time', 'patientName', 'patientPhone', 'reason', 'petName', 'species', 'appointmentType', 'status', 'doctorName'];
//   const patch = { updatedAt: new Date().toISOString() };
//   let statusChanged = false;
//   fields.forEach((f) => {
//     if (req.body[f] !== undefined) {
//       patch[f] = req.body[f];
//       if (f === 'status') statusChanged = true;
//     }
//   });

//   const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
//   if (error) {
//     console.error('[appointments] update error:', error);
//     return res.status(500).json({ message: 'Could not update appointment' });
//   }

//   // ─── If date/time changed, update Google Calendar event ──
//   if (patch.date && patch.time && appt.google_event_id) {
//     // Check if date or time actually changed
//     if (patch.date !== appt.date || patch.time !== appt.time) {
//       await syncGoogleCalendar('update', appt, { date: patch.date, time: patch.time });
//     }
//   }

//   // ─── If status changed, send notification email ────────────
//   if (statusChanged && patch.status && patch.status !== appt.status) {
//     const userEmail = await getUserEmail(appt);
//     console.log('[appointments] updateAppointment - status changed, userEmail:', userEmail);
//     if (userEmail) {
//       sendAppointmentStatusUpdate({
//         to: userEmail,
//         patientName: appt.patientName,
//         hospitalName: appt.hospital,
//         date: appt.date,
//         time: appt.time,
//         status: patch.status,
//         message: req.body.message || undefined
//       }).catch((e) => console.error('[appointments] status update email failed:', e));
//     } else {
//       console.warn('[appointments] updateAppointment - No email found for appointment:', id);
//     }
//   }

//   return res.json({ message: 'Appointment updated successfully', appointment: data });
// };

// // ─── DELETE /api/appointments/:id ────────────────────────────
// const deleteAppointment = async (req, res) => {
//   const { id } = req.params;
//   const { data: arr } = await supabase.from(T).select('id').eq('id', id).limit(1);
//   if (!arr || !arr.length) return res.status(404).json({ message: 'Appointment not found' });

//   // Delete the Google Calendar event if it exists
//   if (arr[0].google_event_id) {
//     await deleteCalendarEvent(arr[0].google_event_id);
//   }

//   await supabase.from(T).delete().eq('id', id);
//   return res.json({ message: 'Appointment deleted successfully' });
// };

// // ═══════════════════════════════════════════════════════════════
// //  Public "manage my booking" flow — patients look their bookings
// //  up with the mobile + email they booked with, then reschedule or
// //  cancel. Ownership is proven by that pair, so every route below
// //  re-verifies it instead of trusting the id alone.
// // ═══════════════════════════════════════════════════════════════

// const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
// const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

// // Trimmed-down row for the public page — never leaks other patients' data.
// const publicAppointmentView = (a) => ({
//   id: a.id,
//   hospital: a.hospital,
//   hospitalId: a.hospitalId,
//   patientName: a.patientName,
//   patientPhone: a.patientPhone,
//   email: a.email || '',
//   petName: a.petName || '',
//   species: a.species || '',
//   doctorName: a.doctorName || '',
//   date: a.date || '',
//   time: a.time || '',
//   reason: a.reason || '',
//   appointmentType: a.appointmentType || 'Consult',
//   status: a.status,
//   createdAt: a.createdAt || null,
//   updatedAt: a.updatedAt || null,
//   canModify: !LOCKED_STATUSES.includes(a.status)
// });

// // Fetch every appointment matching phone + email. Email is compared
// // case-insensitively; phone is compared digits-only.
// const findOwnedAppointments = async ({ patientPhone, email }) => {
//   const phone = normalizePhone(patientPhone);
//   const mail = normalizeEmail(email);

//   const { data, error } = await supabase
//     .from(T)
//     .select('*')
//     .eq('patientPhone', phone)
//     .order('date', { ascending: false });

//   if (error) throw error;

//   return (data || []).filter((a) => normalizeEmail(a.email) === mail);
// };

// // ─── POST /api/appointments/lookup (public) ──────────────────
// // Body: { patientPhone, email }
// const lookupAppointments = async (req, res) => {
//   const { patientPhone, email } = req.body || {};

//   const phone = normalizePhone(patientPhone);
//   const mail = normalizeEmail(email);

//   if (!phone || !mail) {
//     return res.status(400).json({ message: 'Both mobile number and email are required.' });
//   }
//   if (!/^\d{10}$/.test(phone)) {
//     return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
//   }
//   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
//     return res.status(400).json({ message: 'Please enter a valid email address' });
//   }

//   try {
//     const owned = await findOwnedAppointments({ patientPhone: phone, email: mail });
//     return res.json({
//       count: owned.length,
//       appointments: owned.map(publicAppointmentView)
//     });
//   } catch (err) {
//     console.error('[appointments] lookup error:', err);
//     return res.status(500).json({ message: 'Could not look up your appointments' });
//   }
// };

// // Shared guard: load one appointment and prove the caller owns it.
// const loadOwnedAppointment = async (id, { patientPhone, email }) => {
//   const phone = normalizePhone(patientPhone);
//   const mail = normalizeEmail(email);

//   if (!phone || !mail) {
//     return { error: { status: 400, message: 'Both mobile number and email are required.' } };
//   }

//   const { data, error } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
//   if (error) {
//     console.error('[appointments] public load error:', error);
//     return { error: { status: 500, message: 'Could not load the appointment' } };
//   }
//   if (!data) return { error: { status: 404, message: 'Appointment not found' } };

//   const matches = normalizePhone(data.patientPhone) === phone && normalizeEmail(data.email) === mail;
//   if (!matches) {
//     // Same response as "not found" so this can't be used to probe for bookings.
//     return { error: { status: 404, message: 'Appointment not found' } };
//   }

//   return { appointment: data };
// };

// // ─── PUT /api/appointments/public/:id (public) — reschedule ───
// // Body: { patientPhone, email, date, time, [petName, reason, patientName] }
// const reschedulePublicAppointment = async (req, res) => {
//   const { patientPhone, email, date, time, petName, reason, patientName } = req.body || {};

//   const { appointment, error: guard } = await loadOwnedAppointment(req.params.id, { patientPhone, email });
//   if (guard) return res.status(guard.status).json({ message: guard.message });

//   if (LOCKED_STATUSES.includes(appointment.status)) {
//     return res.status(409).json({
//       message: `This appointment is already ${appointment.status.toLowerCase()} and can no longer be changed.`
//     });
//   }

//   if (!date || !time) {
//     return res.status(400).json({ message: 'A new date and time are required to reschedule.' });
//   }

//   // Don't let a patient move onto a slot that is already taken at that hospital.
//   try {
//     const booked = await getBookedSlotsForDate(date, appointment.hospitalId);
//     const movingSlot = date !== appointment.date || time !== appointment.time;
//     if (movingSlot && Array.isArray(booked) && booked.includes(time)) {
//       return res.status(409).json({ message: 'That slot is already booked. Please pick another time.' });
//     }
//   } catch (e) {
//     console.error('[appointments] reschedule slot check failed:', e);
//     // Slot checking is best-effort — never block a reschedule on it.
//   }

//   const patch = {
//     date,
//     time,
//     // A rescheduled visit needs the hospital to confirm again.
//     status: 'Pending',
//     updatedAt: new Date().toISOString()
//   };
//   if (petName !== undefined) patch.petName = String(petName).trim();
//   if (reason !== undefined) patch.reason = String(reason).trim();
//   if (patientName !== undefined && String(patientName).trim()) patch.patientName = String(patientName).trim();

//   const { data, error } = await supabase.from(T).update(patch).eq('id', appointment.id).select().single();
//   if (error) {
//     console.error('[appointments] reschedule error:', error);
//     return res.status(500).json({ message: 'Could not reschedule the appointment' });
//   }

//   // Keep Google Calendar in sync with the new slot.
//   if (appointment.google_event_id) {
//     await syncGoogleCalendar('update', appointment, { date, time });
//   }

//   // Confirm to the patient…
//   sendAppointmentRescheduled({
//     to: data.email,
//     patientName: data.patientName,
//     hospitalName: data.hospital,
//     date: data.date,
//     time: data.time,
//     previousDate: appointment.date,
//     previousTime: appointment.time
//   }).catch((e) => console.error('[appointments] reschedule email failed:', e));

//   // …and let the superadmin know the slot moved.
//   sendAppointmentNewToSuperAdmin({
//     patientName: data.patientName,
//     patientPhone: data.patientPhone,
//     email: data.email,
//     hospitalName: data.hospital,
//     date: data.date,
//     time: data.time,
//     petName: data.petName,
//     description: `Rescheduled by the patient (was ${appointment.date || 'n/a'} ${appointment.time || ''}). ${data.reason || ''}`.trim(),
//     source: 'public'
//   }).catch((e) => console.error('[appointments] superadmin reschedule email failed:', e));

//   return res.json({
//     message: 'Appointment rescheduled — the hospital will confirm the new slot.',
//     appointment: publicAppointmentView(data)
//   });
// };

// // ─── DELETE /api/appointments/public/:id (public) — cancel ────
// // Body: { patientPhone, email, [reason] }
// const cancelPublicAppointment = async (req, res) => {
//   // DELETE bodies are supported by express.json(), but fall back to the query
//   // string so the endpoint works from clients that strip them.
//   const patientPhone = req.body?.patientPhone ?? req.query.patientPhone;
//   const email = req.body?.email ?? req.query.email;
//   const reason = req.body?.reason ?? req.query.reason;

//   const { appointment, error: guard } = await loadOwnedAppointment(req.params.id, { patientPhone, email });
//   if (guard) return res.status(guard.status).json({ message: guard.message });

//   if (appointment.status === 'Cancelled') {
//     return res.status(409).json({ message: 'This appointment is already cancelled.' });
//   }
//   if (appointment.status === 'Completed') {
//     return res.status(409).json({ message: 'A completed appointment can no longer be cancelled.' });
//   }

//   // Free the Google Calendar slot first so the time becomes bookable again.
//   if (appointment.google_event_id) {
//     await syncGoogleCalendar('delete', appointment);
//   }

//   // Soft-cancel: the hospital keeps the record, the slot frees up.
//   const patch = {
//     status: 'Cancelled',
//     updatedAt: new Date().toISOString()
//   };
//   if (reason && String(reason).trim()) {
//     patch.reason = `${appointment.reason ? `${appointment.reason} — ` : ''}Cancelled by patient: ${String(reason).trim()}`;
//   }

//   const { data, error } = await supabase.from(T).update(patch).eq('id', appointment.id).select().single();
//   if (error) {
//     console.error('[appointments] cancel error:', error);
//     return res.status(500).json({ message: 'Could not cancel the appointment' });
//   }

//   sendAppointmentCancelled({
//     to: data.email,
//     patientName: data.patientName,
//     hospitalName: data.hospital,
//     date: data.date,
//     time: data.time,
//     reason: reason ? String(reason).trim() : ''
//   }).catch((e) => console.error('[appointments] cancellation email failed:', e));

//   sendAppointmentNewToSuperAdmin({
//     patientName: data.patientName,
//     patientPhone: data.patientPhone,
//     email: data.email,
//     hospitalName: data.hospital,
//     date: data.date,
//     time: data.time,
//     petName: data.petName,
//     description: `CANCELLED by the patient. ${reason ? `Reason: ${String(reason).trim()}` : ''}`.trim(),
//     source: 'public'
//   }).catch((e) => console.error('[appointments] superadmin cancellation email failed:', e));

//   return res.json({
//     message: 'Appointment cancelled. A confirmation has been emailed to you.',
//     appointment: publicAppointmentView(data)
//   });
// };

// module.exports = {
//   bookAppointment,
//   bookPublicAppointment,
//   getAppointments,
//   updateAppointmentStatus,
//   updateAppointment,
//   deleteAppointment,
//   getBookedSlots,
//   lookupAppointments,
//   reschedulePublicAppointment,
//   cancelPublicAppointment
// };


const { supabase } = require('../config/supabase');
const {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate,
  sendAppointmentNewToSuperAdmin,
  sendAppointmentRescheduled,
  sendAppointmentCancelled
} = require('../services/emailService');
const {
  getBookedSlotsForDate,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} = require('../services/googleCalendarService');

const T = 'appointments';
const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];

// Statuses a patient may no longer change from the public "manage booking" page.
const LOCKED_STATUSES = ['Completed', 'Cancelled'];

// ─── Helper: get hospital name by ID ──────────────────────────
const hospitalName = async (hospitalId) => {
  const { data } = await supabase.from('hospitals').select('name').eq('id', hospitalId).limit(1);
  return data && data[0] ? data[0].name : '';
};

// ─── Helper: create/update/delete Google Calendar events ──────
const syncGoogleCalendar = async (action, appointment, patch = {}) => {
  try {
    const startTime = new Date(`${appointment.date}T${appointment.time}:00`).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();

    if (action === 'create') {
      const event = await createCalendarEvent({
        summary: `Appointment - ${appointment.patientName}`,
        description: appointment.reason || 'No additional details',
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
      const newStart = new Date(`${patch.date}T${patch.time}:00`).toISOString();
      const newEnd = new Date(new Date(newStart).getTime() + 30 * 60000).toISOString();
      await updateCalendarEvent(appointment.google_event_id, {
        summary: `Appointment - ${appointment.patientName}`,
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
    // Don't block the main flow; log and continue
  }
};

// ─── GET /api/appointments/booked-slots ──────────────────────
const getBookedSlots = async (req, res) => {
  const { date, hospitalId } = req.query;
  if (!date) return res.status(400).json({ message: 'date query parameter is required' });

  try {
    const bookedSlots = await getBookedSlotsForDate(date, hospitalId);
    return res.json({ date, hospitalId: hospitalId || null, bookedSlots });
  } catch (err) {
    console.error('[appointments] booked-slots error:', err);
    return res.status(500).json({ message: 'Could not fetch booked slots' });
  }
};

// ─── POST /api/appointments (authenticated) ──────────────────
const bookAppointment = async (req, res) => {
  const { doctorName, date, time, patientName, patientPhone, reason, petName, species, appointmentType } = req.body;
  const hospitalId = req.body.hospitalId || (req.user.role === 'admin' ? req.user.hospitalId : undefined);
  if (!hospitalId || !patientName || !patientPhone) {
    return res.status(400).json({ message: 'Hospital, patient name and mobile number are required' });
  }

  const row = {
    id: Date.now().toString(),
    userId: req.user.id,
    hospitalId,
    hospital: await hospitalName(hospitalId),
    doctorName: doctorName || 'Any Available Doctor',
    date: date || '',
    time: time || '',
    patientName,
    patientPhone,
    reason: reason || '',
    petName: petName || '',
    species: species || '',
    appointmentType: appointmentType || 'Consult',
    status: 'Pending'
  };

  const { data, error } = await supabase.from(T).insert(row).select().single();
  if (error) {
    console.error('[appointments] book:', error);
    return res.status(500).json({ message: 'Could not book appointment' });
  }

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
      email: req.user.email
    }).catch((e) => console.error('[appointments] confirmation email failed:', e));
  }

  sendAppointmentNewToSuperAdmin({
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    email: req.user?.email || '',
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    petName: data.petName,
    description: data.reason,
    source: 'dashboard'
  }).catch((e) => console.error('[appointments] superadmin new-booking email failed:', e));

  await syncGoogleCalendar('create', data);
  return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
};

// ─── POST /api/appointments/public (unauthenticated) ──────────
const bookPublicAppointment = async (req, res) => {
  const { hospitalId, patientName, patientPhone, email, date, time, description, petName, species } = req.body || {};
  if (!hospitalId || !patientName || !patientPhone) {
    return res.status(400).json({ message: 'Hospital, patient name and mobile number are required' });
  }
  if (!/^\d{10}$/.test(String(patientPhone).trim())) {
    return res.status(400).json({ message: 'Mobile number must be exactly 10 digits' });
  }

  const name = await hospitalName(hospitalId);
  if (!name) return res.status(404).json({ message: 'Selected hospital not found' });

  const row = {
    id: Date.now().toString(),
    userId: null,
    hospitalId: String(hospitalId),
    hospital: name,
    patientName: String(patientName).trim(),
    patientPhone: String(patientPhone).trim(),
    email: email ? String(email).trim() : '',
    date: date || '',
    time: time || '',
    reason: description ? String(description).trim() : '',
    petName: petName || '',
    species: species || '',
    appointmentType: 'Consult',
    status: 'Pending',
    source: 'public'
  };

  const { data, error } = await supabase.from(T).insert(row).select().single();
  if (error) {
    console.error('[appointments] public book:', error);
    return res.status(500).json({ message: 'Could not book appointment' });
  }

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
      email: data.email
    }).catch((e) => console.error('[appointments] confirmation email failed:', e));
  }

  sendAppointmentNewToSuperAdmin({
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    email: data.email,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    petName: data.petName,
    description: data.reason,
    source: 'public'
  }).catch((e) => console.error('[appointments] superadmin new-booking email failed:', e));

  await syncGoogleCalendar('create', data);
  return res.status(201).json({ message: 'Appointment booked successfully', appointment: data });
};

// ─── GET /api/appointments (role‑scoped) ─────────────────────
// ✅ FIXED: Now safely handles missing from/to query parameters
const getAppointments = async (req, res) => {
  try {
    // Safely extract query params – they may be undefined
    const { from, to } = req.query || {};

    // Build the base query
    let q = supabase.from(T).select('*').order('createdAt', { ascending: false });

    // Role-based filtering
    if (req.user.role === 'admin') {
      q = q.eq('hospitalId', req.user.hospitalId);
    } else if (req.user.role !== 'superadmin') {
      q = q.eq('userId', req.user.id);
    }

    // ✅ Apply date range filter ONLY if both from and to are provided and non‑empty
    if (from && to) {
      // Assuming we filter on the 'date' column (format YYYY-MM-DD)
      q = q.gte('date', from).lte('date', to);
    }
    // If from or to is missing, we simply don't filter by date.

    const { data, error } = await q;
    if (error) {
      console.error('[appointments] list error:', error);
      return res.status(500).json({ message: 'Could not load appointments' });
    }
    return res.json(data || []);
  } catch (err) {
    console.error('[appointments] getAppointments unexpected error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Helper: get user email from appointment ──────────────────
const getUserEmail = async (appointment) => {
  if (appointment.email) return appointment.email;
  if (appointment.userId) {
    const { data } = await supabase.from('users').select('email').eq('id', appointment.userId).single();
    return data?.email || null;
  }
  return null;
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
  console.log('[appointments] updateStatus - userEmail:', userEmail);
  if (userEmail) {
    sendAppointmentStatusUpdate({
      to: userEmail,
      patientName: existing.patientName,
      hospitalName: existing.hospital,
      date: existing.date,
      time: existing.time,
      status: status,
      message: req.body.message || undefined
    }).catch((e) => console.error('[appointments] status update email failed:', e));
  } else {
    console.warn('[appointments] updateStatus - No email found for appointment:', req.params.id);
  }

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

  const fields = ['date', 'time', 'patientName', 'patientPhone', 'reason', 'petName', 'species', 'appointmentType', 'status', 'doctorName'];
  const patch = { updatedAt: new Date().toISOString() };
  let statusChanged = false;
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      patch[f] = req.body[f];
      if (f === 'status') statusChanged = true;
    }
  });

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
    console.log('[appointments] updateAppointment - status changed, userEmail:', userEmail);
    if (userEmail) {
      sendAppointmentStatusUpdate({
        to: userEmail,
        patientName: appt.patientName,
        hospitalName: appt.hospital,
        date: appt.date,
        time: appt.time,
        status: patch.status,
        message: req.body.message || undefined
      }).catch((e) => console.error('[appointments] status update email failed:', e));
    } else {
      console.warn('[appointments] updateAppointment - No email found for appointment:', id);
    }
  }

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
  return res.json({ message: 'Appointment deleted successfully' });
};

// ═══════════════════════════════════════════════════════════════
//  Public "manage my booking" flow
// ═══════════════════════════════════════════════════════════════

const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

const publicAppointmentView = (a) => ({
  id: a.id,
  hospital: a.hospital,
  hospitalId: a.hospitalId,
  patientName: a.patientName,
  patientPhone: a.patientPhone,
  email: a.email || '',
  petName: a.petName || '',
  species: a.species || '',
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

const cancelPublicAppointment = async (req, res) => {
  const patientPhone = req.body?.patientPhone ?? req.query.patientPhone;
  const email = req.body?.email ?? req.query.email;
  const reason = req.body?.reason ?? req.query.reason;

  const { appointment, error: guard } = await loadOwnedAppointment(req.params.id, { patientPhone, email });
  if (guard) return res.status(guard.status).json({ message: guard.message });

  if (appointment.status === 'Cancelled') {
    return res.status(409).json({ message: 'This appointment is already cancelled.' });
  }
  if (appointment.status === 'Completed') {
    return res.status(409).json({ message: 'A completed appointment can no longer be cancelled.' });
  }

  if (appointment.google_event_id) {
    await syncGoogleCalendar('delete', appointment);
  }

  const patch = {
    status: 'Cancelled',
    updatedAt: new Date().toISOString()
  };
  if (reason && String(reason).trim()) {
    patch.reason = `${appointment.reason ? `${appointment.reason} — ` : ''}Cancelled by patient: ${String(reason).trim()}`;
  }

  const { data, error } = await supabase.from(T).update(patch).eq('id', appointment.id).select().single();
  if (error) {
    console.error('[appointments] cancel error:', error);
    return res.status(500).json({ message: 'Could not cancel the appointment' });
  }

  sendAppointmentCancelled({
    to: data.email,
    patientName: data.patientName,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    reason: reason ? String(reason).trim() : ''
  }).catch((e) => console.error('[appointments] cancellation email failed:', e));

  sendAppointmentNewToSuperAdmin({
    patientName: data.patientName,
    patientPhone: data.patientPhone,
    email: data.email,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    petName: data.petName,
    description: `CANCELLED by the patient. ${reason ? `Reason: ${String(reason).trim()}` : ''}`.trim(),
    source: 'public'
  }).catch((e) => console.error('[appointments] superadmin cancellation email failed:', e));

  return res.json({
    message: 'Appointment cancelled. A confirmation has been emailed to you.',
    appointment: publicAppointmentView(data)
  });
};

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
  cancelPublicAppointment
};