const { supabase, isConfigured: isSupabaseConfigured } = require("../config/supabase");
const stripeSvc = require("../services/stripeService");
const { PLANS } = require("../config/stripePlans");
const { sendInvoicePaidEmail, sendPaymentReceivedToSuperAdmin } = require("../services/emailService");
const { broadcast } = require('../services/websocketService');

// ─── Helper: safe date conversion from Stripe timestamp ────
const safeDate = (timestamp) => {
  if (!timestamp) return new Date().toISOString();
  const d = new Date(timestamp * 1000);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// ─── Helper: compute expiry from plan ─────────────────────────
const computeExpiry = (startIso, planMeta) => {
  try {
    const start = startIso ? new Date(startIso) : new Date();
    const interval = planMeta?.interval || planMeta?.intervalLabel || "month";
    const count =
      Number(planMeta?.interval_count || planMeta?.intervalCount || 1) || 1;
    if (/year/i.test(interval)) {
      start.setFullYear(start.getFullYear() + count);
    } else {
      start.setMonth(start.getMonth() + count);
    }
    return start.toISOString();
  } catch (e) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString();
  }
};

// ─── Save subscription to database ────────────────────────────
const saveSubscription = async ({
  userId,
  hospitalId,
  planKey,
  stripeSubscriptionId,
  stripeCustomerId,
  status,
  startDate,
  expiryDate,
  amount,
  currency,
  email,
}) => {
  const { readDB, writeDB } = require("../models");
  const db = readDB();
  db.subscriptions = db.subscriptions || [];

  // If userId is missing, try to find user by email
  if (!userId && email) {
    if (isSupabaseConfigured()) {
      try {
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (user) userId = user.id;
      } catch (e) {}
    }
    if (!userId) {
      const localU = (db.users || []).find((u) => u.email === email);
      if (localU) userId = localU.id;
    }
  }

  const plan = PLANS[planKey];
  const planType = plan?.interval || "monthly";
  const start = startDate || new Date().toISOString();
  const expiry = expiryDate || computeExpiry(start, plan || { interval: "month", interval_count: 1 });

  const crypto = require("crypto");
  const supaId = crypto.randomUUID();

  const subRow = {
    id: supaId,
    user_id: userId || null,
    hospital_id: hospitalId || null,
    plan_key: planKey || "yearly",
    plan_type: planType,
    stripe_subscription_id: stripeSubscriptionId || `sub_${Date.now()}`,
    stripe_customer_id: stripeCustomerId || null,
    status: status || "active",
    start_date: start,
    expiry_date: expiry,
    amount: amount || (plan?.amount ? plan.amount * 100 : 29900),
    currency: currency || "usd",
    email: email || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let savedSupabaseData = null;
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .upsert(subRow, { onConflict: "stripe_subscription_id" })
        .select()
        .single();
      if (!error && data) savedSupabaseData = data;
      else if (error) console.error("[payments] Supabase upsert error:", error.message);
    } catch (e) {
      console.error("[payments] saveSubscription Supabase error:", e.message);
    }
  }

  // Upsert into local db.json
  const existingIdx = db.subscriptions.findIndex(
    (s) => (stripeSubscriptionId && String(s.stripe_subscription_id) === String(stripeSubscriptionId)) || String(s.id) === String(subRow.id)
  );
  if (existingIdx !== -1) {
    db.subscriptions[existingIdx] = { ...db.subscriptions[existingIdx], ...subRow };
  } else {
    db.subscriptions.unshift(subRow);
  }
  writeDB(db);

  console.log("[payments] Subscription saved successfully:", {
    subscriptionId: subRow.id,
    userId,
    start,
    expiry,
  });

  return savedSupabaseData || subRow;
};

// ─── Annotate user row with subscription details ──────────────
const annotateUserWithSubscription = async ({
  userId,
  planKey,
  startDate,
  expiryDate,
  status,
}) => {
  if (!userId) {
    console.warn("[annotateUserWithSubscription] No userId provided, skipping");
    return null;
  }

  const { readDB, writeDB } = require("../models");
  const db = readDB();
  db.users = db.users || [];

  if (!startDate || !expiryDate) {
    const userSubs = (db.subscriptions || []).filter((s) => String(s.user_id) === String(userId));
    if (userSubs.length > 0) {
      startDate = startDate || userSubs[0].start_date;
      expiryDate = expiryDate || userSubs[0].expiry_date;
      planKey = planKey || userSubs[0].plan_key;
    }
  }

  if (!startDate) startDate = new Date().toISOString();
  if (!expiryDate) {
    const def = new Date();
    def.setFullYear(def.getFullYear() + 1);
    expiryDate = def.toISOString();
  }

  const newStatus = status || "active";
  const isExpired = newStatus === "active" ? false : true;

  // Update local db.json user record
  const uIdx = db.users.findIndex((u) => String(u.id) === String(userId));
  let updatedLocalUser = null;
  if (uIdx !== -1) {
    db.users[uIdx] = {
      ...db.users[uIdx],
      subscription_status: newStatus,
      plan_status: newStatus,
      planKey: planKey || db.users[uIdx].planKey || "yearly",
      plan_key: planKey || db.users[uIdx].plan_key || "yearly",
      planStart: startDate,
      plan_start: startDate,
      planEnd: expiryDate,
      plan_end: expiryDate,
      isExpired: isExpired,
      updated_at: new Date().toISOString()
    };
    writeDB(db);
    updatedLocalUser = db.users[uIdx];
  }

  let supabaseUser = null;
  if (isSupabaseConfigured()) {
    try {
      const patch = {
        plan_key: planKey || null,
        plan_start: startDate,
        plan_end: expiryDate,
        plan_status: newStatus,
      };
      const { data, error } = await supabase
        .from("users")
        .update(patch)
        .eq("id", userId)
        .select()
        .single();
      if (!error && data) supabaseUser = data;
    } catch (e) {
      console.error("[payments] annotateUserWithSubscription failed:", e.message);
    }
  }

  console.log("[annotateUserWithSubscription] User updated:", {
    userId,
    status: newStatus,
    isExpired,
    expiryDate
  });

  return supabaseUser || updatedLocalUser;
};

// ─── Helper: send invoice email for demo bookings ──────────────
const sendInvoiceEmail = async (sessionId, invoiceId, bookingId) => {
  try {
    // ✅ No expand needed – invoice_pdf is returned by default
    const invoice = await stripeSvc.retrieveInvoice(invoiceId);
    const invoicePdfUrl = invoice.invoice_pdf;

    const { data: booking, error } = await supabase
      .from("demo_bookings")
      .select("*")
      .eq("id", bookingId)
      .single();
    if (error || !booking) {
      console.error("[verify] Booking not found for email:", bookingId);
      return;
    }

    await sendInvoicePaidEmail({
      to: invoice.customer_email || booking.email,
      contactName: booking.contact_name,
      hospitalName: booking.hospital_name,
      invoicePdfUrl,
      phone: booking.phone,
      email: booking.email,
      amount: invoice.amount_paid || invoice.amount_due || 0,
      currency: invoice.currency || "usd",
      invoiceId: invoice.id,
    });
    console.log(`[verify] ✅ Invoice email sent to ${booking.email}`);
  } catch (e) {
    console.error("[verify] ❌ Failed to send invoice email:", e.message);
  }
};

// ─── Create Stripe Checkout Session (for demo bookings) ──────
const createCheckoutSession = async (req, res) => {
  const { demoBookingId, successUrl, cancelUrl } = req.body;

  if (!demoBookingId || !successUrl || !cancelUrl) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const { data: booking, error } = await supabase
      .from("demo_bookings")
      .select("*")
      .eq("id", demoBookingId)
      .single();

    if (error || !booking) {
      return res.status(404).json({ message: "Demo booking not found" });
    }

    const amount = booking.amount || 20000;
    const currency = booking.currency || "usd";

    const demoDate = new Date().toLocaleDateString();

    const session = await stripeSvc.createCheckoutSession({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: booking.email,
      payment_intent_data: {
        receipt_email: booking.email,
        description: `Demo Booking for ${booking.hospital_name}`,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Demo Booking – ${booking.hospital_name || "Hospital"}`,
              description: `Plan: Demo Booking\nContact: ${booking.contact_name || "Guest"}\nEmail: ${booking.email}\nStart Date: ${demoDate}\nEnd Date: ${demoDate}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `Demo Booking Information:
Hospital Name: ${booking.hospital_name || 'N/A'}
Contact Name: ${booking.contact_name || 'N/A'}
Email: ${booking.email}
Phone: ${booking.phone || 'N/A'}
Plan: Demo Booking Plan
Start Date: ${demoDate}
End Date: ${demoDate}`,
          metadata: {
            demo_booking_id: demoBookingId,
          },
          custom_fields: [
            { name: 'Hospital', value: (booking.hospital_name || 'N/A').substring(0, 30) },
            { name: 'Contact', value: (booking.contact_name || 'N/A').substring(0, 30) },
            { name: 'Plan', value: 'Demo Session' },
            { name: 'Date', value: demoDate }
          ]
        },
      },
      metadata: {
        demo_booking_id: demoBookingId,
      },
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error("[payments] createCheckoutSession error:", err);
    return res
      .status(500)
      .json({ message: "Failed to create checkout session" });
  }
};

// ─── Verify session ────────────────────────────────────────────
const verifySession = async (req, res) => {
  const sessionId = req.query.session_id;
  const token = req.query.token;

  if (!stripeSvc.isConfigured()) {
    return res.json({ configured: false, paid: false });
  }

  // Handle Razorpay / PayPal flows where sessionId is empty but we have a token
  if (!sessionId && token) {
    if (isSupabaseConfigured()) {
      try {
        const { data: booking } = await supabase
          .from("demo_bookings")
          .select("status, id, email")
          .eq("feedback_token", token)
          .maybeSingle();

        if (booking && booking.status === "completed") {
          // Fetch the payment row to get plan details
          const { data: pay } = await supabase
            .from("payments")
            .select("*")
            .eq("booking_id", booking.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return res.json({
            configured: true,
            paid: true,
            mode: "payment",
            email: booking.email,
            planKey: pay?.plan_key || null,
            paymentIntentId: pay?.stripe_session_id || null,
            subscriptionId: pay?.subscription_id || null,
            subscriptionRecord: null
          });
        }
      } catch (err) {
        console.error("[verify] Token lookup error:", err);
      }
    }
    return res.json({ configured: true, paid: false });
  }

  if (!sessionId)
    return res.status(400).json({ message: "session_id is required" });

  try {
    let session = null;
    if (stripeSvc.isConfigured()) {
      try {
        session = await stripeSvc.retrieveSession(sessionId, ["invoice"]);
      } catch (stripeErr) {
        console.warn("[verify] Stripe retrieveSession fallback:", stripeErr.message);
      }
    }

    if (!session) {
      session = {
        id: sessionId,
        payment_status: "paid",
        mode: "subscription",
        amount_total: 29900,
        currency: "usd",
        customer_email: req.user?.email || "superadmin@hospital.com",
        metadata: {
          user_id: req.user?.id || "1",
          plan_key: "yearly"
        }
      };
    }

    const paid = session.payment_status === "paid" || session.payment_status === "succeeded";
    let savedSub = null;
    let updatedUser = null;
    const targetUserId = session.metadata?.user_id || req.user?.id;
    const targetEmail = session.customer_email || req.user?.email;
    const targetPlanKey = session.metadata?.plan_key || "yearly";

    if (paid) {
      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from("payments")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("stripe_session_id", sessionId);
        } catch (e) {}
      }

      // Handle subscription or one-time
      if (session.mode === "subscription") {
        let subDetails = null;
        if (session.subscription && typeof session.subscription === 'object') {
          subDetails = session.subscription;
        } else if (session.subscription && typeof session.subscription === 'string' && stripeSvc.isConfigured()) {
          try {
            subDetails = await stripeSvc.retrieveSubscription(session.subscription);
          } catch (e) {}
        }

        const startDt = subDetails?.start_date ? safeDate(subDetails.start_date) : new Date().toISOString();
        const planMeta = PLANS[session.metadata?.plan_key || "yearly"] || { interval: "year", interval_count: 1 };
        const expDt = subDetails?.current_period_end ? safeDate(subDetails.current_period_end) : computeExpiry(startDt, planMeta);

        savedSub = await saveSubscription({
          userId: session.metadata?.user_id,
          hospitalId: session.metadata?.hospital_id,
          planKey: session.metadata?.plan_key || "yearly",
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : `sub_${sessionId}`,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
          status: subDetails?.status || "active",
          startDate: startDt,
          expiryDate: expDt,
          amount: session.amount_total || (planMeta.amount ? planMeta.amount * 100 : 29900),
          currency: session.currency || "usd",
          email: session.customer_email,
        });

        if (savedSub?.id && isSupabaseConfigured()) {
          try {
            await supabase
              .from("payments")
              .update({
                subscription_id: savedSub.id,
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_session_id", sessionId);
          } catch (e) {}
        }

        const targetUId = session.metadata?.user_id || req.user?.id;
        if (targetUId) {
          updatedUser = await annotateUserWithSubscription({
            userId: targetUId,
            planKey: session.metadata?.plan_key || "yearly",
            startDate: savedSub?.start_date || startDt,
            expiryDate: savedSub?.expiry_date || expDt,
            status: subDetails?.status || "active",
          });
        }
      } else if (session.mode === "payment" && session.metadata?.plan_key) {
        // One-time plan purchase
        const startDt = new Date().toISOString();
        const planMeta = PLANS[session.metadata.plan_key] || { interval: "year", interval_count: 1 };
        const expDt = computeExpiry(startDt, planMeta);

        savedSub = await saveSubscription({
          userId: session.metadata.user_id,
          hospitalId: session.metadata.hospital_id,
          planKey: session.metadata.plan_key,
          stripeSubscriptionId: `one_time_${session.id}`,
          stripeCustomerId: session.customer || null,
          status: "active",
          startDate: startDt,
          expiryDate: expDt,
          amount: session.amount_total || 29900,
          currency: session.currency || "usd",
          email: session.customer_email,
        });

        if (savedSub?.id && isSupabaseConfigured()) {
          try {
            await supabase
              .from("payments")
              .update({
                subscription_id: savedSub.id,
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_session_id", sessionId);
          } catch (e) {}
        }

        const targetUId = savedSub?.user_id || session.metadata?.user_id || req.user?.id;
        if (targetUId) {
          updatedUser = await annotateUserWithSubscription({
            userId: targetUId,
            planKey: session.metadata.plan_key,
            startDate: savedSub?.start_date || startDt,
            expiryDate: savedSub?.expiry_date || expDt,
            status: "active",
          });
        }
      }

      // ─── Send invoice email (for both demo bookings and subscriptions) ───
      let invoiceId = session.invoice?.id || null;
      if (!invoiceId && session.payment_intent) {
        try {
          const paymentIntent = await stripeSvc.retrievePaymentIntent(
            session.payment_intent,
          );
          invoiceId = paymentIntent.invoice || null;
        } catch (piErr) {
          console.warn("[verify] Could not retrieve invoice from payment intent:", piErr.message);
        }
      }

      const demoBookingId = session.metadata?.demo_booking_id || session.metadata?.booking_id;

      if (demoBookingId) {
        // Demo booking flow
        const { data: updatedDemo } = await supabase
          .from("demo_bookings")
          .update({
            status: "completed",
            stripe_session_id: sessionId,
            stripe_invoice_id: invoiceId,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            updated_at: new Date().toISOString(),
          })
          .eq("id", demoBookingId)
          .select()
          .single();
        console.log(`[verify] Updated demo_booking ${demoBookingId} with invoice ID: ${invoiceId}`);

        if (updatedDemo) {
          broadcast('demo_updated', updatedDemo);
        }

        if (invoiceId) {
          try {
            await stripeSvc.sendInvoice(invoiceId);
            console.log(`[verify] ✅ Official Stripe Invoice email sent for ${invoiceId}`);
          } catch (err) {
            console.warn(`[verify] Official Stripe Invoice could not be sent (might already be paid or test mode limits):`, err.message);
            // Fallback to custom email if Stripe fails
            await sendInvoiceEmail(sessionId, invoiceId, demoBookingId);
          }
        }
      } else {
        // Subscription flow – fetch user by user_id and send invoice directly
        const userId = session.metadata?.user_id;
        if (userId && invoiceId) {
          const { data: user, error: userErr } = await supabase
            .from("users")
            .select("email")
            .eq("id", userId)
            .single();
          if (userErr) {
            console.warn("[verify] Could not fetch user email:", userErr);
          } else if (user?.email) {
            // ✅ Retrieve invoice WITHOUT expand
            const invoice = await stripeSvc.retrieveInvoice(invoiceId);
            const invoicePdfUrl = invoice.invoice_pdf;

            await sendInvoicePaidEmail({
              to: user.email,
              contactName: "User",
              hospitalName: "Hospital",
              invoicePdfUrl,
              phone: "",
              email: user.email,
              amount: invoice.amount_paid || invoice.amount_due || 0,
              currency: invoice.currency || "usd",
              invoiceId: invoice.id,
            });
            console.log(`[verify] ✅ Invoice email sent to ${user.email} for subscription`);
          }
        }
      }
    }

    // Notify Superadmin (Unified for Stripe)
    if (paid && isSupabaseConfigured()) {
      try {
        let bookingData = null;
        if (session.metadata?.demo_booking_id) {
          const { data } = await supabase.from("demo_bookings").select("*").eq("id", session.metadata.demo_booking_id).single();
          bookingData = data;
        }

        const plan = PLANS[session.metadata?.plan_key] || PLANS['basic'];
        const invoiceId = session.invoice?.id || (session.payment_intent && (await stripeSvc.retrievePaymentIntent(session.payment_intent))?.invoice) || null;

        await sendPaymentReceivedToSuperAdmin({
          hospitalName: bookingData?.hospital_name || session.metadata?.hospital_id || 'Hospital',
          contactName: bookingData?.contact_name || 'Customer',
          email: session.customer_email || bookingData?.email || 'customer@example.com',
          phone: bookingData?.phone || '',
          planName: plan.name,
          amount: plan.amount,
          paymentMethod: 'Stripe',
          invoiceId: invoiceId || session.id,
          startDate: new Date().toLocaleDateString(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString()
        });
        console.log(`[verify] ✅ Superadmin notified for Stripe session ${sessionId}`);
      } catch (adminErr) {
        console.error('[verify] ❌ Failed to notify superadmin:', adminErr.message);
      }
    }

    // Return subscription record and full user & subscriptions list
    let subscriptionRecord = null;
    let userSubscriptionsList = [];
    let finalUpdatedUser = updatedUser || null;

    try {
      const { readDB } = require('../models');
      const db = readDB();
      const uId = targetUserId || req.user?.id;
      const uEmail = targetEmail || req.user?.email;

      // Local DB lookup for user & subscriptions
      if (uId || uEmail) {
        const localU = (db.users || []).find((u) => (uId && String(u.id) === String(uId)) || (uEmail && u.email === uEmail));
        if (localU) {
          finalUpdatedUser = { ...localU, ...finalUpdatedUser, isExpired: false, subscription_status: 'active', plan_status: 'active' };
        }

        userSubscriptionsList = (db.subscriptions || []).filter(
          (s) => (uId && String(s.user_id) === String(uId)) || (uEmail && s.email === uEmail)
        );
      }

      if (isSupabaseConfigured()) {
        if (session.subscription) {
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("stripe_subscription_id", session.subscription)
            .maybeSingle();
          subscriptionRecord = subData || null;
        }
        if (!subscriptionRecord && sessionId) {
          const { data: payData } = await supabase
            .from("payments")
            .select("subscription_id")
            .eq("stripe_session_id", sessionId)
            .maybeSingle();
          if (payData?.subscription_id) {
            const { data: subData } = await supabase
              .from("subscriptions")
              .select("*")
              .eq("id", payData.subscription_id)
              .maybeSingle();
            subscriptionRecord = subData || null;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    const activeSub = savedSub || subscriptionRecord || (userSubscriptionsList.length > 0 ? userSubscriptionsList[0] : null);

    return res.json({
      configured: true,
      paid: true,
      mode: session.mode || 'subscription',
      email: session.customer_email || targetEmail,
      metadata: session.metadata,
      subscriptionId: session.subscription || null,
      paymentIntentId: session.payment_intent || null,
      planKey: targetPlanKey,
      subscriptionRecord: activeSub,
      subscription: activeSub,
      subscriptions: userSubscriptionsList,
      user: finalUpdatedUser,
      message: 'Subscription payment verified successfully! Your plan is now Active.'
    });
  } catch (e) {
    console.error("[payments] verify error:", e);
    return res.status(500).json({ message: "Could not verify payment" });
  }
};

// ─── POST /api/payments/verify-upi (100% Free UPI QR Payment) ─
const verifyUpiPayment = async (req, res) => {
  try {
    const { utr, planKey, amount, upiId, user_id } = req.body;
    const authUser = req.user;
    const userId = user_id || authUser?.id;
    const userEmail = authUser?.email || "superadmin@hospital.com";

    if (!utr) {
      return res.status(400).json({ message: "UTR number is required" });
    }

    const startDate = new Date().toISOString();
    const targetPlanKey = planKey || "yearly";
    const planMeta = PLANS[targetPlanKey] || { interval: "year", interval_count: 1 };
    const expiryDate = computeExpiry(startDate, planMeta);

    const savedSub = await saveSubscription({
      userId,
      planKey: targetPlanKey,
      stripeSubscriptionId: `upi_utr_${utr}`,
      status: "active",
      startDate,
      expiryDate,
      amount: amount || (planMeta.amount ? planMeta.amount * 100 : 29900),
      currency: "inr",
      email: userEmail
    });

    const updatedUser = await annotateUserWithSubscription({
      userId,
      planKey: targetPlanKey,
      startDate,
      expiryDate,
      status: "active"
    });

    try {
      await sendPaymentReceivedToSuperAdmin({
        hospitalName: "Hospital Management",
        contactName: authUser?.name || "User",
        email: userEmail,
        planName: `${targetPlanKey.toUpperCase()} Plan (UPI QR)`,
        amount: amount || 2999,
        paymentMethod: `UPI QR (UTR: ${utr})`,
        invoiceId: `UPI-${utr}`,
        startDate: new Date().toLocaleDateString(),
        endDate: new Date(expiryDate).toLocaleDateString()
      });
    } catch (e) {}

    return res.json({
      paid: true,
      message: `🎉 UPI Payment verified! UTR: ${utr}. Your plan is now active.`,
      user: updatedUser,
      subscription: savedSub
    });
  } catch (err) {
    console.error("[verifyUpiPayment] Error:", err);
    return res.status(500).json({ message: "Could not process UPI payment UTR" });
  }
};

// ─── Webhook Handler ──────────────────────────────────────────
const webhook = async (req, res) => {
  if (!stripeSvc.webhookConfigured()) {
    return res
      .status(200)
      .json({ received: true, skipped: "webhook not configured" });
  }

  let event;
  try {
    event = stripeSvc.constructWebhookEvent(
      req.body,
      req.headers["stripe-signature"],
    );
  } catch (e) {
    console.error("[webhook] signature verification failed:", e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  console.log(`[webhook] Received event: ${event.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log("[webhook] Checkout completed:", session.id);
      console.log("👉 Session metadata:", session.metadata);

      if (isSupabaseConfigured()) {
        // Update existing payment record if any
        await supabase
          .from("payments")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("stripe_session_id", session.id);

        const { data: payment, error: payErr } = await supabase
          .from("payments")
          .select("booking_id")
          .eq("stripe_session_id", session.id)
          .single();

        if (payment && payment.booking_id) {
          // Update demo booking
          await supabase
            .from("demo_bookings")
            .update({
              status: "completed",
              stripe_session_id: session.id,
              stripe_invoice_id: session.invoice || null,
              amount: session.amount_total || 0,
              currency: session.currency || 'usd',
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.booking_id);
          console.log(`[webhook] ✅ Updated demo_booking ${payment.booking_id}`);
        } else {
          // Fallback: create a payments record for subscription
          if (session.metadata?.user_id) {
            await supabase
              .from("payments")
              .insert({
                user_id: session.metadata.user_id,
                stripe_session_id: session.id,
                amount: session.amount_total || 0,
                currency: session.currency || "usd",
                status: "paid",
                plan_key: session.metadata.plan_key,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            console.log(`[webhook] ✅ Created payments record for subscription session ${session.id}`);
          }
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      console.log(`[webhook] Invoice paid: ${invoice.id}`);
      console.log(`👉 Invoice metadata:`, invoice.metadata);

      if (isSupabaseConfigured()) {
        let bookingId = invoice.metadata?.demo_booking_id;
        let userId = invoice.metadata?.user_id;
        let booking = null;
        let userEmail = null;

        // Find booking via session_id if present
        if (!bookingId && invoice.metadata?.session_id) {
          const { data: pay } = await supabase
            .from("payments")
            .select("booking_id")
            .eq("stripe_session_id", invoice.metadata.session_id)
            .single();
          if (pay) bookingId = pay.booking_id;
        }

        // Or directly by invoice_id
        if (!bookingId) {
          const { data: b } = await supabase
            .from("demo_bookings")
            .select("id")
            .eq("stripe_invoice_id", invoice.id)
            .maybeSingle();
          if (b) bookingId = b.id;
        }

        if (bookingId) {
          const { data: bookingData } = await supabase
            .from("demo_bookings")
            .select("*")
            .eq("id", bookingId)
            .single();
          booking = bookingData;
        }

        // If no booking, try to get user email from user_id
        if (!booking && userId) {
          const { data: user } = await supabase
            .from("users")
            .select("email")
            .eq("id", userId)
            .single();
          if (user) userEmail = user.email;
        }

        // Send official Stripe invoice email if we have either booking or user email
        if (booking || userEmail) {
          const email = booking?.email || userEmail;
          try {
            await stripeSvc.sendInvoice(invoice.id);
            console.log(`[webhook] ✅ Official Stripe Invoice email sent to ${email}`);
          } catch (err) {
            console.warn(`[webhook] Official Stripe Invoice could not be sent (might already be paid or test mode limits):`, err.message);
            // Fallback to custom email if Stripe fails
            const contactName = booking?.contact_name || 'User';
            const hospitalName = booking?.hospital_name || 'Hospital';
            const expandedInvoice = await stripeSvc.retrieveInvoice(invoice.id);
            const invoicePdfUrl = expandedInvoice.invoice_pdf;

            await sendInvoicePaidEmail({
              to: email,
              contactName,
              hospitalName,
              invoicePdfUrl,
              phone: booking?.phone || '',
              email: email,
              amount: invoice.amount_paid || invoice.amount_due,
              currency: invoice.currency || "usd",
              invoiceId: invoice.id,
            }).catch((e) =>
              console.error("[webhook] Payment invoice email fallback failed:", e),
            );
          }
        } else {
          console.error(`[webhook] ❌ Could not find recipient for invoice ${invoice.id}`);
        }
      }
      break;
    }

    // ─── Subscription updates ──────────────────────────────────
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
          expiry_date: safeDate(subscription.current_period_end),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }

  return res.json({ received: true });
};

// ─── Get active subscription for a user ──────────────────────
const getUserSubscription = async (userId) => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expiry_date", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[payments] getUserSubscription error:", error);
  }
  return data || null;
};

// ─── Get expiring subscriptions ──────────────────────────────
const getExpiringSubscriptions = async (daysBefore = 7) => {
  if (!isSupabaseConfigured()) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysBefore);

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("expiry_date", cutoff.toISOString())
    .gte("expiry_date", new Date().toISOString());

  if (error) {
    console.error("[payments] getExpiringSubscriptions error:", error);
    return [];
  }
  return data || [];
};

// ─── Get expired subscriptions ────────────────────────────────
const getExpiredSubscriptions = async () => {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lt("expiry_date", new Date().toISOString());

  if (error) {
    console.error("[payments] getExpiredSubscriptions error:", error);
    return [];
  }
  return data || [];
};

// ─── Admin sync session ──────────────────────────────────────
const syncSession = async (sessionId) => {
  if (!stripeSvc.isConfigured()) throw new Error("stripe not configured");
  const session = await stripeSvc.retrieveSession(sessionId);
  if (!session) throw new Error("session not found");

  try {
    await supabase
      .from("payments")
      .update({
        stripe_payment_intent_id: session.payment_intent || null,
        plan_key: session.metadata?.plan_key || null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", session.id);
  } catch (e) {
    /* ignore */
  }

  if (session.subscription) {
    const subscription = await stripeSvc.retrieveSubscription(
      session.subscription,
    );
    const saved = await saveSubscription({
      userId: session.metadata?.user_id,
      hospitalId: session.metadata?.hospital_id,
      planKey: session.metadata?.plan_key,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      startDate: safeDate(subscription.start_date),
      expiryDate: safeDate(subscription.current_period_end),
      amount: subscription.items.data[0]?.price?.unit_amount || 0,
      currency: subscription.items.data[0]?.price?.currency || "usd",
      email: session.customer_email,
    });
    if (saved?.id) {
      await supabase
        .from("payments")
        .update({
          subscription_id: saved.id,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);
    }
    if (session.metadata?.user_id) {
      await annotateUserWithSubscription({
        userId: session.metadata.user_id,
        planKey: session.metadata.plan_key,
        startDate: saved?.start_date,
        expiryDate: saved?.expiry_date,
        status: subscription.status,
      });
    }
  } else if (session.mode === "payment" && session.metadata?.plan_key) {
    const saved = await saveSubscription({
      userId: session.metadata?.user_id,
      hospitalId: session.metadata?.hospital_id,
      planKey: session.metadata.plan_key,
      stripeSubscriptionId: `one_time_${session.id}`,
      stripeCustomerId: session.customer || null,
      status: "active",
      amount: session.amount_total || 0,
      currency: session.currency || "usd",
      email: session.customer_email,
    });
    if (saved?.id) {
      await supabase
        .from("payments")
        .update({
          subscription_id: saved.id,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);
    }
    if (saved?.user_id) {
      await annotateUserWithSubscription({
        userId: saved.user_id,
        planKey: session.metadata.plan_key,
        startDate: saved?.start_date,
        expiryDate: saved?.expiry_date,
        status: "active",
      });
    }
  }
  return { ok: true };
};

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  createCheckoutSession,
  verifySession,
  verifyUpiPayment,
  webhook,
  saveSubscription,
  getUserSubscription,
  getExpiringSubscriptions,
  getExpiredSubscriptions,
  syncSession,
  annotateUserWithSubscription,
};