'use strict';

const config = require('./config');

/** Mirrors calcExpectedDate() in public/app.js exactly, so the date quoted
 *  in the email always matches what the modal shows in the UI. */
function calcExpectedDate(submittedAtSql, delivery) {
  if (!submittedAtSql) return '—';
  const d = new Date(submittedAtSql.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '—';
  const workingDays = delivery === 'Urgent' ? 10 : 20;
  let count = 0;
  const current = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (count < workingDays) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return current.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Shared visual wrapper so every email looks consistent. */
function wrap({ heading, intro, rows, footerNote }) {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px;width:150px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`).join('');

  const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f5f7;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0f766e;padding:22px 28px;">
      <div style="color:#ffffff;font-size:16px;font-weight:700;">${config.UNIVERSITY_NAME}</div>
      <div style="color:#ccfbf1;font-size:12px;margin-top:2px;">Document Request Portal</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 12px 0;color:#111827;font-size:18px;">${heading}</h2>
      <p style="margin:0 0 20px 0;color:#374151;font-size:14px;line-height:1.6;">${intro}</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:4px 0;">
        ${rowsHtml}
      </table>
      <p style="margin:22px 0 0 0;color:#6b7280;font-size:12.5px;line-height:1.6;">${footerNote || ''}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 28px;color:#9ca3af;font-size:11.5px;text-align:center;">
      This is an automated message from the ${config.UNIVERSITY_NAME} document portal. Please do not reply to this email.
    </div>
  </div>
</div>`.trim();

  return html;
}

function toText(rows, intro) {
  return intro + '\n\n' + rows.map(([label, value]) => `${label}: ${String(value).replace(/<[^>]+>/g, '')}`).join('\n');
}

/** Helper to format courier option label for email notifications */
function formatCourierLabel(courier) {
  if (courier === 'local') return 'Local Courier (within Pakistan)';
  if (courier === 'intl') return 'International Courier';
  return 'Counter Pickup (No Courier)';
}

/** Sent when a request is first submitted at the counter. */
function receivedEmailTemplate(request) {
  const expectedDate = calcExpectedDate(request.submitted_at || request.datetime_fmt, request.delivery);
  const courier = request.courier || 'none';
  const courierLabel = formatCourierLabel(courier);

  const rows = [
    ['Request ID', request.id],
    ['Document', request.doc_label || request.docLabel],
    ['Section', request.dept],
    ['Delivery Type', request.delivery || 'Normal'],
    ['Courier Option', courierLabel],
    ['Expected By', expectedDate],
  ];

  let intro = `Dear ${request.student_name || request.name}, your document request has been recorded and is now being processed.`;
  let footerNote = 'Please keep your Request ID for reference.';

  if (courier === 'local') {
    intro += ' Once completed, your document will be dispatched to your address via Local Courier.';
    footerNote += ' You will receive notification once your package is handed over to the courier.';
  } else if (courier === 'intl') {
    intro += ' Once completed, your document will be dispatched to your overseas address via International Courier.';
    footerNote += ' You will receive notification once your package is handed over to the courier.';
  } else {
    intro += ' You will receive another email once your document is ready for collection at the counter.';
    footerNote += ' You can use your Request ID to check status or collect your document at the counter.';
  }

  return {
    to: request.email,
    subject: `Request Received — ${request.id}`,
    html: wrap({
      heading: 'Request Received',
      intro,
      rows,
      footerNote,
    }),
    text: toText(rows, intro),
  };
}

/** Sent when a request's status is changed to Completed by any section. */
function completedEmailTemplate(request) {
  const courier = request.courier || 'none';
  const courierLabel = formatCourierLabel(courier);

  const rows = [
    ['Request ID', request.id],
    ['Document', request.doc_label || request.docLabel],
    ['Section', request.dept],
    ['Courier Option', courierLabel],
  ];

  let subject = `Document Ready — ${request.id}`;
  let heading = 'Your Document Is Ready';
  let intro = `Dear ${request.student_name || request.name}, your document has been prepared.`;
  let footerNote = 'Thank you for using the University Examination Department portal.';

  if (courier === 'local') {
    subject = `Document Dispatched via Local Courier — ${request.id}`;
    heading = 'Your Document Has Been Dispatched';
    intro += ' It has been prepared and dispatched via Local Courier to your registered address.';
    footerNote = 'Please ensure someone is available at your address to receive the delivery. Keep your Request ID for reference.';
  } else if (courier === 'intl') {
    subject = `Document Dispatched via International Courier — ${request.id}`;
    heading = 'Your Document Has Been Dispatched';
    intro += ' It has been prepared and dispatched via International Courier to your overseas address.';
    footerNote = 'Your document package is on its way. Keep your Request ID for tracking reference.';
  } else {
    subject = `Document Ready for Collection — ${request.id}`;
    heading = 'Your Document Is Ready for Collection';
    intro += ' It is ready for collection at the Examination Department counter.';
    footerNote = 'Please bring a valid CNIC/ID and your Request ID when collecting your document at the counter.';
  }

  return {
    to: request.email,
    subject,
    html: wrap({
      heading,
      intro,
      rows,
      footerNote,
    }),
    text: toText(rows, intro),
  };
}

/** Sent when a user requests a password reset link. */
function passwordResetEmailTemplate(user, resetUrl) {
  const rows = [
    ['Account', user.username],
    ['Requested For', user.email],
    ['Link Expires', 'In 1 hour'],
  ];
  const intro = `A password reset was requested for your ExamPortal account. Click the button below to choose a new password. If you didn't request this, you can safely ignore this email.`;

  const html = wrap({
    heading: 'Reset Your Password',
    intro,
    rows,
    footerNote: `If the button doesn't work, copy and paste this link into your browser: ${resetUrl}`,
  }).replace(
    '</table>',
    `</table>
      <div style="text-align:center;margin-top:24px;">
        <a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">Reset Password</a>
      </div>`
  );

  return {
    to: user.email,
    subject: 'Reset Your ExamPortal Password',
    html,
    text: toText(rows, intro) + `\n\nReset link: ${resetUrl}`,
  };
}

module.exports = { calcExpectedDate, receivedEmailTemplate, completedEmailTemplate, passwordResetEmailTemplate };
