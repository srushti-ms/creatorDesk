require('dotenv').config();

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('@modelcontextprotocol/client');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
const { Pool } = require('pg');

const mcpUrl = process.env.MCP_URL ? new URL(process.env.MCP_URL) : null;
const restBase = mcpUrl?.origin;
const testDatabaseUrl = process.env.MCP_TEST_DATABASE_URL;
const testDatabaseSsl = process.env.MCP_TEST_DB_SSL;
const requiredTools = [
  'get_rights_radar',
  'list_usage_rights',
  'create_usage_right',
  'update_usage_right',
  'create_exclusivity_period',
  'list_brands',
  'create_brand',
  'create_collaboration',
];

const runId = randomUUID();
const brandName = `MCP integration check ${runId}`;
const campaignName = `Temporary MCP integration campaign ${runId}`;
const contentTitle = `Temporary MCP integration content ${runId}`;
const exclusivityCategory = `Temporary MCP test category ${runId}`;
const rightNotes = `Temporary MCP test row ${runId}`;
const exclusivityNotes = `Temporary MCP test row ${runId}`;

function parseToolJson(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text || 'MCP tool returned an error.');
  return JSON.parse(result.content[0].text);
}

function plusDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeTestPool() {
  assert.ok(testDatabaseUrl, 'Set MCP_TEST_DATABASE_URL to the Railway Postgres URL for the same database service used by MCP.');
  assert.ok(['true', 'false'].includes(testDatabaseSsl), 'Set MCP_TEST_DB_SSL explicitly to true or false.');

  let parsedUrl;
  try { parsedUrl = new URL(testDatabaseUrl); }
  catch (_error) { throw new Error('MCP_TEST_DATABASE_URL must be a valid PostgreSQL URL.'); }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  assert.equal(localHosts.has(parsedUrl.hostname), false,
    'MCP_TEST_DATABASE_URL points to a local database; use the Railway Postgres URL for the deployed MCP database.');
  const railwayHost = parsedUrl.hostname.endsWith('.proxy.rlwy.net')
    || parsedUrl.hostname.endsWith('.railway.internal');
  assert.equal(railwayHost, true,
    'MCP_TEST_DATABASE_URL must use the Railway Postgres host from the same service used by the MCP server.');

  return new Pool({
    connectionString: testDatabaseUrl,
    ssl: testDatabaseSsl === 'true' ? { rejectUnauthorized: false } : false,
  });
}

async function cleanupTestRecords(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const brands = await client.query('SELECT id FROM brands WHERE name = $1', [brandName]);
    const brandIds = brands.rows.map((row) => row.id);
    const collaborations = await client.query(
      'SELECT id FROM collaborations WHERE brand_id = ANY($1::bigint[]) AND campaign_name = $2',
      [brandIds, campaignName],
    );
    const collaborationIds = collaborations.rows.map((row) => row.id);

    if (collaborationIds.length) {
      await client.query(
        'DELETE FROM usage_rights WHERE collaboration_id = ANY($1::bigint[])',
        [collaborationIds],
      );
      await client.query(
        'DELETE FROM exclusivity_periods WHERE collaboration_id = ANY($1::bigint[])',
        [collaborationIds],
      );
      await client.query(
        'DELETE FROM collaborations WHERE id = ANY($1::bigint[]) AND brand_id = ANY($2::bigint[]) AND campaign_name = $3',
        [collaborationIds, brandIds, campaignName],
      );
    }

    if (brandIds.length) {
      await client.query('DELETE FROM brands WHERE id = ANY($1::bigint[]) AND name = $2', [brandIds, brandName]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  assert.ok(mcpUrl, 'Set MCP_URL to the running MCP endpoint before running this check.');
  assert.ok(process.env.MCP_AUTH_TOKEN, 'Set MCP_AUTH_TOKEN in backend/.env before running this check.');
  const pool = makeTestPool();
  const client = new Client({ name: 'creatordesk-local-verification', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    authProvider: { token: async () => process.env.MCP_AUTH_TOKEN },
  });
  let brandId;
  let collaborationId;
  let rightId;
  let exclusivityId;

  try {
    const unauthenticated = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'unauthenticated-check', version: '1.0.0' },
        },
      }),
    });
    assert.equal(unauthenticated.status, 401, 'Requests without a bearer token must be rejected.');
    console.log('PASS unauthenticated request rejected (401)');

    await client.connect(transport);
    const listedTools = await client.listTools();
    const toolNames = listedTools.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, [...requiredTools].sort());
    console.log(`PASS all ${requiredTools.length} tools discovered`);

    const dashboardResult = parseToolJson(await client.callTool({ name: 'get_rights_radar', arguments: {} }));
    const mamaearthRights = dashboardResult.rights.filter((right) => right.brand_name === 'Mamaearth');
    assert.ok(mamaearthRights.length >= 1, 'Rights Radar should include existing Mamaearth rights.');
    assert.ok(dashboardResult.business_date);
    console.log(`PASS get_rights_radar returns ${mamaearthRights.length} Mamaearth right(s)`);

    const mamaearthList = parseToolJson(await client.callTool({
      name: 'list_usage_rights', arguments: { brand_name: 'Mamaearth' },
    }));
    assert.ok(mamaearthList.count >= 1);
    assert.ok(mamaearthList.rights.every((right) => right.brand_name === 'Mamaearth'));
    console.log(`PASS list_usage_rights returns ${mamaearthList.count} Mamaearth right(s)`);

    const brand = parseToolJson(await client.callTool({
      name: 'create_brand', arguments: { name: brandName, industry: 'Temporary integration data' },
    }));
    brandId = Number(brand.id);
    assert.ok(brandId > 0);
    const realBrands = parseToolJson(await client.callTool({ name: 'list_brands', arguments: {} }));
    assert.ok(realBrands.brands.some((item) => Number(item.id) === brandId));
    console.log('PASS create_brand persists and list_brands returns the new database record');

    const collaboration = parseToolJson(await client.callTool({
      name: 'create_collaboration',
      arguments: { brand_id: brandId, campaign_name: campaignName },
    }));
    collaborationId = Number(collaboration.id);
    assert.ok(collaborationId > 0);
    assert.equal(collaboration.brand_name, brandName);
    console.log('PASS create_collaboration persists against an existing brand');

    const day = dashboardResult.business_date;
    const right = parseToolJson(await client.callTool({
      name: 'create_usage_right',
      arguments: {
        collaboration_id: collaborationId,
        content_title: contentTitle,
        platform: 'Instagram',
        usage_type: 'PAID_AD',
        start_date: plusDays(day, -1),
        expiry_date: plusDays(day, 14),
        renewal_fee: 123.45,
        notes: rightNotes,
      },
    }));
    rightId = Number(right.id);
    assert.ok(rightId > 0);
    assert.equal(Number(right.collaboration_id), collaborationId);
    assert.equal(right.content_title, contentTitle);

    const persisted = await pool.query(
      'SELECT id, renewal_fee FROM usage_rights WHERE id = $1 AND collaboration_id = $2 AND content_title = $3',
      [rightId, collaborationId, contentTitle],
    );
    assert.equal(persisted.rowCount, 1, 'The right must exist in PostgreSQL.');
    const restRightResponse = await fetch(`${restBase}/api/rights/${rightId}`);
    assert.equal(restRightResponse.status, 200, 'The created right must be visible through the REST API.');
    const restRight = await restRightResponse.json();
    assert.equal(Number(restRight.id), rightId);
    console.log('PASS create_usage_right is persisted in PostgreSQL and visible through the REST API');

    const update = parseToolJson(await client.callTool({
      name: 'update_usage_right',
      arguments: { id: rightId, renewal_fee: 222.22, notes: 'Updated through MCP.' },
    }));
    assert.equal(Number(update.renewal_fee), 222.22);
    const updatedDb = await pool.query(
      'SELECT renewal_fee, notes FROM usage_rights WHERE id = $1 AND collaboration_id = $2 AND content_title = $3',
      [rightId, collaborationId, contentTitle],
    );
    assert.equal(Number(updatedDb.rows[0].renewal_fee), 222.22);
    assert.equal(updatedDb.rows[0].notes, 'Updated through MCP.');
    console.log('PASS update_usage_right changed the PostgreSQL record');

    const filtered = parseToolJson(await client.callTool({
      name: 'list_usage_rights',
      arguments: { brand_name: brandName, status: 'EXPIRING', expiring_within_days: 15 },
    }));
    assert.equal(filtered.count, 1);
    assert.equal(Number(filtered.rights[0].id), rightId);
    assert.equal(filtered.rights[0].status, 'EXPIRING');
    assert.equal(filtered.rights[0].days_remaining, 14);
    console.log('PASS list_usage_rights applies the shared dynamic date status and expiry filters');

    const exclusivity = parseToolJson(await client.callTool({
      name: 'create_exclusivity_period',
      arguments: {
        collaboration_id: collaborationId,
        category: exclusivityCategory,
        start_date: day,
        end_date: plusDays(day, 10),
        notes: exclusivityNotes,
      },
    }));
    exclusivityId = Number(exclusivity.id);
    assert.ok(exclusivityId > 0);
    const persistedExclusivity = await pool.query(
      'SELECT 1 FROM exclusivity_periods WHERE id = $1 AND collaboration_id = $2 AND category = $3 AND notes = $4',
      [exclusivityId, collaborationId, exclusivityCategory, exclusivityNotes],
    );
    assert.equal(persistedExclusivity.rowCount, 1);
    console.log('PASS create_exclusivity_period persists the database record');

    let rejectedUsageType = false;
    try {
      const invalid = await client.callTool({ name: 'create_usage_right', arguments: {
        collaboration_id: collaborationId,
        content_title: 'Invalid input check',
        platform: 'Instagram',
        usage_type: 'NOT_A_USAGE_TYPE',
      } });
      rejectedUsageType = invalid.isError === true;
    } catch (_error) { rejectedUsageType = true; }
    assert.equal(rejectedUsageType, true, 'Invalid usage types must be rejected.');

    let rejectedDate = false;
    try {
      const invalid = await client.callTool({ name: 'create_exclusivity_period', arguments: {
        collaboration_id: collaborationId,
        category: 'Invalid date check',
        start_date: '2026-02-30',
      } });
      rejectedDate = invalid.isError === true;
    } catch (_error) { rejectedDate = true; }
    assert.equal(rejectedDate, true, 'Invalid calendar dates must be rejected.');
    console.log('PASS invalid usage type and calendar date rejected');
  } finally {
    if (transport) await client.close().catch(() => {});
    let cleanupFailed = false;
    try {
      await cleanupTestRecords(pool);
      console.log('PASS temporary integration records cleaned from the configured Railway database');
    } catch (_error) {
      cleanupFailed = true;
      console.error('Temporary integration record cleanup failed; inspect the configured Railway test database.');
    } finally {
      await pool.end();
    }
    if (cleanupFailed) throw new Error('Could not clean up the uniquely marked temporary integration records.');
  }
}

main().catch((error) => {
  console.error('MCP verification failed:', error.message);
  process.exitCode = 1;
});
