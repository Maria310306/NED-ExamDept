'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../authGuards');
const { serializeRequest } = require('../format');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['Pending', 'Completed', 'Received'];

/* ══════════════════════════════════════════
   ID GENERATION  (YYMMDD/NNN per day)
══════════════════════════════════════════ */

function todaySerialDate() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function formatReqId(serialDate, num) {
  return `${serialDate}/${String(num).padStart(3, '0')}`;
}

const getSerial = db.prepare('SELECT last_num FROM request_serial WHERE serial_date = ?');
const upsertSerial = db.prepare(`
  INSERT INTO request_serial (serial_date, last_num) VALUES (?, 1)
  ON CONFLICT(serial_date) DO UPDATE SET last_num = last_num + 1
`);

// GET ?action=peek_id  — preview only, does not reserve the number
router.get('/', (req, res, next) => {
  if (req.query.action !== 'peek_id') return next();
  if (!['data-entry', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized for this action' });
  }
  const serialDate = todaySerialDate();
  const row = getSerial.get(serialDate);
  const nextNum = (row ? row.last_num : 0) + 1;
  res.json({ success: true, id: formatReqId(serialDate, nextNum) });
});

/* ══════════════════════════════════════════
   CREATE
══════════════════════════════════════════ */

const insertRequest = db.prepare(`
  INSERT INTO requests (
    id, student_name, roll_number, dept, discipline, cnic, email, phone,
    doc_key, doc_label, programme_level, delivery, copies, courier, email_copies, fee,
    routed_to, current_holder, status, operator, submitted_at
  ) VALUES (
    @id, @student_name, @roll_number, @dept, @discipline, @cnic, @email, @phone,
    @doc_key, @doc_label, @programme_level, @delivery, @copies, @courier, @email_copies, @fee,
    @routed_to, @current_holder, 'Pending', @operator, datetime('now')
  )
`);
const insertVerificationDetail = db.prepare(`
  INSERT INTO verification_details (request_id, doc_key, doc_name, original_ct, photocopy_ct)
  VALUES (?, ?, ?, ?, ?)
`);
const getRequestById = db.prepare('SELECT * FROM requests WHERE id = ?');

router.post('/', (req, res, next) => {
  if (req.query.action !== 'create') return next();
  if (!['data-entry', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized for this action' });
  }

  const b = req.body || {};
  const required = ['name', 'roll', 'dept', 'discipline', 'cnic', 'email', 'phone', 'docKey', 'delivery', 'level'];
  const missing = required.filter(k => !b[k]);
  if (missing.length) {
    return res.status(400).json({ success: false, error: `Missing required field(s): ${missing.join(', ')}` });
  }
  if (!['ug', 'pg'].includes(b.level)) {
    return res.status(400).json({ success: false, error: 'Invalid programme level' });
  }
  const deliveryDb = b.delivery === 'urgent' || b.delivery === 'Urgent' ? 'Urgent' : 'Normal';
  const fee = Number(b.fee);
  if (!Number.isFinite(fee) || fee < 0) {
    return res.status(400).json({ success: false, error: 'Invalid fee' });
  }

  const tx = db.transaction(() => {
    const serialDate = todaySerialDate();
    upsertSerial.run(serialDate);
    const { last_num } = getSerial.get(serialDate);
    const id = formatReqId(serialDate, last_num);

    insertRequest.run({
      id,
      student_name: String(b.name).trim(),
      roll_number: String(b.roll).trim(),
      dept: b.dept,
      discipline: String(b.discipline).trim(),
      cnic: String(b.cnic).trim(),
      email: String(b.email).trim(),
      phone: String(b.phone).trim(),
      doc_key: b.docKey,
      doc_label: b.docLabel || b.docKey,
      programme_level: b.level,
      delivery: deliveryDb,
      copies: Math.max(1, parseInt(b.copies, 10) || 1),
      courier: b.courier || 'none',
      email_copies: Math.max(0, parseInt(b.emailCopies, 10) || 0),
      fee,
      routed_to: b.dept,
      current_holder: b.dept,
      operator: req.session.user.full_name || req.session.user.username,
    });

    if (b.docKey === 'verification' && Array.isArray(b.verificationDetails)) {
      for (const d of b.verificationDetails) {
        insertVerificationDetail.run(
          id, d.key, d.name,
          Math.max(0, parseInt(d.original, 10) || 0),
          Math.max(0, parseInt(d.photocopy, 10) || 0)
        );
      }
    }

    return id;
  });

  try {
    const id = tx();
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════
   LIST  (role-scoped + filtered)
══════════════════════════════════════════ */

router.get('/', (req, res, next) => {
  if (req.query.action !== 'list') return next();

  const q = req.query;
  const user = req.session.user;
  const where = [];
  const params = {};

  // Role-based scoping (mirrors the counter / department in-out-done trays)
  if (user.role === 'department') {
    if (q.tab === 'in') {
      where.push('current_holder = @holderDept AND status = \'Pending\'');
      params.holderDept = user.dept;
    } else if (q.tab === 'out') {
      where.push(`
        current_holder != @holderDept AND id IN (
          SELECT t1.request_id FROM transfer_log t1
          WHERE t1.from_dept = @holderDept
            AND t1.transferred_at = (SELECT MAX(t2.transferred_at) FROM transfer_log t2 WHERE t2.request_id = t1.request_id)
        )`);
      params.holderDept = user.dept;
    } else if (q.tab === 'done') {
      where.push('current_holder = @holderDept AND status IN (\'Completed\',\'Received\')');
      params.holderDept = user.dept;
    } else {
      where.push('current_holder = @holderDept');
      params.holderDept = user.dept;
    }
  } else if (user.role === 'data-entry') {
    if (q.tab === 'in') {
      where.push('current_holder = \'Counter\' AND status = \'Pending\'');
    } else if (q.tab === 'out') {
      where.push('current_holder != \'Counter\' AND status = \'Pending\'');
    } else if (q.tab === 'done') {
      where.push('status IN (\'Completed\',\'Received\')');
    }
  }
  // admin: unscoped by tab/holder — sees everything, filtered only by the params below

  if (q.search) {
    where.push(`(student_name LIKE @search OR roll_number LIKE @search OR id LIKE @search
      OR email LIKE @search OR phone LIKE @search OR cnic LIKE @search OR discipline LIKE @search)`);
    params.search = `%${q.search}%`;
  }
  if (q.delivery) { where.push('delivery = @delivery'); params.delivery = q.delivery; }
  if (q.doc_key) { where.push('doc_key = @doc_key'); params.doc_key = q.doc_key; }
  if (q.dept && user.role !== 'department') { where.push('routed_to = @dept'); params.dept = q.dept; }
  if (q.section) { where.push('dept = @section'); params.section = q.section; }
  if (q.date_from) { where.push('date(submitted_at) >= date(@date_from)'); params.date_from = q.date_from; }
  if (q.date_to) { where.push('date(submitted_at) <= date(@date_to)'); params.date_to = q.date_to; }

  const limit = Math.min(2000, Math.max(1, parseInt(q.limit, 10) || 500));
  const offset = Math.max(0, parseInt(q.offset, 10) || 0);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM requests ${whereSql}`).get(params).c;
  const rows = db.prepare(`
    SELECT * FROM requests ${whereSql}
    ORDER BY submitted_at DESC, id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ success: true, requests: rows.map(serializeRequest), total });
});

/* ══════════════════════════════════════════
   GET SINGLE
══════════════════════════════════════════ */

router.get('/', (req, res, next) => {
  if (req.query.action !== 'get') return next();
  const row = getRequestById.get(req.query.id);
  if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
  res.json({ success: true, request: serializeRequest(row) });
});

/* ══════════════════════════════════════════
   UPDATE STATUS
══════════════════════════════════════════ */

const updateStatusStmt = db.prepare(`
  UPDATE requests SET status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?
`);

router.post('/', (req, res, next) => {
  if (req.query.action !== 'update_status') return next();
  const { id, status } = req.body || {};
  if (!id || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid id or status' });
  }
  const row = getRequestById.get(id);
  if (!row) return res.status(404).json({ success: false, error: 'Request not found' });

  updateStatusStmt.run(status, req.session.user.username, id);
  res.json({ success: true });
});

/* ══════════════════════════════════════════
   TRANSFER
══════════════════════════════════════════ */

const insertTransferLog = db.prepare(`
  INSERT INTO transfer_log (request_id, from_dept, to_dept, by_user, note, transferred_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
`);
const applyTransfer = db.prepare(`
  UPDATE requests SET routed_to = ?, current_holder = ?, status = 'Pending',
    updated_at = datetime('now'), updated_by = ? WHERE id = ?
`);

router.post('/', (req, res, next) => {
  if (req.query.action !== 'transfer') return next();
  if (!['data-entry', 'department', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized for this action' });
  }
  const { id, dest, note } = req.body || {};
  if (!id || !dest) {
    return res.status(400).json({ success: false, error: 'A destination section is required' });
  }
  const row = getRequestById.get(id);
  if (!row) return res.status(404).json({ success: false, error: 'Request not found' });

  const tx = db.transaction(() => {
    insertTransferLog.run(id, row.current_holder, dest, req.session.user.username, note || null);
    applyTransfer.run(dest, dest, req.session.user.username, id);
  });
  tx();

  res.json({ success: true });
});

/* ══════════════════════════════════════════
   DELETE  (admin only)
══════════════════════════════════════════ */

const deleteRequestStmt = db.prepare('DELETE FROM requests WHERE id = ?');

router.delete('/', requireRole('admin'), (req, res, next) => {
  if (req.query.action !== 'delete') return next();
  const id = req.query.id;
  if (!id) return res.status(400).json({ success: false, error: 'id is required' });
  const result = deleteRequestStmt.run(id);
  if (result.changes === 0) return res.status(404).json({ success: false, error: 'Request not found' });
  res.json({ success: true });
});

/* ══════════════════════════════════════════
   STATS  (global KPI counts)
══════════════════════════════════════════ */

router.get('/', (req, res, next) => {
  if (req.query.action !== 'stats') return next();
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Pending'   THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'Received'  THEN 1 ELSE 0 END) AS received,
      SUM(CASE WHEN delivery = 'Urgent'  THEN 1 ELSE 0 END) AS urgent,
      COALESCE(SUM(fee), 0) AS revenue
    FROM requests
  `).get();

  res.json({
    success: true,
    stats: {
      total: row.total || 0,
      pending: row.pending || 0,
      completed: row.completed || 0,
      received: row.received || 0,
      urgent: row.urgent || 0,
      revenue: row.revenue || 0,
    },
  });
});

/* ══════════════════════════════════════════
   REPORTS  (admin only)
══════════════════════════════════════════ */

router.get('/', (req, res, next) => {
  if (req.query.action !== 'reports') return next();
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Not authorized for this action' });
  }

  const byDoc = db.prepare(`SELECT doc_label AS label, COUNT(*) AS cnt FROM requests GROUP BY doc_label ORDER BY cnt DESC`).all();
  const byDept = db.prepare(`SELECT dept AS label, COUNT(*) AS cnt FROM requests GROUP BY dept ORDER BY cnt DESC`).all();
  const byStatus = db.prepare(`SELECT status AS label, COUNT(*) AS cnt FROM requests GROUP BY status ORDER BY cnt DESC`).all();
  const byDelivery = db.prepare(`SELECT delivery AS label, COUNT(*) AS cnt FROM requests GROUP BY delivery ORDER BY cnt DESC`).all();
  const revenueRow = db.prepare(`
    SELECT
      COALESCE(SUM(fee), 0) AS total,
      COALESCE(SUM(CASE WHEN delivery = 'Normal' THEN fee ELSE 0 END), 0) AS normal,
      COALESCE(SUM(CASE WHEN delivery = 'Urgent' THEN fee ELSE 0 END), 0) AS urgent,
      COALESCE(AVG(fee), 0) AS avg_fee
    FROM requests
  `).get();

  res.json({ success: true, byDoc, byDept, byStatus, byDelivery, revenue: revenueRow });
});

/* ══════════════════════════════════════════
   EXPORT  (CSV download)
══════════════════════════════════════════ */

router.get('/', (req, res, next) => {
  if (req.query.action !== 'export') return next();

  const q = req.query;
  const user = req.session.user;
  const where = [];
  const params = {};

  if (user.role === 'department') { where.push('current_holder = @holderDept'); params.holderDept = user.dept; }
  if (q.search) {
    where.push(`(student_name LIKE @search OR roll_number LIKE @search OR id LIKE @search
      OR email LIKE @search OR phone LIKE @search OR cnic LIKE @search OR discipline LIKE @search)`);
    params.search = `%${q.search}%`;
  }
  if (q.delivery) { where.push('delivery = @delivery'); params.delivery = q.delivery; }
  if (q.doc_key) { where.push('doc_key = @doc_key'); params.doc_key = q.doc_key; }
  if (q.dept && user.role !== 'department') { where.push('routed_to = @dept'); params.dept = q.dept; }
  if (q.section) { where.push('dept = @section'); params.section = q.section; }
  if (q.date_from) { where.push('date(submitted_at) >= date(@date_from)'); params.date_from = q.date_from; }
  if (q.date_to) { where.push('date(submitted_at) <= date(@date_to)'); params.date_to = q.date_to; }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM requests ${whereSql} ORDER BY submitted_at DESC`).all(params);

  const headers = ['ID', 'Name', 'Roll No', 'Section', 'Discipline', 'CNIC', 'Email', 'Phone',
    'Document', 'Level', 'Delivery', 'Copies', 'Fee', 'Routed To', 'Status', 'Submitted', 'Operator'];
  const csvEsc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(csvEsc).join(',')];
  for (const r of rows) {
    const s = serializeRequest(r);
    lines.push([s.id, s.name, s.roll, s.dept, s.discipline, s.cnic, s.email, s.phone,
      s.docLabel, s.level, s.delivery, s.copies, s.fee, s.routedTo, s.status, s.datetime, s.operator]
      .map(csvEsc).join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n'); // BOM so Excel opens UTF-8 correctly

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="examportal-export-${Date.now()}.csv"`);
  res.send(csv);
});

router.use((req, res) => res.status(400).json({ success: false, error: 'Unknown action' }));

module.exports = router;
