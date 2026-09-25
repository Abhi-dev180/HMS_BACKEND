
const { supabase } = require('../config/supabase');
const { readDB } = require('../models');
const { httpsFetch } = require('../utils/httpsFetch');

const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_USER || 'primary';
const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Calcutta';

// ─── Format time string to HH:mm (normalize HH:MM:SS -> HH:MM) ───
const formatTimeString = (t) => {
  if (!t) return '';
  const clean = String(t).trim();
  // Match HH:MM or HH:MM:SS (optionally more precision) and normalize to HH:MM
  const m = clean.match(/^(\d{1,2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (m) {
    const [h, mm] = m[1].split(':');
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  return clean;
};

let cachedCalendarToken = null;
let calendarTokenExpiresAt = 0;

const getGoogleAccessToken = async () => {
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const now = Date.now();
  if (cachedCalendarToken && calendarTokenExpiresAt > now + 60000) {
    return cachedCalendarToken;
  }

  try {
    const res = await httpsFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        cachedCalendarToken = data.access_token;
        calendarTokenExpiresAt = now + ((data.expires_in || 3600) * 1000);
        return cachedCalendarToken;
      }
    } else {
      console.warn('[googleCalendar] Token fetch notice:', res.statusText);
    }
  } catch (err) {
    console.warn('[googleCalendar] OAuth fetch notice:', err.message);
  }
  return null;
};
const isCancelledStatus = (st) => {
  if (!st) return false;
  const s = String(st).trim().toLowerCase();
  return s === 'cancelled' || s === 'rejected' || s === 'refunded' || s.includes('cancel') || s.includes('reject');
};

/**
 * Fetch booked time slots for a specific date and hospital.
 * Queries Google Calendar API (via OAuth2 or API Key) and merges with Supabase and db.json appointments.
 * Cancelled / rejected / refunded appointments are automatically excluded to free their slots.
 */
const getBookedSlotsForDate = async (dateStr, hospitalId) => {
  const bookedSlots = new Set();

  // 1. Query Supabase database appointments for the selected date
  try {
    if (supabase) {
      let query = supabase.from('appointments').select('time, date, status, hospitalId').eq('date', dateStr);
      if (hospitalId) {
        query = query.eq('hospitalId', String(hospitalId));
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        data.forEach((appt) => {
          if (!isCancelledStatus(appt.status) && appt.time) {
            bookedSlots.add(formatTimeString(appt.time));
          }
        });
      }
    }
  } catch (err) {
    console.error('[googleCalendarService] DB query error:', err);
  }

  // 2. Query local db.json appointments (hybrid sync fallback)
  try {
    const db = readDB();
    if (db && Array.isArray(db.appointments)) {
      db.appointments.forEach((appt) => {
        if (
          appt.date === dateStr &&
          (!hospitalId || String(appt.hospitalId) === String(hospitalId)) &&
          !isCancelledStatus(appt.status) &&
          appt.time
        ) {
          bookedSlots.add(formatTimeString(appt.time));
        }
      });
    }
  } catch (err) {
    console.error('[googleCalendarService] Local DB query error:', err);
  }

  // 3. Query Google Calendar API via OAuth2 or API Key
  try {
    const accessToken = await getGoogleAccessToken();
    const timeMin = new Date(`${dateStr}T00:00:00Z`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59Z`).toISOString();

    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      GOOGLE_CALENDAR_ID
    )}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`;

    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (GOOGLE_CALENDAR_API_KEY) {
      url += `&key=${GOOGLE_CALENDAR_API_KEY}`;
    } else {
      url = null;
    }

    if (url) {
      const res = await httpsFetch(url, { headers });
      if (res.ok) {
        const calData = await res.json();
        if (calData.items && Array.isArray(calData.items)) {
          calData.items.forEach((event) => {
            if (event.status === 'cancelled') return; // Exclude cancelled calendar events
            if (event.start && event.start.dateTime) {
              try {
                const eventDate = new Date(event.start.dateTime);
                // Convert event time to configured timezone and format HH:mm
                const hhmm = eventDate.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: TIMEZONE
                });
                bookedSlots.add(formatTimeString(hhmm));
              } catch (e) {
                console.warn('[googleCalendarService] parsing event time failed:', e.message);
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('[googleCalendarService] Calendar query notice:', err.message);
  }

  return Array.from(bookedSlots);
};

// ─── Create a Google Calendar event ───────────────────────────
const createCalendarEvent = async ({
  summary,
  description,
  start,
  end,
  attendees = [],
  timeZone = 'Asia/Calcutta'
}) => {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error('Unable to get access token');

  const event = {
    summary,
    description,
    start: { dateTime: start, timeZone },
    end: { dateTime: end, timeZone },
    attendees: attendees.map(email => ({ email }))
  };

  const res = await httpsFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );

  if (!res.ok) {
    const error = await res.json();
    console.error('[googleCalendar] create event error:', error);
    throw new Error(error.message || 'Failed to create calendar event');
  }

  const data = await res.json();
  return data;
};

// ─── Update a Google Calendar event ────────────────────────────
const updateCalendarEvent = async (eventId, { summary, description, start, end, timeZone = 'Asia/Calcutta' }) => {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error('Unable to get access token');

  const event = {};
  if (summary !== undefined) event.summary = summary;
  if (description !== undefined) event.description = description;
  if (start) event.start = { dateTime: start, timeZone };
  if (end) event.end = { dateTime: end, timeZone };

  const res = await httpsFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );

  if (!res.ok) {
    const error = await res.json();
    console.error('[googleCalendar] update event error:', error);
    throw new Error(error.message || 'Failed to update calendar event');
  }

  const data = await res.json();
  return data;
};

// ─── Delete a Google Calendar event ────────────────────────────
const deleteCalendarEvent = async (eventId) => {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error('Unable to get access token');

  const res = await httpsFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!res.ok) {
    const error = await res.json();
    console.error('[googleCalendar] delete event error:', error);
    throw new Error(error.message || 'Failed to delete calendar event');
  }

  return true;
};

module.exports = {
  getBookedSlotsForDate,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
};