"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { DEFAULT_DISCORD_TEMPLATE, DISCORD_TEMPLATE_PLACEHOLDERS } from "@/lib/discord-template-helpers"
import { useUpdateAgencySmsEnabled, useUpdateAgencySmsTemplate } from "@/hooks/mutations"

interface DiscordTemplateEditorProps {
  enabled: boolean
  template: string
  botUsername: string
  agencyId?: string
  onEnabledChange: (enabled: boolean) => void
  onTemplateChange: (template: string) => void
  onBotUsernameChange: (username: string) => void
  showSuccess: (message: string, duration?: number) => void
  showError: (message: string, duration?: number) => void
}

export function DiscordTemplateEditor({
  enabled,
  template,
  botUsername,
  agencyId,
  onEnabledChange,
  onTemplateChange,
  onBotUsernameChange,
  showSuccess,
  showError,
}: DiscordTemplateEditorProps) {
  const [localTemplate, setLocalTemplate] = useState(template || DEFAULT_DISCORD_TEMPLATE)
  const [localBotUsername, setLocalBotUsername] = useState(botUsername || 'AgentSpace Deal Bot')
  const [hasChanges, setHasChanges] = useState(false)
  const [viewMode, setViewMode] = useState<'source' | 'preview'>('source')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mutation hooks for Discord template operations
  const toggleMutation = useUpdateAgencySmsEnabled({
    onSuccess: () => {
      showSuccess(`Using ${enabled ? 'custom' : 'default'} Discord template`)
    },
    onError: () => {
      // Revert optimistic update on error
      onEnabledChange(!enabled)
      showError('Failed to update setting')
    },
  })

  const saveMutation = useUpdateAgencySmsTemplate({
    onSuccess: () => {
      onTemplateChange(localTemplate)
      setHasChanges(false)
      showSuccess('Discord template saved successfully')
    },
    onError: () => {
      showError('Failed to save Discord template')
    },
  })

  const saveBotUsernameMutation = useUpdateAgencySmsTemplate({
    onSuccess: () => {
      onBotUsernameChange(localBotUsername)
      showSuccess('Discord bot username saved successfully')
    },
    onError: () => {
      showError('Failed to save Discord bot username')
    },
  })

  // Sync template and botUsername props to local state when they change
  useEffect(() => {
    const newValue = template || DEFAULT_DISCORD_TEMPLATE
    setLocalTemplate(newValue)
    setHasChanges(false)
  }, [template])

  useEffect(() => {
    const newValue = botUsername || 'AgentSpace Deal Bot'
    setLocalBotUsername(newValue)
  }, [botUsername])

  // Sample placeholder values for preview
  const samplePlaceholders: Record<string, string> = {
    agent_name: 'John Doe',
    carrier_name: 'Aetna',
    product_name: 'Term Life Insurance',
    monthly_premium: '150.00',
    annual_premium: '1800.00',
    client_name: 'Jane Smith',
    policy_number: 'POL-12345',
    effective_date: '2026-02-01',
  }

  // Convert Discord markdown to HTML for preview
  const getPreviewHtml = () => {
    let html = localTemplate

    // Replace placeholders with sample values
    DISCORD_TEMPLATE_PLACEHOLDERS.forEach((placeholder) => {
      const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g')
      html = html.replace(regex, samplePlaceholders[placeholder] || '')
    })

    // Convert Discord markdown to HTML
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/_(.+?)_/g, '<em>$1</em>')
    html = html.replace(/__(.+?)__/g, '<u>$1</u>')
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>')
    html = html.replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1 rounded">$1</code>')
    html = html.replace(/\n/g, '<br />')

    return html
  }

  const handleToggle = () => {
    if (!agencyId) return
    const newValue = !enabled
    onEnabledChange(newValue) // Optimistic update
    toggleMutation.mutate({
      agencyId,
      dbField: 'discord_notification_enabled',
      enabled: newValue,
    })
  }

  const handleSave = () => {
    if (!agencyId) return
    saveMutation.mutate({
      agencyId,
      dbField: 'discord_notification_template',
      template: localTemplate,
    })
  }

  const handleBotUsernameChange = (value: string) => {
    setLocalBotUsername(value)
  }

  const handleBotUsernameSave = () => {
    if (!agencyId) return
    saveBotUsernameMutation.mutate({
      agencyId,
      dbField: 'discord_bot_username',
      template: localBotUsername,
    })
  }

  const handleChange = (value: string) => {
    setLocalTemplate(value)
    setHasChanges(value !== (template || DEFAULT_DISCORD_TEMPLATE))
  }

  const handleReset = () => {
    setLocalTemplate(DEFAULT_DISCORD_TEMPLATE)
    setHasChanges(DEFAULT_DISCORD_TEMPLATE !== (template || DEFAULT_DISCORD_TEMPLATE))
  }

  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      // Fallback if no ref
      handleChange(localTemplate + `{{${placeholder}}}`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = localTemplate
    const placeholderText = `{{${placeholder}}}`

    const newValue = text.substring(0, start) + placeholderText + text.substring(end)
    handleChange(newValue)

    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + placeholderText.length
    }, 0)
  }

  return (
    <Card className="bg-accent/30 border border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">Notification Template</CardTitle>
            <CardDescription>
              Customize the message format sent to Discord when deals are posted
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {enabled ? "Custom" : "Default"}
            </span>
            <button
              onClick={handleToggle}
              disabled={toggleMutation.isPending}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                enabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600",
                toggleMutation.isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  enabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bot Username Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bot Username</label>
          <p className="text-xs text-muted-foreground">
            The username that will appear for the Discord webhook bot
          </p>
          <div className="flex gap-2">
            <Input
              value={localBotUsername}
              onChange={(e) => handleBotUsernameChange(e.target.value)}
              placeholder="AgentSpace Deal Bot"
              className="flex-1"
            />
            <Button
              onClick={handleBotUsernameSave}
              disabled={saveBotUsernameMutation.isPending || localBotUsername === botUsername}
              variant="outline"
            >
              {saveBotUsernameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        {/* Template Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Template</label>
            {/* Source/Preview Toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode('source')}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors",
                  viewMode === 'source'
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
                disabled={!enabled}
              >
                Source
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors border-l border-border",
                  viewMode === 'preview'
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
                disabled={!enabled}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Source Editor */}
          {viewMode === 'source' && (
            <Textarea
              ref={textareaRef}
              value={localTemplate}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Enter your Discord notification template..."
              className="min-h-[200px] font-mono text-sm bg-zinc-900 dark:bg-zinc-950 text-zinc-100 border-border"
              disabled={!enabled}
            />
          )}

          {/* Preview Panel */}
          {viewMode === 'preview' && (
            <div className="min-h-[200px] p-4 border border-border rounded-lg bg-white dark:bg-zinc-900 overflow-auto">
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            </div>
          )}
        </div>

        {/* Available Placeholders */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Available Variables</label>
          <p className="text-xs text-muted-foreground">
            Click to insert a variable into your template
          </p>
          <div className="flex flex-wrap gap-2">
            {DISCORD_TEMPLATE_PLACEHOLDERS.map((placeholder) => (
              <Button
                key={placeholder}
                variant="outline"
                size="sm"
                onClick={() => insertPlaceholder(placeholder)}
                disabled={!enabled || viewMode === 'preview'}
                className={cn(
                  "font-mono text-xs",
                  viewMode === 'preview' && "cursor-not-allowed opacity-50"
                )}
              >
                {`{{${placeholder}}}`}
              </Button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges || !enabled}
            className="flex-1"
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={saveMutation.isPending || !enabled}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </div>

        {!enabled && (
          <p className="text-xs text-muted-foreground italic">
            Enable custom template to edit. Currently using default template.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
