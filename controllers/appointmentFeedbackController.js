const { supabase } = require('../config/supabase');
const { broadcast } = require('../services/websocketService');
const TABLE = 'appointment_feedbacks';

const isMissingTable = (error) =>
  error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '');

const tableMissing = (res) => {
  console.error(
    `[appt feedback] The '${TABLE}' table does not exist. ` +
    'Run HMS_BACKEND/db/appointment_feedbacks.sql in the Supabase SQL editor.'
  );
  return res.status(503).json({
    message:
      'Appointment feedback is not set up yet — the "appointment_feedbacks" table is missing. ' +
      'Run HMS_BACKEND/db/appointment_feedbacks.sql in the Supabase SQL editor, then reload.'
  });
};

// ─── GET all (admin sees own hospital, superadmin sees all, user sees own) ───
const getFeedbacks = async (req, res) => {
  try {
    let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
    if (req.user.role === 'admin') {
      query = query.eq('hospitalid', req.user.hospitalId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[appt feedback] list error:', error);
      if (isMissingTable(error)) return tableMissing(res);
      return res.status(500).json({ message: 'Could not load feedbacks' });
    }

    // 🔍 Fetch appointment details (number, email, phone, userId) for each feedback
    const feedbacksWithAppointment = await Promise.all(data.map(async (item) => {
      let appointmentDetails = {
        appointmentNumber: null,
        email: null,
        patientPhone: null,
        userId: null
      };
      if (item.appointment_id) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('appointment_number, email, patientPhone, userId')
          .eq('id', item.appointment_id)
          .maybeSingle();
        if (appt) {
          appointmentDetails = {
            appointmentNumber: appt.appointment_number || null,
            email: appt.email || null,
            patientPhone: appt.patientPhone || null,
            userId: appt.userId || null
          };
        }
      }
      return { ...item, ...appointmentDetails };
    }));

    // Remap database columns for frontend
    let mappedData = feedbacksWithAppointment.map((item) => ({
      id: item.id,
      appointmentId: item.appointment_id || null,
      appointmentNumber: item.appointmentNumber || null,
      email: item.email || null,
      patientPhone: item.patientPhone || null,
      userId: item.userId || null,
      patientName: item.patientname || item.patientName || '',
      petName: item.petname || item.petName || '',
      appointmentType: item.appointmenttype || item.appointmentType || 'Consult',
      date: item.date || '',
      time: item.time || '',
      feedbackStatus: item.feedbackstatus || item.feedbackStatus || 'Pending',
      feedbackGiven: item.feedbackgiven || item.feedbackGiven || false,
      callAttempted: item.callattempted || item.callAttempted || false,
      callPicked: item.callpicked || item.callPicked || false,
      feedbackText: item.feedbacktext || item.feedbackText || '',
      rating: item.rating || null,
      hospitalId: item.hospitalid || item.hospitalId,
      createdBy: item.createdby || item.createdBy,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    // If regular user, filter only their own feedbacks
    if (req.user.role === 'user') {
      const userEmail = (req.user.email || '').toLowerCase();
      const userPhone = req.user.mobile || req.user.phone || '';
      const userId = String(req.user.id);

      mappedData = mappedData.filter((f) => {
        const matchesUser = f.userId && String(f.userId) === userId;
        const matchesCreated = f.createdBy && String(f.createdBy) === userId;
        const matchesEmail = f.email && f.email.toLowerCase() === userEmail;
        const matchesPhone = userPhone && f.patientPhone && f.patientPhone.includes(userPhone);
        return matchesUser || matchesCreated || matchesEmail || matchesPhone;
      });
    }

    return res.json(mappedData);
  } catch (err) {
    console.error('[appt feedback] unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── POST (users, admins, superadmins) ─────────────────────────
const createFeedback = async (req, res) => {
  try {
    const {
      appointmentId, appointmentNumber, rating,
      patientName, petName, appointmentType, date, time,
      feedbackStatus, feedbackGiven, callAttempted, callPicked, feedbackText, message, hospitalId
    } = req.body;

    const reviewText = (feedbackText || message || '').trim();

    // If user role is 'user', require appointment reference and check Completed status
    let apptRecord = null;
    if (appointmentId || appointmentNumber) {
      let query = supabase.from('appointments').select('*');
      if (appointmentId) query = query.eq('id', appointmentId);
      else if (appointmentNumber) query = query.eq('appointment_number', Number(appointmentNumber));

      const { data: appt } = await query.maybeSingle();
      if (appt) {
        apptRecord = appt;
      }
    }

    if (req.user.role === 'user') {
      if (!apptRecord) {
        return res.status(400).json({ message: 'A valid appointment is required to submit feedback.' });
      }
      if (apptRecord.status !== 'Completed') {
        return res.status(400).json({
          message: 'Feedback can only be given after the appointment is marked as Completed by the hospital admin.'
        });
      }
    }

    const resolvedPatientName = patientName || apptRecord?.patientName || req.user.name || 'Patient';
    const resolvedDate = date || apptRecord?.date || new Date().toISOString().split('T')[0];
    const resolvedHospitalId = hospitalId || apptRecord?.hospitalId || req.user.hospitalId || null;
    const resolvedApptId = apptRecord?.id || appointmentId || null;

    // Check if feedback already exists for this appointment
    if (resolvedApptId) {
      const { data: existing } = await supabase
        .from(TABLE)
        .select('id')
        .eq('appointment_id', resolvedApptId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ message: 'Feedback already submitted for this appointment' });
      }
    }

    const row = {
      patientname: resolvedPatientName,
      petname: petName || apptRecord?.petName || '',
      appointmenttype: appointmentType || apptRecord?.appointmentType || 'Consult',
      date: resolvedDate,
      time: time || apptRecord?.time || '',
      feedbackstatus: req.user.role === 'user' ? 'Published' : (feedbackStatus || 'Pending'),
      feedbackgiven: feedbackGiven !== undefined ? feedbackGiven : true,
      callattempted: callAttempted || false,
      callpicked: callPicked || false,
      feedbacktext: reviewText,
      rating: rating ? Number(rating) : null,
      hospitalid: resolvedHospitalId,
      appointment_id: resolvedApptId,
      createdby: req.user.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[appt feedback] create error:', error);
      return res.status(500).json({ message: 'Could not create feedback' });
    }

    const responseData = {
      id: data.id,
      appointmentId: data.appointment_id,
      appointmentNumber: apptRecord?.appointment_number || appointmentNumber || null,
      patientName: data.patientname,
      petName: data.petname,
      appointmentType: data.appointmenttype,
      date: data.date,
      time: data.time,
      feedbackStatus: data.feedbackstatus,
      feedbackGiven: data.feedbackgiven,
      callAttempted: data.callattempted,
      callPicked: data.callpicked,
      feedbackText: data.feedbacktext,
      rating: data.rating,
      hospitalId: data.hospitalid,
      createdBy: data.createdby,
      created_at: data.created_at
    };

    broadcast('feedback_created', responseData);
    return res.status(201).json({ message: 'Feedback submitted successfully!', feedback: responseData });
  } catch (err) {
    console.error('[appt feedback] create unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── PUT (admin can edit own, superadmin can edit any) ──────
const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const fieldMap = {
      patientName: 'patientname',
      petName: 'petname',
      appointmentType: 'appointmenttype',
      date: 'date',
      time: 'time',
      feedbackStatus: 'feedbackstatus',
      feedbackGiven: 'feedbackgiven',
      callAttempted: 'callattempted',
      callPicked: 'callpicked',
      feedbackText: 'feedbacktext'
    };

    const updates = {};
    Object.keys(fieldMap).forEach((frontendKey) => {
      if (req.body[frontendKey] !== undefined) {
        updates[fieldMap[frontendKey]] = req.body[frontendKey];
      }
    });

    if (req.user.role === 'admin') {
      const { data: existing } = await supabase
        .from(TABLE)
        .select('hospitalid')
        .eq('id', id)
        .single();
      if (existing && String(existing.hospitalid) !== String(req.user.hospitalId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[appt feedback] update error:', error);
      return res.status(500).json({ message: 'Update failed' });
    }

    const responseData = {
      id: data.id,
      patientName: data.patientname,
      petName: data.petname,
      appointmentType: data.appointmenttype,
      date: data.date,
      time: data.time,
      feedbackStatus: data.feedbackstatus,
      feedbackGiven: data.feedbackgiven,
      callAttempted: data.callattempted,
      callPicked: data.callpicked,
      feedbackText: data.feedbacktext,
      hospitalId: data.hospitalid,
      createdBy: data.createdby,
      created_at: data.created_at
    };

    broadcast('feedback_updated', responseData);
    return res.json(responseData);
  } catch (err) {
    console.error('[appt feedback] update unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── DELETE (superadmin only) ─────────────────────────────────
const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can delete' });
    }
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      console.error('[appt feedback] delete error:', error);
      return res.status(500).json({ message: 'Delete failed' });
    }
    broadcast('feedback_deleted', { id: Number(id) });
    return res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error('[appt feedback] delete unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFeedbacks, createFeedback, updateFeedback, deleteFeedback };