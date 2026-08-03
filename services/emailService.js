const nodemailer = require('nodemailer');
const dns = require('dns');

// ─── Force IPv4 globally ──────────────────────────────────────
dns.setDefaultResultOrder('ipv4first');

const templates = require('../email_template');

// ─── Environment variables ────────────────────────────────────
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const GOOGLE_USER = process.env.GOOGLE_USER;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// ─── Sender address ────────────────────────────────────────────
const MAIL_FROM =
  process.env.MAIL_FROM ||
  (GOOGLE_USER || GMAIL_USER
    ? `Pet Hospital Portal <${GOOGLE_USER || GMAIL_USER}>`
    : 'Pet Hospital Portal <no-reply@example.com>');

// ─── Transporter creation ──────────────────────────────────────
let transporter = null;
let authMethod = 'none';

if (GOOGLE_USER && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: {
      type: 'OAuth2',
      user: GOOGLE_USER,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GOOGLE_REFRESH_TOKEN
    }
  });
  authMethod = 'OAuth2';
  console.log('✅ Email transporter: OAuth2 (refresh token)');
} else if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });
  authMethod = 'App Password';
  console.log('✅ Email transporter: App Password');
} else {
  console.warn(
    '[email] No valid credentials found – emails will be logged and skipped.\n' +
      'Set either:\n' +
      '- GOOGLE_USER + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN (OAuth2), or\n' +
      '- GMAIL_USER + GMAIL_APP_PASSWORD (App Password)'
  );
}

// ─── Verify transporter ──────────────────────────────────────
if (transporter) {
  if (authMethod === 'App Password') {
    transporter.verify((error) => {
      if (error) {
        console.error('❌ Email transporter verification failed:', error.message);
      } else {
        console.log(`✅ Email transporter ready (${authMethod})`);
      }
    });
  } else {
    console.log('ℹ️ OAuth2 email transporter created; SMTP verification skipped. Gmail API is used by default for OAuth2 email sending.');
  }
}

// ─── HTML → plain text ────────────────────────────────────────
// An HTML-only email is one of the strongest spam signals there is, so every
// message goes out as multipart/alternative. This derives a readable text part
// from the template HTML rather than making each template maintain two copies.
const htmlToText = (html) => {
  let s = String(html || '');

  s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Drop the hidden preheader div — it only exists for the inbox preview line.
  s = s.replace(/<div[^>]*display:\s*none[\s\S]*?<\/div>/gi, '');

  // Keep link targets: "label (https://…)"
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
    const text = label.replace(/<[^>]+>/g, '').trim();
    if (!text) return href;
    return href.startsWith('mailto:') ? text : `${text} ( ${href} )`;
  });

  // Table cells → "Label: value" pairs; rows and blocks → newlines.
  s = s.replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ': ');
  s = s.replace(/<\/tr>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h1|h2|h3|h4|li|table)>/gi, '\n');

  s = s.replace(/<[^>]+>/g, '');

  // Decode the entities our escapeHtml() introduces.
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&copy;/gi, '(c)');

  // Collapse the whitespace the template indentation leaves behind.
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
};

// ─── Send via Gmail HTTPS API (Direct OAuth2) ──────────────
const sendViaGmailApi = async ({ to, subject, html, text }) => {
  const { GOOGLE_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  console.log('[email] Gmail API env check:', {
    hasUser: !!GOOGLE_USER,
    hasClientId: !!GOOGLE_CLIENT_ID,
    hasClientSecret: !!GOOGLE_CLIENT_SECRET,
    hasRefreshToken: !!GOOGLE_REFRESH_TOKEN
  });

  if (!GOOGLE_USER || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return null;
  }

  try {
    console.log('[email] Gmail token request starting');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    console.log('[email] Gmail token response status:', tokenRes.status);

    if (!tokenRes.ok) {
      const errData = await tokenRes.json();
      throw new Error(`OAuth token fetch failed: ${errData.error_description || errData.error}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

    // multipart/alternative: text first, then HTML (clients pick the last part
    // they can render). Sending HTML alone scores badly with spam filters.
    const boundary = `mixed_${Buffer.from(`${to}${subject}`).toString('hex').slice(0, 24)}`;
    const fromName = process.env.MAIL_BRAND_NAME || 'Pet Hospital Portal';
    const replyTo = process.env.MAIL_REPLY_TO || process.env.MAIL_SUPPORT_EMAIL || GOOGLE_USER;

    const messageParts = [
      `From: ${fromName} <${GOOGLE_USER}>`,
      `To: ${to}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      // Marks this as an automated transactional message, not bulk mail.
      'Auto-Submitted: auto-generated',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
      '',
      `--${boundary}--`
    ];
    const message = messageParts.join('\r\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedMessage })
    });

    console.log('[email] Gmail send response status:', sendRes.status);

    const sendData = await sendRes.json();
    console.log('[email] Gmail send response body:', sendData);

    if (!sendRes.ok) {
      throw new Error(`Gmail API error: ${sendData.error?.message || JSON.stringify(sendData)}`);
    }

    console.log(` [email] SENT via Gmail HTTPS API to: ${to} | Subject: ${subject} | MessageId: ${sendData.id}`);
    return { id: sendData.id };
  } catch (err) {
    console.error(`❌ [email] Gmail HTTPS API error for ${to}:`, err.message || err);
    return { error: err.message || err };
  }
};

// ─── Main send function ──────────────────────────────────────
const send = async ({ to, subject, html, text }) => {
  const recipient = String(to || '').trim();
  console.log('[email] send called:', { to: recipient, subject });

  if (!recipient) {
    console.warn(`⚠️ [email] Skipped — recipient 'to' address is missing! (Subject: ${subject})`);
    return { skipped: true, error: 'Missing recipient email' };
  }

  // Every message ships a plain-text alternative — templates don't have to
  // supply one, but they may override it by passing `text`.
  const plain = text || htmlToText(html);

  // Try Gmail API first (direct OAuth2)
  const gmailApiResult = await sendViaGmailApi({ to: recipient, subject, html, text: plain });
  if (gmailApiResult && !gmailApiResult.error) {
    return gmailApiResult;
  }

  // Fallback to nodemailer
  if (!transporter) {
    console.log(`[email] (skipped - no transporter) To: ${recipient} | Subject: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to: recipient,
      replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_SUPPORT_EMAIL || undefined,
      subject,
      text: plain,
      html,
      headers: { 'Auto-Submitted': 'auto-generated' }
    });

    console.log(`✅ [email] SENT successfully to: ${recipient} | Subject: ${subject} | MessageId: ${info.messageId}`);
    return { id: info.messageId };
  } catch (err) {
    console.error(`❌ [email] Failed to send email to ${recipient}:`, err.message || err);
    return { error: err.message || err };
  }
};

// ─── Template wrappers ──────────────────────────────────────
const sendDemoReceived = ({ to, ...vars }) => {
  console.log('[email] sendDemoReceived:', { to, vars });
  return send({ to, ...templates.demoReceived(vars) });
};

// USE THE BRANDED TEMPLATE – NOT PLAIN HTML
const sendScheduleInvite = ({ to, contactName, hospitalName, token }) => {
  console.log('[email] sendScheduleInvite:', { to, contactName, hospitalName, token });
  return send({ 
    to, 
    ...templates.scheduleInvite({ contactName, hospitalName, token }) 
  });
};

const sendDemoConfirmation = ({ to, ...vars }) => send({ to, ...templates.demoConfirmation(vars) });
const sendMeetingLink = ({ to, ...vars }) => send({ to, ...templates.meetingLinkReady(vars) });
const sendFeedbackRequest = ({ to, ...vars }) => send({ to, ...templates.feedbackRequest(vars) });
const sendRegistrationReceived = ({ to, ...vars }) => send({ to, ...templates.registrationReceived(vars) });
const sendRegistrationApproved = ({ to, ...vars }) => send({ to, ...templates.registrationApproved(vars) });
const sendRegistrationDenied = ({ to, ...vars }) => send({ to, ...templates.registrationDenied(vars) });
const sendPasswordResetOtp = ({ to, ...vars }) => send({ to, ...templates.passwordResetOtp(vars) });
const sendAppointmentConfirmation = ({ to, ...vars }) => send({ to, ...templates.appointmentConfirmation(vars) });
const sendAppointmentStatusUpdate = ({ to, ...vars }) => send({ to, ...templates.appointmentStatusUpdate(vars) });
const sendAppointmentRescheduled = ({ to, ...vars }) => send({ to, ...templates.appointmentRescheduled(vars) });
const sendAppointmentCancelled = ({ to, ...vars }) => send({ to, ...templates.appointmentCancelled(vars) });

// ─── Contact us ──────────────────────────────────────────────
const sendContactReceived = ({ to, ...vars }) => send({ to, ...templates.contactReceived(vars) });
const sendContactStatusUpdate = ({ to, ...vars }) => send({ to, ...templates.contactStatusUpdate(vars) });

// ─── Superadmin notifications ────────────────────────────────
// Address resolution order: SUPERADMIN_EMAIL (supports a comma-separated list)
// → the mailbox we authenticate as → skipped with a warning.
const getSuperAdminEmail = () => {
  const configured = (process.env.SUPERADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || '').trim();
  if (configured) {
    return configured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }
  return (process.env.GOOGLE_USER || process.env.GMAIL_USER || '').trim();
};

const notifySuperAdmin = async (template, vars) => {
  const to = getSuperAdminEmail();
  if (!to) {
    console.warn('[email] Superadmin notification skipped — set SUPERADMIN_EMAIL to enable it.');
    return { skipped: true, error: 'SUPERADMIN_EMAIL not configured' };
  }
  return send({ to, ...templates[template](vars) });
};

const sendContactNewToSuperAdmin = (vars) => notifySuperAdmin('contactNewForAdmin', vars);
const sendAppointmentNewToSuperAdmin = (vars) => notifySuperAdmin('appointmentNewForAdmin', vars);

const sendTestEmail = (to) =>
  send({
    to,
    subject: 'Email delivery test',
    html: templates.shell({
      heading: 'Email delivery test',
      intro: 'This is a test message sent from your backend to confirm email delivery is configured correctly.',
      bodyHtml: `
        <p style="margin:0 0 4px 0;">If you are reading this, the mail transport is working. No action is needed.</p>
        ${templates.detailRows([
          ['Recipient', to],
          ['Sent at', new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })]
        ])}
      `,
      footNote: 'You are receiving this because a delivery test was triggered from the admin backend.'
    })
  });

// ─── EXPORTS AT THE END ──────────────────────────────────────
module.exports = {
  send,
  htmlToText,
  sendDemoReceived,
  sendScheduleInvite,
  sendDemoConfirmation,
  sendMeetingLink,
  sendFeedbackRequest,
  sendRegistrationReceived,
  sendRegistrationApproved,
  sendRegistrationDenied,
  sendPasswordResetOtp,
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate,
  sendAppointmentRescheduled,
  sendAppointmentCancelled,
  sendAppointmentNewToSuperAdmin,
  sendContactReceived,
  sendContactStatusUpdate,
  sendContactNewToSuperAdmin,
  getSuperAdminEmail,
  sendTestEmail
};