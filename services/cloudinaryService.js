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

/**
 * Upload any attachment file (base64 string or URL) to Cloudinary
 * @param {string} fileData - Base64 data URI or file path/URL
 * @param {string} filename - Original filename
 * @returns {Promise<object>} - Cloudinary attachment metadata or fallback
 */
const uploadAttachmentToCloudinary = async (fileData, filename) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('[Cloudinary] Credentials missing, using data URI representation for file viewing.');
      return { filename: filename || 'Attachment', url: fileData && fileData.startsWith('data:') ? fileData : '' };
    }

    const ext = filename ? filename.split('.').pop().toLowerCase() : '';
    const isRaw = ['pdf', 'doc', 'docx', 'txt', 'csv', 'zip'].includes(ext);

    const result = await cloudinary.uploader.upload(fileData, {
      folder: 'contact_attachments',
      resource_type: isRaw ? 'raw' : 'auto',
      use_filename: true,
      unique_filename: true,
      timeout: 8000
    });

    console.log(`[Cloudinary] ✅ Attachment ${filename} uploaded successfully.`);
    return {
      filename: filename || 'Attachment',
      url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('[Cloudinary] ❌ Attachment upload fallback:', error.message);
    return { filename: filename || 'Attachment', url: fileData && fileData.startsWith('data:') ? fileData : '' };
  }
};

module.exports = { uploadInvoicePDF, uploadAttachmentToCloudinary };