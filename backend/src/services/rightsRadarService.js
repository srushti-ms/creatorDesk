const pool = require('../config/db');

async function getRightsRadarData() {
  // Compute the Kolkata calendar date once in PostgreSQL. Every comparison is
  // DATE-to-DATE, so no JavaScript timestamp conversion can shift a date.
  const result = await pool.query(
    `WITH business_clock AS (
       SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS today
     ), classified_rights AS (
       SELECT ur.id, ur.collaboration_id, ur.content_title, ur.platform,
              ur.usage_type, ur.start_date, ur.expiry_date, ur.renewal_fee,
              b.name AS brand_name, c.campaign_name,
              CASE
                WHEN ur.start_date > bc.today THEN 'UPCOMING'
                WHEN ur.expiry_date < bc.today THEN 'EXPIRED'
                WHEN ur.expiry_date IS NOT NULL
                     AND ur.expiry_date <= bc.today + 30 THEN 'EXPIRING'
                ELSE 'ACTIVE'
              END AS status,
              CASE WHEN ur.expiry_date IS NULL THEN NULL
                   ELSE ur.expiry_date - bc.today
              END AS days_remaining
       FROM usage_rights ur
       JOIN collaborations c ON c.id = ur.collaboration_id
       JOIN brands b ON b.id = c.brand_id
       CROSS JOIN business_clock bc
     ), active_exclusivity AS (
       SELECT ep.id, ep.collaboration_id, ep.category, ep.start_date,
              ep.end_date, ep.notes, b.name AS brand_name,
              c.campaign_name, (ep.end_date - bc.today) AS days_remaining,
              (ep.end_date IS NOT NULL AND ep.end_date <= bc.today + 30) AS ending_within_30_days
       FROM exclusivity_periods ep
       JOIN collaborations c ON c.id = ep.collaboration_id
       JOIN brands b ON b.id = c.brand_id
       CROSS JOIN business_clock bc
       WHERE ep.start_date IS NOT NULL
         AND ep.start_date <= bc.today
         AND (ep.end_date IS NULL OR ep.end_date >= bc.today)
     )
     SELECT bc.today::text AS business_date,
            (SELECT COUNT(*)::int FROM classified_rights) AS total_rights,
            (SELECT COUNT(*)::int FROM classified_rights WHERE status IN ('ACTIVE', 'EXPIRING')) AS active_rights,
            (SELECT COUNT(*)::int FROM classified_rights WHERE status = 'EXPIRED') AS expired_rights,
            (SELECT COUNT(*)::int FROM classified_rights WHERE status = 'EXPIRING' AND expiry_date <= bc.today + 7) AS expiring_in_7_days,
            (SELECT COUNT(*)::int FROM classified_rights WHERE status = 'EXPIRING' AND expiry_date <= bc.today + 15) AS expiring_in_15_days,
            (SELECT COUNT(*)::int FROM classified_rights WHERE status = 'EXPIRING') AS expiring_in_30_days,
            (SELECT COUNT(*)::int FROM classified_rights WHERE status = 'UPCOMING') AS upcoming_rights,
            COALESCE((SELECT SUM(renewal_fee)::float8
                      FROM classified_rights
                      WHERE status = 'EXPIRING'), 0)::float8 AS renewal_revenue,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', r.id,
                'brand_name', r.brand_name,
                'campaign_name', r.campaign_name,
                'content_title', r.content_title,
                'platform', r.platform,
                'usage_type', r.usage_type,
                'start_date', r.start_date,
                'expiry_date', r.expiry_date,
                'renewal_fee', r.renewal_fee,
                'days_remaining', r.days_remaining,
                'status', r.status
              ) ORDER BY r.expiry_date NULLS LAST, r.id)
              FROM classified_rights r
            ), '[]'::jsonb) AS rights,
            (SELECT COUNT(*)::int FROM active_exclusivity) AS active_exclusivity,
            (SELECT COUNT(*)::int FROM active_exclusivity WHERE ending_within_30_days) AS exclusivity_ending_in_30_days,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', e.id,
                'brand_name', e.brand_name,
                'campaign_name', e.campaign_name,
                'category', e.category,
                'start_date', e.start_date,
                'end_date', e.end_date,
                'days_remaining', e.days_remaining,
                'ending_within_30_days', e.ending_within_30_days
              ) ORDER BY e.end_date NULLS LAST, e.id)
              FROM active_exclusivity e
            ), '[]'::jsonb) AS exclusivity
     FROM business_clock bc`,
    ['Asia/Kolkata'],
  );

  const row = result.rows[0];
  return {
    business_date: row.business_date,
    summary: {
      total_rights: row.total_rights,
      active_rights: row.active_rights,
      expired_rights: row.expired_rights,
      expiring_in_7_days: row.expiring_in_7_days,
      expiring_in_15_days: row.expiring_in_15_days,
      expiring_in_30_days: row.expiring_in_30_days,
      upcoming_rights: row.upcoming_rights,
      renewal_revenue: row.renewal_revenue,
    },
    rights: row.rights,
    exclusivity: {
      active_count: row.active_exclusivity,
      ending_in_30_days: row.exclusivity_ending_in_30_days,
      records: row.exclusivity,
    },
  };
}

module.exports = { getRightsRadarData };
