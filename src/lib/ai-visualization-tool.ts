/**
 * AI Visualization Tool
 * Generates chart configuration for Chart.js visualizations
 */

// Chart type definitions
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'stacked_bar';

export interface VisualizationInput {
  chart_type: ChartType;
  title: string;
  description?: string;
  data: Record<string, any>[];
  x_axis_key: string;
  y_axis_keys: string[];
  config?: {
    colors?: string[];
    show_legend?: boolean;
    show_grid?: boolean;
    y_axis_label?: string;
    x_axis_label?: string;
  };
}

export interface VisualizationResult {
  _visualization: true;
  chart_type: ChartType;
  title: string;
  description?: string;
  chartcode: string;
  data: Record<string, any>[];
}

// Default color palette for Chart.js (with alpha for backgrounds)
const DEFAULT_COLORS = [
  'rgba(139, 92, 246, 0.8)',   // purple-500
  'rgba(59, 130, 246, 0.8)',   // blue-500
  'rgba(16, 185, 129, 0.8)',   // green-500
  'rgba(245, 158, 11, 0.8)',   // amber-500
  'rgba(239, 68, 68, 0.8)',    // red-500
  'rgba(236, 72, 153, 0.8)',   // pink-500
  'rgba(6, 182, 212, 0.8)',    // cyan-500
  'rgba(99, 102, 241, 0.8)',   // indigo-500
];

const DEFAULT_BORDER_COLORS = [
  'rgb(139, 92, 246)',   // purple-500
  'rgb(59, 130, 246)',   // blue-500
  'rgb(16, 185, 129)',   // green-500
  'rgb(245, 158, 11)',   // amber-500
  'rgb(239, 68, 68)',    // red-500
  'rgb(236, 72, 153)',   // pink-500
  'rgb(6, 182, 212)',    // cyan-500
  'rgb(99, 102, 241)',   // indigo-500
];

/**
 * Validates visualization input data
 */
export function validateVisualizationInput(input: VisualizationInput): { valid: boolean; error?: string } {
  if (!input.data || !Array.isArray(input.data)) {
    return { valid: false, error: 'Data must be an array of objects' };
  }

  if (input.data.length === 0) {
    return { valid: false, error: 'Data array is empty' };
  }

  if (!input.x_axis_key) {
    return { valid: false, error: 'x_axis_key is required' };
  }

  if (!input.y_axis_keys || !Array.isArray(input.y_axis_keys) || input.y_axis_keys.length === 0) {
    return { valid: false, error: 'y_axis_keys must be a non-empty array' };
  }

  // Check if x_axis_key exists in data
  const firstItem = input.data[0];
  if (!(input.x_axis_key in firstItem)) {
    return { valid: false, error: `x_axis_key "${input.x_axis_key}" not found in data` };
  }

  // Check if at least one y_axis_key exists in data
  const foundYKey = input.y_axis_keys.some(key => key in firstItem);
  if (!foundYKey) {
    return { valid: false, error: `None of the y_axis_keys found in data` };
  }

  // Detect placeholder/hallucinated data patterns
  // Common field names that shouldn't appear as actual data values
  const commonFieldNames = ['month', 'payout', 'value', 'total', 'name', 'label', 'amount', 'count', 'date', 'carrier', 'agent', 'premium', 'production'];

  // Check if x_axis values look like field names instead of actual data
  const xValues = input.data.map(item => String(item[input.x_axis_key]).toLowerCase());
  const suspiciousXValues = xValues.filter(v => commonFieldNames.includes(v));

  // If most x-axis values are common field names, this is likely placeholder data
  if (suspiciousXValues.length > 0 && suspiciousXValues.length >= xValues.length * 0.5) {
    return {
      valid: false,
      error: `Data appears to contain placeholder field names instead of actual values. The x_axis values (${xValues.join(', ')}) look like field names. Please pass the actual data array from the tool result (e.g., monthly_trend, by_carrier, or top_payouts array).`
    };
  }

  // Check if all y-axis values are 0 or undefined (likely placeholder)
  const allYValuesZero = input.data.every(item => {
    return input.y_axis_keys.every(key => {
      const val = item[key];
      return val === 0 || val === undefined || val === null || val === '';
    });
  });

  if (allYValuesZero && input.data.length <= 5) {
    return {
      valid: false,
      error: `All y-axis values are zero or empty. This may indicate placeholder data. Please ensure you're passing actual data from the tool result.`
    };
  }

  return { valid: true };
}

/**
 * Generates chartcode marker for bar chart (Chart.js will parse this)
 */
function generateBarChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys } = input;

  return `// Chart.js Bar Chart
// Type: BarChart
// xKey: ${x_axis_key}
// yKeys: ${y_axis_keys.join(', ')}
const chartType = 'bar';
const labels = data.map(item => item["${x_axis_key}"]);
const datasets = [${y_axis_keys.map((key, i) => `{
  label: "${key}",
  data: data.map(item => item["${key}"])
}`).join(', ')}];`;
}

/**
 * Generates chartcode marker for stacked bar chart
 */
function generateStackedBarChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys } = input;

  return `// Chart.js Stacked Bar Chart
// Type: BarChart (stacked)
// xKey: ${x_axis_key}
// yKeys: ${y_axis_keys.join(', ')}
const chartType = 'bar';
const stacked = true;
const labels = data.map(item => item["${x_axis_key}"]);
const datasets = [${y_axis_keys.map((key, i) => `{
  label: "${key}",
  data: data.map(item => item["${key}"]),
  stack: 'stack1'
}`).join(', ')}];`;
}

/**
 * Generates chartcode marker for line chart
 */
function generateLineChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys } = input;

  return `// Chart.js Line Chart
// Type: LineChart
// xKey: ${x_axis_key}
// yKeys: ${y_axis_keys.join(', ')}
const chartType = 'line';
const labels = data.map(item => item["${x_axis_key}"]);
const datasets = [${y_axis_keys.map((key, i) => `{
  label: "${key}",
  data: data.map(item => item["${key}"]),
  tension: 0.4
}`).join(', ')}];`;
}

/**
 * Generates chartcode marker for area chart
 */
function generateAreaChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys } = input;

  return `// Chart.js Area Chart
// Type: AreaChart
// xKey: ${x_axis_key}
// yKeys: ${y_axis_keys.join(', ')}
const chartType = 'area';
const labels = data.map(item => item["${x_axis_key}"]);
const datasets = [${y_axis_keys.map((key, i) => `{
  label: "${key}",
  data: data.map(item => item["${key}"]),
  fill: true,
  tension: 0.4
}`).join(', ')}];`;
}

/**
 * Generates chartcode marker for pie chart
 */
function generatePieChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys } = input;
  const valueKey = y_axis_keys[0];

  return `// Chart.js Pie Chart
// Type: PieChart
// nameKey: ${x_axis_key}
// valueKey: ${valueKey}
const chartType = 'pie';
const labels = data.map(item => item["${x_axis_key}"]);
const dataset = {
  data: data.map(item => item["${valueKey}"])
};`;
}

/**
 * Main function to generate visualization
 */
export function generateVisualization(input: VisualizationInput): VisualizationResult {
  // Validate input
  const validation = validateVisualizationInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Limit data to prevent performance issues
  const limitedData = input.data.slice(0, 50);

  // Generate chartcode based on chart type
  let chartcode: string;

  switch (input.chart_type) {
    case 'bar':
      chartcode = generateBarChartCode({ ...input, data: limitedData });
      break;
    case 'stacked_bar':
      chartcode = generateStackedBarChartCode({ ...input, data: limitedData });
      break;
    case 'line':
      chartcode = generateLineChartCode({ ...input, data: limitedData });
      break;
    case 'area':
      chartcode = generateAreaChartCode({ ...input, data: limitedData });
      break;
    case 'pie':
      chartcode = generatePieChartCode({ ...input, data: limitedData });
      break;
    default:
      // Default to bar chart
      chartcode = generateBarChartCode({ ...input, data: limitedData });
  }

  return {
    _visualization: true,
    chart_type: input.chart_type,
    title: input.title,
    description: input.description,
    chartcode,
    data: limitedData
  };
}

/**
 * Infer the best chart type based on data characteristics
 */
export function inferBestChartType(data: Record<string, any>[], yKeys: string[]): ChartType {
  if (!data || data.length === 0) return 'bar';

  const itemCount = data.length;
  const multipleYKeys = yKeys.length > 1;

  // Check if data looks like time series
  const firstItem = data[0];
  const hasDateLikeKey = Object.keys(firstItem).some(key =>
    key.toLowerCase().includes('date') ||
    key.toLowerCase().includes('month') ||
    key.toLowerCase().includes('year') ||
    key.toLowerCase().includes('time')
  );

  // If time series data, use line chart
  if (hasDateLikeKey && itemCount > 3) {
    return 'line';
  }

  // For multiple y keys, use stacked bar
  if (multipleYKeys && itemCount <= 15) {
    return 'stacked_bar';
  }

  // For few items (< 8), pie chart works well for single metric
  if (itemCount <= 8 && !multipleYKeys) {
    return 'pie';
  }

  // Default to bar chart
  return 'bar';
}
