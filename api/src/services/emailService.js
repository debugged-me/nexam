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
  ? [{
      filename: 'favicon.png',
      path: LOGO_PATH,
      cid: 'nexam-logo',
      // Gmail hides CID images attached with the default "attachment"
      // disposition — inline is required for the img tag to render.
      contentDisposition: 'inline',
      contentType: 'image/png',
    }]
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

/** Build the HTML body for a staff-provisioned account's credentials. */
function buildCredentialsEmail(name, email, password, role) {
  const subject = 'nexam — Your account credentials';
  const roleLabel = role === 'admin' ? 'Admin (instructor management)' : 'Instructor';
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
      <div style="font-size:19px;font-weight:700;color:#26292E;letter-spacing:-0.3px">Your nexam account</div>
      <div style="margin-top:16px;font-size:14px;line-height:1.6;color:#4E545B">
        Hi ${escapeHtml(name)},
      </div>
      <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#4E545B">
        An account has been created for you with the position <strong>${escapeHtml(roleLabel)}</strong>.
        Sign in with these credentials:
      </div>

      <!-- Credentials -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="background:#F6F8FA;border:1px solid #E8EBEF;border-radius:10px;padding:16px 18px;font-family:'SF Mono','Consolas',monospace;font-size:13.5px;color:#26292E">
        <div style="margin-bottom:8px"><span style="color:#959BA3">Email&nbsp;&nbsp;&nbsp;&nbsp;</span>${escapeHtml(email)}</div>
        <div><span style="color:#959BA3">Password&nbsp;</span><strong>${escapeHtml(password)}</strong></div>
      </td></tr></table>

      <!-- Security note -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>
        <td style="background:#FFF8E6;border:1px solid #F0E3B8;border-radius:8px;padding:11px 14px;font-size:12.5px;line-height:1.55;color:#6B5A1E">
          Change this password after your first sign-in (Account → Change password). Never share it — nexam staff will never ask for it.
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

  const text = `Hi ${name},\n\nA nexam account has been created for you (${roleLabel}).\n\nSign in with:\n  Email: ${email}\n  Password: ${password}\n\nChange this password after your first sign-in. Never share it.\n\n— nexam`;
  return { subject, html, text };
}

/** Build the HTML body for a staff-initiated password-reset link. */
function buildResetLinkEmail(name, link) {
  const subject = 'nexam — Reset your password';
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
      <div style="font-size:19px;font-weight:700;color:#26292E;letter-spacing:-0.3px">Reset your password</div>
      <div style="margin-top:16px;font-size:14px;line-height:1.6;color:#4E545B">
        Hi ${escapeHtml(name)},
      </div>
      <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#4E545B">
        An administrator requested a password reset for your account. Use the button
        below to choose a new password — the link is valid for <strong>30 minutes</strong>
        and can only be used once.
      </div>

      <!-- CTA -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:26px 0 8px">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#2383E2;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">Set a new password</a>
      </td></tr>
      <tr><td style="font-size:11.5px;line-height:1.55;color:#959BA3;word-break:break-all">
        If the button doesn't work, paste this link into your browser:<br>${escapeHtml(link)}
      </td></tr></table>

      <!-- Security note -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>
        <td style="background:#FFF8E6;border:1px solid #F0E3B8;border-radius:8px;padding:11px 14px;font-size:12.5px;line-height:1.55;color:#6B5A1E">
          Never share this link with anyone. If you did not expect a reset, you can ignore this email and your password stays unchanged.
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

  const text = `Hi ${name},\n\nAn administrator requested a password reset for your account.\n\nSet a new password (link valid for 30 minutes, single use):\n${link}\n\nIf you did not expect this, ignore this email — your password stays unchanged.\n\n— nexam`;
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

/**
 * Send a staff-provisioned account's generated credentials.
 * @returns {Promise<boolean>} true if the mail server accepted the message.
 */
export async function sendCredentialsEmail(toEmail, name, password, role) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] SMTP_PASS not configured — credentials email not sent.');
    return false;
  }

  const { subject, html, text } = buildCredentialsEmail(name, toEmail, password, role);

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
    const domain = (toEmail.split('@')[1] || 'unknown');
    console.error(`[email] Credentials delivery failed for ${domain}: ${err.message}`);
    return false;
  }
}

/**
 * Send a staff-initiated single-use password-reset link.
 * @returns {Promise<boolean>} true if the mail server accepted the message.
 */
export async function sendResetLinkEmail(toEmail, name, link) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] SMTP_PASS not configured — reset link email not sent.');
    return false;
  }

  const { subject, html, text } = buildResetLinkEmail(name, link);

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
    const domain = (toEmail.split('@')[1] || 'unknown');
    console.error(`[email] Reset link delivery failed for ${domain}: ${err.message}`);
    return false;
  }
}

export default { sendOtpEmail, sendCredentialsEmail, sendResetLinkEmail };
