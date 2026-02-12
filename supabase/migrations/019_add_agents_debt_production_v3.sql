-- Migration: Fix Negative "Production (Team)" on Agents Page
-- Date: 2026-02-08
-- Description: Creates get_agents_debt_production_v3.
--   Fixes negative team production by excluding unposted deals (product_id IS NULL)
--   and replacing snapshot-based team_prod_calc with direct downline aggregation.

BEGIN;

CREATE OR REPLACE FUNCTION get_agents_debt_production_v3(
  p_user_id UUID,
  p_agent_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_admin_agency_view BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  agent_id UUID,
  individual_debt NUMERIC,
  individual_debt_count INTEGER,
  individual_production NUMERIC,
  individual_production_count INTEGER,
  hierarchy_debt NUMERIC,
  hierarchy_debt_count INTEGER,
  hierarchy_production NUMERIC,
  hierarchy_production_count INTEGER,
  debt_to_production_ratio NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_agency_id UUID;
  -- Commission schedule constants
  C_ADVANCE_RATE CONSTANT NUMERIC := 0.75;
  C_PRORATION_MONTHS CONSTANT INTEGER := 9;
  C_EARLY_LAPSE_DAYS CONSTANT INTEGER := 30;
  C_MIN_LAPSE_DAYS CONSTANT INTEGER := 7;
BEGIN
  SELECT agency_id INTO v_user_agency_id
  FROM users
  WHERE id = p_user_id;

  RETURN QUERY
  WITH RECURSIVE
  agent_tree AS (
    SELECT
      u.id as root_agent_id,
      u.id as descendant_id,
      0 as depth
    FROM users u
    WHERE u.id = ANY(p_agent_ids)
      AND u.agency_id = v_user_agency_id

    UNION ALL

    SELECT
      at.root_agent_id,
      u.id as descendant_id,
      at.depth + 1
    FROM agent_tree at
    JOIN users u ON u.upline_id = at.descendant_id
    WHERE u.agency_id = v_user_agency_id
  ),

  individual_debt_calc AS (
    SELECT
      dhs.agent_id,
      COALESCE(SUM(
        CASE
          WHEN EXTRACT(EPOCH FROM (d.updated_at - d.policy_effective_date)) / 86400 <= C_EARLY_LAPSE_DAYS
          THEN (d.annual_premium * C_ADVANCE_RATE * (dhs.commission_percentage / NULLIF(
            (SELECT SUM(dhs2.commission_percentage)
             FROM deal_hierarchy_snapshot dhs2
             WHERE dhs2.deal_id = d.id AND dhs2.commission_percentage IS NOT NULL), 0)))
          ELSE (d.annual_premium * C_ADVANCE_RATE * (dhs.commission_percentage / NULLIF(
            (SELECT SUM(dhs2.commission_percentage)
             FROM deal_hierarchy_snapshot dhs2
             WHERE dhs2.deal_id = d.id AND dhs2.commission_percentage IS NOT NULL), 0)) / C_PRORATION_MONTHS)
            * GREATEST(0, C_PRORATION_MONTHS - LEAST(
              FLOOR(EXTRACT(EPOCH FROM (d.updated_at - d.policy_effective_date)) / 86400 / C_EARLY_LAPSE_DAYS)::INTEGER,
              C_PRORATION_MONTHS))
        END
      ), 0) as total_debt,
      COUNT(DISTINCT d.id)::INTEGER as debt_count
    FROM deal_hierarchy_snapshot dhs
    INNER JOIN deals d ON d.id = dhs.deal_id
    INNER JOIN status_mapping sm ON sm.carrier_id = d.carrier_id
      AND LOWER(sm.raw_status) = LOWER(d.status)
      AND sm.impact = 'negative'
    WHERE dhs.agent_id = ANY(
      SELECT DISTINCT descendant_id FROM agent_tree
    )
      AND d.annual_premium IS NOT NULL
      AND d.policy_effective_date IS NOT NULL
      AND dhs.commission_percentage IS NOT NULL
      AND d.policy_effective_date >= p_start_date
      AND d.policy_effective_date < p_end_date
    GROUP BY dhs.agent_id
  ),

  -- product_id IS NOT NULL excludes unposted commission report imports
  individual_prod_calc AS (
    SELECT
      d.agent_id,
      COALESCE(SUM(d.annual_premium), 0) as total_production,
      COUNT(DISTINCT d.id)::INTEGER as production_count
    FROM deals d
    LEFT JOIN status_mapping sm ON sm.carrier_id = d.carrier_id
      AND LOWER(sm.raw_status) = LOWER(d.status)
    WHERE d.agent_id = ANY(
      SELECT DISTINCT descendant_id FROM agent_tree
    )
      AND d.policy_effective_date >= p_start_date
      AND d.policy_effective_date < p_end_date
      AND d.annual_premium IS NOT NULL
      AND d.product_id IS NOT NULL
      AND (
        (sm.impact IS NULL OR sm.impact != 'negative')
        OR
        (
          sm.impact = 'negative'
          AND sm.status_standardized = 'Lapsed'
          AND d.lapse_date IS NOT NULL
          AND EXTRACT(EPOCH FROM (d.lapse_date - d.policy_effective_date)) / 86400 > C_MIN_LAPSE_DAYS
        )
      )
    GROUP BY d.agent_id
  ),

  -- Agent path: aggregate downlines directly (no snapshot dependency)
  hierarchy_metrics AS (
    SELECT
      at.root_agent_id as agent_id,
      COALESCE(SUM(CASE WHEN at.descendant_id != at.root_agent_id
                        THEN idc.total_debt ELSE 0 END), 0) as h_debt,
      COALESCE(SUM(CASE WHEN at.descendant_id != at.root_agent_id
                        THEN idc.debt_count ELSE 0 END), 0)::INTEGER as h_debt_count,
      COALESCE(SUM(CASE WHEN at.descendant_id != at.root_agent_id
                        THEN ipc.total_production ELSE 0 END), 0) as h_production,
      COALESCE(SUM(CASE WHEN at.descendant_id != at.root_agent_id
                        THEN ipc.production_count ELSE 0 END), 0)::INTEGER as h_production_count
    FROM agent_tree at
    LEFT JOIN individual_debt_calc idc ON idc.agent_id = at.descendant_id
    LEFT JOIN individual_prod_calc ipc ON ipc.agent_id = at.descendant_id
    GROUP BY at.root_agent_id
  ),

  -- Admin path: agency-wide totals for subtraction
  admin_agency_prod AS (
    SELECT
      COALESCE(SUM(d.annual_premium), 0) as total_agency_production,
      COUNT(DISTINCT d.id)::INTEGER as agency_production_count
    FROM deals d
    LEFT JOIN status_mapping sm ON sm.carrier_id = d.carrier_id
      AND LOWER(sm.raw_status) = LOWER(d.status)
    WHERE d.agency_id = v_user_agency_id
      AND d.policy_effective_date >= p_start_date
      AND d.policy_effective_date < p_end_date
      AND d.annual_premium IS NOT NULL
      AND d.product_id IS NOT NULL
      AND (
        (sm.impact IS NULL OR sm.impact != 'negative')
        OR (sm.impact = 'negative' AND sm.status_standardized = 'Lapsed'
            AND d.lapse_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (d.lapse_date - d.policy_effective_date)) / 86400 > C_MIN_LAPSE_DAYS)
      )
  ),

  admin_agency_debt AS (
    SELECT
      COALESCE(SUM(
        CASE
          WHEN EXTRACT(EPOCH FROM (d.updated_at - d.policy_effective_date)) / 86400 <= C_EARLY_LAPSE_DAYS
          THEN (d.annual_premium * C_ADVANCE_RATE * (dhs.commission_percentage / NULLIF(
            (SELECT SUM(dhs2.commission_percentage)
             FROM deal_hierarchy_snapshot dhs2
             WHERE dhs2.deal_id = d.id AND dhs2.commission_percentage IS NOT NULL), 0)))
          ELSE (d.annual_premium * C_ADVANCE_RATE * (dhs.commission_percentage / NULLIF(
            (SELECT SUM(dhs2.commission_percentage)
             FROM deal_hierarchy_snapshot dhs2
             WHERE dhs2.deal_id = d.id AND dhs2.commission_percentage IS NOT NULL), 0)) / C_PRORATION_MONTHS)
            * GREATEST(0, C_PRORATION_MONTHS - LEAST(
              FLOOR(EXTRACT(EPOCH FROM (d.updated_at - d.policy_effective_date)) / 86400 / C_EARLY_LAPSE_DAYS)::INTEGER,
              C_PRORATION_MONTHS))
        END
      ), 0) as total_agency_debt,
      COUNT(DISTINCT d.id)::INTEGER as agency_debt_count
    FROM deal_hierarchy_snapshot dhs
    INNER JOIN deals d ON d.id = dhs.deal_id
    INNER JOIN status_mapping sm ON sm.carrier_id = d.carrier_id
      AND LOWER(sm.raw_status) = LOWER(d.status)
      AND sm.impact = 'negative'
    WHERE d.agency_id = v_user_agency_id
      AND d.annual_premium IS NOT NULL
      AND d.policy_effective_date IS NOT NULL
      AND dhs.commission_percentage IS NOT NULL
      AND d.policy_effective_date >= p_start_date
      AND d.policy_effective_date < p_end_date
  )

  SELECT
    a.id as agent_id,
    ROUND(COALESCE(idc.total_debt, 0), 2) as individual_debt,
    COALESCE(idc.debt_count, 0) as individual_debt_count,
    ROUND(COALESCE(ipc.total_production, 0), 2) as individual_production,
    COALESCE(ipc.production_count, 0) as individual_production_count,
    CASE WHEN p_admin_agency_view THEN
      ROUND(GREATEST((SELECT total_agency_debt FROM admin_agency_debt) - COALESCE(idc.total_debt, 0), 0), 2)
    ELSE
      ROUND(COALESCE(hm.h_debt, 0), 2)
    END as hierarchy_debt,
    CASE WHEN p_admin_agency_view THEN
      GREATEST((SELECT agency_debt_count FROM admin_agency_debt) - COALESCE(idc.debt_count, 0), 0)::INTEGER
    ELSE
      COALESCE(hm.h_debt_count, 0)
    END as hierarchy_debt_count,
    CASE WHEN p_admin_agency_view THEN
      ROUND(GREATEST((SELECT total_agency_production FROM admin_agency_prod) - COALESCE(ipc.total_production, 0), 0), 2)
    ELSE
      ROUND(COALESCE(hm.h_production, 0), 2)
    END as hierarchy_production,
    CASE WHEN p_admin_agency_view THEN
      GREATEST((SELECT agency_production_count FROM admin_agency_prod) - COALESCE(ipc.production_count, 0), 0)::INTEGER
    ELSE
      COALESCE(hm.h_production_count, 0)
    END as hierarchy_production_count,
    CASE
      WHEN p_admin_agency_view THEN
        CASE
          WHEN GREATEST((SELECT total_agency_production FROM admin_agency_prod) - COALESCE(ipc.total_production, 0), 0) > 0
          THEN ROUND(
            GREATEST((SELECT total_agency_debt FROM admin_agency_debt) - COALESCE(idc.total_debt, 0), 0)
            / GREATEST((SELECT total_agency_production FROM admin_agency_prod) - COALESCE(ipc.total_production, 0), 1),
            4)
          ELSE NULL
        END
      ELSE
        CASE
          WHEN COALESCE(hm.h_production, 0) > 0
          THEN ROUND(COALESCE(hm.h_debt, 0) / hm.h_production, 4)
          ELSE NULL
        END
    END as debt_to_production_ratio
  FROM unnest(p_agent_ids) as a(id)
  LEFT JOIN individual_debt_calc idc ON idc.agent_id = a.id
  LEFT JOIN individual_prod_calc ipc ON ipc.agent_id = a.id
  LEFT JOIN hierarchy_metrics hm ON hm.agent_id = a.id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agents_debt_production_v3(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION get_agents_debt_production_v3 IS
'V3: Fixes negative "Production (Team)" values on the Agents page.

Changes from V2:
1. Excludes deals without product_id (commission report imports) from production calculations
2. Agent path: replaces team_prod_calc snapshot subtraction with direct downline aggregation
3. Admin path: adds product_id filter and GREATEST(0,...) safeguards

- individual_debt: Agent own debt from lapsed policies (filtered by date range)
- individual_production: Agent own production (only deals with product_id set)
- hierarchy_*: Aggregated downline metrics (excluding self)
- debt_to_production_ratio: hierarchy_debt / hierarchy_production (null if no production)';

COMMIT;

-- Rollback script (run separately if needed):
/*
BEGIN;
DROP FUNCTION IF EXISTS get_agents_debt_production_v3(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN);
COMMIT;
*/
