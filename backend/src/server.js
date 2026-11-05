require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');
const mcp = require('./mcp/server');

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, '0.0.0.0', () => console.log(`CreatorDesk API listening on 0.0.0.0:${port}`));

async function shutdown() {
  server.close(async () => {
    await mcp.close();
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
