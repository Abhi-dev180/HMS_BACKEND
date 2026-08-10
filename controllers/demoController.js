
// // controllers/demoController.js
// const { supabase } = require('../config/supabase');
// const { sendDemoReceived, sendScheduleInvite } = require('../services/emailService');

// const TABLE = 'demo_bookings';

// // ─── Create a new demo booking (public) ──────────────────────
// const createBooking = async (req, res) => {
//   const { hospitalName, contactName, email, phone, city, beds } = req.body;

//   if (!hospitalName || !contactName || !email) {
//     return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
//   }

//   try {
//     // Generate a unique feedback token (you may already have this logic)
//     const token = require('crypto').randomBytes(16).toString('hex');

//     const { data, error } = await supabase
//       .from(TABLE)
//       .insert({
//         hospital_name: hospitalName,
//         contact_name: contactName,
//         email,
//         phone: phone || null,
//         city: city || null,
//         beds: beds || null,
//         feedback_token: token,
//         status: 'pending'
//       })
//       .select()
//       .single();

//     if (error) throw error;

//     // Send confirmation email
//     await sendDemoReceived({ to: email, contactName, hospitalName });

//     return res.status(201).json({
//       message: 'Demo booking created successfully',
//       booking: data,
//       feedbackToken: token
//     });
//   } catch (error) {
//     console.error('[demo] createBooking error:', error);
//     return res.status(500).json({ message: 'Could not create booking' });
//   }
// };

// // ─── List all demo bookings (superadmin only) ──────────────
// const listBookings = async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from(TABLE)
//       .select('*')
//       .order('created_at', { ascending: false });

//     if (error) throw error;
//     return res.json(data || []);
//   } catch (error) {
//     console.error('[demo] listBookings error:', error);
//     return res.status(500).json({ message: 'Could not fetch bookings' });
//   }
// };

// // ─── Invite to schedule (send scheduling link) ──────────────
// const inviteToSchedule = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { data: booking, error } = await supabase
//       .from(TABLE)
//       .select('*')
//       .eq('id', id)
//       .single();

//     if (error || !booking) {
//       return res.status(404).json({ message: 'Booking not found' });
//     }

//     // Send scheduling invite email
//     await sendScheduleInvite({
//       to: booking.email,
//       contactName: booking.contact_name,
//       hospitalName: booking.hospital_name,
//       token: booking.feedback_token
//     });

//     // Update status to invited
//     await supabase
//       .from(TABLE)
//       .update({ status: 'invited', updated_at: new Date().toISOString() })
//       .eq('id', id);

//     return res.json({ message: 'Invitation sent successfully' });
//   } catch (error) {
//     console.error('[demo] inviteToSchedule error:', error);
//     return res.status(500).json({ message: 'Could not send invitation' });
//   }
// };

// // ─── Update booking details (superadmin) ────────────────────
// const updateBooking = async (req, res) => {
//   const { id } = req.params;
//   const updates = req.body;

//   try {
//     const { data, error } = await supabase
//       .from(TABLE)
//       .update({ ...updates, updated_at: new Date().toISOString() })
//       .eq('id', id)
//       .select()
//       .single();

//     if (error) throw error;
//     if (!data) return res.status(404).json({ message: 'Booking not found' });

//     return res.json({ message: 'Booking updated successfully', booking: data });
//   } catch (error) {
//     console.error('[demo] updateBooking error:', error);
//     return res.status(500).json({ message: 'Could not update booking' });
//   }
// };

// // ─── Complete booking (mark as completed) ────────────────────
// const completeBooking = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data, error } = await supabase
//       .from(TABLE)
//       .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
//       .eq('id', id)
//       .select()
//       .single();

//     if (error) throw error;
//     if (!data) return res.status(404).json({ message: 'Booking not found' });

//     return res.json({ message: 'Booking completed successfully', booking: data });
//   } catch (error) {
//     console.error('[demo] completeBooking error:', error);
//     return res.status(500).json({ message: 'Could not complete booking' });
//   }
// };

// // ─── Delete booking (superadmin) ─────────────────────────────
// const deleteBooking = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { error } = await supabase
//       .from(TABLE)
//       .delete()
//       .eq('id', id);

//     if (error) throw error;

//     return res.json({ message: 'Booking deleted successfully' });
//   } catch (error) {
//     console.error('[demo] deleteBooking error:', error);
//     return res.status(500).json({ message: 'Could not delete booking' });
//   }
// };

// module.exports = {
//   createBooking,
//   listBookings,
//   inviteToSchedule,
//   updateBooking,
//   completeBooking,
//   deleteBooking   // ✅ now exported
// };



// const { supabase } = require('../config/supabase');
// const { sendDemoReceived, sendScheduleInvite, sendFeedbackRequest } = require('../services/emailService');

// const TABLE = 'demo_bookings';

// // ─── Create a new demo booking (public) ──────────────────────
// const createBooking = async (req, res) => {
//   const { hospitalName, contactName, email, phone, city, message, beds } = req.body;

//   if (!hospitalName || !contactName || !email) {
//     return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
//   }

//   try {
//     const token = require('crypto').randomBytes(16).toString('hex');

//     const insertData = {
//       hospital_name: hospitalName,
//       contact_name: contactName,
//       email,
//       phone: phone || null,
//       city: city || null,
//       feedback_token: token,
//       status: 'requested'
//     };
//     // Add message if provided (column exists)
//     if (message) insertData.message = message;

//     const { data, error } = await supabase
//       .from(TABLE)
//       .insert(insertData)
//       .select()
//       .single();

//     if (error) {
//       console.error('[demo] createBooking insert error:', error);
//       return res.status(500).json({ message: 'Could not create booking' });
//     }

//     // Send immediate email with scheduling link
//     await sendDemoReceived({
//       to: email,
//       contactName,
//       hospitalName,
//       token,
//       bookingId: data.id
//     });

//     return res.status(201).json({
//       message: 'Demo booking created successfully',
//       booking: data,
//       feedbackToken: token
//     });
//   } catch (error) {
//     console.error('[demo] createBooking error:', error);
//     return res.status(500).json({ message: 'Could not create booking' });
//   }
// };

// // ─── List all demo bookings (superadmin only) ──────────────
// const listBookings = async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from(TABLE)
//       .select('*, payments(*)')
//       .order('created_at', { ascending: false });

//     if (error) throw error;
    
//     // We need PLANS to map plan_key to plan names
//     const { PLANS } = require('../config/stripePlans');

//     const formattedData = await Promise.all((data || []).map(async booking => {
//       let paymentInfo = null;
//       if (booking.payments && booking.payments.length > 0) {
//         const payment = booking.payments.find(p => p.status === 'paid') || booking.payments[0];
//         const planKey = payment.plan_key;
//         let planName = planKey || '';
//         let interval = '';
        
//         if (planKey && PLANS && PLANS[planKey]) {
//            planName = PLANS[planKey].name || planKey;
//            interval = PLANS[planKey].intervalLabel || PLANS[planKey].interval || '';
//         }

//         paymentInfo = {
//           plan: planName,
//           interval,
//           amount: payment.amount,
//           currency: payment.currency,
//           status: payment.status
//         };

//         if (payment.subscription_id) {
//            const { data: sub } = await supabase.from('subscriptions').select('start_date, expiry_date').eq('id', payment.subscription_id).maybeSingle();
//            if (sub) {
//              paymentInfo.startDate = sub.start_date;
//              paymentInfo.endDate = sub.expiry_date;
//            }
//         }
//       }

//       const { payments, ...rest } = booking;
//       return {
//         ...rest,
//         payment: paymentInfo
//       };
//     }));

//     const counts = (data || []).reduce(
//       (acc, item) => {
//         acc.total += 1;
//         const status = item.status || 'requested';
//         if (acc[status] !== undefined) acc[status] += 1;
//         return acc;
//       },
//       { total: 0, requested: 0, invited: 0, scheduled: 0, completed: 0, cancelled: 0 }
//     );

//     return res.json({ bookings: formattedData, counts });
//   } catch (error) {
//     console.error('[demo] listBookings error:', error);
//     return res.status(500).json({ message: 'Could not fetch bookings' });
//   }
// };

// // ─── Invite to schedule (send scheduling link) ──────────────
// const inviteToSchedule = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { data: booking, error } = await supabase
//       .from(TABLE)
//       .select('*')
//       .eq('id', id)
//       .single();

//     if (error || !booking) {
//       return res.status(404).json({ message: 'Booking not found' });
//     }

//     await sendScheduleInvite({
//       to: booking.email,
//       contactName: booking.contact_name,
//       hospitalName: booking.hospital_name,
//       token: booking.feedback_token
//     });

//     await supabase
//       .from(TABLE)
//       .update({ status: 'invited', updated_at: new Date().toISOString() })
//       .eq('id', id);

//     return res.json({ message: 'Invitation sent successfully' });
//   } catch (error) {
//     console.error('[demo] inviteToSchedule error:', error);
//     return res.status(500).json({ message: 'Could not send invitation' });
//   }
// };

// // ─── Update booking details (superadmin) ────────────────────
// const updateBooking = async (req, res) => {
//   const { id } = req.params;
//   const updates = req.body;

//   try {
//     const { data, error } = await supabase
//       .from(TABLE)
//       .update({ ...updates, updated_at: new Date().toISOString() })
//       .eq('id', id)
//       .select()
//       .single();

//     if (error) throw error;
//     if (!data) return res.status(404).json({ message: 'Booking not found' });

//     return res.json({ message: 'Booking updated successfully', booking: data });
//   } catch (error) {
//     console.error('[demo] updateBooking error:', error);
//     return res.status(500).json({ message: 'Could not update booking' });
//   }
// };

// // ─── Complete booking (mark as completed) ────────────────────
// const completeBooking = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data, error } = await supabase
//       .from(TABLE)
//       .update({
//         status: 'completed',
//         completed_at: new Date().toISOString(),
//         updated_at: new Date().toISOString()
//       })
//       .eq('id', id)
//       .select()
//       .single();

//     if (error) {
//       // Fallback if 'completed_at' column missing
//       if (error.message && error.message.includes('completed_at')) {
//         const { data: fallbackData, error: fallbackError } = await supabase
//           .from(TABLE)
//           .update({
//             status: 'completed',
//             updated_at: new Date().toISOString()
//           })
//           .eq('id', id)
//           .select()
//           .single();
//         if (fallbackError) throw fallbackError;
//         // Send feedback request email
//         if (fallbackData?.email) {
//           await sendFeedbackRequest({
//             to: fallbackData.email,
//             contactName: fallbackData.contact_name,
//             token: fallbackData.feedback_token
//           }).catch(e => console.error('[demo] feedback request email failed:', e));
//         }
//         return res.json({ message: 'Booking completed successfully', booking: fallbackData });
//       }
//       throw error;
//     }

//     // Send feedback request email
//     if (data.email) {
//       await sendFeedbackRequest({
//         to: data.email,
//         contactName: data.contact_name,
//         token: data.feedback_token
//       }).catch(e => console.error('[demo] feedback request email failed:', e));
//     }

//     return res.json({ message: 'Booking completed successfully', booking: data });
//   } catch (error) {
//     console.error('[demo] completeBooking error:', error);
//     return res.status(500).json({ message: 'Could not complete booking' });
//   }
// };

// // ─── Delete booking (superadmin) ─────────────────────────────
// const deleteBooking = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { error } = await supabase
//       .from(TABLE)
//       .delete()
//       .eq('id', id);

//     if (error) throw error;

//     return res.json({ message: 'Booking deleted successfully' });
//   } catch (error) {
//     console.error('[demo] deleteBooking error:', error);
//     return res.status(500).json({ message: 'Could not delete booking' });
//   }
// };

// module.exports = {
//   createBooking,
//   listBookings,
//   inviteToSchedule,
//   updateBooking,
//   completeBooking,
//   deleteBooking
// };

const { supabase } = require('../config/supabase');
const { sendDemoReceived, sendScheduleInvite, sendFeedbackRequest } = require('../services/emailService');
const { broadcast } = require('../services/websocketService');

const TABLE = 'demo_bookings';

// ─── Create a new demo booking (public) ──────────────────────
const createBooking = async (req, res) => {
  const { hospitalName, contactName, email, phone, city, message, beds } = req.body;

  if (!hospitalName || !contactName || !email) {
    return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
  }

  try {
    const token = require('crypto').randomBytes(16).toString('hex');

    const insertData = {
      hospital_name: hospitalName,
      contact_name: contactName,
      email,
      phone: phone || null,
      city: city || null,
      feedback_token: token,
      status: 'requested'
    };
    // Add message if provided (column exists)
    if (message) insertData.message = message;

    const { data, error } = await supabase
      .from(TABLE)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[demo] createBooking insert error:', error);
      return res.status(500).json({ message: 'Could not create booking' });
    }

    // Send immediate email with scheduling link
    await sendDemoReceived({
      to: email,
      contactName,
      hospitalName,
      token,
      bookingId: data.id
    });

    broadcast('demo_created', data);
    return res.status(201).json({
      message: 'Demo booking created successfully',
      booking: data,
      feedbackToken: token
    });
  } catch (error) {
    console.error('[demo] createBooking error:', error);
    return res.status(500).json({ message: 'Could not create booking' });
  }
};

// ─── List all demo bookings (superadmin only) ──────────────
const listBookings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, payments(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // We need PLANS to map plan_key to plan names
    const { PLANS } = require('../config/stripePlans');

    const formattedData = await Promise.all((data || []).map(async booking => {
      let paymentInfo = null;
      if (booking.payments && booking.payments.length > 0) {
        const payment = booking.payments.find(p => p.status === 'paid') || booking.payments[0];
        const planKey = payment.plan_key;
        let planName = planKey || '';
        let interval = '';
        
        if (planKey && PLANS && PLANS[planKey]) {
           planName = PLANS[planKey].name || planKey;
           interval = PLANS[planKey].intervalLabel || PLANS[planKey].interval || '';
        }

        paymentInfo = {
          plan: planName,
          interval,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status
        };

        if (payment.subscription_id) {
           const { data: sub } = await supabase.from('subscriptions').select('start_date, expiry_date').eq('id', payment.subscription_id).maybeSingle();
           if (sub) {
             paymentInfo.startDate = sub.start_date;
             paymentInfo.endDate = sub.expiry_date;
           }
        }
      }

      const { payments, ...rest } = booking;
      return {
        ...rest,
        payment: paymentInfo
      };
    }));

    const counts = (data || []).reduce(
      (acc, item) => {
        acc.total += 1;
        const status = item.status || 'requested';
        if (acc[status] !== undefined) acc[status] += 1;
        return acc;
      },
      { total: 0, requested: 0, invited: 0, scheduled: 0, completed: 0, cancelled: 0 }
    );

    return res.json({ bookings: formattedData, counts });
  } catch (error) {
    console.error('[demo] listBookings error:', error);
    return res.status(500).json({ message: 'Could not fetch bookings' });
  }
};

// ─── Invite to schedule (send scheduling link) ──────────────
const inviteToSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: booking, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    await sendScheduleInvite({
      to: booking.email,
      contactName: booking.contact_name,
      hospitalName: booking.hospital_name,
      token: booking.feedback_token
    });

    const { data: updatedData } = await supabase
      .from(TABLE)
      .update({ status: 'invited', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    broadcast('demo_updated', updatedData);
    return res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('[demo] inviteToSchedule error:', error);
    return res.status(500).json({ message: 'Could not send invitation' });
  }
};

// ─── Update booking details (superadmin) ────────────────────
const updateBooking = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Booking not found' });

    broadcast('demo_updated', data);
    return res.json({ message: 'Booking updated successfully', booking: data });
  } catch (error) {
    console.error('[demo] updateBooking error:', error);
    return res.status(500).json({ message: 'Could not update booking' });
  }
};

// ─── Complete booking (mark as completed) ────────────────────
const completeBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Fallback if 'completed_at' column missing
      if (error.message && error.message.includes('completed_at')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from(TABLE)
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        // Send feedback request email
        if (fallbackData?.email) {
          await sendFeedbackRequest({
            to: fallbackData.email,
            contactName: fallbackData.contact_name,
            token: fallbackData.feedback_token
          }).catch(e => console.error('[demo] feedback request email failed:', e));
        }
        broadcast('demo_updated', fallbackData);
        return res.json({ message: 'Booking completed successfully', booking: fallbackData });
      }
      throw error;
    }

    // Send feedback request email
    if (data.email) {
      await sendFeedbackRequest({
        to: data.email,
        contactName: data.contact_name,
        token: data.feedback_token
      }).catch(e => console.error('[demo] feedback request email failed:', e));
    }

    broadcast('demo_updated', data);
    return res.json({ message: 'Booking completed successfully', booking: data });
  } catch (error) {
    console.error('[demo] completeBooking error:', error);
    return res.status(500).json({ message: 'Could not complete booking' });
  }
};

// ─── DELETE: Delete booking (superadmin) ─────────────────────
const deleteBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;

    broadcast('demo_deleted', { id });
    return res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('[demo] deleteBooking error:', error);
    return res.status(500).json({ message: 'Could not delete booking' });
  }
};

// ─── NEW: Cal.com Webhook to save the Zoom Link AND SEND EMAIL ──
const handleCalWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const zoomLink = payload.location; 
    const email = payload.email;
    const scheduledAt = payload.startTime;

    if (!zoomLink || !email) {
      return res.status(400).json({ message: 'Missing email or meeting link' });
    }

    // 1. Update the demo_bookings table, FORCE overwriting whatever is in meeting_link
    const { error, data } = await supabase
      .from(TABLE)
      .update({ 
        meeting_link: zoomLink, 
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('scheduled_at', new Date(scheduledAt).toISOString()) // Match by exact date/time instead of status
      .select()
      .single();

    if (error) {
      console.error('[demo] Webhook Update Error:', error);
      return res.status(500).json({ message: 'DB Update Failed' });
    }

    // 2. Trigger the EMAIL now that the Zoom link exists
    if (email && data) {
      const { sendDemoConfirmation } = require('../services/emailService');
      await sendDemoConfirmation({
        to: email,
        contactName: data.contact_name,
        hospitalName: data.hospital_name,
        scheduledAt: scheduledAt,
        meetingLink: zoomLink 
      }).catch(e => console.error('[demo] confirmation email failed:', e));
    }

    broadcast('demo_updated', data);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[demo] Webhook Error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  createBooking,
  listBookings,
  inviteToSchedule,
  updateBooking,
  completeBooking,
  deleteBooking,
  handleCalWebhook // <-- Export the webhook
};