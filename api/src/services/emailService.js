/**
 * Email service — sends OTP verification and password-reset codes via SMTP.
 *
 * Uses NEXAM_SMTP_* environment variables for the authenticated institution
 * mailbox. If NEXAM_SMTP_PASS is not set,
 * send() returns false and the caller reports a delivery failure to the user
 * (never silently swallows the failure).
 */
import nodemailer from 'nodemailer';
import env from '../config/env.js';

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!env.smtp.pass) return null;

  _transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return _transporter;
}

/** Build the HTML body for an OTP email (verification or reset). */
function buildOtpEmail(name, otp, isReset = false) {
  const action = isReset ? 'reset your password' : 'verify your email';
  const subject = isReset ? 'nexam — Password Reset Code' : 'nexam — Email Verification Code';

  const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
<h2 style="color:#1B3A5B;font-family:Google Sans,sans-serif">nexam</h2>
<p>Hi ${escapeHtml(name)},</p>
<p>Use the code below to ${action}:</p>
<div style="text-align:center;margin:24px 0">
<span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1B3A5B;background:#F4F6FA;padding:16px 32px;border-radius:12px;display:inline-block">${escapeHtml(otp)}</span>
</div>
<p style="color:#64748b;font-size:13px">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="color:#94a3b8;font-size:12px">nexam — TOS-aligned Exam Builder</p>
</body></html>`;

  const text = `Hi ${name},\n\nUse this code to ${action}: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, you can safely ignore this email.\n`;
  return { subject, html, text };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

/**
 * Send an OTP email.
 * @returns {Promise<boolean>} true if the mail server accepted the message.
 */
export async function sendOtpEmail(toEmail, name, otp, isReset = false) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] SMTP_PASS not configured — OTP email not sent.');
    return false;
  }

  const { subject, html, text } = buildOtpEmail(name, otp, isReset);

  try {
    await transporter.sendMail({
      from: `"nexam" <${env.smtp.from}>`,
      replyTo: env.smtp.from,
      to: toEmail,
      subject,
      html,
      text,
    });
    return true;
  } catch (err) {
    // Log only the recipient domain + error code, never the address or body.
    const domain = (toEmail.split('@')[1] || 'unknown');
    console.error(`[email] OTP delivery failed for ${domain}: ${err.message}`);
    return false;
  }
}

export default { sendOtpEmail };
