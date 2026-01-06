"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, MessageCircle, RotateCcw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface SmsTemplateEditorProps {
  title: string
  description: string
  placeholders: string[]
  enabled: boolean
  template: string
  defaultTemplate: string
  dbFieldEnabled: string
  dbFieldTemplate: string
  agencyId: string | undefined
  onEnabledChange: (enabled: boolean) => void
  onTemplateChange: (template: string) => void
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

export function SmsTemplateEditor({
  title,
  description,
  placeholders,
  enabled,
  template,
  defaultTemplate,
  dbFieldEnabled,
  dbFieldTemplate,
  agencyId,
  onEnabledChange,
  onTemplateChange,
  showSuccess,
  showError,
}: SmsTemplateEditorProps) {
  const [editValue, setEditValue] = useState(template || defaultTemplate)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const newValue = template || defaultTemplate
    setEditValue(newValue)
    setHasChanges(false)
  }, [template, defaultTemplate])

  const handleToggle = async () => {
    const newValue = !enabled
    onEnabledChange(newValue)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('agencies')
        .update({ [dbFieldEnabled]: newValue })
        .eq('id', agencyId)
      if (error) throw error
      showSuccess(`${title} ${newValue ? 'enabled' : 'disabled'}`)
    } catch {
      onEnabledChange(!newValue)
      showError('Failed to update setting')
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const supabase = createClient()
      const { error } = await supabase
        .from('agencies')
        .update({ [dbFieldTemplate]: editValue })
        .eq('id', agencyId)
      if (error) throw error
      onTemplateChange(editValue)
      setHasChanges(false)
      showSuccess(`${title} template saved`)
    } catch {
      showError('Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (value: string) => {
    setEditValue(value)
    setHasChanges(value !== (template || defaultTemplate))
  }

  const handleReset = () => {
    setEditValue(defaultTemplate)
    setHasChanges(defaultTemplate !== (template || defaultTemplate))
  }

  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = editValue
    const placeholderText = `{{${placeholder}}}`

    const newValue = text.substring(0, start) + placeholderText + text.substring(end)
    handleChange(newValue)

    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + placeholderText.length
    }, 0)
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            onClick={handleToggle}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              enabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
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

      <div className="bg-accent/50">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full min-h-[120px] bg-transparent text-foreground text-sm font-mono p-4 resize-none focus:outline-none"
          spellCheck={false}
        />

        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-border">
          {placeholders.map((placeholder) => (
            <button
              key={placeholder}
              onClick={() => insertPlaceholder(placeholder)}
              className="px-3 py-1.5 text-xs font-mono bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded border border-border transition-colors"
            >
              {`{{ ${placeholder} }}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 border-t border-border bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset to default
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  )
}
