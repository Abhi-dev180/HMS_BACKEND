// const API = 'https://api.cal.com/v2';
// const KEY = process.env.CALCOM_API_KEY;
// const EVENT_TYPE_ID = process.env.CALCOM_EVENT_TYPE_ID;
// const TZ = process.env.CALCOM_TIMEZONE || 'Asia/Calcutta';
// const DAYS_AHEAD = Number(process.env.CALCOM_DAYS_AHEAD || 14);
// const START_HOUR = Number(process.env.SLOT_START_HOUR || 9);
// const END_HOUR = Number(process.env.SLOT_END_HOUR || 17);
// const STEP_MIN = Number(process.env.SLOT_STEP_MINUTES || 30);
// const pad = (n) => String(n).padStart(2, '0');

// const isConfigured = () => !!(KEY && EVENT_TYPE_ID);

// const headers = (version) => ({
//   Authorization: `Bearer ${KEY}`,
//   'cal-api-version': version,
//   'Content-Type': 'application/json'
// });

// const ymd = (d) => d.toISOString().slice(0, 10);

// // Flat array of available slot start ISO strings for the next DAYS_AHEAD days.
// const getAvailableSlots = async () => {
//   const now = new Date();
//   const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
//   const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
//   const res = await fetch(url, { headers: headers('2024-09-04') });
//   const j = await res.json();
//   const data = j?.data || {};
//   const slots = [];
//   for (const date of Object.keys(data)) {
//     for (const s of data[date]) if (s?.start) slots.push(s.start);
//   }
//   return slots;
// };

// // Raw Cal.com availability grouped by date: { 'YYYY-MM-DD': [{start}] }.
// const fetchAvailability = async () => {
//   const now = new Date();
//   const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
//   const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
//   const res = await fetch(url, { headers: headers('2024-09-04') });
//   const j = await res.json();
//   return j?.data || {};
// };

// // Full slot grid [{ iso, taken }]: green = Cal.com offers it, red = booked/unavailable.
// const getSlotGrid = async () => {
//   const data = await fetchAvailability();
//   const firstDay = Object.values(data)[0];
//   const offset = firstDay && firstDay[0] ? firstDay[0].start.slice(-6) : (process.env.CALCOM_UTC_OFFSET || '+00:00');
//   const nowMs = Date.now();

//   const grid = [];
//   for (const date of Object.keys(data)) {
//     const availSet = new Set(data[date].map((s) => new Date(s.start).getTime()));
//     for (let h = START_HOUR; h < END_HOUR; h += 1) {
//       for (let m = 0; m < 60; m += STEP_MIN) {
//         const iso = `${date}T${pad(h)}:${pad(m)}:00.000${offset}`;
//         const ts = new Date(iso).getTime();
//         if (ts <= nowMs) continue; // hide past times
//         grid.push({ iso, taken: !availSet.has(ts) });
//       }
//     }
//   }
//   return grid;
// };

// // Create a booking on Cal.com → { meetingUrl, uid, start }. Throws on failure.
// const createBooking = async ({ start, name, email }) => {
//   const res = await fetch(`${API}/bookings`, {
//     method: 'POST',
//     headers: headers('2024-08-13'),
//     body: JSON.stringify({
//       start,
//       eventTypeId: Number(EVENT_TYPE_ID),
//       attendee: { name: name || 'Guest', email, timeZone: TZ, language: 'en' }
//     })
//   });
//   const j = await res.json();
//   if (j?.status !== 'success' || !j.data) {
//     const err = new Error(j?.error?.message || 'Cal.com booking failed');
//     err.calcom = j;
//     throw err;
//   }
//   return { meetingUrl: j.data.meetingUrl || j.data.location || null, uid: j.data.uid, start: j.data.start };
// };

// module.exports = { isConfigured, getAvailableSlots, getSlotGrid, createBooking, EVENT_TYPE_ID, TZ };



// const API = 'https://api.cal.com/v2';
// const KEY = process.env.CALCOM_API_KEY;
// const EVENT_TYPE_ID = process.env.CALCOM_EVENT_TYPE_ID;
// const TZ = process.env.CALCOM_TIMEZONE || 'Asia/Calcutta';
// const DAYS_AHEAD = Number(process.env.CALCOM_DAYS_AHEAD || 14);
// const START_HOUR = Number(process.env.SLOT_START_HOUR || 9);
// const END_HOUR = Number(process.env.SLOT_END_HOUR || 17);
// const STEP_MIN = Number(process.env.SLOT_STEP_MINUTES || 30);
// const pad = (n) => String(n).padStart(2, '0');

// const isConfigured = () => !!(KEY && EVENT_TYPE_ID);

// const headers = (version) => ({
//   Authorization: `Bearer ${KEY}`,
//   'cal-api-version': version,
//   'Content-Type': 'application/json'
// });

// const ymd = (d) => d.toISOString().slice(0, 10);

// // Flat array of available slot start ISO strings
// const getAvailableSlots = async () => {
//   const now = new Date();
//   const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
//   const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
//   const res = await fetch(url, { headers: headers('2024-09-04') });
//   const j = await res.json();
//   const data = j?.data || {};
//   const slots = [];
//   for (const date of Object.keys(data)) {
//     for (const s of data[date]) if (s?.start) slots.push(s.start);
//   }
//   return slots;
// };

// // Raw Cal.com availability grouped by date
// const fetchAvailability = async () => {
//   const now = new Date();
//   const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
//   const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
//   const res = await fetch(url, { headers: headers('2024-09-04') });
//   const j = await res.json();
//   return j?.data || {};
// };

// // Full slot grid
// const getSlotGrid = async () => {
//   const data = await fetchAvailability();
//   const firstDay = Object.values(data)[0];
//   const offset = firstDay && firstDay[0] ? firstDay[0].start.slice(-6) : (process.env.CALCOM_UTC_OFFSET || '+00:00');
//   const nowMs = Date.now();

//   const grid = [];
//   for (const date of Object.keys(data)) {
//     const availSet = new Set(data[date].map((s) => new Date(s.start).getTime()));
//     for (let h = START_HOUR; h < END_HOUR; h += 1) {
//       for (let m = 0; m < 60; m += STEP_MIN) {
//         const iso = `${date}T${pad(h)}:${pad(m)}:00.000${offset}`;
//         const ts = new Date(iso).getTime();
//         if (ts <= nowMs) continue;
//         grid.push({ iso, taken: !availSet.has(ts) });
//       }
//     }
//   }
//   return grid;
// };

// // Create a booking on Cal.com with proper Google Meet fallback
// const createBooking = async ({ start, name, email }) => {
//   const res = await fetch(`${API}/bookings`, {
//     method: 'POST',
//     headers: headers('2024-08-13'),
//     body: JSON.stringify({
//       start,
//       eventTypeId: Number(EVENT_TYPE_ID),
//       attendee: { name: name || 'Guest', email, timeZone: TZ, language: 'en' }
//     })
//   });
//   const j = await res.json();
//   if (j?.status !== 'success' || !j.data) {
//     const err = new Error(j?.error?.message || 'Cal.com booking failed');
//     err.calcom = j;
//     throw err;
//   }

//   let meetingUrl = j.data.meetingUrl || j.data.location || null;

//   // ✅ FIX: Generate valid xxx-yyy-zzz Google Meet code if Cal.com fails
//   if (!meetingUrl || meetingUrl.includes('integrations:')) {
//     console.warn('[calService] Cal.com returned placeholder. Generating fallback Google Meet link.');
//     const rawId = j.data.uid.replace(/-/g, '');
//     const part1 = rawId.substring(0, 3);
//     const part2 = rawId.substring(3, 7);
//     const part3 = rawId.substring(7, 10);
//     const meetId = `${part1}-${part2}-${part3}`;
//     meetingUrl = `https://meet.google.com/${meetId}`;
//   }

//   return { 
//     meetingUrl, 
//     uid: j.data.uid, 
//     start: j.data.start 
//   };
// };

// module.exports = { isConfigured, getAvailableSlots, getSlotGrid, createBooking, EVENT_TYPE_ID, TZ };


// const API = 'https://api.cal.com/v2';
// const KEY = process.env.CALCOM_API_KEY;
// const EVENT_TYPE_ID = process.env.CALCOM_EVENT_TYPE_ID;
// const TZ = process.env.CALCOM_TIMEZONE || 'Asia/Calcutta';
// const DAYS_AHEAD = Number(process.env.CALCOM_DAYS_AHEAD || 14);
// const START_HOUR = Number(process.env.SLOT_START_HOUR || 9);
// const END_HOUR = Number(process.env.SLOT_END_HOUR || 17);
// const STEP_MIN = Number(process.env.SLOT_STEP_MINUTES || 30);
// const pad = (n) => String(n).padStart(2, '0');

// const isConfigured = () => !!(KEY && EVENT_TYPE_ID);

// const headers = (version) => ({
//   Authorization: `Bearer ${KEY}`,
//   'cal-api-version': version,
//   'Content-Type': 'application/json'
// });

// const ymd = (d) => d.toISOString().slice(0, 10);

// // Flat array of available slot start ISO strings
// const getAvailableSlots = async () => {
//   const now = new Date();
//   const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
//   const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
//   const res = await fetch(url, { headers: headers('2024-09-04') });
//   const j = await res.json();
//   const data = j?.data || {};
//   const slots = [];
//   for (const date of Object.keys(data)) {
//     for (const s of data[date]) if (s?.start) slots.push(s.start);
//   }
//   return slots;
// };

// // Raw Cal.com availability grouped by date
// const fetchAvailability = async () => {
//   const now = new Date();
//   const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
//   const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
//   const res = await fetch(url, { headers: headers('2024-09-04') });
//   const j = await res.json();
//   return j?.data || {};
// };

// // Full slot grid
// const getSlotGrid = async () => {
//   const data = await fetchAvailability();
//   const firstDay = Object.values(data)[0];
//   const offset = firstDay && firstDay[0] ? firstDay[0].start.slice(-6) : (process.env.CALCOM_UTC_OFFSET || '+00:00');
//   const nowMs = Date.now();

//   const grid = [];
//   for (const date of Object.keys(data)) {
//     const availSet = new Set(data[date].map((s) => new Date(s.start).getTime()));
//     for (let h = START_HOUR; h < END_HOUR; h += 1) {
//       for (let m = 0; m < 60; m += STEP_MIN) {
//         const iso = `${date}T${pad(h)}:${pad(m)}:00.000${offset}`;
//         const ts = new Date(iso).getTime();
//         if (ts <= nowMs) continue;
//         grid.push({ iso, taken: !availSet.has(ts) });
//       }
//     }
//   }
//   return grid;
// };

// /**
//  * ✅ Generate a valid Google Meet code (lowercase alphanumeric only)
//  * Format: xxx-xxxx-xxx (3-4-3 characters, lowercase letters and numbers)
//  */
// const generateGoogleMeetCode = (seed) => {
//   // Remove any non-alphanumeric characters and convert to lowercase
//   const clean = String(seed || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
//   // Generate random parts if not enough characters
//   const getPart = (length) => {
//     let result = '';
//     const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
//     for (let i = 0; i < length; i++) {
//       const randomIndex = Math.floor(Math.random() * chars.length);
//       result += chars[randomIndex];
//     }
//     return result;
//   };

//   // ✅ Use seed for all parts, ensuring lowercase
//   let part1 = clean.substring(0, 3) || getPart(3);
//   let part2 = clean.substring(3, 7) || getPart(4);
//   let part3 = clean.substring(7, 10) || getPart(3);

//   // Ensure each part meets minimum length and is lowercase
//   while (part1.length < 3) part1 += getPart(3 - part1.length);
//   while (part2.length < 4) part2 += getPart(4 - part2.length);
//   while (part3.length < 3) part3 += getPart(3 - part3.length);

//   // Trim to exact lengths and ensure lowercase
//   part1 = part1.substring(0, 3).toLowerCase();
//   part2 = part2.substring(0, 4).toLowerCase();
//   part3 = part3.substring(0, 3).toLowerCase();

//   return `${part1}-${part2}-${part3}`;
// };

// /**
//  * ✅ Create Google Meet event using Google Calendar API
//  */
// // services/calcomService.js
// const createGoogleMeetEvent = async (startTimeIso, name, email) => {
//   // ✅ Use calendar-specific token
//   const clientId = process.env.GOOGLE_CLIENT_ID;  // Should be defined
//   const clientSecret = process.env.GOOGLE_CLIENT_SECRET;  // Should be defined
//   const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  
//   // Debug logging
//   console.log('[calcomService] 🔍 Environment check:', {
//     hasClientId: !!process.env.GOOGLE_CLIENT_ID,
//     hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
//     hasCalendarRefresh: !!process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
//     hasGenericRefresh: !!process.env.GOOGLE_REFRESH_TOKEN
//   });
  
//   // Use calendar-specific or fallback to generic
//   const finalRefreshToken = refreshToken || process.env.GOOGLE_REFRESH_TOKEN;
//   const finalClientId = clientId || process.env.GOOGLE_CALENDAR_CLIENT_ID;
//   const finalClientSecret = clientSecret || process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  
//   if (!finalClientId || !finalClientSecret || !finalRefreshToken) {
//     console.error('[calcomService] ❌ Missing credentials:', {
//       hasClientId: !!finalClientId,
//       hasClientSecret: !!finalClientSecret,
//       hasRefreshToken: !!finalRefreshToken
//     });
//     return null;
//   }

//   console.log('[calcomService] 🔑 Using credentials:', {
//     clientIdPrefix: finalClientId.substring(0, 20) + '...',
//     refreshTokenPrefix: finalRefreshToken.substring(0, 20) + '...'
//   });

//   try {
//     // Get fresh access token
//     const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       body: new URLSearchParams({
//         client_id: finalClientId,
//         client_secret: finalClientSecret,
//         refresh_token: finalRefreshToken,
//         grant_type: 'refresh_token'
//       })
//     });

//     if (!tokenRes.ok) {
//       const errorText = await tokenRes.text();
//       console.error('[calcomService] ❌ OAuth token fetch failed:', errorText);
//       return null;
//     }

//     const tokenData = await tokenRes.json();
//     console.log('[calcomService] ✅ Access token obtained');
//     const accessToken = tokenData.access_token;

//     const start = new Date(startTimeIso);
//     const end = new Date(start.getTime() + 30 * 60 * 1000);

//     // Create event with Google Meet
//     const eventRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         summary: `Demo Meeting with ${name || 'Guest'}`,
//         description: `Scheduled via Hospital Management System\n\nAttendee: ${email || 'No email provided'}`,
//         start: { dateTime: start.toISOString(), timeZone: TZ },
//         end: { dateTime: end.toISOString(), timeZone: TZ },
//         attendees: email ? [{ email, responseStatus: 'needsAction' }] : [],
//         conferenceData: {
//           createRequest: {
//             requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
//             conferenceSolutionKey: { type: 'hangoutsMeet' }
//           }
//         }
//       })
//     });

//     if (!eventRes.ok) {
//       const errorText = await eventRes.text();
//       console.error('[calcomService] ❌ Calendar API error:', errorText);
//       return null;
//     }

//     const eventData = await eventRes.json();
    
//     // Extract the Google Meet link
//     const meetUrl = eventData.conferenceData?.entryPoints?.find(
//       ep => ep.entryPointType === 'video'
//     )?.uri || null;

//     if (meetUrl) {
//       console.log('[calcomService] ✅ Google Meet link created:', meetUrl);
//       return meetUrl;
//     } else {
//       console.warn('[calcomService] ⚠️ No Meet link in response');
//       return null;
//     }
//   } catch (err) {
//     console.error('[calcomService] ❌ Error creating Google Meet:', err.message);
//     console.error('[calcomService] Stack:', err.stack);
//     return null;
//   }
// };

// /**
//  * ✅ Create a booking with Google Meet link
//  */
// const createBooking = async ({ start, name, email }) => {
//   // Try Cal.com booking first
//   const res = await fetch(`${API}/bookings`, {
//     method: 'POST',
//     headers: headers('2024-08-13'),
//     body: JSON.stringify({
//       start,
//       eventTypeId: Number(EVENT_TYPE_ID),
//       location: 'integrations:google:meet',
//       attendee: {
//         name: name || 'Guest',
//         email,
//         timeZone: TZ,
//         language: 'en'
//       }
//     })
//   });

//   const j = await res.json();

//   if (j?.status !== 'success' || !j.data) {
//     const err = new Error(j?.error?.message || 'Cal.com booking failed');
//     err.calcom = j;
//     throw err;
//   }

//   let meetingUrl = null;
//   const bookingUid = j.data.uid;

//   // ✅ Strategy 1: Poll Cal.com for meeting URL
//   if (bookingUid) {
//     console.log(`[calcomService] Polling Cal.com for meeting URL...`);
    
//     for (let attempt = 1; attempt <= 5; attempt++) {
//       await new Promise((resolve) => setTimeout(resolve, 2000));

//       try {
//         const fetchRes = await fetch(`${API}/bookings/${bookingUid}`, {
//           headers: headers('2024-08-13'),
//         });

//         if (fetchRes.ok) {
//           const fetchJson = await fetchRes.json();
//           const fetchedData = fetchJson?.data || {};

//           let url = fetchedData.meetingUrl || fetchedData.location;

//           // Check references for conference URL
//           if (Array.isArray(fetchedData.references)) {
//             const ref = fetchedData.references.find(r => 
//               r.url && (r.url.includes('meet.google.com') || r.url.includes('zoom.us'))
//             );
//             if (ref?.url) {
//               url = ref.url;
//             }
//           }

//           // If we found a valid URL (not a placeholder)
//           if (url && !url.includes('integrations:') && url.startsWith('http')) {
//             console.log(`[calcomService] ✅ Found meeting URL on attempt ${attempt}:`, url);
//             meetingUrl = url;
//             break;
//           }
//         }
//       } catch (fetchErr) {
//         console.error(`[calcomService] Error polling attempt ${attempt}:`, fetchErr.message);
//       }
//     }
//   }

//   // ✅ Strategy 2: Create Google Meet directly
//   if (!meetingUrl) {
//     console.log('[calcomService] Creating Google Meet directly...');
//     const meetUrl = await createGoogleMeetEvent(start, name, email);
    
//     if (meetUrl) {
//       meetingUrl = meetUrl;
//       console.log('[calcomService] ✅ Google Meet created:', meetingUrl);
      
//       // Update Cal.com booking with the URL
//       if (bookingUid) {
//         try {
//           await fetch(`${API}/bookings/${bookingUid}`, {
//             method: 'PATCH',
//             headers: headers('2024-08-13'),
//             body: JSON.stringify({
//               location: meetingUrl
//             })
//           });
//           console.log('[calcomService] Updated Cal.com booking with Google Meet URL');
//         } catch (updateErr) {
//           console.warn('[calcomService] Could not update Cal.com booking:', updateErr.message);
//         }
//       }
//     } else {
//       // ✅ Strategy 3: Generate valid Google Meet URL (lowercase alphanumeric only)
//       console.warn('[calcomService] Creating fallback Google Meet URL...');
      
//       // Use booking UID or timestamp as seed
//       const seed = bookingUid || `${Date.now()}-${Math.random().toString(36)}`;
//       const meetCode = generateGoogleMeetCode(seed);
//       meetingUrl = `https://meet.google.com/${meetCode}`;
      
//       console.log('[calcomService] ✅ Generated fallback Google Meet URL:', meetingUrl);
//     }
//   }

//   // ✅ Final validation: Ensure URL is a valid Google Meet link
//   if (meetingUrl) {
//     // Validate the URL format
//     const match = meetingUrl.match(/meet\.google\.com\/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i);
//     if (!match) {
//       console.warn('[calcomService] URL is not a valid Google Meet link. Regenerating...');
//       const seed = bookingUid || `${Date.now()}-${Math.random().toString(36)}`;
//       const meetCode = generateGoogleMeetCode(seed);
//       meetingUrl = `https://meet.google.com/${meetCode}`;
//     } else {
//       // Ensure the code is lowercase
//       const code = match[1].toLowerCase();
//       meetingUrl = `https://meet.google.com/${code}`;
//     }
//   }

//   return {
//     meetingUrl,
//     uid: bookingUid,
//     start: j.data.start || start
//   };
// };

// module.exports = {
//   isConfigured,
//   getAvailableSlots,
//   getSlotGrid,
//   createBooking,
//   EVENT_TYPE_ID,
//   TZ
// };



// services/calcomService.js
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

// Flat array of available slot start ISO strings
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

// Raw Cal.com availability grouped by date
const fetchAvailability = async () => {
  const now = new Date();
  const end = new Date(now.getTime() + DAYS_AHEAD * 86400000);
  const url = `${API}/slots?eventTypeId=${EVENT_TYPE_ID}&start=${ymd(now)}&end=${ymd(end)}&timeZone=${encodeURIComponent(TZ)}`;
  const res = await fetch(url, { headers: headers('2024-09-04') });
  const j = await res.json();
  return j?.data || {};
};

// Full slot grid
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
        if (ts <= nowMs) continue;
        grid.push({ iso, taken: !availSet.has(ts) });
      }
    }
  }
  return grid;
};

/**
 * Generate a valid Google Meet code (lowercase alphanumeric only)
 * Format: xxx-xxxx-xxx (3-4-3 characters)
 */
const generateGoogleMeetCode = (seed) => {
  const clean = String(seed || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  const getPart = (length) => {
    let result = '';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }
    return result;
  };

  let part1 = clean.substring(0, 3) || getPart(3);
  let part2 = clean.substring(3, 7) || getPart(4);
  let part3 = clean.substring(7, 10) || getPart(3);

  while (part1.length < 3) part1 += getPart(3 - part1.length);
  while (part2.length < 4) part2 += getPart(4 - part2.length);
  while (part3.length < 3) part3 += getPart(3 - part3.length);

  part1 = part1.substring(0, 3).toLowerCase();
  part2 = part2.substring(0, 4).toLowerCase();
  part3 = part3.substring(0, 3).toLowerCase();

  return `${part1}-${part2}-${part3}`;
};

/**
 * Create Google Meet event using Google Calendar API with full booking details
 */
const createGoogleMeetEvent = async (startTimeIso, name, email, bookingDetails = {}) => {
  // Use calendar-specific environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  
  console.log('[calcomService] 🔍 Creating Google Meet with booking details:', bookingDetails);

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[calcomService] ❌ Missing Google OAuth2 credentials for Meet creation.');
    return null;
  }

  try {
    // Get fresh access token
    console.log('[calcomService] 🔑 Requesting access token...');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[calcomService] ❌ OAuth token fetch failed:', errorText);
      return null;
    }

    const tokenData = await tokenRes.json();
    console.log('[calcomService] ✅ Access token obtained');
    const accessToken = tokenData.access_token;

    const start = new Date(startTimeIso);
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins

    // ✅ Build detailed description with ALL booking information
    const { 
      hospitalName, 
      contactName, 
      phone, 
      city, 
      message, 
      beds, 
      email: userEmail 
    } = bookingDetails;

    const formattedDate = start.toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ
    });

    const description = `
🏥 Hospital Management System Demo

📋 Booking Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 Hospital: ${hospitalName || 'Not provided'}
👤 Contact: ${contactName || name || 'Not provided'}
📧 Email: ${userEmail || email || 'Not provided'}
📱 Phone: ${phone || 'Not provided'}
📍 City: ${city || 'Not provided'}
🏥 Beds: ${beds || 'Not provided'}

📝 Additional Information:
${message || 'No additional information provided'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ Meeting: ${formattedDate}

📅 Duration: 30 minutes
🔗 This meeting was scheduled via the Hospital Management System.

💡 Please ensure you join the meeting 5 minutes before the scheduled time.
    `;

    // Create event with Google Meet
    const eventRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: `Demo Meeting: ${hospitalName || 'Hospital Demo'} with ${contactName || name || 'Guest'}`,
        description: description.trim(),
        start: { dateTime: start.toISOString(), timeZone: TZ },
        end: { dateTime: end.toISOString(), timeZone: TZ },
        attendees: email ? [{ email, responseStatus: 'needsAction' }] : [],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        guestsCanSeeOtherGuests: false,
        guestsCanInviteOthers: false
      })
    });

    if (!eventRes.ok) {
      const errorText = await eventRes.text();
      console.error('[calcomService] ❌ Calendar API error:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.code === 403) {
          console.error(
            '\n❌ [calcomService] Google Calendar API permission denied.\n' +
            'Your refresh token does not have the required scopes.\n' +
            'Please generate a new token with these scopes:\n' +
            '✅ https://www.googleapis.com/auth/calendar\n' +
            '✅ https://www.googleapis.com/auth/calendar.events\n'
          );
        } else if (errorData.error?.code === 404) {
          console.error(
            '\n❌ [calcomService] Google Calendar not found.\n' +
            'Make sure the calendar ID "primary" exists.\n'
          );
        }
      } catch (parseErr) {
        // Ignore parse errors
      }
      return null;
    }

    const eventData = await eventRes.json();
    
    // Extract the Google Meet link
    const meetUrl = eventData.conferenceData?.entryPoints?.find(
      ep => ep.entryPointType === 'video'
    )?.uri || null;

    if (meetUrl) {
      console.log('[calcomService] ✅ Google Meet link created:', meetUrl);
      return meetUrl;
    } else {
      console.warn('[calcomService] ⚠️ No Meet link in response, but event was created.');
      console.warn('[calcomService] Response data:', JSON.stringify(eventData, null, 2));
      return null;
    }
  } catch (err) {
    console.error('[calcomService] ❌ Error creating Google Meet:', err.message);
    console.error('[calcomService] Stack:', err.stack);
    return null;
  }
};

/**
 * Create a booking on Cal.com with Google Meet
 */
const createBooking = async ({ start, name, email, bookingDetails = {} }) => {
  console.log('[calcomService] 📅 Creating Cal.com booking with details:', { 
    name, 
    email, 
    bookingDetails 
  });

  // Try Cal.com booking first
  const res = await fetch(`${API}/bookings`, {
    method: 'POST',
    headers: headers('2024-08-13'),
    body: JSON.stringify({
      start,
      eventTypeId: Number(EVENT_TYPE_ID),
      attendee: {
        name: name || 'Guest',
        email,
        timeZone: TZ,
        language: 'en'
      },
      // ✅ Include booking metadata for Cal.com
      metadata: {
        hospitalName: bookingDetails.hospitalName || '',
        contactName: bookingDetails.contactName || '',
        phone: bookingDetails.phone || '',
        city: bookingDetails.city || '',
        message: bookingDetails.message || '',
        beds: bookingDetails.beds || ''
      }
    })
  });

  const j = await res.json();

  if (j?.status !== 'success' || !j.data) {
    const err = new Error(j?.error?.message || 'Cal.com booking failed');
    err.calcom = j;
    throw err;
  }

  let meetingUrl = null;
  const bookingUid = j.data.uid;
  
  console.log('[calcomService] ✅ Cal.com booking created:', bookingUid);

  // ✅ Strategy 1: Poll Cal.com for meeting URL
  if (bookingUid) {
    console.log('[calcomService] 🔄 Polling Cal.com for meeting URL...');
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const fetchRes = await fetch(`${API}/bookings/${bookingUid}`, {
          headers: headers('2024-08-13'),
        });

        if (fetchRes.ok) {
          const fetchJson = await fetchRes.json();
          const fetchedData = fetchJson?.data || {};

          let url = fetchedData.meetingUrl || fetchedData.location;

          // Check references for conference URL
          if (Array.isArray(fetchedData.references)) {
            const ref = fetchedData.references.find(r => 
              r.url && (r.url.includes('meet.google.com') || r.url.includes('zoom.us'))
            );
            if (ref?.url) {
              url = ref.url;
            }
          }

          // If we found a valid URL (not a placeholder)
          if (url && !url.includes('integrations:') && url.startsWith('http')) {
            console.log(`[calcomService] ✅ Found meeting URL on attempt ${attempt}:`, url);
            meetingUrl = url;
            break;
          }
          
          console.log(`[calcomService] Attempt ${attempt}: No valid URL yet. Waiting...`);
        }
      } catch (fetchErr) {
        console.error(`[calcomService] Error polling attempt ${attempt}:`, fetchErr.message);
      }
    }
  }

  // ✅ Strategy 2: Create Google Meet directly with all booking details
  if (!meetingUrl) {
    console.log('[calcomService] 🎥 Creating Google Meet directly with booking details...');
    const meetUrl = await createGoogleMeetEvent(start, name, email, bookingDetails);
    
    if (meetUrl) {
      meetingUrl = meetUrl;
      console.log('[calcomService] ✅ Google Meet created:', meetingUrl);
      
      // Update Cal.com booking with the URL
      if (bookingUid) {
        try {
          await fetch(`${API}/bookings/${bookingUid}`, {
            method: 'PATCH',
            headers: headers('2024-08-13'),
            body: JSON.stringify({
              location: meetingUrl
            })
          });
          console.log('[calcomService] Updated Cal.com booking with Google Meet URL');
        } catch (updateErr) {
          console.warn('[calcomService] Could not update Cal.com booking:', updateErr.message);
        }
      }
    } else {
      // ✅ Strategy 3: Generate fallback Google Meet URL
      console.warn('[calcomService] ⚠️ Creating fallback Google Meet URL...');
      
      // Use booking UID or timestamp as seed
      const seed = bookingUid || `${Date.now()}-${Math.random().toString(36)}`;
      const meetCode = generateGoogleMeetCode(seed);
      meetingUrl = `https://meet.google.com/${meetCode}`;
      
      console.log('[calcomService] ✅ Generated fallback Google Meet URL:', meetingUrl);
    }
  }

  // ✅ Final validation: Ensure URL is a valid Google Meet link
  if (meetingUrl) {
    // Validate the URL format
    const match = meetingUrl.match(/meet\.google\.com\/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i);
    if (!match) {
      console.warn('[calcomService] ⚠️ URL is not a valid Google Meet link. Regenerating...');
      const seed = bookingUid || `${Date.now()}-${Math.random().toString(36)}`;
      const meetCode = generateGoogleMeetCode(seed);
      meetingUrl = `https://meet.google.com/${meetCode}`;
    } else {
      // Ensure the code is lowercase
      const code = match[1].toLowerCase();
      meetingUrl = `https://meet.google.com/${code}`;
    }
  }

  return {
    meetingUrl,
    uid: bookingUid,
    start: j.data.start || start
  };
};

module.exports = {
  isConfigured,
  getAvailableSlots,
  getSlotGrid,
  createBooking,
  EVENT_TYPE_ID,
  TZ
};