const pool = require('../config/db');
const { asyncHandler, validateRequired, validDate, referenceExists, sendDbError } = require('./helpers');
const fields = ['collaboration_id', 'category', 'start_date', 'end_date', 'notes'];

exports.createExclusivity = asyncHandler(async (req, res) => {
  const error = validateRequired(req.body, ['collaboration_id', 'category']);
  if (error) return res.status(400).json({ error });
  const { collaboration_id, category, start_date = null, end_date = null, notes = null } = req.body;
  if (![start_date, end_date].every(validDate)) return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
  if (start_date && end_date && end_date < start_date) return res.status(400).json({ error: 'end_date must be on or after start_date.' });
  try {
    if (!(await referenceExists('collaborations', collaboration_id))) return res.status(400).json({ error: 'collaboration_id does not reference an existing collaboration.' });
    const result = await pool.query('INSERT INTO exclusivity_periods (collaboration_id,category,start_date,end_date,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *', [collaboration_id, category, start_date || null, end_date || null, notes]);
    return res.status(201).json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Exclusivity period'); }
});

exports.listExclusivity = asyncHandler(async (_req, res) => {
  try { const result = await pool.query('SELECT * FROM exclusivity_periods ORDER BY created_at DESC,id DESC'); return res.json(result.rows); }
  catch (e) { return sendDbError(e, res, 'Exclusivity period'); }
});

exports.getExclusivity = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exclusivity_periods WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Exclusivity period not found.' });
    return res.json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Exclusivity period'); }
});

exports.updateExclusivity = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Request body must be a JSON object.' });
  const suppliedKeys = Object.keys(req.body);
  const invalid = suppliedKeys.filter((key) => !fields.includes(key));
  if (invalid.length) return res.status(400).json({ error: `Unknown fields: ${invalid.join(', ')}` });
  const keys = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (!keys.length) return res.status(400).json({ error: 'Provide at least one field to update.' });
  for (const field of ['start_date', 'end_date']) if (field in req.body && !validDate(req.body[field])) return res.status(400).json({ error: `${field} must use YYYY-MM-DD format.` });
  try {
    const current = await pool.query('SELECT * FROM exclusivity_periods WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Exclusivity period not found.' });
    const merged = { ...current.rows[0], ...req.body };
    if (merged.start_date && merged.end_date && String(merged.end_date).slice(0,10) < String(merged.start_date).slice(0,10)) return res.status(400).json({ error: 'end_date must be on or after start_date.' });
    if ('collaboration_id' in req.body && !(await referenceExists('collaborations', req.body.collaboration_id))) return res.status(400).json({ error: 'collaboration_id does not reference an existing collaboration.' });
    const setSql = keys.map((key, i) => `${key}=$${i + 1}`).join(', ');
    const result = await pool.query(`UPDATE exclusivity_periods SET ${setSql} WHERE id=$${keys.length + 1} RETURNING *`, [...keys.map((key) => req.body[key]), req.params.id]);
    return res.json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Exclusivity period'); }
});

exports.deleteExclusivity = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM exclusivity_periods WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Exclusivity period not found.' });
    return res.json({ message: 'Exclusivity period deleted.', id: result.rows[0].id });
  } catch (e) { return sendDbError(e, res, 'Exclusivity period'); }
});
