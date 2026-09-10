const { supabase } = require('../config/supabase');
const { executeAppointmentCancellation } = require('./appointmentController');

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
  cancellationReason: a.cancellationReason || '',
  cancellationFee: a.cancellationFee || 0,
  refundAmount: a.refundAmount || 0,
  refundStatus: a.refundStatus || 'No Refund',
  refundId: a.refundId || null,
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

  let appointment = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
      if (!error && data) appointment = data;
    } catch (e) {
      console.error('[cancelAppointment] public load error:', e);
    }
  }

  if (!appointment) {
    const { readDB } = require('../models');
    const db = readDB();
    appointment = (db.appointments || []).find((a) => String(a.id) === String(id));
  }

  if (!appointment) return { error: { status: 404, message: 'Appointment not found' } };

  const matches = normalizePhone(appointment.patientPhone) === phone && normalizeEmail(appointment.email) === mail;
  if (!matches) {
    return { error: { status: 404, message: 'Appointment not found' } };
  }

  return { appointment };
};

const cancelPublicAppointment = async (req, res) => {
  const patientPhone = req.body?.patientPhone ?? req.query.patientPhone;
  const email = req.body?.email ?? req.query.email;
  const reason = req.body?.reason ?? req.query.reason;

  console.log('[cancelAppointment] incoming public cancel:', { id: req.params.id, patientPhone, email });

  const { appointment, error: guard } = await loadOwnedAppointment(req.params.id, { patientPhone, email });
  if (guard) return res.status(guard.status).json({ message: guard.message });

  if (appointment.status === 'Cancelled') {
    return res.status(409).json({ message: 'This appointment is already cancelled.' });
  }
  if (appointment.status === 'Completed') {
    return res.status(409).json({ message: 'A completed appointment can no longer be cancelled.' });
  }

  try {
    const updated = await executeAppointmentCancellation({
      appointment,
      reason: reason ? String(reason).trim() : 'Cancelled by patient',
      cancelledBy: 'public_patient'
    });

    console.log('[cancelAppointment] successfully cancelled appointment id:', updated.id, 'refund:', updated.refundAmount);

    return res.json({
      message: 'Appointment cancelled and refund processed. A confirmation has been emailed to you.',
      appointment: publicAppointmentView(updated)
    });
  } catch (error) {
    console.error('[cancelAppointment] cancel error:', error);
    return res.status(500).json({ message: error.message || 'Could not cancel the appointment' });
  }
};

module.exports = { cancelPublicAppointment };
