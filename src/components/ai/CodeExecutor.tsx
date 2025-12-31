'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { AlertCircle } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CodeExecutorProps {
  code: string;
  data?: any;
}

const COLORS = [
  'rgba(139, 92, 246, 0.8)',   // purple-500
  'rgba(59, 130, 246, 0.8)',   // blue-500
  'rgba(16, 185, 129, 0.8)',   // green-500
  'rgba(245, 158, 11, 0.8)',   // amber-500
  'rgba(239, 68, 68, 0.8)',    // red-500
  'rgba(236, 72, 153, 0.8)',   // pink-500
  'rgba(6, 182, 212, 0.8)',    // cyan-500
  'rgba(99, 102, 241, 0.8)',   // indigo-500
];

const BORDER_COLORS = [
  'rgb(139, 92, 246)',   // purple-500
  'rgb(59, 130, 246)',   // blue-500
  'rgb(16, 185, 129)',   // green-500
  'rgb(245, 158, 11)',   // amber-500
  'rgb(239, 68, 68)',    // red-500
  'rgb(236, 72, 153)',   // pink-500
  'rgb(6, 182, 212)',    // cyan-500
  'rgb(99, 102, 241)',   // indigo-500
];

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'doughnut';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }[];
  options?: any;
}

function parseChartCode(code: string, data: any): { config: ChartConfig | null; error?: string } {
  try {
    console.log('🔍 CodeExecutor parseChartCode input:', {
      codeSnippet: code?.substring(0, 200),
      dataType: typeof data,
      isArray: Array.isArray(data),
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      dataSample: Array.isArray(data) ? data[0] : data
    });

    // Try to detect chart type from the code
    let chartType: ChartConfig['type'] = 'bar';

    if (code.includes('LineChart') || code.includes('Line,') || code.toLowerCase().includes("'line'") || code.toLowerCase().includes('"line"')) {
      chartType = 'line';
    } else if (code.includes('PieChart') || code.includes('Pie,') || code.toLowerCase().includes("'pie'") || code.toLowerCase().includes('"pie"')) {
      chartType = 'pie';
    } else if (code.includes('AreaChart') || code.includes('Area,') || code.toLowerCase().includes("'area'") || code.toLowerCase().includes('"area"')) {
      chartType = 'area';
    } else if (code.includes('BarChart') || code.includes('Bar,') || code.toLowerCase().includes("'bar'") || code.toLowerCase().includes('"bar"')) {
      chartType = 'bar';
    }

    console.log('📊 Detected chart type:', chartType);

    // Handle different data formats
    let dataArray: any[] = [];

    if (Array.isArray(data)) {
      dataArray = data;
    } else if (data && typeof data === 'object') {
      const keys = Object.keys(data);

      // Check for known chart data structures from AI tools
      // Priority: monthly_trend > by_carrier > top_payouts
      if (data.monthly_trend && Array.isArray(data.monthly_trend) && data.monthly_trend.length > 0) {
        console.log('📈 Found monthly_trend data');
        dataArray = data.monthly_trend;
      } else if (data.by_carrier && Array.isArray(data.by_carrier) && data.by_carrier.length > 0) {
        console.log('📈 Found by_carrier data');
        // Map carrier data to chart-friendly format
        dataArray = data.by_carrier.map((c: any) => ({
          name: c.carrier_name || c.name,
          value: c.total || c.expected_payout || 0,
          count: c.deal_count || c.count || 0
        }));
      } else if (data.top_payouts && Array.isArray(data.top_payouts) && data.top_payouts.length > 0) {
        console.log('📈 Found top_payouts data');
        dataArray = data.top_payouts;
      } else if (keys.length > 0 && Array.isArray(data[keys[0]])) {
        // Data is like { labels: [...], values: [...] }
        const labelKey = keys.find(k => k.toLowerCase().includes('label') || k.toLowerCase().includes('name') || k.toLowerCase().includes('month')) || keys[0];
        const valueKey = keys.find(k => k !== labelKey) || keys[1];

        if (data[labelKey] && data[valueKey]) {
          dataArray = data[labelKey].map((label: any, i: number) => ({
            name: label,
            value: data[valueKey][i]
          }));
        }
      } else {
        // Try to find any array property in the object
        const arrayKey = keys.find(k => Array.isArray(data[k]) && data[k].length > 0);
        if (arrayKey) {
          console.log('📈 Found array in key:', arrayKey);
          dataArray = data[arrayKey];
        } else {
          // Single object - wrap in array
          dataArray = [data];
        }
      }
    }

    if (!dataArray || dataArray.length === 0) {
      console.warn('CodeExecutor: No valid data array', { original: data, converted: dataArray });
      return { config: null, error: 'No data available to display' };
    }

    // Ensure first item exists and is an object
    if (!dataArray[0] || typeof dataArray[0] !== 'object') {
      console.warn('CodeExecutor: First data item is not an object', dataArray[0]);
      return { config: null, error: 'Invalid data format - expected array of objects' };
    }

    // Get keys from data
    const keys = Object.keys(dataArray[0]);
    console.log('📋 Data keys:', keys);

    if (keys.length === 0) {
      return { config: null, error: 'Data objects have no properties' };
    }

    // Find label key (usually first string-valued key or contains 'name', 'month', 'date', etc.)
    // Exclude known value keys like 'total', 'value', 'count', 'amount'
    const valueKeywords = ['total', 'value', 'count', 'amount', 'payout', 'premium', 'sum'];
    const labelKey = keys.find(k => {
      const lowerK = k.toLowerCase();
      // Skip if it's a value keyword
      if (valueKeywords.some(vk => lowerK.includes(vk))) return false;
      return lowerK.includes('name') ||
        lowerK.includes('month') ||
        lowerK.includes('date') ||
        lowerK.includes('label') ||
        lowerK.includes('category') ||
        lowerK.includes('period') ||
        lowerK.includes('carrier');
    }) || keys.find(k => {
      const val = dataArray[0][k];
      return typeof val === 'string' && !valueKeywords.some(vk => k.toLowerCase().includes(vk));
    }) || keys[0];

    console.log('🏷️ Label key:', labelKey);

    // Find value keys (numeric values)
    let valueKeys = keys.filter(k => {
      if (k === labelKey) return false;
      const val = dataArray[0][k];
      // Prioritize keys that are known value keywords
      const isValueKeyword = valueKeywords.some(vk => k.toLowerCase().includes(vk));
      const isNumeric = typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)));
      return isValueKeyword || isNumeric;
    });

    // If no value keys found, use all non-label keys
    if (valueKeys.length === 0) {
      valueKeys = keys.filter(k => k !== labelKey);
    }

    // If still no value keys, use the label key as value (for simple data)
    if (valueKeys.length === 0 && keys.length >= 1) {
      valueKeys = [keys[keys.length - 1]];
    }

    // Sort value keys to prioritize 'total' or 'value'
    valueKeys.sort((a, b) => {
      const aIsPrimary = a.toLowerCase() === 'total' || a.toLowerCase() === 'value';
      const bIsPrimary = b.toLowerCase() === 'total' || b.toLowerCase() === 'value';
      if (aIsPrimary && !bIsPrimary) return -1;
      if (!aIsPrimary && bIsPrimary) return 1;
      return 0;
    });

    console.log('📊 Value keys:', valueKeys);

    if (valueKeys.length === 0) {
      return { config: null, error: 'Could not find numeric values in data' };
    }

    // Extract labels - handle nested objects and format dates
    const labels = dataArray.map(item => {
      const val = item[labelKey];
      if (val === undefined || val === null) return '';

      // Handle nested objects
      if (typeof val === 'object') {
        // Try to extract a meaningful string from the object
        if (val.name) return String(val.name);
        if (val.label) return String(val.label);
        if (val.month && val.year) return `${val.year}-${String(val.month).padStart(2, '0')}`;
        // Fall back to first string value in object
        const firstStringVal = Object.values(val).find(v => typeof v === 'string');
        if (firstStringVal) return String(firstStringVal);
        // Last resort - try JSON but limit length
        return JSON.stringify(val).substring(0, 20);
      }

      // Format month strings like "2025-01" to "Jan 2025"
      if (typeof val === 'string' && /^\d{4}-\d{2}$/.test(val)) {
        const [year, month] = val.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      }

      return String(val);
    });

    // Create datasets
    const datasets = valueKeys.map((key, index) => {
      const values = dataArray.map(item => {
        const val = item[key];
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val) || 0;
        return 0;
      });

      const baseConfig = {
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        data: values,
        borderWidth: 2,
      };

      if (chartType === 'pie' || chartType === 'doughnut') {
        return {
          ...baseConfig,
          backgroundColor: values.map((_, i) => COLORS[i % COLORS.length]),
          borderColor: values.map((_, i) => BORDER_COLORS[i % BORDER_COLORS.length]),
        };
      }

      if (chartType === 'area') {
        return {
          ...baseConfig,
          backgroundColor: COLORS[index % COLORS.length].replace('0.8', '0.3'),
          borderColor: BORDER_COLORS[index % BORDER_COLORS.length],
          fill: true,
          tension: 0.4,
        };
      }

      if (chartType === 'line') {
        return {
          ...baseConfig,
          backgroundColor: COLORS[index % COLORS.length],
          borderColor: BORDER_COLORS[index % BORDER_COLORS.length],
          tension: 0.4,
        };
      }

      return {
        ...baseConfig,
        backgroundColor: COLORS[index % COLORS.length],
        borderColor: BORDER_COLORS[index % BORDER_COLORS.length],
      };
    });

    console.log('✅ Chart config created:', {
      type: chartType,
      labelsCount: labels.length,
      datasetsCount: datasets.length,
      sampleLabels: labels.slice(0, 3),
      sampleData: datasets[0]?.data.slice(0, 3)
    });

    return {
      config: {
        type: chartType,
        labels,
        datasets,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top' as const,
              labels: {
                color: 'rgb(148, 163, 184)',
                font: { size: 12 },
              },
            },
            tooltip: {
              backgroundColor: 'rgb(30, 41, 59)',
              titleColor: 'rgb(248, 250, 252)',
              bodyColor: 'rgb(226, 232, 240)',
              borderColor: 'rgb(71, 85, 105)',
              borderWidth: 1,
              cornerRadius: 8,
              callbacks: {
                label: function(context: any) {
                  let label = context.dataset.label || '';
                  if (label) label += ': ';
                  const value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                  if (typeof value === 'number') {
                    label += new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                    }).format(value);
                  }
                  return label;
                }
              }
            },
          },
          scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
            x: {
              grid: { color: 'rgba(71, 85, 105, 0.3)' },
              ticks: {
                color: 'rgb(148, 163, 184)',
                maxRotation: 45,
                minRotation: 45,
              },
            },
            y: {
              grid: { color: 'rgba(71, 85, 105, 0.3)' },
              ticks: {
                color: 'rgb(148, 163, 184)',
                callback: function(value: any) {
                  return '$' + value.toLocaleString();
                }
              },
            },
          } : undefined,
        },
      }
    };
  } catch (err: any) {
    console.error('Error parsing chart code:', err);
    return { config: null, error: err.message || 'Failed to parse chart configuration' };
  }
}

export default function CodeExecutor({ code, data }: CodeExecutorProps) {
  const [error, setError] = useState<string | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    console.log('🎨 CodeExecutor mounted with:', {
      hasCode: !!code,
      hasData: !!data,
      dataType: typeof data
    });

    if (!code) {
      setError('No chart code provided');
      return;
    }

    const { config, error: parseError } = parseChartCode(code, data);

    if (parseError) {
      setError(parseError);
      return;
    }

    if (!config) {
      setError('Unable to parse chart configuration');
      return;
    }

    setError(null);
    setChartConfig(config);
  }, [code, data]);

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900 dark:text-red-200 mb-1">Failed to render chart</h4>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Data received: {data ? (Array.isArray(data) ? `Array with ${data.length} items` : typeof data) : 'none'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!chartConfig) {
    return (
      <div className="p-6 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
        <p className="text-slate-600 dark:text-slate-400">Loading chart...</p>
      </div>
    );
  }

  const chartData = {
    labels: chartConfig.labels,
    datasets: chartConfig.datasets,
  };

  const renderChart = () => {
    switch (chartConfig.type) {
      case 'line':
        return <Line ref={chartRef} data={chartData} options={chartConfig.options} />;
      case 'pie':
        return <Pie ref={chartRef} data={chartData} options={chartConfig.options} />;
      case 'doughnut':
        return <Doughnut ref={chartRef} data={chartData} options={chartConfig.options} />;
      case 'area':
        return <Line ref={chartRef} data={chartData} options={chartConfig.options} />;
      case 'bar':
      default:
        return <Bar ref={chartRef} data={chartData} options={chartConfig.options} />;
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
      <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4" style={{ height: '400px' }}>
        {renderChart()}
      </div>
    </div>
  );
}
