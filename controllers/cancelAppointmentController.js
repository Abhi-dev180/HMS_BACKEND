const { supabase } = require('../config/supabase');
const { sendAppointmentCancelled, sendAppointmentNewToSuperAdmin } = require('../services/emailService');
const { deleteCalendarEvent } = require('../services/googleCalendarService');

const T = 'appointments';

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
  canModify: !['Completed', 'Cancelled'].includes(a.status)
});

const loadOwnedAppointment = async (id, { patientPhone, email }) => {
  const phone = normalizePhone(patientPhone);
  const mail = normalizeEmail(email);

  if (!phone || !mail) {
    return { error: { status: 400, message: 'Both mobile number and email are required.' } };
  }

  const { data, error } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[cancelAppointment] public load error:', error);
    return { error: { status: 500, message: 'Could not load the appointment' } };
  }
  if (!data) return { error: { status: 404, message: 'Appointment not found' } };

  const matches = normalizePhone(data.patientPhone) === phone && normalizeEmail(data.email) === mail;
  if (!matches) {
    return { error: { status: 404, message: 'Appointment not found' } };
  }

  return { appointment: data };
};

const cancelPublicAppointment = async (req, res) => {
  const patientPhone = req.body?.patientPhone ?? req.query.patientPhone;
  const email = req.body?.email ?? req.query.email;
  const reason = req.body?.reason ?? req.query.reason;

  console.log('[cancelAppointment] incoming', { id: req.params.id, patientPhone, email });

  const { appointment, error: guard } = await loadOwnedAppointment(req.params.id, { patientPhone, email });
  if (guard) return res.status(guard.status).json({ message: guard.message });

  if (appointment.status === 'Cancelled') {
    return res.status(409).json({ message: 'This appointment is already cancelled.' });
  }
  if (appointment.status === 'Completed') {
    return res.status(409).json({ message: 'A completed appointment can no longer be cancelled.' });
  }

  if (appointment.google_event_id) {
    try {
      await deleteCalendarEvent(appointment.google_event_id);
      await supabase.from(T).update({ google_event_id: null }).eq('id', appointment.id);
    } catch (e) {
      console.error('[cancelAppointment] google delete failed:', e);
    }
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
    console.error('[cancelAppointment] cancel error:', error);
    return res.status(500).json({ message: 'Could not cancel the appointment' });
  }

  console.log('[cancelAppointment] cancelled appointment id:', data.id, 'google_event_id:', data.google_event_id);

  sendAppointmentCancelled({
    to: data.email,
    patientName: data.patientName,
    hospitalName: data.hospital,
    date: data.date,
    time: data.time,
    reason: reason ? String(reason).trim() : ''
  }).catch((e) => console.error('[cancelAppointment] cancellation email failed:', e));

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
  }).catch((e) => console.error('[cancelAppointment] superadmin cancellation email failed:', e));

  return res.json({
    message: 'Appointment cancelled. A confirmation has been emailed to you.',
    appointment: publicAppointmentView(data)
  });
};

module.exports = { cancelPublicAppointment };
