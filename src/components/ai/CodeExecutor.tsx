'use client';

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
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

interface ChartDataWithMetadata {
  data: any[];
  x_axis_key?: string;
  y_axis_keys?: string[];
}

interface CodeExecutorProps {
  code: string;
  data?: ChartDataWithMetadata | any[] | any;  // Support both new format with metadata and old array format
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

function parseChartCode(code: string, data: any, explicitLabelKey?: string, explicitValueKeys?: string[]): { config: ChartConfig | null; error?: string } {
  try {
    // Check if data has metadata format (new format with x_axis_key and y_axis_keys)
    let actualData = data;
    let labelKeyFromMetadata = explicitLabelKey;
    let valueKeysFromMetadata = explicitValueKeys;

    // Debug: Log raw input for diagnosis
    console.log('📥 Raw data input:', {
      dataType: typeof data,
      isArray: Array.isArray(data),
      hasDataProp: data && typeof data === 'object' ? 'data' in data : false,
      hasXAxisKey: data && typeof data === 'object' ? 'x_axis_key' in data : false,
      hasYAxisKeys: data && typeof data === 'object' ? 'y_axis_keys' in data : false,
      dataKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : 'N/A'
    });

    // Detect metadata format: look for x_axis_key or y_axis_keys properties (unique to our metadata)
    // This is more reliable than just checking for data.data
    const isMetadataFormat = data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      ('x_axis_key' in data || 'y_axis_keys' in data);

    if (isMetadataFormat) {
      // New metadata format: { data: [...], x_axis_key: '...', y_axis_keys: [...] }
      // Extract the actual data array from the metadata wrapper
      if (data.data && Array.isArray(data.data)) {
        actualData = data.data;
        labelKeyFromMetadata = labelKeyFromMetadata || data.x_axis_key;
        valueKeysFromMetadata = valueKeysFromMetadata || data.y_axis_keys;
        console.log('📦 Using metadata format:', {
          labelKeyFromMetadata,
          valueKeysFromMetadata,
          actualDataIsArray: true,
          actualDataLength: actualData.length,
          sampleItem: actualData[0]
        });
      } else {
        // Metadata format detected but data.data is not a valid array
        // This is likely a bug - log warning and try to recover
        console.warn('⚠️ Metadata format detected but data.data is invalid:', {
          dataDataType: typeof data.data,
          dataDataIsArray: Array.isArray(data.data),
          dataData: data.data
        });
        // Still extract the axis keys even if data is bad
        labelKeyFromMetadata = labelKeyFromMetadata || data.x_axis_key;
        valueKeysFromMetadata = valueKeysFromMetadata || data.y_axis_keys;
        // Don't change actualData - let the downstream code try to handle it
      }
    }

    console.log('🔍 CodeExecutor parseChartCode processed:', {
      codeSnippet: code?.substring(0, 200),
      dataType: typeof actualData,
      isArray: Array.isArray(actualData),
      dataLength: Array.isArray(actualData) ? actualData.length : 'N/A',
      dataSample: Array.isArray(actualData) ? actualData[0] : actualData,
      explicitLabelKey: labelKeyFromMetadata,
      explicitValueKeys: valueKeysFromMetadata
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

    if (Array.isArray(actualData)) {
      dataArray = actualData;
    } else if (actualData && typeof actualData === 'object') {
      const keys = Object.keys(actualData);

      // Check for known chart data structures from AI tools
      // Priority: by_agent (most common for downline queries) > monthly_trend > by_carrier > top_payouts
      // IMPORTANT: Don't transform data to generic 'value' field - keep original field names for proper detection
      if (actualData.by_agent && Array.isArray(actualData.by_agent) && actualData.by_agent.length > 0) {
        console.log('📈 Found by_agent data');
        // Use by_agent array as-is - keep original field names (agent_name, total_expected, etc.)
        dataArray = actualData.by_agent;
      } else if (actualData.monthly_trend && Array.isArray(actualData.monthly_trend) && actualData.monthly_trend.length > 0) {
        console.log('📈 Found monthly_trend data');
        dataArray = actualData.monthly_trend;
      } else if (actualData.by_carrier && Array.isArray(actualData.by_carrier) && actualData.by_carrier.length > 0) {
        console.log('📈 Found by_carrier data');
        // Use by_carrier as-is - keep original field names (carrier_name, total, deal_count)
        dataArray = actualData.by_carrier;
      } else if (actualData.top_payouts && Array.isArray(actualData.top_payouts) && actualData.top_payouts.length > 0) {
        console.log('📈 Found top_payouts data');
        dataArray = actualData.top_payouts;
      } else if (keys.length > 0 && Array.isArray(actualData[keys[0]])) {
        // Data is like { labels: [...], values: [...] }
        const labelKey = keys.find(k => k.toLowerCase().includes('label') || k.toLowerCase().includes('name') || k.toLowerCase().includes('month')) || keys[0];
        const valueKey = keys.find(k => k !== labelKey) || keys[1];

        if (actualData[labelKey] && actualData[valueKey]) {
          // Keep the original structure - let detection find the right keys
          dataArray = actualData[labelKey].map((label: any, i: number) => ({
            label: label,
            amount: actualData[valueKey][i]
          }));
        }
      } else {
        // Try to find any array property in the object
        const arrayKey = keys.find(k => Array.isArray(actualData[k]) && actualData[k].length > 0);
        if (arrayKey) {
          console.log('📈 Found array in key:', arrayKey);
          dataArray = actualData[arrayKey];
        } else {
          // SAFEGUARD: Don't wrap metadata-like objects as single data items
          // This would result in showing 'data', 'x_axis_key', 'y_axis_keys' as chart labels
          const looksLikeMetadata = keys.some(k =>
            k === 'x_axis_key' || k === 'y_axis_keys' || k === '_axis_metadata'
          );
          if (looksLikeMetadata) {
            console.error('❌ Cannot process metadata object as chart data - data.data is missing or invalid');
            return {
              config: null,
              error: 'Chart data is in metadata format but the actual data array is missing. This may be a data loading issue.'
            };
          }
          // Single object - wrap in array
          dataArray = [actualData];
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

    // Find label key - USE EXPLICIT KEY FROM METADATA IF PROVIDED
    // Otherwise, detect (usually first string-valued key or contains 'name', 'month', 'date', etc.)
    // Exclude known value keys like 'total', 'value', 'count', 'amount'
    const valueKeywords = ['total', 'value', 'count', 'amount', 'payout', 'premium', 'sum'];

    let labelKey: string;
    if (labelKeyFromMetadata && keys.includes(labelKeyFromMetadata)) {
      // Use explicit label key from metadata (persisted from original visualization)
      labelKey = labelKeyFromMetadata;
      console.log('🏷️ Using explicit label key from metadata:', labelKey);
    } else {
      // Fall back to detection logic
      // Prioritize specific field names commonly used in our data
      labelKey = keys.find(k => k === 'agent_name' || k === 'carrier_name') ||
        keys.find(k => {
          const lowerK = k.toLowerCase();
          // Skip if it's a value keyword
          if (valueKeywords.some(vk => lowerK.includes(vk))) return false;
          return lowerK.includes('name') ||
            lowerK.includes('month') ||
            lowerK.includes('date') ||
            lowerK.includes('label') ||
            lowerK.includes('category') ||
            lowerK.includes('period') ||
            lowerK.includes('carrier') ||
            lowerK.includes('agent');
        }) || keys.find(k => {
          const val = dataArray[0][k];
          return typeof val === 'string' && !valueKeywords.some(vk => k.toLowerCase().includes(vk));
        }) || keys[0];
      console.log('🏷️ Detected label key:', labelKey);
    }

    // Find value keys - USE EXPLICIT KEYS FROM METADATA IF PROVIDED
    let valueKeys: string[];
    if (valueKeysFromMetadata && valueKeysFromMetadata.length > 0 && valueKeysFromMetadata.every(k => keys.includes(k))) {
      // Use explicit value keys from metadata (persisted from original visualization)
      valueKeys = valueKeysFromMetadata;
      console.log('📊 Using explicit value keys from metadata:', valueKeys);
    } else {
      // If explicit keys were provided but don't exist, log warning
      if (valueKeysFromMetadata && valueKeysFromMetadata.length > 0) {
        console.warn('⚠️ Explicit value keys not found in data, falling back to detection:', {
          requested: valueKeysFromMetadata,
          available: keys
        });
      }

      // Fall back to detection logic
      // First, check for specific known field names
      const priorityValueKeys = ['total_expected', 'total', 'expected_payout', 'amount', 'premium'];
      const foundPriorityKey = priorityValueKeys.find(pk => keys.includes(pk) && pk !== labelKey);

      if (foundPriorityKey) {
        valueKeys = [foundPriorityKey];
        console.log('📊 Using priority value key:', foundPriorityKey);
      } else {
        // General detection
        valueKeys = keys.filter(k => {
          if (k === labelKey) return false;
          const val = dataArray[0][k];
          // Skip arrays and complex objects
          if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return false;
          // Prioritize keys that are known value keywords
          const isValueKeyword = valueKeywords.some(vk => k.toLowerCase().includes(vk));
          const isNumeric = typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)));
          return isValueKeyword || isNumeric;
        });

        // If no value keys found, use all non-label, non-complex keys
        if (valueKeys.length === 0) {
          valueKeys = keys.filter(k => {
            if (k === labelKey) return false;
            const val = dataArray[0][k];
            return !Array.isArray(val) && !(typeof val === 'object' && val !== null);
          });
        }

        // If still no value keys, use the first numeric key
        if (valueKeys.length === 0 && keys.length >= 1) {
          valueKeys = [keys.find(k => typeof dataArray[0][k] === 'number') || keys[keys.length - 1]];
        }

        // Sort value keys to prioritize 'total_expected', 'total', etc.
        valueKeys.sort((a, b) => {
          const priorityOrder = ['total_expected', 'total', 'expected_payout', 'amount', 'value'];
          const aIndex = priorityOrder.findIndex(p => a.toLowerCase().includes(p));
          const bIndex = priorityOrder.findIndex(p => b.toLowerCase().includes(p));
          if (aIndex !== -1 && bIndex === -1) return -1;
          if (aIndex === -1 && bIndex !== -1) return 1;
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          return 0;
        });
        console.log('📊 Detected value keys:', valueKeys);
      }
    }

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Track container dimensions to ensure proper chart rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
        console.log('📏 Container dimensions:', { width, height });
      }
    }
  }, [chartConfig]);

  // Re-check dimensions after a brief delay (handles race conditions with CSS layout)
  useEffect(() => {
    if (chartConfig && dimensions.width === 0) {
      const timer = setTimeout(() => {
        if (containerRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          if (width > 0 && height > 0) {
            setDimensions({ width, height });
            console.log('📏 Container dimensions (delayed):', { width, height });
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chartConfig, dimensions.width]);

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

  // Only render chart when container has valid dimensions
  const shouldRenderChart = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div className="p-6 bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
      <div
        ref={containerRef}
        className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4"
        style={{ height: '400px', minHeight: '400px', position: 'relative' }}
      >
        {shouldRenderChart ? (
          renderChart()
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <span className="animate-pulse">Initializing chart...</span>
          </div>
        )}
      </div>
    </div>
  );
}
