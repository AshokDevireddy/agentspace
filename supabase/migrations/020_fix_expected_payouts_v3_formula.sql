-- Migration: Fix Expected Payouts V3 — Wrong Payout Formula
-- Date: 2026-02-10
-- Description: Replaces the proportional formula in get_expected_payouts_v3 with
--   the correct spread/override formula.
--
-- OLD (proportional — wrong):
--   annual_premium * 0.75 * (agent_% / total_hierarchy_%)
--
-- NEW (spread/override — correct):
--   annual_premium * 0.75 * (agent_% - downline_%) / 100
--
-- All V3 improvements are preserved:
--   - Explicit p_start_date / p_end_date parameters
--   - agency_carrier_payout_settings for carrier date modes
--   - LEFT JOIN status_mapping with COALESCE(sm.impact, 'neutral')
--   - hierarchy_sums CTE retained for display field

BEGIN;

CREATE OR REPLACE FUNCTION get_expected_payouts_v3(
    p_user_id UUID,
    p_agent_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_carrier_id UUID DEFAULT NULL
)
RETURNS TABLE (
    month DATE,
    agent_id UUID,
    agent_name TEXT,
    carrier_id UUID,
    carrier_name TEXT,
    deal_id UUID,
    policy_number TEXT,
    annual_premium NUMERIC,
    agent_commission_percentage NUMERIC,
    hierarchy_total_percentage NUMERIC,
    expected_payout NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_user_agency_id UUID;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Get user info
    SELECT u.role, u.agency_id INTO v_user_role, v_user_agency_id
    FROM users u
    WHERE u.id = p_user_id;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Verify the requesting user can view the specified agent
    IF v_user_role = 'admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = p_agent_id AND u.agency_id = v_user_agency_id
        ) THEN
            RAISE EXCEPTION 'Permission denied: Agent not in your agency';
        END IF;
    ELSE
        IF p_agent_id != p_user_id AND NOT EXISTS (
            SELECT 1 FROM get_agent_downline(p_user_id) gad
            WHERE gad.id = p_agent_id
        ) THEN
            RAISE EXCEPTION 'Permission denied: Can only view yourself or downlines';
        END IF;
    END IF;

    -- Use explicit date params directly (no relative calculation)
    v_start_date := p_start_date;
    v_end_date := p_end_date;

    RETURN QUERY
    WITH relevant_deals AS (
        SELECT
            d.id AS r_deal_id,
            -- Use carrier-specific date mode from settings, default to policy_effective_date
            CASE WHEN acps.date_mode = 'submission_date'
                 THEN COALESCE(d.submission_date, d.policy_effective_date)
                 ELSE d.policy_effective_date
            END AS effective_date,
            d.policy_number,
            d.annual_premium,
            d.product_id,
            d.status,
            dhs.commission_percentage AS agent_commission_percentage,
            dhs.agent_id
        FROM deal_hierarchy_snapshot dhs
        JOIN deals d ON d.id = dhs.deal_id
        JOIN products p ON p.id = d.product_id
        JOIN carriers c ON c.id = p.carrier_id
        LEFT JOIN agency_carrier_payout_settings acps
          ON acps.agency_id = v_user_agency_id
         AND acps.carrier_id = c.id
        WHERE dhs.agent_id = p_agent_id
        AND (
            CASE WHEN acps.date_mode = 'submission_date'
                 THEN COALESCE(d.submission_date, d.policy_effective_date)
                 ELSE d.policy_effective_date
            END
        ) >= v_start_date
        AND (
            CASE WHEN acps.date_mode = 'submission_date'
                 THEN COALESCE(d.submission_date, d.policy_effective_date)
                 ELSE d.policy_effective_date
            END
        ) <= v_end_date
        AND d.agency_id = v_user_agency_id
        AND dhs.commission_percentage IS NOT NULL
    ),
    -- NEW: Look up the direct downline's commission for each deal
    -- The downline is the agent whose upline_id equals the current agent in the snapshot
    downline_percentages AS (
        SELECT
            rd.r_deal_id,
            rd.agent_id,
            dhs_downline.commission_percentage AS downline_commission_percentage
        FROM relevant_deals rd
        LEFT JOIN deal_hierarchy_snapshot dhs_downline
            ON dhs_downline.deal_id = rd.r_deal_id
            AND dhs_downline.upline_id = rd.agent_id
    ),
    hierarchy_sums AS (
        -- Retained for the hierarchy_total_percentage display field
        SELECT
            dhs.deal_id,
            SUM(dhs.commission_percentage) AS total_percentage
        FROM deal_hierarchy_snapshot dhs
        JOIN relevant_deals rd ON rd.r_deal_id = dhs.deal_id
        WHERE dhs.commission_percentage IS NOT NULL
        GROUP BY dhs.deal_id
    )
    SELECT
        DATE_TRUNC('month', rd.effective_date)::DATE AS month,
        rd.agent_id,
        (u.first_name || ' ' || u.last_name) AS agent_name,
        c.id AS carrier_id,
        c.name AS carrier_name,
        rd.r_deal_id AS deal_id,
        rd.policy_number,
        rd.annual_premium,
        rd.agent_commission_percentage,
        hs.total_percentage AS hierarchy_total_percentage,
        -- FIXED: Spread/override formula instead of proportional
        -- Writing agent (no downline in snapshot) -> COALESCE(NULL, 0) = 0 -> full commission
        -- Manager -> gets spread: their_% - direct_downline_%
        ROUND(
            rd.annual_premium * 0.75 *
            (rd.agent_commission_percentage - COALESCE(dp.downline_commission_percentage, 0)) / 100.0,
            2
        ) AS expected_payout
    FROM relevant_deals rd
    LEFT JOIN downline_percentages dp
        ON dp.r_deal_id = rd.r_deal_id
        AND dp.agent_id = rd.agent_id
    JOIN hierarchy_sums hs ON hs.deal_id = rd.r_deal_id
    JOIN users u ON u.id = rd.agent_id
    JOIN products p ON p.id = rd.product_id
    JOIN carriers c ON c.id = p.carrier_id
    -- LEFT JOIN so unmapped statuses still appear (V3 improvement over V2)
    LEFT JOIN status_mapping sm ON sm.carrier_id = c.id AND LOWER(sm.raw_status) = LOWER(rd.status)
    WHERE
        -- Status filter: include positive, neutral, AND unmapped statuses
        COALESCE(sm.impact, 'neutral') IN ('positive', 'neutral')
        -- Carrier filter (optional)
        AND (p_carrier_id IS NULL OR c.id = p_carrier_id)
    ORDER BY
        rd.effective_date,
        rd.policy_number;
END;
$$;

-- Index to support the new downline_percentages CTE join pattern.
-- Existing index is (agent_id, deal_id); we need (deal_id, upline_id) for the reverse lookup.
CREATE INDEX IF NOT EXISTS idx_deal_hierarchy_snapshot_deal_upline
    ON deal_hierarchy_snapshot(deal_id, upline_id);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_expected_payouts_v3(UUID, UUID, DATE, DATE, UUID) TO authenticated;

COMMENT ON FUNCTION get_expected_payouts_v3 IS
'V3 (fixed): Expected payouts using spread/override formula.

Formula: annual_premium * 0.75 * (agent_% - downline_%) / 100
- Writing agent gets full commission (no downline in snapshot -> spread = full %)
- Each upline gets their spread over their direct report

Features (preserved from V3):
- Explicit p_start_date / p_end_date parameters
- agency_carrier_payout_settings for carrier-specific date modes
- LEFT JOIN status_mapping: unmapped statuses included as neutral
- hierarchy_sums CTE retained for hierarchy_total_percentage display field';

COMMIT;

-- Rollback script (run separately if needed):
/*
-- To revert to the proportional formula, replace the downline_percentages CTE
-- and expected_payout calculation with the original proportional version.
-- The old formula was:
--   ROUND(rd.annual_premium * 0.75 * (rd.agent_commission_percentage / NULLIF(hs.total_percentage, 0)), 2)
*/
