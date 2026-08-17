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