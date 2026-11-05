const crypto = require('node:crypto');
const cors = require('cors');
const { createMcpExpressApp, requireBearerAuth } = require('@modelcontextprotocol/express');
const { toNodeHandler } = require('@modelcontextprotocol/node');
const {
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  localhostAllowedOrigins,
} = require('@modelcontextprotocol/server');
const { registerCreatorDeskTools } = require('./tools');

function parseList(value) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function safeTokenMatch(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || !expected) return false;
  const suppliedBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length
    && crypto.timingSafeEqual(suppliedBytes, expectedBytes);
}

const localHosts = localhostAllowedOrigins();
const allowedHosts = parseList(process.env.MCP_ALLOWED_HOSTS);
const hostAllowlist = allowedHosts.length ? allowedHosts : localHosts;
const configuredOrigins = parseList(process.env.MCP_ALLOWED_ORIGINS);
const originHosts = configuredOrigins.map((origin) => {
  try { return new URL(origin).hostname; } catch (_error) { return null; }
}).filter(Boolean);
const sdkAllowedOrigins = [...new Set([...localHosts, ...originHosts])];

const mcpApp = createMcpExpressApp({
  host: '0.0.0.0',
  allowedHosts: hostAllowlist,
  allowedOrigins: sdkAllowedOrigins,
});

const localOriginsOnly = process.env.NODE_ENV === 'development';
mcpApp.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, false);
    let parsedOrigin;
    try { parsedOrigin = new URL(origin); } catch (_error) { return callback(null, false); }
    const explicitlyAllowed = configuredOrigins.includes(origin);
    const allowedLocalOrigin = localOriginsOnly && hostAllowlist.includes(parsedOrigin.hostname);
    return callback(null, explicitlyAllowed || allowedLocalOrigin ? origin : false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'Accept',
    'MCP-Protocol-Version',
    'MCP-Session-Id',
    'Last-Event-ID',
  ],
  exposedHeaders: ['WWW-Authenticate', 'MCP-Session-Id', 'MCP-Protocol-Version'],
  maxAge: 600,
}));

const verifier = {
  async verifyAccessToken(token) {
    const expected = process.env.MCP_AUTH_TOKEN;
    if (!safeTokenMatch(token, expected)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
    }
    return {
      token,
      clientId: 'creatordesk-mcp-token-client',
      scopes: ['mcp'],
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };
  },
};

const auth = requireBearerAuth({ verifier, requiredScopes: ['mcp'] });
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'creatordesk', version: '1.0.0' });
  registerCreatorDeskTools(server);
  return server;
});

const nodeHandler = toNodeHandler(handler);
mcpApp.all('/', auth, (req, res) => void nodeHandler(req, res, req.body));

if (!process.env.MCP_AUTH_TOKEN) {
  console.warn('MCP_AUTH_TOKEN is not configured; MCP requests will be rejected until it is set. REST APIs remain available.');
}
if (process.env.NODE_ENV === 'production' && !allowedHosts.length) {
  console.warn('MCP_ALLOWED_HOSTS is not configured; remote MCP hosts will be rejected.');
}

module.exports = { app: mcpApp, close: () => handler.close() };
