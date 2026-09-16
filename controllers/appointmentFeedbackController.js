const { supabase } = require('../config/supabase');
const { readDB, writeDB } = require('../models');
const { broadcast } = require('../services/websocketService');
const TABLE = 'appointment_feedbacks';

const isMissingTable = (error) =>
  error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '');

// Helper to look up an appointment across Supabase and local DB
const findAppointment = async (appointmentId, appointmentNumber) => {
  if (!appointmentId && !appointmentNumber) return null;

  // 1. Try Supabase
  if (supabase) {
    try {
      let query = supabase.from('appointments').select('*');
      if (appointmentId) {
        query = query.eq('id', appointmentId);
      } else if (appointmentNumber) {
        query = query.eq('appointment_number', Number(appointmentNumber));
      }
      const { data: appt, error } = await query.maybeSingle();
      if (!error && appt) return appt;
    } catch (e) {
      // Supabase query error, proceed to fallback
    }
  }

  // 2. Try Fallback local DB
  try {
    const db = readDB();
    const list = db.appointments || [];
    const found = list.find((a) => {
      const matchId = appointmentId && (String(a.id) === String(appointmentId) || String(a._id) === String(appointmentId));
      const matchNum = appointmentNumber && (Number(a.appointment_number) === Number(appointmentNumber) || Number(a.appointmentNumber) === Number(appointmentNumber));
      return matchId || matchNum;
    });
    if (found) return found;
  } catch (e) {
    // ignore
  }

  return null;
};

// ─── GET all (admin sees own hospital, superadmin sees all, user sees own) ───
const getFeedbacks = async (req, res) => {
  try {
    let items = [];
    let usedSupabase = false;

    if (supabase) {
      try {
        let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
        if (req.user.role === 'admin') {
          query = query.eq('hospitalid', req.user.hospitalId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          items = data;
          usedSupabase = true;
        } else if (error && !isMissingTable(error)) {
          console.warn('[appt feedback] Supabase list warning:', error.message);
        }
      } catch (err) {
        console.warn('[appt feedback] Supabase connection warning:', err.message);
      }
    }

    // Fallback to local DB if Supabase did not return items
    if (!usedSupabase || items.length === 0) {
      const db = readDB();
      const localFeedbacks = db.feedbacks || db.appointment_feedbacks || [];
      if (req.user.role === 'admin') {
        items = localFeedbacks.filter((f) => String(f.hospitalId || f.hospitalid) === String(req.user.hospitalId));
      } else {
        items = localFeedbacks;
      }
    }

    // 🔍 Fetch appointment details (number, email, phone, userId) for each feedback
    const feedbacksWithAppointment = await Promise.all(items.map(async (item) => {
      let appointmentDetails = {
        appointmentNumber: item.appointmentNumber || item.appointment_number || null,
        email: item.email || null,
        patientPhone: item.patientPhone || item.patientphone || null,
        userId: item.userId || item.userid || null
      };

      const apptId = item.appointment_id || item.appointmentId;
      if (apptId) {
        const appt = await findAppointment(apptId, item.appointmentNumber || item.appointment_number);
        if (appt) {
          appointmentDetails = {
            appointmentNumber: appt.appointment_number || appt.appointmentNumber || appointmentDetails.appointmentNumber,
            email: appt.email || appointmentDetails.email,
            patientPhone: appt.patientPhone || appt.patientphone || appointmentDetails.patientPhone,
            userId: appt.userId || appt.userid || appointmentDetails.userId
          };
        }
      }
      return { ...item, ...appointmentDetails };
    }));

    // Remap database columns for frontend
    let mappedData = feedbacksWithAppointment.map((item) => ({
      id: item.id,
      appointmentId: item.appointment_id || item.appointmentId || null,
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
      feedbackGiven: item.feedbackgiven !== undefined ? item.feedbackgiven : (item.feedbackGiven !== undefined ? item.feedbackGiven : false),
      callAttempted: item.callattempted !== undefined ? item.callattempted : (item.callAttempted !== undefined ? item.callAttempted : false),
      callPicked: item.callpicked !== undefined ? item.callpicked : (item.callPicked !== undefined ? item.callPicked : false),
      feedbackText: item.feedbacktext || item.feedbackText || '',
      rating: item.rating ? Number(item.rating) : null,
      hospitalId: item.hospitalid || item.hospitalId,
      createdBy: item.createdby || item.createdBy,
      created_at: item.created_at || item.createdAt || new Date().toISOString(),
      updated_at: item.updated_at || item.updatedAt || new Date().toISOString()
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
    } = req.body || {};

    const reviewText = (feedbackText || message || '').trim();

    // 1. Resolve appointment record across Supabase and local DB
    let apptRecord = await findAppointment(appointmentId, appointmentNumber);

    // If user role is 'user', check appointment if available
    if (req.user.role === 'user') {
      if (apptRecord && apptRecord.status === 'Cancelled') {
        return res.status(400).json({
          message: 'Feedback cannot be submitted for cancelled appointments.'
        });
      }
    }

    const resolvedPatientName = patientName || apptRecord?.patientName || apptRecord?.patientname || req.user.name || 'Patient';
    const resolvedDate = date || apptRecord?.date || new Date().toISOString().split('T')[0];
    const resolvedHospitalId = hospitalId || apptRecord?.hospitalId || apptRecord?.hospitalid || req.user.hospitalId || null;
    const resolvedApptId = apptRecord?.id || appointmentId || null;
    const resolvedApptNum = apptRecord?.appointment_number || apptRecord?.appointmentNumber || appointmentNumber || null;

    const feedbackId = Date.now().toString();
    const now = new Date().toISOString();

    const row = {
      id: feedbackId,
      patientname: resolvedPatientName,
      petname: petName || apptRecord?.petName || apptRecord?.petname || '',
      appointmenttype: appointmentType || apptRecord?.appointmentType || apptRecord?.appointmenttype || 'Consult',
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
      createdby: String(req.user.id),
      created_at: now
    };

    let createdRecord = null;

    // 2. Try saving to Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .insert(row)
          .select()
          .single();

        if (!error && data) {
          createdRecord = data;
        } else if (error) {
          console.warn('[appt feedback] Supabase insert warning:', error.message);
        }
      } catch (err) {
        console.warn('[appt feedback] Supabase insert error:', err.message);
      }
    }

    // 3. Fallback and sync to local DB
    const db = readDB();
    db.feedbacks = db.feedbacks || [];
    const localEntry = {
      id: createdRecord?.id || feedbackId,
      appointmentId: resolvedApptId,
      appointmentNumber: resolvedApptNum,
      patientName: resolvedPatientName,
      petName: row.petname,
      appointmentType: row.appointmenttype,
      date: resolvedDate,
      time: row.time,
      feedbackStatus: row.feedbackstatus,
      feedbackGiven: row.feedbackgiven,
      callAttempted: row.callattempted,
      callPicked: row.callpicked,
      feedbackText: reviewText,
      rating: row.rating,
      hospitalId: resolvedHospitalId,
      createdBy: String(req.user.id),
      created_at: now
    };
    db.feedbacks.push(localEntry);
    writeDB(db);

    const responseData = {
      id: createdRecord?.id || localEntry.id,
      appointmentId: resolvedApptId,
      appointmentNumber: resolvedApptNum,
      patientName: resolvedPatientName,
      petName: row.petname,
      appointmentType: row.appointmenttype,
      date: resolvedDate,
      time: row.time,
      feedbackStatus: row.feedbackstatus,
      feedbackGiven: row.feedbackgiven,
      callAttempted: row.callattempted,
      callPicked: row.callpicked,
      feedbackText: reviewText,
      rating: row.rating,
      hospitalId: resolvedHospitalId,
      createdBy: String(req.user.id),
      created_at: now
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

    let updatedRecord = null;

    if (supabase) {
      try {
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

        if (!error && data) {
          updatedRecord = data;
        }
      } catch (err) {
        console.warn('[appt feedback] Supabase update warning:', err.message);
      }
    }

    // Sync with local DB
    const db = readDB();
    db.feedbacks = db.feedbacks || [];
    const idx = db.feedbacks.findIndex((f) => String(f.id) === String(id));
    if (idx !== -1) {
      db.feedbacks[idx] = { ...db.feedbacks[idx], ...req.body };
      writeDB(db);
      if (!updatedRecord) updatedRecord = db.feedbacks[idx];
    }

    const responseData = {
      id: updatedRecord?.id || id,
      patientName: updatedRecord?.patientname || updatedRecord?.patientName || req.body.patientName,
      petName: updatedRecord?.petname || updatedRecord?.petName || req.body.petName,
      appointmentType: updatedRecord?.appointmenttype || updatedRecord?.appointmentType || req.body.appointmentType,
      date: updatedRecord?.date || req.body.date,
      time: updatedRecord?.time || req.body.time,
      feedbackStatus: updatedRecord?.feedbackstatus || updatedRecord?.feedbackStatus || req.body.feedbackStatus,
      feedbackGiven: updatedRecord?.feedbackgiven !== undefined ? updatedRecord?.feedbackgiven : req.body.feedbackGiven,
      callAttempted: updatedRecord?.callattempted !== undefined ? updatedRecord?.callattempted : req.body.callAttempted,
      callPicked: updatedRecord?.callpicked !== undefined ? updatedRecord?.callpicked : req.body.callPicked,
      feedbackText: updatedRecord?.feedbacktext || updatedRecord?.feedbackText || req.body.feedbackText,
      hospitalId: updatedRecord?.hospitalid || updatedRecord?.hospitalId || req.body.hospitalId,
      createdBy: updatedRecord?.createdby || updatedRecord?.createdBy,
      created_at: updatedRecord?.created_at || updatedRecord?.createdAt
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

    if (supabase) {
      try {
        await supabase.from(TABLE).delete().eq('id', id);
      } catch (err) {
        console.warn('[appt feedback] Supabase delete warning:', err.message);
      }
    }

    const db = readDB();
    db.feedbacks = (db.feedbacks || []).filter((f) => String(f.id) !== String(id));
    writeDB(db);

    broadcast('feedback_deleted', { id: isNaN(id) ? id : Number(id) });
    return res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error('[appt feedback] delete unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFeedbacks, createFeedback, updateFeedback, deleteFeedback };