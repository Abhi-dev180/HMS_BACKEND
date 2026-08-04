// const { supabase } = require('../config/supabase');

// const submitPublicFeedback = async (req, res) => {
//   const { hospitalId, rating, message, patientName, appointmentDate, petName } = req.body;

//   if (!hospitalId || !rating || !message) {
//     return res.status(400).json({ message: 'hospitalId, rating and message are required' });
//   }

//   try {
//     const row = {
//       hospitalid: hospitalId,
//       patientname: patientName || 'Anonymous',   
//       petname: petName || null,                  
//       appointmenttype: 'Public Feedback',        
//       date: appointmentDate || null,
//       time: null,
//       feedbackstatus: 'Published',               
//       feedbackgiven: true,                       
//       callattempted: false,                      
//       callpicked: false,                         
//       feedbacktext: message.trim(),              
//       rating: Number(rating),
//       createdby: null,                           
//       created_at: new Date().toISOString()
//     };

//     const { data, error } = await supabase
//       .from('appointment_feedbacks')
//       .insert(row)
//       .select()
//       .single();

//     if (error) throw error;

//     return res.status(201).json({
//       message: 'Feedback submitted successfully!',
//       feedback: data
//     });
//   } catch (error) {
//     console.error('[public feedback] error:', error);
//     return res.status(500).json({ message: 'Could not submit feedback' });
//   }
// };

// module.exports = { submitPublicFeedback };




// controllers/publicFeedbackController.js
// const { supabase } = require('../config/supabase');

// const submitPublicFeedback = async (req, res) => {
//   const { appointmentNumber, rating, message, patientName, petName, date } = req.body;

//   // Validate required fields
//   if (!appointmentNumber || !rating || !message) {
//     return res.status(400).json({ message: 'Appointment number, rating and message are required' });
//   }

//   try {
//     // 1. Look up the appointment by its 4‑digit number
//     const { data: appt, error: apptErr } = await supabase
//       .from('appointments')
//       .select('id, hospitalId, patientName, petName, date, time')
//       .eq('appointment_number', Number(appointmentNumber))
//       .maybeSingle();

//     if (apptErr || !appt) {
//       return res.status(404).json({ message: 'Appointment not found' });
//     }

//     // 2. Check if feedback has already been submitted for this appointment
//     const { data: existing } = await supabase
//       .from('appointment_feedbacks')
//       .select('id')
//       .eq('appointment_id', appt.id)
//       .maybeSingle();
//     if (existing) {
//       return res.status(409).json({ message: 'Feedback already submitted for this appointment' });
//     }

//     // 3. Build the feedback record
//     const row = {
//       hospitalid: appt.hospitalId,
//       patientname: patientName || appt.patientName,
//       petname: petName || appt.petName,
//       appointmenttype: 'Consult',                  // could be fetched from appt if needed
//       date: date || appt.date,
//       time: appt.time || null,
//       feedbackstatus: 'Published',
//       feedbackgiven: true,
//       callattempted: false,
//       callpicked: false,
//       feedbacktext: message.trim(),
//       rating: Number(rating),
//       appointment_id: appt.id,                    // link to the appointment
//       createdby: null,
//       created_at: new Date().toISOString()
//     };

//     // 4. Insert the feedback
//     const { data, error } = await supabase
//       .from('appointment_feedbacks')
//       .insert(row)
//       .select()
//       .single();

//     if (error) throw error;

//     return res.status(201).json({
//       message: 'Feedback submitted successfully!',
//       feedback: data
//     });
//   } catch (error) {
//     console.error('[public feedback] error:', error);
//     return res.status(500).json({ message: 'Could not submit feedback' });
//   }
// };

// module.exports = { submitPublicFeedback };


// controllers/publicFeedbackController.js
const { supabase } = require('../config/supabase');

const submitPublicFeedback = async (req, res) => {
  console.log('✅ submitPublicFeedback called with body:', req.body);

  const { appointmentNumber, rating, message, patientName, petName, date } = req.body;

  if (!appointmentNumber || !rating || !message) {
    return res.status(400).json({ message: 'Appointment number, rating and message are required' });
  }

  try {
    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('id, hospitalId, patientName, petName, date, time')
      .eq('appointment_number', Number(appointmentNumber))
      .maybeSingle();

    if (apptErr || !appt) {
      console.error('Appointment lookup error:', apptErr);
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const { data: existing } = await supabase
      .from('appointment_feedbacks')
      .select('id')
      .eq('appointment_id', appt.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'Feedback already submitted for this appointment' });
    }

    const row = {
      hospitalid: appt.hospitalId,
      patientname: patientName || appt.patientName,
      petname: petName || appt.petName,
      appointmenttype: 'Consult',
      date: date || appt.date,
      time: appt.time || null,
      feedbackstatus: 'Published',
      feedbackgiven: true,
      callattempted: false,
      callpicked: false,
      feedbacktext: message.trim(),
      rating: Number(rating),
      appointment_id: appt.id,
      createdby: null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('appointment_feedbacks')
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: 'Feedback submitted successfully!',
      feedback: data
    });
  } catch (error) {
    console.error('[public feedback] error:', error);
    return res.status(500).json({ message: 'Could not submit feedback' });
  }
};

module.exports = { submitPublicFeedback };