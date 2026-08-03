const { supabase } = require('../config/supabase');
const TABLE = 'appointment_feedbacks';
// PostgREST reports an un-migrated table as PGRST205. Name the actual problem
// instead of a generic 500, which sends people hunting for a network fault.
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

// ─── GET all (admin sees own hospital, superadmin sees all) ───
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

    // Remap database columns  for frontend
    const mappedData = data.map((item) => ({
      id: item.id,
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

    return res.json(mappedData);
  } catch (err) {
    console.error('[appt feedback] unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── POST (admin only) ─────────────────────────────────────────
const createFeedback = async (req, res) => {
  try {
    const {
      patientName, petName, appointmentType, date, time,
      feedbackStatus, feedbackGiven, callAttempted, callPicked, feedbackText
    } = req.body;

    if (!patientName || !date) {
      return res.status(400).json({ message: 'Patient name and date are required' });
    }

    // Use lowercase column names to match database
    const row = {
      patientname: patientName,                              
      petname: petName || '',                                
      appointmenttype: appointmentType || 'Consult',         
      date: date,
      time: time || '',
      feedbackstatus: feedbackStatus || 'Pending',           
      feedbackgiven: feedbackGiven || false,                 
      callattempted: callAttempted || false,                 
      callpicked: callPicked || false,                       
      feedbacktext: feedbackText || '',                      
      hospitalid: req.user.hospitalId || null,               
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

    // Return mapped data 
    return res.status(201).json({
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
    });
  } catch (err) {
    console.error('[appt feedback] create unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── PUT (admin can edit own, superadmin can edit any) ──────
const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    // Map frontend database lowercase
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

    // Ownership check for admin
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

    // Return mapped data for frontend consistency
    return res.json({
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
    });
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
    return res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error('[appt feedback] delete unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFeedbacks, createFeedback, updateFeedback, deleteFeedback };