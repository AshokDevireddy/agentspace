import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

async function createCommissionSnapshotsForDeal(
  supabase: ReturnType<typeof createAdminClient>,
  dealId: string,
  writingAgentId: string,
  carrierId: string,
  productId: string
) {
  console.log('[Snapshots] START createCommissionSnapshotsForDeal', { dealId, writingAgentId, carrierId, productId })

  let currentAgentId: string | null = writingAgentId
  let level = 0

  interface MinimalAgent { id: string; upline_id: string | null; position_id: string }

  while (currentAgentId) {
    console.log('[Snapshots] Processing agent in chain', { currentAgentId, level })
    const agentRes = await supabase
      .from('users')
      .select('id, upline_id, position_id')
      .eq('id', currentAgentId)
      .single()
    const agentRow = agentRes.data as MinimalAgent | null
    const agentError = agentRes.error

    if (agentError || !agentRow) {
      console.error(`[Snapshots] Could not fetch agent details for ID ${currentAgentId}. Error: ${agentError?.message}`)
      break
    }
    console.log('[Snapshots] Agent mapping', { agentId: agentRow.id, upline_id: agentRow.upline_id, position_id: agentRow.position_id })

    const { data: commissionStructure } = await supabase
      .from('commission_structures')
      .select('percentage, commission_type, level')
      .eq('carrier_id', carrierId)
      .eq('position_id', (agentRow as MinimalAgent).position_id)
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('level')
      .limit(1)
    console.log("AgentRow", agentRow)
    if (commissionStructure && commissionStructure.length > 0) {
      const structure = commissionStructure[0]
      console.log('[Snapshots] Found commission structure', { agentId: agentRow.id, position_id: agentRow.position_id, structure })
      const snapshotEntry = {
        deal_id: dealId,
        agent_id: (agentRow as MinimalAgent).id,
        position_id: (agentRow as MinimalAgent).position_id,
        carrier_id: carrierId,
        product_id: productId,
        commission_type: structure.commission_type,
        percentage: structure.percentage,
        level: level,
        upline_agent_id: (agentRow as MinimalAgent).upline_id,
        snapshot_date: new Date().toISOString(),
      }

      console.log('[Snapshots] About to upsert snapshot', snapshotEntry)
      const { error: insertError } = await supabase
        .from('commission_snapshots')
        .upsert(snapshotEntry, { onConflict: 'deal_id,agent_id,commission_type,level', ignoreDuplicates: false })

      if (insertError) {
        console.error(`[Snapshots] Failed to insert snapshot for agent ${(agentRow as MinimalAgent).id} on deal ${dealId}:`, insertError)
      } else {
        console.log('[Snapshots] Inserted snapshot', snapshotEntry)
      }
    }

    currentAgentId = (agentRow as MinimalAgent).upline_id
    level += 1
  }
  console.log('[Snapshots] END createCommissionSnapshotsForDeal', { dealId })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  try {
    const data = await req.json();
    console.log('[Deals API] POST /api/deals payload (sanitized)', {
      hasAgentId: !!data?.agent_id,
      hasCarrierId: !!data?.carrier_id,
      hasProductId: !!data?.product_id,
      policy_number: data?.policy_number,
      policy_effective_date: data?.policy_effective_date,
    })

    // Destructure all possible fields
    const {
      agent_id,
      carrier_id,
      product_id,
      client_name,
      client_phone,
      policy_number,
      application_number,
      monthly_premium,
      annual_premium,
      policy_effective_date,
      split_agent_id,
      split_percentage,
      referral_count,
      lead_source,
      status,
      notes,
    } = data;

    // Check if a deal already exists with this policy_number and carrier_id
    let existingDeal = null;
    if (policy_number && carrier_id) {
      const { data: existing, error: checkError } = await supabase
        .from("deals")
        .select("*")
        .eq("policy_number", policy_number)
        .eq("carrier_id", carrier_id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
        return NextResponse.json({ error: checkError.message }, { status: 400 });
      }
      existingDeal = existing;
    }

    let dealData;
    let operation;

    if (existingDeal) {
      // Update existing deal - commission reports are authoritative for core fields
      // but post a deal can fill in missing fields
      dealData = {
        // Fields that post a deal can update (commission reports don't provide these)
        client_phone: client_phone || existingDeal.client_phone,
        application_number: application_number || existingDeal.application_number,
        split_agent_id: split_agent_id || existingDeal.split_agent_id,
        split_percentage: split_percentage || existingDeal.split_percentage,
        referral_count: referral_count || existingDeal.referral_count,
        lead_source: lead_source || existingDeal.lead_source,
        notes: notes || existingDeal.notes,
        // Update timestamp
        updated_at: new Date().toISOString(),
      } as any;

      // Only update these fields if they're provided and the existing deal doesn't have them
      if (client_name && !existingDeal.client_name) {
        dealData.client_name = client_name;
      }
      if (agent_id && !existingDeal.agent_id) {
        dealData.agent_id = agent_id;
      }
      if (product_id && !existingDeal.product_id) {
        dealData.product_id = product_id;
      }
      if (monthly_premium && !existingDeal.monthly_premium) {
        dealData.monthly_premium = monthly_premium;
      }
      if (annual_premium && !existingDeal.annual_premium) {
        dealData.annual_premium = annual_premium;
      }
      if (policy_effective_date && !existingDeal.policy_effective_date) {
        dealData.policy_effective_date = policy_effective_date;
      }

      const { data: deal, error } = await supabase
        .from("deals")
        .update(dealData)
        .eq("id", existingDeal.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      operation = "updated";
      return NextResponse.json({ deal, operation, message: "Deal updated successfully" }, { status: 200 });
    } else {
      // Create new deal
      dealData = {
        agent_id,
        carrier_id,
        product_id,
        client_name,
        client_phone,
        policy_number,
        application_number,
        monthly_premium,
        annual_premium,
        policy_effective_date,
        split_agent_id,
        split_percentage,
        referral_count,
        lead_source,
        status: status || "pending", // Changed from 'draft' to 'pending' to match book of business
        notes,
      };

      const { data: deal, error } = await supabase
        .from("deals")
        .insert([dealData])
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Create commission snapshots for the new deal
      if (deal?.id && deal.agent_id && deal.carrier_id && deal.product_id) {
        try {
          console.log('[Deals API] Creating snapshots for new deal', { id: deal.id, agent_id: deal.agent_id, carrier_id: deal.carrier_id, product_id: deal.product_id })
          await createCommissionSnapshotsForDeal(
            supabase,
            deal.id,
            deal.agent_id,
            deal.carrier_id,
            deal.product_id
          )
          console.log('[Deals API] Snapshot creation attempt complete for deal', deal.id)
        } catch (e) {
          console.error('[Snapshots] Unexpected error creating snapshots for deal', deal.id, e)
        }
      } else {
        console.warn('[Deals API] Missing required fields to create snapshots for deal', { id: deal?.id, agent_id: deal?.agent_id, carrier_id: deal?.carrier_id, product_id: deal?.product_id })
      }

      operation = "created";
      return NextResponse.json({ deal, operation, message: "Deal created successfully" }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create deal" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  try {
    const data = await req.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: deal, error } = await supabase
      .from("deals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ deal, message: "Deal updated successfully" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update deal" },
      { status: 500 }
    );
  }
}
