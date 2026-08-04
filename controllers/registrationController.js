// const crypto = require('crypto');
// const { supabase, isConfigured } = require('../config/supabase');
// const Users = require('../db/users');
// const stripeSvc = require('../services/stripeService');
// const {
//   sendRegistrationReceived,
//   sendRegistrationApproved,
//   sendRegistrationDenied
// } = require('../services/emailService');

// const TABLE = 'registrations';
// const VALID_STATUS = ['pending', 'approved', 'denied', 'active', 'inactive'];

// const notConfigured = (res) =>
//   res.status(503).json({ message: 'Registration storage is not configured (Supabase).' });

// const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
// const tempPassword = () => crypto.randomBytes(4).toString('hex'); // 8-char temp

// // POST /api/registrations  (public) — submitted after successful payment
// const createRegistration = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);

//   const {
//     feedbackToken, sessionId,
//     username, hospitalName, contactName, email, phone, city, address, beds, password
//   } = req.body || {};

//   if (!hospitalName || !contactName || !email) {
//     return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
//   }
//   if (!isValidEmail(email)) return res.status(400).json({ message: 'A valid email is required' });
//   if (!password || String(password).length < 6) {
//     return res.status(400).json({ message: 'Password must be at least 6 characters' });
//   }

//   // Resolve the booking from the feedback token (link between funnel stages).
//   let booking = null;
//   if (feedbackToken) {
//     const { data } = await supabase.from('demo_bookings').select('*').eq('feedback_token', feedbackToken).single();
//     booking = data || null;
//   }

//   // Payment gate: if Stripe is configured, require a paid session.
//   if (stripeSvc.isConfigured()) {
//     if (!sessionId) return res.status(402).json({ message: 'Payment required before registration' });
//     try {
//       const session = await stripeSvc.retrieveSession(sessionId);
//       if (session.payment_status !== 'paid') {
//         return res.status(402).json({ message: 'Payment not completed' });
//       }
//       await supabase.from('payments').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('stripe_session_id', sessionId);
//     } catch (e) {
//       console.error('[registrations] payment verify failed:', e);
//       return res.status(402).json({ message: 'Could not verify payment' });
//     }
//   }

//   const row = {
//     booking_id: booking?.id || null,
//     username: username ? String(username).trim() : String(email).split('@')[0],
//     hospital_name: String(hospitalName).trim(),
//     contact_name: String(contactName).trim(),
//     email: String(email).trim().toLowerCase(),
//     phone: phone ? String(phone).trim() : null,
//     city: city ? String(city).trim() : null,
//     address: address ? String(address).trim() : null,
//     beds: beds ? Number(beds) : null,
//     details: { password: String(password) }, // stored for admin-account creation on approval
//     status: 'pending'
//   };

//   const { data, error } = await supabase.from(TABLE).insert(row).select().single();
//   if (error) {
//     if (error.code === '23505') return res.status(409).json({ message: 'That username is already taken' });
//     console.error('[registrations] create error:', error);
//     return res.status(500).json({ message: 'Could not submit registration' });
//   }

//   sendRegistrationReceived({ to: data.email, contactName: data.contact_name, hospitalName: data.hospital_name })
//     .catch((e) => console.error('[registrations] received email failed:', e));

//   // Augment registration response with any payment/subscription info for admin UX.
//   try {
//     // Try to find the payment by booking_id first, then fallback to email match.
//     let payment = null;
//     if (data.booking_id) {
//       const p = await supabase.from('payments').select('*').eq('booking_id', data.booking_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
//       payment = p.data || null;
//     }
//     if (!payment) {
//       const p2 = await supabase.from('payments').select('*').eq('email', data.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
//       payment = p2.data || null;
//     }

//     let subscription = null;
//     if (payment && payment.subscription_id) {
//       const s = await supabase.from('subscriptions').select('*').eq('id', payment.subscription_id).maybeSingle();
//       subscription = s.data || null;
//     }
//     if (!subscription && payment?.stripe_session_id) {
//       const fallbackKey = `one_time_${payment.stripe_session_id}`;
//       const s = await supabase.from('subscriptions').select('*').eq('stripe_subscription_id', fallbackKey).maybeSingle();
//       subscription = s.data || null;
//     }

//     const enhanced = { ...publicView(data), payment: payment || null, subscription: subscription || null };
//     return res.status(201).json({ message: 'Registration submitted', registration: enhanced });
//   } catch (e) {
//     console.error('[registrations] enhance data failed:', e);
//     return res.status(201).json({ message: 'Registration submitted', registration: publicView(data) });
//   }
// };

// // GET /api/registrations/prefill/:token  (public) — data we already have, to prefill the form
// const getPrefill = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { token } = req.params;
//   const { data } = await supabase
//     .from('demo_bookings')
//     .select('hospital_name, contact_name, email, phone, city')
//     .eq('feedback_token', token)
//     .single();
//   if (!data) return res.json({ prefill: null });
//   return res.json({
//     prefill: {
//       hospitalName: data.hospital_name,
//       contactName: data.contact_name,
//       email: data.email,
//       phone: data.phone,
//       city: data.city
//     }
//   });
// };

// const publicView = (r) => ({
//   id: r.id, username: r.username, hospitalName: r.hospital_name, contactName: r.contact_name,
//   email: r.email, phone: r.phone, city: r.city, address: r.address, beds: r.beds,
//   status: r.status, adminUserId: r.admin_user_id, hospitalId: r.hospital_id, createdAt: r.created_at
// });

// // GET /api/registrations  (superadmin) — list + counts
// const listRegistrations = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
//   if (error) {
//     console.error('[registrations] list error:', error);
//     return res.status(500).json({ message: 'Could not load registrations' });
//   }
//   const counts = data.reduce((acc, r) => { acc.total += 1; acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, { total: 0, pending: 0, approved: 0, denied: 0, active: 0, inactive: 0 });

//   // Fetch payment/subscription info for each registration (best-effort). This
//   // lets the superadmin UI show plan start/end and transaction ids.
//   const registrations = await Promise.all(data.map(async (r) => {
//     try {
//       let payment = null;
//       if (r.booking_id) {
//         const p = await supabase.from('payments').select('*').eq('booking_id', r.booking_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
//         payment = p.data || null;
//       }
//       if (!payment) {
//         const p2 = await supabase.from('payments').select('*').eq('email', r.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
//         payment = p2.data || null;
//       }

//       let subscription = null;
//       if (payment && payment.subscription_id) {
//         const resSub = await supabase.from('subscriptions').select('*').eq('id', payment.subscription_id).maybeSingle();
//         subscription = resSub.data || null;
//       }
//       if (!subscription && payment?.stripe_session_id) {
//         const fallbackKey = `one_time_${payment.stripe_session_id}`;
//         const resSub = await supabase.from('subscriptions').select('*').eq('stripe_subscription_id', fallbackKey).maybeSingle();
//         subscription = resSub.data || null;
//       }
//       return { ...publicView(r), payment: payment || null, subscription };
//     } catch (e) {
//       return publicView(r);
//     }
//   }));

//   return res.json({ registrations, counts });
// };

// // Create/find the HMS admin user (Supabase) from a registration.
// const ensureAdminUser = async (reg) => {
//   const existing = await Users.findByEmail(reg.email);
//   if (existing) return { user: existing, tempPassword: null, created: false };

//   const pwd = reg.details?.password || tempPassword();
//   const user = await Users.insert({
//     id: Date.now().toString(),
//     name: reg.contact_name,
//     email: reg.email,
//     mobile: reg.phone || '',
//     password: pwd,
//     role: 'admin',
//     hospital: reg.hospital_name,
//     hospitalId: reg.hospital_id || '',
//     active: true
//   });
//   return { user, tempPassword: pwd, created: true };
// };

// // PATCH /api/registrations/:id  (superadmin) — approve / deny / active / inactive
// const updateRegistrationStatus = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { id } = req.params;
//   const { status } = req.body || {};

//   if (!VALID_STATUS.includes(status)) {
//     return res.status(400).json({ message: `status must be one of ${VALID_STATUS.join(', ')}` });
//   }

//   const { data: reg, error: findErr } = await supabase.from(TABLE).select('*').eq('id', id).single();
//   if (findErr || !reg) return res.status(404).json({ message: 'Registration not found' });

//   const update = { status, updated_at: new Date().toISOString() };

//   // Approve / activate → make sure an admin account exists, email credentials.
//   if (status === 'approved' || status === 'active') {
//     const { user, tempPassword: pwd } = await ensureAdminUser(reg);
//     update.admin_user_id = user.id;
//     if (status === 'approved') update.status = 'active';
//     // Show the actual login password: the one the hospital chose at registration
//     // (falls back to the generated one, then to the created user's stored password).
//     const loginPassword = reg.details?.password || pwd || user.password || '';
//     sendRegistrationApproved({
//       to: reg.email, contactName: reg.contact_name, hospitalName: reg.hospital_name,
//       loginEmail: user.email, tempPassword: loginPassword,
//       origin: req.headers.origin
//     }).catch((e) => console.error('[registrations] approved email failed:', e));
//   }

//   if (status === 'denied') {
//     sendRegistrationDenied({ to: reg.email, contactName: reg.contact_name, hospitalName: reg.hospital_name })
//       .catch((e) => console.error('[registrations] denied email failed:', e));
//   }

//   // Inactive / active → toggle the linked admin login.
//   if (status === 'inactive' && reg.admin_user_id) {
//     await Users.update(reg.admin_user_id, { active: false }).catch(() => {});
//   }
//   if (status === 'active' && reg.admin_user_id) {
//     await Users.update(reg.admin_user_id, { active: true }).catch(() => {});
//   }

//   const { data, error } = await supabase.from(TABLE).update(update).eq('id', id).select().single();
//   if (error) {
//     console.error('[registrations] status error:', error);
//     return res.status(500).json({ message: 'Could not update registration' });
//   }
//   return res.json({ message: `Registration ${update.status}`, registration: publicView(data) });
// };

// // POST /api/registrations/:id/assign-hospital  (superadmin/admin) — link an HMS hospital
// const assignHospital = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { id } = req.params;
//   const { hospitalId } = req.body || {};
//   if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

//   const { data: reg, error: findErr } = await supabase.from(TABLE).select('*').eq('id', id).single();
//   if (findErr || !reg) return res.status(404).json({ message: 'Registration not found' });

//   // Reflect the assignment on the linked admin user.
//   if (reg.admin_user_id) {
//     await Users.update(reg.admin_user_id, { hospitalId: String(hospitalId) }).catch(() => {});
//   }

//   const { data, error } = await supabase
//     .from(TABLE)
//     .update({ hospital_id: String(hospitalId), updated_at: new Date().toISOString() })
//     .eq('id', id).select().single();
//   if (error) {
//     console.error('[registrations] assign error:', error);
//     return res.status(500).json({ message: 'Could not assign hospital' });
//   }
//   return res.json({ message: 'Hospital assigned', registration: publicView(data) });
// };

// // DELETE /api/registrations/:id  (superadmin)
// const deleteRegistration = async (req, res) => {
//   if (!isConfigured()) return notConfigured(res);
//   const { id } = req.params;
//   const { error } = await supabase.from(TABLE).delete().eq('id', id);
//   if (error) {
//     console.error('[registrations] delete error:', error);
//     return res.status(500).json({ message: 'Could not delete registration' });
//   }
//   return res.json({ message: 'Registration deleted' });
// };

// module.exports = {
//   createRegistration,
//   getPrefill,
//   listRegistrations,
//   updateRegistrationStatus,
//   assignHospital,
//   deleteRegistration
// };




const crypto = require('crypto');
const { supabase, isConfigured } = require('../config/supabase');
const Users = require('../db/users');
const stripeSvc = require('../services/stripeService');
const {
  sendRegistrationReceived,
  sendRegistrationApproved,
  sendRegistrationDenied
} = require('../services/emailService');
const { annotateUserWithSubscription } = require('./paymentController');
const { PLANS } = require('../config/stripePlans');

const TABLE = 'registrations';
const VALID_STATUS = ['pending', 'approved', 'denied', 'active', 'inactive'];

const notConfigured = (res) =>
  res.status(503).json({ message: 'Registration storage is not configured (Supabase).' });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
const tempPassword = () => crypto.randomBytes(4).toString('hex');

// ─── Helper: compute expiry from plan ─────────────────────────
const computeExpiry = (startIso, planMeta) => {
  try {
    const start = startIso ? new Date(startIso) : new Date();
    const interval = planMeta?.interval || planMeta?.intervalLabel || 'month';
    const count = Number(planMeta?.interval_count || planMeta?.intervalCount || 1) || 1;
    if (/year/i.test(interval)) {
      start.setFullYear(start.getFullYear() + count);
    } else {
      start.setMonth(start.getMonth() + count);
    }
    return start.toISOString();
  } catch {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString();
  }
};

// ─── Public view ──────────────────────────────────────────────
const publicView = (r) => ({
  id: r.id,
  username: r.username,
  hospitalName: r.hospital_name,
  contactName: r.contact_name,
  email: r.email,
  phone: r.phone,
  city: r.city,
  address: r.address,
  beds: r.beds,
  status: r.status,
  adminUserId: r.admin_user_id,
  hospitalId: r.hospital_id,
  createdAt: r.created_at
});

// ─── POST /api/registrations ──────────────────────────────────
const createRegistration = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);

  const {
    feedbackToken, sessionId,
    username, hospitalName, contactName, email, phone, city, address, beds, password
  } = req.body || {};

  if (!hospitalName || !contactName || !email) {
    return res.status(400).json({ message: 'hospitalName, contactName and email are required' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ message: 'A valid email is required' });
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  let booking = null;
  if (feedbackToken) {
    const { data } = await supabase.from('demo_bookings').select('*').eq('feedback_token', feedbackToken).single();
    booking = data || null;
  }

  if (stripeSvc.isConfigured()) {
    if (!sessionId) return res.status(402).json({ message: 'Payment required before registration' });
    try {
      const session = await stripeSvc.retrieveSession(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(402).json({ message: 'Payment not completed' });
      }
      await supabase.from('payments').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('stripe_session_id', sessionId);
    } catch (e) {
      console.error('[registrations] payment verify failed:', e);
      return res.status(402).json({ message: 'Could not verify payment' });
    }
  }

  const row = {
    booking_id: booking?.id || null,
    username: username ? String(username).trim() : String(email).split('@')[0],
    hospital_name: String(hospitalName).trim(),
    contact_name: String(contactName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: phone ? String(phone).trim() : null,
    city: city ? String(city).trim() : null,
    address: address ? String(address).trim() : null,
    beds: beds ? Number(beds) : null,
    details: { password: String(password) },
    status: 'pending'
  };

  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'That username is already taken' });
    console.error('[registrations] create error:', error);
    return res.status(500).json({ message: 'Could not submit registration' });
  }

  sendRegistrationReceived({ to: data.email, contactName: data.contact_name, hospitalName: data.hospital_name })
    .catch((e) => console.error('[registrations] received email failed:', e));

  try {
    let payment = null;
    if (data.booking_id) {
      const p = await supabase.from('payments').select('*').eq('booking_id', data.booking_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      payment = p.data || null;
    }
    if (!payment) {
      const p2 = await supabase.from('payments').select('*').eq('email', data.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
      payment = p2.data || null;
    }

    let subscription = null;
    if (payment && payment.subscription_id) {
      const s = await supabase.from('subscriptions').select('*').eq('id', payment.subscription_id).maybeSingle();
      subscription = s.data || null;
    }
    if (!subscription && payment?.stripe_session_id) {
      const fallbackKey = `one_time_${payment.stripe_session_id}`;
      const s = await supabase.from('subscriptions').select('*').eq('stripe_subscription_id', fallbackKey).maybeSingle();
      subscription = s.data || null;
    }

    const enhanced = { ...publicView(data), payment: payment || null, subscription: subscription || null };
    return res.status(201).json({ message: 'Registration submitted', registration: enhanced });
  } catch (e) {
    console.error('[registrations] enhance data failed:', e);
    return res.status(201).json({ message: 'Registration submitted', registration: publicView(data) });
  }
};

// ─── GET /api/registrations/prefill/:token ────────────────────
const getPrefill = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { token } = req.params;
  const { data } = await supabase
    .from('demo_bookings')
    .select('hospital_name, contact_name, email, phone, city')
    .eq('feedback_token', token)
    .single();
  if (!data) return res.json({ prefill: null });
  return res.json({
    prefill: {
      hospitalName: data.hospital_name,
      contactName: data.contact_name,
      email: data.email,
      phone: data.phone,
      city: data.city
    }
  });
};

// ─── GET /api/registrations ──────────────────────────────────
const listRegistrations = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('[registrations] list error:', error);
    return res.status(500).json({ message: 'Could not load registrations' });
  }
  const counts = data.reduce((acc, r) => { acc.total += 1; acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, { total: 0, pending: 0, approved: 0, denied: 0, active: 0, inactive: 0 });

  const registrations = await Promise.all(data.map(async (r) => {
    try {
      let payment = null;
      if (r.booking_id) {
        const p = await supabase.from('payments').select('*').eq('booking_id', r.booking_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        payment = p.data || null;
      }
      if (!payment) {
        const p2 = await supabase.from('payments').select('*').eq('email', r.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
        payment = p2.data || null;
      }

      let subscription = null;
      if (payment && payment.subscription_id) {
        const resSub = await supabase.from('subscriptions').select('*').eq('id', payment.subscription_id).maybeSingle();
        subscription = resSub.data || null;
      }
      if (!subscription && payment?.stripe_session_id) {
        const fallbackKey = `one_time_${payment.stripe_session_id}`;
        const resSub = await supabase.from('subscriptions').select('*').eq('stripe_subscription_id', fallbackKey).maybeSingle();
        subscription = resSub.data || null;
      }
      return { ...publicView(r), payment: payment || null, subscription };
    } catch (e) {
      return publicView(r);
    }
  }));

  return res.json({ registrations, counts });
};

// ─── Ensure admin user ──────────────────────────────────────
const ensureAdminUser = async (reg) => {
  const existing = await Users.findByEmail(reg.email);
  if (existing) {
    return { user: existing, tempPassword: null, created: false };
  }

  const pwd = reg.details?.password || tempPassword();
  const user = await Users.insert({
    id: Date.now().toString(),
    name: reg.contact_name,
    email: reg.email,
    mobile: reg.phone || '',
    password: pwd,
    role: 'admin',
    hospital: reg.hospital_name,
    hospitalId: reg.hospital_id || '',
    active: true
  });
  return { user, tempPassword: pwd, created: true };
};

// ─── PATCH /api/registrations/:id ────────────────────────────
const updateRegistrationStatus = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { id } = req.params;
  const { status } = req.body || {};

  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ message: `status must be one of ${VALID_STATUS.join(', ')}` });
  }

  const { data: reg, error: findErr } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (findErr || !reg) return res.status(404).json({ message: 'Registration not found' });

  const update = { status, updated_at: new Date().toISOString() };

  if (status === 'approved' || status === 'active') {
    const { user, tempPassword: pwd } = await ensureAdminUser(reg);
    update.admin_user_id = user.id;
    if (status === 'approved') update.status = 'active';

    // ─── Fetch payment & subscription ──────────────────────
    try {
      let payment = null;
      if (reg.booking_id) {
        const p = await supabase.from('payments').select('*').eq('booking_id', reg.booking_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        payment = p.data || null;
      }
      if (!payment) {
        const p2 = await supabase.from('payments').select('*').eq('email', reg.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
        payment = p2.data || null;
      }

      if (!payment) {
        console.warn('[registrations] No payment found for registration:', reg.id);
      } else {
        console.log('[registrations] Found payment:', payment.id, 'plan_key:', payment.plan_key);
      }

      let subscription = null;
      if (payment && payment.subscription_id) {
        const s = await supabase.from('subscriptions').select('*').eq('id', payment.subscription_id).maybeSingle();
        subscription = s.data || null;
      }
      if (!subscription && payment?.stripe_session_id) {
        const fallbackKey = `one_time_${payment.stripe_session_id}`;
        const s = await supabase.from('subscriptions').select('*').eq('stripe_subscription_id', fallbackKey).maybeSingle();
        subscription = s.data || null;
      }

      // If no subscription, create one from the payment
      if (!subscription && payment && payment.plan_key) {
        console.log('[registrations] No subscription found, creating one from payment...');
        const plan = PLANS[payment.plan_key];
        const start = new Date().toISOString();
        const end = computeExpiry(start, plan);

        const { data: newSub, error: insertError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            hospital_id: reg.hospital_id || null,
            plan_key: payment.plan_key,
            plan_type: plan?.interval || 'monthly',
            stripe_subscription_id: `one_time_${payment.stripe_session_id || 'manual'}`,
            stripe_customer_id: null,
            status: 'active',
            start_date: start,
            expiry_date: end,
            amount: payment.amount || 0,
            currency: payment.currency || 'usd',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('[registrations] Failed to create subscription:', insertError);
        } else if (newSub) {
          console.log('[registrations] Subscription created:', newSub.id);
          subscription = newSub;
          // Link payment to subscription
          await supabase.from('payments').update({ subscription_id: newSub.id, updated_at: new Date().toISOString() }).eq('id', payment.id);
        }
      } else if (subscription) {
        // 🆕 Update subscription's user_id if it's null
        if (!subscription.user_id) {
          const { data: updatedSub, error: updateSubErr } = await supabase
            .from('subscriptions')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', subscription.id)
            .select()
            .single();
          if (!updateSubErr && updatedSub) {
            subscription = updatedSub;
            console.log('[registrations] Updated subscription user_id to:', user.id);
          } else {
            console.error('[registrations] Failed to update subscription user_id:', updateSubErr);
          }
        }
      }

      // Now annotate the user with plan details
      if (subscription) {
        let start = subscription.start_date;
        let end = subscription.expiry_date;
        if (!start || !end) {
          const plan = PLANS[subscription.plan_key];
          start = start || new Date().toISOString();
          end = end || computeExpiry(start, plan);
        }
        console.log('[registrations] Annotating user with subscription:', {
          userId: user.id,
          start,
          end,
          planKey: subscription.plan_key
        });
        await annotateUserWithSubscription({
          userId: user.id,
          planKey: subscription.plan_key,
          startDate: start,
          expiryDate: end,
          status: subscription.status
        });
      } else if (payment && payment.plan_key) {
        // Fallback: annotate user directly from payment (no subscription record)
        console.log('[registrations] No subscription, annotating user directly from payment');
        const plan = PLANS[payment.plan_key];
        const start = new Date().toISOString();
        const end = computeExpiry(start, plan);
        await annotateUserWithSubscription({
          userId: user.id,
          planKey: payment.plan_key,
          startDate: start,
          expiryDate: end,
          status: 'active'
        });
      } else {
        console.warn('[registrations] No payment or plan_key found, skipping user annotation');
      }
    } catch (e) {
      console.error('[registrations] Error during subscription/annotation:', e);
    }

    // ─── Send email ──────────────────────────────────────────
    const loginPassword = reg.details?.password || pwd || user.password || '';
    sendRegistrationApproved({
      to: reg.email,
      contactName: reg.contact_name,
      hospitalName: reg.hospital_name,
      loginEmail: user.email,
      tempPassword: loginPassword,
      origin: req.headers.origin
    }).catch((e) => console.error('[registrations] approved email failed:', e));
  }

  if (status === 'denied') {
    sendRegistrationDenied({ to: reg.email, contactName: reg.contact_name, hospitalName: reg.hospital_name })
      .catch((e) => console.error('[registrations] denied email failed:', e));
  }

  if (status === 'inactive' && reg.admin_user_id) {
    await Users.update(reg.admin_user_id, { active: false }).catch(() => {});
  }
  if (status === 'active' && reg.admin_user_id) {
    await Users.update(reg.admin_user_id, { active: true }).catch(() => {});
  }

  const { data, error } = await supabase.from(TABLE).update(update).eq('id', id).select().single();
  if (error) {
    console.error('[registrations] status error:', error);
    return res.status(500).json({ message: 'Could not update registration' });
  }
  return res.json({ message: `Registration ${update.status}`, registration: publicView(data) });
};

// ─── POST /api/registrations/:id/assign-hospital ──────────────
const assignHospital = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { id } = req.params;
  const { hospitalId } = req.body || {};
  if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

  const { data: reg, error: findErr } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (findErr || !reg) return res.status(404).json({ message: 'Registration not found' });

  if (reg.admin_user_id) {
    await Users.update(reg.admin_user_id, { hospitalId: String(hospitalId) }).catch(() => {});
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ hospital_id: String(hospitalId), updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) {
    console.error('[registrations] assign error:', error);
    return res.status(500).json({ message: 'Could not assign hospital' });
  }
  return res.json({ message: 'Hospital assigned', registration: publicView(data) });
};

// ─── DELETE /api/registrations/:id ────────────────────────────
const deleteRegistration = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { id } = req.params;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error('[registrations] delete error:', error);
    return res.status(500).json({ message: 'Could not delete registration' });
  }
  return res.json({ message: 'Registration deleted' });
};

module.exports = {
  createRegistration,
  getPrefill,
  listRegistrations,
  updateRegistrationStatus,
  assignHospital,
  deleteRegistration
};