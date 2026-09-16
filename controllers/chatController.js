// controllers/chatController.js
const { supabase } = require('../config/supabase');
const { readDB, writeDB } = require('../models');
const { getDailyTimeSlots } = require('../services/schedulerService');
const { sendAppointmentConfirmation } = require('../services/emailService');
const { generateAppointmentInvoice } = require('../services/invoiceService');
const { broadcast } = require('../services/websocketService');

// ─── Helper: generate unique 4-digit appointment number ──────
const generateAppointmentNumber = async () => {
  let number, exists;
  do {
    number = Math.floor(1000 + Math.random() * 9000);
    exists = false;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id')
          .eq('appointment_number', number)
          .limit(1);
        if (!error && data && data.length > 0) exists = true;
      } catch (e) {
        exists = false;
      }
    }
    if (!exists) {
      const db = readDB();
      exists = (db.appointments || []).some(a => Number(a.appointment_number) === number);
    }
  } while (exists);
  return number;
};

// ─── Default Diagnostic Lab Tests ──────────────────────────────
const POPULAR_LAB_TESTS = [
  { name: 'Complete Blood Count (CBC)', price: 350, fasting: 'Not required', turnaround: 'Same day (4 hrs)', category: 'Hematology' },
  { name: 'Lipid Profile (Cholesterol)', price: 750, fasting: '10-12 hrs fasting required', turnaround: '24 hours', category: 'Biochemistry' },
  { name: 'Thyroid Profile (T3, T4, TSH)', price: 650, fasting: 'Morning sample preferred', turnaround: '24 hours', category: 'Endocrinology' },
  { name: 'HbA1c (Diabetes Glycated Hb)', price: 500, fasting: 'Not required', turnaround: '6 hours', category: 'Diabetes' },
  { name: 'Liver Function Test (LFT)', price: 800, fasting: '8-10 hrs fasting required', turnaround: '12 hours', category: 'Biochemistry' },
  { name: 'Kidney Function Test (KFT/RFT)', price: 750, fasting: 'Not required', turnaround: '12 hours', category: 'Biochemistry' },
  { name: 'Digital Chest X-Ray (PA View)', price: 450, fasting: 'Not required', turnaround: '1 hour', category: 'Radiology' },
  { name: '12-Lead Electrocardiogram (ECG)', price: 400, fasting: 'Not required', turnaround: 'Instant', category: 'Cardiology' },
  { name: 'Vitamin D3 & B12 Total Package', price: 1200, fasting: 'Not required', turnaround: '24 hours', category: 'Immunology' },
  { name: 'Urine Routine & Microscopy (R/M)', price: 200, fasting: 'Fresh morning sample', turnaround: '2 hours', category: 'Clinical Pathology' }
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

// ─── Comprehensive Knowledge Base & Text Question-Answer Database ───
const KNOWLEDGE_FAQS = [
  {
    id: 'how_to_book',
    keywords: ['how to book', 'booking step', 'how do i book', 'appointment process', 'how to schedule', 'steps to book', 'book a slot', 'how book works'],
    reply: `🩺 **How to Book an Appointment (Step-by-Step):**\n\n` +
      `1. **Choose Service / Doctor:** Select your preferred medical department (Cardiology, Neurology, Pediatrics, etc.) or diagnostic lab test.\n` +
      `2. **Select Hospital & Date:** Pick an accredited hospital in your city and choose your preferred date on the interactive calendar.\n` +
      `3. **Pick an Available Slot:** Choose an open 30-minute time slot (e.g. 10:00 AM, 11:30 AM, 2:30 PM).\n` +
      `4. **Fill Patient Details:** Enter patient name, 10-digit mobile number, and email.\n` +
      `5. **Instant Payment & Confirmation:** Pay securely via UPI, Card, or Net Banking. You will receive an instant booking confirmation email with your **4-digit appointment number** and PDF invoice!`,
    quickReplies: ['Book Doctor Now', 'Book Lab Test', 'Track My Appointment', 'Explore Hospitals'],
    action: { type: 'open_booking_modal', url: '/dashboard/book-appointment' }
  },
  {
    id: 'documents_to_bring',
    keywords: ['document', 'what to bring', 'what to carry', 'id proof', 'documents needed', 'bring with me', 'paperwork'],
    reply: `📋 **Documents to Bring for Your Appointment:**\n\n` +
      `* 🆔 **Valid Photo ID:** Aadhar Card, PAN Card, Voter ID, Driving License, or Passport.\n` +
      `* 📄 **Previous Medical Records:** Prior test reports, discharge summaries, doctor prescriptions, or scan films (X-Ray/MRI).\n` +
      `* 💊 **Current Medication List:** Names and dosages of all medicines you are currently taking.\n` +
      `* 💳 **Insurance / Mediclaim Card:** If you plan to claim health insurance or cashless hospitalization.\n` +
      `* 🎟️ **Appointment Confirmation:** Digital SMS / Email receipt or your 4-digit appointment number (e.g. \`#1042\`).`,
    quickReplies: ['Book Appointment', 'Track My Booking', 'Insurance & TPA Info', 'Contact Helpdesk']
  },
  {
    id: 'fasting_guidelines',
    keywords: ['fasting', 'fast', 'fasting for test', 'fast before', 'need to fast', 'empty stomach', 'water before test', 'food before blood test', 'can i eat before', 'fasting requirement'],
    reply: `🧪 **Fasting Guidelines for Diagnostic Lab Tests:**\n\n` +
      `* **Tests Requiring 10–12 Hours Fasting:**\n` +
      `  * *Lipid Profile (Cholesterol, Triglycerides)*\n` +
      `  * *Fasting Blood Glucose (Sugar)*\n` +
      `* **Tests Requiring 8–10 Hours Fasting:**\n` +
      `  * *Liver Function Test (LFT)*\n` +
      `  * *Ultrasound Abdomen & Pelvis*\n` +
      `* **Tests NOT Requiring Fasting (Can be done anytime):**\n` +
      `  * *Complete Blood Count (CBC)*\n` +
      `  * *Thyroid Profile (T3, T4, TSH)* — Morning sample preferred.\n` +
      `  * *HbA1c (Glycated Hemoglobin)*\n` +
      `  * *Kidney Function Test (KFT/RFT)*\n` +
      `  * *ECG & Chest X-Ray*\n\n` +
      `💧 *Tip: Plain drinking water is allowed and recommended before blood collection to prevent dehydration.*`,
    quickReplies: ['Book Blood Test', 'View All Lab Tests', 'Book Doctor Consult', 'Report Turnaround Time']
  },
  {
    id: 'report_turnaround',
    keywords: ['report time', 'when will report come', 'how to get report', 'download report', 'test result time', 'turnaround', 'when report ready'],
    reply: `📄 **Diagnostic Test Results & Delivery Timelines:**\n\n` +
      `* **Routine Blood & Urine Tests (CBC, Glucose, Urine R/M):** Ready within **3–5 hours**.\n` +
      `* **Biochemistry & Hormone Panels (Thyroid, Lipid, LFT, KFT):** Ready within **12–24 hours**.\n` +
      `* **Imaging & Radiology (Digital X-Ray, ECG):** Reports ready within **30–60 minutes**.\n` +
      `* **Specialized Pathology (Biopsy, Culture, Vitamin D3):** Ready within **48–72 hours**.\n\n` +
      `📲 **How You Receive Reports:** Verified digital reports with QR signatures are automatically emailed to your inbox and accessible directly on your [My Appointments](/dashboard/my-appointments) portal.`,
    quickReplies: ['View My Appointments', 'Book Lab Test', 'Track Appointment Status', 'Contact Lab Desk']
  },
  {
    id: 'visiting_hours',
    keywords: ['visiting hour', 'visit patient', 'meeting time', 'inpatient timing', 'visitor rule', 'attendant pass', 'when can i visit'],
    reply: `🕒 **Hospital Visiting Hours & Visitor Guidelines:**\n\n` +
      `* **General & Semi-Private Wards:**\n` +
      `  * 🌅 *Morning Session:* **10:00 AM – 12:00 PM**\n` +
      `  * 🌆 *Evening Session:* **5:00 PM – 7:30 PM**\n` +
      `* **Intensive Care Units (ICU / CCU / NICU):**\n` +
      `  * ⏰ *Restricted Hours:* **4:30 PM – 5:30 PM** (Only 1 immediate family member allowed at a time with sterile gown/mask).\n` +
      `* **Attendant Guidelines:** Only 1 primary attendant is permitted to stay 24/7 with the patient in private and semi-private rooms with a valid hospital attendant pass.`,
    quickReplies: ['Check Bed Availability', 'Hospital Address', 'Emergency Hotline', 'Talk to Reception']
  },
  {
    id: 'late_arrival',
    keywords: ['late', 'arrive late', 'running late', 'delayed', 'miss appointment', 'what if late'],
    reply: `⏰ **Late Arrival & Delay Policy:**\n\n` +
      `* **15-Minute Grace Period:** If you are running up to 15 minutes late, your appointment slot is maintained, though there may be a short wait.\n` +
      `* **Rescheduling On The Go:** If delayed significantly, you can easily reschedule to a later time slot on the same day or a future date directly from [My Appointments](/dashboard/my-appointments) at **no additional cost**.\n` +
      `* 📞 You can also call the hospital reception to notify the OPD coordinator so the doctor can accommodate your queue.`,
    quickReplies: ['View My Appointments', 'Reschedule Slot', 'Call Reception', 'Book New Appointment']
  },
  {
    id: 'book_for_others',
    keywords: ['someone else', 'family member', 'my child', 'my parent', 'book for other', 'book for another', 'friend', 'pet'],
    reply: `👥 **Booking for Family Members, Friends, or Pets:**\n\n` +
      `**Yes, absolutely!** You can book consultations and diagnostic tests for anyone using your account:\n\n` +
      `1. Open the booking form.\n` +
      `2. Simply enter the **Patient's Name** (human or pet name), Age, Gender, and Medical Details.\n` +
      `3. You can provide either your contact number or the patient's mobile number for SMS/WhatsApp reminders.\n` +
      `4. Invoices and booking confirmation are issued in the patient's name.`,
    quickReplies: ['Book For Family Member', 'Book Pediatrician', 'Explore Hospitals', 'Track Appointment']
  },
  {
    id: 'insurance_tpa',
    keywords: ['insurance', 'mediclaim', 'tpa', 'cashless', 'ayushman', 'star health', 'hdfc ergo', 'claim insurance', 'reimbursement', 'health card'],
    reply: `🏥 **Health Insurance, Mediclaim & Cashless TPA Support:**\n\n` +
      `MEDPARK accredited hospitals partner with major public and private insurance providers:\n\n` +
      `* 🛡️ **Empaneled Insurers:** Star Health, HDFC ERGO, ICICI Lombard, Care Health, Max Bupa / Niva Bupa, Bajaj Allianz, New India Assurance, and Ayushman Bharat (PM-JAY).\n` +
      `* 📑 **Cashless Hospitalization:** For planned surgeries or IPD admissions, visit the hospital **TPA / Insurance Desk** with your policy card, Aadhar, and doctor's admission advice.\n` +
      `* 🧾 **OPD Reimbursement:** Download your GST-compliant digital invoice directly from our portal to file quick OPD reimbursement claims.`,
    quickReplies: ['Download Invoice PDF', 'Explore Hospitals', 'Check Bed Availability', 'Contact TPA Desk']
  },
  {
    id: 'payment_methods',
    keywords: ['payment method', 'how to pay', 'payment mode', 'payment option', 'upi', 'credit card', 'debit card', 'cash', 'net banking', 'gpay', 'phonepe'],
    reply: `💳 **Accepted Payment Methods:**\n\n` +
      `We support secure, 256-bit encrypted payments across multiple channels:\n\n` +
      `* 📱 **UPI / QR Code:** Google Pay, PhonePe, Paytm, BHIM, Amazon Pay.\n` +
      `* 💳 **Credit & Debit Cards:** Visa, MasterCard, RuPay, Maestro, American Express.\n` +
      `* 🏦 **Net Banking:** Supported across all major Indian & international banks.\n` +
      `* 💵 **Hospital Front Desk:** Cash, POS swipe machines, and draft payments accepted at hospital billing counters.`,
    quickReplies: ['Book Appointment', 'Check Pricing Plans', 'Refund Policy', 'Download Invoice']
  },
  {
    id: 'consultation_fees',
    keywords: ['consultation fee', 'doctor fee', 'how much doctor charge', 'opd fee', 'cost of consultation', 'doctor price', 'fees'],
    reply: `💰 **Doctor Consultation Fee Structure:**\n\n` +
      `* 🩺 **General Physician / Family Medicine:** ₹400 – ₹500\n` +
      `* 👶 **Pediatrician / Child Specialist:** ₹500 – ₹700\n` +
      `* 🦴 **Orthopedic / Bone Specialist:** ₹700 – ₹900\n` +
      `* ❤️ **Cardiologist / Heart Specialist:** ₹800 – ₹1,200\n` +
      `* 🧠 **Neurologist / Neurosurgeon:** ₹1,000 – ₹1,500\n` +
      `* 🌸 **Gynecologist & Obstetrician:** ₹600 – ₹900\n\n` +
      `💡 *Includes a free 7-day follow-up consultation and digital e-prescription.*`,
    quickReplies: ['Book Specialist Doctor', 'Lab Test Packages', 'Explore Hospitals', 'Track Booking']
  },
  {
    id: 'teleconsultation_info',
    keywords: ['teleconsult', 'video call', 'online consult', 'telemedicine', 'consult online', 'virtual doctor', 'zoom consult'],
    reply: `💻 **Online Video Teleconsultations:**\n\n` +
      `Consult certified senior doctors from the comfort of your home:\n\n` +
      `* 🎥 High-definition secure video call via Zoom or WebRTC.\n` +
      `* 📄 Digital prescription sent directly to your email immediately after the session.\n` +
      `* ⏰ Timings: Available 7 days a week from 8:00 AM to 10:00 PM.\n` +
      `* 📲 You can join the video consult with 1 tap from your [My Appointments](/dashboard/my-appointments) portal.`,
    quickReplies: ['Book Video Consult', 'Explore Specialties', 'Track Appointment', 'Contact Support']
  },
  {
    id: 'hospital_registration',
    keywords: ['register hospital', 'partner hospital', 'onboard clinic', 'hospital software register', 'join network', 'add my hospital'],
    reply: `🏥 **Partnering & Registering Your Hospital with MEDPARK:**\n\n` +
      `Hospital owners and clinic directors can join the MEDPARK ecosystem in 3 simple steps:\n\n` +
      `1. 📅 **Schedule a Product Demo:** Book a free 30-minute walkthrough on our [Live Demo Page](/schedule).\n` +
      `2. 💳 **Choose a Software Tier:** Select between Quarterly, Yearly, or Enterprise cloud suites.\n` +
      `3. 📝 **Complete Registration:** Submit hospital license, bed count, and administrator contact.\n` +
      `4. 🚀 **Go-Live:** Our superadmin team reviews and activates your dedicated hospital admin portal within **24 hours**!`,
    quickReplies: ['Book Live Demo', 'View Software Pricing', 'Contact Enterprise Sales', 'Explore Portal']
  },
  {
    id: 'data_security_hipaa',
    keywords: ['data security', 'privacy', 'is my data safe', 'hipaa', 'gdpr', 'secure records', 'confidentiality', 'data protection'],
    reply: `🔒 **Data Privacy, Security & Compliance:**\n\n` +
      `Your personal health information (PHI) and clinical records are protected with industry-grade security:\n\n` +
      `* 🛡️ **256-Bit SSL/TLS Encryption:** All database records, payments, and communication channels are encrypted in transit and at rest.\n` +
      `* 🔐 **Role-Based Access Control (RBAC):** Superadmins, Hospital Admins, and Patients only access authorized medical records.\n` +
      `* ☁️ **Cloud Redundancy:** Automatic daily encrypted backups preventing data loss.\n` +
      `* 📜 Compliant with international healthcare privacy benchmarks.`,
    quickReplies: ['Privacy Policy', 'Book Appointment', 'Hospital Pricing', 'Contact Security Team']
  },
  {
    id: 'vaccination_immunization',
    keywords: ['vaccination', 'vaccine', 'immunization', 'polio', 'bcg', 'mmr', 'flu shot', 'tetanus', 'hepatitis b', 'child vaccine', 'pediatric immunization', 'baby injection'],
    reply: `💉 **Vaccination & Immunization Services:**\n\n` +
      `MEDPARK partner hospitals offer complete WHO and IAP-certified vaccination schedules for infants, children, and adults:\n\n` +
      `* 👶 **Newborn & Infant Schedule:** BCG, Hepatitis B, Oral Polio (OPV/IPV), Pentavalent, Rotavirus, PCV.\n` +
      `* 🧒 **Childhood Boosters:** DTP, MMR (Measles, Mumps, Rubella), Varicella (Chickenpox), Typhoid, Hepatitis A.\n` +
      `* 🧑 **Adult & Special Vaccines:** Annual Influenza (Flu Shot), Cervical Cancer (HPV), Tetanus Toxoid (TT), Pneumococcal vaccine for seniors.\n\n` +
      `📅 *All immunizations include an official digital vaccination passport and SMS reminders for upcoming booster dates.*`,
    quickReplies: ['Book Pediatrician', 'Book Lab Tests', 'Consult General Physician', 'Track Appointment']
  },
  {
    id: 'health_checkup_packages',
    keywords: ['health checkup', 'master checkup', 'full body checkup', 'executive health', 'annual checkup', 'wellness package', 'preventive checkup', 'body package'],
    reply: `🩺 **Full Body Preventive Health Checkup Packages:**\n\n` +
      `Catch health issues early with our comprehensive diagnostic wellness screenings:\n\n` +
      `1. 🌿 **Basic Health Wellness (₹1,499):** CBC, Blood Sugar (Fasting), Lipid Profile, Urine R/M, Serum Creatinine & Physician Consultation.\n` +
      `2. 💎 **Executive Master Health Check (₹3,499):** Basic + Liver Function (LFT), Thyroid (TSH), 12-Lead ECG, Digital Chest X-Ray & Ultrasound Abdomen.\n` +
      `3. ❤️ **Advanced Cardiac & Diabetic Care (₹5,999):** Executive + 2D Echo / TMT Treadmill Test, HbA1c, Vitamin D3 & B12, and Senior Cardiologist Review.\n\n` +
      `💡 *Complimentary breakfast and comprehensive summary report provided on the same day.*`,
    quickReplies: ['Book Full Body Checkup', 'Book Blood Test', 'Consult Cardiologist', 'Explore Lab Tests']
  },
  {
    id: 'maternity_pregnancy_care',
    keywords: ['maternity', 'pregnancy', 'delivery package', 'normal delivery', 'c-section', 'cesarean', 'antenatal', 'labor room', 'obstetrics', 'baby delivery'],
    reply: `🌸 **Maternity Care, Antenatal & Delivery Packages:**\n\n` +
      `We provide compassionate mother & child care with 24/7 dedicated Obstetricians and Level-3 NICU:\n\n` +
      `* 🤰 **Antenatal Care:** Trimester ultrasound scans (NT Scan, Anomaly Scan, Color Doppler), blood screening & prenatal yoga guidance.\n` +
      `* 👶 **Normal Delivery Package:** Includes labor suite, pediatrician newborn assessment, nursing care & 2-day private room stay.\n` +
      `* 🏥 **LSCS / C-Section Package:** Includes modern modular OT, anesthetist, surgeon team, medications & 4-day private room stay.\n` +
      `* 🍼 **Newborn Support:** 24/7 Neonatal Intensive Care Unit (NICU), initial immunizations, lactation counseling & birth certificate facilitation.`,
    quickReplies: ['Book Gynecologist', 'Check Bed Availability', 'Explore Hospitals', 'Download Hospital Brochure']
  },
  {
    id: 'physiotherapy_rehab',
    keywords: ['physiotherapy', 'physio', 'rehab', 'back pain', 'knee pain', 'neck pain', 'stroke rehab', 'paralysis therapy', 'sports injury rehab', 'frozen shoulder'],
    reply: `🏃 **Physiotherapy & Physical Rehabilitation:**\n\n` +
      `Our certified physiotherapists provide tailored recovery protocols for pain relief and functional restoration:\n\n` +
      `* 🦴 **Orthopedic & Spine Care:** Sciatica, slip disc, cervical spondylosis, osteoarthritis knee, frozen shoulder & post-fracture mobility.\n` +
      `* 🧠 **Neuro-Rehabilitation:** Post-stroke hemiplegia therapy, Parkinson's gait training & spinal cord rehabilitation.\n` +
      `* ⚡ **Advanced Modalities:** Ultrasound therapy, IFT (Interferential Therapy), TENS, Traction & Laser pain therapy.\n` +
      `* 🏡 **Home Physiotherapy:** Experienced therapists available for home care sessions for elderly and bedridden patients.`,
    quickReplies: ['Book Orthopedic Consult', 'Book Physiotherapy', 'Explore Specialties', 'Track Booking']
  },
  {
    id: 'post_op_wound_care',
    keywords: ['post op', 'after surgery', 'wound care', 'stitches', 'surgical recovery', 'dressing change', 'surgery recovery', 'cut wound'],
    reply: `🩹 **Post-Operative Surgery Recovery & Wound Care Guidelines:**\n\n` +
      `* 🚿 **Keep Dressing Clean & Dry:** Do not wet the surgical wound until your surgeon gives clearance. Take sponge baths instead.\n` +
      `* 🧼 **Hand Hygiene:** Always wash hands with antibacterial soap for 20 seconds before touching or inspecting the dressing area.\n` +
      `* 💊 **Medication Adherence:** Complete full prescribed antibiotic courses on time and do not skip prescribed pain relievers.\n` +
      `* ⚠️ **Warning Signs — Contact Hospital Immediately If You Notice:**\n` +
      `  * *Fever above 101°F or chills.*\n` +
      `  * *Increased redness, swelling, warmth, or foul-smelling drainage/pus from incision.*\n` +
      `  * *Sudden severe pain not relieved by medication.*\n` +
      `  * *Persistent nausea, vomiting, or shortness of breath.*`,
    quickReplies: ['Emergency Helpline', 'Book Follow-Up Consult', 'Contact Hospital Desk', 'Pharmacy Timings']
  },
  {
    id: 'diabetes_hypoglycemia_care',
    keywords: ['diabetes management', 'low sugar', 'hypoglycemia', 'insulin storage', 'sugar drop', 'shivering sugar', 'how to store insulin', 'diabetic emergency'],
    reply: `🩸 **Diabetes Care, Low Sugar (Hypoglycemia) & Insulin Protocol:**\n\n` +
      `* ⚠️ **Emergency "Rule of 15" for Low Blood Sugar (Below 70 mg/dL):**\n` +
      `  * *Symptoms:* Shivering, sudden cold sweating, dizziness, rapid heartbeat, extreme hunger, confusion.\n` +
      `  * *Step 1:* Immediately consume **15 grams of fast-acting carbohydrate** (3 teaspoons of sugar, 1/2 cup fruit juice, or 4 glucose tablets).\n` +
      `  * *Step 2:* Wait **15 minutes** and re-check blood glucose.\n` +
      `  * *Step 3:* If still below 70 mg/dL, repeat with another 15g of sugar. Once normal, eat a small meal/snack.\n\n` +
      `* ❄️ **Insulin Storage Guidelines:**\n` +
      `  * Store unopened insulin vials and pens in the refrigerator at **2°C – 8°C** (do not freeze).\n` +
      `  * In-use insulin pen/vial can be kept at room temperature (below 25°C) away from direct sunlight for up to **28 days**.`,
    quickReplies: ['Book HbA1c Diabetes Test', 'Consult Diabetologist', 'Diet Plan Consult', 'Emergency Helpline']
  },
  {
    id: 'high_bp_hypertension_care',
    keywords: ['high bp', 'hypertension', 'high blood pressure', 'bp emergency', 'bp 180', 'severe headache bp', 'hypertensive crisis'],
    reply: `❤️ **High Blood Pressure (Hypertension) Management:**\n\n` +
      `* 📊 **Understanding BP Readings:**\n` +
      `  * *Normal:* Less than 120/80 mmHg\n` +
      `  * *Stage 1 Hypertension:* 130–139 / 80–89 mmHg\n` +
      `  * *Stage 2 Hypertension:* 140+ / 90+ mmHg\n\n` +
      `* 🚨 **Hypertensive Crisis (BP > 180/120 mmHg):**\n` +
      `  * If your BP reading is **180/120 mmHg or higher**, rest calmly for 5 minutes and re-test.\n` +
      `  * **If accompanied by:** Chest pain, severe headache, blurred vision, numbness, or difficulty speaking — **Seek immediate emergency casualty medical care.**`,
    quickReplies: ['Book Cardiologist', 'Emergency Helpline (1800-419-1234)', 'Book Lipid Profile', 'Explore Hospitals']
  },
  {
    id: 'blood_donation_bank',
    keywords: ['blood donation', 'donate blood', 'blood bank', 'plasma', 'blood group', 'o negative blood', 'platelet donor', 'need blood'],
    reply: `🩸 **24/7 Hospital Blood Bank & Blood Donation:**\n\n` +
      `* 🏥 **24/7 Availability:** Our NABL-certified blood bank maintains tested components: Packed Red Blood Cells (PRBC), Fresh Frozen Plasma (FFP), and Single Donor Platelets (SDP).\n` +
      `* 🙋 **Who Can Donate Blood?**\n` +
      `  * Age between **18 and 65 years**.\n` +
      `  * Body weight of **45 kg or above**.\n` +
      `  * Hemoglobin level of at least **12.5 g/dL**.\n` +
      `  * No alcohol consumption in the last 24 hours.\n` +
      `* ⏱️ Donation takes only 10–15 minutes and can save up to 3 lives!`,
    quickReplies: ['Blood Bank Helpline', 'Book Blood Test', 'Emergency Hotline', 'Hospital Locations']
  },
  {
    id: 'hospital_admission_ipd',
    keywords: ['hospital admission', 'admit patient', 'ipd process', 'admission procedure', 'bed booking', 'planned admission', 'emergency admission', 'room categories'],
    reply: `🛏️ **Hospital Admission (IPD) Procedure:**\n\n` +
      `* 📝 **Planned Admission:**\n` +
      `  1. Present the Doctor's Admission Slip at the central **IPD Admission Desk**.\n` +
      `  2. Choose room type (General Ward, Semi-Private, Deluxe Single Room, Suite).\n` +
      `  3. Submit Photo ID (Aadhar/Passport) and Insurance TPA card for cashless approval.\n` +
      `* 🚨 **Emergency Admission:** Immediate clinical stabilization in Casualty/ER triage first; administrative admission paperwork is completed subsequently by hospital counselors.\n` +
      `* 🛡️ All inpatient rooms feature nurse call bells, central medical oxygen, and HEPA air filtration.`,
    quickReplies: ['Check Bed Availability', 'Insurance & TPA Info', 'Explore Hospitals', 'Emergency Helpline']
  },
  {
    id: 'hospital_discharge_process',
    keywords: ['discharge process', 'discharge timing', 'when can patient go home', 'discharge summary', 'tpa discharge approval', 'discharge settlement', 'leave hospital'],
    reply: `🏁 **Hospital Discharge Process & Timeline:**\n\n` +
      `* 🌅 **Morning Rounds:** Treating consultant reviews patient vitals and signs the official medical discharge order (usually between 9:00 AM – 11:00 AM).\n` +
      `* 📄 **Discharge Summary & Prescription:** Resident doctors prepare detailed summary of diagnosis, procedures performed, diet advice, and medication schedule.\n` +
      `* 🛡️ **Cashless Insurance TPA Clearance:** Final bill and summary are submitted electronically to TPA. Final approval typically takes **2 to 3 hours**.\n` +
      `* 💊 **Pharmacy & Final Settlement:** Home medications are dispensed, remaining security deposit refunded, and attendant receives the stamped discharge file.`,
    quickReplies: ['Download Discharge Summary', 'My Appointments', 'Insurance Desk Info', 'Contact Helpdesk']
  },
  {
    id: 'senior_citizen_geriatric',
    keywords: ['senior citizen', 'elderly care', 'geriatric', 'old age patient', 'wheelchair assistance', 'priority queue', 'elderly discount'],
    reply: `👴 **Senior Citizen & Geriatric Care Services:**\n\n` +
      `We offer dedicated convenience and care protocols for our elderly patients:\n\n` +
      `* ♿ **Free Wheelchair & Stretcher Assistance:** Trained patient helpers available right at the hospital main entrance/porch.\n` +
      `* ⚡ **Priority OPD & Billing Counters:** Fast-tracked registration, consultation, and pharmacy queues for seniors (60+ years).\n` +
      `* 🏠 **Home Sample Collection:** Phlebotomists visit your home for blood and urine sample collections.\n` +
      `* 🩺 **Comprehensive Geriatric Screening:** Memory & cognitive evaluation, fall prevention, joint mobility, and bone mineral density (DEXA) tests.`,
    quickReplies: ['Book Home Sample Collection', 'Book Geriatric Specialist', 'Explore Hospitals', 'Contact Reception']
  },
  {
    id: 'home_sample_collection',
    keywords: ['home sample', 'sample collection at home', 'blood test at home', 'doorstep lab test', 'home visit blood test', 'phlebotomy at home'],
    reply: `🏠 **Doorstep Home Diagnostic Sample Collection:**\n\n` +
      `Get blood and urine tests collected safely from the comfort of your home:\n\n` +
      `* 🧤 **Safe & Sterile:** Certified phlebotomists follow 100% sterile vacutainer protocols with single-use barcoded tubes.\n` +
      `* ⏰ **Flexible Morning Slots:** Phlebotomists available from **6:30 AM to 11:30 AM** (ideal for fasting tests like Lipid & Glucose).\n` +
      `* 📱 **Instant Digital Results:** Reports automatically synced and emailed to your portal within 6–24 hours.\n` +
      `* 💰 Standard nominal home visit convenience charge (₹150) or **FREE** on bookings above ₹999.`,
    quickReplies: ['Book Blood Test at Home', 'Explore Lab Packages', 'Track Lab Reports', 'Contact Lab Helpdesk']
  },
  {
    id: 'mental_health_psychology',
    keywords: ['mental health', 'psychiatrist', 'psychologist', 'depression', 'anxiety', 'stress counseling', 'therapy session', 'counselor', 'insomnia', 'panic attack'],
    reply: `🧠 **Mental Health, Psychology & Counseling Services:**\n\n` +
      `We offer compassionate, strictly confidential psychiatric and psychological support:\n\n` +
      `* 🌿 **Areas of Care:** Generalized anxiety, depression, burnout & stress management, sleep disorders (insomnia), OCD, panic attacks, and relationship counseling.\n` +
      `* 🗣️ **Therapy Approaches:** Cognitive Behavioral Therapy (CBT), Mindfulness-Based Therapy & psychotherapeutic counseling.\n` +
      `* 💻 Available via in-person clinic consultations or secure private online video sessions.`,
    quickReplies: ['Book Psychologist Consult', 'Book Video Teleconsult', 'Emergency Mental Health Helpline', 'Specialties']
  },
  {
    id: 'diet_nutrition_counseling',
    keywords: ['dietitian', 'nutritionist', 'diet plan', 'diabetic diet', 'weight loss diet', 'renal diet', 'heart healthy diet', 'food chart'],
    reply: `🥗 **Clinical Dietetics & Nutritional Counseling:**\n\n` +
      `Our clinical nutritionists craft individualized, science-backed dietary plans:\n\n` +
      `* 🩸 **Diabetic Meal Planning:** Low-glycemic index diets, carbohydrate counting & post-meal glucose stabilization.\n` +
      `* ❤️ **Cardiac & Hypertension Diet:** DASH diet, low-sodium meal strategies & cholesterol reduction.\n` +
      `* 🫘 **Renal & Liver Care Diet:** Low-potassium, controlled-protein nutritional charts.\n` +
      `* ⚖️ **Medical Weight Management:** Sustainable calorie deficit plans without crash dieting.`,
    quickReplies: ['Book Nutritionist Consult', 'Book Master Health Checkup', 'Explore Doctors', 'Track Booking']
  },
  {
    id: 'eye_care_cataract',
    keywords: ['cataract', 'lasik', 'eye surgery', 'eye checkup', 'vision test', 'glaucoma', 'ophthalmology service', 'spectacles power', 'eye doctor'],
    reply: `👁️ **Eye Care, Cataract & Ophthalmology Services:**\n\n` +
      `* 🌟 **Daycare Cataract Surgery (Phaco):** Stitchless, micro-incision phacoemulsification with premium Monofocal, Toric & Multifocal intraocular lenses (IOLs). Return home the same day!\n` +
      `* 👓 **Refractive Suite & LASIK:** Advanced laser vision correction for spectacle-free clear vision.\n` +
      `* 🔬 **Glaucoma & Retina Care:** Optical Coherence Tomography (OCT), fundus photography & diabetic retinopathy laser management.\n` +
      `* 💻 **Computer Vision Syndrome:** Ergonomic and blue-light eye strain evaluations for professionals.`,
    quickReplies: ['Book Ophthalmologist', 'Explore Specialties', 'Hospital Bed Availability', 'Track Appointment']
  },
  {
    id: 'dental_services_ortho',
    keywords: ['dental', 'dentist', 'root canal', 'rct', 'teeth cleaning', 'dental implant', 'braces', 'toothache', 'dental scaling', 'cavity'],
    reply: `🦷 **Comprehensive Dental & Maxillofacial Care:**\n\n` +
      `* ⚡ **Single-Sitting Root Canal (RCT):** Painless motorized endodontic treatment with digital apex locators.\n` +
      `* 💎 **Dental Implants & Crowns:** Permanent titanium implants, zirconia crowns & bridge replacements.\n` +
      `* 🪥 **Preventive Cleaning & Polishing:** Ultrasonic scaling for plaque and stain removal.\n` +
      `* 😬 **Orthodontics & Clear Aligners:** Invisible aligners and metal/ceramic braces for teeth straightening.`,
    quickReplies: ['Book Dentist Consult', 'Explore Specialties', 'Emergency Toothache Help', 'Track Booking']
  },
  {
    id: 'prescription_refills',
    keywords: ['prescription validity', 'refill medicine', 'repeat prescription', 'how long prescription valid', 'follow up consultation', 'doctor prescription'],
    reply: `📋 **Prescription Validity & Medicine Refill Guidelines:**\n\n` +
      `* ⏳ **Prescription Validity:**\n` +
      `  * *Acute Illnesses (Fever, Infections, Cough):* Valid for **7 to 14 days**.\n` +
      `  * *Chronic Maintenance (Hypertension, Thyroid, Diabetes):* Valid for up to **6 months** before routine review.\n` +
      `* 🆓 **7-Day Free Follow-Up:** Most OPD consultations include a complimentary follow-up within 7 days to review lab results and adjust dosages.\n` +
      `* 📲 You can download all your verified e-prescriptions anytime from [My Appointments](/dashboard/my-appointments).`,
    quickReplies: ['View My Appointments', 'Book Doctor Consult', '24/7 Pharmacy', 'Contact Doctor']
  },
  {
    id: 'hospital_amenities_parking',
    keywords: ['parking', 'cafeteria', 'food court', 'hospital amenities', 'wifi', 'guest house', 'stay for attendants', 'facilities'],
    reply: `🏢 **Hospital Facilities, Parking & Campus Amenities:**\n\n` +
      `* 🚗 **Valet & Multi-Level Parking:** Dedicated covered 24/7 parking with electric vehicle (EV) charging stations.\n` +
      `* 🍽️ **Hygienic Cafeteria & Food Court:** Clean, nutritious multi-cuisine meals, fresh juices, and special patient diet trays.\n` +
      `* 📶 **Free High-Speed Wi-Fi:** Seamless internet across all OPD waiting lounges and IPD rooms.\n` +
      `* 🏧 **Banking & ATMs:** 24/7 ATM counters located at the ground floor lobby.\n` +
      `* 🛌 **Attendant Accommodations:** Hospital guest rooms and partner lodging available for outstation patient families.`,
    quickReplies: ['Hospital Locations', 'Check Bed Availability', 'Emergency Helplines', 'Contact Helpdesk']
  },
  {
    id: 'second_opinion_tumor',
    keywords: ['second opinion', 'doctor second opinion', 'tumor board', 'cancer opinion', 'surgery second opinion', 'medical second opinion'],
    reply: `📑 **Expert Second Medical Opinion & Tumor Board Review:**\n\n` +
      `Make confident healthcare decisions with our multidisciplinary clinical review boards:\n\n` +
      `* 👨‍⚕️ **Senior Specialist Panel:** Have your medical case reviewed by department heads and academic leaders in Oncology, Cardiology, Orthopedics, and Neurology.\n` +
      `* 🔬 **Biopsy & Radiology Re-Evaluation:** Our pathology and radiology experts cross-verify MRI/CT scans and biopsy slide blocks.\n` +
      `* 🌐 **Online or In-Person:** Submit your previous medical records digitally and receive a formal second opinion consensus report within **48 hours**.`,
    quickReplies: ['Book Specialist Doctor', 'Upload Medical Records', 'Explore Specialties', 'Contact Care Coordinator']
  },
  {
    id: 'child_fever_choking_firstaid',
    keywords: ['child choking', 'baby fever', 'infant emergency', 'febrile seizure', 'child first aid', 'baby temperature', 'pediatric emergency'],
    reply: `👶 **Pediatric First Aid: Infant Fever & Choking Emergencies**\n\n` +
      `* 🌡️ **Infant High Fever (Above 100.4°F in babies under 3 months or >102°F in children):**\n` +
      `  * Remove excess blankets/clothing to prevent heat entrapment.\n` +
      `  * Sponge body with **lukewarm water** (never use cold/ice water or rubbing alcohol).\n` +
      `  * Ensure frequent hydration (breastmilk, formula, or water/ORS for older kids).\n` +
      `  * Consult a pediatrician promptly before administering over-the-counter fever syrups.\n\n` +
      `* 🚨 **Child Choking Emergency (Cannot breathe, cough, or cry):**\n` +
      `  * **Infant (< 1 yr):** Lay baby face down along your forearm supporting jaw; give **5 firm back blows** between shoulder blades. If still blocked, turn over and give **5 chest thrusts** using 2 fingers.\n` +
      `  * **Older Child (> 1 yr):** Perform the Heimlich maneuver (abdominal thrusts) just above navel.\n` +
      `  * **Call Emergency (108 / 112) immediately!**`,
    quickReplies: ['🚨 Emergency Hotline (1800-419-1234)', 'Book Pediatrician', 'Nearest Hospital', 'Casualty Desk']
  },
  {
    id: 'allergy_anaphylaxis_firstaid',
    keywords: ['allergy', 'allergic reaction', 'anaphylaxis', 'swollen lips', 'hives', 'food allergy', 'drug allergy', 'bee sting'],
    reply: `⚠️ **Allergy & Severe Anaphylaxis Emergency First Aid:**\n\n` +
      `* 🚨 **Signs of Severe Allergic Reaction (Anaphylaxis):**\n` +
      `  * *Swelling of lips, tongue, face, or throat throat tightness.*\n` +
      `  * *Difficulty breathing, wheezing, or stridor.*\n` +
      `  * *Widespread itchy red hives, dizziness, fainting, or rapid pulse drop.*\n\n` +
      `* 🚑 **Immediate Actions:**\n` +
      `  1. **Call 108 / 112 or MEDPARK Emergency (+91-1800-419-1234) immediately.**\n` +
      `  2. If the patient carries an **EpiPen (auto-injector adrenaline)**, administer it immediately into the outer mid-thigh.\n` +
      `  3. Have the person lie flat with legs elevated. If breathing is difficult, keep them seated upright. Do not offer oral fluids.`,
    quickReplies: ['🚨 Call Ambulance Now', 'Nearest Casualty Hospital', 'Book Dermatologist', 'Emergency Helpline']
  },
  {
    id: 'abha_digital_health_card',
    keywords: ['abha', 'abha card', 'abdm', 'digital health locker', 'ayushman health id', 'link abha', 'health account'],
    reply: `🆔 **ABHA (Ayushman Bharat Health Account) Digital Integration:**\n\n` +
      `MEDPARK is fully integrated with India's Ayushman Bharat Digital Mission (ABDM):\n\n` +
      `* 🌟 **What is ABHA?** A unique 14-digit digital health ID that lets you digitally access, store, and share your diagnostic reports, prescriptions, and discharge summaries across India.\n` +
      `* 🔒 **100% Consent-Driven:** Medical records are only shared with your explicit digital OTP consent.\n` +
      `* 📲 You can link your ABHA card in [My Profile](/profile) to automatically sync all past hospital records!`,
    quickReplies: ['Go to My Profile', 'Book Doctor Appointment', 'Explore Hospital Portal', 'Contact Support']
  },
  {
    id: 'fever_first_aid',
    keywords: ['fever', 'high fever', 'temperature', 'fever treatment', 'first aid fever', 'fever remedy'],
    reply: `🌡️ **Medical Guidance for Fever:**\n\n` +
      `* 💧 **Hydration:** Drink plenty of fluids (water, ORS, clear soups, coconut water).\n` +
      `* 🛌 **Rest:** Rest in a well-ventilated, comfortable room.\n` +
      `* 🧊 **Cool Compresses:** Apply a cool, damp washcloth to forehead, neck, or wrists to help lower body heat.\n` +
      `* ⚠️ **When to Seek Immediate Medical Help:**\n` +
      `  * Temperature above **103°F (39.4°C)** or fever persisting for more than 48 hours.\n` +
      `  * Accompanied by severe headache, stiff neck, breathing difficulty, or rash.\n` +
      `  * For infants under 3 months with temperature over 100.4°F.`,
    quickReplies: ['Book General Physician', 'Book Pediatrician', 'Emergency Helpline', 'Lab Blood Tests']
  },
  {
    id: 'chest_pain_emergency',
    keywords: ['chest pain', 'heart attack', 'cardiac emergency', 'angina', 'left arm pain', 'breathless'],
    reply: `🚨 **CRITICAL HEALTH WARNING: Chest Pain & Cardiac Symptoms**\n\n` +
      `If you or someone nearby is experiencing:\n` +
      `* *Pressure, tightness, crushing pain in chest or center of chest*\n` +
      `* *Pain spreading to left shoulder, arm, neck, jaw, or back*\n` +
      `* *Sudden cold sweat, dizziness, nausea, or shortness of breath*\n\n` +
      `⚠️ **DO NOT WAIT — CALL EMERGENCY IMMEDIATELY:**\n` +
      `* 🚑 **National Ambulance:** **108** / **112**\n` +
      `* 🏥 **MEDPARK Cardiac Emergency Hotline:** **+91-1800-419-1234**\n` +
      `* Keep the patient seated upright, loosen tight clothing, and avoid sudden physical exertion.`,
    quickReplies: ['🚨 Call Ambulance (108)', 'Nearest Cardiac Hospital', 'Casualty Helpline', 'Cardiologist On Call'],
    action: { type: 'emergency_call', phone: '18004191234' }
  },
  {
    id: 'blood_pressure_sugar_normal',
    keywords: ['normal blood pressure', 'normal sugar', 'bp range', 'sugar range', 'normal glucose', 'hypertension range', 'diabetes range'],
    reply: `📊 **Standard Reference Ranges for BP & Blood Glucose:**\n\n` +
      `* ❤️ **Blood Pressure (Adults):**\n` +
      `  * *Normal:* Less than **120 / 80 mmHg**\n` +
      `  * *Elevated:* 120–129 / <80 mmHg\n` +
      `  * *Stage 1 Hypertension:* 130–139 / 80–89 mmHg\n` +
      `  * *Stage 2 Hypertension:* 140+ / 90+ mmHg\n\n` +
      `* 🩸 **Blood Glucose (Sugar):**\n` +
      `  * *Fasting (8-10 hrs):* **70 – 99 mg/dL** (Normal) | 100–125 mg/dL (Pre-diabetes) | 126+ mg/dL (Diabetes)\n` +
      `  * *Post-Prandial (2 hrs after meal):* Less than **140 mg/dL**\n` +
      `  * *HbA1c (3-Month Average):* Below **5.7%** (Normal) | 5.7%–6.4% (Pre-diabetes) | 6.5%+ (Diabetes)`,
    quickReplies: ['Book HbA1c Diabetes Test', 'Book Lipid Profile', 'Consult Cardiologist', 'Book Full Body Checkup']
  },
  {
    id: 'pharmacy_timing',
    keywords: ['pharmacy', 'chemist', 'medicine', 'drug store', 'pharmacy timing', 'medicine shop', 'medical store'],
    reply: `💊 **24/7 Hospital Pharmacy Services:**\n\n` +
      `* 🏪 **Timings:** All in-hospital pharmacies operate **24 Hours a Day, 7 Days a Week**.\n` +
      `* 📦 **Availability:** 100% genuine prescribed drugs, emergency cardiac medications, pediatric drops, orthopedic supports, and surgical consumables.\n` +
      `* 🧾 Digital prescription integration available directly from your doctor consultation.`,
    quickReplies: ['Find Nearest Hospital', 'Book Doctor Consult', 'Emergency Helplines', 'Contact Support']
  },
  {
    id: 'change_password_profile',
    keywords: ['change password', 'edit profile', 'update profile', 'change phone', 'change email', 'update address', 'my account settings'],
    reply: `⚙️ **Updating Your Profile & Changing Password:**\n\n` +
      `1. Click on your **Profile Avatar / Pill** in the top navigation bar.\n` +
      `2. Select **My Profile & Settings** (or go to [/profile](/profile)).\n` +
      `3. **To update details:** Edit your Name, Mobile, Address, Blood Group, or Emergency Contact and click *Save Changes*.\n` +
      `4. **To change password:** Scroll to the *Security & Password* section, enter your current password, choose a new password (min 6 characters), and click *Update Password*.`,
    quickReplies: ['Go To My Profile', 'My Appointments', 'View Dashboard', 'Contact Helpdesk'],
    action: { type: 'view_profile', url: '/profile' }
  }
];

// ─── Helper: Query Appointment by 4-digit number or ID ──────────
const findAppointmentByNumber = async (appointmentNumber) => {
  const num = Number(appointmentNumber);
  const strQuery = String(appointmentNumber).trim();
  if (!strQuery) return null;

  if (supabase) {
    try {
      if (!isNaN(num)) {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('appointment_number', num)
          .maybeSingle();
        if (!error && data) return data;
      }
      const { data: dataId, error: errId } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', strQuery)
        .maybeSingle();
      if (!errId && dataId) return dataId;
    } catch (_) {}
  }

  const db = readDB();
  const found = (db.appointments || []).find(
    (a) => (!isNaN(num) && Number(a.appointment_number) === num) || String(a.id) === strQuery
  );
  return found || null;
};

// ─── Helper: Query User's Recent Appointments ────────────────────
const getUserAppointments = async (user) => {
  if (user) {
    const uid = String(user.id || '');
    const uemail = String(user.email || '').trim().toLowerCase();
    const uphone = String(user.mobile || user.phone || '').replace(/\D/g, '');

    if (supabase) {
      try {
        if (uid) {
          const { data } = await supabase.from('appointments').select('*').eq('userId', uid).order('date', { ascending: false }).limit(5);
          if (data && data.length > 0) return data;
        }
        if (uemail) {
          const { data } = await supabase.from('appointments').select('*').ilike('email', uemail).order('date', { ascending: false }).limit(5);
          if (data && data.length > 0) return data;
        }
      } catch (_) {}
    }

    const db = readDB();
    const userAppts = (db.appointments || []).filter((a) => {
      const matchId = Boolean(uid && String(a.userId) === uid);
      const matchEmail = Boolean(uemail && a.email && String(a.email).trim().toLowerCase() === uemail);
      const matchPhone = Boolean(uphone && a.patientPhone && String(a.patientPhone).replace(/\D/g, '') === uphone);
      return matchId || matchEmail || matchPhone;
    });

    if (userAppts.length > 0) {
      return userAppts.sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));
    }
  }

  // Fallback: If unauthenticated or no direct match, return latest appointments in system
  const db = readDB();
  return (db.appointments || []).slice(0, 3);
};

// ─── Helper: Query Hospitals from DB ────────────────────────────
const getHospitalList = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('*')
        .limit(20);
      if (!error && Array.isArray(data) && data.length > 0) return data;
    } catch (_) {}
  }

  const db = readDB();
  if (db.hospitals && db.hospitals.length > 0) return db.hospitals;

  return [
    { id: '1', name: 'Apollo Multi-Specialty Hospital', city: 'Mumbai', location: 'Navi Mumbai, Maharashtra', beds: '450 Beds', emergency: '24/7 Active', phone: '+91-22-2847-0000', icu: '60 ICU Beds', specialty: 'Super Specialty Care' },
    { id: '2', name: 'Fortis Memorial Health Institute', city: 'Delhi NCR', location: 'Sector 44, Gurugram, Delhi NCR', beds: '380 Beds', emergency: '24/7 Active', phone: '+91-11-4713-5000', icu: '45 ICU Beds', specialty: 'Cardiology & Neuro' },
    { id: '3', name: 'Manipal Hospital & Research Centre', city: 'Bangalore', location: 'HAL Old Airport Rd, Bangalore', beds: '500 Beds', emergency: '24/7 Active', phone: '+91-80-2502-4444', icu: '75 ICU Beds', specialty: 'Comprehensive Care' },
    { id: '4', name: 'Max Super Speciality Hospital', city: 'New Delhi', location: 'Saket, New Delhi', beds: '530 Beds', emergency: '24/7 Active', phone: '+91-11-2651-5050', icu: '80 ICU Beds', specialty: 'Advanced Oncology & Heart' },
    { id: '5', name: 'Medanta - The Medicity', city: 'Gurugram', location: 'Sector 38, Gurugram, Haryana', beds: '1250 Beds', emergency: '24/7 Active', phone: '+91-124-4141414', icu: '300 ICU Beds', specialty: 'Multi-Super Specialty' },
    { id: '6', name: 'Narayana Multispeciality Hospital', city: 'Kolkata', location: 'Chunavati, Howrah, Kolkata', beds: '320 Beds', emergency: '24/7 Active', phone: '+91-33-7122-2222', icu: '40 ICU Beds', specialty: 'Cardiac & General' },
    { id: '7', name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai', location: 'Andheri West, Mumbai', beds: '750 Beds', emergency: '24/7 Active', phone: '+91-22-4269-6969', icu: '180 ICU Beds', specialty: 'Quaternary Care' },
    { id: '8', name: 'KIMS Hospitals & Heart Centre', city: 'Hyderabad', location: 'Minister Rd, Secunderabad', beds: '1000 Beds', emergency: '24/7 Active', phone: '+91-40-4488-5000', icu: '200 ICU Beds', specialty: 'Transplant & Trauma' }
  ];
};

// ─── Helper: Detect Medical Specialty from Text ────────────────
const detectSpecialty = (msgStr) => {
  if (!msgStr) return null;
  const l = msgStr.toLowerCase();

  // Lab Tests Detection
  const labMatch = POPULAR_LAB_TESTS.find(t => t.name && l.includes(t.name.toLowerCase()));
  if (labMatch) return labMatch.name;
  if (l.includes('cbc') || l.includes('blood count')) return 'Complete Blood Count (CBC)';
  if (l.includes('lipid') || l.includes('cholesterol')) return 'Lipid Profile';
  if (l.includes('thyroid') || l.includes('tsh')) return 'Thyroid Profile (T3, T4, TSH)';
  if (l.includes('liver') || l.includes('lft')) return 'Liver Function Test (LFT)';
  if (l.includes('kidney') || l.includes('kft') || l.includes('creatinine')) return 'Kidney Function Test (KFT)';
  if (l.includes('sugar') || l.includes('glucose') || l.includes('diabetes test') || l.includes('hba1c')) return 'HbA1c & Fasting Blood Sugar';
  if (l.includes('vitamin d') || l.includes('vitamin b12') || l.includes('vitamin')) return 'Vitamin D3 & B12 Combo';
  if (l.includes('ecg') || l.includes('electrocardiogram')) return '12-Lead ECG';
  if (l.includes('x-ray') || l.includes('xray')) return 'Digital Chest X-Ray';
  if (l.includes('ultrasound') || l.includes('usg') || l.includes('sonography')) return 'Ultrasound Abdomen & Pelvis';
  if (l.includes('urine') || l.includes('urinalysis')) return 'Urine Routine & Microscopic';
  if (l.includes('blood test') || l.includes('lab test') || l.includes('diagnostic')) return 'Diagnostic Lab Test';

  // Specialties Detection
  if (l.includes('cardio') || l.includes('heart')) return 'Cardiology';
  if (l.includes('neuro') || l.includes('brain') || l.includes('spine')) return 'Neurology';
  if (l.includes('ortho') || l.includes('bone') || l.includes('joint') || l.includes('fracture')) return 'Orthopedics';
  if (l.includes('pediatric') || l.includes('child') || l.includes('baby')) return 'Pediatrics';
  if (l.includes('derma') || l.includes('skin')) return 'Dermatology';
  if (l.includes('gynec') || l.includes('women') || l.includes('maternity') || l.includes('pregnancy')) return 'Gynecology & Obstetrics';
  if (l.includes('dental') || l.includes('tooth') || l.includes('dentist')) return 'Dental Care';
  if (l.includes('eye') || l.includes('cataract') || l.includes('vision') || l.includes('ophthal')) return 'Ophthalmology';
  if (l.includes('general') || l.includes('physician') || l.includes('fever') || l.includes('medicine')) return 'General Medicine';
  return null;
};

// ─── Helper: Calculate Service / Consultation Fee ─────────────
const calculateServiceFee = (specialty) => {
  if (!specialty) return 500;
  const specLower = specialty.toLowerCase();
  const labMatch = POPULAR_LAB_TESTS.find(t => (t.name && specLower.includes(t.name.toLowerCase())) || (t.category && specLower.includes(t.category.toLowerCase())));
  if (labMatch) return labMatch.price;
  if (specLower.includes('cbc') || specLower.includes('blood count')) return 350;
  if (specLower.includes('lipid')) return 750;
  if (specLower.includes('thyroid')) return 650;
  if (specLower.includes('liver') || specLower.includes('lft')) return 850;
  if (specLower.includes('kidney') || specLower.includes('kft')) return 800;
  if (specLower.includes('hba1c') || specLower.includes('sugar')) return 500;
  if (specLower.includes('vitamin')) return 1400;
  if (specLower.includes('ecg')) return 400;
  if (specLower.includes('x-ray') || specLower.includes('xray')) return 600;
  if (specLower.includes('ultrasound') || specLower.includes('usg')) return 1200;
  if (specLower.includes('urine')) return 200;
  if (specLower.includes('cardio') || specLower.includes('heart')) return 800;
  if (specLower.includes('neuro') || specLower.includes('brain')) return 1000;
  if (specLower.includes('ortho') || specLower.includes('bone')) return 700;
  if (specLower.includes('derma') || specLower.includes('skin')) return 600;
  if (specLower.includes('gynec') || specLower.includes('women')) return 600;
  if (specLower.includes('pediatric') || specLower.includes('child')) return 500;
  if (specLower.includes('dental') || specLower.includes('tooth')) return 500;
  return 500;
};

// ─── Helper: Query Available Time Slots (Excluding Already Booked Slots) ───
const getAvailableTimeSlots = async (dateStr, hospitalId = null, hospitalName = null) => {
  const allSlotTemplates = [
    { time24: '09:00', label: '09:00 AM' },
    { time24: '09:30', label: '09:30 AM' },
    { time24: '10:00', label: '10:00 AM' },
    { time24: '10:30', label: '10:30 AM' },
    { time24: '11:00', label: '11:00 AM' },
    { time24: '11:30', label: '11:30 AM' },
    { time24: '12:00', label: '12:00 PM' },
    { time24: '12:30', label: '12:30 PM' },
    { time24: '14:00', label: '02:00 PM' },
    { time24: '14:30', label: '02:30 PM' },
    { time24: '15:00', label: '03:00 PM' },
    { time24: '15:30', label: '03:30 PM' },
    { time24: '16:00', label: '04:00 PM' },
    { time24: '16:30', label: '04:30 PM' },
    { time24: '17:00', label: '05:00 PM' }
  ];

  let bookedAppointments = [];

  // Query Supabase if connected
  if (supabase) {
    try {
      let query = supabase
        .from('appointments')
        .select('date, time, status, hospitalId, hospital')
        .eq('date', dateStr)
        .neq('status', 'Cancelled');

      if (hospitalId && hospitalName) {
        query = query.or(`hospitalId.eq.${hospitalId},hospital.eq.${hospitalName}`);
      } else if (hospitalId) {
        query = query.eq('hospitalId', hospitalId);
      } else if (hospitalName) {
        query = query.eq('hospital', hospitalName);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        bookedAppointments = data;
      }
    } catch (_) {}
  }

  // Fallback & Merge with local db.json
  const db = readDB();
  const localBooked = (db.appointments || []).filter(a => {
    if (a.date !== dateStr) return false;
    if (a.status === 'Cancelled') return false;
    if (hospitalId || hospitalName) {
      const matchId = hospitalId && a.hospitalId && String(a.hospitalId) === String(hospitalId);
      const matchName = hospitalName && a.hospital && a.hospital.toLowerCase() === hospitalName.toLowerCase();
      return Boolean(matchId || matchName);
    }
    return true;
  });

  const allBooked = [...bookedAppointments, ...localBooked];

  // Set of normalized booked times in 24h format (e.g. '09:00', '10:00', '14:00')
  const bookedTimeSet = new Set();
  allBooked.forEach(a => {
    if (!a.time) return;
    const rawTime = String(a.time).trim().toLowerCase();
    const match = rawTime.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
    if (match) {
      let h = Number(match[1]);
      const m = match[2];
      const isPm = (match[3] || '').toLowerCase() === 'pm';
      const isAm = (match[3] || '').toLowerCase() === 'am';
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      bookedTimeSet.add(`${String(h).padStart(2, '0')}:${m}`);
    } else {
      bookedTimeSet.add(rawTime);
    }
  });

  // Filter out past times if date is today
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = dateStr === todayStr;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  const available = allSlotTemplates.filter(s => {
    if (bookedTimeSet.has(s.time24)) return false;
    if (isToday) {
      const [sh, sm] = s.time24.split(':').map(Number);
      if (sh < currentHour || (sh === currentHour && sm <= currentMin)) return false;
    }
    return true;
  });

  return {
    availableSlots: available,
    bookedSlots: allSlotTemplates.filter(s => bookedTimeSet.has(s.time24)),
    bookedCount: bookedTimeSet.size
  };
};

// ─── Main Conversational Message Handler ────────────────────────
const processChatMessage = async (req, res) => {
  try {
    const { message = '', context = {}, history = [], paymentInfo = null } = req.body || {};
    const text = String(message).trim();
    const lower = text.toLowerCase();

    if (!text && !paymentInfo) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const user = req.user || null;
    const userName = user?.name ? user.name.split(' ')[0] : 'there';
    let bookingState = context?.bookingState || null;

    // ─────────────────────────────────────────────────────────────
    // IN-CHAT CONVERSATIONAL BOOKING FLOW (Multi-step wizard)
    // ─────────────────────────────────────────────────────────────
    if (bookingState && (lower === 'cancel booking' || lower === 'cancel' || lower === 'exit' || lower === 'stop' || lower === 'restart' || lower === '❌ cancel booking')) {
      return res.json({
        reply: `🚫 In-chat booking has been cancelled. How else can I assist you today?`,
        intent: 'booking_cancelled',
        quickReplies: ['🩺 Book Doctor Appointment', '🧪 Lab Tests & Pricing', '🔍 Track My Appointment', '🚨 Emergency Helpline'],
        context: { bookingState: null }
      });
    }

    // Step-by-Step In-Chat Booking Wizard Evaluation:
    if (bookingState) {
      // ----------------------------------------------------
      // STEP 1B: Specialty Selection Response
      // ----------------------------------------------------
      if (bookingState.step === 'specialty') {
        const detected = detectSpecialty(text) || text.replace(/[^\w\s&]/g, '').trim() || 'General Medicine';
        const hospitals = await getHospitalList();
        const topHosp = hospitals.slice(0, 4).map(h => h.name);

        return res.json({
          reply: `🩺 **Department Selected:** **${detected}**\n\n` +
            `🏥 **Step 2 of 4: Please select your preferred hospital or clinic:**\n` +
            `Choose a hospital from the list below or click **"See More Hospitals"** to view all options:`,
          intent: 'booking_step_hospital',
          hospitals: hospitals,
          quickReplies: [...topHosp, 'View More Hospitals 🏥', '⬅️ Back', '❌ Cancel Booking'],
          context: {
            bookingState: {
              ...bookingState,
              step: 'hospital',
              specialty: detected
            }
          }
        });
      }

      // ----------------------------------------------------
      // STEP 2: Hospital Selection Response
      // ----------------------------------------------------
      if (bookingState.step === 'hospital') {
        if (lower.includes('back')) {
          return res.json({
            reply: `🩺 **Let's book your appointment right here in chat!**\n\n` +
              `**Step 1 of 4: Which medical specialty or department do you need?**`,
            intent: 'booking_step_specialty',
            quickReplies: ['Cardiology ❤️', 'Neurology 🧠', 'Orthopedics 🦴', 'Pediatrics 👶', 'General Medicine 🩺', 'Dermatology ✨', 'Gynecology 🌸', 'Lab Blood Test 🧪', 'Dental Care 🦷', '❌ Cancel Booking'],
            context: { bookingState: { step: 'specialty' } }
          });
        }

        const hospitals = await getHospitalList();

        // If user explicitly asks to see more or all hospitals
        if (lower.includes('more') || lower.includes('all') || lower.includes('see more') || lower.includes('view more')) {
          const hospMarkdown = hospitals.map((h, i) => `* **${i + 1}. 🏥 ${h.name}**\n  📍 *${h.location || h.city || 'Metro City'}* | 🛏️ ${h.beds || '300+'} | 🚨 ${h.emergency || '24/7'}`).join('\n\n');

          return res.json({
            reply: `🏥 **All Accredited Network Hospitals & Clinics:**\n\n${hospMarkdown}\n\n👉 *Select any hospital below to choose your date & time slot:*`,
            intent: 'booking_step_hospital',
            hospitals: hospitals,
            quickReplies: [...hospitals.map(h => h.name), '⬅️ Back', '❌ Cancel Booking'],
            context: {
              bookingState
            }
          });
        }

        let selectedHospital = hospitals.find(h => lower.includes(h.name.toLowerCase()) || (h.city && lower.includes(h.city.toLowerCase())));
        if (!selectedHospital && hospitals.length > 0) {
          selectedHospital = hospitals[0];
        }

        const hospName = selectedHospital ? selectedHospital.name : 'MEDPARK Multi-Specialty Hospital';
        const hospId = selectedHospital ? selectedHospital.id : '1';

        // Next 4 dates (Today, Tomorrow, +2, +3)
        const d0 = new Date();
        const d1 = new Date(Date.now() + 86400000);
        const d2 = new Date(Date.now() + 2 * 86400000);
        const d3 = new Date(Date.now() + 3 * 86400000);

        const formatDateStr = (d) => d.toISOString().split('T')[0];
        const dateChips = [
          `Today (${formatDateStr(d0)})`,
          `Tomorrow (${formatDateStr(d1)})`,
          formatDateStr(d2),
          formatDateStr(d3)
        ];

        return res.json({
          reply: `🏥 **Hospital Selected:** **${hospName}**\n` +
            `🩺 **Specialty:** **${bookingState.specialty}**\n\n` +
            `📅 **Step 3 of 4: Which date would you like to schedule your visit for?**\n` +
            `Select a convenient date below or type any date (*YYYY-MM-DD*):`,
          intent: 'booking_step_date',
          quickReplies: [...dateChips, '⬅️ Change Hospital', '❌ Cancel Booking'],
          context: {
            bookingState: {
              ...bookingState,
              step: 'date',
              hospitalId: String(hospId),
              hospitalName: hospName
            }
          }
        });
      }

      // ----------------------------------------------------
      // STEP 3: Date Selection Response
      // ----------------------------------------------------
      if (bookingState.step === 'date') {
        if (lower.includes('change hospital') || lower.includes('back')) {
          const hospitals = await getHospitalList();
          const topHosp = hospitals.slice(0, 4).map(h => h.name);
          return res.json({
            reply: `🏥 **Step 2 of 4: Please choose your preferred hospital or clinic:**`,
            intent: 'booking_step_hospital',
            hospitals,
            quickReplies: [...topHosp, 'View More Hospitals 🏥', '❌ Cancel Booking'],
            context: { bookingState: { ...bookingState, step: 'hospital' } }
          });
        }

        let chosenDate = '';
        const dateMatch = text.match(/\b(202\d-\d{2}-\d{2})\b/);
        if (dateMatch) {
          chosenDate = dateMatch[1];
        } else if (lower.includes('today')) {
          chosenDate = new Date().toISOString().split('T')[0];
        } else if (lower.includes('tomorrow')) {
          chosenDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        } else {
          chosenDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        }

        // Query available slots dynamically excluding already booked slots
        const { availableSlots, bookedCount } = await getAvailableTimeSlots(
          chosenDate,
          bookingState.hospitalId,
          bookingState.hospitalName
        );

        if (availableSlots.length === 0) {
          return res.json({
            reply: `📅 **Date Selected:** **${chosenDate}**\n` +
              `🏥 **Hospital:** **${bookingState.hospitalName}**\n\n` +
              `⚠️ **All appointment slots for ${chosenDate} are completely booked!**\n\n` +
              `Please select another date with open availability below:`,
            intent: 'booking_step_date_full',
            quickReplies: [
              `Tomorrow (${new Date(Date.now() + 86400000).toISOString().split('T')[0]})`,
              new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
              new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
              '⬅️ Change Hospital',
              '❌ Cancel Booking'
            ],
            context: {
              bookingState: {
                ...bookingState,
                step: 'date'
              }
            }
          });
        }

        const slotChips = availableSlots.map(s => s.label);
        const bookedNote = bookedCount > 0 ? `\n> 🟢 *${availableSlots.length} open slots available (${bookedCount} already booked slot${bookedCount > 1 ? 's' : ''} excluded).*` : '';

        return res.json({
          reply: `📅 **Date Selected:** **${chosenDate}**\n` +
            `🏥 **Hospital:** **${bookingState.hospitalName}**\n` +
            `🩺 **Service:** **${bookingState.specialty}**\n\n` +
            `⏰ **Step 4 of 4: Please choose an available time slot:**` +
            bookedNote,
          intent: 'booking_step_time',
          availableSlots: availableSlots,
          quickReplies: [...slotChips.slice(0, 8), '⬅️ Change Date', '❌ Cancel Booking'],
          context: {
            bookingState: {
              ...bookingState,
              step: 'time',
              date: chosenDate,
              availableSlots: availableSlots.map(s => s.time24)
            }
          }
        });
      }

      // ----------------------------------------------------
      // STEP 4: Time Slot Selection Response
      // ----------------------------------------------------
      if (bookingState.step === 'time') {
        if (lower.includes('change date') || lower.includes('back')) {
          const d0 = new Date();
          const d1 = new Date(Date.now() + 86400000);
          const d2 = new Date(Date.now() + 2 * 86400000);
          const formatDateStr = (d) => d.toISOString().split('T')[0];
          return res.json({
            reply: `📅 **Select your appointment date:**`,
            intent: 'booking_step_date',
            quickReplies: [`Today (${formatDateStr(d0)})`, `Tomorrow (${formatDateStr(d1)})`, formatDateStr(d2), '❌ Cancel Booking'],
            context: { bookingState: { ...bookingState, step: 'date' } }
          });
        }

        let cleanTime = '10:00';
        const timeMatch = text.match(/\b(\d{1,2}:\d{2})\s*(am|pm)?\b/i);
        if (timeMatch) {
          let [h, m] = timeMatch[1].split(':').map(Number);
          const isPm = (timeMatch[2] || '').toLowerCase() === 'pm';
          const isAm = (timeMatch[2] || '').toLowerCase() === 'am';
          if (isPm && h < 12) h += 12;
          if (isAm && h === 12) h = 0;
          cleanTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        } else if (lower.includes('09:00') || lower.includes('9:00') || lower === '09:00 am' || lower === '9 am') {
          cleanTime = '09:00';
        } else if (lower.includes('09:30') || lower.includes('9:30')) {
          cleanTime = '09:30';
        } else if (lower.includes('10:00') || lower.includes('10 am')) {
          cleanTime = '10:00';
        } else if (lower.includes('10:30')) {
          cleanTime = '10:30';
        } else if (lower.includes('11:00') || lower.includes('11 am')) {
          cleanTime = '11:00';
        } else if (lower.includes('11:30')) {
          cleanTime = '11:30';
        } else if (lower.includes('12:00') || lower.includes('12 pm')) {
          cleanTime = '12:00';
        } else if (lower.includes('12:30')) {
          cleanTime = '12:30';
        } else if (lower.includes('02:00') || lower.includes('2:00') || lower.includes('2 pm')) {
          cleanTime = '14:00';
        } else if (lower.includes('02:30') || lower.includes('2:30')) {
          cleanTime = '14:30';
        } else if (lower.includes('03:00') || lower.includes('3:00') || lower.includes('3 pm')) {
          cleanTime = '15:00';
        } else if (lower.includes('03:30') || lower.includes('3:30')) {
          cleanTime = '15:30';
        } else if (lower.includes('04:00') || lower.includes('4:00') || lower.includes('4 pm')) {
          cleanTime = '16:00';
        } else if (lower.includes('04:30') || lower.includes('4:30')) {
          cleanTime = '16:30';
        } else if (lower.includes('05:00') || lower.includes('5:00') || lower.includes('5 pm')) {
          cleanTime = '17:00';
        }

        // ─── VERIFY AVAILABILITY IN REAL-TIME (EXCLUDE TAKEN SLOTS) ───
        const { availableSlots } = await getAvailableTimeSlots(
          bookingState.date,
          bookingState.hospitalId,
          bookingState.hospitalName
        );

        const isSlotAvailable = availableSlots.some(s => s.time24 === cleanTime);

        if (!isSlotAvailable) {
          const validChips = availableSlots.map(s => s.label);
          return res.json({
            reply: `⚠️ **The slot at ${cleanTime} on ${bookingState.date} is already booked or unavailable.**\n\n` +
              `Please select one of the open available time slots below:`,
            intent: 'booking_step_time_retry',
            availableSlots: availableSlots,
            quickReplies: [...validChips.slice(0, 8), '⬅️ Change Date', '❌ Cancel Booking'],
            context: {
              bookingState: {
                ...bookingState,
                step: 'time'
              }
            }
          });
        }

        const nextState = {
          ...bookingState,
          step: 'patient_details',
          time: cleanTime
        };

        if (user && user.name) {
          const userPhone = user.mobile || user.phone || '9876543210';
          return res.json({
            reply: `⏰ **Time Slot Selected:** **${cleanTime}**\n\n` +
              `👤 **Confirm Patient Details:**\n` +
              `* 👤 **Patient Name:** ${user.name}\n` +
              `* 📱 **Mobile:** ${userPhone}\n` +
              `* 📧 **Email:** ${user.email || 'patient@medpark.com'}\n\n` +
              `Click **"✅ Confirm Details"** below to proceed to payment options, or reply with a different patient name and phone number (e.g. *"Rahul Sharma, 9876543210"*):`,
            intent: 'booking_step_confirm',
            quickReplies: ['✅ Confirm Details', 'Book for Family Member', '❌ Cancel Booking'],
            context: {
              bookingState: {
                ...nextState,
                step: 'confirm',
                patientName: user.name,
                patientPhone: userPhone,
                email: user.email || ''
              }
            }
          });
        }

        return res.json({
          reply: `⏰ **Time Slot Selected:** **${cleanTime}**\n\n` +
            `👤 **Almost Done! Please provide Patient Details:**\n` +
            `Please reply with the **Patient's Full Name** and **10-digit Mobile Number** (e.g. *"Amit Sharma, 9876543210"*):`,
          intent: 'booking_step_patient_details',
          quickReplies: ['❌ Cancel Booking'],
          context: {
            bookingState: nextState
          }
        });
      }

      // ----------------------------------------------------
      // STEP 5: Patient Details ➜ Present Payment Options
      // ----------------------------------------------------
      if (bookingState.step === 'patient_details' || bookingState.step === 'confirm') {
        let patientName = bookingState.patientName || '';
        let patientPhone = bookingState.patientPhone || '';
        let patientEmail = bookingState.email || user?.email || 'patient@medpark.com';

        // Check if user confirmed directly or provided new details
        if (lower.includes('confirm') || lower === 'yes' || lower === 'book now' || lower === '✅ confirm details' || lower === '✅ confirm booking') {
          if (!patientName) patientName = user?.name || 'Valued Patient';
          if (!patientPhone) patientPhone = user?.mobile || user?.phone || '9876543210';
        } else {
          // Parse Name and Phone from text (e.g. "Amit Sharma, 9876543210" or "Rahul Verma 9876543210")
          const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
          if (phoneMatch) {
            patientPhone = phoneMatch[1];
            patientName = text.replace(phoneMatch[0], '').replace(/[,\-–:]/g, '').trim() || user?.name || 'Valued Patient';
          } else if (text.length > 2 && !lower.includes('cancel')) {
            patientName = text.trim();
            patientPhone = user?.mobile || user?.phone || '9876543210';
          }
        }

        const fee = calculateServiceFee(bookingState.specialty);
        const serviceTitle = bookingState.specialty || 'Doctor Consultation';

        return res.json({
          reply: `📋 **Appointment Summary:**\n\n` +
            `* 👤 **Patient:** ${patientName} (${patientPhone})\n` +
            `* 🏥 **Hospital:** ${bookingState.hospitalName}\n` +
            `* 🩺 **Service:** ${serviceTitle}\n` +
            `* 📅 **Scheduled Slot:** **${bookingState.date}** at ⏰ **${bookingState.time}**\n` +
            `* 💰 **Consultation / Test Fee:** **₹${fee}**\n\n` +
            `💳 **Step 5 of 5: Choose Your Preferred Payment Option:**\n\n` +
            `1. 💳 **Pay Online Payment Gateway** *(Cards, Stripe, Razorpay UPI, Net Banking)*\n` +
            `2. 📱 **Instant UPI QR Code** *(Google Pay, PhonePe, Paytm)*\n` +
            `3. 🏥 **Pay at Hospital Front Desk** *(Cash / Card on arrival)*\n\n` +
            `👉 Click **"💳 Pay Online (₹${fee})"** below to open the secure payment checkout, or select **"🏥 Pay at Hospital Counter"**:`,
          intent: 'booking_step_payment_choice',
          quickReplies: [
            `💳 Pay Online Gateway (₹${fee})`,
            `📱 Instant UPI QR`,
            `🏥 Pay at Hospital Counter`,
            `❌ Cancel Booking`
          ],
          action: {
            type: 'open_payment_modal',
            label: `💳 Pay Online Gateway (₹${fee})`,
            bookingData: {
              patientName,
              patientPhone,
              email: patientEmail,
              hospitalId: bookingState.hospitalId || '1',
              hospitalName: bookingState.hospitalName,
              specialty: bookingState.specialty,
              serviceName: serviceTitle,
              date: bookingState.date,
              time: bookingState.time,
              amount: fee
            }
          },
          context: {
            bookingState: {
              ...bookingState,
              step: 'payment_choice',
              patientName,
              patientPhone,
              email: patientEmail,
              fee
            }
          }
        });
      }

      // ----------------------------------------------------
      // STEP 6: Execute Booking with Payment Choice
      // ----------------------------------------------------
      if (bookingState.step === 'payment_choice' || paymentInfo) {
        const fee = bookingState.fee || calculateServiceFee(bookingState.specialty);
        let patientName = bookingState.patientName || user?.name || 'Valued Patient';
        let patientPhone = bookingState.patientPhone || user?.mobile || user?.phone || '9876543210';
        let patientEmail = bookingState.email || user?.email || 'patient@medpark.com';

        const isCounterPayment = lower.includes('counter') || lower.includes('hospital') || lower.includes('cash') || lower.includes('offline') || lower.includes('desk');
        const isOnlinePayment = Boolean(paymentInfo) || lower.includes('paid') || lower.includes('verified') || lower.includes('stripe') || lower.includes('razorpay') || lower.includes('utr') || lower.includes('card');

        // If user explicitly asks to open payment modal again
        if (lower.includes('pay online') || lower.includes('online gateway') || (lower.includes('upi qr') && !isOnlinePayment)) {
          return res.json({
            reply: `💳 **Opening Secure Payment Checkout...**\n\nPlease complete your payment of **₹${fee}** via Stripe Card, Razorpay UPI, or Free UPI QR in the window that appears:`,
            intent: 'booking_step_payment_modal_opened',
            quickReplies: [`🏥 Pay at Hospital Counter Instead`, `❌ Cancel Booking`],
            action: {
              type: 'open_payment_modal',
              label: `💳 Pay Online Gateway (₹${fee})`,
              bookingData: {
                patientName,
                patientPhone,
                email: patientEmail,
                hospitalId: bookingState.hospitalId || '1',
                hospitalName: bookingState.hospitalName,
                specialty: bookingState.specialty,
                serviceName: bookingState.specialty || 'Doctor Consultation',
                date: bookingState.date,
                time: bookingState.time,
                amount: fee
              }
            },
            context: {
              bookingState
            }
          });
        }

        // Generate unique 4-digit appointment number
        const appointmentNumber = await generateAppointmentNumber();
        const appointmentId = Date.now().toString();

        const isPaid = !isCounterPayment;
        const paymentMethodStr = paymentInfo?.paymentMethod || (isCounterPayment ? 'Hospital Front Desk Counter' : 'Online Payment Gateway');
        const paymentIdStr = paymentInfo?.paymentId || (isCounterPayment ? `COUNTER_${Date.now()}` : `PAY_GATEWAY_${Date.now()}`);

        const isLabTestSpecialty = Boolean(
          (bookingState.specialty || '').toLowerCase().includes('lab') ||
          (bookingState.specialty || '').toLowerCase().includes('test') ||
          (bookingState.specialty || '').toLowerCase().includes('blood') ||
          POPULAR_LAB_TESTS.some(t => t.name.toLowerCase() === (bookingState.specialty || '').toLowerCase())
        );

        const appointment = {
          id: appointmentId,
          userId: user?.id || null,
          hospitalId: bookingState.hospitalId || '1',
          hospital: bookingState.hospitalName || 'MEDPARK Multi-Specialty Hospital',
          doctorName: `${bookingState.specialty || 'General'} Specialist`,
          date: bookingState.date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          time: bookingState.time || '10:00',
          patientName: patientName,
          patientPhone: patientPhone,
          email: patientEmail,
          reason: `In-Chat Booking: ${bookingState.specialty || 'Medical'} Consultation`,
          appointmentType: isLabTestSpecialty ? 'Lab Test' : 'Consult',
          status: isPaid ? 'Confirmed' : 'Pending',
          source: 'chat_bot',
          paymentStatus: isPaid ? 'Paid' : 'Unpaid (Pay at Hospital Counter)',
          paymentId: paymentIdStr,
          paymentAmount: fee,
          paymentMethod: paymentMethodStr,
          appointment_number: appointmentNumber,
          createdAt: new Date().toISOString()
        };

        // Insert into database
        let savedAppt = null;
        if (supabase) {
          try {
            const resIns = await supabase.from('appointments').insert(appointment).select().single();
            if (!resIns.error && resIns.data) savedAppt = resIns.data;
          } catch (_) {}
        }
        if (!savedAppt) {
          const db = readDB();
          db.appointments = db.appointments || [];
          db.appointments.unshift(appointment);
          writeDB(db);
          savedAppt = appointment;
        }

        // Trigger email notification and invoice PDF asynchronously
        try {
          if (savedAppt.email) {
            let invoicePdfBuffer = null;
            try {
              invoicePdfBuffer = await generateAppointmentInvoice(savedAppt);
            } catch (_) {}
            sendAppointmentConfirmation({
              to: savedAppt.email,
              patientName: savedAppt.patientName,
              patientPhone: savedAppt.patientPhone,
              hospitalName: savedAppt.hospital,
              date: savedAppt.date,
              time: savedAppt.time,
              doctorName: savedAppt.doctorName,
              appointmentNumber: savedAppt.appointment_number,
              paymentStatus: savedAppt.paymentStatus,
              paymentAmount: savedAppt.paymentAmount,
              paymentMethod: savedAppt.paymentMethod,
              invoicePdfBuffer
            }).catch(() => {});
          }
          broadcast('appointment_created', savedAppt);
        } catch (_) {}

        const statusEmoji = isPaid ? '🟢' : '⏳';
        const reply = `🎉 **Your Appointment is Successfully ${isPaid ? 'Booked & Paid' : 'Reserved'}!**\n\n` +
          `### ${statusEmoji} Appointment #${savedAppt.appointment_number} ${isPaid ? 'Confirmed & Paid' : 'Reserved (Counter Payment)'}\n\n` +
          `* 👤 **Patient Name:** ${savedAppt.patientName}\n` +
          `* 🏥 **Hospital:** ${savedAppt.hospital}\n` +
          `* 🩺 **Specialty / Doctor:** ${savedAppt.doctorName}\n` +
          `* 📅 **Scheduled Slot:** **${savedAppt.date}** at ⏰ **${savedAppt.time}**\n` +
          `* 📱 **Mobile:** ${savedAppt.patientPhone}\n` +
          `* 💳 **Payment Mode:** ${savedAppt.paymentMethod}\n` +
          `* 🆔 **Payment / Transaction ID:** \`${savedAppt.paymentId}\`\n` +
          `* 💰 **Amount:** **₹${savedAppt.paymentAmount}** (${savedAppt.paymentStatus})\n\n` +
          (isPaid
            ? `> 📧 An official booking confirmation and GST tax invoice PDF have been registered to **${savedAppt.email}**.\n\n`
            : `> ℹ️ *Please arrive 15 minutes before your scheduled slot time to complete front desk check-in and payment.*\n\n`) +
          `👇 **What would you like to do next? Choose an option below:**`;

        const paymentDetails = {
          paymentId: savedAppt.paymentId,
          paymentStatus: savedAppt.paymentStatus,
          paymentAmount: savedAppt.paymentAmount,
          paymentMethod: savedAppt.paymentMethod,
          paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          invoiceUrl: `/api/appointments/${savedAppt.id}/invoice`,
          appointmentNumber: savedAppt.appointment_number,
          appointmentId: savedAppt.id,
          patientName: savedAppt.patientName,
          hospital: savedAppt.hospital,
          doctorName: savedAppt.doctorName,
          date: savedAppt.date,
          time: savedAppt.time,
          isPaid: isPaid
        };

        const nextOptions = [
          {
            id: 'download_invoice',
            label: '📄 Download Tax Invoice (PDF)',
            actionType: 'download_invoice',
            url: `/api/appointments/${savedAppt.id}/invoice`,
            description: 'Official GST tax invoice receipt'
          },
          {
            id: 'view_portal',
            label: '📑 View in My Appointments',
            actionType: 'navigate',
            url: `/dashboard/my-appointments?id=${savedAppt.id}`,
            description: 'Open in patient portal'
          },
          {
            id: 'docs_needed',
            label: '📋 What Documents to Bring',
            actionType: 'message',
            text: 'What documents to bring for my appointment',
            description: 'Photo ID, prior reports & records'
          },
          {
            id: 'visiting_info',
            label: '🕒 Hospital Visiting Hours & Helpline',
            actionType: 'message',
            text: 'Hospital visiting hours',
            description: 'Timings, visitor passes & casualty'
          },
          {
            id: 'book_another',
            label: '🩺 Book Another Appointment / Lab Test',
            actionType: 'message',
            text: 'Book appointment',
            description: 'Consult another doctor or test'
          }
        ];

        return res.json({
          reply,
          intent: 'appointment_booked_success',
          appointment: savedAppt,
          paymentDetails,
          nextOptions,
          quickReplies: [
            '📄 Download Invoice PDF',
            '📋 What Documents to Bring',
            '🕒 Hospital Visiting Hours',
            '🩺 Book Another Appointment',
            `Track #${savedAppt.appointment_number}`
          ],
          action: {
            type: 'download_invoice',
            appointmentId: savedAppt.id,
            appointmentNumber: savedAppt.appointment_number,
            url: `/api/appointments/${savedAppt.id}/invoice`,
            label: '📄 Download Official Tax Invoice PDF'
          },
          context: { bookingState: null }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. APPOINTMENT TRACKING & STATUS (Matches #1234, 1234, track appointment, check booking, my appointment)
    // ─────────────────────────────────────────────────────────────
    const numMatch = text.match(/(?:#|appointment\s*#?|ticket\s*#?|tracking\s*#?|status\s*#?)?\b(\d{4})\b/i);
    const isTrackingQuery = (
      lower.includes('track') ||
      lower.includes('status') ||
      lower.includes('check my booking') ||
      lower.includes('check booking') ||
      lower.includes('check appointment') ||
      lower.includes('where is my appointment') ||
      lower.includes('where is my booking') ||
      lower.includes('show my booking') ||
      lower.includes('show my appointment') ||
      lower.includes('my appointment') ||
      lower.includes('my booking') ||
      lower.includes('my bookings') ||
      lower.includes('booking detail') ||
      lower.includes('appointment detail') ||
      lower === 'track appointment' ||
      lower === 'track my appointment' ||
      lower === 'track'
    );

    if (numMatch || isTrackingQuery) {
      // 1A. User provided a specific 4-digit number
      if (numMatch) {
        const apptNum = numMatch[1];
        const appt = await findAppointmentByNumber(apptNum);

        if (appt) {
          const isCancelled = appt.status === 'Cancelled';
          const isCompleted = appt.status === 'Completed';
          const isConfirmed = appt.status === 'Confirmed';
          const statusEmoji = isCancelled ? '❌' : isCompleted ? '✅' : isConfirmed ? '🟢' : '⏳';

          const reply = `### ${statusEmoji} Appointment #${appt.appointment_number || appt.id} Details\n\n` +
            `* 👤 **Patient Name:** ${appt.patientName || 'N/A'}\n` +
            `* 🏥 **Hospital:** ${appt.hospital || 'MEDPARK Hospital'}\n` +
            `* 🩺 **Service / Doctor:** ${appt.serviceName || appt.doctorName || appt.appointmentType || 'Doctor Consultation'}\n` +
            `* 📅 **Scheduled Slot:** **${appt.date || 'N/A'}** at ⏰ **${appt.time || 'N/A'}**\n` +
            `* 📊 **Booking Status:** **${appt.status || 'Pending'}**\n` +
            `* 💳 **Payment Status:** ${String(appt.paymentStatus).toLowerCase() === 'paid' ? '💳 Paid (₹' + (appt.paymentAmount || appt.servicePrice || 500) + ')' : '⏳ Unpaid'}\n` +
            (isCancelled ? `\n> ℹ️ *Cancellation Reason: ${appt.cancellationReason || 'Cancelled by user'}* (Refund: ₹${appt.refundAmount || 0} - ${appt.refundStatus || 'Refunded'})` : '') +
            `\n\nYou can view full records, download the official tax invoice PDF, or manage this booking below:`;

          return res.json({
            reply,
            intent: 'track_appointment',
            appointment: appt,
            quickReplies: [
              'Download Invoice PDF',
              'Book Another Appointment',
              'Explore Diagnostic Tests',
              'Contact Hospital Helpdesk'
            ],
            action: {
              type: 'view_appointment',
              appointmentId: appt.id,
              appointmentNumber: appt.appointment_number,
              url: `/dashboard/my-appointments?id=${appt.id}`,
              label: '📑 View in My Appointments'
            }
          });
        } else {
          return res.json({
            reply: `🔍 I searched for appointment number **#${apptNum}**, but couldn't find an active record in our database.\n\n` +
              `* Please ensure the 4-digit appointment number is correct.\n` +
              `* If you booked recently, you can also view all your active bookings directly in [My Appointments](/dashboard/my-appointments).`,
            intent: 'track_appointment_not_found',
            quickReplies: ['View My Appointments', 'Book New Appointment', 'Talk to Support'],
            action: {
              type: 'view_appointments',
              url: '/dashboard/my-appointments',
              label: '📑 Open My Appointments'
            }
          });
        }
      }

      // 1B. User asked to track their appointment without specifying a 4-digit number
      const userAppts = await getUserAppointments(user);

      if (userAppts && userAppts.length > 0) {
        const latestAppt = userAppts[0];
        const isCancelled = latestAppt.status === 'Cancelled';
        const isCompleted = latestAppt.status === 'Completed';
        const isConfirmed = latestAppt.status === 'Confirmed';
        const statusEmoji = isCancelled ? '❌' : isCompleted ? '✅' : isConfirmed ? '🟢' : '⏳';

        let otherList = '';
        if (userAppts.length > 1) {
          otherList = `\n\n📋 **Other Recent Bookings:**\n` +
            userAppts.slice(1, 3).map((a) => `* 🎟️ **#${a.appointment_number || a.id}** — 📅 **${a.date} @ ${a.time}** (${a.status || 'Pending'})`).join('\n');
        }

        const reply = `### ${statusEmoji} Latest Appointment #${latestAppt.appointment_number || latestAppt.id} Details\n\n` +
          `* 👤 **Patient Name:** ${latestAppt.patientName || 'N/A'}\n` +
          `* 🏥 **Hospital:** ${latestAppt.hospital || 'MEDPARK Hospital'}\n` +
          `* 🩺 **Service / Doctor:** ${latestAppt.serviceName || latestAppt.doctorName || latestAppt.appointmentType || 'Doctor Consultation'}\n` +
          `* 📅 **Scheduled Slot:** **${latestAppt.date || 'N/A'}** at ⏰ **${latestAppt.time || 'N/A'}**\n` +
          `* 📊 **Booking Status:** **${latestAppt.status || 'Pending'}**\n` +
          `* 💳 **Payment Status:** ${String(latestAppt.paymentStatus).toLowerCase() === 'paid' ? '💳 Paid (₹' + (latestAppt.paymentAmount || latestAppt.servicePrice || 500) + ')' : '⏳ Unpaid'}\n` +
          (isCancelled ? `\n> ℹ️ *Cancellation Reason: ${latestAppt.cancellationReason || 'Cancelled by user'}* (Refund: ₹${latestAppt.refundAmount || 0})` : '') +
          otherList +
          `\n\nWould you like to open this booking in your portal or download your invoice PDF?`;

        const dynamicQuickReplies = userAppts.slice(0, 2).map((a) => `Track #${a.appointment_number || a.id}`)
          .concat(['Download Invoice PDF', 'Book Another Appointment', 'Explore Hospitals']);

        return res.json({
          reply,
          intent: 'track_appointment',
          appointment: latestAppt,
          quickReplies: dynamicQuickReplies,
          action: {
            type: 'view_appointment',
            appointmentId: latestAppt.id,
            appointmentNumber: latestAppt.appointment_number,
            url: `/dashboard/my-appointments?id=${latestAppt.id}`,
            label: '📑 Open in My Appointments'
          }
        });
      } else {
        return res.json({
          reply: `🔍 **Track Your Hospital Appointment or Diagnostic Test**\n\n` +
            `To look up your appointment details in chat:\n\n` +
            `* 🔢 **Reply with your 4-digit appointment reference number** (e.g. **\`#1042\`** or \`4849\`).\n` +
            `* 📑 Or visit your [My Appointments](/dashboard/my-appointments) portal to view and manage all your scheduled consultations.`,
          intent: 'track_appointment_prompt',
          quickReplies: ['View My Appointments', 'Book Doctor Appointment', 'Contact Helpdesk'],
          action: {
            type: 'view_appointments',
            url: '/dashboard/my-appointments',
            label: '📑 Go to My Appointments'
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 1B. INVOICE & RECEIPT DOWNLOAD INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('download invoice') ||
      lower.includes('invoice') ||
      lower.includes('receipt') ||
      lower.includes('tax invoice') ||
      lower.includes('bill')
    ) {
      const invNumMatch = text.match(/(?:#|appointment\s*#?|ticket\s*#?|invoice\s*#?)?\b(\d{4})\b/i);
      let appt = null;
      if (invNumMatch) {
        appt = await findAppointmentByNumber(invNumMatch[1]);
      } else {
        const userAppts = await getUserAppointments(user);
        if (userAppts && userAppts.length > 0) appt = userAppts[0];
      }

      if (appt) {
        const isPaid = String(appt.paymentStatus).toLowerCase() === 'paid';
        return res.json({
          reply: `📄 **GST Tax Invoice & Payment Receipt for Appointment #${appt.appointment_number || appt.id}**\n\n` +
            `* 👤 **Patient:** ${appt.patientName || 'Patient'}\n` +
            `* 🏥 **Hospital:** ${appt.hospital || 'MEDPARK Multi-Specialty Hospital'}\n` +
            `* 🩺 **Service:** ${appt.serviceName || appt.doctorName || 'Consultation'}\n` +
            `* 📅 **Slot:** **${appt.date}** @ ⏰ **${appt.time}**\n` +
            `* 💳 **Payment Status:** ${isPaid ? '🟢 Paid' : '⏳ Counter Payment'}\n` +
            `* 🆔 **Payment ID:** \`${appt.paymentId || 'N/A'}\`\n` +
            `* 💰 **Amount:** **₹${appt.paymentAmount || appt.servicePrice || 500}**\n\n` +
            `Click the button below to download or view your official GST invoice PDF:`,
          intent: 'download_invoice',
          appointment: appt,
          action: {
            type: 'download_invoice',
            appointmentId: appt.id,
            appointmentNumber: appt.appointment_number,
            url: `/api/appointments/${appt.id}/invoice`,
            label: `📄 Download Invoice PDF (#${appt.appointment_number || appt.id})`
          },
          quickReplies: [
            `Track #${appt.appointment_number || appt.id}`,
            '📋 What Documents to Bring',
            'View My Appointments',
            'Book Another Appointment'
          ]
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
    // 3. CHECK COMPREHENSIVE KNOWLEDGE BASE / FAQS FIRST
    // ─────────────────────────────────────────────────────────────
    for (const faq of KNOWLEDGE_FAQS) {
      const match = faq.keywords.some((k) => lower.includes(k));
      if (match) {
        return res.json({
          reply: faq.reply,
          intent: faq.id,
          quickReplies: faq.quickReplies || ['Book Doctor', 'Lab Tests & Prices', 'Track Appointment #', 'Emergency Helpline'],
          action: faq.action || null
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. INITIATE IN-CHAT BOOK APPOINTMENT FLOW
    // ─────────────────────────────────────────────────────────────
    const isBookingQuery = !isTrackingQuery && (
      lower.includes('book') ||
      lower.includes('reserve') ||
      lower.includes('schedule') ||
      lower.includes('see a doctor') ||
      lower.includes('doctor visit') ||
      lower === 'book' ||
      lower === 'book doctor' ||
      lower === 'book appointment' ||
      (lower.includes('appointment') && !lower.includes('track') && !lower.includes('status') && !lower.includes('my appointment'))
    );

    if (isBookingQuery) {
      const detectedSpec = detectSpecialty(text);

      if (detectedSpec) {
        const hospitals = await getHospitalList();
        const topHosp = hospitals.slice(0, 4).map(h => h.name);

        return res.json({
          reply: `🩺 **Specialty Selected:** **${detectedSpec}**\n\n` +
            `🏥 **Step 2 of 4: Please choose your preferred hospital or clinic:**\n` +
            `Select a hospital from the options below or click **"See More Hospitals"** to view all network branches:`,
          intent: 'booking_step_hospital',
          hospitals: hospitals,
          quickReplies: [...topHosp, 'View More Hospitals 🏥', '⬅️ Back', '❌ Cancel Booking'],
          context: {
            bookingState: {
              step: 'hospital',
              specialty: detectedSpec
            }
          }
        });
      }

      return res.json({
        reply: `🩺 **Let's book your appointment right here in chat!**\n\n` +
          `**Step 1 of 4: Which medical specialty or service do you need?**`,
        intent: 'booking_step_specialty',
        quickReplies: [
          'Cardiology ❤️',
          'Neurology 🧠',
          'Orthopedics 🦴',
          'Pediatrics 👶',
          'General Medicine 🩺',
          'Dermatology ✨',
          'Gynecology 🌸',
          'Lab Blood Test 🧪',
          'Dental Care 🦷',
          '❌ Cancel Booking'
        ],
        context: {
          bookingState: {
            step: 'specialty'
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. DIAGNOSTIC LAB TESTS & SERVICES INTENT
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
      const testListMarkdown = POPULAR_LAB_TESTS.slice(0, 6)
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
    // 6. EMERGENCY & HELPLINE INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('emergency') ||
      lower.includes('ambulance') ||
      lower.includes('urgent') ||
      lower.includes('casualty') ||
      lower.includes('trauma') ||
      lower.includes('helpline') ||
      lower.includes('critical care') ||
      lower.includes('call doctor') ||
      (lower.includes('icu') && !lower.includes('bed') && !lower.includes('hospital'))
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
    // 7. SPECIALTIES & DOCTOR DISCOVERY INTENT
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
    // 8. PRICING & HOSPITAL SOFTWARE SUBSCRIPTIONS INTENT
    // ─────────────────────────────────────────────────────────────
    if (
      lower.includes('pricing') ||
      lower.includes('plan') ||
      lower.includes('subscription') ||
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
    // 10. HOSPITALS, LOCATIONS & BEDS INTENT
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
    // 11. CONTACT & SUPPORT INTENT
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
    // 12. GENERAL AI / FALLBACK RESPONSES
    // ─────────────────────────────────────────────────────────────
    return res.json({
      reply: `I understand you are asking about *"**${text.length > 50 ? text.slice(0, 50) + '...' : text}**"*. \n\n` +
        `Here is what I can help you with immediately:\n` +
        `* 🩺 **Book an Appointment** with top specialist doctors.\n` +
        `* 🧪 **Book Diagnostic Lab Tests** (CBC, Lipid, Thyroid, LFT, ECG).\n` +
        `* 🔍 **Track your Appointment Status** (just enter your 4-digit number e.g. **#1042**).\n` +
        `* 📋 **Preparation & Documents to Bring** for visits.\n` +
        `* 🕒 **Hospital Visiting Hours & ICU Guidelines**.\n` +
        `* 🏥 **Discover Accredited Hospitals** & ICU Bed counts.\n` +
        `* 🚨 **24/7 Emergency Helplines** & ambulance dispatch.\n` +
        `* 💳 **Hospital Software Pricing & Demo Booking**.\n\n` +
        `Please select one of the quick options below or ask your question!`,
      intent: 'general_fallback',
      quickReplies: [
        '🩺 How to Book',
        '📋 What Documents to Bring',
        '🧪 Fasting Guidelines for Tests',
        '🕒 Hospital Visiting Hours',
        '💰 Doctor Consultation Fees',
        '🚨 Emergency Helplines'
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
    { title: 'How to Book Appointment', prompt: 'How do I book an appointment with a doctor?', icon: '🩺' },
    { title: 'What Documents to Bring', prompt: 'What documents do I need to bring for my appointment?', icon: '📋' },
    { title: 'Fasting for Blood Tests', prompt: 'Do I need to fast before a blood test?', icon: '🧪' },
    { title: 'Full Body Health Checkups', prompt: 'What full body master health checkup packages do you offer?', icon: '💎' },
    { title: 'Vaccination Schedules', prompt: 'Tell me about child and adult vaccination schedules', icon: '💉' },
    { title: 'Maternity & Delivery Packages', prompt: 'What are the maternity and delivery packages?', icon: '🌸' },
    { title: 'Home Blood Sample Collection', prompt: 'How can I book a blood test sample collection at home?', icon: '🏠' },
    { title: 'Senior Citizen Care', prompt: 'What facilities and discounts are available for senior citizens?', icon: '👴' },
    { title: 'Hospital Visiting Hours', prompt: 'What are the hospital visiting hours for patients?', icon: '🕒' },
    { title: 'Doctor Consultation Fees', prompt: 'What are the doctor consultation fees by department?', icon: '💰' },
    { title: 'Insurance & Cashless TPA', prompt: 'Do you accept health insurance and cashless Mediclaim?', icon: '🛡️' },
    { title: 'Hospital Admission & Discharge', prompt: 'How does the hospital admission and discharge process work?', icon: '🛏️' },
    { title: 'Physiotherapy & Rehab', prompt: 'What physiotherapy services are offered?', icon: '🏃' },
    { title: 'Blood Donation & Blood Bank', prompt: 'How can I donate blood or check blood bank availability?', icon: '🩸' },
    { title: 'Track My Booking', prompt: 'Track my appointment status', icon: '🔍' },
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
