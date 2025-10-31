'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

interface ThinkingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ThinkingProgressProps {
  steps: ThinkingStep[];
}

export default function ThinkingProgress({ steps }: ThinkingProgressProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`flex items-center gap-3 py-2 transition-all duration-300 ${
            step.status === 'completed'
              ? 'opacity-70'
              : step.status === 'in_progress'
              ? 'opacity-100'
              : 'opacity-40'
          }`}
        >
          {step.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          ) : step.status === 'in_progress' ? (
            <Loader2 className="h-5 w-5 animate-spin text-purple-600 flex-shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
          )}
          <span className={`text-sm font-medium ${
            step.status === 'in_progress'
              ? 'text-slate-900'
              : 'text-slate-600'
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

