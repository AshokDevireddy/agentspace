"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search } from "lucide-react"

export interface AgentAutoSendInfo {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  sms_auto_send_enabled: boolean | null
}

interface AgentSmsAutomationListProps {
  agents: AgentAutoSendInfo[]
  loading: boolean
  onToggle: (agentId: string, value: boolean | null) => void
  saving: string | null
  agencyAutoSendEnabled: boolean
}

function getEffectiveLabel(agencyDefault: boolean): string {
  return agencyDefault ? "Auto-Send" : "Drafts Only"
}

export function AgentSmsAutomationList({
  agents,
  loading,
  onToggle,
  saving,
  agencyAutoSendEnabled,
}: AgentSmsAutomationListProps) {
  const [search, setSearch] = useState("")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No agents found in this agency.
      </div>
    )
  }

  const query = search.toLowerCase().trim()
  const filteredAgents = query
    ? agents.filter((agent) => {
        const fullName = [agent.first_name, agent.last_name].filter(Boolean).join(" ").toLowerCase()
        const email = (agent.email ?? "").toLowerCase()
        return fullName.includes(query) || email.includes(query)
      })
    : agents

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {filteredAgents.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No agents match your search.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredAgents.map((agent) => {
        const displayName = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Unnamed Agent"
        const isOverridden = agent.sms_auto_send_enabled !== null
        const effectiveValue = agent.sms_auto_send_enabled ?? agencyAutoSendEnabled
        const isSaving = saving === agent.id

        let selectValue: string
        if (agent.sms_auto_send_enabled === null) {
          selectValue = "default"
        } else if (agent.sms_auto_send_enabled === true) {
          selectValue = "on"
        } else {
          selectValue = "off"
        }

        return (
          <div key={agent.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{displayName}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    effectiveValue
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {effectiveValue ? "Auto-Send" : "Drafts Only"}
                  {isOverridden && " (Override)"}
                </span>
              </div>
              {agent.email && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{agent.email}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <Select
                value={selectValue}
                onValueChange={(val) => {
                  if (val === "default") onToggle(agent.id, null)
                  else if (val === "on") onToggle(agent.id, true)
                  else onToggle(agent.id, false)
                }}
                disabled={isSaving}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    Agency Default ({getEffectiveLabel(agencyAutoSendEnabled)})
                  </SelectItem>
                  <SelectItem value="on">Auto-Send (Override)</SelectItem>
                  <SelectItem value="off">Drafts Only (Override)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )
          })}
        </div>
      )}
    </div>
  )
}
