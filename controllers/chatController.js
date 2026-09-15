// controllers/chatController.js
const { supabase } = require('../config/supabase');
const { readDB } = require('../models');
const { getDailyTimeSlots } = require('../services/schedulerService');

// ─── Default Medical & Hospital Knowledge Base ─────────────────
const POPULAR_LAB_TESTS = [
  { name: 'Complete Blood Count (CBC)', price: 350, fasting: 'Not required', turnaround: 'Same day (4 hrs)', category: 'Hematology' },
  { name: 'Lipid Profile (Cholesterol)', price: 750, fasting: '10-12 hrs fasting required', turnaround: '24 hours', category: 'Biochemistry' },
  { name: 'Thyroid Profile (T3, T4, TSH)', price: 650, fasting: 'Morning sample preferred', turnaround: '24 hours', category: 'Endocrinology' },
  { name: 'HbA1c (Diabetes Glycated Hb)', price: 500, fasting: 'Not required', turnaround: '6 hours', category: 'Diabetes' },
  { name: 'Liver Function Test (LFT)', price: 800, fasting: '8-10 hrs fasting required', turnaround: '12 hours', category: 'Biochemistry' },
  { name: 'Kidney Function Test (KFT/RFT)', price: 750, fasting: 'Not required', turnaround: '12 hours', category: 'Biochemistry' },
  { name: 'Digital Chest X-Ray (PA View)', price: 450, fasting: 'Not required', turnaround: '1 hour', category: 'Radiology' },
  { name: '12-Lead Electrocardiogram (ECG)', price: 400, fasting: 'Not required', turnaround: 'Instant', category: 'Cardiology' }
];

const SPECIALTIES = [
  { name: 'Cardiology', desc: 'Heart care, ECG, hypertension & cardiovascular surgery', icon: '❤️' },
  { name: 'Neurology', desc: 'Brain, stroke, spine & nervous system specialists', icon: '🧠' },
  { name: 'Orthopedics', desc: 'Bone, joint replacement, fractures & sports injuries', icon: '🦴' },
  { name: 'Pediatrics', desc: 'Child health, newborn intensive care & vaccinations', icon: '👶' },
  { name: 'Dermatology', desc: 'Skin, hair, allergies & cosmetic treatments', icon: '✨' },
  { name: 'General Medicine', desc: 'Fever, diabetes, infectious diseases & wellness', icon: '🩺' },
  { name: 'Gynecology & Obstetrics', desc: 'Women health, maternity care & fertility', icon: '🌸' },
  { name: 'Ophthalmology', desc: 'Eye care, cataract, retina & vision testing', icon: '👁️' }
];

// ─── Helper: Query Appointment by 4-digit number ────────────────
const findAppointmentByNumber = async (appointmentNumber) => {
  const num = Number(appointmentNumber);
  if (isNaN(num)) return null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_number', num)
        .maybeSingle();
      if (!error && data) return data;
    } catch (_) {}
  }

  const db = readDB();
  const found = (db.appointments || []).find(
    (a) => Number(a.appointment_number) === num || String(a.id) === String(num)
  );
  return found || null;
};

// ─── Helper: Query Hospitals from DB ────────────────────────────
const getHospitalList = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('id, name, city, address, phone, beds, emergency')
        .limit(10);
      if (!error && Array.isArray(data) && data.length > 0) return data;
    } catch (_) {}
  }

  const db = readDB();
  return db.hospitals || [
    { id: '1', name: 'Apollo Multi-Specialty Hospital', city: 'Mumbai', beds: 450, emergency: '24/7 Active', phone: '+91-22-2847-0000' },
    { id: '2', name: 'Fortis Memorial Health Institute', city: 'Delhi NCR', beds: 380, emergency: '24/7 Active', phone: '+91-11-4713-5000' },
    { id: '3', name: 'Manipal Hospital & Research Centre', city: 'Bangalore', beds: 500, emergency: '24/7 Active', phone: '+91-80-2502-4444' }
  ];
};

// ─── Main Conversational Message Handler ────────────────────────
const processChatMessage = async (req, res) => {
  try {
    const { message = '', context = {}, history = [] } = req.body || {};
    const text = String(message).trim();
    const lower = text.toLowerCase();

    if (!text) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const user = req.user || null;
    const userName = user?.name ? user.name.split(' ')[0] : 'there';

    // ─────────────────────────────────────────────────────────────
    // 1. APPOINTMENT TRACKING (Matches #1234, 1234, track appointment, check status)
    // ─────────────────────────────────────────────────────────────
    const numMatch = text.match(/(?:#|appointment\s*#?|ticket\s*#?|tracking\s*#?|status\s*#?)?\b(\d{4})\b/i);
    const isStatusIntent =
      lower.includes('track') ||
      lower.includes('status') ||
      lower.includes('appointment number') ||
      lower.includes('check my booking') ||
      lower.includes('where is my appointment');

    if (numMatch && (isStatusIntent || text.length < 15 || lower.includes('appointment') || lower.includes('status'))) {
      const apptNum = numMatch[1];
      const appt = await findAppointmentByNumber(apptNum);

      if (appt) {
        const isCancelled = appt.status === 'Cancelled';
        const isCompleted = appt.status === 'Completed';
        const statusEmoji = isCancelled ? '❌' : isCompleted ? '✅' : '⏳';

        const reply = `### ${statusEmoji} Appointment #${appt.appointment_number || appt.id} Details\n\n` +
          `* **Patient Name:** ${appt.patientName || 'N/A'}\n` +
          `* **Service / Type:** ${appt.serviceName || appt.appointmentType || 'Doctor Consultation'}\n` +
          `* **Hospital:** ${appt.hospital || 'MEDPARK Hospital'}\n` +
          `* **Scheduled Slot:** 📅 **${appt.date || 'N/A'}** at ⏰ **${appt.time || 'N/A'}**\n` +
          `* **Booking Status:** **${appt.status || 'Pending'}**\n` +
          `* **Payment Status:** ${String(appt.paymentStatus).toLowerCase() === 'paid' ? '💳 Paid (₹' + (appt.paymentAmount || 500) + ')' : '⏳ Unpaid'}\n` +
          (isCancelled ? `\n> ℹ️ *Cancellation Reason: ${appt.cancellationReason || 'Cancelled by user'}* (Refund: ₹${appt.refundAmount || 0})` : '') +
          `\n\nNeed to download your invoice or manage this booking?`;

        return res.json({
          reply,
          intent: 'track_appointment',
          appointment: appt,
          quickReplies: [
            'Book Another Appointment',
            'Download Invoice PDF',
            'Explore Diagnostic Tests',
            'Contact Hospital Helpdesk'
          ],
          action: {
            type: 'view_appointment',
            appointmentId: appt.id,
            appointmentNumber: appt.appointment_number,
            url: `/dashboard/my-appointments?id=${appt.id}`
          }
        });
      } else {
        return res.json({
          reply: `🔍 I searched for appointment number **#${apptNum}**, but couldn't find an active record in our system.\n\n` +
            `* Please ensure the 4-digit appointment number is correct.\n` +
            `* If you booked recently, check your confirmation email or log into your [My Appointments](/dashboard/my-appointments) portal.`,
          intent: 'track_appointment_not_found',
          quickReplies: ['Book New Appointment', 'View My Appointments', 'Talk to Support']
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GREETINGS & CASUAL CONVERSATION
    // ─────────────────────────────────────────────────────────────
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|hola|namaste)\b/i.test(lower)) {
      return res.json({
        reply: `👋 Hello ${userName}! Welcome to **MEDPARK Healthcare Portal**.\n\nI am **MediBot**, your 24/7 intelligent healthcare assistant. How can I assist you today?`,
        intent: 'greeting',
        quickReplies: [
          '🩺 Book Doctor Appointment',
          '🧪 Explore Lab Tests & Pricing',
          '🔍 Track My Appointment',
          '🚨 Emergency Helpline',
          '🏥 Hospital Network'
        ]
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. BOOK APPOINTMENT INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('book') ||
      lower.includes('appointment') ||
      lower.includes('consult') ||
      lower.includes('schedule') ||
      lower.includes('reserve slot') ||
      lower.includes('doctor visit') ||
      lower.includes('see a doctor')
    ) {
      const slots = getDailyTimeSlots ? getDailyTimeSlots().slice(0, 6) : ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

      return res.json({
        reply: `🩺 **Schedule a Doctor Consultation or Diagnostic Test**\n\n` +
          `You can book verified specialist doctors across our accredited hospital network with instant slot confirmation and automated invoice generation.\n\n` +
          `**What you can do:**\n` +
          `1. Choose your preferred specialty or diagnostic test.\n` +
          `2. Select your hospital and convenient date.\n` +
          `3. Pick a time slot (${slots.join(', ')}, etc.).\n` +
          `4. Pay securely via UPI, Card, or Net Banking.\n\n` +
          `👉 Click below to open the interactive booking window directly:`,
        intent: 'book_appointment',
        quickReplies: [
          'Book Cardiology',
          'Book Neurology',
          'Book Pediatrics',
          'Book Lab Test',
          'Check Available Slots'
        ],
        action: {
          type: 'open_booking_modal',
          url: '/dashboard/book-appointment'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. DIAGNOSTIC LAB TESTS & SERVICES INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('lab') ||
      lower.includes('test') ||
      lower.includes('blood') ||
      lower.includes('x-ray') ||
      lower.includes('mri') ||
      lower.includes('ct scan') ||
      lower.includes('ecg') ||
      lower.includes('fasting') ||
      lower.includes('diagnostic') ||
      lower.includes('pathology')
    ) {
      const testListMarkdown = POPULAR_LAB_TESTS.slice(0, 5)
        .map((t) => `* **${t.name}** — ₹${t.price} *(Turnaround: ${t.turnaround} | ${t.fasting})*`)
        .join('\n');

      return res.json({
        reply: `🧪 **Diagnostic Lab Tests & Pathology Packages**\n\n` +
          `Our NABL-accredited diagnostic labs offer comprehensive testing with online digital reports:\n\n` +
          `${testListMarkdown}\n\n` +
          `💡 *All lab bookings include a verified digital invoice and automated email delivery of test results upon completion.*`,
        intent: 'lab_services',
        services: POPULAR_LAB_TESTS,
        quickReplies: [
          'Book Complete Blood Count (CBC)',
          'Book Lipid Profile',
          'Book Thyroid Profile',
          'View All Lab Tests'
        ],
        action: {
          type: 'view_services',
          url: '/dashboard/services'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. EMERGENCY & HELPLINE INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('emergency') ||
      lower.includes('ambulance') ||
      lower.includes('urgent') ||
      lower.includes('casualty') ||
      lower.includes('helpline') ||
      lower.includes('icu') ||
      lower.includes('critical') ||
      lower.includes('call doctor')
    ) {
      return res.json({
        reply: `🚨 **24/7 Emergency & Critical Care Helplines**\n\n` +
          `If this is a medical emergency, please reach out immediately:\n\n` +
          `* 🚑 **National Emergency Ambulance:** **108** / **112**\n` +
          `* 🏥 **MEDPARK Central Emergency Hotline:** **+91-1800-419-1234** (Toll-Free)\n` +
          `* 📞 **Casualty Direct Dispatch:** **+91-98765-43210**\n` +
          `* 🩸 **24/7 Blood Bank & Trauma Desk:** **+91-11-2659-8888**\n\n` +
          `⚠️ *Our emergency triage teams and fully equipped ICU ambulances are on standby 24 hours a day.*`,
        intent: 'emergency',
        quickReplies: [
          'Nearest Hospital Address',
          'Book Urgent Consult',
          'Check ICU Beds'
        ],
        action: {
          type: 'emergency_call',
          phone: '18004191234'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. SPECIALTIES & DOCTOR DISCOVERY INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('doctor') ||
      lower.includes('specialist') ||
      lower.includes('cardio') ||
      lower.includes('neuro') ||
      lower.includes('ortho') ||
      lower.includes('pediatric') ||
      lower.includes('derma') ||
      lower.includes('physician') ||
      lower.includes('surgeon') ||
      lower.includes('gynec')
    ) {
      const specList = SPECIALTIES.map((s) => `* ${s.icon} **${s.name}** — ${s.desc}`).join('\n');

      return res.json({
        reply: `👨‍⚕️ **Specialist Doctors & Medical Departments**\n\n` +
          `We have over 150+ board-certified senior consultants across key disciplines:\n\n` +
          `${specList}\n\n` +
          `Would you like to book an appointment with a specialist today?`,
        intent: 'find_doctor',
        specialties: SPECIALTIES,
        quickReplies: [
          'Book Cardiology',
          'Book Neurology',
          'Book Orthopedics',
          'Book Pediatrics',
          'Explore Hospitals'
        ],
        action: {
          type: 'open_booking_modal',
          url: '/dashboard/book-appointment'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 7. HOSPITALS & BEDS INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('hospital') ||
      lower.includes('bed') ||
      lower.includes('facility') ||
      lower.includes('location') ||
      lower.includes('branch') ||
      lower.includes('city')
    ) {
      const hospitals = await getHospitalList();
      const hospMarkdown = hospitals.slice(0, 4)
        .map((h) => `* 🏥 **${h.name}** (${h.city || 'Metro City'})\n  🛏️ Total Beds: **${h.beds || '350+'}** | 🚨 Emergency: **${h.emergency || '24/7'}** | 📞 ${h.phone || '+91-1800-419-1234'}`)
        .join('\n\n');

      return res.json({
        reply: `🏥 **Our Accredited Hospital Network**\n\n` +
          `MEDPARK partners with premier multi-specialty hospitals equipped with cutting-edge diagnostics, modular OTs, and dedicated ICUs:\n\n` +
          `${hospMarkdown}\n\n` +
          `👉 You can filter hospitals by city, specialty, and bed availability on our portal.`,
        intent: 'find_hospitals',
        hospitals,
        quickReplies: [
          'Explore All Hospitals',
          'Book Doctor in Hospital',
          'Check Bed Availability',
          'Emergency Helplines'
        ],
        action: {
          type: 'view_hospitals',
          url: '/dashboard/explore-hospitals'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 8. PRICING & HOSPITAL SOFTWARE SUBSCRIPTIONS INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('pricing') ||
      lower.includes('plan') ||
      lower.includes('subscription') ||
      lower.includes('cost') ||
      lower.includes('software') ||
      lower.includes('tier') ||
      lower.includes('quarterly') ||
      lower.includes('yearly') ||
      lower.includes('enterprise')
    ) {
      return res.json({
        reply: `💳 **Hospital Management Software Subscription Plans**\n\n` +
          `Our enterprise HMS cloud suite is available in flexible licensing tiers:\n\n` +
          `1. 🌟 **Quarterly Plan** (Recommended for Growing Clinics)\n` +
          `   * **Price:** ₹20,000 / quarter\n` +
          `   * OPD/IPD Management, Doctor Scheduling, Billing & Stripe/Razorpay Payments.\n\n` +
          `2. 🚀 **Yearly Plan** (Best Value — Save 25%)\n` +
          `   * **Price:** ₹69,999 / year\n` +
          `   * All Modules + Diagnostic Lab Suite, Unlimited Bed Tracking, WhatsApp/Email Invoicing & 24/7 Priority Support.\n\n` +
          `3. 🏢 **Enterprise Tier**\n` +
          `   * Multi-branch chain integration, Custom HL7/FHIR EHR Sync & Dedicated Account Executive.\n\n` +
          `Want to schedule a live product demonstration with our solutions team?`,
        intent: 'pricing_subscription',
        quickReplies: [
          'Book Live Software Demo',
          'View Full Pricing Page',
          'Contact Sales Team'
        ],
        action: {
          type: 'view_pricing',
          url: '/pricing'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 9. CANCELLATION & REFUND POLICY INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('cancel') ||
      lower.includes('refund') ||
      lower.includes('reschedule') ||
      lower.includes('money back') ||
      lower.includes('policy')
    ) {
      return res.json({
        reply: `🔄 **Cancellation & Instant Refund Policy**\n\n` +
          `* **Automated Gateway Refund:** When you cancel a paid consultation or diagnostic test, a **90% net refund** is automatically credited back to your original payment method (Stripe card / Razorpay UPI) with a formal cancellation invoice.\n` +
          `* **Processing Timeline:** Refunds reflect in your bank account or card within **5–7 business days**.\n` +
          `* **Instant Slot Release:** Cancelled time slots are freed up immediately for other patients.\n` +
          `* **How to Cancel:** Go to [My Appointments](/dashboard/my-appointments), click **Cancel Booking**, provide a brief reason, and your refund receipt is generated instantly.`,
        intent: 'cancellation_refund',
        quickReplies: [
          'View My Appointments',
          'Track Refund by Number',
          'Book New Slot'
        ],
        action: {
          type: 'view_appointments',
          url: '/dashboard/my-appointments'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 10. CONTACT & SUPPORT INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('contact') ||
      lower.includes('support') ||
      lower.includes('helpdesk') ||
      lower.includes('email') ||
      lower.includes('phone number') ||
      lower.includes('human') ||
      lower.includes('agent')
    ) {
      return res.json({
        reply: `📞 **MEDPARK Support & Helpdesk**\n\n` +
          `Our patient assistance desk is available to assist with any questions:\n\n` +
          `* 📧 **Support Email:** \`support@medparkhospitals.com\`\n` +
          `* 📞 **Toll-Free Helpline:** **+91-1800-419-1234**\n` +
          `* 💬 **Live Helpdesk Hours:** Monday – Saturday, 8:00 AM – 9:00 PM IST\n` +
          `* 🏢 **Corporate HQ:** MEDPARK Health Towers, Sector 44, Gurugram, India\n\n` +
          `You can also leave a message on our [Contact Support](/contact) page and our medical coordination team will follow up within 2 hours.`,
        intent: 'contact_support',
        quickReplies: [
          'Open Contact Form',
          'Book Doctor Appointment',
          'Explore Hospitals'
        ],
        action: {
          type: 'open_contact',
          url: '/contact'
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 11. GENERAL AI / FALLBACK RESPONSES
    // ─────────────────────────────────────────────────────────────
    return res.json({
      reply: `I understand you are asking about *"**${text.length > 50 ? text.slice(0, 50) + '...' : text}**"*. \n\n` +
        `Here is what I can help you with immediately:\n` +
        `* 🩺 **Book an Appointment** with top specialist doctors.\n` +
        `* 🧪 **Book Diagnostic Lab Tests** (CBC, Lipid, Thyroid, LFT, ECG).\n` +
        `* 🔍 **Track your Appointment Status** (just enter your 4-digit number e.g. **#1042**).\n` +
        `* 🏥 **Discover Accredited Hospitals** & ICU Bed counts.\n` +
        `* 🚨 **24/7 Emergency Helplines** & ambulance dispatch.\n` +
        `* 💳 **Hospital Software Pricing & Demo Booking**.\n\n` +
        `Please select one of the quick options below or tell me what you'd like to do!`,
      intent: 'general_fallback',
      quickReplies: [
        '🩺 Book Doctor',
        '🧪 Lab Tests & Prices',
        '🔍 Track Appointment #',
        '🚨 Emergency Contact',
        '💬 Contact Support'
      ]
    });
  } catch (error) {
    console.error('[chatController] processChatMessage error:', error);
    return res.status(500).json({
      message: 'Failed to process message',
      reply: "I'm having a brief issue retrieving that data. Please try again or select one of the options below.",
      quickReplies: ['Book Appointment', 'Emergency Help', 'Contact Support']
    });
  }
};

// ─── Suggestions Endpoint ───────────────────────────────────────
const getChatSuggestions = async (req, res) => {
  const suggestions = [
    { title: 'Book Doctor Appointment', prompt: 'I want to book an appointment with a doctor', icon: '🩺' },
    { title: 'Track My Booking', prompt: 'Track my appointment status', icon: '🔍' },
    { title: 'Explore Diagnostic Lab Tests', prompt: 'What lab tests and health checkups are available?', icon: '🧪' },
    { title: 'Emergency Helplines', prompt: 'What are the 24/7 emergency contact numbers?', icon: '🚨' },
    { title: 'Hospital Software Pricing', prompt: 'Tell me about hospital management subscription plans', icon: '💳' },
    { title: 'Cancellation & Refunds', prompt: 'How does the cancellation and refund process work?', icon: '🔄' }
  ];

  return res.json({ suggestions });
};

module.exports = {
  processChatMessage,
  getChatSuggestions
};
