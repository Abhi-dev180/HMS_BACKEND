// // controllers/scheduleController.js
// const { supabase } = require('../config/supabase');
// const { sendDemoConfirmation, sendMeetingLink } = require('../services/emailService');
// const scheduler = require('../services/schedulerService');
// const calcom = require('../services/calcomService');

// const TABLE = 'demo_bookings';

// const takenSlots = async (excludeId) => {
//   let q = supabase.from(TABLE).select('scheduled_at').eq('status', 'scheduled').not('scheduled_at', 'is', null);
//   if (excludeId) q = q.neq('id', excludeId);
//   const { data } = await q;
//   return (data || []).map((r) => r.scheduled_at);
// };

// // GET /api/schedule/:token – show booking details and available slots
// const getScheduleInfo = async (req, res) => {
//   const { token } = req.params;
//   const { data: booking, error } = await supabase
//     .from(TABLE)
//     .select('*')
//     .eq('feedback_token', token)
//     .single();

//   if (error || !booking) {
//     return res.status(404).json({ message: 'Invalid or expired scheduling link' });
//   }

//   let slots = [];
//   let provider = 'local';

//   if (calcom.isConfigured()) {
//     try {
//       slots = await calcom.getSlotGrid();
//       provider = 'calcom';
//     } catch (e) {
//       console.error('[schedule] calcom slots failed, falling back to local:', e.message);
//       const taken = await takenSlots(booking.id);
//       slots = scheduler.slotsWithStatus(taken);
//     }
//   } else {
//     const taken = await takenSlots(booking.id);
//     slots = scheduler.slotsWithStatus(taken);
//   }

//   return res.json({
//     booking: {
//       id: booking.id,
//       hospitalName: booking.hospital_name,
//       contactName: booking.contact_name,
//       email: booking.email,
//       status: booking.status,
//       scheduledAt: booking.scheduled_at,
//       meetingLink: booking.meeting_link
//     },
//     slots,
//     provider
//   });
// };

// // POST /api/schedule/:token – book a slot
// const bookSlot = async (req, res) => {
//   const { token } = req.params;
//   const { slot, scheduledAt } = req.body; // ISO string (frontend sends 'slot')
  
//   const chosenSlot = slot || scheduledAt;

//   if (!chosenSlot) {
//     return res.status(400).json({ message: 'A slot is required' });
//   }

//   const { data: booking, error } = await supabase
//     .from(TABLE)
//     .select('*')
//     .eq('feedback_token', token)
//     .single();

//   if (error || !booking) {
//     return res.status(404).json({ message: 'Invalid or expired scheduling link' });
//   }

//   if (booking.status === 'scheduled' || booking.status === 'completed') {
//     return res.status(409).json({ message: 'This demo is already scheduled.' });
//   }

//   let finalScheduledAt = new Date(chosenSlot).toISOString();
//   let meetingLink = null;

//   if (calcom.isConfigured()) {
//     try {
//       const cb = await calcom.createBooking({ start: chosenSlot, name: booking.contact_name, email: booking.email });
//       meetingLink = cb.meetingUrl;
//       if (cb.start) finalScheduledAt = new Date(cb.start).toISOString();
//     } catch (e) {
//       console.error('[schedule] calcom booking failed:', e.message);
//       return res.status(409).json({ message: 'That time is no longer available. Please pick another slot.' });
//     }
//   } else {
//     const taken = await takenSlots(booking.id);
//     if (!scheduler.isSlotValid(chosenSlot, taken)) {
//       return res.status(409).json({ message: 'That time is no longer available. Please pick another slot.' });
//     }
//   }

//   // Update the booking with scheduled time and status
//   const { data: updated, error: updateErr } = await supabase
//     .from(TABLE)
//     .update({
//       scheduled_at: finalScheduledAt,
//       meeting_link: meetingLink,
//       status: 'scheduled',
//       updated_at: new Date().toISOString(),
//     })
//     .eq('id', booking.id)
//     .select()
//     .single();

//   if (updateErr) {
//     console.error('[schedule] bookSlot error:', updateErr);
//     return res.status(500).json({ message: 'Could not book the slot' });
//   }

//   // ✅ Send confirmation email with meeting link (if already set)
//   if (booking.email) {
//     const meetingLinkForEmail = updated.meeting_link || null;
//     console.log('[schedule] Sending confirmation email to:', booking.email, 'meetingLink:', meetingLinkForEmail);
//     await sendDemoConfirmation({
//       to: booking.email,
//       contactName: booking.contact_name,
//       hospitalName: booking.hospital_name,
//       scheduledAt: updated.scheduled_at,
//       meetingLink: meetingLinkForEmail,
//     })
//       .then(result => console.log('[schedule] Confirmation email result:', result))
//       .catch(e => console.error('[schedule] Confirmation email failed:', e));
//   } else {
//     console.warn('[schedule] No email address found for booking:', booking.id);
//   }

//   return res.json({
//     message: 'Demo scheduled successfully',
//     booking: updated,
//   });
// };

// module.exports = { getScheduleInfo, bookSlot };


// POST /api/schedule/:token – book a slot
// const bookSlot = async (req, res) => {
//   const { token } = req.params;
//   const { slot, scheduledAt } = req.body;
  
//   const chosenSlot = slot || scheduledAt;

//   if (!chosenSlot) {
//     return res.status(400).json({ message: 'A slot is required' });
//   }

//   const { data: booking, error } = await supabase
//     .from(TABLE)
//     .select('*')
//     .eq('feedback_token', token)
//     .single();

//   if (error || !booking) {
//     return res.status(404).json({ message: 'Invalid or expired scheduling link' });
//   }

//   if (booking.status === 'scheduled' || booking.status === 'completed') {
//     return res.status(409).json({ message: 'This demo is already scheduled.' });
//   }

//   let finalScheduledAt = new Date(chosenSlot).toISOString();
//   let meetingLink = null;

//   if (calcom.isConfigured()) {
//     try {
//       const cb = await calcom.createBooking({ start: chosenSlot, name: booking.contact_name, email: booking.email });
      
//       // ✅ FIX: Handle the meeting link cleanly
//       let rawMeetingLink = cb.meetingUrl;
      
//       if (!rawMeetingLink || rawMeetingLink.includes('integrations:')) {
//         console.warn('[schedule] Cal.com returned placeholder. Generating fallback Google Meet link.');
//         const rawId = cb.uid ? cb.uid.replace(/-/g, '') : Date.now().toString();
//         const part1 = rawId.substring(0, 3);
//         const part2 = rawId.substring(3, 7);
//         const part3 = rawId.substring(7, 10);
//         const meetCode = `${part1}-${part2}-${part3}`;
//         rawMeetingLink = `https://meet.google.com/${meetCode}`;
//       }
      
//       meetingLink = rawMeetingLink;
      
//       if (cb.start) finalScheduledAt = new Date(cb.start).toISOString();
//     } catch (e) {
//       console.error('[schedule] calcom booking failed:', e.message);
//       return res.status(409).json({ message: 'That time is no longer available. Please pick another slot.' });
//     }
//   } else {
//     const taken = await takenSlots(booking.id);
//     if (!scheduler.isSlotValid(chosenSlot, taken)) {
//       return res.status(409).json({ message: 'That time is no longer available. Please pick another slot.' });
//     }
//   }

//   // Update booking
//   const { data: updated, error: updateErr } = await supabase
//     .from(TABLE)
//     .update({
//       scheduled_at: finalScheduledAt,
//       meeting_link: meetingLink,
//       status: 'scheduled',
//       updated_at: new Date().toISOString(),
//     })
//     .eq('id', booking.id)
//     .select()
//     .single();

//   // ✅ FIX: Handle duplicate slot error (23505) gracefully
//   if (updateErr) {
//     console.error('[schedule] bookSlot error:', updateErr);
//     if (updateErr.code === '23505') {
//       return res.status(409).json({ 
//         message: 'This time slot was just taken by someone else. Please pick another slot.' 
//       });
//     }
//     return res.status(500).json({ message: 'Could not book the slot' });
//   }

//   // Send confirmation email
//   if (booking.email) {
//     const meetingLinkForEmail = updated.meeting_link || null;
//     console.log('[schedule] Sending confirmation email to:', booking.email, 'meetingLink:', meetingLinkForEmail);
//     await sendDemoConfirmation({
//       to: booking.email,
//       contactName: booking.contact_name,
//       hospitalName: booking.hospital_name,
//       scheduledAt: updated.scheduled_at,
//       meetingLink: meetingLinkForEmail,
//     })
//       .then(result => console.log('[schedule] Confirmation email result:', result))
//       .catch(e => console.error('[schedule] Confirmation email failed:', e));
//   }

//   return res.json({
//     message: 'Demo scheduled successfully',
//     booking: updated,
//   });
// };


// controllers/scheduleController.js
const { supabase } = require('../config/supabase');
const { sendDemoConfirmation, sendMeetingLink } = require('../services/emailService');
const scheduler = require('../services/schedulerService');
const calcom = require('../services/calcomService');

const TABLE = 'demo_bookings';

const takenSlots = async (excludeId) => {
  let q = supabase.from(TABLE).select('scheduled_at').eq('status', 'scheduled').not('scheduled_at', 'is', null);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q;
  return (data || []).map((r) => r.scheduled_at);
};

// GET /api/schedule/:token – show booking details and available slots
const getScheduleInfo = async (req, res) => {
  const { token } = req.params;
  const { data: booking, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('feedback_token', token)
    .single();

  if (error || !booking) {
    return res.status(404).json({ message: 'Invalid or expired scheduling link' });
  }

  let slots = [];
  let provider = 'local';

  // ✅ Get all taken slots from database (excluding current booking if any)
  const taken = await takenSlots(booking.id);
  const takenMs = new Set(taken.map(t => new Date(t).getTime()));

  // ✅ Get current time to filter out past slots
  const now = new Date();
  const nowMs = now.getTime();

  if (calcom.isConfigured()) {
    try {
      slots = await calcom.getSlotGrid();
      provider = 'calcom';
      
      // ✅ Filter out past slots and mark taken slots as red
      slots = slots
        .filter(s => {
          const slotTime = new Date(s.iso).getTime();
          return slotTime > nowMs; // Remove past slots
        })
        .map(s => {
          const timeMs = new Date(s.iso).getTime();
          return {
            ...s,
            taken: s.taken || takenMs.has(timeMs) // Mark as taken if in Cal.com OR in our database
          };
        });
    } catch (e) {
      console.error('[schedule] calcom slots failed, falling back to local:', e.message);
      slots = scheduler.slotsWithStatus(taken)
        .filter(s => {
          const slotTime = new Date(s.iso).getTime();
          return slotTime > nowMs;
        });
    }
  } else {
    slots = scheduler.slotsWithStatus(taken)
      .filter(s => {
        const slotTime = new Date(s.iso).getTime();
        return slotTime > nowMs;
      });
  }

  return res.json({
    booking: {
      id: booking.id,
      hospitalName: booking.hospital_name,
      contactName: booking.contact_name,
      email: booking.email,
      status: booking.status,
      scheduledAt: booking.scheduled_at,
      meetingLink: booking.meeting_link,
      phone: booking.phone,
      city: booking.city,
      message: booking.message,
      beds: booking.beds
    },
    slots,
    provider
  });
};

// POST /api/schedule/:token – book a slot
const bookSlot = async (req, res) => {
  const { token } = req.params;
  const { slot, scheduledAt } = req.body;
  const chosenSlot = slot || scheduledAt;

  if (!chosenSlot) {
    return res.status(400).json({ message: 'A slot is required' });
  }

  // ✅ Check if the chosen slot is in the past
  const slotTime = new Date(chosenSlot).getTime();
  const now = Date.now();
  if (slotTime <= now) {
    return res.status(400).json({ 
      message: 'This time slot has already passed. Please choose a future time.' 
    });
  }

  const { data: booking, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('feedback_token', token)
    .single();

  if (error || !booking) {
    return res.status(404).json({ message: 'Invalid or expired scheduling link' });
  }

  if (booking.status === 'scheduled' || booking.status === 'completed') {
    return res.status(409).json({ message: 'This demo is already scheduled.' });
  }

  let finalScheduledAt = new Date(chosenSlot).toISOString();
  let meetingLink = null;

  // ✅ Double booking prevention check
  const { data: existingBookings, error: checkErr } = await supabase
    .from(TABLE)
    .select('id')
    .eq('scheduled_at', finalScheduledAt)
    .eq('status', 'scheduled');

  if (existingBookings && existingBookings.length > 0) {
    return res.status(409).json({ message: 'This time slot has already been booked. Please choose another slot.' });
  }

  // ✅ Prepare booking details with ALL user information for Google Calendar
  const bookingDetails = {
    hospitalName: booking.hospital_name || '',
    contactName: booking.contact_name || '',
    phone: booking.phone || '',
    city: booking.city || '',
    message: booking.message || '',
    beds: booking.beds || '',
    email: booking.email || ''
  };

  if (calcom.isConfigured()) {
    try {
      const cb = await calcom.createBooking({ 
        start: chosenSlot, 
        name: booking.contact_name, 
        email: booking.email,
        bookingDetails: bookingDetails // ✅ Pass all booking details
      });
      
      meetingLink = cb.meetingUrl;
      console.log('[schedule] Meeting link generated:', meetingLink);
      
      if (cb.start) finalScheduledAt = new Date(cb.start).toISOString();
    } catch (e) {
      console.error('[schedule] calcom booking failed:', e.message);
      return res.status(409).json({ 
        message: 'That time is no longer available. Please pick another slot.' 
      });
    }
  } else {
    const taken = await takenSlots(booking.id);
    if (!scheduler.isSlotValid(chosenSlot, taken)) {
      return res.status(409).json({ 
        message: 'That time is no longer available. Please pick another slot.' 
      });
    }
  }

  // Update the booking
  const { data: updated, error: updateErr } = await supabase
    .from(TABLE)
    .update({
      scheduled_at: finalScheduledAt,
      meeting_link: meetingLink,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .select()
    .single();

  if (updateErr) {
    console.error('[schedule] bookSlot error:', updateErr);
    if (updateErr.code === '23505') {
      return res.status(409).json({ 
        message: 'This time slot was just taken by someone else. Please pick another slot.' 
      });
    }
    return res.status(500).json({ message: 'Could not book the slot' });
  }

  // Send confirmation email with ALL meeting details
  if (booking.email && updated.meeting_link) {
    console.log('[schedule] Sending confirmation email to:', booking.email);
    console.log('[schedule] Meeting link:', updated.meeting_link);
    
    // ✅ Include all meeting details
    const meetingDetails = {
      meetingLink: updated.meeting_link,
      scheduledAt: updated.scheduled_at,
      duration: '30 minutes',
      meetingId: updated.id,
      contactName: booking.contact_name,
      hospitalName: booking.hospital_name,
      email: booking.email,
      phone: booking.phone,
      city: booking.city,
      message: booking.message,
      beds: booking.beds
    };
    
    sendDemoConfirmation({
      to: booking.email,
      contactName: booking.contact_name,
      hospitalName: booking.hospital_name,
      scheduledAt: updated.scheduled_at,
      meetingLink: updated.meeting_link,
      meetingDetails: meetingDetails // ✅ Pass all details to email
    })
      .then(result => console.log('[schedule] Confirmation email sent successfully'))
      .catch(e => console.error('[schedule] Confirmation email failed:', e));
  }

  return res.json({
    message: 'Demo scheduled successfully',
    booking: updated,
  });
};

module.exports = { getScheduleInfo, bookSlot };