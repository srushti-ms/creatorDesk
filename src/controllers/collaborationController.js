const pool = require('../config/db');
const { asyncHandler, validateRequired, validDate, referenceExists, sendDbError } = require('./helpers');

exports.createCollaboration = asyncHandler(async (req, res) => {
  const error = validateRequired(req.body, ['brand_id', 'campaign_name']);
  if (error) return res.status(400).json({ error });
  const { brand_id, campaign_name, deal_amount = null, start_date = null, end_date = null, status = 'ACTIVE' } = req.body;
  if (![start_date, end_date].every(validDate)) return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
  if (start_date && end_date && end_date < start_date) return res.status(400).json({ error: 'end_date must be on or after start_date.' });
  try {
    if (!(await referenceExists('brands', brand_id))) return res.status(400).json({ error: 'brand_id does not reference an existing brand.' });
    const result = await pool.query(
      'INSERT INTO collaborations (brand_id,campaign_name,deal_amount,start_date,end_date,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [brand_id, campaign_name, deal_amount, start_date || null, end_date || null, status],
    );
    return res.status(201).json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Collaboration'); }
});

exports.listCollaborations = asyncHandler(async (_req, res) => {
  try {
    const result = await pool.query('SELECT c.*, b.name AS brand_name FROM collaborations c JOIN brands b ON b.id=c.brand_id ORDER BY c.created_at DESC,c.id DESC');
    return res.json(result.rows);
  } catch (e) { return sendDbError(e, res, 'Collaboration'); }
});

exports.getCollaboration = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query('SELECT c.*, b.name AS brand_name FROM collaborations c JOIN brands b ON b.id=c.brand_id WHERE c.id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Collaboration not found.' });
    return res.json(result.rows[0]);
  } catch (e) { return sendDbError(e, res, 'Collaboration'); }
});
