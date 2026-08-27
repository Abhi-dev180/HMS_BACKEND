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
    ? `MEDPARK Hospital <${GOOGLE_USER || GMAIL_USER}>`
    : 'MEDPARK Hospital <no-reply@example.com>');

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
const htmlToText = (html) => {
  let s = String(html || '');

  s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');

  s = s.replace(/<div[^>]*display:\s*none[\s\S]*?<\/div>/gi, '');

  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
    const text = label.replace(/<[^>]+>/g, '').trim();
    if (!text) return href;
    return href.startsWith('mailto:') ? text : `${text} ( ${href} )`;
  });

  s = s.replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ': ');
  s = s.replace(/<\/tr>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h1|h2|h3|h4|li|table)>/gi, '\n');

  s = s.replace(/<[^>]+>/g, '');

  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&copy;/gi, '(c)');

  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
};

// ─── Send via Gmail HTTPS API (Direct OAuth2) ──────────────
const sendViaGmailApi = async ({ to, subject, html, text, attachments }) => {
  const { GOOGLE_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  console.log('[email] Gmail API env check:', {
    hasUser: !!GOOGLE_USER,
    hasClientId: !!GOOGLE_CLIENT_ID,
    hasClientSecret: !!GOOGLE_CLIENT_SECRET,
    hasRefreshToken: !!GOOGLE_REFRESH_TOKEN,
    hasAttachments: !!(attachments && attachments.length > 0)
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

    // Fetch attachment if any
    let attachmentPart = '';
    if (attachments && attachments.length > 0) {
      try {
        const att = attachments[0];
        let contentBase64 = '';
        if (att.path && att.path.startsWith('http')) {
          const response = await fetch(att.path);
          const arrayBuffer = await response.arrayBuffer();
          contentBase64 = Buffer.from(arrayBuffer).toString('base64');
        } else if (att.path && att.path.includes('base64,')) {
          contentBase64 = att.path.split('base64,')[1] || '';
        } else if (att.content) {
          contentBase64 = Buffer.from(att.content).toString('base64');
        }

        if (contentBase64) {
          attachmentPart = [
            `Content-Type: application/pdf; name="${att.filename || 'invoice.pdf'}"`,
            `Content-Disposition: attachment; filename="${att.filename || 'invoice.pdf'}"`,
            'Content-Transfer-Encoding: base64',
            '',
            contentBase64,
            ''
          ].join('\r\n');
        }
      } catch (e) {
        console.error('[email] Failed to download attachment for Gmail API:', e);
      }
    }

    const mainBoundary = `mixed_${Buffer.from(`${to}${subject}`).toString('hex').slice(0, 24)}`;
    const alternativeBoundary = `alt_${Buffer.from(`${to}${subject}`).toString('hex').slice(0, 24)}`;
    const fromName = process.env.MAIL_BRAND_NAME || 'MEDPARK Hospital';
    const replyTo = process.env.MAIL_REPLY_TO || process.env.MAIL_SUPPORT_EMAIL || GOOGLE_USER;

    const messageParts = [];
    messageParts.push(`From: ${fromName} <${GOOGLE_USER}>`);
    messageParts.push(`To: ${to}`);
    messageParts.push(`Reply-To: ${replyTo}`);
    messageParts.push(`Subject: ${utf8Subject}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Auto-Submitted: auto-generated');

    if (attachmentPart) {
      messageParts.push(`Content-Type: multipart/mixed; boundary="${mainBoundary}"`);
      messageParts.push('');
      messageParts.push(`--${mainBoundary}`);
      messageParts.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
      messageParts.push('');
      messageParts.push(`--${alternativeBoundary}`);
      messageParts.push('Content-Type: text/plain; charset=utf-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(text);
      messageParts.push('');
      messageParts.push(`--${alternativeBoundary}`);
      messageParts.push('Content-Type: text/html; charset=utf-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(html);
      messageParts.push('');
      messageParts.push(`--${alternativeBoundary}--`);
      messageParts.push('');
      messageParts.push(`--${mainBoundary}`);
      messageParts.push(attachmentPart);
      messageParts.push(`--${mainBoundary}--`);
    } else {
      messageParts.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
      messageParts.push('');
      messageParts.push(`--${alternativeBoundary}`);
      messageParts.push('Content-Type: text/plain; charset=utf-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(text);
      messageParts.push('');
      messageParts.push(`--${alternativeBoundary}`);
      messageParts.push('Content-Type: text/html; charset=utf-8');
      messageParts.push('Content-Transfer-Encoding: 7bit');
      messageParts.push('');
      messageParts.push(html);
      messageParts.push('');
      messageParts.push(`--${alternativeBoundary}--`);
    }

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
const send = async ({ to, subject, html, text, attachments }) => {
  const recipient = String(to || '').trim();
  console.log('[email] send called:', { to: recipient, subject });

  if (!recipient) {
    console.warn(`⚠️ [email] Skipped — recipient 'to' address is missing! (Subject: ${subject})`);
    return { skipped: true, error: 'Missing recipient email' };
  }

  const plain = text || htmlToText(html);

  const gmailApiResult = await sendViaGmailApi({ to: recipient, subject, html, text: plain, attachments });
  console.log('[email] Gmail API result:', gmailApiResult);
  if (gmailApiResult && !gmailApiResult.error) {
    return gmailApiResult;
  }

  if (!transporter) {
    console.log(`[email] (skipped - no transporter) To: ${recipient} | Subject: ${subject}`);
    return { skipped: true, error: gmailApiResult?.error || 'No transporter configured' };
  }

  console.log('[email] Falling back to SMTP transporter:', { authMethod, transporterAvailable: !!transporter });

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to: recipient,
      replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_SUPPORT_EMAIL || undefined,
      subject,
      text: plain,
      html,
      attachments: attachments || undefined,
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

const sendScheduleInvite = ({ to, contactName, hospitalName, token }) => {
  console.log('[email] sendScheduleInvite:', { to, contactName, hospitalName, token });
  return send({
    to,
    ...templates.scheduleInvite({ contactName, hospitalName, token })
  });
};

const sendDemoConfirmation = ({ to, ...vars }) => send({ to, ...templates.demoConfirmation(vars) });

const sendInvoicePaidEmail = ({ to, ...vars }) => {
  const mailOptions = { to, ...templates.invoicePaidEmail(vars) };
  if (vars.invoicePdfBuffer) {
    mailOptions.attachments = [
      {
        filename: `invoice_${vars.invoiceId || Date.now()}.pdf`,
        content: vars.invoicePdfBuffer
      }
    ];
  } else if (vars.invoicePdfUrl) {
    mailOptions.attachments = [
      {
        filename: `invoice_${vars.invoiceId || Date.now()}.pdf`,
        path: vars.invoicePdfUrl
      }
    ];
  }
  return send(mailOptions);
};
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
const sendContactReceived = ({ to, ...vars }) => send({ to, ...templates.contactReceived(vars) });
const sendContactStatusUpdate = ({ to, ...vars }) => send({ to, ...templates.contactStatusUpdate(vars) });

// ─── Appointment feedback invitation ─────────────────────
const sendAppointmentFeedbackInvitation = ({ to, ...vars }) =>
  send({ to, ...templates.appointmentFeedbackInvitation(vars) });

// ─── Subscription expiry notifications ──────────────────────
const sendSubscriptionExpiryReminder = ({ to, name, daysLeft, expiryDate, renewalLink }) => {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', { dateStyle: 'medium' });
  return send({
    to,
    ...templates.subscriptionExpiryReminder({ name, daysLeft, expiryDate: formattedDate, renewalLink })
  });
};

const sendSubscriptionExpired = ({ to, name, expiryDate, renewalLink }) => {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', { dateStyle: 'medium' });
  return send({
    to,
    ...templates.subscriptionExpired({ name, expiryDate: formattedDate, renewalLink })
  });
};

// ─── Superadmin notifications ────────────────────────────────
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
const sendPaymentReceivedToSuperAdmin = (vars) => notifySuperAdmin('paymentReceivedAdmin', vars);

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

// ─── OTP Email ────────────────────────────────────────────────
const sendOtpEmail = ({ to, name, otp }) => {
  return send({ to, ...templates.otpVerification({ name, otp }) });
};


// ─── Profile Updated ──────────────────────────────────────────
const profileUpdated = ({ name, email, changes, updatedAt }) => {
  const changeList = changes ? changes.split(',').map(c => c.trim()).filter(Boolean) : [];
  return {
    subject: 'Profile Updated',
    html: shell({
      heading: 'Profile Updated',
      intro: `Hello ${name || 'User'},`,
      bodyHtml: `
        <p style="margin: 0 0 14px 0;">Your profile has been successfully updated.</p>
        ${detailRows([
        ['Name', name],
        ['Email', email],
        ['Changes made', changeList.length ? changeList.join(', ') : 'No changes recorded'],
        ['Updated at', updatedAt ? new Date(updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now']
      ])}
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500;">
            ⚠️ If you didn't make these changes, please contact support immediately.
          </p>
        </div>
      `,
      footNote: 'This is an automated confirmation. Please do not reply.',
      showQuote: true  // ✅ includes random quote
    })
  };
};

// ─── Profile Updated Email ──────────────────────────────────
// const sendProfileUpdatedEmail = ({ to, name, changes, updatedAt }) => {
//   const subject = 'Profile Updated';
//     console.log('[email] sendProfileUpdatedEmail:', { to, name, changes });

//   const formattedDate = updatedAt ? new Date(updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now';
//   const html = `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
//       <h2 style="color: #1e40af; margin-bottom: 4px;">Profile Updated</h2>
//       <p style="color: #4b5563; margin-top: 4px;">Hello ${name || 'User'}, your profile has been successfully updated.</p>
//       <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
//         <p style="margin: 0 0 8px 0;"><strong>Changes made:</strong> ${changes || 'No changes recorded'}</p>
//         <p style="margin: 0;"><strong>Updated at:</strong> ${formattedDate}</p>
//       </div>
//       <p style="color: #dc2626; font-size: 14px;">If you didn't make these changes, please contact support immediately.</p>
//       <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated confirmation. Please do not reply.</p>
//     </div>
//   `;
//   return send({ to, ...templates.profileUpdated({ name, email: to, changes, updatedAt }) });
// };


// ─── Contact Reply Email with Cloudinary / Attachments ────────
const sendContactReplyEmail = ({ to, name, subject, originalMessage, replyMessage, adminName, attachments = [] }) => {
  const safeName = name || 'Valued Patient / Client';
  const safeSubject = subject || 'Response to your inquiry';
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  let attachmentHtml = '';
  if (attachments && attachments.length > 0) {
    attachmentHtml = `
      <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">📎 Attached Files & Cloudinary Documents</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${attachments.map(att => `
            <div style="padding: 10px 14px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;">
              📁 <strong style="color: #0f172a;">${att.filename || 'Attachment'}</strong>
              ${att.url ? ` &nbsp;•&nbsp; <a href="${att.url}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Download / View File</a>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${safeSubject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%); padding: 36px 40px; text-align: left;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td>
                        <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 50px; backdrop-filter: blur(10px); margin-bottom: 12px;">
                          <span style="color: #60a5fa; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">MEDPARK CITY CENTER</span>
                        </div>
                        <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; line-height: 1.2;">
                          Response to Your Inquiry
                        </h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- BODY -->
              <tr>
                <td style="padding: 40px;">
                  <p style="font-size: 16px; color: #1e293b; font-weight: 700; margin: 0 0 16px 0;">
                    Hello ${safeName},
                  </p>
                  <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                    Thank you for reaching out to Medpark City Center. Our team has reviewed your message regarding <strong style="color: #0f172a;">"${safeSubject}"</strong> and we have provided our response below.
                  </p>

                  <!-- ADMIN RESPONSE CARD -->
                  <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                      <span style="font-size: 12px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">🏥 Official Response</span>
                      <span style="font-size: 12px; color: #64748b;">${dateStr}</span>
                    </div>
                    <div style="font-size: 15px; color: #1e293b; line-height: 1.7; white-space: pre-wrap;">${replyMessage}</div>
                    ${adminName ? `<p style="margin: 16px 0 0 0; font-size: 13px; font-weight: 700; color: #2563eb;">— ${adminName}, Hospital Management</p>` : ''}
                  </div>

                  ${attachmentHtml}

                  <!-- ORIGINAL MESSAGE QUOTE -->
                  ${originalMessage ? `
                  <div style="margin-top: 28px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Your Original Message:</p>
                    <p style="margin: 0; font-size: 14px; color: #475569; font-style: italic; line-height: 1.5; white-space: pre-wrap;">"${originalMessage}"</p>
                  </div>
                  ` : ''}

                  <!-- CTA BUTTON -->
                  <div style="margin-top: 36px; text-align: center;">
                    <a href="https://hospital-management-sigma-six.vercel.app/contact" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 50px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">
                      Visit Medpark Portal
                    </a>
                  </div>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center;">
                  <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0f172a;">
                    Medpark City Center & Healthcare Network
                  </p>
                  <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                    24/7 Helpline: +91 9814538354 &nbsp;|&nbsp; Support: rajdevfree@gmail.com
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                    © ${new Date().getFullYear()} Medpark Hospital Management. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailAttachments = (attachments || []).map((att) => {
    if (att.url && att.url.trim()) return { filename: att.filename || 'attachment', path: att.url };
    if (att.path && att.path.startsWith('http')) return { filename: att.filename || 'attachment', path: att.path };
    if (att.data && att.data.includes('base64,')) {
      const base64Data = att.data.split('base64,')[1];
      return { filename: att.filename || 'attachment', content: Buffer.from(base64Data, 'base64') };
    }
    if (att.path && att.path.includes('base64,')) {
      const base64Data = att.path.split('base64,')[1];
      return { filename: att.filename || 'attachment', content: Buffer.from(base64Data, 'base64') };
    }
    if (att.content) return { filename: att.filename || 'attachment', content: att.content };
    return null;
  }).filter(Boolean);

  return send({
    to,
    subject: `Re: ${safeSubject}`,
    html,
    attachments: mailAttachments
  });
};

// ─── Profile Updated Email ──────────────────────────────────
const sendProfileUpdatedEmail = ({ to, name, changes, updatedAt }) => {
  console.log('[email] sendProfileUpdatedEmail:', { to, name, changes });
  const formattedDate = updatedAt ? new Date(updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1e40af; margin-bottom: 4px;">Profile Updated</h2>
      <p style="color: #4b5563; margin-top: 4px;">Hello ${name || 'User'}, your profile has been successfully updated.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Changes made:</strong> ${changes || 'Profile details updated'}</p>
        <p style="margin: 0;"><strong>Updated at:</strong> ${formattedDate}</p>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated confirmation from Medpark Hospital.</p>
    </div>
  `;
  return send({ to, subject: 'Your Profile Has Been Updated', html });
};

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
  sendAppointmentFeedbackInvitation,
  sendContactReceived,
  sendContactStatusUpdate,
  sendContactNewToSuperAdmin,
  sendContactReplyEmail,
  sendSubscriptionExpiryReminder,
  sendSubscriptionExpired,
  getSuperAdminEmail,
  sendTestEmail,
  sendOtpEmail,
  profileUpdated: sendProfileUpdatedEmail,
  sendProfileUpdatedEmail,
  sendInvoicePaidEmail,
  sendPaymentReceivedToSuperAdmin,
};
