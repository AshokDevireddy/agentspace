"use client"

import { Switch } from "@/components/ui/switch"
import { AgentSmsAutomationList, type AgentAutoSendInfo } from "@/components/agent-sms-automation-list"

const MESSAGE_TYPES = [
  { key: "welcome", label: "Welcome Messages", description: "Sent when a new client conversation is created" },
  { key: "birthday", label: "Birthday Messages", description: "Sent on client birthdays" },
  { key: "lapse", label: "Lapse Reminders", description: "Sent when a policy enters lapse pending status" },
  { key: "billing", label: "Billing Reminders", description: "Sent before premium payments are due" },
  { key: "quarterly", label: "Quarterly Check-ins", description: "Sent every 90 days from policy effective date" },
  { key: "policy_packet", label: "Policy Packet Follow-ups", description: "Sent 14 days after policy effective date" },
  { key: "holiday", label: "Holiday Messages", description: "Sent on US federal holidays" },
] as const

interface SmsAutomationSettingsProps {
  smsAutoSendEnabled: boolean
  onAutoSendEnabledChange: (enabled: boolean) => void
  typeOverrides: Record<string, boolean>
  onTypeOverrideChange: (type: string, requireApproval: boolean) => void
  saving: boolean
  agents?: AgentAutoSendInfo[]
  agentsLoading?: boolean
  onAgentToggle?: (agentId: string, value: boolean | null) => void
  agentSaving?: string | null
}

export function SmsAutomationSettings({
  smsAutoSendEnabled,
  onAutoSendEnabledChange,
  typeOverrides,
  onTypeOverrideChange,
  saving,
  agents,
  agentsLoading,
  onAgentToggle,
  agentSaving,
}: SmsAutomationSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Master Toggle Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Auto-Send Messages</h3>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, automated messages are sent immediately via SMS and email. When disabled, all messages are saved as drafts for manual review. Individual agents can override this default.
            </p>
          </div>
          <Switch
            checked={smsAutoSendEnabled}
            onCheckedChange={onAutoSendEnabledChange}
            disabled={saving}
          />
        </div>
      </div>

      {/* Per-Type Overrides */}
      {smsAutoSendEnabled && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Message Type Overrides</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Require manual approval for specific message types (SMS and email) even when auto-send is enabled.
            </p>
          </div>

          <div className="divide-y divide-border">
            {MESSAGE_TYPES.map((type) => {
              const requiresApproval = typeOverrides[type.key] ?? false
              return (
                <div key={type.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{type.label}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          requiresApproval
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {requiresApproval ? "Requires Approval" : "Auto-Send"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{type.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Require Approval</span>
                    <Switch
                      checked={requiresApproval}
                      onCheckedChange={(checked) => onTypeOverrideChange(type.key, checked)}
                      disabled={saving}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-Agent Overrides */}
      {agents && onAgentToggle && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Per-Agent Overrides</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Individual agents can override the agency default for SMS and email automation. When set to &quot;Agency Default&quot;, the agent follows the master toggle above.
            </p>
          </div>
          <AgentSmsAutomationList
            agents={agents}
            loading={agentsLoading ?? false}
            onToggle={onAgentToggle}
            saving={agentSaving ?? null}
            agencyAutoSendEnabled={smsAutoSendEnabled}
          />
        </div>
      )}
    </div>
  )
}
