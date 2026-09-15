// const PDFDocument = require('pdfkit');
// const fs = require('fs');

// /**
//  * Generates a PDF invoice as a buffer.
//  * @param {Object} data
//  * @param {string} data.hospitalName
//  * @param {string} data.email
//  * @param {string} data.planName
//  * @param {number} data.amount
//  * @param {string} data.paymentMethod (e.g., 'PayPal', 'Razorpay UPI')
//  * @param {string} data.transactionId
//  * @param {string} data.date
//  * @param {string} data.startDate
//  * @param {string} data.endDate
//  * @param {string} data.phone
//  * @param {string} data.contactName
//  * @returns {Promise<Buffer>}
//  */
// const generateInvoice = (data) => {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({ margin: 50 });
//       const buffers = [];
//       doc.on('data', buffers.push.bind(buffers));
//       doc.on('end', () => {
//         const pdfData = Buffer.concat(buffers);
//         resolve(pdfData);
//       });

//       // Header
//       doc.fillColor('#1e40af')
//          .fontSize(28)
//          .text('INVOICE', { align: 'right' });

//       doc.fillColor('#000000')
//          .fontSize(10)
//          .text('Pet Hospital Portal', 50, 60)
//          .text('123 Medical Drive', 50, 75)
//          .text('Health City, HC 12345', 50, 90)
//          .text('support@hospital.com', 50, 105);

//       // Customer details
//       doc.moveDown(3);
//       doc.fontSize(12).text(`Billed To:`, 50, 150);
//       doc.fontSize(14).text(data.hospitalName || 'Hospital', 50, 165);
//       doc.fontSize(10).text(`Contact: ${data.contactName || 'N/A'}`, 50, 185);
//       doc.fontSize(10).text(`Email: ${data.email || 'N/A'}`, 50, 200);
//       doc.fontSize(10).text(`Phone: ${data.phone || 'N/A'}`, 50, 215);

//       // Invoice Details
//       doc.fontSize(10)
//          .text(`Invoice Date: ${data.date || new Date().toLocaleDateString()}`, 350, 150)
//          .text(`Transaction ID: ${data.transactionId || 'N/A'}`, 350, 165)
//          .text(`Payment Method: ${data.paymentMethod || 'Stripe'}`, 350, 180)
//          .text(`Start Date: ${data.startDate || 'N/A'}`, 350, 195)
//          .text(`End Date: ${data.endDate || 'N/A'}`, 350, 210);

//       // Table Header
//       doc.moveDown(4);
//       doc.fontSize(12).font('Helvetica-Bold')
//          .text('Description', 50, 280)
//          .text('Amount', 450, 280, { align: 'right' });
//       doc.moveTo(50, 295).lineTo(550, 295).stroke();

//       // Table Row
//       doc.font('Helvetica').fontSize(12)
//          .text(`Plan: ${data.planName || 'Subscription'}`, 50, 310)
//          .text(`$${((data.amount || 0) / 100).toFixed(2)}`, 450, 310, { align: 'right' });
//       doc.moveTo(50, 330).lineTo(550, 330).stroke();

//       // Total
//       doc.font('Helvetica-Bold').fontSize(14)
//          .text('Total Paid:', 350, 350)
//          .text(`$${((data.amount || 0) / 100).toFixed(2)}`, 450, 350, { align: 'right' });

//       // Footer
//       doc.moveDown(8);
//       doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
//          .text('Thank you for your business. If you have any questions, please contact support.', 50, 600, { align: 'center' });

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// module.exports = { generateInvoice };



const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Generates a beautifully styled PDF invoice as a buffer.
 * @param {Object} data - same fields as before
 * @returns {Promise<Buffer>}
 */
const generateInvoice = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // ---------- COLORS ----------
      const primaryColor = '#1e3a8a';    // deep blue
      const accentColor = '#3b82f6';     // bright blue
      const lightGray = '#f3f4f6';
      const darkGray = '#4b5563';
      const borderColor = '#d1d5db';

      // ---------- HEADER with background banner ----------
      doc.rect(0, 0, doc.page.width, 100)
         .fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('INVOICE', 40, 25, { align: 'left' });

      // Company info inside the banner (right side)
      doc.fillColor('#e0e7ff')
         .fontSize(10)
         .font('Helvetica')
         .text('Pet Hospital Portal', 350, 30, { align: 'right' })
         .text('123 Medical Drive, Health City, HC 12345', 350, 45, { align: 'right' })
         .text('support@hospital.com | +1 234 567 890', 350, 60, { align: 'right' });

      // ---------- Billed To (Box) ----------
      const startY = 130;
      doc.rect(40, startY, 250, 110)
         .stroke(borderColor)
         .fill(lightGray);

      doc.fillColor(primaryColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('BILLED TO', 55, startY + 10);

      doc.fillColor('#1f2937')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(data.hospitalName || 'Hospital', 55, startY + 32);

      doc.font('Helvetica')
         .fontSize(10)
         .text(`Contact: ${data.contactName || 'N/A'}`, 55, startY + 56)
         .text(`Email: ${data.email || 'N/A'}`, 55, startY + 72)
         .text(`Phone: ${data.phone || 'N/A'}`, 55, startY + 88);

      // ---------- Invoice Details (Right side, no box but clean) ----------
      const detailX = 320;
      doc.fillColor(darkGray)
         .fontSize(9)
         .font('Helvetica')
         .text('Invoice Date', detailX, startY + 10, { width: 100, align: 'right' })
         .text('Transaction ID', detailX, startY + 32, { width: 100, align: 'right' })
         .text('Payment Method', detailX, startY + 54, { width: 100, align: 'right' })
         .text('Start Date', detailX, startY + 76, { width: 100, align: 'right' })
         .text('End Date', detailX, startY + 98, { width: 100, align: 'right' });

      doc.fillColor('#1f2937')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(data.date || new Date().toLocaleDateString(), detailX + 110, startY + 10, { width: 120 })
         .text(data.transactionId || 'N/A', detailX + 110, startY + 32, { width: 120 })
         .text(data.paymentMethod || 'Stripe', detailX + 110, startY + 54, { width: 120 })
         .text(data.startDate || 'N/A', detailX + 110, startY + 76, { width: 120 })
         .text(data.endDate || 'N/A', detailX + 110, startY + 98, { width: 120 });

      // ---------- Table Header ----------
      const tableY = startY + 160;
      doc.rect(40, tableY, 520, 30)
         .fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('Description', 55, tableY + 8, { width: 300 })
         .text('Amount', 480, tableY + 8, { align: 'right', width: 80 });

      // ---------- Table Row (could add multiple rows; here one) ----------
      const rowY = tableY + 30;
      doc.rect(40, rowY, 520, 35)
         .stroke(borderColor)
         .fill('#ffffff');

      doc.fillColor('#1f2937')
         .fontSize(11)
         .font('Helvetica')
         .text(`Plan: ${data.planName || 'Subscription'}`, 55, rowY + 8, { width: 300 })
         .text(`$${((data.amount || 0) / 100).toFixed(2)}`, 480, rowY + 8, { align: 'right', width: 80 });

      // ---------- Total Box ----------
      const totalY = rowY + 55;
      doc.rect(380, totalY, 180, 50)
         .fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('TOTAL PAID', 395, totalY + 8)
         .fontSize(18)
         .text(`$${((data.amount || 0) / 100).toFixed(2)}`, 395, totalY + 24, { align: 'right', width: 150 });

      // ---------- Footer ----------
      doc.fillColor('#9ca3af')
         .fontSize(9)
         .font('Helvetica')
         .text(
           'Thank you for your business. If you have any questions, please contact support.',
           40,
           doc.page.height - 50,
           { align: 'center', width: 520 }
         );

      // Small horizontal line above footer
      doc.strokeColor('#e5e7eb')
         .lineWidth(1)
         .moveTo(40, doc.page.height - 60)
         .lineTo(560, doc.page.height - 60)
         .stroke();

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generates a customized medical/diagnostic invoice & receipt as a PDF buffer.
 * Supports both Pet Diagnostic Lab Tests and Doctor Consultations.
 * @param {Object} data - Appointment data
 * @returns {Promise<Buffer>}
 */
const generateAppointmentInvoice = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const isLab = data.appointmentType === 'Lab Test' || Boolean(data.serviceName);
      const isPaid = String(data.paymentStatus || '').toLowerCase() === 'paid';
      const isFailed = String(data.paymentStatus || '').toLowerCase() === 'failed';

      // Colors
      const primaryColor = isLab ? '#0f766e' : '#1e3a8a';     // Deep Teal for Lab Test, Deep Blue for Doctor Consult
      const lightBg = '#f8fafc';
      const darkGray = '#475569';
      const borderColor = '#cbd5e1';

      // ─── Header Banner ──────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 105).fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text(isLab ? 'LABORATORY DIAGNOSTIC INVOICE' : 'APPOINTMENT INVOICE & RECEIPT', 40, 26, { align: 'left' });

      doc.fillColor('#e0f2fe')
         .fontSize(10)
         .font('Helvetica')
         .text(
           isLab
             ? 'Veterinary Pathology & Diagnostic Laboratory Investigation'
             : 'Outpatient Clinical Consultation & Veterinary Care',
           40,
           52
         );

      // Provider details (Right aligned)
      doc.fillColor('#f8fafc')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(data.hospital || 'MEDPARK Hospital & Diagnostic Center', 300, 24, { align: 'right' });

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#cbd5e1')
         .text('MEDPARK Health Network', 300, 39, { align: 'right' })
         .text('24x7 Helpline: +91 9814538354 | support@medpark.com', 300, 52, { align: 'right' })
         .text(`Hospital Center: ${data.hospital || 'Main Center'}`, 300, 65, { align: 'right' });

      // ─── Top Boxes: BILLED TO (Left) & INVOICE META (Right) ─────────
      const startY = 120;
      const boxHeight = 105;

      // Left Box: Patient & Pet Info
      doc.rect(40, startY, 250, boxHeight)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke(lightBg, borderColor);

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('PATIENT & PET DETAILS', 52, startY + 10);

      doc.fillColor('#0f172a')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(data.patientName || 'Patient', 52, startY + 26);

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(darkGray)
         .text(`Phone: ${data.patientPhone || 'N/A'}`, 52, startY + 44)
         .text(`Email: ${data.email || 'N/A'}`, 52, startY + 58)
         .text(`Pet Name: ${data.petName || 'Not specified'}`, 52, startY + 72)
         .text(`Species / Breed: ${[data.species, data.breed, data.sex].filter(Boolean).join(' • ') || 'Pet Animal'}`, 52, startY + 86);

      // Right Box: Invoice & Transaction Info
      doc.rect(305, startY, 250, boxHeight)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke(lightBg, borderColor);

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('PAYMENT & INVOICE DETAILS', 317, startY + 10);

      const metaXLabel = 317;
      const metaXVal = 425;

      const metaRows = [
        ['Invoice #:', `INV-${data.appointment_number || data.id || '1001'}`],
        ['Date:', data.date || new Date().toISOString().split('T')[0]],
        ['Payment Method:', data.paymentMethod || 'Stripe Card'],
        ['Transaction ID:', String(data.paymentId || 'N/A').slice(0, 18)],
        ['Payment Status:', isPaid ? 'PAID' : (isFailed ? 'FAILED' : 'PENDING')]
      ];

      metaRows.forEach(([label, val], idx) => {
        const rowY = startY + 26 + (idx * 15);
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor(darkGray)
           .text(label, metaXLabel, rowY);

        doc.font('Helvetica-Bold')
           .fontSize(9)
           .fillColor(label === 'Payment Status:' ? (isPaid ? '#15803d' : (isFailed ? '#b91c1c' : '#b45309')) : '#0f172a')
           .text(val, metaXVal, rowY, { width: 125, align: 'right' });
      });

      // ─── Middle Section: Clinical / Diagnostic Specifications ──────
      const specY = startY + boxHeight + 12;
      doc.rect(40, specY, 515, 60)
         .fillAndStroke('#f1f5f9', '#e2e8f0');

      doc.fillColor(primaryColor)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(isLab ? 'DIAGNOSTIC TEST SPECIFICATIONS' : 'CONSULTATION DETAILS', 52, specY + 8);

      if (isLab) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Test Name:', 52, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.serviceName || data.reason || 'Diagnostic Lab Investigation', 120, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Category:', 52, specY + 36);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.serviceCategory || 'Laboratory Diagnostics', 120, specY + 36);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Sample Type:', 300, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.sampleType || 'Standard Specimen', 380, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Turnaround:', 300, specY + 36);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.turnaroundTime || '24-48 Hours', 380, specY + 36);

        if (data.fastingRequired) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#b45309')
             .text(`* Fasting Required: ${data.fastingDetails || '8-12 hours fasting required before sample collection'}`, 52, specY + 48);
        }
      } else {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Doctor / Reason:', 52, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.doctorName ? `Dr. ${data.doctorName}` : (data.reason || 'Veterinary Consultation'), 140, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Scheduled Slot:', 52, specY + 37);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(`${data.date} at ${data.time}`, 140, specY + 37);
      }

      // ─── Table Header ──────────────────────────────────────────────
      const tableY = specY + 70;
      doc.rect(40, tableY, 515, 24).fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Description / Service Item', 52, tableY + 7, { width: 280 })
         .text('Type', 340, tableY + 7, { width: 90 })
         .text('Amount (INR)', 445, tableY + 7, { align: 'right', width: 100 });

      // ─── Table Row ─────────────────────────────────────────────────
      const rowY = tableY + 24;
      doc.rect(40, rowY, 515, 34)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke('#ffffff', borderColor);

      const fee = Number(data.paymentAmount || data.servicePrice || 500);

      doc.fillColor('#0f172a')
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text(isLab ? (data.serviceName || 'Diagnostic Lab Test') : (data.reason || 'Doctor Consultation'), 52, rowY + 7, { width: 280 });

      doc.font('Helvetica')
         .fontSize(8.5)
         .fillColor(darkGray)
         .text(`Slot: ${data.date} ${data.time} | Hospital: ${data.hospital || 'Center'}`, 52, rowY + 20, { width: 280 });

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#0f172a')
         .text(isLab ? 'Lab Test' : 'Consultation', 340, rowY + 11, { width: 90 });

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('#0f172a')
         .text(`INR ${fee.toFixed(2)}`, 445, rowY + 11, { align: 'right', width: 100 });

      // ─── Total Box & Status Badge ──────────────────────────────────
      const totalY = rowY + 44;

      // Status Stamp on Left
      doc.rect(40, totalY, 200, 48)
         .lineWidth(1.5)
         .strokeColor(isPaid ? '#22c55e' : (isFailed ? '#ef4444' : '#f59e0b'))
         .fillAndStroke(isPaid ? '#f0fdf4' : (isFailed ? '#fef2f2' : '#fffbeb'), isPaid ? '#86efac' : (isFailed ? '#fca5a5' : '#fde68a'));

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(isPaid ? '#15803d' : (isFailed ? '#b91c1c' : '#b45309'))
         .text(isPaid ? 'PAID / VERIFIED' : (isFailed ? 'PAYMENT FAILED' : 'PAYMENT PENDING'), 52, totalY + 11);

      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(darkGray)
         .text(isPaid ? `Processed via ${data.paymentMethod || 'Stripe Gateway'}` : (isFailed ? 'Transaction incomplete or declined' : 'Awaiting payment confirmation'), 52, totalY + 28);

      // Total Paid Box on Right
      doc.rect(345, totalY, 210, 48)
         .fill(primaryColor);

      doc.fillColor('#e0f2fe')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('TOTAL AMOUNT PAID', 357, totalY + 8);

      doc.fillColor('#ffffff')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(`INR ${fee.toFixed(2)}`, 357, totalY + 23, { align: 'right', width: 185 });

      // ─── Instructions & Notes ──────────────────────────────────────
      const notesY = totalY + 58;
      doc.rect(40, notesY, 515, 58)
         .fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fillColor(primaryColor)
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text('PATIENT GUIDELINES & INSTRUCTIONS:', 52, notesY + 7);

      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(darkGray)
         .text(
           isLab
             ? '1. Please arrive at the laboratory reception 10-15 minutes prior to your scheduled slot for specimen collection.\n2. Diagnostic reports will be published to your user dashboard and emailed within the stated turnaround time.\n3. Bring any previous medical or prescription history for comparative veterinary evaluation.'
             : '1. Please arrive at the hospital 10 minutes prior to your scheduled consultation slot.\n2. Bring any previous prescription or vaccination records for your pet.\n3. In case of emergency or rescheduling, please contact our 24/7 helpline immediately.',
           52,
           notesY + 19,
           { width: 495, lineGap: 2 }
         );

      // ─── Footer ────────────────────────────────────────────────────
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(40, doc.page.height - 45)
         .lineTo(doc.page.width - 40, doc.page.height - 45)
         .stroke();

      doc.fillColor('#94a3b8')
         .fontSize(8)
         .font('Helvetica')
         .text(
           'This is a computer-generated invoice and receipt from MEDPARK Hospital Management System. For inquiries, email support@medpark.com.',
           40,
           doc.page.height - 35,
           { align: 'center', width: doc.page.width - 80 }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generates a beautifully styled PDF cancellation invoice & credit memo as a buffer.
 * Supports both Diagnostic Lab Tests and Doctor Consultations.
 * @param {Object} data - Appointment cancellation data
 * @returns {Promise<Buffer>}
 */
const generateCancellationInvoice = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const isLab = data.appointmentType === 'Lab Test' || Boolean(data.serviceName);
      const isPaid = String(data.paymentStatus || '').toLowerCase() === 'paid' || Number(data.refundAmount) > 0;
      const originalAmount = Number(data.paymentAmount || data.servicePrice || 0);
      const cancelFee = Number(data.cancellationFee || 0);
      const refundAmt = Number(data.refundAmount || 0);
      const cancelDate = data.cancelledAt ? new Date(data.cancelledAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      // Colors - Rose/Crimson Theme for Cancellation Credit Memo
      const primaryColor = '#991b1b';     // Deep Crimson / Red-800
      const lightBg = '#fef2f2';          // Red-50
      const darkGray = '#475569';
      const borderColor = '#fecaca';      // Red-200

      // ─── Header Banner ──────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 105).fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('CANCELLATION INVOICE & CREDIT MEMO', 40, 26, { align: 'left' });

      doc.fillColor('#fecaca')
         .fontSize(10)
         .font('Helvetica')
         .text(
           isLab
             ? 'Cancelled Laboratory Diagnostic Test Booking • Refund Credit Voucher'
             : 'Cancelled Outpatient Doctor Consultation • Refund Credit Voucher',
           40,
           52
         );

      // Provider details (Right aligned)
      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(data.hospital || 'MEDPARK Hospital & Diagnostic Center', 300, 24, { align: 'right' });

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#fecaca')
         .text('MEDPARK Health Network', 300, 39, { align: 'right' })
         .text('24x7 Helpline: +91 9814538354 | billing@medpark.com', 300, 52, { align: 'right' })
         .text(`Hospital Center: ${data.hospital || 'Main Center'}`, 300, 65, { align: 'right' });

      // ─── Top Boxes: PATIENT INFO (Left) & CANCELLATION META (Right) ─────────
      const startY = 120;
      const boxHeight = 110;

      // Left Box: Patient & Pet Info
      doc.rect(40, startY, 250, boxHeight)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke(lightBg, borderColor);

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('PATIENT & RECIPIENT DETAILS', 52, startY + 10);

      doc.fillColor('#0f172a')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(data.patientName || 'Patient', 52, startY + 26);

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(darkGray)
         .text(`Phone: ${data.patientPhone || 'N/A'}`, 52, startY + 44)
         .text(`Email: ${data.email || 'N/A'}`, 52, startY + 58)
         .text(`Pet Name: ${data.petName || 'Not specified'}`, 52, startY + 72)
         .text(`Species / Breed: ${[data.species, data.breed, data.sex].filter(Boolean).join(' • ') || 'Pet Animal'}`, 52, startY + 86);

      // Right Box: Cancellation Meta Info
      doc.rect(305, startY, 250, boxHeight)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke(lightBg, borderColor);

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('CANCELLATION & SETTLEMENT INFO', 317, startY + 10);

      const metaXLabel = 317;
      const metaXVal = 425;

      const metaRows = [
        ['Credit Note #:', `CN-${data.appointment_number || data.id || '1001'}`],
        ['Original Order #:', `#${data.appointment_number || data.id || '1001'}`],
        ['Cancel Date:', cancelDate],
        ['Payment Method:', data.paymentMethod || 'Online Gateway'],
        ['Refund Status:', isPaid && refundAmt > 0 ? (data.refundStatus || 'REFUNDED') : 'NO REFUND']
      ];

      metaRows.forEach(([label, val], idx) => {
        const rowY = startY + 26 + (idx * 15);
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor(darkGray)
           .text(label, metaXLabel, rowY);

        doc.font('Helvetica-Bold')
           .fontSize(9)
           .fillColor(label === 'Refund Status:' ? (isPaid && refundAmt > 0 ? '#15803d' : '#64748b') : '#0f172a')
           .text(val, metaXVal, rowY, { width: 125, align: 'right' });
      });

      // ─── Middle Section: Cancellation Reason & Booking Reference ──────
      const specY = startY + boxHeight + 12;
      doc.rect(40, specY, 515, 60)
         .fillAndStroke('#fff1f2', '#ffe4e6');

      doc.fillColor(primaryColor)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('CANCELLED BOOKING SPECIFICATIONS', 52, specY + 8);

      if (isLab) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Test Name:', 52, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.serviceName || data.reason || 'Diagnostic Lab Investigation', 120, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Original Slot:', 52, specY + 36);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(`${data.date} at ${data.time}`, 120, specY + 36);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Cancel Reason:', 300, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#b91c1c').text(data.cancellationReason || 'Cancelled by user', 380, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Refund ID:', 300, specY + 36);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.refundId ? String(data.refundId).slice(0, 18) : 'N/A', 380, specY + 36);
      } else {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Consultation:', 52, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.doctorName ? `Dr. ${data.doctorName}` : (data.reason || 'Doctor Consultation'), 140, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Original Slot:', 52, specY + 36);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(`${data.date} at ${data.time}`, 140, specY + 36);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Cancel Reason:', 300, specY + 23);
        doc.font('Helvetica').fontSize(9).fillColor('#b91c1c').text(data.cancellationReason || 'Cancelled by user', 380, specY + 23);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b').text('Refund ID:', 300, specY + 36);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.refundId ? String(data.refundId).slice(0, 18) : 'N/A', 380, specY + 36);
      }

      // ─── Table Header ──────────────────────────────────────────────
      const tableY = specY + 70;
      doc.rect(40, tableY, 515, 24).fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Description / Line Item', 52, tableY + 7, { width: 280 })
         .text('Adjustment', 340, tableY + 7, { width: 90 })
         .text('Amount (INR)', 445, tableY + 7, { align: 'right', width: 100 });

      // ─── Table Rows (Financial Breakdown) ──────────────────────────
      const row1Y = tableY + 24;
      doc.rect(40, row1Y, 515, 28)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke('#ffffff', borderColor);

      doc.fillColor('#0f172a')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(`Original Booking Fee: ${isLab ? (data.serviceName || 'Lab Test') : (data.reason || 'Doctor Consultation')}`, 52, row1Y + 8, { width: 280 });

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#0f172a')
         .text('Gross Amount', 340, row1Y + 8, { width: 90 });

      doc.font('Helvetica-Bold')
         .fontSize(9.5)
         .fillColor('#0f172a')
         .text(`INR ${originalAmount.toFixed(2)}`, 445, row1Y + 8, { align: 'right', width: 100 });

      const row2Y = row1Y + 28;
      doc.rect(40, row2Y, 515, 28)
         .lineWidth(1)
         .strokeColor(borderColor)
         .fillAndStroke('#fff5f5', borderColor);

      doc.fillColor('#b91c1c')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Less: Standard Cancellation Processing Fee (10%)', 52, row2Y + 8, { width: 280 });

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#b91c1c')
         .text('Deduction', 340, row2Y + 8, { width: 90 });

      doc.font('Helvetica-Bold')
         .fontSize(9.5)
         .fillColor('#b91c1c')
         .text(`- INR ${cancelFee.toFixed(2)}`, 445, row2Y + 8, { align: 'right', width: 100 });

      // ─── Total Box & Status Badge ──────────────────────────────────
      const totalY = row2Y + 38;

      // Status Stamp on Left
      doc.rect(40, totalY, 200, 48)
         .lineWidth(1.5)
         .strokeColor(isPaid && refundAmt > 0 ? '#16a34a' : '#64748b')
         .fillAndStroke(isPaid && refundAmt > 0 ? '#f0fdf4' : '#f8fafc', isPaid && refundAmt > 0 ? '#86efac' : '#cbd5e1');

      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(isPaid && refundAmt > 0 ? '#15803d' : '#475569')
         .text(isPaid && refundAmt > 0 ? 'REFUND INITIATED' : 'CANCELLED (UNPAID)', 52, totalY + 11);

      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(darkGray)
         .text(isPaid && refundAmt > 0 ? `Credit via ${data.paymentMethod || 'Original Gateway'}` : 'Booking released without charges', 52, totalY + 28);

      // Net Refund Credit Box on Right
      doc.rect(345, totalY, 210, 48)
         .fill(primaryColor);

      doc.fillColor('#fecaca')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('NET REFUND CREDIT AMOUNT', 357, totalY + 8);

      doc.fillColor('#ffffff')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(`INR ${refundAmt.toFixed(2)}`, 357, totalY + 23, { align: 'right', width: 185 });

      // ─── Refund Policy & Settlement Notes ─────────────────────────
      const notesY = totalY + 58;
      doc.rect(40, notesY, 515, 60)
         .fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fillColor(primaryColor)
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text('REFUND POLICY & SETTLEMENT TERMS:', 52, notesY + 7);

      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(darkGray)
         .text(
           isPaid && refundAmt > 0
             ? `1. The net refund of INR ${refundAmt.toFixed(2)} has been submitted to your original payment source.\n2. Please allow 5-7 banking business days for the credit to appear on your bank statement or card.\n3. For any billing questions regarding this credit memo, please quote reference #${data.appointment_number} to support@medpark.com.`
             : `1. This appointment was cancelled with zero payment dues or pending balances.\n2. No financial charge was retained, and your booking slot has been released back to the hospital.\n3. You may re-book a fresh consultation or diagnostic test anytime on MEDPARK.`,
           52,
           notesY + 19,
           { width: 495, lineGap: 2 }
         );

      // ─── Footer ────────────────────────────────────────────────────
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(40, doc.page.height - 45)
         .lineTo(doc.page.width - 40, doc.page.height - 45)
         .stroke();

      doc.fillColor('#94a3b8')
         .fontSize(8)
         .font('Helvetica')
         .text(
           'This is an official cancellation credit note & tax receipt from MEDPARK Hospital Management System. Generated electronically.',
           40,
           doc.page.height - 35,
           { align: 'center', width: doc.page.width - 80 }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoice, generateAppointmentInvoice, generateCancellationInvoice };