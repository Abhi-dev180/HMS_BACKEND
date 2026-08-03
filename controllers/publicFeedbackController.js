const { supabase } = require('../config/supabase');

const submitPublicFeedback = async (req, res) => {
  const { hospitalId, rating, message, patientName, appointmentDate, petName } = req.body;

  if (!hospitalId || !rating || !message) {
    return res.status(400).json({ message: 'hospitalId, rating and message are required' });
  }

  try {
    // ✅ Use EXACT column names from your database (lowercase)
    const row = {
      hospitalid: hospitalId,
      patientname: patientName || 'Anonymous',   
      petname: petName || null,                  
      appointmenttype: 'Public Feedback',        
      date: appointmentDate || null,
      time: null,
      feedbackstatus: 'Published',               
      feedbackgiven: true,                       
      callattempted: false,                      
      callpicked: false,                         
      feedbacktext: message.trim(),              
      rating: Number(rating),
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