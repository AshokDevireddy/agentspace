-- Fix: Non-admin agents should not be able to request agency-wide scope on the dashboard.
-- New v3 function with defense-in-depth admin check. v2 is preserved for the scoreboard page.
-- Non-admins requesting p_scope='agency' are downgraded to 'team' unless
-- their agency has scoreboard_agent_visibility enabled.

CREATE OR REPLACE FUNCTION public.get_scoreboard_data_updated_lapsed_deals_v3(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  assumed_months_till_lapse integer,
  p_scope text DEFAULT 'agency'::text,
  submitted boolean DEFAULT false,
  p_use_submitted_date boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_agency_id uuid;
  v_user_email text;
  v_user_name text;
  v_internal_user_id uuid;
  v_is_admin boolean;
  v_agency_visibility boolean;
  result jsonb;
BEGIN
  -- Look up user by auth_user_id to get their internal ID and agency
  SELECT id, agency_id, email, first_name || ' ' || last_name
  INTO v_internal_user_id, v_agency_id, v_user_email, v_user_name
  FROM users
  WHERE auth_user_id = p_user_id
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not associated with an agency'
    );
  END IF;

  -- Defense-in-depth: non-admins cannot request agency scope
  -- unless scoreboard_agent_visibility is enabled for their agency
  SELECT COALESCE(u.is_admin, false) OR u.perm_level = 'admin' OR u.role = 'admin'
  INTO v_is_admin
  FROM users u WHERE u.id = v_internal_user_id;

  IF NOT COALESCE(v_is_admin, false) AND p_scope = 'agency' THEN
    SELECT COALESCE(a.scoreboard_agent_visibility, false)
    INTO v_agency_visibility
    FROM agencies a WHERE a.id = v_agency_id;

    IF NOT v_agency_visibility THEN
      p_scope := 'team';
    END IF;
  END IF;

  WITH
  user_downline AS (
    SELECT id FROM get_agent_downline(v_internal_user_id)
  ),

  agency_agents AS (
    SELECT
      u.id AS agent_id,
      CONCAT(u.first_name, ' ', u.last_name) AS name
    FROM users u
    WHERE u.agency_id = v_agency_id
      AND u.role <> 'client'
      AND u.is_active = true
      AND (
        p_scope = 'agency'
        OR u.id = v_internal_user_id
        OR u.id IN (SELECT id FROM user_downline)
      )
  ),

  date_params AS (
    SELECT
      p_start_date AS start_date,
      p_end_date AS end_date,
      CURRENT_DATE AS today,
      GREATEST(COALESCE(assumed_months_till_lapse, 0), 0) AS assumed_months_till_lapse
  ),

  agency_deals AS (
    SELECT
      d.id AS deal_id,
      d.agent_id,
      d.carrier_id,
      d.status,
      d.status_standardized,
      d.annual_premium,
      d.billing_cycle,
      CASE
        WHEN p_use_submitted_date = true THEN d.submission_date
        ELSE COALESCE(d.policy_effective_date, d.submission_date)
      END AS policy_start_date
    FROM deals d
    JOIN users u
      ON u.id = d.agent_id
     AND u.is_active = true
    CROSS JOIN date_params dp
    WHERE d.agency_id = v_agency_id
      AND (
        CASE
          WHEN p_use_submitted_date = true THEN d.submission_date
          ELSE COALESCE(d.policy_effective_date, d.submission_date)
        END
      ) IS NOT NULL
      AND (
        CASE
          WHEN p_use_submitted_date = true THEN d.submission_date
          ELSE COALESCE(d.policy_effective_date, d.submission_date)
        END
      ) BETWEEN dp.start_date AND dp.end_date
      AND d.annual_premium > 0
      AND (
        p_scope = 'agency'
        OR d.agent_id = v_internal_user_id
        OR d.agent_id IN (SELECT id FROM user_downline)
      )
  ),

  positive_deals AS (
    SELECT
      ad.deal_id,
      ad.agent_id,
      ad.annual_premium,
      ad.billing_cycle,
      ad.policy_start_date,
      COALESCE(sm.status_standardized = 'Lapsed', false) AS is_lapsed
    FROM agency_deals ad
    LEFT JOIN status_mapping sm
      ON sm.carrier_id = ad.carrier_id
     AND sm.raw_status = ad.status
    WHERE
      submitted = true
      OR (
        COALESCE(sm.impact, 'neutral') = 'positive'
        OR sm.status_standardized = 'Lapsed'
      )
  ),

  deal_billing_params AS (
    SELECT
      pd.agent_id,
      pd.deal_id,
      pd.policy_start_date,
      pd.is_lapsed,
      CASE
        WHEN pd.is_lapsed THEN pd.annual_premium / 12.0
        WHEN pd.billing_cycle = 'monthly' THEN pd.annual_premium / 12.0
        WHEN pd.billing_cycle = 'quarterly' THEN pd.annual_premium / 4.0
        WHEN pd.billing_cycle = 'semi-annually' THEN pd.annual_premium / 2.0
        WHEN pd.billing_cycle = 'annually' THEN pd.annual_premium
        ELSE pd.annual_premium / 12.0
      END AS payment_amount,
      CASE
        WHEN pd.is_lapsed THEN 1
        WHEN pd.billing_cycle = 'monthly' THEN 1
        WHEN pd.billing_cycle = 'quarterly' THEN 3
        WHEN pd.billing_cycle = 'semi-annually' THEN 6
        WHEN pd.billing_cycle = 'annually' THEN 12
        ELSE 1
      END AS months_interval
    FROM positive_deals pd
  ),

  deal_payments AS (
    SELECT
      dbp.agent_id,
      dbp.deal_id,
      (dbp.policy_start_date + (i * interval '1 month' * dbp.months_interval))::date AS payment_date,
      dbp.payment_amount
    FROM deal_billing_params dbp
    CROSS JOIN date_params dp
    CROSS JOIN generate_series(0, 11) AS i
    WHERE dbp.is_lapsed = false
      AND (dbp.policy_start_date + (i * interval '1 month' * dbp.months_interval))::date
          BETWEEN dp.start_date AND dp.end_date
      AND (dbp.policy_start_date + (i * interval '1 month' * dbp.months_interval))::date <= dp.today

    UNION ALL

    SELECT
      dbp.agent_id,
      dbp.deal_id,
      (dbp.policy_start_date + (i * interval '1 month'))::date AS payment_date,
      dbp.payment_amount
    FROM deal_billing_params dbp
    CROSS JOIN date_params dp
    CROSS JOIN LATERAL (
      SELECT LEAST(
        dp.assumed_months_till_lapse,
        GREATEST(
          0,
          (EXTRACT(YEAR FROM age(dp.end_date, dbp.policy_start_date))::int * 12)
          + EXTRACT(MONTH FROM age(dp.end_date, dbp.policy_start_date))::int
        )
      ) AS lapse_months
    ) lm
    CROSS JOIN LATERAL generate_series(0, GREATEST(lm.lapse_months - 1, 0)) AS i
    WHERE dbp.is_lapsed = true
      AND (dbp.policy_start_date + (i * interval '1 month'))::date
          BETWEEN dp.start_date AND dp.end_date
      AND (dbp.policy_start_date + (i * interval '1 month'))::date <= dp.today
  ),

  agent_daily_breakdown AS (
    SELECT
      x.agent_id,
      jsonb_object_agg(
        x.policy_start_date::text,
        ROUND(x.daily_total::numeric, 2)
      ) AS daily_breakdown
    FROM (
      SELECT
        src.agent_id,
        src.policy_start_date,
        SUM(src.annual_premium) AS daily_total
      FROM (
        SELECT
          pd.agent_id,
          pd.policy_start_date,
          pd.annual_premium
        FROM positive_deals pd
        WHERE submitted = false

        UNION ALL

        SELECT
          ad.agent_id,
          ad.policy_start_date,
          ad.annual_premium
        FROM agency_deals ad
        WHERE submitted = true
      ) src
      GROUP BY src.agent_id, src.policy_start_date
    ) x
    GROUP BY x.agent_id
  ),

  agent_totals AS (
    SELECT
      t.agent_id,
      SUM(t.annual_premium) AS total_production,
      COUNT(DISTINCT t.deal_id) AS deal_count
    FROM (
      SELECT
        pd.agent_id,
        pd.deal_id,
        pd.annual_premium
      FROM positive_deals pd
      WHERE submitted = false

      UNION ALL

      SELECT
        ad.agent_id,
        ad.deal_id,
        ad.annual_premium
      FROM agency_deals ad
      WHERE submitted = true
    ) t
    GROUP BY t.agent_id
  ),

  new_business_agents AS (
    SELECT DISTINCT agent_id
    FROM positive_deals pd
    CROSS JOIN date_params dp
    WHERE pd.policy_start_date BETWEEN dp.start_date AND dp.end_date
  ),

  leaderboard_data AS (
    SELECT
      aa.agent_id,
      aa.name,
      COALESCE(at.total_production, 0) AS total,
      COALESCE(adb.daily_breakdown, '{}'::jsonb) AS daily_breakdown,
      COALESCE(at.deal_count, 0) AS deal_count
    FROM agency_agents aa
    JOIN new_business_agents nba ON nba.agent_id = aa.agent_id
    LEFT JOIN agent_totals at ON at.agent_id = aa.agent_id
    LEFT JOIN agent_daily_breakdown adb ON adb.agent_id = aa.agent_id
    WHERE COALESCE(at.deal_count, 0) > 0
    ORDER BY total DESC
  ),

  ranked_leaderboard AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY total DESC) AS rank,
      *
    FROM leaderboard_data
  ),

  overall_stats AS (
    SELECT
      COALESCE(SUM(total), 0) AS total_production,
      COALESCE(SUM(deal_count), 0) AS total_deals,
      COUNT(*) AS active_agents
    FROM leaderboard_data
  )

  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'leaderboard', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'rank', rank,
            'agent_id', agent_id,
            'name', name,
            'total', ROUND(total::numeric, 2),
            'dailyBreakdown', daily_breakdown,
            'dealCount', deal_count
          )
        ) FROM ranked_leaderboard),
        '[]'::jsonb
      ),
      'stats', (
        SELECT jsonb_build_object(
          'totalProduction', ROUND(total_production::numeric, 2),
          'totalDeals', total_deals,
          'activeAgents', active_agents
        )
        FROM overall_stats
      ),
      'dateRange', jsonb_build_object(
        'startDate', p_start_date::text,
        'endDate', p_end_date::text
      )
    )
  )
  INTO result;

  RETURN result;
END;
$function$;
