const { supabase, isConfigured } = require('../config/supabase');

// Live counters for the superadmin overview. Everything is fetched with
// `head: true` + `count: 'exact'` so we pay for counts, not rows.

const countRows = async (table, apply) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) {
    // A missing table (e.g. contacts not migrated yet) shouldn't break the dashboard.
    console.error(`[stats] count ${table} error:`, error.message);
    return 0;
  }
  return count || 0;
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

// GET /api/stats/overview  (superadmin)
const getOverviewStats = async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Statistics are unavailable until Supabase is configured.' });
  }

  const today = startOfTodayISO();
  const monthStart = startOfMonthISO();

  try {
    const [
      // Registrations
      registrationsTotal,
      registrationsPending,
      registrationsApproved,
      registrationsDenied,
      registrationsToday,
      registrationsThisMonth,

      // Appointments (bookings)
      bookingsTotal,
      bookingsPending,
      bookingsConfirmed,
      bookingsCompleted,
      bookingsCancelled,
      bookingsToday,
      bookingsThisMonth,

      // Demos
      demosTotal,
      demosRequested,
      demosScheduled,
      demosCompleted,

      // Contacts
      contactsTotal,
      contactsNew,

      // Network
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

      countRows('hospitals'),
      countRows('users'),
      countRows('users', (q) => q.eq('role', 'admin'))
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      registrations: {
        total: registrationsTotal,
        pending: registrationsPending,
        approved: registrationsApproved,
        denied: registrationsDenied,
        today: registrationsToday,
        thisMonth: registrationsThisMonth
      },
      bookings: {
        total: bookingsTotal,
        pending: bookingsPending,
        confirmed: bookingsConfirmed,
        completed: bookingsCompleted,
        cancelled: bookingsCancelled,
        today: bookingsToday,
        thisMonth: bookingsThisMonth
      },
      demos: {
        total: demosTotal,
        requested: demosRequested,
        scheduled: demosScheduled,
        completed: demosCompleted
      },
      contacts: {
        total: contactsTotal,
        new: contactsNew
      },
      network: {
        hospitals: hospitalsTotal,
        users: usersTotal,
        admins: adminsTotal
      }
    });
  } catch (err) {
    console.error('[stats] overview error:', err);
    return res.status(500).json({ message: 'Could not load statistics' });
  }
};

module.exports = { getOverviewStats };
