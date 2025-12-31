/**
 * AI Visualization Tool
 * Generates executable chartcode for dynamic visualizations
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

// Default color palette matching CodeExecutor
const DEFAULT_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
  '#00C49F', '#FFBB28', '#FF8042', '#0088FE'
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

  return { valid: true };
}

/**
 * Generates chartcode for bar chart
 */
function generateBarChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys, config } = input;
  const colors = config?.colors || DEFAULT_COLORS;
  const showLegend = config?.show_legend !== false;
  const showGrid = config?.show_grid !== false;

  const bars = y_axis_keys.map((key, index) =>
    `React.createElement(Bar, { dataKey: "${key}", fill: "${colors[index % colors.length]}", name: "${key}" })`
  ).join(',\n      ');

  return `const chartData = data;

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(BarChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 80 } },
      ${showGrid ? 'React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),' : ''}
      React.createElement(XAxis, { dataKey: "${x_axis_key}", angle: -45, textAnchor: "end", height: 100, interval: 0 }),
      React.createElement(YAxis${config?.y_axis_label ? `, { label: { value: "${config.y_axis_label}", angle: -90, position: "insideLeft" } }` : ', null'}),
      React.createElement(Tooltip, null),
      ${showLegend ? 'React.createElement(Legend, { verticalAlign: "top", height: 36 }),' : ''}
      ${bars}
    )
  );
}`;
}

/**
 * Generates chartcode for stacked bar chart
 */
function generateStackedBarChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys, config } = input;
  const colors = config?.colors || DEFAULT_COLORS;
  const showLegend = config?.show_legend !== false;
  const showGrid = config?.show_grid !== false;

  const bars = y_axis_keys.map((key, index) =>
    `React.createElement(Bar, { dataKey: "${key}", stackId: "stack", fill: "${colors[index % colors.length]}", name: "${key}" })`
  ).join(',\n      ');

  return `const chartData = data;

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(BarChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 80 } },
      ${showGrid ? 'React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),' : ''}
      React.createElement(XAxis, { dataKey: "${x_axis_key}", angle: -45, textAnchor: "end", height: 100, interval: 0 }),
      React.createElement(YAxis${config?.y_axis_label ? `, { label: { value: "${config.y_axis_label}", angle: -90, position: "insideLeft" } }` : ', null'}),
      React.createElement(Tooltip, null),
      ${showLegend ? 'React.createElement(Legend, { verticalAlign: "top", height: 36 }),' : ''}
      ${bars}
    )
  );
}`;
}

/**
 * Generates chartcode for line chart
 */
function generateLineChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys, config } = input;
  const colors = config?.colors || DEFAULT_COLORS;
  const showLegend = config?.show_legend !== false;
  const showGrid = config?.show_grid !== false;

  const lines = y_axis_keys.map((key, index) =>
    `React.createElement(Line, { type: "monotone", dataKey: "${key}", stroke: "${colors[index % colors.length]}", strokeWidth: 2, name: "${key}", dot: { r: 4 } })`
  ).join(',\n      ');

  return `const chartData = data;

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(LineChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 80 } },
      ${showGrid ? 'React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),' : ''}
      React.createElement(XAxis, { dataKey: "${x_axis_key}", angle: -45, textAnchor: "end", height: 100, interval: 0 }),
      React.createElement(YAxis${config?.y_axis_label ? `, { label: { value: "${config.y_axis_label}", angle: -90, position: "insideLeft" } }` : ', null'}),
      React.createElement(Tooltip, null),
      ${showLegend ? 'React.createElement(Legend, { verticalAlign: "top", height: 36 }),' : ''}
      ${lines}
    )
  );
}`;
}

/**
 * Generates chartcode for area chart
 */
function generateAreaChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys, config } = input;
  const colors = config?.colors || DEFAULT_COLORS;
  const showLegend = config?.show_legend !== false;
  const showGrid = config?.show_grid !== false;

  const areas = y_axis_keys.map((key, index) =>
    `React.createElement(Area, { type: "monotone", dataKey: "${key}", stroke: "${colors[index % colors.length]}", fill: "${colors[index % colors.length]}", fillOpacity: 0.3, name: "${key}" })`
  ).join(',\n      ');

  return `const chartData = data;

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(AreaChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 80 } },
      ${showGrid ? 'React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),' : ''}
      React.createElement(XAxis, { dataKey: "${x_axis_key}", angle: -45, textAnchor: "end", height: 100, interval: 0 }),
      React.createElement(YAxis${config?.y_axis_label ? `, { label: { value: "${config.y_axis_label}", angle: -90, position: "insideLeft" } }` : ', null'}),
      React.createElement(Tooltip, null),
      ${showLegend ? 'React.createElement(Legend, { verticalAlign: "top", height: 36 }),' : ''}
      ${areas}
    )
  );
}`;
}

/**
 * Generates chartcode for pie chart
 */
function generatePieChartCode(input: VisualizationInput): string {
  const { x_axis_key, y_axis_keys, config } = input;
  const colors = config?.colors || DEFAULT_COLORS;
  const showLegend = config?.show_legend !== false;

  // Pie charts use the first y_axis_key as the value
  const valueKey = y_axis_keys[0];

  return `// Transform data for pie chart format
const chartData = data.map(item => ({
  name: item["${x_axis_key}"],
  value: Number(item["${valueKey}"]) || 0
})).filter(item => item.value > 0).slice(0, 10);

function renderChart() {
  return React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
    React.createElement(PieChart, null,
      React.createElement(Pie, {
        data: chartData,
        dataKey: "value",
        nameKey: "name",
        cx: "50%",
        cy: "50%",
        outerRadius: 120,
        label: function(entry) { return entry.name + ': ' + entry.value; }
      },
        chartData.map(function(entry, index) {
          return React.createElement(Cell, { key: 'cell-' + index, fill: COLORS[index % COLORS.length] });
        })
      ),
      React.createElement(Tooltip, null)${showLegend ? ',\n      React.createElement(Legend, null)' : ''}
    )
  );
}`;
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
