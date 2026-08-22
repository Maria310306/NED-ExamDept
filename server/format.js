'use strict';

const db = require('./db');

/** Format an ISO-ish SQLite datetime string as "D/M/YYYY h:mm AM/PM"
 *  matching the en-PK toLocaleDateString/toLocaleTimeString format
 *  the frontend itself produces for f-datetime (and expects to be
 *  able to parse back apart in calcExpectedDate: datePart.split('/')).
 */
function fmtDateTime(sqliteDatetime) {
  if (!sqliteDatetime) return null;
  // SQLite datetime('now') gives "YYYY-MM-DD HH:MM:SS" in UTC
  const d = new Date(sqliteDatetime.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return null;
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

const getVerificationDetails = db.prepare(
  `SELECT doc_key AS "key", doc_name AS name, original_ct AS original, photocopy_ct AS photocopy
   FROM verification_details WHERE request_id = ?`
);

const getTransferLog = db.prepare(
  `SELECT from_dept AS "from", to_dept AS "to", by_user AS by, note, transferred_at
   FROM transfer_log WHERE request_id = ? ORDER BY transferred_at ASC, id ASC`
);

/** Maps a raw `requests` table row into the full shape the frontend expects
 *  (camelCase fields used by every render function, plus the raw snake_case
 *  columns that openModal()'s fallback chain looks for). */
function serializeRequest(row) {
  const verificationDetails = row.doc_key === 'verification'
    ? getVerificationDetails.all(row.id)
    : [];
  const transferLogRaw = getTransferLog.all(row.id);
  const transferLog = transferLogRaw.map(t => ({
    from: t.from, to: t.to, by: t.by, note: t.note, at: fmtDateTime(t.transferred_at),
  }));

  const datetime = fmtDateTime(row.submitted_at);
  const updatedAt = fmtDateTime(row.updated_at);

  return {
    // camelCase — used directly by table renderers
    id: row.id,
    name: row.student_name,
    roll: row.roll_number,
    dept: row.dept,
    discipline: row.discipline,
    cnic: row.cnic,
    email: row.email,
    phone: row.phone,
    docKey: row.doc_key,
    docLabel: row.doc_label,
    level: row.programme_level,
    delivery: row.delivery,
    copies: row.copies,
    courier: row.courier,
    emailCopies: row.email_copies,
    fee: row.fee,
    routedTo: row.routed_to,
    currentHolder: row.current_holder,
    status: row.status,
    operator: row.operator,
    datetime,
    updatedAt,
    verificationDetails,
    transferLog,
    // raw snake_case aliases — openModal()'s fallback chain reads these
    // when a record wasn't already in the client-side cache
    student_name: row.student_name,
    roll_number: row.roll_number,
    doc_key: row.doc_key,
    doc_label: row.doc_label,
    programme_level: row.programme_level,
    routed_to: row.routed_to,
    current_holder: row.current_holder,
    datetime_fmt: datetime,
  };
}

module.exports = { fmtDateTime, serializeRequest };
