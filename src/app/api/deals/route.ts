import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/telnyx";
import { getOrCreateConversation, logMessage } from "@/lib/sms-helpers";

/**
 * Creates a hierarchy snapshot for a deal
 * This captures the agent hierarchy at the time the deal is created
 * so that visibility is preserved even if agents move to different hierarchies later
 */
async function createDealHierarchySnapshot(
  supabase: ReturnType<typeof createAdminClient>,
  dealId: string,
  writingAgentId: string
) {
  console.log('[Hierarchy Snapshot] START createDealHierarchySnapshot', { dealId, writingAgentId })

  try {
    // Get the full upline chain using the RPC function
    const { data: uplineChain, error: chainError } = await supabase
      .rpc('get_agent_upline_chain', { p_agent_id: writingAgentId })

    if (chainError) {
      console.error('[Hierarchy Snapshot] Error fetching upline chain:', chainError)
      throw new Error(`Failed to fetch upline chain: ${chainError.message}`)
    }

    if (!uplineChain || uplineChain.length === 0) {
      console.warn('[Hierarchy Snapshot] No upline chain found for agent', writingAgentId)
      return
    }

    console.log('[Hierarchy Snapshot] Found upline chain with', uplineChain.length, 'agents')

    // Create snapshot entries for each agent in the chain
    // The uplineChain includes the writing agent themselves and all their uplines
    const snapshotEntries = uplineChain.map((chainEntry: any) => ({
      deal_id: dealId,
      agent_id: chainEntry.agent_id,
      upline_id: chainEntry.upline_id, // null for top-level agent
      created_at: new Date().toISOString(),
    }))

    console.log('[Hierarchy Snapshot] Creating', snapshotEntries.length, 'snapshot entries')

    // Insert all snapshot entries in a single operation
    const { error: insertError } = await supabase
      .from('deal_hierarchy_snapshot')
      .insert(snapshotEntries)

    if (insertError) {
      console.error('[Hierarchy Snapshot] Error inserting snapshots:', insertError)
      throw new Error(`Failed to create hierarchy snapshots: ${insertError.message}`)
    }

    console.log('[Hierarchy Snapshot] Successfully created snapshots for deal', dealId)
  } catch (error) {
    console.error('[Hierarchy Snapshot] Unexpected error:', error)
    // Re-throw to let the caller handle it
    throw error
  }
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  try {
    const data = await req.json();
    console.log('[Deals API] POST /api/deals payload (sanitized)', {
      hasAgentId: !!data?.agent_id,
      hasAgencyId: !!data?.agency_id,
      agencyId: data?.agency_id,
      hasCarrierId: !!data?.carrier_id,
      hasProductId: !!data?.product_id,
      policy_number: data?.policy_number,
      policy_effective_date: data?.policy_effective_date,
    })

    // Destructure all possible fields
    const {
      agent_id,
      agency_id,
      carrier_id,
      product_id,
      client_id,
      client_name,
      client_email,
      client_phone,
      date_of_birth,
      ssn_last_4,
      client_address,
      policy_number,
      application_number,
      monthly_premium,
      annual_premium,
      policy_effective_date,
      billing_cycle,
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
        agency_id: agency_id || existingDeal.agency_id,
        client_id: client_id || existingDeal.client_id,
        client_email: client_email || existingDeal.client_email,
        client_phone: client_phone || existingDeal.client_phone,
        date_of_birth: date_of_birth || existingDeal.date_of_birth,
        ssn_last_4: ssn_last_4 || existingDeal.ssn_last_4,
        client_address: client_address || existingDeal.client_address,
        application_number: application_number || existingDeal.application_number,
        billing_cycle: billing_cycle || existingDeal.billing_cycle,
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
        agency_id,
        carrier_id,
        product_id,
        client_id,
        client_name,
        client_email,
        client_phone,
        date_of_birth,
        ssn_last_4,
        client_address,
        policy_number,
        application_number,
        monthly_premium,
        annual_premium,
        policy_effective_date,
        billing_cycle,
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

      // Create hierarchy snapshot for the new deal
      if (deal?.id && deal.agent_id) {
        try {
          console.log('[Deals API] Creating hierarchy snapshot for new deal', { id: deal.id, agent_id: deal.agent_id })
          await createDealHierarchySnapshot(
            supabase,
            deal.id,
            deal.agent_id
          )
          console.log('[Deals API] Hierarchy snapshot creation complete for deal', deal.id)
        } catch (e) {
          console.error('[Hierarchy Snapshot] Unexpected error creating snapshot for deal', deal.id, e)
          // Don't fail the deal creation if snapshot fails, but log the error
        }
      } else {
        console.warn('[Deals API] Missing required fields to create hierarchy snapshot for deal', { id: deal?.id, agent_id: deal?.agent_id })
      }

      // Send welcome SMS to client (if client phone exists)
      if (deal?.id && deal.client_phone && deal.agent_id) {
        try {
          console.log('[Deals API] Sending welcome SMS to client', { dealId: deal.id, clientPhone: deal.client_phone })

          // Get agent and agency details
          const { data: agentData } = await supabase
            .from('users')
            .select('id, first_name, last_name, agency_id, agency:agency_id(name, phone_number)')
            .eq('id', deal.agent_id)
            .single()

          if (agentData && agentData.agency?.phone_number) {
            const agentName = `${agentData.first_name} ${agentData.last_name}`
            const agencyName = agentData.agency.name
            const clientFirstName = deal.client_name?.split(' ')[0] || 'there'
            const clientEmail = deal.client_email || 'your email'

            const welcomeMessage = `Welcome ${clientFirstName}! Thank you for choosing ${agencyName} for your life insurance needs. Your agent ${agentName} is here to help. You'll receive policy updates and reminders by text. Complete your account setup by clicking the invitation sent to ${clientEmail}. Message frequency may vary. Msg&data rates may apply. Reply STOP to opt out. Reply HELP for help.`

            // Send SMS via Telnyx
            await sendSMS({
              from: agentData.agency.phone_number,
              to: deal.client_phone,
              text: welcomeMessage,
            })

            // Create conversation and log message (using client phone to prevent duplicates)
            const conversation = await getOrCreateConversation(
              agentData.id,
              deal.id,
              agentData.agency_id,
              deal.client_phone
            )

            await logMessage({
              conversationId: conversation.id,
              senderId: agentData.id,
              receiverId: agentData.id, // Placeholder
              body: welcomeMessage,
              direction: 'outbound',
              status: 'sent',
              metadata: {
                automated: true,
                type: 'welcome',
                client_phone: deal.client_phone,
                client_name: deal.client_name,
                deal_id: deal.id,
              },
            })

            console.log('[Deals API] Welcome SMS sent successfully to', deal.client_phone)
          } else {
            console.warn('[Deals API] Cannot send welcome SMS - agency phone not configured')
          }
        } catch (smsError) {
          // Don't fail the deal creation if SMS fails
          console.error('[Deals API] Failed to send welcome SMS:', smsError)
        }
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
