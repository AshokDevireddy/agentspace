'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2 } from 'lucide-react';

interface ThinkingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
  caption?: string;
  details?: string[];
}

interface ThinkingProgressProps {
  steps: ThinkingStep[];
}

export default function ThinkingProgress({ steps }: ThinkingProgressProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedIds(prev => {
      const next = new Set<string>();
      const validIds = new Set(steps.map(step => step.id));
      prev.forEach(id => {
        if (validIds.has(id) && (steps.find(step => step.id === id)?.details?.length ?? 0) > 0) {
          next.add(id);
        }
      });
      return next;
    });
  }, [steps]);

  useEffect(() => {
    const activeStep = steps.find(step => step.status === 'in_progress' && (step.details?.length ?? 0) > 0);
    if (activeStep) {
      setExpandedIds(prev => {
        if (prev.has(activeStep.id)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(activeStep.id);
        return next;
      });
    }
  }, [steps]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderIcon = (status: ThinkingStep['status']) => {
    if (status === 'completed') {
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-green-200 bg-green-100 text-green-600 shadow-inner">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      );
    }

    if (status === 'in_progress') {
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-200">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      );
    }

    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300">
        <Circle className="h-3 w-3" />
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const hasDetails = (step.details?.length ?? 0) > 0;
        const isExpanded = hasDetails && expandedIds.has(step.id);

        return (
          <div key={step.id} className="relative pl-12">
            {index !== steps.length - 1 && (
              <span
                className="absolute left-5 top-9 bottom-[-16px] w-px bg-slate-200"
                aria-hidden="true"
              />
            )}

            <span className="absolute left-0 top-5">{renderIcon(step.status)}</span>

            <div className={`rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm transition-colors ${step.status === 'in_progress' ? 'border-purple-200 shadow-purple-100/60' : ''}`}>
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${step.status === 'in_progress' ? 'text-slate-900' : 'text-slate-700'}`}>
                    {step.label}
                  </p>
                  {step.caption && (
                    <p className="text-xs text-slate-500 mt-1">{step.caption}</p>
                  )}
                </div>
                {hasDetails && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(step.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors"
                    aria-expanded={isExpanded}
                    aria-controls={`thinking-step-${step.id}`}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {hasDetails && isExpanded && (
                <div
                  id={`thinking-step-${step.id}`}
                  className="border-t border-slate-200 px-4 py-3 space-y-2 text-xs leading-relaxed text-slate-600 bg-slate-50/60"
                >
                  {step.details?.map((detail, detailIndex) => (
                    <p key={`${step.id}-detail-${detailIndex}`}>{detail}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

