
// const FRONTEND_REDIRECT_URL =
//   process.env.FRONTEND_REDIRECT_URL ||
//   process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
//   'http://localhost:5173';

// const escapeHtml = (s) =>
//   String(s ?? '')
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');

// const shell = ({ heading, intro, bodyHtml, footNote, ctaLabel, ctaUrl }) => {
//   const year = new Date().getFullYear();

//   return `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta http-equiv="X-UA-Compatible" content="IE=edge" />
//   <title>${escapeHtml(heading)}</title>
//   <style>
//     body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
//     table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
//     img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
//     table { border-collapse: collapse !important; }
//     body {
//       height: 100% !important;
//       margin: 0 !important;
//       padding: 0 !important;
//       width: 100% !important;
//       background-color: #f6f8fc;
//       font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
//     }

//     .container {
//       width: 100%;
//       max-width: 680px;
//     }

//     .card {
//       background: #ffffff;
//       border: 1px solid #e5eaf2;
//       border-radius: 20px;
//       overflow: hidden;
//       box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
//     }

//     .header {
//       background: linear-gradient(135deg, #0f172a 0%, #123b63 100%);
//       padding: 28px 32px;
//     }

//     .brand {
//       color: #ffffff;
//       font-size: 15px;
//       font-weight: 700;
//       letter-spacing: 0.3px;
//     }

//     .badge {
//       display: inline-block;
//       padding: 6px 10px;
//       border-radius: 999px;
//       background: rgba(255,255,255,0.12);
//       color: #dbeafe;
//       font-size: 12px;
//       font-weight: 600;
//     }

//     .content {
//       padding: 36px 32px 28px 32px;
//     }

//     .title {
//       margin: 0 0 10px 0;
//       font-size: 26px;
//       line-height: 1.25;
//       color: #0f172a;
//       font-weight: 800;
//       letter-spacing: -0.4px;
//     }

//     .intro {
//       margin: 0 0 22px 0;
//       font-size: 15px;
//       line-height: 1.7;
//       color: #475569;
//     }

//     .section {
//       font-size: 15px;
//       line-height: 1.7;
//       color: #1e293b;
//     }

//     .detail-card {
//       margin: 18px 0 8px 0;
//       background: #f8fafc;
//       border: 1px solid #e5eaf2;
//       border-radius: 14px;
//       overflow: hidden;
//     }

//     .detail-row {
//       width: 100%;
//     }

//     .detail-label {
//       width: 170px;
//       padding: 13px 16px;
//       color: #64748b;
//       font-size: 14px;
//       font-weight: 600;
//       vertical-align: top;
//       border-bottom: 1px solid #e5eaf2;
//       background: #f8fafc;
//     }

//     .detail-value {
//       padding: 13px 16px;
//       color: #0f172a;
//       font-size: 14px;
//       font-weight: 600;
//       vertical-align: top;
//       border-bottom: 1px solid #e5eaf2;
//       background: #ffffff;
//       word-break: break-word;
//     }

//     .detail-row:last-child .detail-label,
//     .detail-row:last-child .detail-value {
//       border-bottom: none;
//     }

//     .button-wrap {
//       margin: 26px 0 12px 0;
//     }

//     .button {
//       display: inline-block;
//       background: #1d4ed8;
//       color: #ffffff !important;
//       text-decoration: none;
//       font-size: 14px;
//       font-weight: 700;
//       padding: 13px 22px;
//       border-radius: 12px;
//       border: 1px solid #1d4ed8;
//     }

//     .button:hover {
//       background: #1e40af;
//       border-color: #1e40af;
//     }

//     .link-note {
//       margin: 12px 0 0 0;
//       font-size: 13px;
//       line-height: 1.6;
//       color: #64748b;
//     }

//     .plain-link {
//       color: #1d4ed8;
//       text-decoration: underline;
//       word-break: break-all;
//     }

//     .footer {
//       padding: 22px 32px 28px 32px;
//       background: #f8fafc;
//       border-top: 1px solid #e5eaf2;
//       text-align: center;
//     }

//     .footer-text {
//       margin: 0 0 6px 0;
//       font-size: 12px;
//       line-height: 1.6;
//       color: #64748b;
//     }

//     .footer-copy {
//       margin: 0;
//       font-size: 11px;
//       color: #94a3b8;
//     }

//     .preheader {
//       display: none !important;
//       visibility: hidden;
//       opacity: 0;
//       overflow: hidden;
//       mso-hide: all;
//       height: 0;
//       width: 0;
//       max-height: 0;
//       max-width: 0;
//       font-size: 1px;
//       line-height: 1px;
//       color: #f6f8fc;
//     }

//     @media screen and (max-width: 620px) {
//       .outer-padding {
//         padding: 16px !important;
//       }

//       .content,
//       .footer,
//       .header {
//         padding-left: 20px !important;
//         padding-right: 20px !important;
//       }

//       .title {
//         font-size: 22px !important;
//       }

//       .intro,
//       .section {
//         font-size: 14px !important;
//       }

//       .detail-label,
//       .detail-value {
//         display: block !important;
//         width: 100% !important;
//         box-sizing: border-box !important;
//       }

//       .detail-label {
//         padding-bottom: 6px !important;
//         border-bottom: none !important;
//       }

//       .detail-value {
//         padding-top: 0 !important;
//       }

//       .button {
//         display: block !important;
//         text-align: center !important;
//         width: 100% !important;
//         box-sizing: border-box !important;
//       }
//     }
//   </style>
// </head>
// <body>
//   <div class="preheader">${escapeHtml(intro || heading)}</div>

//   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f8fc;">
//     <tr>
//       <td align="center" class="outer-padding" style="padding: 32px 16px;">
//         <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0">
//           <tr>
//             <td class="card">
//               <div class="header">
//                 <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
//                   <tr>
//                     <td align="left" class="brand">Pet Hospital Portal</td>
//                     <td align="right"><span class="badge">Secure update</span></td>
//                   </tr>
//                 </table>
//               </div>

//               <div class="content">
//                 <h1 class="title">${escapeHtml(heading)}</h1>
//                 ${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}
//                 <div class="section">
//                   ${bodyHtml}
//                 </div>
//               </div>

//               <div class="footer">
//                 <p class="footer-text">
//                   ${escapeHtml(footNote || 'You are receiving this because you interacted with the Pet Hospital Portal.')}
//                 </p>
//                 <p class="footer-copy">
//                   © ${year} Pet Hospital Portal. All rights reserved.
//                 </p>
//               </div>
//             </td>
//           </tr>
//         </table>
//       </td>
//     </tr>
//   </table>
// </body>
// </html>
//   `;
// };

// const button = (href, label) => `
//   <table role="presentation" cellpadding="0" cellspacing="0" class="button-wrap">
//     <tr>
//       <td>
//         <a href="${href}" target="_blank" class="button">${escapeHtml(label)}</a>
//       </td>
//     </tr>
//   </table>
// `;

// const detailRows = (rows) => {
//   const validRows = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '');

//   if (!validRows.length) return '';

//   return `
//     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="detail-card">
//       ${validRows
//         .map(
//           ([k, v], idx) => `
//           <tr class="detail-row">
//             <td class="detail-label" style="${idx !== validRows.length - 1 ? '' : 'border-bottom:none;'}">${escapeHtml(k)}</td>
//             <td class="detail-value" style="${idx !== validRows.length - 1 ? '' : 'border-bottom:none;'}">${escapeHtml(v)}</td>
//           </tr>
//         `
//         )
//         .join('')}
//     </table>
//   `;
// };

// const fmtWhen = (d) =>
//   d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

// const demoReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Demo request received',
//   html: shell({
//     heading: 'We received your demo request',
//     intro: `Hi ${contactName || 'there'}, thanks for reaching out to us.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your request for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> has been received and is now in our queue.</p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Contact', contactName],
//         ['Status', 'Awaiting scheduling']
//       ])}
//     `,
//     footNote: 'Demo request from Pet Hospital Portal'
//   })
// });

// const scheduleInvite = ({ contactName, hospitalName, token }) => ({
//   subject: 'Schedule your demo',
//   html: shell({
//     heading: 'Choose a convenient time',
//     intro: `Hi ${contactName || 'there'}, please schedule your personalized demo at a time that works best for you.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is ready to be scheduled.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, 'Schedule demo')}
//       <p class="link-note">If the button doesn’t work, use this secure link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/schedule/${token}">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>
//     `,
//     footNote: 'Scheduling link from Pet Hospital Portal'
//   })
// });

// const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your demo is confirmed',
//   html: shell({
//     heading: 'Demo confirmed',
//     intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'To be confirmed']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Demo confirmation from Pet Hospital Portal'
//   })
// });

// const meetingLinkReady = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your meeting link is ready',
//   html: shell({
//     heading: 'Meeting link ready',
//     intro: `Hi ${contactName || 'there'}, your secure meeting link is ready.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'Scheduled']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Meeting link from Pet Hospital Portal'
//   })
// });

// const feedbackRequest = ({ contactName, token }) => ({
//   subject: 'Please share your feedback',
//   html: shell({
//     heading: 'We’d love your feedback',
//     intro: `Hi ${contactName || 'there'}, thank you for attending the demo session.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">We’d appreciate a quick moment of your time to share your feedback.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/feedback/${token}`, 'Share feedback')}
//       <p class="link-note">If the button doesn’t work, use this link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/feedback/${token}">${FRONTEND_REDIRECT_URL}/feedback/${token}</a></p>
//     `,
//     footNote: 'Feedback request from Pet Hospital Portal'
//   })
// });

// const registrationReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Registration received',
//   html: shell({
//     heading: 'Registration received',
//     intro: `Hi ${contactName || 'there'}, we’ve received your registration.`,
//     bodyHtml: detailRows([
//       ['Hospital', hospitalName],
//       ['Contact', contactName],
//       ['Status', 'Pending approval']
//     ]),
//     footNote: 'Registration from Pet Hospital Portal'
//   })
// });

// const registrationApproved = ({ contactName, hospitalName, loginEmail, tempPassword, origin }) => {
//   const url = origin || FRONTEND_REDIRECT_URL;
//   return {
//     subject: 'Your account is ready',
//     html: shell({
//       heading: 'Account approved',
//       intro: `Hi ${contactName || 'there'}, your hospital account has been approved.`,
//       bodyHtml: `
//         ${detailRows([
//           ['Hospital', hospitalName],
//           ['Login email', loginEmail],
//           ['Password', tempPassword]
//         ])}
//         ${button(`${url}/login`, 'Log in')}
//       `,
//       footNote: 'Account approval from Pet Hospital Portal'
//     })
//   };
// };

// const registrationDenied = ({ contactName, hospitalName }) => ({
//   subject: 'Registration update',
//   html: shell({
//     heading: 'Registration update',
//     intro: `Hi ${contactName || 'there'},`,
//     bodyHtml: `
//       <p style="margin: 0;">We couldn’t approve the registration for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> at this time. If you believe this is a mistake, please contact support.</p>
//     `,
//     footNote: 'Registration update from Pet Hospital Portal'
//   })
// });

// const passwordResetOtp = ({ contactName, otp }) => ({
//   subject: 'Password reset code',
//   html: shell({
//     heading: 'Password reset code',
//     intro: `Hi ${contactName || 'there'}, use the code below to reset your password.`,
//     bodyHtml: `
//       <div style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:16px;padding:22px;text-align:center;margin:20px 0;">
//         <div style="font-size:12px;color:#64748b;margin-bottom:10px;font-weight:600;letter-spacing:0.3px;">Your verification code</div>
//         <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${escapeHtml(otp)}</div>
//       </div>
//       <p style="margin:0;font-size:13px;color:#64748b;">This code expires in 10 minutes.</p>
//     `,
//     footNote: 'Password reset from Pet Hospital Portal'
//   })
// });

// const appointmentConfirmation = ({ patientName, hospitalName, date, time }) => ({
//   subject: 'Appointment request received',
//   html: shell({
//     heading: 'Appointment request received',
//     intro: `Hi ${patientName || 'there'}, thank you for booking with us.`,
//     bodyHtml: detailRows([
//       ['Hospital', hospitalName],
//       ['Date', date || 'To be confirmed'],
//       ['Time', time || 'To be confirmed'],
//       ['Patient', patientName],
//       ['Status', 'Pending confirmation']
//     ]),
//     footNote: 'Appointment from Pet Hospital Portal'
//   })
// });

// module.exports = {
//   shell,
//   button,
//   detailRows,
//   fmtWhen,
//   demoReceived,
//   scheduleInvite,
//   demoConfirmation,
//   meetingLinkReady,
//   feedbackRequest,
//   registrationReceived,
//   registrationApproved,
//   registrationDenied,
//   passwordResetOtp,
//   appointmentConfirmation
// };



// const FRONTEND_REDIRECT_URL =
//   process.env.FRONTEND_REDIRECT_URL ||
//   process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
//   'http://localhost:5173';

// const escapeHtml = (s) =>
//   String(s ?? '')
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');

// // Brand palette — mirrors the site's tailwind `medical.*` tokens so emails and
// // the app look like one product.
// const C = {
//   blue:      '#1E40AF', // medical-blue
//   blueDark:  '#1E3A8A', // medical-dark
//   blueLight: '#DBEAFE', // medical-light
//   tintBg:    '#F5F8FF',
//   ink:       '#16203A',
//   body:      '#414B60',
//   muted:     '#6B7488',
//   line:      '#DDE4F0',
//   page:      '#EEF2F9'
// };

// const BRAND = process.env.MAIL_BRAND_NAME || 'Pet Hospital Portal';
// const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_EMAIL || process.env.GOOGLE_USER || process.env.GMAIL_USER || '';
// const POSTAL_ADDRESS = process.env.MAIL_POSTAL_ADDRESS || '';

// const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// // ── Why this stays out of spam / Promotions ──────────────────────────
// // Brand colour is not a spam signal — these are: emoji subjects, HTML-only
// // bodies, hero images, tracking pixels, many CTAs, and marketing copy. So we
// // keep the colour and avoid all of those:
// //   • no images at all (no hero, no logo file, no tracking pixel)
// //   • one CTA per message, plain descriptive subject lines, no emoji
// //   • text/plain alternative on every send (see emailService.send)
// //   • table layout + inlined styles, 600px single column
// //   • bgcolor alongside any gradient so Outlook degrades cleanly
// //   • factual footer stating why the message was sent
// // Deliverability still depends on SPF/DKIM/DMARC being set for your domain.
// // ─────────────────────────────────────────────────────────────────────

// // Semantic status chip — same colour language as the dashboard badges.
// const STATUS_TONES = {
//   pending:     { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
//   new:         { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
//   in_progress: { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   confirmed:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   scheduled:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   rescheduled: { bg: '#CFFAFE', fg: '#155E75', bd: '#A5F3FC' },
//   completed:   { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   resolved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   approved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   cancelled:   { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
//   denied:      { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
//   closed:      { bg: '#E5E7EB', fg: '#374151', bd: '#D1D5DB' }
// };

// const statusPill = (label) => {
//   const key = String(label || '').toLowerCase().replace(/[\s-]+/g, '_');
//   const t = STATUS_TONES[key] || { bg: C.blueLight, fg: C.blueDark, bd: '#BFDBFE' };
//   return `<span style="display:inline-block; padding:5px 12px; background-color:${t.bg}; color:${t.fg}; border:1px solid ${t.bd}; border-radius:999px; font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:0.3px;">${escapeHtml(label)}</span>`;
// };

// const shell = ({ heading, intro, bodyHtml, footNote }) => {
//   const year = new Date().getFullYear();

//   return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
// <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
// <head>
//   <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta name="x-apple-disable-message-reformatting" />
//   <meta name="color-scheme" content="light" />
//   <meta name="supported-color-schemes" content="light" />
//   <title>${escapeHtml(heading)}</title>
//   <style type="text/css">
//     body { margin:0 !important; padding:0 !important; width:100% !important; }
//     img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
//     table { border-collapse:collapse !important; }
//     a { color:${C.blue}; }
//     @media only screen and (max-width:600px) {
//       .wrap { width:100% !important; }
//       .pad  { padding-left:22px !important; padding-right:22px !important; }
//       .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
//       .stack-label { padding-bottom:2px !important; border-bottom:0 !important; }
//       .stack-value { padding-top:0 !important; }
//       .btn a { display:block !important; text-align:center !important; }
//     }
//   </style>
// </head>
// <body style="margin:0; padding:0; background-color:${C.page};">
//   <!-- Preheader: the grey preview line beside the subject. -->
//   <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C.page};">
//     ${escapeHtml(intro || heading)}
//   </div>

//   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
//     <tr>
//       <td align="center" style="padding:30px 12px;">

//         <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

//           <tr>
//             <td style="background-color:#ffffff; border:1px solid ${C.line}; border-radius:10px; overflow:hidden;">

//               <!-- Brand bar. bgcolor first so Outlook (which drops the gradient) still renders blue. -->
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.blue}"
//                      style="background-color:${C.blue}; background-image:linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%);">
//                 <tr>
//                   <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:15px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">
//                     ${escapeHtml(BRAND)}
//                   </td>
//                 </tr>
//               </table>

//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
//                 <tr>
//                   <td class="pad" style="padding:30px 32px 8px 32px; font-family:${FONT};">
//                     <h1 style="margin:0 0 12px 0; font-size:21px; line-height:1.35; font-weight:700; color:${C.blueDark};">
//                       ${escapeHtml(heading)}
//                     </h1>
//                     ${intro ? `<p style="margin:0 0 4px 0; font-size:15px; line-height:1.65; color:${C.body};">${escapeHtml(intro)}</p>` : ''}
//                   </td>
//                 </tr>
//                 <tr>
//                   <td class="pad" style="padding:8px 32px 30px 32px; font-family:${FONT}; font-size:15px; line-height:1.65; color:${C.ink};">
//                     ${bodyHtml}
//                   </td>
//                 </tr>
//               </table>

//               <!-- Footer band -->
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tintBg}" style="background-color:${C.tintBg}; border-top:1px solid ${C.line};">
//                 <tr>
//                   <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:12px; line-height:1.65; color:${C.muted};">
//                     <p style="margin:0 0 6px 0;">${escapeHtml(footNote || `You are receiving this because you used ${BRAND}.`)}</p>
//                     ${SUPPORT_EMAIL ? `<p style="margin:0 0 6px 0;">Questions? Reply to this email or write to <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${C.blue}; text-decoration:underline;">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>` : ''}
//                     ${POSTAL_ADDRESS ? `<p style="margin:0 0 6px 0;">${escapeHtml(POSTAL_ADDRESS)}</p>` : ''}
//                     <p style="margin:8px 0 0 0; color:#98A0B3;">&copy; ${year} ${escapeHtml(BRAND)}</p>
//                   </td>
//                 </tr>
//               </table>

//             </td>
//           </tr>

//         </table>

//       </td>
//     </tr>
//   </table>
// </body>
// </html>`;
// };

// const button = (href, label) => `
//   <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
//     <tr>
//       <td style="background-color:#1a5fb4; border-radius:5px;">
//         <a href="${href}" target="_blank" rel="noopener"
//            style="display:inline-block; padding:12px 22px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:5px;">${escapeHtml(label)}</a>
//       </td>
//     </tr>
//   </table>
// `;

// // Label/value summary table. Rows with empty values are dropped so a message
// // never shows a blank field.
// const detailRows = (rows) => {
//   const validRows = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '');

//   if (!validRows.length) return '';

//   const cell = 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif; font-size:14px; vertical-align:top;';

//   return `
//     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px 0; border:1px solid #e3e6ea; border-radius:6px; background-color:#fbfcfd;">
//       ${validRows
//         .map(([k, v], idx) => {
//           const border = idx !== validRows.length - 1 ? 'border-bottom:1px solid #e9ecef;' : '';
//           return `
//           <tr>
//             <td class="stack stack-label" style="${cell} width:170px; padding:11px 16px; color:#5b6472; font-weight:600; ${border}">${escapeHtml(k)}</td>
//             <td class="stack stack-value" style="${cell} padding:11px 16px; color:#1b1f24; font-weight:500; word-break:break-word; ${border}">${escapeHtml(v)}</td>
//           </tr>`;
//         })
//         .join('')}
//     </table>
//   `;
// };

// const fmtWhen = (d) =>
//   d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

// const demoReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Demo request received',
//   html: shell({
//     heading: 'We received your demo request',
//     intro: `Hi ${contactName || 'there'}, thanks for reaching out to us.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your request for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> has been received and is now in our queue.</p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Contact', contactName],
//         ['Status', 'Awaiting scheduling']
//       ])}
//     `,
//     footNote: 'Demo request from Pet Hospital Portal'
//   })
// });

// const scheduleInvite = ({ contactName, hospitalName, token }) => ({
//   subject: 'Schedule your demo',
//   html: shell({
//     heading: 'Choose a convenient time',
//     intro: `Hi ${contactName || 'there'}, please schedule your personalized demo at a time that works best for you.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is ready to be scheduled.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, 'Schedule demo')}
//       <p class="link-note">If the button doesn’t work, use this secure link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/schedule/${token}">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>
//     `,
//     footNote: 'Scheduling link from Pet Hospital Portal'
//   })
// });

// const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your demo is confirmed',
//   html: shell({
//     heading: 'Demo confirmed',
//     intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'To be confirmed']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Demo confirmation from Pet Hospital Portal'
//   })
// });

// const meetingLinkReady = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your meeting link is ready',
//   html: shell({
//     heading: 'Meeting link ready',
//     intro: `Hi ${contactName || 'there'}, your secure meeting link is ready.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'Scheduled']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Meeting link from Pet Hospital Portal'
//   })
// });

// const feedbackRequest = ({ contactName, token }) => ({
//   subject: 'Please share your feedback',
//   html: shell({
//     heading: 'We’d love your feedback',
//     intro: `Hi ${contactName || 'there'}, thank you for attending the demo session.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">We’d appreciate a quick moment of your time to share your feedback.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/feedback/${token}`, 'Share feedback')}
//       <p class="link-note">If the button doesn’t work, use this link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/feedback/${token}">${FRONTEND_REDIRECT_URL}/feedback/${token}</a></p>
//     `,
//     footNote: 'Feedback request from Pet Hospital Portal'
//   })
// });

// const registrationReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Registration received',
//   html: shell({
//     heading: 'Registration received',
//     intro: `Hi ${contactName || 'there'}, we’ve received your registration.`,
//     bodyHtml: detailRows([
//       ['Hospital', hospitalName],
//       ['Contact', contactName],
//       ['Status', 'Pending approval']
//     ]),
//     footNote: 'Registration from Pet Hospital Portal'
//   })
// });

// const registrationApproved = ({ contactName, hospitalName, loginEmail, tempPassword, origin }) => {
//   const url = origin || FRONTEND_REDIRECT_URL;
//   return {
//     subject: 'Your account is ready',
//     html: shell({
//       heading: 'Account approved',
//       intro: `Hi ${contactName || 'there'}, your hospital account has been approved.`,
//       bodyHtml: `
//         ${detailRows([
//           ['Hospital', hospitalName],
//           ['Login email', loginEmail],
//           ['Password', tempPassword]
//         ])}
//         ${button(`${url}/login`, 'Log in')}
//       `,
//       footNote: 'Account approval from Pet Hospital Portal'
//     })
//   };
// };

// const registrationDenied = ({ contactName, hospitalName }) => ({
//   subject: 'Registration update',
//   html: shell({
//     heading: 'Registration update',
//     intro: `Hi ${contactName || 'there'},`,
//     bodyHtml: `
//       <p style="margin: 0;">We couldn’t approve the registration for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> at this time. If you believe this is a mistake, please contact support.</p>
//     `,
//     footNote: 'Registration update from Pet Hospital Portal'
//   })
// });

// const passwordResetOtp = ({ contactName, otp }) => ({
//   subject: 'Password reset code',
//   html: shell({
//     heading: 'Password reset code',
//     intro: `Hi ${contactName || 'there'}, use the code below to reset your password.`,
//     bodyHtml: `
//       <div style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:16px;padding:22px;text-align:center;margin:20px 0;">
//         <div style="font-size:12px;color:#64748b;margin-bottom:10px;font-weight:600;letter-spacing:0.3px;">Your verification code</div>
//         <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${escapeHtml(otp)}</div>
//       </div>
//       <p style="margin:0;font-size:13px;color:#64748b;">This code expires in 10 minutes.</p>
//     `,
//     footNote: 'Password reset from Pet Hospital Portal'
//   })
// });

// // ───  CORRECT appointmentConfirmation (with all fields) ───
// const appointmentConfirmation = ({
//   patientName,
//   patientPhone,
//   hospitalName,
//   date,
//   time,
//   petName,
//   description,
//   email
// }) => ({
//   subject: 'Your appointment request has been received',
//   html: shell({
//     heading: 'Appointment request received',
//     intro: `Hi ${patientName || 'there'}, thanks for booking with ${hospitalName || 'us'}!`,
//     bodyHtml: `
//       <p style="margin:0 0 6px;color:#475569;font-size:15px;line-height:1.6;">
//         We've received your appointment request. The hospital will review and confirm it shortly.
//       </p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Phone', patientPhone],
//         ['Email', email],
//         ['Pet Name', petName],
//         ['Date', date || 'To be confirmed'],
//         ['Time', time || 'To be confirmed'],
//         ['Status', 'Pending confirmation']
//       ].filter(row => row[1]))}
//       <p style="margin:16px 0 0 0;">The hospital will contact you if anything needs changing.</p>`,
//     footNote: 'You booked an appointment via the Pet Hospital Portal.'
//   })
// });


// // ─── Appointment status update template ──────────────────────
// const appointmentStatusUpdate = ({ patientName, hospitalName, date, time, status, message }) => ({
//   subject: 'Your appointment status has been updated',
//   html: shell({
//     heading: 'Appointment status update',
//     intro: `Hi ${patientName || 'there'}, your appointment status has been changed.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">
//         Your appointment at <strong>${escapeHtml(hospitalName || 'the hospital')}</strong> is now ${statusPill(status)}
//       </p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Date', date || 'To be confirmed'],
//         ['Time', time || 'To be confirmed'],
//         ['New Status', status]
//       ])}
//       ${message ? `<p style="margin:10px 0 0;color:#475569;font-size:15px;">Note: ${message}</p>` : ''}
//       <p style="margin:16px 0 0;color:#475569;font-size:15px;">If you have any questions, please contact the hospital directly.</p>
//     `,
//     footNote: 'Appointment status update from Pet Hospital Portal'
//   })
// });


// // ─── Contact us: acknowledgement to the person who wrote in ──
// const contactReceived = ({ name, subject, message, phone, email }) => ({
//   subject: 'We received your message',
//   html: shell({
//     heading: 'Thanks for getting in touch',
//     intro: `Hi ${name || 'there'}, we have received your message and our team will get back to you shortly.`,
//     bodyHtml: `
//       <p style="margin:0 0 4px 0;">Here is a copy of what you sent. There is nothing else you need to do &mdash; we will reply to this email address.</p>
//       ${detailRows([
//         ['Name', name],
//         ['Email', email],
//         ['Phone', phone],
//         ['Subject', subject],
//         ['Message', message],
//         ['Status', 'New, awaiting review']
//       ])}
//     `,
//     footNote: 'You are receiving this because you submitted the contact form on our website.'
//   })
// });

// // ─── Contact us: alert to the superadmin ─────────────────────
// const contactNewForAdmin = ({ name, email, phone, subject, message, submittedAt }) => ({
//   subject: `New contact enquiry: ${subject || 'General Inquiry'}`,
//   html: shell({
//     heading: 'New contact enquiry',
//     intro: `${name || 'Someone'} submitted the contact form.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Name', name],
//         ['Email', email],
//         ['Phone', phone],
//         ['Subject', subject],
//         ['Message', message],
//         ['Received', fmtWhen(submittedAt) || 'Just now']
//       ])}
//       ${button(`${FRONTEND_REDIRECT_URL}/superadmin/contacts`, 'Open in dashboard')}
//     `,
//     footNote: 'You are receiving this because you are an administrator on this system.'
//   })
// });

// // ─── Contact us: status / feedback update to the user ────────
// const contactStatusUpdate = ({ name, subject, message, status, feedback }) => {
//   const labels = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
//   const statusLabel = labels[status] || status;

//   return {
//     subject: `Update on your enquiry: ${statusLabel}`,
//     html: shell({
//       heading: 'Update on your enquiry',
//       intro: `Hi ${name || 'there'}, there is an update on the message you sent us.`,
//       bodyHtml: `
//         <p style="margin:0 0 14px 0;">Your enquiry is now marked as ${statusPill(statusLabel)}</p>
//         ${feedback
//           ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
//                <tr>
//                  <td style="padding:16px 18px; background-color:#f7f9fc; border-left:3px solid #1a5fb4; border-radius:4px;">
//                    <div style="font-size:12px; font-weight:700; color:#5b6472; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:6px;">Response from our team</div>
//                    <div style="font-size:15px; line-height:1.6; color:#2c3340;">${escapeHtml(feedback)}</div>
//                  </td>
//                </tr>
//              </table>`
//           : ''}
//         ${detailRows([
//           ['Subject', subject],
//           ['Your message', message],
//           ['Status', statusLabel]
//         ])}
//         <p style="margin:16px 0 0 0;">If you need anything else, reply to this email.</p>
//       `,
//       footNote: 'You are receiving this because you contacted us through our website.'
//     })
//   };
// };

// // ─── Appointment: alert to the superadmin on a new booking ───
// const appointmentNewForAdmin = ({
//   patientName, patientPhone, email, hospitalName, date, time, petName, description, source
// }) => ({
//   subject: `New appointment booking: ${hospitalName || 'Hospital'}`,
//   html: shell({
//     heading: 'New appointment booked',
//     intro: `${patientName || 'A patient'} booked an appointment${hospitalName ? ` at ${hospitalName}` : ''}.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Phone', patientPhone],
//         ['Email', email],
//         ['Pet name', petName],
//         ['Date', date || 'Not specified'],
//         ['Time', time || 'Not specified'],
//         ['Reason', description],
//         ['Source', source === 'public' ? 'Public booking page' : 'Signed-in user'],
//         ['Status', 'Pending']
//       ])}
//       ${button(`${FRONTEND_REDIRECT_URL}/superadmin/appointments`, 'Review appointment')}
//     `,
//     footNote: 'You are receiving this because you are an administrator on this system.'
//   })
// });

// // ─── Appointment: rescheduled by the patient ─────────────────
// const appointmentRescheduled = ({ patientName, hospitalName, date, time, previousDate, previousTime }) => ({
//   subject: 'Your appointment has been rescheduled',
//   html: shell({
//     heading: 'Appointment rescheduled',
//     intro: `Hi ${patientName || 'there'}, your appointment has been moved to a new slot.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Previous slot', [previousDate, previousTime].filter(Boolean).join(' at ')],
//         ['New date', date || 'To be confirmed'],
//         ['New time', time || 'To be confirmed'],
//         ['Status', 'Pending confirmation']
//       ])}
//       <p style="margin:16px 0 0 0;">The hospital will confirm the new slot shortly.</p>
//     `,
//     footNote: 'You are receiving this because you booked an appointment with us.'
//   })
// });

// // ─── Appointment: cancelled by the patient ───────────────────
// const appointmentCancelled = ({ patientName, hospitalName, date, time, reason }) => ({
//   subject: 'Your appointment has been cancelled',
//   html: shell({
//     heading: 'Appointment cancelled',
//     intro: `Hi ${patientName || 'there'}, your appointment has been cancelled as requested.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Date', date],
//         ['Time', time],
//         ['Reason', reason],
//         ['Status', 'Cancelled']
//       ])}
//       <p style="margin:16px 0 0 0;">You can book again at any time from our appointment page.</p>
//     `,
//     footNote: 'You are receiving this because you booked an appointment with us.'
//   })
// });

// // ─── Exports ──────────────────────────────────────────────
// module.exports = {
//   shell,
//   button,
//   statusPill,
//   detailRows,
//   fmtWhen,
//   demoReceived,
//   scheduleInvite,
//   demoConfirmation,
//   meetingLinkReady,
//   feedbackRequest,
//   registrationReceived,
//   registrationApproved,
//   registrationDenied,
//   passwordResetOtp,
//   appointmentConfirmation,
//   appointmentStatusUpdate,
//   appointmentNewForAdmin,
//   appointmentRescheduled,
//   appointmentCancelled,
//   contactReceived,
//   contactNewForAdmin,
//   contactStatusUpdate
// };


// const FRONTEND_REDIRECT_URL =
//   process.env.FRONTEND_REDIRECT_URL ||
//   process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
//   'http://localhost:5173';

// const escapeHtml = (s) =>
//   String(s ?? '')
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');

// // Brand palette — mirrors the site's tailwind `medical.*` tokens so emails and
// // the app look like one product.
// const C = {
//   blue:      '#1E40AF', // medical-blue
//   blueDark:  '#1E3A8A', // medical-dark
//   blueLight: '#DBEAFE', // medical-light
//   tintBg:    '#F5F8FF',
//   ink:       '#16203A',
//   body:      '#414B60',
//   muted:     '#6B7488',
//   line:      '#DDE4F0',
//   page:      '#EEF2F9'
// };

// const BRAND = process.env.MAIL_BRAND_NAME || 'Pet Hospital Portal';
// const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_EMAIL || process.env.GOOGLE_USER || process.env.GMAIL_USER || '';
// const POSTAL_ADDRESS = process.env.MAIL_POSTAL_ADDRESS || '';

// const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// // ── Why this stays out of spam / Promotions ──────────────────────────
// // Brand colour is not a spam signal — these are: emoji subjects, HTML-only
// // bodies, hero images, tracking pixels, many CTAs, and marketing copy. So we
// // keep the colour and avoid all of those:
// //   • no images at all (no hero, no logo file, no tracking pixel)
// //   • one CTA per message, plain descriptive subject lines, no emoji
// //   • text/plain alternative on every send (see emailService.send)
// //   • table layout + inlined styles, 600px single column
// //   • bgcolor alongside any gradient so Outlook degrades cleanly
// //   • factual footer stating why the message was sent
// // Deliverability still depends on SPF/DKIM/DMARC being set for your domain.
// // ─────────────────────────────────────────────────────────────────────

// // Semantic status chip — same colour language as the dashboard badges.
// const STATUS_TONES = {
//   pending:     { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
//   new:         { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
//   in_progress: { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   confirmed:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   scheduled:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   rescheduled: { bg: '#CFFAFE', fg: '#155E75', bd: '#A5F3FC' },
//   completed:   { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   resolved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   approved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   cancelled:   { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
//   denied:      { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
//   closed:      { bg: '#E5E7EB', fg: '#374151', bd: '#D1D5DB' }
// };

// const statusPill = (label) => {
//   const key = String(label || '').toLowerCase().replace(/[\s-]+/g, '_');
//   const t = STATUS_TONES[key] || { bg: C.blueLight, fg: C.blueDark, bd: '#BFDBFE' };
//   return `<span style="display:inline-block; padding:5px 12px; background-color:${t.bg}; color:${t.fg}; border:1px solid ${t.bd}; border-radius:999px; font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:0.3px;">${escapeHtml(label)}</span>`;
// };

// const shell = ({ heading, intro, bodyHtml, footNote }) => {
//   const year = new Date().getFullYear();

//   return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
// <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
// <head>
//   <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta name="x-apple-disable-message-reformatting" />
//   <meta name="color-scheme" content="light" />
//   <meta name="supported-color-schemes" content="light" />
//   <title>${escapeHtml(heading)}</title>
//   <style type="text/css">
//     body { margin:0 !important; padding:0 !important; width:100% !important; }
//     img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
//     table { border-collapse:collapse !important; }
//     a { color:${C.blue}; }
//     @media only screen and (max-width:600px) {
//       .wrap { width:100% !important; }
//       .pad  { padding-left:22px !important; padding-right:22px !important; }
//       .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
//       .stack-label { padding-bottom:2px !important; border-bottom:0 !important; }
//       .stack-value { padding-top:0 !important; }
//       .btn a { display:block !important; text-align:center !important; }
//     }
//   </style>
// </head>
// <body style="margin:0; padding:0; background-color:${C.page};">
//   <!-- Preheader: the grey preview line beside the subject. -->
//   <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C.page};">
//     ${escapeHtml(intro || heading)}
//   </div>

//   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
//     <tr>
//       <td align="center" style="padding:30px 12px;">

//         <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

//           <tr>
//             <td style="background-color:#ffffff; border:1px solid ${C.line}; border-radius:10px; overflow:hidden;">

//               <!-- Brand bar. bgcolor first so Outlook (which drops the gradient) still renders blue. -->
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.blue}"
//                      style="background-color:${C.blue}; background-image:linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%);">
//                 <tr>
//                   <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:15px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">
//                     ${escapeHtml(BRAND)}
//                   </td>
//                 </tr>
//               </table>

//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
//                 <tr>
//                   <td class="pad" style="padding:30px 32px 8px 32px; font-family:${FONT};">
//                     <h1 style="margin:0 0 12px 0; font-size:21px; line-height:1.35; font-weight:700; color:${C.blueDark};">
//                       ${escapeHtml(heading)}
//                     </h1>
//                     ${intro ? `<p style="margin:0 0 4px 0; font-size:15px; line-height:1.65; color:${C.body};">${escapeHtml(intro)}</p>` : ''}
//                   </td>
//                 </tr>
//                 <tr>
//                   <td class="pad" style="padding:8px 32px 30px 32px; font-family:${FONT}; font-size:15px; line-height:1.65; color:${C.ink};">
//                     ${bodyHtml}
//                   </td>
//                 </tr>
//               </table>

//               <!-- Footer band -->
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tintBg}" style="background-color:${C.tintBg}; border-top:1px solid ${C.line};">
//                 <tr>
//                   <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:12px; line-height:1.65; color:${C.muted};">
//                     <p style="margin:0 0 6px 0;">${escapeHtml(footNote || `You are receiving this because you used ${BRAND}.`)}</p>
//                     ${SUPPORT_EMAIL ? `<p style="margin:0 0 6px 0;">Questions? Reply to this email or write to <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${C.blue}; text-decoration:underline;">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>` : ''}
//                     ${POSTAL_ADDRESS ? `<p style="margin:0 0 6px 0;">${escapeHtml(POSTAL_ADDRESS)}</p>` : ''}
//                     <p style="margin:8px 0 0 0; color:#98A0B3;">&copy; ${year} ${escapeHtml(BRAND)}</p>
//                   </td>
//                 </tr>
//               </table>

//             </td>
//           </tr>

//         </table>

//       </td>
//     </tr>
//   </table>
// </body>
// </html>`;
// };

// const button = (href, label) => `
//   <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
//     <tr>
//       <td style="background-color:#1a5fb4; border-radius:5px;">
//         <a href="${href}" target="_blank" rel="noopener"
//            style="display:inline-block; padding:12px 22px; font-family:${FONT}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:5px;">${escapeHtml(label)}</a>
//       </td>
//     </tr>
//   </table>
// `;

// // Label/value summary table. Rows with empty values are dropped so a message
// // never shows a blank field.
// const detailRows = (rows) => {
//   const validRows = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '');

//   if (!validRows.length) return '';

//   const cell = 'font-family:${FONT}; font-size:14px; vertical-align:top;';

//   return `
//     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px 0; border:1px solid #e3e6ea; border-radius:6px; background-color:#fbfcfd;">
//       ${validRows
//         .map(([k, v], idx) => {
//           const border = idx !== validRows.length - 1 ? 'border-bottom:1px solid #e9ecef;' : '';
//           return `
//           <tr>
//             <td class="stack stack-label" style="${cell} width:170px; padding:11px 16px; color:#5b6472; font-weight:600; ${border}">${escapeHtml(k)}</td>
//             <td class="stack stack-value" style="${cell} padding:11px 16px; color:#1b1f24; font-weight:500; word-break:break-word; ${border}">${escapeHtml(v)}</td>
//           </tr>`;
//         })
//         .join('')}
//     </table>
//   `;
// };

// const fmtWhen = (d) =>
//   d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

// // ─── Template functions ──────────────────────────────────────────

// const demoReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Demo request received',
//   html: shell({
//     heading: 'We received your demo request',
//     intro: `Hi ${contactName || 'there'}, thanks for reaching out to us.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your request for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> has been received and is now in our queue.</p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Contact', contactName],
//         ['Status', 'Awaiting scheduling']
//       ])}
//     `,
//     footNote: 'Demo request from Pet Hospital Portal'
//   })
// });

// const scheduleInvite = ({ contactName, hospitalName, token }) => ({
//   subject: 'Schedule your demo',
//   html: shell({
//     heading: 'Choose a convenient time',
//     intro: `Hi ${contactName || 'there'}, please schedule your personalized demo at a time that works best for you.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is ready to be scheduled.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, 'Schedule demo')}
//       <p class="link-note">If the button doesn’t work, use this secure link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/schedule/${token}">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>
//     `,
//     footNote: 'Scheduling link from Pet Hospital Portal'
//   })
// });

// const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your demo is confirmed',
//   html: shell({
//     heading: 'Demo confirmed',
//     intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'To be confirmed']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Demo confirmation from Pet Hospital Portal'
//   })
// });

// const meetingLinkReady = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your meeting link is ready',
//   html: shell({
//     heading: 'Meeting link ready',
//     intro: `Hi ${contactName || 'there'}, your secure meeting link is ready.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'Scheduled']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Meeting link from Pet Hospital Portal'
//   })
// });

// const feedbackRequest = ({ contactName, token }) => ({
//   subject: 'Please share your feedback',
//   html: shell({
//     heading: 'We’d love your feedback',
//     intro: `Hi ${contactName || 'there'}, thank you for attending the demo session.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">We’d appreciate a quick moment of your time to share your feedback.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/feedback/${token}`, 'Share feedback')}
//       <p class="link-note">If the button doesn’t work, use this link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/feedback/${token}">${FRONTEND_REDIRECT_URL}/feedback/${token}</a></p>
//     `,
//     footNote: 'Feedback request from Pet Hospital Portal'
//   })
// });

// const registrationReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Registration received',
//   html: shell({
//     heading: 'Registration received',
//     intro: `Hi ${contactName || 'there'}, we’ve received your registration.`,
//     bodyHtml: detailRows([
//       ['Hospital', hospitalName],
//       ['Contact', contactName],
//       ['Status', 'Pending approval']
//     ]),
//     footNote: 'Registration from Pet Hospital Portal'
//   })
// });

// const registrationApproved = ({ contactName, hospitalName, loginEmail, tempPassword, origin }) => {
//   const url = origin || FRONTEND_REDIRECT_URL;
//   return {
//     subject: 'Your account is ready',
//     html: shell({
//       heading: 'Account approved',
//       intro: `Hi ${contactName || 'there'}, your hospital account has been approved.`,
//       bodyHtml: `
//         ${detailRows([
//           ['Hospital', hospitalName],
//           ['Login email', loginEmail],
//           ['Password', tempPassword]
//         ])}
//         ${button(`${url}/login`, 'Log in')}
//       `,
//       footNote: 'Account approval from Pet Hospital Portal'
//     })
//   };
// };

// const registrationDenied = ({ contactName, hospitalName }) => ({
//   subject: 'Registration update',
//   html: shell({
//     heading: 'Registration update',
//     intro: `Hi ${contactName || 'there'},`,
//     bodyHtml: `
//       <p style="margin: 0;">We couldn’t approve the registration for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> at this time. If you believe this is a mistake, please contact support.</p>
//     `,
//     footNote: 'Registration update from Pet Hospital Portal'
//   })
// });

// const passwordResetOtp = ({ contactName, otp }) => ({
//   subject: 'Password reset code',
//   html: shell({
//     heading: 'Password reset code',
//     intro: `Hi ${contactName || 'there'}, use the code below to reset your password.`,
//     bodyHtml: `
//       <div style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:16px;padding:22px;text-align:center;margin:20px 0;">
//         <div style="font-size:12px;color:#64748b;margin-bottom:10px;font-weight:600;letter-spacing:0.3px;">Your verification code</div>
//         <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${escapeHtml(otp)}</div>
//       </div>
//       <p style="margin:0;font-size:13px;color:#64748b;">This code expires in 10 minutes.</p>
//     `,
//     footNote: 'Password reset from Pet Hospital Portal'
//   })
// });

// const appointmentConfirmation = ({
//   patientName,
//   patientPhone,
//   hospitalName,
//   date,
//   time,
//   petName,
//   description,
//   email
// }) => ({
//   subject: 'Your appointment request has been received',
//   html: shell({
//     heading: 'Appointment request received',
//     intro: `Hi ${patientName || 'there'}, thanks for booking with ${hospitalName || 'us'}!`,
//     bodyHtml: `
//       <p style="margin:0 0 6px;color:#475569;font-size:15px;line-height:1.6;">
//         We've received your appointment request. The hospital will review and confirm it shortly.
//       </p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Phone', patientPhone],
//         ['Email', email],
//         ['Pet Name', petName],
//         ['Date', date || 'To be confirmed'],
//         ['Time', time || 'To be confirmed'],
//         ['Status', 'Pending confirmation']
//       ].filter(row => row[1]))}
//       <p style="margin:16px 0 0 0;">The hospital will contact you if anything needs changing.</p>`,
//     footNote: 'You booked an appointment via the Pet Hospital Portal.'
//   })
// });

// const appointmentStatusUpdate = ({ patientName, hospitalName, date, time, status, message }) => ({
//   subject: 'Your appointment status has been updated',
//   html: shell({
//     heading: 'Appointment status update',
//     intro: `Hi ${patientName || 'there'}, your appointment status has been changed.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">
//         Your appointment at <strong>${escapeHtml(hospitalName || 'the hospital')}</strong> is now ${statusPill(status)}
//       </p>
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Date', date || 'To be confirmed'],
//         ['Time', time || 'To be confirmed'],
//         ['New Status', status]
//       ])}
//       ${message ? `<p style="margin:10px 0 0;color:#475569;font-size:15px;">Note: ${message}</p>` : ''}
//       <p style="margin:16px 0 0;color:#475569;font-size:15px;">If you have any questions, please contact the hospital directly.</p>
//     `,
//     footNote: 'Appointment status update from Pet Hospital Portal'
//   })
// });

// const appointmentNewForAdmin = ({
//   patientName, patientPhone, email, hospitalName, date, time, petName, description, source
// }) => ({
//   subject: `New appointment booking: ${hospitalName || 'Hospital'}`,
//   html: shell({
//     heading: 'New appointment booked',
//     intro: `${patientName || 'A patient'} booked an appointment${hospitalName ? ` at ${hospitalName}` : ''}.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Phone', patientPhone],
//         ['Email', email],
//         ['Pet name', petName],
//         ['Date', date || 'Not specified'],
//         ['Time', time || 'Not specified'],
//         ['Reason', description],
//         ['Source', source === 'public' ? 'Public booking page' : 'Signed-in user'],
//         ['Status', 'Pending']
//       ])}
//       ${button(`${FRONTEND_REDIRECT_URL}/superadmin/appointments`, 'Review appointment')}
//     `,
//     footNote: 'You are receiving this because you are an administrator on this system.'
//   })
// });

// const appointmentRescheduled = ({ patientName, hospitalName, date, time, previousDate, previousTime }) => ({
//   subject: 'Your appointment has been rescheduled',
//   html: shell({
//     heading: 'Appointment rescheduled',
//     intro: `Hi ${patientName || 'there'}, your appointment has been moved to a new slot.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Previous slot', [previousDate, previousTime].filter(Boolean).join(' at ')],
//         ['New date', date || 'To be confirmed'],
//         ['New time', time || 'To be confirmed'],
//         ['Status', 'Pending confirmation']
//       ])}
//       <p style="margin:16px 0 0 0;">The hospital will confirm the new slot shortly.</p>
//     `,
//     footNote: 'You are receiving this because you booked an appointment with us.'
//   })
// });

// const appointmentCancelled = ({ patientName, hospitalName, date, time, reason }) => ({
//   subject: 'Your appointment has been cancelled',
//   html: shell({
//     heading: 'Appointment cancelled',
//     intro: `Hi ${patientName || 'there'}, your appointment has been cancelled as requested.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Date', date],
//         ['Time', time],
//         ['Reason', reason],
//         ['Status', 'Cancelled']
//       ])}
//       <p style="margin:16px 0 0 0;">You can book again at any time from our appointment page.</p>
//     `,
//     footNote: 'You are receiving this because you booked an appointment with us.'
//   })
// });

// const contactReceived = ({ name, subject, message, phone, email }) => ({
//   subject: 'We received your message',
//   html: shell({
//     heading: 'Thanks for getting in touch',
//     intro: `Hi ${name || 'there'}, we have received your message and our team will get back to you shortly.`,
//     bodyHtml: `
//       <p style="margin:0 0 4px 0;">Here is a copy of what you sent. There is nothing else you need to do &mdash; we will reply to this email address.</p>
//       ${detailRows([
//         ['Name', name],
//         ['Email', email],
//         ['Phone', phone],
//         ['Subject', subject],
//         ['Message', message],
//         ['Status', 'New, awaiting review']
//       ])}
//     `,
//     footNote: 'You are receiving this because you submitted the contact form on our website.'
//   })
// });

// const contactNewForAdmin = ({ name, email, phone, subject, message, submittedAt }) => ({
//   subject: `New contact enquiry: ${subject || 'General Inquiry'}`,
//   html: shell({
//     heading: 'New contact enquiry',
//     intro: `${name || 'Someone'} submitted the contact form.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Name', name],
//         ['Email', email],
//         ['Phone', phone],
//         ['Subject', subject],
//         ['Message', message],
//         ['Received', fmtWhen(submittedAt) || 'Just now']
//       ])}
//       ${button(`${FRONTEND_REDIRECT_URL}/superadmin/contacts`, 'Open in dashboard')}
//     `,
//     footNote: 'You are receiving this because you are an administrator on this system.'
//   })
// });

// const contactStatusUpdate = ({ name, subject, message, status, feedback }) => {
//   const labels = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
//   const statusLabel = labels[status] || status;

//   return {
//     subject: `Update on your enquiry: ${statusLabel}`,
//     html: shell({
//       heading: 'Update on your enquiry',
//       intro: `Hi ${name || 'there'}, there is an update on the message you sent us.`,
//       bodyHtml: `
//         <p style="margin:0 0 14px 0;">Your enquiry is now marked as ${statusPill(statusLabel)}</p>
//         ${feedback
//           ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
//                <tr>
//                  <td style="padding:16px 18px; background-color:#f7f9fc; border-left:3px solid #1a5fb4; border-radius:4px;">
//                    <div style="font-size:12px; font-weight:700; color:#5b6472; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:6px;">Response from our team</div>
//                    <div style="font-size:15px; line-height:1.6; color:#2c3340;">${escapeHtml(feedback)}</div>
//                  </td>
//                </tr>
//              </table>`
//           : ''}
//         ${detailRows([
//           ['Subject', subject],
//           ['Your message', message],
//           ['Status', statusLabel]
//         ])}
//         <p style="margin:16px 0 0 0;">If you need anything else, reply to this email.</p>
//       `,
//       footNote: 'You are receiving this because you contacted us through our website.'
//     })
//   };
// };

// // ─── NEW: Subscription expiry templates ──────────────────────────

// const subscriptionExpiryReminder = ({ name, daysLeft, expiryDate, renewalLink }) => ({
//   subject: `Your subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
//   html: shell({
//     heading: `Subscription expiring soon`,
//     intro: `Hi ${name || 'there'}, this is a friendly reminder that your subscription will end in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">Your plan will expire on <strong>${escapeHtml(expiryDate)}</strong>.</p>
//       ${renewalLink ? button(renewalLink, 'Renew now') : ''}
//       <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If you don't renew, you will lose access to premium features.</p>
//     `,
//     footNote: 'Subscription reminder from Pet Hospital Portal'
//   })
// });


// // ─── NEW: Appointment feedback invitation ────────────────────
// const appointmentFeedbackInvitation = ({ patientName, hospitalName, appointmentNumber, date, time, feedbackLink }) => ({
//   subject: `Share your feedback for appointment #${appointmentNumber}`,
//   html: shell({
//     heading: 'We’d love your feedback',
//     intro: `Hi ${patientName || 'there'}, your appointment at ${hospitalName} is now complete.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">Please take a moment to share your experience. Your feedback helps us improve.</p>
//       ${detailRows([
//         ['Appointment #', appointmentNumber],
//         ['Hospital', hospitalName],
//         ['Date', date],
//         ['Time', time]
//       ])}
//       ${button(feedbackLink, 'Give Feedback')}
//       <p class="link-note">If the button doesn’t work, use this link:</p>
//       <p style="margin:0;"><a href="${feedbackLink}">${feedbackLink}</a></p>
//     `,
//     footNote: 'Feedback invitation from Pet Hospital Portal'
//   })
// });

// const subscriptionExpired = ({ name, expiryDate, renewalLink }) => ({
//   subject: 'Your subscription has expired',
//   html: shell({
//     heading: 'Subscription expired',
//     intro: `Hi ${name || 'there'}, your subscription expired on ${escapeHtml(expiryDate)}.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">To continue using all features, please renew your plan.</p>
//       ${renewalLink ? button(renewalLink, 'Renew now') : ''}
//       <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If you have any questions, contact support.</p>
//     `,
//     footNote: 'Subscription expiration notice from Pet Hospital Portal'
//   })
// });

// // ─── Single export ──────────────────────────────────────────────

// module.exports = {
//   // Layout utilities (used by emailService for test email)
//   shell,
//   button,
//   statusPill,
//   detailRows,
//   fmtWhen,

//   // All template functions
//   demoReceived,
//   scheduleInvite,
//   demoConfirmation,
//   meetingLinkReady,
//   feedbackRequest,
//   registrationReceived,
//   registrationApproved,
//   registrationDenied,
//   passwordResetOtp,
//   appointmentConfirmation,
//   appointmentStatusUpdate,
//   appointmentNewForAdmin,
//   appointmentRescheduled,
//   appointmentCancelled,
//   contactReceived,
//   contactNewForAdmin,
//   contactStatusUpdate,
//   appointmentFeedbackInvitation,  

//   // Subscription expiry
//   subscriptionExpiryReminder,
//   subscriptionExpired
// };


// const FRONTEND_REDIRECT_URL =
//   process.env.FRONTEND_REDIRECT_URL ||
//   process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
//   'http://localhost:5173';

// const escapeHtml = (s) =>
//   String(s ?? '')
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');

// // Brand palette
// const C = {
//   blue:      '#1E40AF',
//   blueDark:  '#1E3A8A',
//   blueLight: '#DBEAFE',
//   tintBg:    '#F5F8FF',
//   ink:       '#16203A',
//   body:      '#414B60',
//   muted:     '#6B7488',
//   line:      '#DDE4F0',
//   page:      '#EEF2F9'
// };

// const BRAND = process.env.MAIL_BRAND_NAME || 'Pet Hospital Portal';
// const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_EMAIL || process.env.GOOGLE_USER || process.env.GMAIL_USER || '';
// const POSTAL_ADDRESS = process.env.MAIL_POSTAL_ADDRESS || '';
// const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// // Status tones for pills
// const STATUS_TONES = {
//   pending:     { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
//   new:         { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
//   in_progress: { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   confirmed:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   scheduled:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
//   rescheduled: { bg: '#CFFAFE', fg: '#155E75', bd: '#A5F3FC' },
//   completed:   { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   resolved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   approved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
//   cancelled:   { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
//   denied:      { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
//   closed:      { bg: '#E5E7EB', fg: '#374151', bd: '#D1D5DB' }
// };

// const statusPill = (label) => {
//   const key = String(label || '').toLowerCase().replace(/[\s-]+/g, '_');
//   const t = STATUS_TONES[key] || { bg: C.blueLight, fg: C.blueDark, bd: '#BFDBFE' };
//   return `<span style="display:inline-block; padding:5px 12px; background-color:${t.bg}; color:${t.fg}; border:1px solid ${t.bd}; border-radius:999px; font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:0.3px;">${escapeHtml(label)}</span>`;
// };

// const shell = ({ heading, intro, bodyHtml, footNote }) => {
//   const year = new Date().getFullYear();
//   return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
// <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
// <head>
//   <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta name="x-apple-disable-message-reformatting" />
//   <meta name="color-scheme" content="light" />
//   <meta name="supported-color-schemes" content="light" />
//   <title>${escapeHtml(heading)}</title>
//   <style type="text/css">
//     body { margin:0 !important; padding:0 !important; width:100% !important; }
//     img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
//     table { border-collapse:collapse !important; }
//     a { color:${C.blue}; }
//     @media only screen and (max-width:600px) {
//       .wrap { width:100% !important; }
//       .pad  { padding-left:22px !important; padding-right:22px !important; }
//       .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
//       .stack-label { padding-bottom:2px !important; border-bottom:0 !important; }
//       .stack-value { padding-top:0 !important; }
//       .btn a { display:block !important; text-align:center !important; }
//     }
//   </style>
// </head>
// <body style="margin:0; padding:0; background-color:${C.page};">
//   <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C.page};">
//     ${escapeHtml(intro || heading)}
//   </div>
//   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
//     <tr>
//       <td align="center" style="padding:30px 12px;">
//         <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
//           <tr>
//             <td style="background-color:#ffffff; border:1px solid ${C.line}; border-radius:10px; overflow:hidden;">
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.blue}" style="background-color:${C.blue}; background-image:linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%);">
//                 <tr>
//                   <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:15px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">
//                     ${escapeHtml(BRAND)}
//                   </td>
//                 </tr>
//               </table>
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
//                 <tr>
//                   <td class="pad" style="padding:30px 32px 8px 32px; font-family:${FONT};">
//                     <h1 style="margin:0 0 12px 0; font-size:21px; line-height:1.35; font-weight:700; color:${C.blueDark};">${escapeHtml(heading)}</h1>
//                     ${intro ? `<p style="margin:0 0 4px 0; font-size:15px; line-height:1.65; color:${C.body};">${escapeHtml(intro)}</p>` : ''}
//                   </td>
//                 </tr>
//                 <tr>
//                   <td class="pad" style="padding:8px 32px 30px 32px; font-family:${FONT}; font-size:15px; line-height:1.65; color:${C.ink};">
//                     ${bodyHtml}
//                   </td>
//                 </tr>
//               </table>
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tintBg}" style="background-color:${C.tintBg}; border-top:1px solid ${C.line};">
//                 <tr>
//                   <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:12px; line-height:1.65; color:${C.muted};">
//                     <p style="margin:0 0 6px 0;">${escapeHtml(footNote || `You are receiving this because you used ${BRAND}.`)}</p>
//                     ${SUPPORT_EMAIL ? `<p style="margin:0 0 6px 0;">Questions? Reply to this email or write to <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${C.blue}; text-decoration:underline;">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>` : ''}
//                     ${POSTAL_ADDRESS ? `<p style="margin:0 0 6px 0;">${escapeHtml(POSTAL_ADDRESS)}</p>` : ''}
//                     <p style="margin:8px 0 0 0; color:#98A0B3;">&copy; ${year} ${escapeHtml(BRAND)}</p>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>
//         </table>
//       </td>
//     </tr>
//   </table>
// </body>
// </html>`;
// };

// const button = (href, label) => `
//   <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
//     <tr>
//       <td style="background-color:#1a5fb4; border-radius:5px;">
//         <a href="${href}" target="_blank" rel="noopener" style="display:inline-block; padding:12px 22px; font-family:${FONT}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:5px;">${escapeHtml(label)}</a>
//       </td>
//     </tr>
//   </table>
// `;

// const detailRows = (rows) => {
//   const validRows = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '');
//   if (!validRows.length) return '';
//   const cell = `font-family:${FONT}; font-size:14px; vertical-align:top;`;
//   return `
//     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px 0; border:1px solid #e3e6ea; border-radius:6px; background-color:#fbfcfd;">
//       ${validRows
//         .map(([k, v], idx) => {
//           const border = idx !== validRows.length - 1 ? 'border-bottom:1px solid #e9ecef;' : '';
//           return `<tr>
//             <td class="stack stack-label" style="${cell} width:170px; padding:11px 16px; color:#5b6472; font-weight:600; ${border}">${escapeHtml(k)}</td>
//             <td class="stack stack-value" style="${cell} padding:11px 16px; color:#1b1f24; font-weight:500; word-break:break-word; ${border}">${escapeHtml(v)}</td>
//           </tr>`;
//         })
//         .join('')}
//     </table>
//   `;
// };

// const fmtWhen = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

// // ─── All template functions ──────────────────────────────────

// // const demoReceived = ({ contactName, hospitalName }) => ({
// //   subject: 'Demo request received',
// //   html: shell({
// //     heading: 'We received your demo request',
// //     intro: `Hi ${contactName || 'there'}, thanks for reaching out to us.`,
// //     bodyHtml: `
// //       <p style="margin: 0 0 14px 0;">Your request for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> has been received and is now in our queue.</p>
// //       ${detailRows([
// //         ['Hospital', hospitalName],
// //         ['Contact', contactName],
// //         ['Status', 'Awaiting scheduling']
// //       ])}
// //     `,
// //     footNote: 'Demo request from Pet Hospital Portal'
// //   })
// // });

// // email_template/index.js

// // email_template/index.js

// const demoReceived = ({ contactName, hospitalName, token, bookingId }) => ({
//   subject: 'Demo request received',
//   html: shell({
//     heading: 'We received your demo request',
//     intro: `Hi ${contactName || 'there'}, thanks for reaching out to us.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your request for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> has been received and is now in our queue.</p>
//       ${detailRows([
//         ['Booking ID', bookingId],
//         ['Hospital', hospitalName],
//         ['Contact', contactName],
//         ['Status', 'Awaiting scheduling']
//       ])}
//       ${token ? button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, 'Schedule your demo now') : ''}
//       ${token ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">Or use this link: <a href="${FRONTEND_REDIRECT_URL}/schedule/${token}">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>` : ''}
//     `,
//     footNote: 'Demo request from Pet Hospital Portal'
//   })
// });

// const scheduleInvite = ({ contactName, hospitalName, token }) => ({
//   subject: 'Schedule your demo',
//   html: shell({
//     heading: 'Choose a convenient time',
//     intro: `Hi ${contactName || 'there'}, please schedule your personalized demo at a time that works best for you.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is ready to be scheduled.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, 'Schedule demo')}
//       <p class="link-note">If the button doesn’t work, use this secure link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/schedule/${token}">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>
//     `,
//     footNote: 'Scheduling link from Pet Hospital Portal'
//   })
// });

// const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your demo is confirmed',
//   html: shell({
//     heading: 'Demo confirmed',
//     intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'To be confirmed']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Demo confirmation from Pet Hospital Portal'
//   })
// });

// const meetingLinkReady = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
//   subject: 'Your meeting link is ready',
//   html: shell({
//     heading: 'Meeting link ready',
//     intro: `Hi ${contactName || 'there'}, your secure meeting link is ready.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['When', fmtWhen(scheduledAt) || 'Scheduled']
//       ])}
//       ${meetingLink ? button(meetingLink, 'Join meeting') : ''}
//     `,
//     footNote: 'Meeting link from Pet Hospital Portal'
//   })
// });

// const feedbackRequest = ({ contactName, token }) => ({
//   subject: 'Please share your feedback',
//   html: shell({
//     heading: 'We’d love your feedback',
//     intro: `Hi ${contactName || 'there'}, thank you for attending the demo session.`,
//     bodyHtml: `
//       <p style="margin: 0 0 14px 0;">We’d appreciate a quick moment of your time to share your feedback.</p>
//       ${button(`${FRONTEND_REDIRECT_URL}/feedback/${token}`, 'Share feedback')}
//       <p class="link-note">If the button doesn’t work, use this link:</p>
//       <p style="margin: 0;"><a class="plain-link" href="${FRONTEND_REDIRECT_URL}/feedback/${token}">${FRONTEND_REDIRECT_URL}/feedback/${token}</a></p>
//     `,
//     footNote: 'Feedback request from Pet Hospital Portal'
//   })
// });

// const registrationReceived = ({ contactName, hospitalName }) => ({
//   subject: 'Registration received',
//   html: shell({
//     heading: 'Registration received',
//     intro: `Hi ${contactName || 'there'}, we’ve received your registration.`,
//     bodyHtml: detailRows([
//       ['Hospital', hospitalName],
//       ['Contact', contactName],
//       ['Status', 'Pending approval']
//     ]),
//     footNote: 'Registration from Pet Hospital Portal'
//   })
// });

// const registrationApproved = ({ contactName, hospitalName, loginEmail, tempPassword, origin }) => {
//   const url = origin || FRONTEND_REDIRECT_URL;
//   return {
//     subject: 'Your account is ready',
//     html: shell({
//       heading: 'Account approved',
//       intro: `Hi ${contactName || 'there'}, your hospital account has been approved.`,
//       bodyHtml: `
//         ${detailRows([
//           ['Hospital', hospitalName],
//           ['Login email', loginEmail],
//           ['Password', tempPassword]
//         ])}
//         ${button(`${url}/login`, 'Log in')}
//       `,
//       footNote: 'Account approval from Pet Hospital Portal'
//     })
//   };
// };

// const registrationDenied = ({ contactName, hospitalName }) => ({
//   subject: 'Registration update',
//   html: shell({
//     heading: 'Registration update',
//     intro: `Hi ${contactName || 'there'},`,
//     bodyHtml: `
//       <p style="margin: 0;">We couldn’t approve the registration for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> at this time. If you believe this is a mistake, please contact support.</p>
//     `,
//     footNote: 'Registration update from Pet Hospital Portal'
//   })
// });

// const passwordResetOtp = ({ contactName, otp }) => ({
//   subject: 'Password reset code',
//   html: shell({
//     heading: 'Password reset code',
//     intro: `Hi ${contactName || 'there'}, use the code below to reset your password.`,
//     bodyHtml: `
//       <div style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:16px;padding:22px;text-align:center;margin:20px 0;">
//         <div style="font-size:12px;color:#64748b;margin-bottom:10px;font-weight:600;letter-spacing:0.3px;">Your verification code</div>
//         <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${escapeHtml(otp)}</div>
//       </div>
//       <p style="margin:0;font-size:13px;color:#64748b;">This code expires in 10 minutes.</p>
//     `,
//     footNote: 'Password reset from Pet Hospital Portal'
//   })
// });

// // ─── UPDATED: Appointment confirmation with number ──────────
// const appointmentConfirmation = ({
//   patientName,
//   patientPhone,
//   hospitalName,
//   date,
//   time,
//   petName,
//   description,
//   email,
//   appointmentNumber   // ✅ new
// }) => ({
//   subject: `Your appointment request has been received (#${appointmentNumber})`,
//   html: shell({
//     heading: 'Appointment request received',
//     intro: `Hi ${patientName || 'there'}, thanks for booking with ${hospitalName || 'us'}!`,
//     bodyHtml: `
//       <p style="margin:0 0 6px;color:#475569;font-size:15px;line-height:1.6;">
//         We've received your appointment request. The hospital will review and confirm it shortly.
//       </p>
//       ${detailRows([
//         ['Appointment #', appointmentNumber],   // ✅ added
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Phone', patientPhone],
//         ['Email', email],
//         ['Pet Name', petName],
//         ['Date', date || 'To be confirmed'],
//         ['Time', time || 'To be confirmed'],
//         ['Status', 'Pending confirmation']
//       ].filter(row => row[1]))}
//       <p style="margin:16px 0 0 0;">The hospital will contact you if anything needs changing.</p>
//     `,
//     footNote: 'You booked an appointment via the Pet Hospital Portal.'
//   })
// });

// // const appointmentStatusUpdate = ({ patientName, hospitalName, date, time, status, message }) => ({
// //   subject: 'Your appointment status has been updated',
// //   html: shell({
// //     heading: 'Appointment status update',
// //     intro: `Hi ${patientName || 'there'}, your appointment status has been changed.`,
// //     bodyHtml: `
// //       <p style="margin:0 0 14px 0;">
// //         Your appointment at <strong>${escapeHtml(hospitalName || 'the hospital')}</strong> is now ${statusPill(status)}
// //       </p>
// //       ${detailRows([
// //         ['Hospital', hospitalName],
// //         ['Patient', patientName],
// //         ['Date', date || 'To be confirmed'],
// //         ['Time', time || 'To be confirmed'],
// //         ['New Status', status]
// //       ])}
// //       ${message ? `<p style="margin:10px 0 0;color:#475569;font-size:15px;">Note: ${message}</p>` : ''}
// //       <p style="margin:16px 0 0;color:#475569;font-size:15px;">If you have any questions, please contact the hospital directly.</p>
// //     `,
// //     footNote: 'Appointment status update from Pet Hospital Portal'
// //   })
// // });
// const appointmentStatusUpdate = ({ patientName, hospitalName, date, time, status, message, appointmentNumber }) => ({
//   subject: `Your appointment status has been updated (#${appointmentNumber})`,
//   html: shell({
//     heading: 'Appointment status update',
//     intro: `Hi ${patientName || 'there'}, your appointment status has been changed.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">
//         Your appointment at <strong>${escapeHtml(hospitalName || 'the hospital')}</strong> is now ${statusPill(status)}
//       </p>
//       ${detailRows([
//         ['Appointment #', appointmentNumber],
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Date', date || 'To be confirmed'],
//         ['Time', time || 'To be confirmed'],
//         ['New Status', status]
//       ])}
//       ${message ? `<p style="margin:10px 0 0;color:#475569;font-size:15px;">Note: ${message}</p>` : ''}
//       <p style="margin:16px 0 0;color:#475569;font-size:15px;">If you have any questions, please contact the hospital directly.</p>
//     `,
//     footNote: 'Appointment status update from Pet Hospital Portal'
//   })
// });

// // ─── UPDATED: Admin notification with appointment number ────
// const appointmentNewForAdmin = ({
//   patientName,
//   patientPhone,
//   email,
//   hospitalName,
//   date,
//   time,
//   petName,
//   description,
//   source,
//   appointmentNumber   // ✅ new
// }) => ({
//   subject: `New appointment booking: ${hospitalName || 'Hospital'} (#${appointmentNumber})`,
//   html: shell({
//     heading: 'New appointment booked',
//     intro: `${patientName || 'A patient'} booked an appointment${hospitalName ? ` at ${hospitalName}` : ''}.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Appointment #', appointmentNumber],   // ✅ added
//         ['Hospital', hospitalName],
//         ['Patient', patientName],
//         ['Phone', patientPhone],
//         ['Email', email],
//         ['Pet name', petName],
//         ['Date', date || 'Not specified'],
//         ['Time', time || 'Not specified'],
//         ['Reason', description],
//         ['Source', source === 'public' ? 'Public booking page' : 'Signed-in user'],
//         ['Status', 'Pending']
//       ])}
//       ${button(`${FRONTEND_REDIRECT_URL}/superadmin/appointments`, 'Review appointment')}
//     `,
//     footNote: 'You are receiving this because you are an administrator on this system.'
//   })
// });

// const appointmentRescheduled = ({ patientName, hospitalName, date, time, previousDate, previousTime }) => ({
//   subject: 'Your appointment has been rescheduled',
//   html: shell({
//     heading: 'Appointment rescheduled',
//     intro: `Hi ${patientName || 'there'}, your appointment has been moved to a new slot.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Previous slot', [previousDate, previousTime].filter(Boolean).join(' at ')],
//         ['New date', date || 'To be confirmed'],
//         ['New time', time || 'To be confirmed'],
//         ['Status', 'Pending confirmation']
//       ])}
//       <p style="margin:16px 0 0 0;">The hospital will confirm the new slot shortly.</p>
//     `,
//     footNote: 'You are receiving this because you booked an appointment with us.'
//   })
// });

// const appointmentCancelled = ({ patientName, hospitalName, date, time, reason }) => ({
//   subject: 'Your appointment has been cancelled',
//   html: shell({
//     heading: 'Appointment cancelled',
//     intro: `Hi ${patientName || 'there'}, your appointment has been cancelled as requested.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Hospital', hospitalName],
//         ['Date', date],
//         ['Time', time],
//         ['Reason', reason],
//         ['Status', 'Cancelled']
//       ])}
//       <p style="margin:16px 0 0 0;">You can book again at any time from our appointment page.</p>
//     `,
//     footNote: 'You are receiving this because you booked an appointment with us.'
//   })
// });

// const contactReceived = ({ name, subject, message, phone, email }) => ({
//   subject: 'We received your message',
//   html: shell({
//     heading: 'Thanks for getting in touch',
//     intro: `Hi ${name || 'there'}, we have received your message and our team will get back to you shortly.`,
//     bodyHtml: `
//       <p style="margin:0 0 4px 0;">Here is a copy of what you sent. There is nothing else you need to do &mdash; we will reply to this email address.</p>
//       ${detailRows([
//         ['Name', name],
//         ['Email', email],
//         ['Phone', phone],
//         ['Subject', subject],
//         ['Message', message],
//         ['Status', 'New, awaiting review']
//       ])}
//     `,
//     footNote: 'You are receiving this because you submitted the contact form on our website.'
//   })
// });

// const contactNewForAdmin = ({ name, email, phone, subject, message, submittedAt }) => ({
//   subject: `New contact enquiry: ${subject || 'General Inquiry'}`,
//   html: shell({
//     heading: 'New contact enquiry',
//     intro: `${name || 'Someone'} submitted the contact form.`,
//     bodyHtml: `
//       ${detailRows([
//         ['Name', name],
//         ['Email', email],
//         ['Phone', phone],
//         ['Subject', subject],
//         ['Message', message],
//         ['Received', fmtWhen(submittedAt) || 'Just now']
//       ])}
//       ${button(`${FRONTEND_REDIRECT_URL}/superadmin/contacts`, 'Open in dashboard')}
//     `,
//     footNote: 'You are receiving this because you are an administrator on this system.'
//   })
// });

// const contactStatusUpdate = ({ name, subject, message, status, feedback }) => {
//   const labels = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
//   const statusLabel = labels[status] || status;
//   return {
//     subject: `Update on your enquiry: ${statusLabel}`,
//     html: shell({
//       heading: 'Update on your enquiry',
//       intro: `Hi ${name || 'there'}, there is an update on the message you sent us.`,
//       bodyHtml: `
//         <p style="margin:0 0 14px 0;">Your enquiry is now marked as ${statusPill(statusLabel)}</p>
//         ${feedback
//           ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
//                <tr>
//                  <td style="padding:16px 18px; background-color:#f7f9fc; border-left:3px solid #1a5fb4; border-radius:4px;">
//                    <div style="font-size:12px; font-weight:700; color:#5b6472; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:6px;">Response from our team</div>
//                    <div style="font-size:15px; line-height:1.6; color:#2c3340;">${escapeHtml(feedback)}</div>
//                  </td>
//                </tr>
//              </table>`
//           : ''}
//         ${detailRows([
//           ['Subject', subject],
//           ['Your message', message],
//           ['Status', statusLabel]
//         ])}
//         <p style="margin:16px 0 0 0;">If you need anything else, reply to this email.</p>
//       `,
//       footNote: 'You are receiving this because you contacted us through our website.'
//     })
//   };
// };

// const subscriptionExpiryReminder = ({ name, daysLeft, expiryDate, renewalLink }) => ({
//   subject: `Your subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
//   html: shell({
//     heading: 'Subscription expiring soon',
//     intro: `Hi ${name || 'there'}, this is a friendly reminder that your subscription will end in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">Your plan will expire on <strong>${escapeHtml(expiryDate)}</strong>.</p>
//       ${renewalLink ? button(renewalLink, 'Renew now') : ''}
//       <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If you don't renew, you will lose access to premium features.</p>
//     `,
//     footNote: 'Subscription reminder from Pet Hospital Portal'
//   })
// });

// const subscriptionExpired = ({ name, expiryDate, renewalLink }) => ({
//   subject: 'Your subscription has expired',
//   html: shell({
//     heading: 'Subscription expired',
//     intro: `Hi ${name || 'there'}, your subscription expired on ${escapeHtml(expiryDate)}.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">To continue using all features, please renew your plan.</p>
//       ${renewalLink ? button(renewalLink, 'Renew now') : ''}
//       <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If you have any questions, contact support.</p>
//     `,
//     footNote: 'Subscription expiration notice from Pet Hospital Portal'
//   })
// });

// const appointmentFeedbackInvitation = ({ patientName, hospitalName, appointmentNumber, date, time, feedbackLink }) => ({
//   subject: `Share your feedback for appointment #${appointmentNumber}`,
//   html: shell({
//     heading: 'We’d love your feedback',
//     intro: `Hi ${patientName || 'there'}, your appointment at ${hospitalName} is now complete.`,
//     bodyHtml: `
//       <p style="margin:0 0 14px 0;">Please take a moment to share your experience. Your feedback helps us improve.</p>
//       ${detailRows([
//         ['Appointment #', appointmentNumber],
//         ['Hospital', hospitalName],
//         ['Date', date],
//         ['Time', time]
//       ])}
//       ${button(feedbackLink, 'Give Feedback')}
//       <p class="link-note">If the button doesn’t work, use this link:</p>
//       <p style="margin:0;"><a href="${feedbackLink}">${feedbackLink}</a></p>
//     `,
//     footNote: 'Feedback invitation from Pet Hospital Portal'
//   })
// });

// // ─── Single export ──────────────────────────────────────────────
// module.exports = {
//   // Layout utilities
//   shell,
//   button,
//   statusPill,
//   detailRows,
//   fmtWhen,

//   // All template functions
//   demoReceived,
//   scheduleInvite,
//   demoConfirmation,
//   meetingLinkReady,
//   feedbackRequest,
//   registrationReceived,
//   registrationApproved,
//   registrationDenied,
//   passwordResetOtp,
//   appointmentConfirmation,
//   appointmentStatusUpdate,
//   appointmentNewForAdmin,
//   appointmentRescheduled,
//   appointmentCancelled,
//   contactReceived,
//   contactNewForAdmin,
//   contactStatusUpdate,
//   subscriptionExpiryReminder,
//   subscriptionExpired,
//   appointmentFeedbackInvitation
// };




// email_template/index.js
const FRONTEND_REDIRECT_URL =
  process.env.FRONTEND_REDIRECT_URL ||
  process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
  'http://localhost:5173';

// ─── Logo URL ──────────────────────────────────────────────────
const LOGO_URL = process.env.LOGO_URL || 'http://localhost:5173/src/assets/sign.png';

// ─── Inspirational Quotes ──────────────────────────────────────
const getRandomQuote = () => {
  const quotes = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Your limitation—it's only your imagination.", author: "Unknown" },
    { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
    { text: "Dream big. Work hard. Stay focused.", author: "Unknown" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
    { text: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" },
    { text: "If you are working on something that you really care about, you don't have to be pushed. The vision pulls you.", author: "Steve Jobs" },
    { text: "People who are crazy enough to think they can change the world, are the ones who do.", author: "Rob Siltanen" },
    { text: "Excellence is not a skill, it's an attitude.", author: "Ralph Marston" },
    { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
    { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" }
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Brand palette
const C = {
  blue:      '#1E40AF',
  blueDark:  '#1E3A8A',
  blueLight: '#DBEAFE',
  tintBg:    '#F5F8FF',
  ink:       '#16203A',
  body:      '#414B60',
  muted:     '#6B7488',
  line:      '#DDE4F0',
  page:      '#EEF2F9'
};

const BRAND = process.env.MAIL_BRAND_NAME || 'Pet Hospital Portal';
const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_EMAIL || process.env.GOOGLE_USER || process.env.GMAIL_USER || '';
const POSTAL_ADDRESS = process.env.MAIL_POSTAL_ADDRESS || '';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Status tones for pills
const STATUS_TONES = {
  pending:     { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
  new:         { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
  in_progress: { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
  confirmed:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
  scheduled:   { bg: '#DBEAFE', fg: '#1E40AF', bd: '#BFDBFE' },
  rescheduled: { bg: '#CFFAFE', fg: '#155E75', bd: '#A5F3FC' },
  completed:   { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
  resolved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
  approved:    { bg: '#D1FAE5', fg: '#065F46', bd: '#A7F3D0' },
  cancelled:   { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
  denied:      { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
  closed:      { bg: '#E5E7EB', fg: '#374151', bd: '#D1D5DB' }
};

const statusPill = (label) => {
  const key = String(label || '').toLowerCase().replace(/[\s-]+/g, '_');
  const t = STATUS_TONES[key] || { bg: C.blueLight, fg: C.blueDark, bd: '#BFDBFE' };
  return `<span style="display:inline-block; padding:5px 12px; background-color:${t.bg}; color:${t.fg}; border:1px solid ${t.bd}; border-radius:999px; font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:0.3px;">${escapeHtml(label)}</span>`;
};

// ─── Updated Shell with Logo & Quotes ────────────────────────
const shell = ({ heading, intro, bodyHtml, footNote, showQuote = true }) => {
  const year = new Date().getFullYear();
  const quote = showQuote ? getRandomQuote() : null;
  
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(heading)}</title>
  <style type="text/css">
    body { margin:0 !important; padding:0 !important; width:100% !important; background-color:${C.page}; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    table { border-collapse:collapse !important; }
    a { color:${C.blue}; }
    .logo-img { max-width:70px; height:auto; border-radius:50%; border:3px solid rgba(255,255,255,0.3); display:block; margin:0 auto 10px auto; }
    .quote-box { 
      background: linear-gradient(135deg, #f0f4ff, #e8edf5); 
      padding: 20px 25px; 
      border-radius: 10px; 
      margin: 25px 0; 
      border-left: 4px solid ${C.blue};
      position: relative;
    }
    .quote-box .quote-text {
      font-size: 15px;
      font-style: italic;
      color: ${C.ink};
      margin: 0 0 5px 0;
      line-height: 1.6;
    }
    .quote-box .quote-author {
      font-size: 13px;
      color: ${C.muted};
      margin: 0;
      text-align: right;
    }
    .quote-box .quote-icon {
      font-size: 28px;
      color: ${C.blue};
      opacity: 0.2;
      position: absolute;
      top: 10px;
      right: 15px;
    }
    @media only screen and (max-width:600px) {
      .wrap { width:100% !important; }
      .pad  { padding-left:22px !important; padding-right:22px !important; }
      .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
      .stack-label { padding-bottom:2px !important; border-bottom:0 !important; }
      .stack-value { padding-top:0 !important; }
      .btn a { display:block !important; text-align:center !important; }
      .logo-img { max-width:55px; }
      .quote-box { padding:15px 18px; }
      .quote-box .quote-text { font-size:14px; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${C.page};">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C.page};">
    ${escapeHtml(intro || heading)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
    <tr>
      <td align="center" style="padding:30px 12px;">
        <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td style="background-color:#ffffff; border:1px solid ${C.line}; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <!-- Header with Logo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.blue}" style="background-color:${C.blue}; background-image:linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%);">
                <tr>
                  <td class="pad" style="padding:20px 32px; font-family:${FONT}; text-align:center;">
                    ${LOGO_URL ? `<img src="${LOGO_URL}" alt="${BRAND}" class="logo-img" style="max-width:70px; height:auto; border-radius:50%; border:3px solid rgba(255,255,255,0.3); display:block; margin:0 auto 8px auto;" />` : ''}
                    <div style="font-size:18px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">
                      ${escapeHtml(BRAND)}
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="pad" style="padding:30px 32px 8px 32px; font-family:${FONT};">
                    <h1 style="margin:0 0 12px 0; font-size:22px; line-height:1.35; font-weight:700; color:${C.blueDark};">${escapeHtml(heading)}</h1>
                    ${intro ? `<p style="margin:0 0 4px 0; font-size:15px; line-height:1.65; color:${C.body};">${escapeHtml(intro)}</p>` : ''}
                  </td>
                </tr>
                <tr>
                  <td class="pad" style="padding:8px 32px 30px 32px; font-family:${FONT}; font-size:15px; line-height:1.65; color:${C.ink};">
                    ${bodyHtml}
                    
                    ${quote ? `
                      <div class="quote-box">
                        <div class="quote-icon">"</div>
                        <p class="quote-text">${escapeHtml(quote.text)}</p>
                        <p class="quote-author">— ${escapeHtml(quote.author)}</p>
                      </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tintBg}" style="background-color:${C.tintBg}; border-top:1px solid ${C.line};">
                <tr>
                  <td class="pad" style="padding:20px 32px; font-family:${FONT}; font-size:12px; line-height:1.65; color:${C.muted};">
                    <p style="margin:0 0 6px 0;">${escapeHtml(footNote || `You are receiving this because you used ${BRAND}.`)}</p>
                    ${SUPPORT_EMAIL ? `<p style="margin:0 0 6px 0;">Questions? <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${C.blue}; text-decoration:underline;">${escapeHtml(SUPPORT_EMAIL)}</a></p>` : ''}
                    ${POSTAL_ADDRESS ? `<p style="margin:0 0 6px 0;">${escapeHtml(POSTAL_ADDRESS)}</p>` : ''}
                    <p style="margin:8px 0 0 0; color:#98A0B3;">&copy; ${year} ${escapeHtml(BRAND)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── Button Helper ─────────────────────────────────────────────
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
    <tr>
      <td style="background-color:${C.blue}; border-radius:8px; box-shadow:0 4px 12px rgba(30,64,175,0.3);">
        <a href="${href}" target="_blank" rel="noopener" style="display:inline-block; padding:12px 28px; font-family:${FONT}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>
`;

// ─── Detail Rows Helper ────────────────────────────────────────
const detailRows = (rows) => {
  const validRows = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '');
  if (!validRows.length) return '';
  const cell = `font-family:${FONT}; font-size:14px; vertical-align:top;`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px 0; border:1px solid #e3e6ea; border-radius:8px; background-color:#fbfcfd; overflow:hidden;">
      ${validRows
        .map(([k, v], idx) => {
          const border = idx !== validRows.length - 1 ? 'border-bottom:1px solid #e9ecef;' : '';
          return `<tr>
            <td class="stack stack-label" style="${cell} width:170px; padding:11px 16px; color:#5b6472; font-weight:600; ${border}">${escapeHtml(k)}</td>
            <td class="stack stack-value" style="${cell} padding:11px 16px; color:#1b1f24; font-weight:500; word-break:break-word; ${border}">${escapeHtml(v)}</td>
          </tr>`;
        })
        .join('')}
    </table>
  `;
};

const fmtWhen = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

// ─── All Template Functions ────────────────────────────────────

const demoReceived = ({ contactName, hospitalName, token, bookingId }) => ({
  subject: '📋 Demo Request Received',
  html: shell({
    heading: 'We received your demo request',
    intro: `Hi ${contactName || 'there'}, thanks for reaching out to us.`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">Your request for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> has been received and is now in our queue.</p>
      ${detailRows([
        ['Booking ID', bookingId],
        ['Hospital', hospitalName],
        ['Contact', contactName],
        ['Status', 'Awaiting scheduling']
      ])}
      ${token ? button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, '📅 Schedule Your Demo') : ''}
      ${token ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">Or use this link: <a href="${FRONTEND_REDIRECT_URL}/schedule/${token}" style="color:${C.blue};">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>` : ''}
    `,
    footNote: 'You are receiving this because you requested a demo.',
    showQuote: true
  })
});

const scheduleInvite = ({ contactName, hospitalName, token }) => ({
  subject: '📅 Schedule Your Demo',
  html: shell({
    heading: 'Choose a convenient time',
    intro: `Hi ${contactName || 'there'}, please schedule your personalized demo at a time that works best for you.`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is ready to be scheduled.</p>
      ${button(`${FRONTEND_REDIRECT_URL}/schedule/${token}`, '📅 Schedule Demo')}
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Or use this link: <a href="${FRONTEND_REDIRECT_URL}/schedule/${token}" style="color:${C.blue};">${FRONTEND_REDIRECT_URL}/schedule/${token}</a></p>
    `,
    footNote: 'This scheduling link is unique to you.',
    showQuote: true
  })
});

const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink, meetingDetails }) => {
  const date = scheduledAt ? new Date(scheduledAt) : null;
  const formattedDate = date ? date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'To be confirmed';
  const formattedTime = date ? date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  }) : '';

  return {
    subject: '✅ Your Demo is Confirmed!',
    html: shell({
      heading: 'Demo Confirmed',
      intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
      bodyHtml: `
        <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is confirmed.</p>
        ${detailRows([
          ['Hospital', hospitalName],
          ['📅 Date', formattedDate],
          ['⏰ Time', formattedTime + ' (IST)'],
          ['⏱️ Duration', '30 minutes'],
          ['👤 Contact', contactName]
        ])}
        ${meetingLink ? `
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${C.blue};">
            <p style="margin: 0 0 5px 0;"><strong>🔗 Meeting Link:</strong></p>
            <p style="margin: 5px 0; word-break: break-all;">
              <a href="${meetingLink}" style="color: ${C.blue}; text-decoration: none; font-weight: 600;" target="_blank">${meetingLink}</a>
            </p>
          </div>
          ${button(meetingLink, '🔗 Join Meeting')}
          <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">📌 Please join 5 minutes before the scheduled time.</p>
        ` : ''}
      `,
      footNote: 'Please save this email for your reference.',
      showQuote: true
    })
  };
};

const meetingLinkReady = ({ contactName, hospitalName, scheduledAt, meetingLink }) => ({
  subject: '🔗 Your Meeting Link is Ready',
  html: shell({
    heading: 'Meeting Link Ready',
    intro: `Hi ${contactName || 'there'}, your secure meeting link is ready.`,
    bodyHtml: `
      ${detailRows([
        ['Hospital', hospitalName],
        ['When', fmtWhen(scheduledAt) || 'Scheduled']
      ])}
      ${meetingLink ? `
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${C.blue};">
          <a href="${meetingLink}" style="color: ${C.blue}; text-decoration: none; font-weight: 600; word-break: break-all;" target="_blank">${meetingLink}</a>
        </div>
        ${button(meetingLink, '🔗 Join Meeting')}
      ` : ''}
    `,
    footNote: 'This meeting link is unique to this session.',
    showQuote: true
  })
});

const feedbackRequest = ({ contactName, token }) => ({
  subject: '📝 Please Share Your Feedback',
  html: shell({
    heading: 'We\'d Love Your Feedback',
    intro: `Hi ${contactName || 'there'}, thank you for attending the demo session.`,
    bodyHtml: `
      <p style="margin: 0 0 14px 0;">We\'d appreciate a quick moment of your time to share your experience.</p>
      ${button(`${FRONTEND_REDIRECT_URL}/feedback/${token}`, '📝 Share Feedback')}
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Or use this link: <a href="${FRONTEND_REDIRECT_URL}/feedback/${token}" style="color:${C.blue};">${FRONTEND_REDIRECT_URL}/feedback/${token}</a></p>
    `,
    footNote: 'Your feedback helps us improve.',
    showQuote: true
  })
});

// Keep all other existing templates with `showQuote: true` added
// ... (registrationReceived, registrationApproved, registrationDenied, 
//      passwordResetOtp, appointmentConfirmation, etc.)

const registrationReceived = ({ contactName, hospitalName }) => ({
  subject: 'Registration received',
  html: shell({
    heading: 'Registration received',
    intro: `Hi ${contactName || 'there'}, we’ve received your registration.`,
    bodyHtml: detailRows([
      ['Hospital', hospitalName],
      ['Contact', contactName],
      ['Status', 'Pending approval']
    ]),
    footNote: 'Registration from Pet Hospital Portal',
    showQuote: true
  })
});

const registrationApproved = ({ contactName, hospitalName, loginEmail, tempPassword, origin }) => {
  const url = origin || FRONTEND_REDIRECT_URL;
  return {
    subject: 'Your account is ready',
    html: shell({
      heading: 'Account approved',
      intro: `Hi ${contactName || 'there'}, your hospital account has been approved.`,
      bodyHtml: `
        ${detailRows([
          ['Hospital', hospitalName],
          ['Login email', loginEmail],
          ['Password', tempPassword]
        ])}
        ${button(`${url}/login`, 'Log in')}
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Please change your password after logging in.</p>
      `,
      footNote: 'Account approval from Pet Hospital Portal',
      showQuote: true
    })
  };
};

const registrationDenied = ({ contactName, hospitalName }) => ({
  subject: 'Registration update',
  html: shell({
    heading: 'Registration update',
    intro: `Hi ${contactName || 'there'},`,
    bodyHtml: `
      <p style="margin: 0;">We couldn’t approve the registration for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> at this time. If you believe this is a mistake, please contact support.</p>
    `,
    footNote: 'Registration update from Pet Hospital Portal',
    showQuote: true
  })
});

const passwordResetOtp = ({ contactName, otp }) => ({
  subject: 'Password reset code',
  html: shell({
    heading: 'Password reset code',
    intro: `Hi ${contactName || 'there'}, use the code below to reset your password.`,
    bodyHtml: `
      <div style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:16px;padding:22px;text-align:center;margin:20px 0;">
        <div style="font-size:12px;color:#64748b;margin-bottom:10px;font-weight:600;letter-spacing:0.3px;">Your verification code</div>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${escapeHtml(otp)}</div>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b;">This code expires in 10 minutes.</p>
    `,
    footNote: 'Password reset from Pet Hospital Portal',
    showQuote: true
  })
});

// ─── Appointment templates ────────────────────────────────────

const appointmentConfirmation = ({
  patientName,
  patientPhone,
  hospitalName,
  date,
  time,
  petName,
  description,
  email,
  appointmentNumber,
  species,   
  sex,       
  breed      
}) => ({
  subject: `Your appointment request has been received (#${appointmentNumber})`,
  html: shell({
    heading: 'Appointment request received',
    intro: `Hi ${patientName || 'there'}, thanks for booking with ${hospitalName || 'us'}!`,
    bodyHtml: `
      <p style="margin:0 0 6px;color:#475569;font-size:15px;line-height:1.6;">
        We've received your appointment request. The hospital will review and confirm it shortly.
      </p>
      ${detailRows([
        ['Appointment #', appointmentNumber],
        ['Hospital', hospitalName],
        ['Patient', patientName],
        ['Phone', patientPhone],
        ['Email', email],
        ['Pet Name', petName],
         ['Species', species || 'Not specified'],   
        ['Sex', sex || 'Not specified'],            
        ['Breed', breed || 'Not specified'],        
        ['Date', date || 'To be confirmed'],
        ['Time', time || 'To be confirmed'],
        ['Status', 'Pending confirmation']
      ].filter(row => row[1]))}
      <p style="margin:16px 0 0 0;">The hospital will contact you if anything needs changing.</p>
    `,
    footNote: 'You booked an appointment via the Pet Hospital Portal.',
    showQuote: true
  })
});

const appointmentStatusUpdate = ({ patientName, hospitalName, date, time, status, message, appointmentNumber }) => ({
  subject: `Your appointment status has been updated (#${appointmentNumber})`,
  html: shell({
    heading: 'Appointment status update',
    intro: `Hi ${patientName || 'there'}, your appointment status has been changed.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">
        Your appointment at <strong>${escapeHtml(hospitalName || 'the hospital')}</strong> is now ${statusPill(status)}
      </p>
      ${detailRows([
        ['Appointment #', appointmentNumber],
        ['Hospital', hospitalName],
        ['Patient', patientName],
        ['Date', date || 'To be confirmed'],
        ['Time', time || 'To be confirmed'],
        ['New Status', status]
      ])}
      ${message ? `<p style="margin:10px 0 0;color:#475569;font-size:15px;">Note: ${message}</p>` : ''}
      <p style="margin:16px 0 0;color:#475569;font-size:15px;">If you have any questions, please contact the hospital directly.</p>
    `,
    footNote: 'Appointment status update from Pet Hospital Portal',
    showQuote: true
  })
});

const appointmentNewForAdmin = ({
  patientName,
  patientPhone,
  email,
  hospitalName,
  date,
  time,
  petName,
  description,
  source,
  appointmentNumber
}) => ({
  subject: `New appointment booking: ${hospitalName || 'Hospital'} (#${appointmentNumber})`,
  html: shell({
    heading: 'New appointment booked',
    intro: `${patientName || 'A patient'} booked an appointment${hospitalName ? ` at ${hospitalName}` : ''}.`,
    bodyHtml: `
      ${detailRows([
        ['Appointment #', appointmentNumber],
        ['Hospital', hospitalName],
        ['Patient', patientName],
        ['Phone', patientPhone],
        ['Email', email],
        ['Pet name', petName],
        ['Date', date || 'Not specified'],
        ['Time', time || 'Not specified'],
        ['Reason', description],
        ['Source', source === 'public' ? 'Public booking page' : 'Signed-in user'],
        ['Status', 'Pending']
      ])}
      ${button(`${FRONTEND_REDIRECT_URL}/superadmin/appointments`, 'Review appointment')}
    `,
    footNote: 'You are receiving this because you are an administrator on this system.',
    showQuote: true
  })
});

const appointmentRescheduled = ({ patientName, hospitalName, date, time, previousDate, previousTime }) => ({
  subject: 'Your appointment has been rescheduled',
  html: shell({
    heading: 'Appointment rescheduled',
    intro: `Hi ${patientName || 'there'}, your appointment has been moved to a new slot.`,
    bodyHtml: `
      ${detailRows([
        ['Hospital', hospitalName],
        ['Previous slot', [previousDate, previousTime].filter(Boolean).join(' at ')],
        ['New date', date || 'To be confirmed'],
        ['New time', time || 'To be confirmed'],
        ['Status', 'Pending confirmation']
      ])}
      <p style="margin:16px 0 0 0;">The hospital will confirm the new slot shortly.</p>
    `,
    footNote: 'You are receiving this because you booked an appointment with us.',
    showQuote: true
  })
});

const appointmentCancelled = ({ patientName, hospitalName, date, time, reason }) => ({
  subject: 'Your appointment has been cancelled',
  html: shell({
    heading: 'Appointment cancelled',
    intro: `Hi ${patientName || 'there'}, your appointment has been cancelled as requested.`,
    bodyHtml: `
      ${detailRows([
        ['Hospital', hospitalName],
        ['Date', date],
        ['Time', time],
        ['Reason', reason],
        ['Status', 'Cancelled']
      ])}
      <p style="margin:16px 0 0 0;">You can book again at any time from our appointment page.</p>
    `,
    footNote: 'You are receiving this because you booked an appointment with us.',
    showQuote: true
  })
});

// ─── Contact Templates ─────────────────────────────────────────

const contactReceived = ({ name, subject, message, phone, email }) => ({
  subject: 'We received your message',
  html: shell({
    heading: 'Thanks for getting in touch',
    intro: `Hi ${name || 'there'}, we have received your message and our team will get back to you shortly.`,
    bodyHtml: `
      <p style="margin:0 0 4px 0;">Here is a copy of what you sent. There is nothing else you need to do &mdash; we will reply to this email address.</p>
      ${detailRows([
        ['Name', name],
        ['Email', email],
        ['Phone', phone],
        ['Subject', subject],
        ['Message', message],
        ['Status', 'New, awaiting review']
      ])}
    `,
    footNote: 'You are receiving this because you submitted the contact form on our website.',
    showQuote: true
  })
});

const contactNewForAdmin = ({ name, email, phone, subject, message, submittedAt }) => ({
  subject: `New contact enquiry: ${subject || 'General Inquiry'}`,
  html: shell({
    heading: 'New contact enquiry',
    intro: `${name || 'Someone'} submitted the contact form.`,
    bodyHtml: `
      ${detailRows([
        ['Name', name],
        ['Email', email],
        ['Phone', phone],
        ['Subject', subject],
        ['Message', message],
        ['Received', fmtWhen(submittedAt) || 'Just now']
      ])}
      ${button(`${FRONTEND_REDIRECT_URL}/superadmin/contacts`, 'Open in dashboard')}
    `,
    footNote: 'You are receiving this because you are an administrator on this system.',
    showQuote: true
  })
});

const contactStatusUpdate = ({ name, subject, message, status, feedback }) => {
  const labels = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
  const statusLabel = labels[status] || status;
  return {
    subject: `Update on your enquiry: ${statusLabel}`,
    html: shell({
      heading: 'Update on your enquiry',
      intro: `Hi ${name || 'there'}, there is an update on the message you sent us.`,
      bodyHtml: `
        <p style="margin:0 0 14px 0;">Your enquiry is now marked as ${statusPill(statusLabel)}</p>
        ${feedback
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
               <tr>
                 <td style="padding:16px 18px; background-color:#f7f9fc; border-left:3px solid ${C.blue}; border-radius:4px;">
                   <div style="font-size:12px; font-weight:700; color:#5b6472; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:6px;">Response from our team</div>
                   <div style="font-size:15px; line-height:1.6; color:#2c3340;">${escapeHtml(feedback)}</div>
                 </td>
               </tr>
             </table>`
          : ''}
        ${detailRows([
          ['Subject', subject],
          ['Your message', message],
          ['Status', statusLabel]
        ])}
        <p style="margin:16px 0 0 0;">If you need anything else, reply to this email.</p>
      `,
      footNote: 'You are receiving this because you contacted us through our website.',
      showQuote: true
    })
  };
};

// ─── Subscription Templates ────────────────────────────────────

const subscriptionExpiryReminder = ({ name, daysLeft, expiryDate, renewalLink }) => ({
  subject: `Your subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
  html: shell({
    heading: 'Subscription expiring soon',
    intro: `Hi ${name || 'there'}, this is a friendly reminder that your subscription will end in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">Your plan will expire on <strong>${escapeHtml(expiryDate)}</strong>.</p>
      ${renewalLink ? button(renewalLink, 'Renew now') : ''}
      <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If you don't renew, you will lose access to premium features.</p>
    `,
    footNote: 'Subscription reminder from Pet Hospital Portal',
    showQuote: true
  })
});

const subscriptionExpired = ({ name, expiryDate, renewalLink }) => ({
  subject: 'Your subscription has expired',
  html: shell({
    heading: 'Subscription expired',
    intro: `Hi ${name || 'there'}, your subscription expired on ${escapeHtml(expiryDate)}.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">To continue using all features, please renew your plan.</p>
      ${renewalLink ? button(renewalLink, 'Renew now') : ''}
      <p style="margin:16px 0 0;font-size:14px;color:#64748b;">If you have any questions, contact support.</p>
    `,
    footNote: 'Subscription expiration notice from Pet Hospital Portal',
    showQuote: true
  })
});

const appointmentFeedbackInvitation = ({ patientName, hospitalName, appointmentNumber, date, time, feedbackLink }) => ({
  subject: `Share your feedback for appointment #${appointmentNumber}`,
  html: shell({
    heading: 'We\'d Love Your Feedback',
    intro: `Hi ${patientName || 'there'}, your appointment at ${hospitalName} is now complete.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">Please take a moment to share your experience. Your feedback helps us improve.</p>
      ${detailRows([
        ['Appointment #', appointmentNumber],
        ['Hospital', hospitalName],
        ['Date', date],
        ['Time', time]
      ])}
      ${button(feedbackLink, '📝 Give Feedback')}
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Or use this link: <a href="${feedbackLink}" style="color:${C.blue};">${feedbackLink}</a></p>
    `,
    footNote: 'Feedback invitation from Pet Hospital Portal',
    showQuote: true
  })
});

// ─── Single Export ──────────────────────────────────────────────
module.exports = {
  // Layout utilities
  shell,
  button,
  statusPill,
  detailRows,
  fmtWhen,

  // All template functions
  demoReceived,
  scheduleInvite,
  demoConfirmation,
  meetingLinkReady,
  feedbackRequest,
  registrationReceived,
  registrationApproved,
  registrationDenied,
  passwordResetOtp,
  appointmentConfirmation,
  appointmentStatusUpdate,
  appointmentNewForAdmin,
  appointmentRescheduled,
  appointmentCancelled,
  contactReceived,
  contactNewForAdmin,
  contactStatusUpdate,
  subscriptionExpiryReminder,
  subscriptionExpired,
  appointmentFeedbackInvitation
};