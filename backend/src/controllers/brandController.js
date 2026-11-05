const pool = require('../config/db');
const { asyncHandler, validateRequired, sendDbError } = require('./helpers');

exports.createBrand = asyncHandler(async (req, res) => {
  const error = validateRequired(req.body, ['name']);
  if (error) return res.status(400).json({ error });
  try {
    const { name, contact_name = null, email = null, industry = null } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (name, contact_name, email, industry) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, contact_name, email, industry],
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
