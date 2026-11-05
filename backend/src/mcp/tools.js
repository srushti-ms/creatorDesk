const { z } = require('zod/v4');
const pool = require('../config/db');
const { getRightsRadarData } = require('../services/rightsRadarService');

const usageTypes = ['ORGANIC', 'PAID_AD', 'LICENSING', 'WHITELISTING'];
const rightStatuses = ['UPCOMING', 'EXPIRED', 'ACTIVE', 'EXPIRING'];
const positiveId = z.number().int().positive().safe();
const nonEmpty = (max) => z.string().min(1).max(max);

const dateValue = z.iso.date();
const optionalDate = dateValue.nullable().optional();
const usageType = z.enum(usageTypes);

function success(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function publicError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function databaseErrorMessage(error) {
  if (error.publicMessage) return error.publicMessage;
  if (error.code === '23503') return 'A referenced brand or collaboration does not exist.';
  if (error.code === '23514' || error.code === '22P02' || error.code === '22007') return 'One or more values are invalid.';
  console.error('MCP database operation failed:', error.code || error.name || 'unknown error');
  return 'The database operation failed. Check the server database connection and try again.';
}

function withErrors(handler) {
  return async (input) => {
    try {
      return success(await handler(input));
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: databaseErrorMessage(error) }] };
    }
  };
}

function validateDateRange(startDate, endDate, endLabel) {
  if (startDate && endDate && endDate < startDate) {
    throw publicError(`${endLabel} must be on or after start_date.`);
  }
}

async function collaborationExists(id) {
  const result = await pool.query('SELECT 1 FROM collaborations WHERE id = $1', [id]);
  return result.rowCount > 0;
}

async function brandExists(id) {
  const result = await pool.query('SELECT 1 FROM brands WHERE id = $1', [id]);
  return result.rowCount > 0;
}

function registerCreatorDeskTools(server) {
  server.registerTool(
    'get_rights_radar',
    {
      description: 'Get the current Rights Radar dashboard, including dynamic rights statuses, expiry counts, renewal revenue, and active exclusivity records.',
      inputSchema: z.object({}),
    },
    withErrors(async () => getRightsRadarData()),
  );

  server.registerTool(
    'list_usage_rights',
    {
      description: 'List real usage-right records with brand and campaign names. Optional filters include brand name, usage type, dynamic status, and days until expiry.',
      inputSchema: z.object({
        brand_name: nonEmpty(200).optional(),
        usage_type: usageType.optional(),
        status: z.enum(rightStatuses).optional(),
        expiring_within_days: z.number().int().min(0).max(3650).optional(),
      }),
    },
    withErrors(async (filters) => {
      const dashboard = await getRightsRadarData();
      let rights = dashboard.rights;
      if (filters.brand_name) {
        const brand = filters.brand_name.toLocaleLowerCase('en');
        rights = rights.filter((right) => right.brand_name.toLocaleLowerCase('en') === brand);
      }
      if (filters.usage_type) rights = rights.filter((right) => right.usage_type === filters.usage_type);
      if (filters.status) rights = rights.filter((right) => right.status === filters.status);
      if (filters.expiring_within_days !== undefined) {
        const days = filters.expiring_within_days;
        rights = rights.filter((right) => (
          !['UPCOMING', 'EXPIRED'].includes(right.status)
          && right.days_remaining !== null
          && right.days_remaining >= 0
          && right.days_remaining <= days
        ));
      }
      return { business_date: dashboard.business_date, count: rights.length, rights };
    }),
  );

  server.registerTool(
    'create_usage_right',
    {
      description: 'Create and persist a usage right for an existing collaboration.',
      inputSchema: z.object({
        collaboration_id: positiveId,
        content_title: nonEmpty(250),
        platform: nonEmpty(120),
        usage_type: usageType,
        start_date: optionalDate,
        expiry_date: optionalDate,
        renewal_fee: z.number().nonnegative().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    },
    withErrors(async (input) => {
      validateDateRange(input.start_date, input.expiry_date, 'expiry_date');
      if (!(await collaborationExists(input.collaboration_id))) {
        throw publicError('collaboration_id does not reference an existing collaboration.');
      }
      const result = await pool.query(
        `WITH inserted AS (
           INSERT INTO usage_rights
             (collaboration_id, content_title, platform, usage_type, start_date, expiry_date, renewal_fee, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *
         )
         SELECT r.*, b.name AS brand_name, c.campaign_name
         FROM inserted r
         JOIN collaborations c ON c.id = r.collaboration_id
         JOIN brands b ON b.id = c.brand_id`,
        [input.collaboration_id, input.content_title, input.platform, input.usage_type,
          input.start_date ?? null, input.expiry_date ?? null, input.renewal_fee ?? null, input.notes ?? null],
      );
      return result.rows[0];
    }),
  );

  server.registerTool(
    'update_usage_right',
    {
      description: 'Update editable fields on an existing usage right and return the persisted record.',
      inputSchema: z.object({
        id: positiveId,
        expiry_date: optionalDate,
        start_date: optionalDate,
        renewal_fee: z.number().nonnegative().nullable().optional(),
        notes: z.string().nullable().optional(),
        usage_type: usageType.optional(),
      }),
    },
    withErrors(async (input) => {
      if (!Object.keys(input).some((key) => key !== 'id')) {
        throw publicError('Provide at least one field to update.');
      }
      const current = await pool.query(
        'SELECT id, start_date, expiry_date FROM usage_rights WHERE id = $1',
        [input.id],
      );
      if (!current.rowCount) throw publicError('Usage right not found.');
      validateDateRange(
        input.start_date === undefined ? current.rows[0].start_date : input.start_date,
        input.expiry_date === undefined ? current.rows[0].expiry_date : input.expiry_date,
        'expiry_date',
      );

      const columns = {
        expiry_date: 'expiry_date',
        start_date: 'start_date',
        renewal_fee: 'renewal_fee',
        notes: 'notes',
        usage_type: 'usage_type',
        platform: 'platform',
        content_title: 'content_title',
      };
      const keys = Object.keys(columns).filter((key) => Object.prototype.hasOwnProperty.call(input, key));
      const assignments = keys.map((key, index) => `${columns[key]} = $${index + 1}`);
      const values = keys.map((key) => input[key]);
      const updated = await pool.query(
        `UPDATE usage_rights
         SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${values.length + 1}
         RETURNING *`,
        [...values, input.id],
      );
      const result = await pool.query(
        `SELECT r.*, b.name AS brand_name, c.campaign_name
         FROM usage_rights r
         JOIN collaborations c ON c.id = r.collaboration_id
         JOIN brands b ON b.id = c.brand_id
         WHERE r.id = $1`,
        [updated.rows[0].id],
      );
      return result.rows[0];
    }),
  );

  server.registerTool(
    'create_exclusivity_period',
    {
      description: 'Create and persist an exclusivity period for an existing collaboration.',
      inputSchema: z.object({
        collaboration_id: positiveId,
        category: nonEmpty(160),
        start_date: optionalDate,
        end_date: optionalDate,
        notes: z.string().nullable().optional(),
      }),
    },
    withErrors(async (input) => {
      validateDateRange(input.start_date, input.end_date, 'end_date');
      if (!(await collaborationExists(input.collaboration_id))) {
        throw publicError('collaboration_id does not reference an existing collaboration.');
      }
      const result = await pool.query(
        `WITH inserted AS (
           INSERT INTO exclusivity_periods (collaboration_id, category, start_date, end_date, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *
         )
         SELECT e.*, b.name AS brand_name, c.campaign_name
         FROM inserted e
         JOIN collaborations c ON c.id = e.collaboration_id
         JOIN brands b ON b.id = c.brand_id`,
        [input.collaboration_id, input.category, input.start_date ?? null,
          input.end_date ?? null, input.notes ?? null],
      );
      return result.rows[0];
    }),
  );

  server.registerTool(
    'list_brands',
    { description: 'List all real brands stored in CreatorDesk PostgreSQL.', inputSchema: z.object({}) },
    withErrors(async () => {
      const result = await pool.query('SELECT * FROM brands ORDER BY created_at DESC, id DESC');
      return { count: result.rowCount, brands: result.rows };
    }),
  );

  server.registerTool(
    'create_brand',
    {
      description: 'Create and persist a brand in CreatorDesk PostgreSQL.',
      inputSchema: z.object({
        name: nonEmpty(200),
        contact_name: nonEmpty(200).nullable().optional(),
        email: z.string().email().max(320).nullable().optional(),
        industry: nonEmpty(120).nullable().optional(),
      }),
    },
    withErrors(async (input) => {
      const result = await pool.query(
        'INSERT INTO brands (name, contact_name, email, industry) VALUES ($1, $2, $3, $4) RETURNING *',
        [input.name, input.contact_name ?? null, input.email ?? null, input.industry ?? null],
      );
      return result.rows[0];
    }),
  );

  server.registerTool(
    'create_collaboration',
    {
      description: 'Create and persist a campaign collaboration for an existing brand.',
      inputSchema: z.object({
        brand_id: positiveId,
        campaign_name: nonEmpty(200),
        deal_amount: z.number().nonnegative().nullable().optional(),
        start_date: optionalDate,
        end_date: optionalDate,
        status: nonEmpty(50).optional(),
      }),
    },
    withErrors(async (input) => {
      validateDateRange(input.start_date, input.end_date, 'end_date');
      if (!(await brandExists(input.brand_id))) {
        throw publicError('brand_id does not reference an existing brand.');
      }
      const result = await pool.query(
        `WITH inserted AS (
           INSERT INTO collaborations (brand_id, campaign_name, deal_amount, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *
         )
         SELECT c.*, b.name AS brand_name
         FROM inserted c
         JOIN brands b ON b.id = c.brand_id`,
        [input.brand_id, input.campaign_name, input.deal_amount ?? null,
          input.start_date ?? null, input.end_date ?? null, input.status ?? 'ACTIVE'],
      );
      return result.rows[0];
    }),
  );
}

module.exports = { registerCreatorDeskTools };
