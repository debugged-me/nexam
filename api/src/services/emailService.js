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

/* Design tokens mirrored for email — the product's warm ivory canvas, hairline
   borders, and action blue. Font stack leads with Google Sans (renders in
   Gmail/Google clients; other clients fall back cleanly — email clients do
   not reliably load hosted webfonts). */
const FONT = "'Google Sans','Google Sans Text',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "'SF Mono',Consolas,'Roboto Mono','Courier New',monospace";

const BRAND_MARK = LOGO_ATTACHMENT.length
  ? `<img src="cid:nexam-logo" width="28" height="28" alt="" style="display:block;border-radius:7px">`
  : `<div style="width:28px;height:28px;border-radius:7px;background:#2383E2;color:#fff;font-family:${FONT};font-size:14px;font-weight:600;line-height:28px;text-align:center">n</div>`;

/** Shared page furniture: warm canvas → white hairline card → brand row,
 *  content slot → quiet centered footer. `content` is pre-built safe HTML. */
function emailShell(content) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>nexam</title></head>
<body style="margin:0;padding:0;background:#FAF7F2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2">
<tr><td align="center" style="padding:44px 16px 52px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px">

    <tr><td style="background:#FFFFFF;border:1px solid #E9E5DE;border-radius:14px;padding:38px 40px 34px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td>${BRAND_MARK}</td>
        <td style="padding-left:10px;font-family:${FONT};font-size:16px;font-weight:600;color:#1F2328;letter-spacing:-0.3px">nexam</td>
      </tr></table>
      <div style="margin-top:26px;padding-top:28px;border-top:1px solid #EFEDE8">
${content}
      </div>
    </td></tr>

    <tr><td align="center" style="padding:22px 12px 0;font-family:${FONT};font-size:11.5px;line-height:1.6;color:#A8ADB5">
      nexam — TOS-aligned exam builder<br>
      This is an automated message — please do not reply.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const h1 = (text) => `<div style="font-family:${FONT};font-size:21px;font-weight:600;color:#1F2328;letter-spacing:-0.4px;line-height:1.3">${text}</div>`;
const eyebrow = (text) => `<div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.11em;color:#2383E2;text-transform:uppercase;padding-bottom:8px">${text}</div>`;
const para = (html, marginTop = 14) => `<div style="margin-top:${marginTop}px;font-family:${FONT};font-size:14px;line-height:1.65;color:#4B5158">${html}</div>`;
const note = (html) => `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #EFEDE8;font-family:${FONT};font-size:12px;line-height:1.65;color:#8A8F98">${html}</div>`;

/** Build the HTML body for an OTP email (verification or reset). */
function buildOtpEmail(name, otp, isReset = false) {
  const action = isReset ? 'reset your password' : 'verify your email';
  const subject = isReset ? 'nexam — Password Reset Code' : 'nexam — Email Verification Code';

  const content = `
      ${eyebrow(isReset ? 'Password reset' : 'Email verification')}
      ${h1(isReset ? 'Reset your password' : 'Verify your email')}
      ${para(`Hi ${escapeHtml(name)},`)}
      ${para(`Use this code to ${action}. It expires in <strong>15 minutes</strong>.`, 6)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0 4px">
        <div style="display:inline-block;background:#F7F5F1;border:1px solid #E9E5DE;border-radius:10px;padding:16px 38px;font-family:${MONO};font-size:26px;font-weight:600;letter-spacing:7px;color:#1F2328">${escapeHtml(otp)}</div>
      </td></tr></table>
      ${note(`Never share this code — nexam staff will never ask for it.${isReset ? ' If you did not request a reset, you can ignore this email and your password stays unchanged.' : ''}`)}`;

  const text = `Hi ${name},\n\nUse this code to ${action}: ${otp}\n\nThis code expires in 15 minutes. Never share it with anyone${isReset ? ' — if you did not request a reset, you can ignore this email' : ''}.\n\n— nexam`;
  return { subject, html: emailShell(content), text };
}

/** Build the HTML body for a staff-provisioned account's credentials. */
function buildCredentialsEmail(name, email, password, role) {
  const subject = 'nexam — Your account credentials';
  const roleLabel = role === 'admin' ? 'Admin (instructor management)' : 'Instructor';

  const content = `
      ${eyebrow('New account')}
      ${h1('Your nexam account')}
      ${para(`Hi ${escapeHtml(name)},`)}
      ${para(`An account has been created for you as <strong>${escapeHtml(roleLabel)}</strong>. Sign in with these credentials:`, 6)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="background:#F7F5F1;border:1px solid #E9E5DE;border-radius:10px;padding:15px 18px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${MONO};font-size:13px;color:#1F2328">
          <tr><td style="padding:3px 14px 3px 0;color:#8A8F98;font-family:${FONT};font-size:12.5px;white-space:nowrap">Email</td>
              <td style="padding:3px 0">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#8A8F98;font-family:${FONT};font-size:12.5px;white-space:nowrap">Password</td>
              <td style="padding:3px 0"><strong>${escapeHtml(password)}</strong></td></tr>
        </table>
      </td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td>
        <a href="${escapeHtml(env.webUrl)}/login" style="display:inline-block;background:#2383E2;color:#FFFFFF;text-decoration:none;font-family:${FONT};font-size:14px;font-weight:600;padding:12px 26px;border-radius:10px">Sign in to nexam</a>
      </td></tr></table>
      ${note('Change this password after your first sign-in (Account → Change password). Never share it — nexam staff will never ask for it.')}`;

  const text = `Hi ${name},\n\nA nexam account has been created for you (${roleLabel}).\n\nSign in at ${env.webUrl}/login with:\n  Email: ${email}\n  Password: ${password}\n\nChange this password after your first sign-in. Never share it.\n\n— nexam`;
  return { subject, html: emailShell(content), text };
}

/** Build the HTML body for a staff-initiated password-reset link. */
function buildResetLinkEmail(name, link) {
  const subject = 'nexam — Reset your password';

  const content = `
      ${eyebrow('Password reset')}
      ${h1('Set a new password')}
      ${para(`Hi ${escapeHtml(name)},`)}
      ${para(`An administrator requested a password reset for your account. Use the button below to choose a new password — the link is valid for <strong>30 minutes</strong> and can only be used once.`, 6)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:26px 0 10px">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#2383E2;color:#FFFFFF;text-decoration:none;font-family:${FONT};font-size:14px;font-weight:600;padding:13px 32px;border-radius:10px">Set a new password</a>
      </td></tr>
      <tr><td style="font-family:${FONT};font-size:11.5px;line-height:1.6;color:#8A8F98;word-break:break-all">
        If the button doesn't work, paste this link into your browser:<br>
        <a href="${escapeHtml(link)}" style="color:#2383E2;text-decoration:none">${escapeHtml(link)}</a>
      </td></tr></table>
      ${note('Never share this link with anyone. If you did not expect a reset, you can ignore this email and your password stays unchanged.')}`;

  const text = `Hi ${name},\n\nAn administrator requested a password reset for your account.\n\nSet a new password (link valid for 30 minutes, single use):\n${link}\n\nIf you did not expect this, ignore this email — your password stays unchanged.\n\n— nexam`;
  return { subject, html: emailShell(content), text };
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
