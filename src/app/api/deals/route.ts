import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getOrCreateConversation, logMessage } from "@/lib/sms-helpers";

/**
 * Creates a hierarchy snapshot for a deal
 * This captures the agent hierarchy at the time the deal is created
 * so that visibility is preserved even if agents move to different hierarchies later
 * Also stores commission percentage for each agent based on their position and the product
 */
async function createDealHierarchySnapshot(
  supabase: ReturnType<typeof createAdminClient>,
  dealId: string,
  writingAgentId: string,
  productId: string,
) {
  console.log("[Hierarchy Snapshot] START createDealHierarchySnapshot", {
    dealId,
    writingAgentId,
    productId,
  });

  try {
    // Get the full upline chain using the RPC function
    const { data: uplineChain, error: chainError } = await supabase
      .rpc("get_agent_upline_chain", { p_agent_id: writingAgentId });

    if (chainError) {
      console.error(
        "[Hierarchy Snapshot] Error fetching upline chain:",
        chainError,
      );
      throw new Error(`Failed to fetch upline chain: ${chainError.message}`);
    }

    if (!uplineChain || uplineChain.length === 0) {
      console.warn(
        "[Hierarchy Snapshot] No upline chain found for agent",
        writingAgentId,
      );
      return;
    }

    console.log(
      "[Hierarchy Snapshot] Found upline chain with",
      uplineChain.length,
      "agents",
    );

    // Get all agent IDs from the chain
    const agentIds = uplineChain.map((entry: any) => entry.agent_id);

    // Fetch position_id for each agent
    const { data: agentsWithPositions, error: positionsError } = await supabase
      .from("users")
      .select("id, position_id")
      .in("id", agentIds);

    if (positionsError) {
      console.error(
        "[Hierarchy Snapshot] Error fetching agent positions:",
        positionsError,
      );
      throw new Error(
        `Failed to fetch agent positions: ${positionsError.message}`,
      );
    }

    // Create a map of agent_id -> position_id for quick lookup
    const positionMap = new Map(
      agentsWithPositions?.map((agent) => [agent.id, agent.position_id]) || [],
    );

    // Get all unique position IDs (filter out nulls)
    const positionIds = Array.from(
      new Set(
        Array.from(positionMap.values()).filter((pid) => pid !== null),
      ),
    );

    // Fetch commission percentages for all position-product combinations
    let commissionMap = new Map<string, number>();
    if (positionIds.length > 0 && productId) {
      const { data: commissions, error: commissionsError } = await supabase
        .from("position_product_commissions")
        .select("position_id, commission_percentage")
        .eq("product_id", productId)
        .in("position_id", positionIds);

      if (commissionsError) {
        console.error(
          "[Hierarchy Snapshot] Error fetching commissions:",
          commissionsError,
        );
        // Don't fail - just log and continue with NULL commissions
      } else if (commissions) {
        // Create map of position_id -> commission_percentage
        commissionMap = new Map(
          commissions.map((c) => [c.position_id, c.commission_percentage]),
        );
      }
    }

    console.log(
      "[Hierarchy Snapshot] Fetched commission data for",
      commissionMap.size,
      "position-product combinations",
    );

    // Create snapshot entries for each agent in the chain
    // The uplineChain includes the writing agent themselves and all their uplines
    const snapshotEntries = uplineChain.map((chainEntry: any) => {
      const agentId = chainEntry.agent_id;
      const positionId = positionMap.get(agentId);
      const commissionPercentage = positionId
        ? commissionMap.get(positionId) || null
        : null;

      return {
        deal_id: dealId,
        agent_id: agentId,
        upline_id: chainEntry.upline_id, // null for top-level agent
        commission_percentage: commissionPercentage,
        created_at: new Date().toISOString(),
      };
    });

    console.log(
      "[Hierarchy Snapshot] Creating",
      snapshotEntries.length,
      "snapshot entries with commission data",
    );

    // Insert all snapshot entries in a single operation
    const { error: insertError } = await supabase
      .from("deal_hierarchy_snapshot")
      .insert(snapshotEntries);

    if (insertError) {
      console.error(
        "[Hierarchy Snapshot] Error inserting snapshots:",
        insertError,
      );
      throw new Error(
        `Failed to create hierarchy snapshots: ${insertError.message}`,
      );
    }

    console.log(
      "[Hierarchy Snapshot] Successfully created snapshots for deal",
      dealId,
    );
  } catch (error) {
    console.error("[Hierarchy Snapshot] Unexpected error:", error);
    // Re-throw to let the caller handle it
    throw error;
  }
}

type IncomingBeneficiary = {
  name?: string;
  relationship?: string | null;
};

async function upsertDealBeneficiaries(
  supabase: ReturnType<typeof createAdminClient>,
  dealId: string | null,
  agencyId: string | null,
  beneficiaries: IncomingBeneficiary[] | undefined,
) {
  if (!dealId || !agencyId) {
    return;
  }

  const normalized = Array.isArray(beneficiaries) && beneficiaries.length > 0
    ? beneficiaries
      .map((beneficiary) => {
        const rawName = (beneficiary?.name || "").trim();
        if (!rawName) {
          return null;
        }

        const firstSpaceIndex = rawName.search(/\s/);
        let firstName = rawName;
        let lastName: string | null = null;

        if (firstSpaceIndex !== -1) {
          firstName = rawName.slice(0, firstSpaceIndex).trim();
          lastName = rawName.slice(firstSpaceIndex).trim() || null;
        }

        const cleanedFirstName = firstName || null;
        const cleanedLastName = lastName;

        if (!cleanedFirstName && !cleanedLastName) {
          return null;
        }

        const relationship = beneficiary?.relationship
          ? beneficiary.relationship.trim()
          : "";

        return {
          deal_id: dealId,
          agency_id: agencyId,
          first_name: cleanedFirstName,
          last_name: cleanedLastName,
          relationship: relationship || null,
        };
      })
      .filter((entry): entry is {
        deal_id: string;
        agency_id: string;
        first_name: string | null;
        last_name: string | null;
        relationship: string | null;
      } => !!entry)
    : [];

  const { error: deleteError } = await supabase
    .from("beneficiaries")
    .delete()
    .eq("deal_id", dealId);

  if (deleteError) {
    throw new Error(`Failed to clear beneficiaries: ${deleteError.message}`);
  }

  if (normalized.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("beneficiaries")
    .insert(normalized);

  if (insertError) {
    throw new Error(`Failed to insert beneficiaries: ${insertError.message}`);
  }
}

export async function POST(req: NextRequest) {
  console.log("[Deals API] ========== POST /api/deals REQUEST RECEIVED ==========");
  const supabase = createAdminClient();
  try {
    console.log("[Deals API] Parsing request body...");
    const data = await req.json();
    console.log("[Deals API] Request body parsed successfully");
    console.log("[Deals API] POST /api/deals payload (sanitized)", {
      hasAgentId: !!data?.agent_id,
      hasAgencyId: !!data?.agency_id,
      agencyId: data?.agency_id,
      hasCarrierId: !!data?.carrier_id,
      hasProductId: !!data?.product_id,
      policy_number: data?.policy_number,
      policy_effective_date: data?.policy_effective_date,
      client_phone: data?.client_phone,
      client_email: data?.client_email,
    });

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
      ssn_benefit,
      billing_day_of_month,
      billing_weekday,
      billing_cycle,
      lead_source,
      status,
      notes,
      submission_date,
      beneficiaries,
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

      if (checkError && checkError.code !== "PGRST116") { // PGRST116 is "not found"
        return NextResponse.json({ error: checkError.message }, {
          status: 400,
        });
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
        application_number: application_number ||
          existingDeal.application_number,
        ssn_benefit: ssn_benefit !== undefined ? ssn_benefit : existingDeal.ssn_benefit,
        billing_day_of_month: billing_day_of_month || existingDeal.billing_day_of_month,
        billing_weekday: billing_weekday || existingDeal.billing_weekday,
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

      try {
        await upsertDealBeneficiaries(
          supabase,
          deal.id,
          deal.agency_id,
          beneficiaries,
        );
      } catch (beneficiaryError: any) {
        console.error(
          "[Deals API] Failed to sync beneficiaries for updated deal:",
          beneficiaryError,
        );
        return NextResponse.json(
          { error: beneficiaryError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        deal,
        operation,
        message: "Deal updated successfully",
      }, { status: 200 });
    } else {
      // Create new deal

      // STEP 1: Check subscription limits for free users
      if (agent_id) {
        const { data: agentData, error: agentError } = await supabase
          .from('users')
          .select('subscription_tier, deals_created_count')
          .eq('id', agent_id)
          .single();

        if (agentError) {
          console.error('[Deals API] Error fetching agent subscription data:', agentError);
        } else if (agentData) {
          const subscriptionTier = agentData.subscription_tier || 'free';
          const dealsCreated = agentData.deals_created_count || 0;

          // If user is on free plan and has reached the limit of 10 deals
          if (subscriptionTier === 'free' && dealsCreated >= 10) {
            return NextResponse.json(
              {
                error: 'You have reached the maximum of 10 deals on the Free plan. Please upgrade your subscription to create more deals.',
                message: 'You have reached the maximum of 10 deals on the Free plan. Please upgrade your subscription to create more deals.',
                limit_reached: true
              },
              { status: 403 }
            );
          }
        }
      }

      // STEP 2: Check if phone number already exists for another deal in the same agency
      if (client_phone && agency_id) {
        console.log('[Deals API] Checking phone uniqueness for:', client_phone);
        const { normalizePhoneForStorage } = await import('@/lib/telnyx');
        const normalizedPhone = normalizePhoneForStorage(client_phone);
        console.log('[Deals API] Normalized phone:', normalizedPhone);

        const { data: existingDeal, error: phoneCheckError } = await supabase
          .from('deals')
          .select('id, client_name, policy_number')
          .eq('client_phone', normalizedPhone)
          .eq('agency_id', agency_id)
          .maybeSingle();

        if (phoneCheckError && phoneCheckError.code !== 'PGRST116') {
          console.error('[Deals API] Error checking phone uniqueness:', phoneCheckError);
          return NextResponse.json(
            { error: `Failed to validate phone number: ${phoneCheckError.message}` },
            { status: 400 }
          );
        }

        if (existingDeal) {
          console.log('[Deals API] Phone number already exists for deal:', existingDeal.id);
          return NextResponse.json(
            {
              error: `Phone number ${client_phone} already exists for another deal in your agency (${existingDeal.client_name}, Policy: ${existingDeal.policy_number || 'N/A'}). Each deal must have a unique phone number within the agency.`,
              existing_deal_id: existingDeal.id,
            },
            { status: 409 } // 409 Conflict
          );
        }
        console.log('[Deals API] Phone number is unique');
      }

      // STEP 3: Verify that ALL agents in the upline have positions set
      // IMPORTANT: This is a strict business rule - if even one agent in the upline doesn't have a position,
      // the deal cannot be created because we won't have commission percentages for the hierarchy snapshot

      if (agent_id && product_id) {
        console.log(
          "[Deals API] Validating upline positions before creating deal...",
        );

        // Get the full upline chain for the writing agent
        const { data: uplineChain, error: chainError } = await supabase
          .rpc("get_agent_upline_chain", { p_agent_id: agent_id });

        if (chainError) {
          console.error(
            "[Deals API] Error fetching upline chain for validation:",
            chainError,
          );
          return NextResponse.json(
            {
              error:
                `Failed to validate agent hierarchy: ${chainError.message}`,
            },
            { status: 400 },
          );
        }

        if (!uplineChain || uplineChain.length === 0) {
          return NextResponse.json(
            {
              error:
                "No upline hierarchy found for this agent. Cannot create deal.",
            },
            { status: 400 },
          );
        }

        // Get all agent IDs from the chain
        const agentIds = uplineChain.map((entry: any) => entry.agent_id);

        // Fetch position_id for each agent in the upline
        const { data: agentsWithPositions, error: positionsError } =
          await supabase
            .from("users")
            .select("id, first_name, last_name, position_id")
            .in("id", agentIds);

        if (positionsError) {
          console.error(
            "[Deals API] Error fetching agent positions:",
            positionsError,
          );
          return NextResponse.json(
            {
              error:
                `Failed to validate agent positions: ${positionsError.message}`,
            },
            { status: 400 },
          );
        }

        // Check if ANY agent in the upline doesn't have a position
        const agentsWithoutPositions = agentsWithPositions?.filter((agent) =>
          !agent.position_id
        ) || [];

        if (agentsWithoutPositions.length > 0) {
          const agentNames = agentsWithoutPositions
            .map((a) => `${a.first_name} ${a.last_name}`)
            .join(", ");

          console.error(
            "[Deals API] Deal creation blocked - agents without positions:",
            agentNames,
          );
          return NextResponse.json(
            {
              error:
                `Cannot create deal: The following agents in the upline hierarchy do not have positions assigned: ${agentNames}. All agents in the upline must have positions set before deals can be created.`,
              agents_without_positions: agentsWithoutPositions.map((a) => ({
                id: a.id,
                name: `${a.first_name} ${a.last_name}`,
              })),
            },
            { status: 400 },
          );
        }

        // Additionally verify that commission mappings exist for all positions + product
        const positionIds = agentsWithPositions
          ?.map((agent) => agent.position_id)
          .filter((pid) => pid !== null) || [];

        if (positionIds.length > 0) {
          const { data: commissions, error: commissionsError } = await supabase
            .from("position_product_commissions")
            .select("position_id")
            .eq("product_id", product_id)
            .in("position_id", positionIds);

          if (commissionsError) {
            console.error(
              "[Deals API] Error fetching commission mappings:",
              commissionsError,
            );
            return NextResponse.json(
              {
                error:
                  `Failed to validate commission mappings: ${commissionsError.message}`,
              },
              { status: 400 },
            );
          }

          const positionsWithCommissions = new Set(
            commissions?.map((c) => c.position_id) || [],
          );
          const positionsWithoutCommissions = positionIds.filter((pid) =>
            !positionsWithCommissions.has(pid)
          );

          if (positionsWithoutCommissions.length > 0) {
            console.error(
              "[Deals API] Deal creation blocked - positions without commission mappings:",
              positionsWithoutCommissions,
            );
            return NextResponse.json(
              {
                error:
                  `Cannot create deal: Commission percentages are not configured for some positions in the upline hierarchy. Please contact your administrator to set up commission mappings for this product.`,
                positions_without_commissions: positionsWithoutCommissions,
              },
              { status: 400 },
            );
          }
        }

        console.log(
          "[Deals API] ✓ Validation passed - all upline agents have positions and commission mappings",
        );
      }

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
        ssn_benefit,
        billing_day_of_month,
        billing_weekday,
        billing_cycle,
        lead_source,
        status: status || "pending", // Changed from 'draft' to 'pending' to match book of business
        notes,
        submission_date,
      };

      console.log("[Deals API] Inserting deal into database...");
      const { data: deal, error } = await supabase
        .from("deals")
        .insert([dealData])
        .select()
        .single();

      if (error) {
        console.error("[Deals API] Error inserting deal:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      console.log("[Deals API] Deal inserted successfully, ID:", deal.id);

      try {
        await upsertDealBeneficiaries(
          supabase,
          deal.id,
          deal.agency_id,
          beneficiaries,
        );
      } catch (beneficiaryError: any) {
        console.error(
          "[Deals API] Failed to sync beneficiaries for new deal:",
          beneficiaryError,
        );
        return NextResponse.json(
          { error: beneficiaryError.message },
          { status: 500 },
        );
      }

      // Increment deals_created_count for the agent
      if (agent_id) {
        const { data: currentAgent } = await supabase
          .from('users')
          .select('deals_created_count')
          .eq('id', agent_id)
          .single();

        if (currentAgent) {
          await supabase
            .from('users')
            .update({ deals_created_count: (currentAgent.deals_created_count || 0) + 1 })
            .eq('id', agent_id);
        }
      }

      // Create hierarchy snapshot for the new deal
      if (deal?.id && deal.agent_id && deal.product_id) {
        try {
          console.log("[Deals API] Creating hierarchy snapshot for new deal", {
            id: deal.id,
            agent_id: deal.agent_id,
            product_id: deal.product_id,
          });
          await createDealHierarchySnapshot(
            supabase,
            deal.id,
            deal.agent_id,
            deal.product_id,
          );
          console.log(
            "[Deals API] Hierarchy snapshot creation complete for deal",
            deal.id,
          );
        } catch (e) {
          console.error(
            "[Hierarchy Snapshot] Unexpected error creating snapshot for deal",
            deal.id,
            e,
          );
          // Don't fail the deal creation if snapshot fails, but log the error
        }
      } else {
        console.warn(
          "[Deals API] Missing required fields to create hierarchy snapshot for deal",
          {
            id: deal?.id,
            agent_id: deal?.agent_id,
            product_id: deal?.product_id,
          },
        );
      }

      // Create welcome SMS draft for client (if client phone exists)
      if (deal?.id && deal.client_phone && deal.agent_id) {
        try {
          console.log("[Deals API] Creating welcome SMS draft for client", {
            dealId: deal.id,
            clientPhone: deal.client_phone,
          });

          // Get agent and agency details
          const { data: agentData } = await supabase
            .from("users")
            .select(
              "id, first_name, last_name, agency_id, agency:agency_id(name, phone_number)",
            )
            .eq("id", deal.agent_id)
            .single();

          if (agentData && agentData.agency?.phone_number) {
            const agentName = `${agentData.first_name} ${agentData.last_name}`;
            const agencyName = agentData.agency.name;
            const clientFirstName = deal.client_name?.split(" ")[0] || "there";
            const clientEmail = deal.client_email || "your email";

            const welcomeMessage =
              `Welcome ${clientFirstName}! Thank you for choosing ${agencyName} for your life insurance needs. Your agent ${agentName} is here to help. You'll receive policy updates and reminders by text. Complete your account setup by clicking the invitation sent to ${clientEmail}. Message frequency may vary. Msg&data rates may apply. Reply STOP to opt out. Reply HELP for help.`;

            // Create conversation and log message as DRAFT (not sent automatically)
            const conversation = await getOrCreateConversation(
              agentData.id,
              deal.id,
              agentData.agency_id,
              deal.client_phone,
            );

            await logMessage({
              conversationId: conversation.id,
              senderId: agentData.id,
              receiverId: agentData.id, // Placeholder
              body: welcomeMessage,
              direction: "outbound",
              status: "draft", // Create as draft - requires approval before sending
              metadata: {
                automated: true,
                type: "welcome",
                client_phone: deal.client_phone,
                client_name: deal.client_name,
                deal_id: deal.id,
              },
            });

            console.log(
              "[Deals API] Welcome SMS draft created successfully for",
              deal.client_phone,
            );
          } else {
            console.warn(
              "[Deals API] Cannot create welcome SMS draft - agency phone not configured",
            );
          }
        } catch (smsError) {
          // Don't fail the deal creation if SMS draft creation fails
          console.error("[Deals API] Failed to create welcome SMS draft:", smsError);
        }
      }

      operation = "created";
      return NextResponse.json({
        deal,
        operation,
        message: "Deal created successfully",
      }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create deal" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  try {
    const data = await req.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json({ error: "Deal ID is required" }, {
        status: 400,
      });
    }

    // Fetch current deal to detect status transition for lapse notifications
    const LAPSE_STATUSES = ['lapse_pending', 'lapse'];
    let isTransitioningToLapse = false;
    let currentDealForNotification: {
      client_name: string;
      monthly_premium: number | null;
      annual_premium: number | null;
      carrier_name: string;
      policy_number: string | null;
      policy_effective_date: string | null;
      agent_id: string;
      agency_id: string;
    } | null = null;

    if (updateData.status_standardized && LAPSE_STATUSES.includes(updateData.status_standardized)) {
      const { data: currentDeal } = await supabase
        .from("deals")
        .select(`
          id,
          status_standardized,
          client_name,
          monthly_premium,
          annual_premium,
          policy_number,
          policy_effective_date,
          agent_id,
          agency_id,
          carrier:carriers(name)
        `)
        .eq("id", id)
        .single();

      if (currentDeal && !LAPSE_STATUSES.includes(currentDeal.status_standardized || '')) {
        isTransitioningToLapse = true;
        currentDealForNotification = {
          client_name: currentDeal.client_name,
          monthly_premium: currentDeal.monthly_premium,
          annual_premium: currentDeal.annual_premium,
          carrier_name: (currentDeal.carrier as any)?.name || '',
          policy_number: currentDeal.policy_number,
          policy_effective_date: currentDeal.policy_effective_date,
          agent_id: currentDeal.agent_id,
          agency_id: currentDeal.agency_id,
        };
      }
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

    // If client_phone was updated, also update the conversation's client_phone field
    // This ensures the conversation stays associated with the deal even when phone changes
    if (updateData.client_phone !== undefined && deal.id) {
      const { normalizePhoneForStorage } = await import('@/lib/telnyx');
      const normalizedPhone = updateData.client_phone ? normalizePhoneForStorage(updateData.client_phone) : null;

      const { error: convError } = await supabase
        .from("conversations")
        .update({ client_phone: normalizedPhone })
        .eq("deal_id", deal.id)
        .eq("is_active", true);

      if (convError) {
        console.error('Error updating conversation phone number:', convError);
        // Don't fail the whole request if conversation update fails
      } else {
        console.log(`📞 Updated conversation phone number for deal ${deal.id} to ${normalizedPhone}`);
      }
    }

    // Send lapse notification emails if status transitioned to lapse
    if (isTransitioningToLapse && currentDealForNotification) {
      try {
        // Call Supabase edge function to send lapse notifications
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-lapse-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              deal_id: deal.id,
              agency_id: currentDealForNotification.agency_id,
            }),
          }
        );

        const result = await response.json();
        console.log(`[Deals API] Lapse notifications: ${result.sent || 0} emails sent`,
          result.errors ? `Errors: ${result.errors.join(', ')}` : '');
      } catch (notificationError) {
        // Don't fail the deal update if notifications fail
        console.error('[Deals API] Failed to send lapse notifications:', notificationError);
      }
    }

    return NextResponse.json({ deal, message: "Deal updated successfully" }, {
      status: 200,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update deal" },
      { status: 500 },
    );
  }
}
