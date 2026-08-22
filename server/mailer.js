'use strict';

const nodemailer = require('nodemailer');
const config = require('./config');

let transporter = null;

if (config.EMAIL_USER && config.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS },
  });

  // Verify the connection immediately at startup, so a bad password or a
  // blocked network shows up in the log right away instead of silently
  // failing later when a real request comes in.
  transporter.verify((err) => {
    if (err) {
      console.error('[mailer] SMTP connection FAILED:', err.message);
      console.error('[mailer] Emails will NOT be sent until this is fixed. Check EMAIL_USER/EMAIL_PASS in .env, and that outbound port 465 isn\'t blocked by a firewall.');
    } else {
      console.log('[mailer] SMTP connection OK — ready to send as', config.EMAIL_USER);
    }
  });
} else {
  console.warn('[mailer] EMAIL_USER / EMAIL_PASS not set — email notifications are disabled.');
}

/**
 * Sends an email. Never throws — logs and resolves false on failure, so a
 * mail problem never breaks the request/status-update flow that triggered it.
 * @param {{to:string, subject:string, html:string, text:string}} msg
 * @returns {Promise<boolean>}
 */
async function sendMail(msg) {
  if (!transporter) return false;
  if (!msg.to) {
    console.error('[mailer] Skipped sending — no recipient email address was provided.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_USER}>`,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    console.log('[mailer] Sent to', msg.to, '—', msg.subject);
    return true;
  } catch (err) {
    console.error('[mailer] Failed to send email to', msg.to, '-', err.message);
    return false;
  }
}

module.exports = { sendMail };
