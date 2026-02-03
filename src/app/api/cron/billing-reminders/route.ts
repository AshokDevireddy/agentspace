/**
 * Billing Reminders Cron Job
 * Runs daily at 8 AM to remind clients about upcoming premium payments
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getConversationIfExists, logMessage } from "@/lib/sms-helpers";
import {
  DEFAULT_SMS_TEMPLATES,
  formatBeneficiaries,
  replaceSmsPlaceholders,
} from "@/lib/sms-template-helpers";
import { batchFetchAgencySmsSettings } from "@/lib/sms-template-helpers.server";
import { calculateNextCustomBillingDate } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    console.log("💰 ========================================");
    console.log("💰 BILLING REMINDERS CRON STARTED");
    console.log("💰 ========================================");

    // Verify this is a cron request
    const authHeader = request.headers.get("authorization");
    console.log("🔐 Auth header:", authHeader ? "Present" : "Not present");
    console.log("🔐 CRON_SECRET set:", process.env.CRON_SECRET ? "Yes" : "No");

    // CRON_SECRET is required for security - must be configured
    if (!process.env.CRON_SECRET) {
      console.log("❌ Unauthorized - CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error - CRON_SECRET not set" },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("❌ Unauthorized - CRON_SECRET mismatch");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.log("✅ Authorization passed");

    const supabase = createAdminClient();

    // Get dates in PST
    const todayPST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
    );
    todayPST.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(todayPST);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    console.log(`📅 Current time (UTC): ${new Date().toISOString()}`);
    console.log(`📅 Today (PST): ${todayPST.toLocaleDateString("en-US")}`);
    console.log(
      `📅 Looking for billing due on: ${
        threeDaysFromNow.toLocaleDateString("en-US")
      } (3 days from now)`,
    );

    // Query deals using new RPC function with custom billing date support
    console.log(
      "🔍 Querying deals using RPC function with status_mapping and custom billing dates...",
    );
    const { data: deals, error: dealsError } = await supabase
      .rpc("get_billing_reminder_deals_v2");

    if (dealsError) {
      console.error("❌ Error querying deals:", dealsError);
      throw dealsError;
    }

    if (!deals || deals.length === 0) {
      console.log("⚠️  No deals with billing reminders due found");
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No billing reminders due",
      });
    }

    console.log(`📊 Found ${deals.length} deals with billing reminders due`);

    const agencyIds = deals.map((d: { agency_id: string }) => d.agency_id);
    const agencySettingsMap = await batchFetchAgencySmsSettings(agencyIds);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each deal
    console.log("\n💌 Processing billing reminders...");
    for (const deal of deals) {
      try {
        let nextBillingDate: Date;
        if (
          deal.ssn_benefit && deal.billing_day_of_month && deal.billing_weekday
        ) {
          const customDate = calculateNextCustomBillingDate(
            deal.billing_day_of_month,
            deal.billing_weekday,
          );
          nextBillingDate = customDate || new Date(deal.next_billing_date);
          console.log(
            `  Using custom billing pattern: ${deal.billing_day_of_month} ${deal.billing_weekday}`,
          );
        } else {
          nextBillingDate = new Date(deal.next_billing_date);
        }
        const nextBillingDateStr = nextBillingDate.toLocaleDateString("en-US");
        console.log(
          `\n📬 Processing: ${deal.client_name} (${deal.client_phone})`,
        );
        console.log(`  Next billing: ${nextBillingDateStr} (due in 3 days)`);
        console.log(
          `  Agent: ${deal.agent_first_name} ${deal.agent_last_name} (ID: ${deal.agent_id})`,
        );
        console.log(`  Agent Tier: ${deal.agent_subscription_tier}`);
        console.log(
          `  Agency: ${deal.agency_name} (Phone: ${deal.agency_phone})`,
        );

        if (!deal.messaging_enabled) {
          console.log(
            `  ⚠️  SKIPPED: Messaging is disabled for agency ${deal.agency_name}`,
          );
          skippedCount++;
          continue;
        }

        if (
          deal.agent_subscription_tier === "free" ||
          deal.agent_subscription_tier === "basic"
        ) {
          console.log(
            `  ⏭️  SKIPPED: Agent is on ${deal.agent_subscription_tier} tier (automated messaging restricted to Pro/Expert only)`,
          );
          skippedCount++;
          continue;
        }

        console.log(`  🔍 Checking for existing conversation...`);
        const conversation = await getConversationIfExists(
          deal.agent_id,
          deal.deal_id,
          deal.agency_id,
          deal.client_phone,
        );

        if (!conversation) {
          console.log(
            `  ⏭️  SKIPPED: No existing conversation found for ${deal.client_name}`,
          );
          skippedCount++;
          continue;
        }

        console.log(`  📞 Conversation ID: ${conversation.id}`);
        console.log(
          `  📱 SMS Opt-in Status: ${conversation.sms_opt_in_status}`,
        );

        if (conversation.sms_opt_in_status !== "opted_in") {
          console.log(
            `  ❌ SKIPPED: Client has not opted in (status: ${conversation.sms_opt_in_status})`,
          );
          skippedCount++;
          continue;
        }

        const agencySettings = agencySettingsMap.get(deal.agency_id);
        if (agencySettings?.sms_billing_reminder_enabled === false) {
          console.log(
            `  ⏭️  SKIPPED: Billing reminder SMS disabled for agency ${deal.agency_name}`,
          );
          skippedCount++;
          continue;
        }

        const firstName = deal.client_name.split(" ")[0];

        // Fetch additional deal data for template variables
        const { data: dealDetails } = await supabase
          .from("deals")
          .select(
            "monthly_premium, policy_effective_date, face_value, policy_number, carrier_id",
          )
          .eq("id", deal.deal_id)
          .single();

        const insured = deal.client_name || "";
        const policyNumber = dealDetails?.policy_number || "";
        const faceAmount = dealDetails?.face_value
          ? `$${dealDetails.face_value.toLocaleString()}`
          : "";
        const monthlyPremium = dealDetails?.monthly_premium
          ? `$${dealDetails.monthly_premium.toFixed(2)}`
          : "";
        const initialDraft = dealDetails?.policy_effective_date || "";

        // Fetch carrier name
        let carrierName = "";
        if (dealDetails?.carrier_id) {
          const { data: carrier } = await supabase
            .from("carriers")
            .select("name")
            .eq("id", dealDetails.carrier_id)
            .single();
          carrierName = carrier?.name || "";
        }

        // Fetch beneficiaries
        const { data: beneficiaries } = await supabase
          .from("beneficiaries")
          .select("first_name, last_name")
          .eq("deal_id", deal.deal_id);
        const beneficiariesList = formatBeneficiaries(beneficiaries);

        // Fetch agent phone number
        const { data: agent } = await supabase
          .from("users")
          .select("phone_number")
          .eq("id", deal.agent_id)
          .single();
        const agentPhone = agent?.phone_number || "";

        const template = agencySettings?.sms_billing_reminder_template ||
          DEFAULT_SMS_TEMPLATES.billing_reminder;
        const messageText = replaceSmsPlaceholders(template, {
          client_first_name: firstName,
          agent_phone: agentPhone,
          insured,
          policy_number: policyNumber,
          face_amount: faceAmount,
          monthly_premium: monthlyPremium,
          initial_draft: initialDraft,
          carrier_name: carrierName,
          beneficiaries: beneficiariesList,
        });

        console.log(`  📝 Message: "${messageText}"`);
        console.log(`  📤 Creating draft message...`);

        await logMessage({
          conversationId: conversation.id,
          senderId: deal.agent_id,
          receiverId: deal.agent_id,
          body: messageText,
          direction: "outbound",
          status: "draft",
          metadata: {
            automated: true,
            type: "billing_reminder",
            client_phone: deal.client_phone,
            client_name: deal.client_name,
            billing_cycle: deal.billing_cycle,
            next_billing_date: nextBillingDate.toISOString(),
            ssn_benefit: deal.ssn_benefit,
            billing_pattern: deal.ssn_benefit
              ? `${deal.billing_day_of_month} ${deal.billing_weekday}`
              : null,
          },
        });

        successCount++;
        console.log(
          `  🎉 SUCCESS: Billing reminder created as draft for ${deal.client_name}`,
        );
      } catch (error) {
        console.error(`  ❌ ERROR sending to ${deal.client_name}:`, error);
        errorCount++;
      }
    }

    console.log("\n💰 ========================================");
    console.log("💰 BILLING REMINDERS CRON COMPLETED");
    console.log("💰 ========================================");
    console.log(`✅ Sent: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📊 Total deals checked: ${deals.length}`);
    console.log("💰 ========================================\n");

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      skipped: skippedCount,
      total: deals.length,
    });
  } catch (error) {
    console.error("\n❌ ========================================");
    console.error("❌ BILLING REMINDERS CRON FATAL ERROR");
    console.error("❌ ========================================");
    console.error("Error:", error);
    console.error("❌ ========================================\n");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
