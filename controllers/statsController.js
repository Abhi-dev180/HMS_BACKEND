
const { supabase, isConfigured } = require('../config/supabase');
const { readDB } = require('../models');

const isNetErr = (err) =>
  /fetch failed|timeout|ENOTFOUND|ECONNREFUSED|UND_ERR/i.test(String(err && (err.message || err.details || err)));

const countRows = async (table, apply) => {
  if (supabase) {
    try {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (apply) q = apply(q);
      const { count, error } = await q;
      if (!error && count !== null && count !== undefined) return count;
      if (error && !isNetErr(error)) console.error(`[stats] count ${table} error:`, error.message);
    } catch (e) {}
  }
  return null;
};

const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const startOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

// GET /api/stats/overview  (superadmin & admin)
const getOverviewStats = async (req, res) => {
  const today = startOfTodayISO();
  const monthStart = startOfMonthISO();

  try {
    const db = readDB();

    let [
      registrationsTotal,
      registrationsPending,
      registrationsApproved,
      registrationsDenied,
      registrationsToday,
      registrationsThisMonth,

      bookingsTotal,
      bookingsPending,
      bookingsConfirmed,
      bookingsCompleted,
      bookingsCancelled,
      bookingsToday,
      bookingsThisMonth,

      demosTotal,
      demosRequested,
      demosScheduled,
      demosCompleted,

      contactsTotal,
      contactsNew,

      feedbackTotal,
      feedbackPending,

      hospitalsTotal,
      usersTotal,
      adminsTotal
    ] = await Promise.all([
      countRows('registrations'),
      countRows('registrations', (q) => q.eq('status', 'pending')),
      countRows('registrations', (q) => q.eq('status', 'approved')),
      countRows('registrations', (q) => q.eq('status', 'denied')),
      countRows('registrations', (q) => q.gte('created_at', today)),
      countRows('registrations', (q) => q.gte('created_at', monthStart)),

      countRows('appointments'),
      countRows('appointments', (q) => q.eq('status', 'Pending')),
      countRows('appointments', (q) => q.eq('status', 'Confirmed')),
      countRows('appointments', (q) => q.eq('status', 'Completed')),
      countRows('appointments', (q) => q.eq('status', 'Cancelled')),
      countRows('appointments', (q) => q.gte('createdAt', today)),
      countRows('appointments', (q) => q.gte('createdAt', monthStart)),

      countRows('demo_bookings'),
      countRows('demo_bookings', (q) => q.eq('status', 'requested')),
      countRows('demo_bookings', (q) => q.eq('status', 'scheduled')),
      countRows('demo_bookings', (q) => q.eq('status', 'completed')),

      countRows('contacts'),
      countRows('contacts', (q) => q.eq('status', 'new')),

      countRows('appointment_feedbacks'),
      countRows('appointment_feedbacks', (q) => q.eq('feedbackStatus', 'Pending')),

      countRows('hospitals'),
      countRows('users'),
      countRows('users', (q) => q.eq('role', 'admin'))
    ]);

    // Fallback to local db.json counts if Supabase returned null
    const appts = db.appointments || [];
    const users = db.users || [];
    const hospitals = db.hospitals || [];
    const contacts = db.contacts || [];
    const feedbacks = db.feedbacks || [];

    if (bookingsTotal === null) {
      bookingsTotal = appts.length;
      bookingsPending = appts.filter((a) => a.status === 'Pending').length;
      bookingsConfirmed = appts.filter((a) => a.status === 'Confirmed').length;
      bookingsCompleted = appts.filter((a) => a.status === 'Completed').length;
      bookingsCancelled = appts.filter((a) => a.status === 'Cancelled').length;
      bookingsToday = appts.filter((a) => a.createdAt >= today).length;
      bookingsThisMonth = appts.filter((a) => a.createdAt >= monthStart).length;
    }
    if (hospitalsTotal === null) hospitalsTotal = hospitals.length;
    if (usersTotal === null) usersTotal = users.length;
    if (adminsTotal === null) adminsTotal = users.filter((u) => u.role === 'admin').length;
    // Calculate merged contacts counts (Supabase + local db.json)
    let mergedContacts = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('contacts').select('*');
        if (Array.isArray(data)) mergedContacts = data;
      } catch (e) {}
    }
    const localContacts = db.contacts || [];
    const contactMap = new Map();
    mergedContacts.forEach((c) => contactMap.set(String(c.id), c));
    localContacts.forEach((c) => {
      if (!contactMap.has(String(c.id))) {
        contactMap.set(String(c.id), c);
      }
    });
    const allContacts = Array.from(contactMap.values());
    contactsTotal = allContacts.length;
    contactsNew = allContacts.filter((c) => (c.status || 'new') === 'new').length;

    if (feedbackTotal === null) {
      feedbackTotal = feedbacks.length;
      feedbackPending = feedbacks.filter((f) => f.status === 'Pending').length;
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      registrations: {
        total: registrationsTotal || 0,
        pending: registrationsPending || 0,
        approved: registrationsApproved || 0,
        denied: registrationsDenied || 0,
        today: registrationsToday || 0,
        thisMonth: registrationsThisMonth || 0
      },
      bookings: {
        total: bookingsTotal || 0,
        pending: bookingsPending || 0,
        confirmed: bookingsConfirmed || 0,
        completed: bookingsCompleted || 0,
        cancelled: bookingsCancelled || 0,
        today: bookingsToday || 0,
        thisMonth: bookingsThisMonth || 0
      },
      appointments: {
        pending: bookingsPending || 0
      },
      demos: {
        total: demosTotal || 0,
        requested: demosRequested || 0,
        scheduled: demosScheduled || 0,
        completed: demosCompleted || 0
      },
      contacts: {
        total: contactsTotal || 0,
        new: contactsNew || 0
      },
      feedback: {
        total: feedbackTotal || 0,
        unread: feedbackPending || 0
      },
      network: {
        hospitals: hospitalsTotal || 0,
        users: usersTotal || 0,
        admins: adminsTotal || 0
      }
    });
  } catch (err) {
    console.error('[stats] overview error:', err);
    return res.status(500).json({ message: 'Could not load statistics' });
  }
};

module.exports = { getOverviewStats };