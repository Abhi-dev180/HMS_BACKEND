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
  // If userId is missing, try to find user by email
  if (!userId && email) {
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!userErr && user) {
      userId = user.id;
      console.log(`[saveSubscription] Found user by email: ${email} -> ${userId}`);
    } else {
      console.warn(`[saveSubscription] No user found for email: ${email}`);
    }
  }

  const plan = PLANS[planKey];
  const planType = plan?.interval || "monthly";

  const start = startDate || new Date().toISOString();
  const expiry =
    expiryDate ||
    computeExpiry(start, plan || { interval: "month", interval_count: 1 });

  console.log("[saveSubscription] Computed dates:", {
    start,
    expiry,
    planKey,
    userId,
    email,
  });

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId || null,
        hospital_id: hospitalId || null,
        plan_key: planKey,
        plan_type: planType,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId || null,
        status: status,
        start_date: start,
        expiry_date: expiry,
        amount: amount,
        currency: currency || "usd",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[payments] saveSubscription error:", error);
  } else {
    console.log("[payments] Subscription saved:", {
      subscriptionId: data?.id,
      user: userId,
      start,
      expiry,
    });
  }
  return data;
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

  if (!startDate || !expiryDate) {
    try {
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("start_date, expiry_date, plan_key")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (subData) {
        startDate = startDate || subData.start_date;
        expiryDate = expiryDate || subData.expiry_date;
        planKey = planKey || subData.plan_key;
      }
    } catch (e) {
      /* ignore */
    }
  }

  if (!startDate) startDate = new Date().toISOString();
  if (!expiryDate) {
    const def = new Date();
    def.setFullYear(def.getFullYear() + 1);
    expiryDate = def.toISOString();
  }

  try {
    const patch = {
      plan_key: planKey || null,
      plan_start: startDate,
      plan_end: expiryDate,
      plan_status: status || "active",
    };
    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", userId)
      .select()
      .single();
    if (error) {
      console.error("[payments] annotateUserWithSubscription error:", error);
      return null;
    }
    console.log("[annotateUserWithSubscription] User updated:", {
      userId,
      patch,
    });
    return data;
  } catch (e) {
    console.error("[payments] annotateUserWithSubscription failed:", e);
    return null;
  }
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
    const session = await stripeSvc.retrieveSession(sessionId, ["invoice"]);
    const paid = session.payment_status === "paid";

    if (paid && isSupabaseConfigured()) {
      // Update payments table
      await supabase
        .from("payments")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("stripe_session_id", sessionId);

      // Handle subscription or one-time
      if (session.mode === "subscription") {
        const subscription = await stripeSvc.retrieveSubscription(
          session.subscription,
        );
        const saved = await saveSubscription({
          userId: session.metadata.user_id,
          hospitalId: session.metadata.hospital_id,
          planKey: session.metadata.plan_key,
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
            .eq("stripe_session_id", sessionId);
        }
        if (session.metadata.user_id) {
          await annotateUserWithSubscription({
            userId: session.metadata.user_id,
            planKey: session.metadata.plan_key,
            startDate: saved?.start_date,
            expiryDate: saved?.expiry_date,
            status: subscription.status,
          });
        }
      } else if (session.mode === "payment" && session.metadata?.plan_key) {
        // One-time plan purchase
        const saved = await saveSubscription({
          userId: session.metadata.user_id,
          hospitalId: session.metadata.hospital_id,
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
            .eq("stripe_session_id", sessionId);
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

    // Return subscription record if any
    let subscriptionRecord = null;
    try {
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

    return res.json({
      configured: true,
      paid,
      mode: session.mode,
      email: session.customer_email,
      metadata: session.metadata,
      subscriptionId: session.subscription || null,
      paymentIntentId: session.payment_intent || null,
      planKey: session.metadata?.plan_key || null,
      subscriptionRecord,
    });
  } catch (e) {
    console.error("[payments] verify error:", e);
    return res.status(500).json({ message: "Could not verify payment" });
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
  webhook,
  saveSubscription,
  getUserSubscription,
  getExpiringSubscriptions,
  getExpiredSubscriptions,
  syncSession,
  annotateUserWithSubscription,
};