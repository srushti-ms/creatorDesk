const pool = require('../config/db');

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function validateRequired(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be a JSON object.';
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  return missing.length ? `Required fields: ${missing.join(', ')}` : null;
}

function validDate(value) {
  return value == null || value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function referenceExists(table, id) {
  // Table name is always a controller constant; id remains a bound parameter.
  const result = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

function sendDbError(error, res, resource) {
  if (error.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist.' });
  if (error.code === '23514' || error.code === '22P02') return res.status(400).json({ error: 'Invalid field value.' });
  console.error(`${resource} error:`, error);
  return res.status(500).json({ error: 'Internal server error.' });
}

module.exports = { asyncHandler, validateRequired, validDate, referenceExists, sendDbError };
