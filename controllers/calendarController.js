const { supabase, isConfigured } = require('../config/supabase');

// Unified calendar feed for the dashboards: patient appointments + demo meetings
// in one normalised list, scoped to whoever is asking.
//
//   superadmin → everything
//   admin      → appointments for their own hospital only (demos are a sales-side
//                concern, so they're excluded)
//   user       → their own appointments

const APPOINTMENT_COLOURS = {
  Pending: 'amber',
  Confirmed: 'blue',
  'In Progress': 'indigo',
  Completed: 'emerald',
  Cancelled: 'red',
  Rescheduled: 'cyan'
};

const DEMO_COLOURS = {
  requested: 'amber',
  invited: 'purple',
  scheduled: 'blue',
  completed: 'emerald',
  cancelled: 'red'
};

// `date` + `time` are stored as separate text columns; combine them into the
// local ISO-ish string the frontend groups by. Returns null when unschedulable.
const toStartISO = (date, time) => {
  if (!date) return null;
  const t = /^\d{2}:\d{2}/.test(time || '') ? time.slice(0, 5) : '00:00';
  return `${date}T${t}:00`;
};

const appointmentEvent = (a) => {
  const start = toStartISO(a.date, a.time);
  return {
    id: `appointment-${a.id}`,
    recordId: a.id,
    type: 'appointment',
    title: a.patientName || 'Appointment',
    subtitle: a.hospital || '',
    date: a.date || null,
    time: a.time || '',
    start,
    status: a.status,
    colour: APPOINTMENT_COLOURS[a.status] || 'slate',
    meta: {
      petName: a.petName || '',
      phone: a.patientPhone || '',
      email: a.email || '',
      reason: a.reason || '',
      doctorName: a.doctorName || '',
      hospitalId: a.hospitalId || null
    }
  };
};

const demoEvent = (d) => {
  const start = d.scheduled_at || null;
  // demo_bookings stores a full timestamp, so derive the date/time parts from it.
  const dt = start ? new Date(start) : null;
  const pad = (n) => String(n).padStart(2, '0');

  return {
    id: `demo-${d.id}`,
    recordId: d.id,
    type: 'demo',
    title: d.hospital_name || 'Demo',
    subtitle: d.contact_name || '',
    date: dt ? `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` : null,
    time: dt ? `${pad(dt.getHours())}:${pad(dt.getMinutes())}` : '',
    start,
    status: d.status,
    colour: DEMO_COLOURS[d.status] || 'slate',
    meta: {
      email: d.email || '',
      phone: d.phone || '',
      city: d.city || '',
      meetingLink: d.meeting_link || ''
    }
  };
};

// GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
const getCalendarEvents = async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Calendar is unavailable until Supabase is configured.' });
  }

  const { from, to } = req.query;
  const { role, id: userId, hospitalId } = req.user;

  try {
    // ─── Appointments ─────────────────────────────────────────
    let aq = supabase.from('appointments').select('*');
    if (role === 'admin') aq = aq.eq('hospitalId', hospitalId);
    else if (role !== 'superadmin') aq = aq.eq('userId', userId);
    if (from) aq = aq.gte('date', from);
    if (to) aq = aq.lte('date', to);

    const { data: appointments, error: aErr } = await aq;
    if (aErr) {
      console.error('[calendar] appointments error:', aErr);
      return res.status(500).json({ message: 'Could not load calendar events' });
    }

    const events = (appointments || [])
      .filter((a) => a.date)
      .map(appointmentEvent);

    // ─── Demo meetings (superadmin only) ──────────────────────
    if (role === 'superadmin') {
      let dq = supabase.from('demo_bookings').select('*').not('scheduled_at', 'is', null);
      if (from) dq = dq.gte('scheduled_at', `${from}T00:00:00`);
      if (to) dq = dq.lte('scheduled_at', `${to}T23:59:59`);

      const { data: demos, error: dErr } = await dq;
      if (dErr) {
        // A demo-side failure shouldn't blank the whole calendar.
        console.error('[calendar] demos error:', dErr);
      } else {
        events.push(...(demos || []).map(demoEvent));
      }
    }

    events.sort((x, y) => String(x.start || '').localeCompare(String(y.start || '')));

    const counts = events.reduce(
      (acc, e) => {
        acc.total += 1;
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      },
      { total: 0, appointment: 0, demo: 0 }
    );

    return res.json({ events, counts, range: { from: from || null, to: to || null } });
  } catch (err) {
    console.error('[calendar] error:', err);
    return res.status(500).json({ message: 'Could not load calendar events' });
  }
};

module.exports = { getCalendarEvents };
