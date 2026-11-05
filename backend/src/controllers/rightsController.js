const pool = require('../config/db');
const { asyncHandler, validateRequired, validDate, referenceExists, sendDbError } = require('./helpers');

const allowedTypes = new Set(['ORGANIC', 'PAID_AD', 'LICENSING', 'WHITELISTING']);
const fields = ['collaboration_id', 'content_title', 'platform', 'usage_type', 'start_date', 'expiry_date', 'renewal_fee', 'notes'];

exports.createRight = asyncHandler(async (req, res) => {
  const error = validateRequired(req.body, ['collaboration_id', 'content_title', 'platform', 'usage_type']);
  if (error) return res.status(400).json({ error });
  const { collaboration_id, content_title, platform, usage_type, start_date = null, expiry_date = null, renewal_fee = null, notes = null } = req.body;
  if (!allowedTypes.has(usage_type)) return res.status(400).json({ error: 'usage_type must be ORGANIC, PAID_AD, LICENSING, or WHITELISTING.' });
  if (![start_date, expiry_date].every(validDate)) return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
  if (start_date && expiry_date && expiry_date < start_date) return res.status(400).json({ error: 'expiry_date must be on or after start_date.' });
  try {
    if (!(await referenceExists('collaborations', collaboration_id))) return res.status(400).json({ error: 'collaboration_id does not reference an existing collaboration.' });
    const result = await pool.query(
      'INSERT INTO usage_rights (collaboration_id,content_title,platform,usage_type,start_date,expiry_date,renewal_fee,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [collaboration_id, content_title, platform, usage_type, start_date || null, expiry_date || null, renewal_fee, notes],
    );
    return res.status(201).json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Usage right'); }
});

exports.listRights = asyncHandler(async (_req, res) => {
  try { const result = await pool.query('SELECT * FROM usage_rights ORDER BY created_at DESC,id DESC'); return res.json(result.rows); }
  catch (e) { return sendDbError(e, res, 'Usage right'); }
});

exports.getRight = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usage_rights WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usage right not found.' });
    return res.json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Usage right'); }
});

exports.updateRight = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Request body must be a JSON object.' });
  const suppliedKeys = Object.keys(req.body);
  const invalid = suppliedKeys.filter((key) => !fields.includes(key));
  if (invalid.length) return res.status(400).json({ error: `Unknown fields: ${invalid.join(', ')}` });
  const keys = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (!keys.length) return res.status(400).json({ error: 'Provide at least one field to update.' });
  if (req.body.usage_type && !allowedTypes.has(req.body.usage_type)) return res.status(400).json({ error: 'Invalid usage_type.' });
  for (const field of ['start_date', 'expiry_date']) {
    if (field in req.body && !validDate(req.body[field])) return res.status(400).json({ error: `${field} must use YYYY-MM-DD format.` });
  }
  try {
    const current = await pool.query('SELECT * FROM usage_rights WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Usage right not found.' });
    const merged = { ...current.rows[0], ...req.body };
    if (merged.start_date && merged.expiry_date && String(merged.expiry_date).slice(0,10) < String(merged.start_date).slice(0,10)) return res.status(400).json({ error: 'expiry_date must be on or after start_date.' });
    if ('collaboration_id' in req.body && !(await referenceExists('collaborations', req.body.collaboration_id))) return res.status(400).json({ error: 'collaboration_id does not reference an existing collaboration.' });
    const setSql = keys.map((key, i) => `${key}=$${i + 1}`).join(', ');
    const result = await pool.query(`UPDATE usage_rights SET ${setSql}, updated_at=CURRENT_TIMESTAMP WHERE id=$${keys.length + 1} RETURNING *`, [...keys.map((key) => req.body[key]), req.params.id]);
    return res.json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Usage right'); }
});

exports.deleteRight = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM usage_rights WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usage right not found.' });
    return res.json({ message: 'Usage right deleted.', id: result.rows[0].id });
  } catch (e) { return sendDbError(e, res, 'Usage right'); }
});
