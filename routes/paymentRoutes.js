const express = require('express');
const router = express.Router();

const { verifySession, verifyUpiPayment, webhook } = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');
const stripeSvc = require('../services/stripeService');
const { supabase } = require('../config/supabase');
const { PLANS, getPublicPlans } = require('../config/stripePlans');

// Helper: check if a string is a valid UUID
const isValidUUID = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Public — pricing page reads its plans from here (config/stripePlans.js)
router.get('/plans', (req, res) => res.json({ plans: getPublicPlans() }));

// Public verify route
router.get('/verify', verifySession);
router.post('/verify-upi', verifyUpiPayment);

// Stripe webhook – must be mounted with express.raw in app.js on this exact path
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// Admin-only: re-sync a Stripe session into payments/subscriptions (helpful for backfill)
router.post('/sync-session', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ message: 'session_id is required' });
    const result = await require('../controllers/paymentController').syncSession(session_id);
    return res.json(result);
  } catch (e) {
    console.error('[payments] sync-session error:', e);
    return res.status(500).json({ message: 'sync failed' });
  }
});

// ─── Create one‑time checkout session ────────────────────────
router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripeSvc.isConfigured()) {
      return res.status(503).json({ message: 'Stripe not configured' });
    }

    const { booking, feedbackToken, planKey } = req.body;

    // Validate required fields
    if (!booking) {
      return res.status(400).json({ message: 'booking is required' });
    }
    if (!booking.email) {
      return res.status(400).json({ message: 'booking.email is required' });
    }

    console.log('[payment] Creating checkout session:', {
      email: booking.email,
      hospital: booking.hospital_name,
      plan: planKey,
      feedbackToken
    });

    // ─── Get the real booking ID from the feedback token ───
    let bookingId = null;
    if (feedbackToken) {
      const { data: bookingData, error: bookingError } = await supabase
        .from('demo_bookings')
        .select('id')
        .eq('feedback_token', feedbackToken)
        .maybeSingle(); // use maybeSingle() to avoid error if not found
      if (!bookingError && bookingData) {
        bookingId = bookingData.id;
        console.log('[payment] Found booking ID from feedback token:', bookingId);
      } else {
        console.log('[payment] No booking found for feedback token:', feedbackToken);
      }
    }

    // If still null, try using the booking.id from the request if it's a valid UUID
    if (!bookingId && booking.id && isValidUUID(booking.id)) {
      bookingId = booking.id;
    }

    // Create the Stripe session
    const session = await stripeSvc.createOneTimeCheckout({
      booking,
      feedbackToken,
      planKey: planKey || 'basic'
    });

    // Insert a pending payment record with the correct booking_id
    const plan = PLANS[planKey] || PLANS['basic'];
    const { error: insertError } = await supabase.from('payments').insert({
      booking_id: bookingId,      // now uses the real booking ID (or null if not found)
      email: booking.email,
      stripe_session_id: session.id,
      plan_key: planKey || 'basic',
      amount: plan.amount,
      currency: 'usd',
      status: 'pending'
    });

    if (insertError) {
      console.error('[payments] insert error:', insertError);
    } else {
      console.log('[payments] Pending payment record inserted for session:', session.id, 'booking_id:', bookingId);
    }

    return res.json({
      id: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('[payments] create checkout error:', error);
    return res.status(500).json({
      message: error.message || 'Failed to create checkout session'
    });
  }
});

const { generateInvoice, generateAppointmentInvoice } = require('../services/invoiceService');
const { readDB, writeDB } = require('../models');
const emailSvc = require('../services/emailService');
const { broadcast } = require('../services/websocketService');

// ─── Create appointment checkout session (Stripe one-time test/consult fee) ───
router.post('/create-appointment-checkout', async (req, res) => {
  try {
    const { bookingDetails } = req.body || {};
    if (!bookingDetails) {
      return res.status(400).json({ message: 'bookingDetails is required' });
    }

    if (!stripeSvc.isConfigured()) {
      return res.status(533).json({ message: 'Stripe not configured' });
    }

    const isLab = bookingDetails.appointmentType === 'Lab Test' || Boolean(bookingDetails.serviceName);
    const amountInr = Number(bookingDetails.amount || bookingDetails.servicePrice || 500);
    const apptNumber = Math.floor(1000 + Math.random() * 9000);
    const apptId = bookingDetails.id ? String(bookingDetails.id) : Date.now().toString();

    // Prepare appointment record
    const appointmentRow = {
      id: apptId,
      userId: bookingDetails.userId || (req.user ? req.user.id : null),
      hospitalId: bookingDetails.hospitalId || '',
      hospital: bookingDetails.hospitalName || 'MEDPARK Hospital',
      doctorName: bookingDetails.doctorName || (isLab ? `Lab: ${bookingDetails.serviceName || 'Diagnostics'}` : 'Any Available Doctor'),
      date: bookingDetails.date || new Date().toISOString().split('T')[0],
      time: bookingDetails.time || '10:00',
      patientName: bookingDetails.patientName || 'Patient',
      patientPhone: bookingDetails.patientPhone || '',
      email: bookingDetails.email || '',
      reason: bookingDetails.reason || (isLab ? `Diagnostic Test: ${bookingDetails.serviceName}` : 'Consultation'),
      petName: bookingDetails.petName || '',
      species: bookingDetails.species || '',
      sex: bookingDetails.sex || '',
      breed: bookingDetails.breed || '',
      appointmentType: isLab ? 'Lab Test' : 'Consult',
      serviceId: bookingDetails.serviceId || null,
      serviceName: bookingDetails.serviceName || null,
      serviceCategory: bookingDetails.serviceCategory || null,
      servicePrice: bookingDetails.servicePrice ? Number(bookingDetails.servicePrice) : amountInr,
      sampleType: bookingDetails.sampleType || null,
      fastingRequired: Boolean(bookingDetails.fastingRequired),
      fastingDetails: bookingDetails.fastingDetails || '',
      turnaroundTime: bookingDetails.turnaroundTime || '',
      status: 'Pending',
      paymentStatus: 'Pending',
      paymentId: `ST_INIT_${Date.now()}`,
      paymentAmount: amountInr,
      paymentMethod: 'Stripe Card',
      appointment_number: apptNumber,
      createdAt: new Date().toISOString()
    };

    // Save appointment record (Supabase + local db.json)
    let saved = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('appointments').insert(appointmentRow).select().single();
        if (!error && data) saved = data;
      } catch (err) {
        console.warn('[payments] Supabase appointment insert warning:', err.message);
      }
    }

    if (!saved) {
      const db = readDB();
      db.appointments = db.appointments || [];
      db.appointments = db.appointments.filter(a => String(a.id) !== String(apptId));
      db.appointments.unshift(appointmentRow);
      writeDB(db);
      saved = appointmentRow;
    }

    // Create checkout session with Stripe
    const session = await stripeSvc.createAppointmentCheckoutSession({
      bookingDetails: {
        ...bookingDetails,
        hospitalName: appointmentRow.hospital,
        amount: amountInr
      },
      appointmentId: saved.id,
      appointmentNumber: saved.appointment_number
    });

    // Update appointment record with stripe_session_id
    if (supabase) {
      try {
        await supabase.from('appointments').update({ stripe_session_id: session.id }).eq('id', saved.id);
      } catch (_) {}
    }
    const db = readDB();
    const existing = (db.appointments || []).find(a => String(a.id) === String(saved.id));
    if (existing) {
      existing.stripe_session_id = session.id;
      writeDB(db);
    }

    return res.json({ id: session.id, url: session.url, appointmentId: saved.id, appointmentNumber: saved.appointment_number });
  } catch (error) {
    console.error('[payments] appointment checkout error:', error);
    return res.status(500).json({ message: error.message || 'Failed to create appointment checkout session' });
  }
});

// ─── Verify appointment checkout session (Stripe return) ───────
router.get('/verify-appointment-session', async (req, res) => {
  try {
    const { session_id, appointment_id, payment } = req.query || {};

    if (!session_id && !appointment_id) {
      return res.status(400).json({ message: 'session_id or appointment_id is required' });
    }

    let session = null;
    let isPaid = false;

    if (session_id && stripeSvc.isConfigured()) {
      try {
        session = await stripeSvc.retrieveSession(session_id);
        isPaid = session.payment_status === 'paid';
      } catch (err) {
        console.error('[payments] verify retrieveSession error:', err.message);
      }
    } else if (payment === 'success') {
      isPaid = true;
    }

    // Find appointment by id or stripe_session_id or metadata
    const targetId = appointment_id || session?.metadata?.appointmentId;
    let appointment = null;

    if (supabase) {
      try {
        let q = supabase.from('appointments').select('*');
        if (targetId) q = q.eq('id', targetId);
        else if (session_id) q = q.eq('stripe_session_id', session_id);
        const { data } = await q.maybeSingle();
        if (data) appointment = data;
      } catch (e) {
        console.warn('[payments] Supabase appointment lookup error:', e.message);
      }
    }

    if (!appointment) {
      const db = readDB();
      appointment = (db.appointments || []).find(
        (a) =>
          (targetId && String(a.id) === String(targetId)) ||
          (session_id && a.stripe_session_id === session_id) ||
          (session?.metadata?.appointmentNumber && String(a.appointment_number) === String(session.metadata.appointmentNumber))
      );
    }

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const now = new Date().toISOString();

    if (isPaid) {
      const wasAlreadyPaid = String(appointment.paymentStatus).toLowerCase() === 'paid';

      appointment.paymentStatus = 'Paid';
      appointment.paymentMethod = 'Stripe Card';
      appointment.paymentId = session?.payment_intent || session?.id || appointment.paymentId || `ST_${Date.now()}`;
      appointment.updatedAt = now;

      // Update in Supabase
      if (supabase) {
        try {
          await supabase
            .from('appointments')
            .update({
              paymentStatus: 'Paid',
              paymentMethod: appointment.paymentMethod,
              paymentId: appointment.paymentId,
              updatedAt: now
            })
            .eq('id', appointment.id);
        } catch (_) {}
      }

      // Update in db.json
      const db = readDB();
      const idx = (db.appointments || []).findIndex((a) => String(a.id) === String(appointment.id));
      if (idx !== -1) {
        db.appointments[idx] = { ...db.appointments[idx], ...appointment };
        writeDB(db);
      }

      // Send customized PDF invoice on mail (only once if not already sent)
      if (!wasAlreadyPaid && appointment.email) {
        try {
          const pdfBuffer = await generateAppointmentInvoice(appointment);
          await emailSvc.sendAppointmentInvoiceEmail({
            to: appointment.email,
            appointment,
            invoicePdfBuffer: pdfBuffer,
            isSuccess: true
          });
          console.log(`[payments] ✅ Customized PDF invoice sent to: ${appointment.email} for appointment #${appointment.appointment_number}`);
        } catch (mailErr) {
          console.error('[payments] Error sending appointment invoice email:', mailErr);
        }
      }

      broadcast('appointment_updated', appointment);
      return res.json({ success: true, paid: true, appointment });
    } else {
      // Payment incomplete, cancelled, or failed
      if (String(appointment.paymentStatus).toLowerCase() === 'pending') {
        appointment.paymentStatus = 'Failed';
        appointment.updatedAt = now;

        if (supabase) {
          try {
            await supabase.from('appointments').update({ paymentStatus: 'Failed', updatedAt: now }).eq('id', appointment.id);
          } catch (_) {}
        }

        const db = readDB();
        const idx = (db.appointments || []).findIndex((a) => String(a.id) === String(appointment.id));
        if (idx !== -1) {
          db.appointments[idx] = { ...db.appointments[idx], ...appointment };
          writeDB(db);
        }

        if (appointment.email) {
          try {
            await emailSvc.sendAppointmentPaymentFailedEmail({
              to: appointment.email,
              appointment,
              reason: 'Payment transaction was cancelled or declined by your card issuer.'
            });
            console.log(`[payments] ⚠️ Payment failed notification sent to: ${appointment.email}`);
          } catch (failMailErr) {
            console.error('[payments] Error sending payment failure email:', failMailErr);
          }
        }
      }

      return res.json({ success: false, paid: false, appointment, message: 'Payment incomplete or cancelled' });
    }
  } catch (error) {
    console.error('[payments] verify appointment session error:', error);
    return res.status(500).json({ message: error.message || 'Failed to verify appointment checkout session' });
  }
});

// ─── PayPal Routes ─────────────────────────────────────────────
const paypalSvc = require('../services/paypalService');
const razorpaySvc = require('../services/razorpayService');

router.post('/paypal/create-order', async (req, res) => {
  try {
    const { booking, planKey, returnUrl, cancelUrl } = req.body;
    
    // Prevent double payments
    if (booking?.id && isValidUUID(booking.id)) {
      const { data: dbPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('booking_id', booking.id)
        .eq('status', 'paid')
        .maybeSingle();
      if (dbPayment) {
        return res.status(400).json({ message: 'Payment already completed for this booking' });
      }
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const order = await paypalSvc.createOrder({ booking, planKey, amount: plan.amount, returnUrl, cancelUrl });
    
    if (booking?.id && isValidUUID(booking.id)) {
      await supabase.from('payments').insert({
        booking_id: booking.id,
        email: booking.email || 'customer@example.com',
        paypal_order_id: order.id,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'pending'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('[PayPal] create order error:', error);
    res.status(500).json({ message: 'Failed to create PayPal order' });
  }
});

router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { orderId, booking, planKey } = req.body;
    const capture = await paypalSvc.captureOrder(orderId);
    const plan = PLANS[planKey] || PLANS['basic'];

    // Mark as completed in DB
    let updatedDemo = null;
    let validBookingId = booking?.id && isValidUUID(booking.id) ? booking.id : null;

    if (validBookingId) {
      const { data } = await supabase
        .from("demo_bookings")
        .update({
          status: "completed",
          stripe_invoice_id: capture.id, // using capture ID as transaction/billing ID
          amount: plan.amount,
          currency: 'usd',
          updated_at: new Date().toISOString(),
        })
        .eq("id", validBookingId)
        .select()
        .single();
      
      updatedDemo = data;
    }

    // Update record in payments table so SuperAdmin UI sees it
    const { data: updatedPay, error: updErr } = await supabase.from('payments').update({
      stripe_session_id: capture.id,
      status: 'paid'
    }).eq('booking_id', validBookingId).select();
    
    if (updErr) console.error('[PayPal] Payment update error:', updErr);

    // Fallback: If no pending payment existed to update, insert a new one
    if (!updatedPay || updatedPay.length === 0) {
      await supabase.from('payments').insert({
        booking_id: validBookingId,
        email: booking?.email || 'customer@example.com',
        stripe_session_id: capture.id,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'paid'
      });
    }

    const startDate = new Date().toLocaleDateString();
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString();

    // Generate Invoice
    const invoicePdfBuffer = await generateInvoice({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'PayPal',
      transactionId: capture.id,
      date: new Date().toLocaleDateString(),
      startDate,
      endDate
    });

    // Send Invoice Email to Customer
    await emailSvc.sendInvoicePaidEmail({
      to: booking.email,
      contactName: booking.contact_name || 'User',
      hospitalName: booking.hospital_name || 'Hospital',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'PayPal',
      invoiceId: capture.id,
      startDate,
      endDate,
      invoicePdfBuffer
    });

    // Notify Superadmin
    await emailSvc.sendPaymentReceivedToSuperAdmin({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      email: booking.email || 'customer@example.com',
      phone: booking.phone || '',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'PayPal',
      invoiceId: capture.id,
      startDate,
      endDate
    });

    if (updatedDemo) {
      broadcast('demo_updated', updatedDemo);
    }

    res.json({ success: true, capture });
  } catch (error) {
    console.error('[PayPal] capture order error:', error);
    res.status(500).json({ message: 'Failed to capture PayPal order' });
  }
});

// ─── Razorpay Routes ───────────────────────────────────────────
router.post('/razorpay/create-order', async (req, res) => {
  try {
    const { booking, planKey } = req.body;

    // Prevent double payments
    if (booking?.id && isValidUUID(booking.id)) {
      const { data: dbPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('booking_id', booking.id)
        .eq('status', 'paid')
        .maybeSingle();
      if (dbPayment) {
        return res.status(400).json({ message: 'Payment already completed for this booking' });
      }
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const order = await razorpaySvc.createOrder({ booking, planKey, amount: plan.amount });
    
    if (booking?.id && isValidUUID(booking.id)) {
      await supabase.from('payments').insert({
        booking_id: booking.id,
        email: booking.email || 'customer@example.com',
        razorpay_order_id: order.id,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'pending'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('[Razorpay] create order error:', error);
    res.status(500).json({ message: 'Failed to create Razorpay order' });
  }
});

router.post('/razorpay/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking, planKey } = req.body;
    
    const isValid = razorpaySvc.verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const transactionId = razorpay_payment_id || `DUMMY_${Date.now()}`;

    // Mark as completed in DB
    let updatedDemo = null;
    let validBookingId = booking?.id && isValidUUID(booking.id) ? booking.id : null;

    if (validBookingId) {
      const { data } = await supabase
        .from("demo_bookings")
        .update({
          status: "completed",
          stripe_invoice_id: transactionId, 
          amount: plan.amount,
          currency: 'usd',
          updated_at: new Date().toISOString(),
        })
        .eq("id", validBookingId)
        .select()
        .single();
        
      updatedDemo = data;
    }

    // Update record in payments table so SuperAdmin UI sees it
    const { data: updatedPay, error: updErr } = await supabase.from('payments').update({
      stripe_session_id: transactionId,
      status: 'paid'
    }).eq('booking_id', validBookingId).select();
    
    if (updErr) console.error('[Razorpay] Payment update error:', updErr);

    // Fallback: If no pending payment existed to update, insert a new one
    if (!updatedPay || updatedPay.length === 0) {
      await supabase.from('payments').insert({
        booking_id: validBookingId,
        email: booking?.email || 'customer@example.com',
        stripe_session_id: transactionId,
        plan_key: planKey || 'basic',
        amount: plan.amount,
        currency: 'usd',
        status: 'paid'
      });
    }

    const startDate = new Date().toLocaleDateString();
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString();

    // Generate Invoice
    const invoicePdfBuffer = await generateInvoice({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'Razorpay UPI',
      transactionId,
      date: new Date().toLocaleDateString(),
      startDate,
      endDate
    });

    // Send Invoice Email to Customer
    await emailSvc.sendInvoicePaidEmail({
      to: booking.email,
      contactName: booking.contact_name || 'User',
      hospitalName: booking.hospital_name || 'Hospital',
      phone: booking.phone || '',
      email: booking.email || 'customer@example.com',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'Razorpay UPI',
      invoiceId: transactionId,
      startDate,
      endDate,
      invoicePdfBuffer
    });

    // Notify Superadmin
    await emailSvc.sendPaymentReceivedToSuperAdmin({
      hospitalName: booking.hospital_name || 'Hospital',
      contactName: booking.contact_name || 'User',
      email: booking.email || 'customer@example.com',
      phone: booking.phone || '',
      planName: plan.name,
      amount: plan.amount,
      paymentMethod: 'Razorpay UPI',
      invoiceId: transactionId,
      startDate,
      endDate
    });

    if (updatedDemo) {
      broadcast('demo_updated', updatedDemo);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Razorpay] verify payment error:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
});

// ─── Cashfree Routes ───────────────────────────────────────────
const cashfreeSvc = require('../services/cashfreeService');

router.post('/cashfree/create-order', async (req, res) => {
  try {
    const { booking, planKey, amount } = req.body;
    
    if (booking?.id && isValidUUID(booking.id)) {
      const { data: dbPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('booking_id', booking.id)
        .eq('status', 'paid')
        .maybeSingle();
      if (dbPayment) {
        return res.status(400).json({ message: 'Payment already completed for this booking' });
      }
    }

    const plan = PLANS[planKey] || PLANS['basic'];
    const finalAmount = amount || plan.amount;
    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const order = await cashfreeSvc.createOrder(orderId, finalAmount, {
        id: booking?.id || `CUST_${Date.now()}`,
        name: booking?.contact_name || "Customer",
        email: booking?.email || "customer@example.com",
        phone: booking?.phone || "9999999999"
    });
    
    if (booking?.id && isValidUUID(booking.id)) {
      await supabase.from('payments').insert({
        booking_id: booking.id,
        email: booking.email || 'customer@example.com',
        stripe_session_id: orderId,
        plan_key: planKey || 'basic',
        amount: finalAmount,
        currency: 'inr',
        status: 'pending'
      });
    }

    res.json({ payment_session_id: order.payment_session_id, order_id: orderId });
  } catch (error) {
    console.error('[Cashfree] create order error:', error);
    res.status(500).json({ message: 'Failed to create Cashfree order' });
  }
});

router.post('/cashfree/verify-payment', async (req, res) => {
    try {
        const { order_id, booking, planKey } = req.body;
        const orderData = await cashfreeSvc.getOrder(order_id);
        
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ message: 'Payment not successful yet' });
        }

        const plan = PLANS[planKey] || PLANS['basic'];
        const transactionId = orderData.order_id;
        
        let updatedDemo = null;
        let validBookingId = booking?.id && isValidUUID(booking.id) ? booking.id : null;

        if (validBookingId) {
          const { data } = await supabase
            .from("demo_bookings")
            .update({
              status: "completed",
              stripe_invoice_id: transactionId, 
              amount: plan.amount,
              currency: 'inr',
              updated_at: new Date().toISOString(),
            })
            .eq("id", validBookingId)
            .select()
            .single();
            
          updatedDemo = data;
        }

        const { data: updatedPay, error: updErr } = await supabase.from('payments').update({
          status: 'paid'
        }).eq('booking_id', validBookingId).select();
        
        if (!updatedPay || updatedPay.length === 0) {
          await supabase.from('payments').insert({
            booking_id: validBookingId,
            email: booking?.email || 'customer@example.com',
            stripe_session_id: transactionId,
            plan_key: planKey || 'basic',
            amount: plan.amount,
            currency: 'inr',
            status: 'paid'
          });
        }

        const startDate = new Date().toLocaleDateString();
        const endDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString();

        if(booking?.email) {
            try {
                const invoicePdfBuffer = await generateInvoice({
                  hospitalName: booking?.hospital_name || 'Hospital',
                  contactName: booking?.contact_name || 'User',
                  phone: booking?.phone || '',
                  email: booking?.email || 'customer@example.com',
                  planName: plan.name,
                  amount: plan.amount,
                  paymentMethod: 'Cashfree',
                  transactionId,
                  date: new Date().toLocaleDateString(),
                  startDate,
                  endDate
                });

                await emailSvc.sendInvoicePaidEmail({
                  to: booking?.email,
                  contactName: booking?.contact_name || 'User',
                  hospitalName: booking?.hospital_name || 'Hospital',
                  phone: booking?.phone || '',
                  email: booking?.email || 'customer@example.com',
                  planName: plan.name,
                  amount: plan.amount,
                  paymentMethod: 'Cashfree',
                  invoiceId: transactionId,
                  startDate,
                  endDate,
                  invoicePdfBuffer
                });
            } catch(e) {
                console.error("Cashfree invoice email err:", e);
            }
        }

        if (updatedDemo) {
          broadcast('demo_updated', updatedDemo);
        }

        res.json({ success: true, status: orderData.order_status });
    } catch (error) {
        console.error('[Cashfree] verify payment error:', error);
        res.status(500).json({ message: 'Failed to verify Cashfree payment' });
    }
});

module.exports = router;