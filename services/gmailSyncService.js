const { supabase } = require('../config/supabase');
const { readDB, writeDB } = require('../models');
const { uploadAttachmentToCloudinary } = require('./cloudinaryService');
const { broadcast } = require('./websocketService');

const T = 'contacts';

// Helper to acquire a fresh OAuth2 access token for Gmail API
const getAccessToken = async () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('[gmailSync] OAuth token fetch error:', err.message);
    return null;
  }
};

// Extract header value from Gmail API message payload
const getHeader = (headers = [], name = '') => {
  const match = headers.find((h) => h.name && h.name.toLowerCase() === name.toLowerCase());
  return match ? match.value : '';
};

// Parse email address and name from "Name <email@example.com>" string
const parseSender = (fromStr = '') => {
  const match = fromStr.match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
  if (match) {
    return { name: match[1] || match[2].split('@')[0], email: match[2] };
  }
  return { name: fromStr.split('@')[0] || 'Email Sender', email: fromStr };
};

/**
 * Poll Gmail Inbox for unread messages sent to rajdevfree@gmail.com
 * Automatically ingests them as Contact inquiries & triggers Pub/Sub
 */
const syncIncomingGmailMessages = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    // List unread messages in INBOX received today onwards
    const startOfTodaySec = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread label:INBOX after:${startOfTodaySec}&maxResults=15`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return;
    const listData = await listRes.json();

    const messages = listData.messages || [];
    if (messages.length === 0) return;

    console.log(`[gmailSync] Found ${messages.length} unread Gmail message(s) received today onwards.`);

    for (const msgItem of messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();

        const headers = msgData.payload?.headers || [];
        const fromRaw = getHeader(headers, 'From');
        const subject = getHeader(headers, 'Subject') || 'Support Email Inquiry';
        const dateRaw = getHeader(headers, 'Date');

        const { name, email } = parseSender(fromRaw);

        // Ignore messages sent by ourselves
        if (email.toLowerCase() === (process.env.GOOGLE_USER || '').toLowerCase()) {
          // Remove unread label so we don't keep checking
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          });
          continue;
        }

        // ─── Today Onwards Date Filter ───
        const msgDate = dateRaw ? new Date(dateRaw) : new Date();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        if (msgDate < startOfToday) {
          console.log(`[gmailSync] ⏭️ Skipping older email from before today (${dateRaw})`);
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          });
          continue;
        }

        const snippet = msgData.snippet || 'No message preview text available.';
        const cleanEmail = String(email).trim().toLowerCase();
        const cleanSubject = String(subject || '').trim();
        const emailSignature = `${cleanEmail}|${cleanSubject}`;

        const db = readDB();
        db.contacts = db.contacts || [];
        db.deleted_contact_ids = db.deleted_contact_ids || [];

        // ─── 1. Skip if message ID or signature was deleted by superadmin ───
        const isDeletedByAdmin = db.deleted_contact_ids.some(
          (d) => String(d) === String(msgItem.id) ||
            String(d) === `gmail_${msgItem.id}` ||
            String(d) === emailSignature
        );
        if (isDeletedByAdmin) {
          console.log(`[gmailSync] ⏭️ Skipping deleted inquiry ${msgItem.id} from ${cleanEmail}`);
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          });
          continue;
        }

        // ─── 2. Skip if inquiry already exists in database ──────────────────
        const existsInDb = db.contacts.some(
          (c) => String(c.id) === `gmail_${msgItem.id}` ||
            (String(c.email).toLowerCase() === cleanEmail && String(c.subject || '').trim() === cleanSubject)
        );
        if (existsInDb) {
          console.log(`[gmailSync] ⏭️ Skipping duplicate inquiry for ${cleanEmail} ("${cleanSubject}")`);
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          });
          continue;
        }

        // Create contact record
        const row = {
          id: `gmail_${msgItem.id}`,
          name: name || 'Email Sender',
          email: cleanEmail,
          subject: subject,
          phone: '',
          message: snippet,
          source: 'support_email',
          status: 'new',
          attachments: [],
          created_at: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Store contact record in local db.json
        db.contacts.unshift(row);
        writeDB(db);

        // Also sync to Supabase if available
        if (supabase) {
          try {
            await supabase.from(T).insert(row);
          } catch (e) { }
        }

        const savedRow = row;

        // Broadcast Pub/Sub event so it pops up in Admin Dashboard in real-time
        const publicContact = {
          id: String(savedRow.id),
          name: savedRow.name,
          email: savedRow.email,
          phone: savedRow.phone || '',
          subject: savedRow.subject,
          message: savedRow.message,
          status: savedRow.status || 'new',
          feedback: savedRow.feedback || '',
          attachments: savedRow.attachments || [],
          respondedAt: savedRow.responded_at || null,
          respondedBy: savedRow.responded_by || '',
          createdAt: savedRow.created_at,
          updatedAt: savedRow.updated_at,
          submittedAt: savedRow.created_at
        };

        broadcast('contact_created', publicContact);

        // Mark message as READ in Gmail so we don't duplicate
        await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}/modify`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
        });

        console.log(`[gmailSync] ✅ Ingested email from ${email} ("${subject}") to Admin Inbox.`);
      } catch (innerErr) {
        console.error(`[gmailSync] Error processing message ${msgItem.id}:`, innerErr.message);
      }
    }
  } catch (err) {
    console.error('[gmailSync] Sync error:', err.message);
  }
};

module.exports = { syncIncomingGmailMessages };
