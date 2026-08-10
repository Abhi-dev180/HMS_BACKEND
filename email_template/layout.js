// Shared building blocks for all email templates: the branded shell, CTA button,
// detail table, and date formatter. Templates in ./index.js compose these.

// const BRAND = '#0f4c81';
// const BRAND_2 = '#1e88a8';

// const shell = ({ heading, intro, bodyHtml, footNote }) => `
//   <div style="margin:0;padding:32px 16px;background:linear-gradient(160deg,#eef4fb 0%,#e4edfb 100%);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
//     <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 16px 44px rgba(15,76,129,.14);">
//       <div style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_2} 100%);padding:36px 32px 30px;text-align:center;">
//         <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:18px;background:rgba(255,255,255,.15);font-size:32px;">🐾</div>
//         <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.4px;margin-top:14px;">Pet Hospital Portal</div>
//         <div style="color:#cfe3f5;font-size:13px;margin-top:5px;">Modern care management for veterinary teams</div>
//       </div>
//       <div style="height:4px;background:linear-gradient(90deg,#38bdf8,${BRAND},#38bdf8);"></div>
//       <div style="padding:34px 34px 8px;color:#1e293b;">
//         <h1 style="margin:0 0 10px;color:#0f172a;font-size:23px;font-weight:800;">${heading}</h1>
//         ${intro ? `<p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.7;">${intro}</p>` : ''}
//         ${bodyHtml}
//       </div>
//       <div style="padding:22px 34px 30px;">
//         <div style="border-top:1px solid #eef2f7;padding-top:18px;color:#94a3b8;font-size:12px;line-height:1.7;text-align:center;">
//           ${footNote || 'You are receiving this because you engaged with the Pet Hospital Portal.'}
//           <div style="margin-top:10px;font-size:16px;">🐶 🐱 🐾</div>
//           <div style="margin-top:6px;">© ${new Date().getFullYear()} Pet Hospital Portal · All rights reserved.</div>
//         </div>
//       </div>
//     </div>
//   </div>
// `;

// const button = (href, label) =>
//   `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;">
//      <tr><td style="border-radius:999px;background:linear-gradient(135deg,${BRAND} 0%,${BRAND_2} 100%);box-shadow:0 8px 20px rgba(15,76,129,.28);">
//        <a href="${href}" style="display:inline-block;padding:14px 34px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px;">${label} →</a>
//      </td></tr>
//    </table>`;

// const detailRows = (rows) => `
//   <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 18px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;">
//     ${rows
//       .filter((r) => r && r[1])
//       .map(
//         ([k, v]) => `<tr>
//           <td style="padding:11px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #eef2f7;width:38%;">${k}</td>
//           <td style="padding:11px 16px;color:#0f172a;font-size:14px;font-weight:600;border-bottom:1px solid #eef2f7;">${v}</td>
//         </tr>`
//       )
//       .join('')}
//   </table>`;

// const fmtWhen = (d) =>
//   d ? new Date(d).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : null;

// module.exports = { shell, button, detailRows, fmtWhen, BRAND, BRAND_2 };




// Shared building blocks for all email templates: the branded shell, CTA button,
// detail table, and date formatter. Templates in ./index.js compose these.

// const BRAND = '#0f4c81';
// const BRAND_2 = '#1e88a8';

// const escapeHtml = (s) =>
//   String(s ?? '')
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');

// const shell = ({ heading, intro, bodyHtml, footNote }) => `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <meta http-equiv="X-UA-Compatible" content="IE=edge">
//   <title>${escapeHtml(heading)}</title>
//   <style>
//     body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
//     table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
//     img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
//     table { border-collapse: collapse !important; }
//     body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; }

//     @media screen and (max-width: 600px) {
//       .email-container { width: 100% !important; padding: 10px !important; }
//       .content-padding { padding: 24px 20px !important; }
//       .header-padding { padding: 28px 20px 22px !important; }
//     }
//   </style>
// </head>
// <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

//   <div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
//     ${escapeHtml(intro || heading)}
//   </div>

//   <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;table-layout:fixed;">
//     <tr>
//       <td align="center" style="padding:32px 16px;">

//         <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 16px 44px rgba(15,76,129,.14);border:1px solid #e2e8f0;">
          
//           <tr>
//             <td align="center" class="header-padding" style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_2} 100%);padding:36px 32px 30px;text-align:center;">
//               <table role="presentation" border="0" cellpadding="0" cellspacing="0">
//                 <tr>
//                   <td align="center" style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:18px;background:rgba(255,255,255,.15);font-size:32px;text-align:center;">
//                     🐾
//                   </td>
//                 </tr>
//               </table>
//               <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.4px;margin-top:14px;">Pet Hospital Portal</div>
//               <div style="color:#cfe3f5;font-size:13px;margin-top:5px;">Modern care management for veterinary teams</div>
//             </td>
//           </tr>

//           <tr>
//             <td style="height:4px;background:linear-gradient(90deg,#38bdf8,${BRAND},#38bdf8);"></td>
//           </tr>

//           <tr>
//             <td class="content-padding" style="padding:34px 34px 8px;color:#1e293b;">
//               <h1 style="margin:0 0 10px;color:#0f172a;font-size:23px;font-weight:800;line-height:1.3;">${escapeHtml(heading)}</h1>
//               ${intro ? `<p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(intro)}</p>` : ''}
//               <div style="font-size:15px;color:#1e293b;line-height:1.6;">
//                 ${bodyHtml}
//               </div>
//             </td>
//           </tr>

//           <tr>
//             <td style="padding:22px 34px 30px;">
//               <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
//                 <tr>
//                   <td style="border-top:1px solid #eef2f7;padding-top:18px;color:#94a3b8;font-size:12px;line-height:1.7;text-align:center;">
//                     ${escapeHtml(footNote || 'You are receiving this because you engaged with the Pet Hospital Portal.')}
//                     <div style="margin-top:10px;font-size:16px;">🐶 🐱 🐾</div>
//                     <div style="margin-top:6px;">© ${new Date().getFullYear()} Pet Hospital Portal · All rights reserved.</div>
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
// </html>
// `;

// const button = (href, label) =>
//   `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;">
//      <tr>
//        <td align="left" style="border-radius:999px;" bgcolor="${BRAND}">
//          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 34px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px;background:linear-gradient(135deg,${BRAND} 0%,${BRAND_2} 100%);box-shadow:0 8px 20px rgba(15,76,129,.28);border:1px solid ${BRAND};">
//            ${escapeHtml(label)} &rarr;
//          </a>
//        </td>
//      </tr>
//    </table>`;

// const detailRows = (rows) => `
//   <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 18px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;overflow:hidden;">
//     ${rows
//       .filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '')
//       .map(
//         ([k, v], idx, arr) => `<tr>
//           <td style="padding:11px 16px;color:#64748b;font-size:13px;${idx !== arr.length - 1 ? 'border-bottom:1px solid #eef2f7;' : ''}width:38%;vertical-align:top;font-weight:500;">${escapeHtml(k)}</td>
//           <td style="padding:11px 16px;color:#0f172a;font-size:14px;font-weight:600;${idx !== arr.length - 1 ? 'border-bottom:1px solid #eef2f7;' : ''}vertical-align:top;">${escapeHtml(v)}</td>
//         </tr>`
//       )
//       .join('')}
//   </table>`;

// const fmtWhen = (d) =>
//   d ? new Date(d).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : null;

// module.exports = { shell, button, detailRows, fmtWhen, BRAND, BRAND_2 };


// Shared building blocks for all email templates:
// branded shell, CTA button, detail table, and date formatter.
// Templates in ./index.js compose these.

const BRAND = '#0f4c81';
const BRAND_2 = '#1e88a8';

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const shell = ({ heading, intro, bodyHtml, footNote }) => {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(heading)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f3f7fc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    .container {
      width: 100%;
      max-width: 640px;
    }

    .card {
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #e5eaf2;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10);
    }

    .header {
      background: #ffffff;
      padding: 30px 32px 25px;
      text-align: center;
      border-bottom: 2px solid #0f4c81;
    }

    .logo-image {
      max-height: 55px;
      height: auto;
      width: auto;
      display: block;
      margin: 0 auto;
    }

    .brand-subtitle {
      color: #64748b;
      font-size: 13px;
      margin-top: 10px;
      line-height: 1.6;
      font-weight: 500;
    }

    .top-bar {
      height: 4px;
      background: linear-gradient(90deg, #1e88a8, #0f4c81, #1e88a8);
    }

    .content {
      padding: 34px 34px 10px;
      color: #1e293b;
    }

    .title {
      margin: 0 0 10px;
      color: #0f172a;
      font-size: 24px;
      line-height: 1.3;
      font-weight: 800;
      letter-spacing: -0.2px;
    }

    .intro {
      margin: 0 0 18px;
      color: #475569;
      font-size: 15px;
      line-height: 1.7;
    }

    .body {
      font-size: 15px;
      color: #1e293b;
      line-height: 1.7;
    }

    .footer {
      padding: 22px 34px 30px;
    }

    .footer-inner {
      border-top: 1px solid #eef2f7;
      padding-top: 22px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.6;
      text-align: center;
    }

    .footer-address {
      margin-top: 10px;
      font-size: 12px;
      color: #94a3b8;
    }

    .footer-copy {
      margin-top: 6px;
    }

    .preheader {
      display: none !important;
      visibility: hidden;
      opacity: 0;
      overflow: hidden;
      mso-hide: all;
      height: 0;
      width: 0;
      max-height: 0;
      max-width: 0;
      font-size: 1px;
      line-height: 1px;
      color: #f3f7fc;
    }

    @media screen and (max-width: 600px) {
      .outer {
        padding: 16px !important;
      }

      .content,
      .footer,
      .header {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }

      .title {
        font-size: 21px !important;
      }

      .intro,
      .body {
        font-size: 14px !important;
      }

      .logo-image {
        max-height: 45px !important;
      }

      .detail-label,
      .detail-value {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .detail-label {
        border-bottom: none !important;
        padding-bottom: 6px !important;
      }

      .detail-value {
        padding-top: 0 !important;
      }

      .button {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(intro || heading)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f7fc; table-layout:fixed;">
    <tr>
      <td align="center" class="outer" style="padding:32px 16px;">
        <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td class="card">
              <div class="header">
                <img src="https://thumbs.dreamstime.com/b/dreamstime-template-198954292.jpg" alt="MEDPARK Logo" class="logo-image" />
                <div class="brand-subtitle">Delivering the global standard for precision healthcare.</div>
              </div>

              <div class="top-bar"></div>

              <div class="content">
                <h1 class="title">${escapeHtml(heading)}</h1>
                ${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}
                <div class="body">
                  ${bodyHtml}
                </div>
              </div>

              <div class="footer">
                <div class="footer-inner">
                  <div style="margin-bottom:12px;">${escapeHtml(footNote || 'You are receiving this transactional message because of your recent activity with MEDPARK.')}</div>
                  <div class="footer-address">123 Health Avenue, Medical District, Mohali, PB 160055</div>
                  <div class="footer-copy">© ${year} MEDPARK Hospital · All rights reserved.</div>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;">
    <tr>
      <td align="left" style="border-radius:999px;" bgcolor="${BRAND}">
        <a href="${href}" target="_blank"
          style="display:inline-block;padding:14px 34px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px;background:linear-gradient(135deg,${BRAND} 0%,${BRAND_2} 100%);box-shadow:0 8px 20px rgba(15,76,129,.22);border:1px solid ${BRAND};">
          ${escapeHtml(label)} &rarr;
        </a>
      </td>
    </tr>
  </table>
`;

const detailRows = (rows) => {
  const validRows = rows.filter(
    (r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== ''
  );

  if (!validRows.length) return '';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 18px;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;overflow:hidden;">
      ${validRows
        .map(
          ([k, v], idx, arr) => `
          <tr>
            <td class="detail-label" style="padding:11px 16px;color:#64748b;font-size:13px;font-weight:600;width:38%;vertical-align:top;${idx !== arr.length - 1 ? 'border-bottom:1px solid #eef2f7;' : ''}">${escapeHtml(k)}</td>
            <td class="detail-value" style="padding:11px 16px;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;${idx !== arr.length - 1 ? 'border-bottom:1px solid #eef2f7;' : ''}">${escapeHtml(v)}</td>
          </tr>`
        )
        .join('')}
    </table>
  `;
};

const fmtWhen = (d) =>
  d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

module.exports = { shell, button, detailRows, fmtWhen, BRAND, BRAND_2 };