// services/cloudinaryService.js
const cloudinary = require('../config/cloudinary');
const axios = require('axios'); // Make sure to install axios: npm install axios

/**
 * Upload a PDF from a URL to Cloudinary
 * @param {string} pdfUrl - The temporary URL from Stripe
 * @param {string} invoiceId - The Stripe invoice ID
 * @returns {Promise<string>} - The secure Cloudinary URL
 */
const uploadInvoicePDF = async (pdfUrl, invoiceId) => {
  try {
    // 1. Download the PDF from Stripe's temporary URL
    const response = await axios({
      method: 'GET',
      url: pdfUrl,
      responseType: 'arraybuffer', // Important: get the file as a buffer
    });

    // 2. Upload the PDF buffer to Cloudinary as a 'raw' file
    const result = await cloudinary.uploader.upload(
      `data:application/pdf;base64,${Buffer.from(response.data).toString('base64')}`,
      {
        public_id: `invoices/${invoiceId}`, // Organize in a folder
        resource_type: 'raw', // Important for non-image files like PDFs
        format: 'pdf',
        use_filename: true,
        unique_filename: false,
      }
    );

    console.log(`[Cloudinary] ✅ Invoice ${invoiceId} uploaded successfully.`);
    console.log(`[Cloudinary] 🔗 Secure URL: ${result.secure_url}`);

    return result.secure_url; // This is the permanent Cloudinary URL
  } catch (error) {
    console.error('[Cloudinary] ❌ Failed to upload invoice PDF:', error.message);
    // Return the original Stripe URL as a fallback
    return pdfUrl;
  }
};

module.exports = { uploadInvoicePDF };