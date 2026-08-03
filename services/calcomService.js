const API = 'https://api.cal.com/v2';
const KEY = process.env.CALCOM_API_KEY;
const EVENT_TYPE_ID = process.env.CALCOM_EVENT_TYPE_ID;
const TZ = process.env.CALCOM_TIMEZONE || 'Asia/Calcutta';
const DAYS_AHEAD = Number(process.env.CALCOM_DAYS_AHEAD || 14);
const START_HOUR = Number(process.env.SLOT_START_HOUR || 9);
const END_HOUR = Number(process.env.SLOT_END_HOUR || 17);
const STEP_MIN = Number(process.env.SLOT_STEP_MINUTES || 30);
const pad = (n) => String(n).padStart(2, '0');

const isConfigured = () => !!(KEY && EVENT_TYPE_ID);

const headers = (version) => ({
  Authorization: `Bearer ${KEY}`,
  'cal-api-version': version,
  'Content-Type': 'application/json'
});

const ymd = (d) => d.toISOString().slice(0, 10);

// Flat array of available slot start ISO strings for the next DAYS_AHEAD days.
const getAvailableSlots = async () => {
  const now = new Date();
  const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
  const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
  const res = await fetch(url, { headers: headers('2024-09-04') });
  const j = await res.json();
  const data = j?.data || {};
  const slots = [];
  for (const date of Object.keys(data)) {
    for (const s of data[date]) if (s?.start) slots.push(s.start);
  }
  return slots;
};

// Raw Cal.com availability grouped by date: { 'YYYY-MM-DD': [{start}] }.
const fetchAvailability = async () => {
  const now = new Date();
  const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
  const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
  const res = await fetch(url, { headers: headers('2024-09-04') });
  const j = await res.json();
  return j?.data || {};
};

// Full slot grid [{ iso, taken }]: green = Cal.com offers it, red = booked/unavailable.
const getSlotGrid = async () => {
  const data = await fetchAvailability();
  const firstDay = Object.values(data)[0];
  const offset = firstDay && firstDay[0] ? firstDay[0].start.slice(-6) : (process.env.CALCOM_UTC_OFFSET || '+00:00');
  const nowMs = Date.now();

  const grid = [];
  for (const date of Object.keys(data)) {
    const availSet = new Set(data[date].map((s) => new Date(s.start).getTime()));
    for (let h = START_HOUR; h < END_HOUR; h += 1) {
      for (let m = 0; m < 60; m += STEP_MIN) {
        const iso = `${date}T${pad(h)}:${pad(m)}:00.000${offset}`;
        const ts = new Date(iso).getTime();
        if (ts <= nowMs) continue; // hide past times
        grid.push({ iso, taken: !availSet.has(ts) });
      }
    }
  }
  return grid;
};

// Create a booking on Cal.com → { meetingUrl, uid, start }. Throws on failure.
const createBooking = async ({ start, name, email }) => {
  const res = await fetch(`${API}/bookings`, {
    method: 'POST',
    headers: headers('2024-08-13'),
    body: JSON.stringify({
      start,
      eventTypeId: Number(EVENT_TYPE_ID),
      attendee: { name: name || 'Guest', email, timeZone: TZ, language: 'en' }
    })
  });
  const j = await res.json();
  if (j?.status !== 'success' || !j.data) {
    const err = new Error(j?.error?.message || 'Cal.com booking failed');
    err.calcom = j;
    throw err;
  }
  return { meetingUrl: j.data.meetingUrl || j.data.location || null, uid: j.data.uid, start: j.data.start };
};

module.exports = { isConfigured, getAvailableSlots, getSlotGrid, createBooking, EVENT_TYPE_ID, TZ };
