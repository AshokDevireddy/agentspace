"use client"

export default function InsuranceToolkits() {
  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col toolkits-content" data-tour="toolkits">
      {/* Iframe Container */}
      <div className="flex-1 w-full professional-card overflow-hidden">
        <iframe
          src="https://insurancetoolkits.com/login"
          className="w-full h-full border-0"
          title="Insurance Toolkits"
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  )
}

