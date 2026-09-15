
// email_template/index.js
const FRONTEND_REDIRECT_URL =
  process.env.FRONTEND_REDIRECT_URL ||
  process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
  'http://localhost:5173';

// ─── Logo URL ──────────────────────────────────────────────────
const LOGO_URL = process.env.LOGO_URL || 'https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQMecZbRGOWSVBhV6P6UB-isBIqE4YVzkJRsIkXk5A8gDryrVw5';
const { broadcast } = require('../services/websocketService'); // at the top

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

// const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink, meetingDetails }) => {
//   const date = scheduledAt ? new Date(scheduledAt) : null;
//   const formattedDate = date ? date.toLocaleDateString('en-US', {
//     weekday: 'long',
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric'
//   }) : 'To be confirmed';
//   const formattedTime = date ? date.toLocaleTimeString('en-US', {
//     hour: '2-digit',
//     minute: '2-digit',
//     timeZone: 'Asia/Kolkata'
//   }) : '';

//   return {
//     subject: '✅ Your Demo is Confirmed!',
//     html: shell({
//       heading: 'Demo Confirmed',
//       intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
//       bodyHtml: `
//         <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is confirmed.</p>
//         ${detailRows([
//           ['Hospital', hospitalName],
//           ['📅 Date', formattedDate],
//           ['⏰ Time', formattedTime + ' (IST)'],
//           ['⏱️ Duration', '30 minutes'],
//           ['👤 Contact', contactName]
//         ])}
//         ${meetingLink ? `
//           <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${C.blue};">
//             <p style="margin: 0 0 5px 0;"><strong>🔗 Meeting Link:</strong></p>
//             <p style="margin: 5px 0; word-break: break-all;">
//               <a href="${meetingLink}" style="color: ${C.blue}; text-decoration: none; font-weight: 600;" target="_blank">${meetingLink}</a>
//             </p>
//           </div>
//           ${button(meetingLink, '🔗 Join Meeting')}
//           <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">📌 Please join 5 minutes before the scheduled time.</p>
//         ` : ''}
//       `,
//       footNote: 'Please save this email for your reference.',
//       showQuote: true
//     })
//   };
// };


const getJoinText = (link) => {
  if (!link) return '🔗 Join Meeting';
  if (link.includes('zoom.us')) return '🔗 Join Zoom Meeting';
  if (link.includes('meet.google.com')) return '🔗 Join Google Meet';
  return '🔗 Join Meeting';
};

// const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink, invoicePdfUrl }) => {
//   const date = scheduledAt ? new Date(scheduledAt) : null;
//   const formattedDate = date ? date.toLocaleDateString('en-US', {
//     weekday: 'long',
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric'
//   }) : 'To be confirmed';
//   const formattedTime = date ? date.toLocaleTimeString('en-US', {
//     hour: '2-digit',
//     minute: '2-digit',
//     timeZone: 'Asia/Kolkata'
//   }) : '';

//   return {
//     subject: '✅ Your Demo is Confirmed!',
//     html: shell({
//       heading: 'Demo Confirmed',
//       intro: `Hi ${contactName || 'there'}, your demo has been scheduled successfully.`,
//       bodyHtml: `
//         <p style="margin: 0 0 14px 0;">Your demo for <strong>${escapeHtml(hospitalName || 'your hospital')}</strong> is confirmed.</p>
//         ${detailRows([
//           ['Hospital', hospitalName],
//           ['📅 Date', formattedDate],
//           ['⏰ Time', formattedTime + ' (IST)'],
//           ['⏱️ Duration', '30 minutes'],
//           ['👤 Contact', contactName]
//         ])}
//         ${meetingLink ? `
//           <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${C.blue};">
//             <p style="margin: 0 0 5px 0;"><strong>🔗 Meeting Link:</strong></p>
//             <p style="margin: 5px 0; word-break: break-all;">
//               <a href="${meetingLink}" style="color: ${C.blue}; text-decoration: none; font-weight: 600;" target="_blank">${meetingLink}</a>
//             </p>
//           </div>
//           ${button(meetingLink, getJoinText(meetingLink))}
//           <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">📌 Please join 5 minutes before the scheduled time.</p>
//         ` : ''}
//       `,
//       showQuote: true
//     })
//   };
// };



const demoConfirmation = ({ contactName, hospitalName, scheduledAt, meetingLink }) => {
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
          ${button(meetingLink, getJoinText(meetingLink))}
          <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">📌 Please join 5 minutes before the scheduled time.</p>
        ` : ''}
      `,
      showQuote: true
    })
  };
};

const invoicePaidEmail = ({ contactName, hospitalName, invoicePdfUrl, phone, email, amount, currency, invoiceId, planName, startDate, endDate, paymentMethod }) => {
  const displayAmount = amount ? `${(amount / 100).toFixed(2)} ${String(currency || 'USD').toUpperCase()}` : '';

  return {
    subject: '🧾 Payment Receipt & Invoice - MEDPARK Hospital',
    html: shell({
      heading: 'Payment Receipt',
      intro: `Hi ${contactName || 'there'}, your payment has been processed successfully.`,
      bodyHtml: `
        <p style="margin: 0 0 14px 0;">Thank you for your payment. Please find the details of your payment below.</p>
        
        <h3 style="color: #1e3a8a; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">👤 User Information</h3>
        ${detailRows([
          ['Hospital Name', hospitalName],
          ['Contact Person', contactName],
          ['Email Address', email || ''],
          ['Phone Number', phone || 'N/A']
        ])}

        <h3 style="color: #1e3a8a; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">💳 Payment Information</h3>
        ${detailRows([
          ['Plan', planName || 'Subscription'],
          ['Start Date', startDate || 'N/A'],
          ['End Date', endDate || 'N/A'],
          ['Amount Paid', displayAmount],
          ['Payment Method', paymentMethod || 'Stripe'],
          ['Invoice Number', invoiceId || 'N/A']
        ])}

        ${invoicePdfUrl ? `
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="margin: 0 0 8px 0; font-weight: 600;">🧾 PDF Invoice</p>
            ${button(invoicePdfUrl, '📄 Download PDF Invoice')}
          </div>
        ` : ''}
      `,
      showQuote: true
    })
  };
};

const paymentReceivedAdmin = ({ hospitalName, contactName, email, phone, planName, amount, currency, startDate, endDate, paymentMethod, invoiceId }) => {
  const displayAmount = amount ? `${(amount / 100).toFixed(2)} ${String(currency || 'USD').toUpperCase()}` : '';

  return {
    subject: `💰 New Payment Received: ${hospitalName || 'Hospital'}`,
    html: shell({
      heading: 'New Payment Received',
      intro: `A payment was successfully completed by ${contactName || 'a customer'}.`,
      bodyHtml: `
        <h3 style="color: #1e3a8a; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">👤 Customer Info</h3>
        ${detailRows([
          ['Hospital Name', hospitalName],
          ['Contact', contactName],
          ['Email', email],
          ['Phone', phone || 'N/A']
        ])}

        <h3 style="color: #1e3a8a; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">💳 Payment Details</h3>
        ${detailRows([
          ['Plan', planName || 'Subscription'],
          ['Amount', displayAmount],
          ['Payment Method', paymentMethod || 'Stripe'],
          ['Transaction ID', invoiceId || 'N/A'],
          ['Start Date', startDate || 'N/A'],
          ['End Date', endDate || 'N/A']
        ])}
        
        ${button(`${FRONTEND_REDIRECT_URL}/superadmin`, 'Open Superadmin Dashboard')}
      `,
      footNote: 'You are receiving this because you are an administrator on this system.',
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
        ${button(meetingLink, getJoinText(meetingLink))}
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

// ─── Updated Appointment templates with Zoom/meetingLink ────

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
  breed,
  appointmentType,
  serviceName,
  serviceCategory,
  sampleType,
  fastingRequired,
  fastingDetails,
  turnaroundTime,
  paymentStatus,
  paymentAmount,
  paymentMethod,
  meetingLink = null
}) => {
  const isLab = appointmentType === 'Lab Test' || Boolean(serviceName);
  const isPaid = String(paymentStatus || '').toLowerCase() === 'paid';
  const feeStr = paymentAmount ? `₹${Number(paymentAmount).toFixed(2)}` : null;

  return {
    subject: isLab 
      ? `Your Lab Test Appointment Request has been received (#${appointmentNumber})`
      : `Your appointment request has been received (#${appointmentNumber})`,
    html: shell({
      heading: isLab ? 'Lab Test Appointment Received' : 'Appointment Request Received',
      intro: `Hi ${patientName || 'there'}, thanks for booking with ${hospitalName || 'us'}!`,
      bodyHtml: `
        <p style="margin:0 0 10px;color:#475569;font-size:15px;line-height:1.6;">
          ${isLab 
            ? "We've received your diagnostic lab test booking. Please find your appointment specifications below."
            : "We've received your appointment request. The hospital will review and confirm it shortly."}
        </p>

        ${isPaid ? `
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 13px; color: #15803d; font-weight: 700;">
              ✔ Payment Completed: ${feeStr || ''} (${paymentMethod || 'Online Payment'})
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #166534;">
              An official computerized PDF invoice is attached to this email.
            </p>
          </div>
        ` : ''}

        ${detailRows([
          ['Appointment #', appointmentNumber],
          ['Hospital', hospitalName],
          [isLab ? 'Diagnostic Test' : 'Reason / Service', isLab ? (serviceName || description || 'Lab Test') : (description || 'Veterinary Consultation')],
          isLab && serviceCategory ? ['Category', serviceCategory] : null,
          isLab && sampleType ? ['Sample Type', sampleType] : null,
          isLab && turnaroundTime ? ['Turnaround Time', turnaroundTime] : null,
          isLab && fastingRequired ? ['Fasting Notice', `Required (${fastingDetails || '8-12 hrs fasting'})`] : null,
          ['Patient', patientName],
          ['Phone', patientPhone],
          ['Email', email],
          ['Pet Name', petName || 'Not specified'],
          ['Species', species || 'Not specified'],   
          ['Sex', sex || 'Not specified'],            
          ['Breed', breed || 'Not specified'],        
          ['Date', date || 'To be confirmed'],
          ['Time', time || 'To be confirmed'],
          ['Status', isPaid ? 'Confirmed & Paid' : 'Pending confirmation']
        ].filter(Boolean))}
        
        ${meetingLink ? `
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${C.blue};">
            <p style="margin: 0 0 5px 0;"><strong>🔗 Meeting Link:</strong></p>
            <p style="margin: 5px 0; word-break: break-all;">
              <a href="${meetingLink}" style="color: ${C.blue}; text-decoration: none; font-weight: 600;" target="_blank">${meetingLink}</a>
            </p>
          </div>
          ${button(meetingLink, '🔗 Join Meeting')}
        ` : ''}
        
        <p style="margin:16px 0 0 0;">The hospital will contact you if anything needs changing.</p>
      `,
      footNote: 'You booked an appointment via the Pet Hospital Portal.',
      showQuote: true
    })
  };
};

const appointmentInvoice = ({ appointment }) => {
  const isLab = appointment.appointmentType === 'Lab Test' || Boolean(appointment.serviceName);
  const amount = Number(appointment.paymentAmount || appointment.servicePrice || 500);
  const feeStr = `₹${amount.toFixed(2)}`;
  const title = isLab ? `Lab Test: ${appointment.serviceName || 'Diagnostic Investigation'}` : `Appointment #${appointment.appointment_number}`;

  return {
    subject: `🧾 Payment Invoice & Confirmation: ${title} (#${appointment.appointment_number}) - MEDPARK`,
    html: shell({
      heading: isLab ? 'Lab Test Payment Confirmed' : 'Appointment Payment Confirmed',
      intro: `Hi ${appointment.patientName || 'there'}, your payment of <strong>${feeStr}</strong> has been successfully processed.`,
      bodyHtml: `
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #15803d; font-weight: 700;">
            ✔ Payment Verified via ${appointment.paymentMethod || 'Stripe Gateway'}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534;">
            Transaction ID: <code>${appointment.paymentId || 'N/A'}</code> &nbsp;•&nbsp; Amount Paid: <strong>${feeStr}</strong>
          </p>
        </div>

        <h3 style="color: #1e3a8a; margin-top: 18px; margin-bottom: 8px; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          ${isLab ? '🧪 Diagnostic Test & Specimen Details' : '🩺 Consultation Booking Details'}
        </h3>
        ${detailRows([
          ['Order / Appt #', appointment.appointment_number ? `#${appointment.appointment_number}` : 'N/A'],
          [isLab ? 'Diagnostic Test' : 'Doctor / Reason', isLab ? (appointment.serviceName || appointment.reason || 'Diagnostic Lab Test') : (appointment.doctorName ? `Dr. ${appointment.doctorName}` : (appointment.reason || 'Consultation'))],
          isLab && appointment.serviceCategory ? ['Category', appointment.serviceCategory] : null,
          isLab && appointment.sampleType ? ['Sample Required', appointment.sampleType] : null,
          isLab && appointment.turnaroundTime ? ['Turnaround Time', appointment.turnaroundTime] : null,
          isLab && appointment.fastingRequired ? ['Fasting', `Required (${appointment.fastingDetails || '8-12 hrs fasting'})`] : null,
          ['Hospital / Clinic', appointment.hospital || 'MEDPARK Specialist Center'],
          ['Scheduled Slot', `${appointment.date} at ${appointment.time}`],
          ['Pet Name', appointment.petName || 'Not specified'],
          ['Species / Breed', [appointment.species, appointment.breed, appointment.sex].filter(Boolean).join(' • ') || 'Pet Animal']
        ].filter(Boolean))}

        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-top: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #1e40af;">
            📎 Official PDF Invoice Attached
          </p>
          <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
            Your computerized diagnostic tax invoice and receipt (<strong>invoice_${appointment.appointment_number || 'receipt'}.pdf</strong>) has been generated and attached directly to this email for your records.
          </p>
        </div>

        ${button(`${FRONTEND_REDIRECT_URL}/dashboard/my-appointments`, 'View My Appointments in Portal')}

        <p style="margin: 18px 0 0 0; font-size: 12px; color: #64748b;">
          Please arrive 10-15 minutes prior to your scheduled time. Need to reschedule? You can do so directly from your user dashboard.
        </p>
      `,
      footNote: 'You received this receipt because you completed a payment on the MEDPARK Pet Hospital Portal.',
      showQuote: true
    })
  };
};

const appointmentPaymentFailed = ({ appointment, reason }) => {
  const isLab = appointment.appointmentType === 'Lab Test' || Boolean(appointment.serviceName);
  const amount = Number(appointment.paymentAmount || appointment.servicePrice || 500);
  const feeStr = `₹${amount.toFixed(2)}`;
  const title = isLab ? `Lab Test: ${appointment.serviceName || 'Diagnostic Investigation'}` : `Appointment #${appointment.appointment_number}`;

  return {
    subject: `⚠️ Payment Incomplete / Failed: ${title} (#${appointment.appointment_number}) - MEDPARK`,
    html: shell({
      heading: 'Payment Incomplete / Failed',
      intro: `Hi ${appointment.patientName || 'there'}, your payment of <strong>${feeStr}</strong> could not be processed.`,
      bodyHtml: `
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #b91c1c; font-weight: 700;">
            ✖ Payment Failed or Cancelled
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;">
            Reason: ${reason || 'Card was declined or checkout session expired/cancelled.'}
          </p>
        </div>

        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Your attempt to book <strong>${title}</strong> was not completed. No funds were debited from your card, or any hold will be automatically released by your bank.
        </p>

        <h3 style="color: #1e3a8a; margin-top: 18px; margin-bottom: 8px; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          Attempted Booking Details
        </h3>
        ${detailRows([
          ['Appointment #', appointment.appointment_number ? `#${appointment.appointment_number}` : 'N/A'],
          [isLab ? 'Diagnostic Test' : 'Doctor / Reason', isLab ? (appointment.serviceName || 'Diagnostic Lab Test') : (appointment.doctorName ? `Dr. ${appointment.doctorName}` : 'Consultation')],
          ['Hospital / Clinic', appointment.hospital || 'MEDPARK Center'],
          ['Slot Requested', `${appointment.date} at ${appointment.time}`],
          ['Pet Name', appointment.petName || 'Not specified'],
          ['Amount Due', feeStr]
        ].filter(Boolean))}

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e293b;">
            💡 What can you do next?
          </p>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.6;">
            <li>Try another card or retry payment with Stripe.</li>
            <li>Use our Instant <strong>Free UPI QR Code</strong> payment option.</li>
            <li>Pay via Net Banking or Wallets through Razorpay.</li>
            <li>Contact our hospital helpline at <strong>+91 9814538354</strong> for assistance.</li>
          </ul>
        </div>

        ${button(
          isLab ? `${FRONTEND_REDIRECT_URL}/dashboard/services` : `${FRONTEND_REDIRECT_URL}/dashboard/book-appointment`,
          'Retry Booking & Payment'
        )}
      `,
      footNote: 'This notification was generated because a payment transaction was unsuccessful.',
      showQuote: true
    })
  };
};

const appointmentStatusUpdate = ({ patientName, hospitalName, date, time, status, message, appointmentNumber, meetingLink = null }) => ({
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
      
      ${meetingLink ? `
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${C.blue};">
          <p style="margin: 0 0 5px 0;"><strong>🔗 Meeting Link:</strong></p>
          <p style="margin: 5px 0; word-break: break-all;">
            <a href="${meetingLink}" style="color: ${C.blue}; text-decoration: none; font-weight: 600;" target="_blank">${meetingLink}</a>
          </p>
        </div>
        ${button(meetingLink, '🔗 Join Meeting')}
      ` : ''}
      
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
  appointmentNumber,
  meetingLink = null
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
      
      ${meetingLink ? `
        <div style="background: #dbeafe; padding: 10px; border-radius: 6px; margin: 10px 0; border-left: 4px solid ${C.blue};">
          <p style="margin: 0 0 3px 0;"><strong>🔗 Meeting Link:</strong></p>
          <a href="${meetingLink}" style="color: ${C.blue}; word-break: break-all;" target="_blank">${meetingLink}</a>
        </div>
      ` : ''}
      
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

const appointmentCancelled = ({
  patientName,
  hospitalName,
  date,
  time,
  reason,
  appointmentNumber,
  appointmentType,
  serviceName,
  serviceCategory,
  sampleType,
  doctorName,
  petName,
  species,
  breed,
  paymentStatus,
  paymentAmount,
  paymentMethod,
  cancellationFee = 0,
  refundAmount = 0,
  refundId = null,
  refundStatus = 'Refunded'
}) => {
  const isLab = appointmentType === 'Lab Test' || Boolean(serviceName);
  const isPaid = String(paymentStatus || '').toLowerCase() === 'paid' || Number(refundAmount) > 0;
  const originalPaidNum = Number(paymentAmount || 0);
  const cancelFeeNum = Number(cancellationFee || 0);
  const netRefundNum = Number(refundAmount || 0);
  const serviceTitle = isLab
    ? (serviceName || 'Diagnostic Lab Test')
    : (doctorName ? `Consultation with Dr. ${doctorName}` : 'Veterinary Consultation');

  return {
    subject: `❌ Cancellation & Refund Confirmation: ${isLab ? 'Lab Test' : 'Appointment'} #${appointmentNumber || 'N/A'} - ${hospitalName || 'MEDPARK'}`,
    html: shell({
      heading: isLab ? 'Lab Test Appointment Cancelled' : 'Appointment Cancelled',
      intro: `Hi ${patientName || 'there'}, your scheduled ${isLab ? 'diagnostic lab test' : 'appointment'} has been cancelled as requested.`,
      bodyHtml: `
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 700;">
            🚫 Booking Cancelled Successfully
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #7f1d1d;">
            ${reason ? `Reason: <em>${escapeHtml(reason)}</em>` : 'This appointment was cancelled and the slot has been released.'}
          </p>
        </div>

        <h3 style="color: #1e3a8a; margin-top: 18px; margin-bottom: 8px; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          📋 Cancelled Appointment Specifications
        </h3>
        ${detailRows([
          ['Appointment / Order #', appointmentNumber ? `#${appointmentNumber}` : 'N/A'],
          [isLab ? 'Diagnostic Service' : 'Service Type', serviceTitle],
          isLab && serviceCategory ? ['Category', serviceCategory] : null,
          isLab && sampleType ? ['Sample Type', sampleType] : null,
          ['Hospital / Facility', hospitalName || 'MEDPARK Hospital'],
          ['Scheduled Slot', `${date || 'N/A'} at ${time || 'N/A'}`],
          petName ? ['Pet Details', `${petName} ${species ? `(${species}${breed ? ` - ${breed}` : ''})` : ''}`] : null,
          ['Status', 'Cancelled']
        ].filter(Boolean))}

        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; margin: 18px 0;">
          <p style="margin: 0; font-size: 13px; color: #334155; font-weight: 600;">
            📄 <strong>Official Cancellation Invoice Attached:</strong> Your PDF Cancellation Invoice & Credit Memo (<code>cancellation_invoice_${appointmentNumber || 'receipt'}.pdf</code>) is attached to this email.
          </p>
        </div>

        ${isPaid && netRefundNum > 0 ? `
          <h3 style="color: #1e3a8a; margin-top: 24px; margin-bottom: 8px; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            💳 Refund & Financial Breakdown
          </h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 16px 0; border:1px solid #e2e8f0; border-radius:10px; background-color:#f8fafc; overflow:hidden;">
            <tr>
              <td style="padding:10px 16px; font-size:13px; color:#64748b; font-weight:600; border-bottom:1px solid #edf2f7;">Original Amount Paid</td>
              <td style="padding:10px 16px; font-size:13px; color:#1e293b; font-weight:700; text-align:right; border-bottom:1px solid #edf2f7;">₹${originalPaidNum.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px; font-size:13px; color:#b91c1c; font-weight:600; border-bottom:1px solid #edf2f7;">Cancellation Charge (Deducted)</td>
              <td style="padding:10px 16px; font-size:13px; color:#b91c1c; font-weight:700; text-align:right; border-bottom:1px solid #edf2f7;">-₹${cancelFeeNum.toFixed(2)}</td>
            </tr>
            <tr style="background-color:#f0fdf4;">
              <td style="padding:12px 16px; font-size:14px; color:#15803d; font-weight:800;">Net Refund Credited</td>
              <td style="padding:12px 16px; font-size:16px; color:#15803d; font-weight:900; text-align:right;">₹${netRefundNum.toFixed(2)}</td>
            </tr>
          </table>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px;">
            <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 700;">
              ✔ Refund Status: ${escapeHtml(refundStatus)}
            </p>
            ${refundId ? `
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #166534;">
                Refund Reference ID: <code style="background:#dcfce7; padding:2px 6px; border-radius:4px; font-family:monospace;">${escapeHtml(refundId)}</code>
              </p>
            ` : ''}
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #15803d; line-height: 1.5;">
              The net refund of <strong>₹${netRefundNum.toFixed(2)}</strong> has been initiated via <strong>${paymentMethod || 'Original Payment Method'}</strong> and will reflect in your bank/card account within <strong>5–7 business days</strong>.
            </p>
          </div>
        ` : `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-top: 16px;">
            <p style="margin: 0; font-size: 13px; color: #475569;">
              No payment was charged or this booking was registered without pre-payment. No refund transaction is required.
            </p>
          </div>
        `}

        <div style="margin-top: 24px;">
          ${button(
            isLab ? `${FRONTEND_REDIRECT_URL}/dashboard/services` : `${FRONTEND_REDIRECT_URL}/dashboard/book-appointment`,
            isLab ? '🧪 Book Another Diagnostic Test' : '📅 Book a New Consultation'
          )}
        </div>

        <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          Have questions regarding your refund or cancellation? Contact our medical billing support team directly or reply to this email.
        </p>
      `,
      footNote: 'You received this notification because your booking on MEDPARK was cancelled.',
      showQuote: true
    })
  };
};

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
      showQuote: true
    })
  };
};

// ─── OTP Verification ─────────────────────────────────────────
const otpVerification = ({ name, otp }) => ({
  subject: 'Your OTP for email verification',
  html: shell({
    heading: 'Email Verification',
    intro: `Hi ${name || 'User'},`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">We received a request to change your email address. Use the OTP below to verify your new email.</p>
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:#f0f4ff;padding:16px 32px;border-radius:12px;font-size:38px;font-weight:800;letter-spacing:6px;color:#1d4ed8;border:2px dashed #bfdbfe;">
          ${otp}
        </div>
      </div>
      <p style="margin:0;font-size:14px;color:#64748b;">This OTP is valid for <strong>10 minutes</strong>.</p>
      <p style="margin:12px 0 0 0;font-size:13px;color:#94a3b8;">If you didn’t request this, please ignore this email.</p>
    `,
    footNote: 'Security alert: Do not share this OTP with anyone.',
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
  appointmentFeedbackInvitation,
  profileUpdated,
  otpVerification, 
  invoicePaidEmail,
  paymentReceivedAdmin,
  appointmentInvoice,
  appointmentPaymentFailed
};