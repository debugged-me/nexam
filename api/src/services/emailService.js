/**
 * Email service — sends OTP verification and password-reset codes via SMTP.
 *
 * Uses NEXAM_SMTP_* environment variables for the authenticated institution
 * mailbox. If NEXAM_SMTP_PASS is not set,
 * send() returns false and the caller reports a delivery failure to the user
 * (never silently swallows the failure).
 */
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import env from '../config/env.js';

/** Logo bundled with the API, embedded via CID so it renders offline-blocked
 *  clients too (Gmail strips data URIs; remote images are hidden by default). */
const LOGO_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/favicon.png');
const LOGO_ATTACHMENT = fs.existsSync(LOGO_PATH)
  ? [{ filename: 'favicon.png', path: LOGO_PATH, cid: 'nexam-logo' }]
  : [];

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
  const heading = isReset ? 'Reset your password' : 'Verify your email';
  const logoImg = LOGO_ATTACHMENT.length
    ? `<img src="cid:nexam-logo" width="30" height="30" alt="" style="display:block;border-radius:8px">`
    : `<div style="width:30px;height:30px;border-radius:8px;background:#2383E2;color:#fff;font-size:15px;font-weight:700;line-height:30px;text-align:center">n</div>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F8FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FA;padding:32px 16px">
<tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%">

    <!-- Brand strip -->
    <tr><td style="padding:0 8px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">${logoImg}</td>
        <td style="vertical-align:middle;padding-left:10px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#26292E;letter-spacing:-0.3px">nexam</td>
      </tr></table>
    </td></tr>

    <!-- Card -->
    <tr><td style="background:#FFFFFF;border:1px solid #E8EBEF;border-radius:12px;padding:32px 32px 28px;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
      <div style="font-size:19px;font-weight:700;color:#26292E;letter-spacing:-0.3px">${heading}</div>
      <div style="margin-top:16px;font-size:14px;line-height:1.6;color:#4E545B">
        Hi ${escapeHtml(name)},
      </div>
      <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#4E545B">
        Use the code below to ${action}. It is valid for <strong>15 minutes</strong>.
      </div>

      <!-- OTP -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:26px 0 6px">
        <div style="display:inline-block;background:#F6F8FA;border:1px solid #E8EBEF;border-radius:10px;padding:16px 34px;font-size:30px;font-weight:700;letter-spacing:8px;color:#26292E;font-family:'SF Mono','Consolas',monospace">${escapeHtml(otp)}</div>
      </td></tr></table>

      <!-- Security note -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>
        <td style="background:#FFF8E6;border:1px solid #F0E3B8;border-radius:8px;padding:11px 14px;font-size:12.5px;line-height:1.55;color:#6B5A1E">
          Never share this code with anyone. nexam staff will never ask for it${isReset ? ' — if you did not request a reset, you can ignore this email and your password stays unchanged' : ''}.
        </td>
      </tr></table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 8px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
      <div style="font-size:12px;color:#959BA3;line-height:1.6">
        nexam — TOS-aligned Exam Builder<br>
        This is an automated message, please do not reply.
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const text = `Hi ${name},\n\nUse this code to ${action}: ${otp}\n\nThis code expires in 15 minutes. Never share it with anyone${isReset ? ' — if you did not request a reset, you can ignore this email' : ''}.\n\n— nexam`;
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
      attachments: LOGO_ATTACHMENT,
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
