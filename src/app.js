const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const mcp = require('./mcp/server');

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || '';
const validFrontendOrigin = (() => {
  try {
    const parsed = new URL(frontendOrigin);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === frontendOrigin;
  } catch (_error) {
    return false;
  }
})();
const restCors = cors({
  origin(origin, callback) {
    return callback(null, Boolean(validFrontendOrigin && origin === frontendOrigin) ? origin : false);
  },
  optionsSuccessStatus: 204,
});
app.use((req, res, next) => {
  if (req.path === '/mcp' || req.path.startsWith('/mcp/')) return next();
  return restCors(req, res, next);
});
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); return res.json({ status: 'ok', database: 'reachable' }); }
  catch (_error) { return res.status(503).json({ status: 'error', database: 'unreachable' }); }
});
app.use('/api/brands', require('./routes/brandRoutes'));
app.use('/api/collaborations', require('./routes/collaborationRoutes'));
app.use('/api/rights', require('./routes/rightsRoutes'));
app.use('/api/exclusivity', require('./routes/exclusivityRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/mcp', mcp.app);
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'Malformed JSON request body.' });
  console.error('Unhandled error:', error);
  return res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
