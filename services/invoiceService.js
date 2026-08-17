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

module.exports = { generateInvoice };