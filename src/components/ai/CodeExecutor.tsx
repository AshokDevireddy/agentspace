'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { AlertCircle } from 'lucide-react';

interface CodeExecutorProps {
  code: string;
  data?: any;
}

const COLORS = [
  '#8b5cf6', // purple-500
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
];

export default function CodeExecutor({ code, data }: CodeExecutorProps) {
  const [error, setError] = useState<string | null>(null);
  const [chartElement, setChartElement] = useState<React.ReactNode>(null);

  useEffect(() => {
    try {
      setError(null);

      // Create a safe execution environment with available tools
      const safeContext = {
        React,
        ResponsiveContainer,
        BarChart,
        Bar,
        LineChart,
        Line,
        PieChart,
        Pie,
        AreaChart,
        Area,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
        Legend,
        Cell,
        COLORS,
        data,
        console: {
          log: (...args: any[]) => console.log('[Chart Code]:', ...args),
          error: (...args: any[]) => console.error('[Chart Code]:', ...args),
          warn: (...args: any[]) => console.warn('[Chart Code]:', ...args),
        }
      };

      // Extract the chart component code
      // The code should be a function that returns a chart element
      const funcBody = `
        const {
          React,
          ResponsiveContainer,
          BarChart,
          Bar,
          LineChart,
          Line,
          PieChart,
          Pie,
          AreaChart,
          Area,
          XAxis,
          YAxis,
          CartesianGrid,
          Tooltip,
          Legend,
          Cell,
          COLORS,
          data
        } = context;

        ${code}

        return renderChart();
      `;

      const func = new Function('context', funcBody);
      const result = func(safeContext);

      setChartElement(result);
    } catch (err: any) {
      console.error('Error executing chart code:', err);
      setError(err.message || 'Failed to render chart');
    }
  }, [code, data]);

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900 mb-1">Failed to render chart</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-white via-slate-50/50 to-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50">
      <div className="bg-white/50 rounded-xl p-4">
        {chartElement}
      </div>
    </div>
  );
}

