// emailService.ts
import nodemailer from 'nodemailer';

// Log environment variables for debugging (remove in production)
console.log('[DEBUG] Email Configuration:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER ? '***SET***' : 'NOT SET',
  pass: process.env.SMTP_PASS ? '***SET***' : 'NOT SET',
});

// Validate required environment variables
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('[ERROR] SMTP_USER or SMTP_PASS is not set in environment variables!');
  console.error('[ERROR] Please check your .env file and ensure it is being loaded correctly.');
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true, // Enable debug output
  logger: true, // Log to console
});

interface AttendanceEmailOptions {
  studentName: string;
  studentEmail: string;
  activityName: string;
  status: 'present' | 'absent';
  date: string;
  guardianEmail?: string;
  sessionsRemaining?: number;
  sessionsAttended?: number;
  sessionsPurchased?: number;
}

export const sendAttendanceEmail = async (options: AttendanceEmailOptions): Promise<boolean> => {
  try {
    const { 
      studentName, 
      studentEmail, 
      activityName, 
      status, 
      date, 
      guardianEmail,
      sessionsRemaining = 0,
      sessionsAttended = 0,
      sessionsPurchased = 0
    } = options;

    const statusText = status === 'present' ? 'Present' : 'Absent';
    const statusColor = status === 'present' ? '#10b981' : '#ef4444';
    const statusEmoji = status === 'present' ? '✅' : '❌';

    // Determine session status color
    const getSessionStatusColor = () => {
      if (sessionsRemaining === 0) return '#ef4444'; // Red - no sessions left
      if (sessionsRemaining <= 3) return '#f59e0b'; // Orange - low sessions
      return '#10b981'; // Green - good
    };

    const sessionStatusColor = getSessionStatusColor();

    // HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .header {
            background-color: #1e40af;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            color: white;
            background-color: ${statusColor};
            margin: 10px 0;
          }
          .info-row {
            margin: 15px 0;
            padding: 10px;
            background-color: #f3f4f6;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding: 20px;
            color: #6b7280;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏫 Westfields International School</h1>
            <p>After-School Activity Attendance Notification</p>
          </div>
          <div class="content">
            <h2>Attendance Record ${statusEmoji}</h2>
            <p>Dear Parent/Guardian,</p>
            <p>This is to inform you about the attendance status for <strong>${studentName}</strong>.</p>
            
            <div class="info-row">
              <strong>Student:</strong> ${studentName}
            </div>
            <div class="info-row">
              <strong>Activity:</strong> ${activityName}
            </div>
            <div class="info-row">
              <strong>Date:</strong> ${date}
            </div>
            <div class="info-row">
              <strong>Status:</strong> <span class="status-badge">${statusText}</span>
            </div>

            <!-- Session Information -->
            <div style="margin-top: 25px; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #1e40af; font-size: 16px;">📊 Session Summary</h3>
              <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                <span><strong>Sessions Purchased:</strong></span>
                <span style="font-weight: bold; color: #3b82f6;">${sessionsPurchased}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                <span><strong>Sessions Attended:</strong></span>
                <span style="font-weight: bold; color: #6b7280;">${sessionsAttended}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 10px 0; padding-top: 10px; border-top: 2px solid #e5e7eb;">
                <span><strong>Sessions Remaining:</strong></span>
                <span style="font-weight: bold; font-size: 18px; color: ${sessionStatusColor};">${sessionsRemaining}</span>
              </div>
              ${sessionsRemaining === 0 
                ? '<p style="color: #ef4444; margin-top: 10px; font-size: 14px;">⚠️ <strong>No sessions remaining!</strong> Please purchase more sessions to continue.</p>'
                : sessionsRemaining <= 3
                ? '<p style="color: #f59e0b; margin-top: 10px; font-size: 14px;">⚠️ <strong>Low session balance!</strong> Only ${sessionsRemaining} sessions remaining. Please consider purchasing more sessions soon.</p>'
                : '<p style="color: #10b981; margin-top: 10px; font-size: 14px;">✅ Session balance is healthy.</p>'
              }
            </div>

            ${status === 'present' 
              ? '<p style="color: #10b981; margin-top: 20px;">✅ Your child attended the activity today.</p>'
              : '<p style="color: #ef4444; margin-top: 20px;">❌ Your child was marked as absent for today\'s activity.</p>'
            }

            <p style="margin-top: 30px;">If you have any questions or concerns, please contact the school office.</p>
            
            <p style="margin-top: 20px;">Best regards,<br>
            <strong>Westfields International School</strong><br>
            After-School Activities Program</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Westfields International School. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
Westfields International School
After-School Activity Attendance Notification

Dear Parent/Guardian,

This is to inform you about the attendance status for ${studentName}.

Student: ${studentName}
Activity: ${activityName}
Date: ${date}
Status: ${statusText}

SESSION SUMMARY
===============
Sessions Purchased: ${sessionsPurchased}
Sessions Attended: ${sessionsAttended}
Sessions Remaining: ${sessionsRemaining}

${sessionsRemaining === 0 
  ? '⚠️ WARNING: No sessions remaining! Please purchase more sessions to continue.'
  : sessionsRemaining <= 3
  ? `⚠️ LOW BALANCE: Only ${sessionsRemaining} sessions remaining. Please consider purchasing more sessions soon.`
  : '✅ Session balance is healthy.'
}

${status === 'present' 
  ? 'Your child attended the activity today.'
  : 'Your child was marked as absent for today\'s activity.'
}

If you have any questions or concerns, please contact the school office.

Best regards,
Westfields International School
After-School Activities Program

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} Westfields International School. All rights reserved.
    `;

    // Prepare recipients (student email and guardian email if available)
    const recipients = [studentEmail];
    if (guardianEmail && guardianEmail.trim()) {
      recipients.push(guardianEmail);
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"Westfields International School" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject: `Attendance Notification - ${activityName} - ${statusText}`,
      text: textContent,
      html: htmlContent,
    });

    console.log('[DEBUG] Email sent successfully:', {
      messageId: info.messageId,
      recipients,
      status: statusText,
    });

    return true;
  } catch (error) {
    console.error('[ERROR] Failed to send email:', error);
    return false;
  }
};

// Test email configuration
export const testEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('[DEBUG] Email server connection verified successfully');
    return true;
  } catch (error) {
    console.error('[ERROR] Email server connection failed:', error);
    return false;
  }
};