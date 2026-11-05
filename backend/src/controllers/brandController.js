const pool = require('../config/db');
const { asyncHandler, validateRequired, sendDbError } = require('./helpers');

exports.createBrand = asyncHandler(async (req, res) => {
  const error = validateRequired(req.body, ['name']);
  if (error) return res.status(400).json({ error });
  if (req.body.contact_number !== undefined && req.body.contact_number !== null
      && (typeof req.body.contact_number !== 'string' || req.body.contact_number.length > 40)) {
    return res.status(400).json({ error: 'contact_number must be a string of at most 40 characters.' });
  }
  try {
    const { name, contact_name = null, contact_number = null, email = null, industry = null } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (name, contact_name, contact_number, email, industry) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, contact_name, contact_number, email, industry],
    );
    return res.status(201).json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Brand'); }
});

exports.listBrands = asyncHandler(async (_req, res) => {
  try { const result = await pool.query('SELECT * FROM brands ORDER BY created_at DESC, id DESC'); return res.json(result.rows); }
  catch (e) { return sendDbError(e, res, 'Brand'); }
});

exports.getBrand = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Brand not found.' });
    return res.json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Brand'); }
});

exports.updateBrand = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const fields = ['name', 'contact_name', 'contact_number', 'email', 'industry'];
  const suppliedKeys = Object.keys(req.body);
  const invalid = suppliedKeys.filter((key) => !fields.includes(key));
  if (invalid.length) return res.status(400).json({ error: `Unknown fields: ${invalid.join(', ')}` });
  if (!suppliedKeys.length) return res.status(400).json({ error: 'Provide at least one field to update.' });

  for (const [field, maxLength] of [['name', 200], ['contact_name', 200], ['contact_number', 40], ['email', 320], ['industry', 120]]) {
    const value = req.body[field];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > maxLength)) {
      return res.status(400).json({ error: `${field} must be a string of at most ${maxLength} characters.` });
    }
  }
  if (req.body.name !== undefined && (req.body.name === null || !req.body.name.trim())) return res.status(400).json({ error: 'name cannot be empty.' });
  if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
    return res.status(400).json({ error: 'email must be a valid email address.' });
  }

  try {
    const setSql = suppliedKeys.map((field, index) => `${field}=$${index + 1}`).join(', ');
    const result = await pool.query(
      `UPDATE brands SET ${setSql} WHERE id=$${suppliedKeys.length + 1} RETURNING *`,
      [...suppliedKeys.map((field) => req.body[field]), req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Brand not found.' });
    return res.json(result.rows[0]);
  } catch (error) { return sendDbError(error, res, 'Brand'); }
});
