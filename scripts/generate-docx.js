const fs = require('fs');
const htmlToDocx = require('html-to-docx');
const path = require('path');

const htmlString = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body>
    <h1 style="text-align: center; color: #2563eb;">Hospital Management System</h1>
    <h2 style="text-align: center; color: #475569;">Complete Project & Architecture Documentation</h2>
    <p>This document serves as the complete, detailed guide for the Hospital Management System. It explains the entire technology stack, the database structure (including all tables and columns), and a step-by-step breakdown of every major working flow in the application.</p>

    <br/>
    <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">1. Technology Stack</h2>
    
    <h3 style="color: #3b82f6;">Frontend (Client-Side)</h3>
    <ul>
        <li><strong>React.js (v18)</strong>: Core library used to build the user interface using functional components and hooks.</li>
        <li><strong>Vite</strong>: The ultra-fast build tool and development server, replacing Webpack.</li>
        <li><strong>Tailwind CSS (v4)</strong>: A utility-first CSS framework for completely custom, responsive styling. Provides the premium aesthetics, modern color palettes, and glassmorphism effects.</li>
        <li><strong>Framer Motion</strong>: Used heavily for micro-animations, slide-in drawers, and page transitions to make the UI feel alive.</li>
        <li><strong>Lucide React</strong>: The primary icon library used across all dashboards.</li>
        <li><strong>Chart.js & Recharts</strong>: Used to draw the interactive line charts and bar graphs in the Super Admin and Admin overview panels.</li>
    </ul>

    <h3 style="color: #3b82f6;">Backend (Server-Side)</h3>
    <ul>
        <li><strong>Node.js & Express.js</strong>: Handles the REST APIs, routing, and server logic.</li>
        <li><strong>Supabase (PostgreSQL)</strong>: The primary cloud database handling all relational data, ensuring high performance.</li>
        <li><strong>WebSockets (ws)</strong>: Used for native real-time bidirectional communication. If a new appointment is booked, the backend broadcasts a WebSocket message, instantly updating the Admin dashboard badges without a page refresh.</li>
        <li><strong>Nodemailer (OAuth2)</strong>: Handles all automated email sending (demo invites, registration approvals, appointment confirmations). Configured to use Gmail API for high deliverability.</li>
        <li><strong>Stripe</strong>: Processes secure payments and manages monthly/yearly hospital subscriptions.</li>
        <li><strong>JSON Web Tokens (JWT)</strong>: Used for stateless authentication. Every API request includes a JWT token to verify identity.</li>
    </ul>

    <br/>
    <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">2. Database Architecture (Supabase / PostgreSQL)</h2>
    <p>Below are all the primary tables in the database along with their exact columns.</p>

    <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th>Table Name</th>
                <th>Columns</th>
                <th>Purpose</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>users</strong></td>
                <td><code>id, name, email, mobile, password, role, hospital, hospitalId, active, resetOtp, resetOtpExpires, createdAt, plan_key, plan_start, plan_end, plan_status, pending_email, reset_otp, reset_otp_expires, updated_at, otp, otp_expires, phone</code></td>
                <td>Stores all accounts (Super Admins, Hospital Admins, Doctors, Patients). Links to the hospital via <code>hospitalId</code>.</td>
            </tr>
            <tr>
                <td><strong>hospitals</strong></td>
                <td><code>id, name, location, icu, careType, specialty, beds, contact, videoUrl, email, timings, emergency, imageUrl, createdAt</code></td>
                <td>Stores the core hospital profile. Acts as the central anchor for staff and appointments.</td>
            </tr>
            <tr>
                <td><strong>demo_bookings</strong></td>
                <td><code>id, hospital_name, contact_name, email, phone, city, message, status, scheduled_at, meeting_link, calendly_event_uri, schedule_token, feedback_token, created_at, updated_at, completed_at</code></td>
                <td>Initial pipeline for prospects requesting a product demo.</td>
            </tr>
            <tr>
                <td><strong>payments</strong></td>
                <td><code>id, booking_id, email, stripe_session_id, amount, currency, status, created_at, updated_at, plan_key</code></td>
                <td>Tracks all raw payment transactions processed by Stripe.</td>
            </tr>
            <tr>
                <td><strong>subscriptions</strong></td>
                <td><code>id, user_id, hospital_id, plan_key, plan_type, stripe_subscription_id, stripe_customer_id, status, start_date, expiry_date, amount, currency, created_at, updated_at</code></td>
                <td>Tracks the active subscription tier (e.g. Enterprise Monthly) and calculates the exact expiry date for access control.</td>
            </tr>
            <tr>
                <td><strong>registrations</strong></td>
                <td><code>id, booking_id, username, hospital_name, contact_name, email, phone, city, address, beds, details, status, admin_user_id, hospital_id, created_at, updated_at</code></td>
                <td>The main onboarding table where a hospital officially signs up.</td>
            </tr>
            <tr>
                <td><strong>appointments</strong></td>
                <td><code>id, userId, hospitalId, hospital, doctorName, date, time, patientName, patientPhone, email, reason, petName, species, appointmentType, status, source, createdAt, updatedAt, google_event_id, appointment_number, google_meet_link, sex, breed</code></td>
                <td>Stores all patient appointments across all hospitals.</td>
            </tr>
            <tr>
                <td><strong>appointment_feedbacks</strong></td>
                <td><code>id, patientname, petname, appointmenttype, date, time, feedbackstatus, feedbackgiven, callattempted, callpicked, feedbacktext, hospitalid, createdby, created_at, rating, appointmentType, callAttempted, callPicked, createdBy, feedbackGiven, feedbackStatus, feedbackText, patientName, petName, appointment_id</code></td>
                <td>Stores the reviews and call status logging after an appointment is completed.</td>
            </tr>
            <tr>
                <td><strong>contacts</strong></td>
                <td><code>id, name, email, phone, subject, message, status, feedback, responded_at, responded_by, created_at, updated_at</code></td>
                <td>Stores messages submitted through the public Contact Us page.</td>
            </tr>
        </tbody>
    </table>

    <br/>
    <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">3. Complete Working Flows</h2>
    <p>Below are detailed, step-by-step breakdowns of the most important workflows in the system.</p>

    <h3 style="color: #3b82f6;">A. Hospital Onboarding Flow (Demo to Registration to Approval)</h3>
    <ol>
        <li><strong>Prospect Requests a Demo</strong>: A prospective hospital fills out the "Book a Demo" form on the public website. The data is saved to <code>demo_bookings</code> with a status of <code>requested</code>. An automated email is sent to the prospect, and a WebSocket event instantly alerts the Super Admin by increasing their badge count.</li>
        <li><strong>Scheduling the Demo</strong>: The Super Admin reviews the request, generates a unique scheduling link (integrated with Calendly or a custom portal), and sends the invite via the dashboard. The status changes to <code>invited</code>.</li>
        <li><strong>Completing the Demo</strong>: The prospect selects a time. After the meeting takes place, the Super Admin manually marks the demo as <code>completed</code>.</li>
        <li><strong>Payment & Registration</strong>: The interested prospect is given a link to select a pricing plan. They are redirected to a secure Stripe Checkout page. Once paid, the system automatically redirects them to the final Registration Form.</li>
        <li><strong>Finalizing Details</strong>: The prospect fills out their final hospital details (beds, address, username, password). This creates a record in the <code>registrations</code> table with a <code>pending</code> status.</li>
        <li><strong>Super Admin Approval & Automation</strong>: This is the most crucial automated step. When the Super Admin clicks "Approve":
            <ul>
                <li>The system automatically creates a permanent Admin user in the <code>users</code> table.</li>
                <li>It creates an active record in the <code>subscriptions</code> table linking the hospital to the plan they paid for.</li>
                <li>An automated Welcome Email is sent to the hospital containing their login credentials.</li>
                <li><strong>Cleanup:</strong> To keep the database clean, the backend automatically locates and deletes the original <code>demo_bookings</code> record for that user. A WebSocket event tells the Super Admin UI to instantly remove that demo row from the screen.</li>
            </ul>
        </li>
    </ol>

    <h3 style="color: #3b82f6;">B. Patient Appointment Flow</h3>
    <ol>
        <li><strong>Booking</strong>: A patient visits a specific hospital's portal. They view available timings and select a slot. They fill out their patient details and reason for visit.</li>
        <li><strong>Database Insertion</strong>: The backend creates a new row in the <code>appointments</code> table with status <code>pending</code>.</li>
        <li><strong>Real-Time Alert</strong>: A WebSocket <code>appointment_created</code> event fires. The Hospital Admin sitting at the front desk sees the new appointment pop up on their screen instantly, and the sidebar badge increments.</li>
        <li><strong>Approval & Confirmation</strong>: The Hospital Admin reviews and accepts the appointment. An automated email goes out to the patient with a Google Meet link (if it is a video consultation) or physical directions.</li>
        <li><strong>Completion</strong>: After the appointment time passes, the Admin marks it as <code>completed</code>.</li>
    </ol>

    <h3 style="color: #3b82f6;">C. Feedback & Follow-up Flow</h3>
    <ol>
        <li><strong>Post-Appointment Automation</strong>: Once an appointment is marked completed, a record is automatically generated in the <code>appointment_feedbacks</code> table with a status of <code>pending</code>.</li>
        <li><strong>Calling the Patient</strong>: The hospital staff uses the Feedback dashboard to log their follow-up calls. They can track whether the call was <code>attempted</code> and <code>picked_up</code>.</li>
        <li><strong>Logging the Feedback</strong>: Once the patient provides a rating and a written review, the staff updates the row. The system marks <code>feedbackGiven</code> as true and saves the text to the <code>feedbackText</code> column.</li>
    </ol>

    <h3 style="color: #3b82f6;">D. Public Contact Enquiries</h3>
    <ol>
        <li><strong>Submission</strong>: A user submits a query through the public Contact page.</li>
        <li><strong>Database & Alert</strong>: Saved to <code>contacts</code> table. Super Admin receives a real-time WebSocket alert.</li>
        <li><strong>Response</strong>: The Super Admin opens a drawer on the Contact Dashboard, writes a reply, and clicks Send.</li>
        <li><strong>Dispatch</strong>: The backend uses Nodemailer (via Gmail OAuth2) to dispatch the response directly to the user's inbox, and updates the contact status to <code>resolved</code>.</li>
    </ol>
</body>
</html>
`;

async function generateDocx() {
    try {
        const docxBuffer = await htmlToDocx(htmlString, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });

        const outputPath = path.join('C:\\My data\\Projects\\hospital management\\Hospital-Management (2)\\Hospital-Management (2)', 'Hospital_Management_System_Documentation.docx');
        fs.writeFileSync(outputPath, docxBuffer);
        console.log('Successfully generated Word Document at: ' + outputPath);
    } catch (err) {
        console.error('Error generating document:', err);
    }
}

generateDocx();
