'use client';

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

interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: any[];
  config: {
    xKey?: string;
    yKey?: string;
    title: string;
    description?: string;
  };
}

const COLORS = [
  '#8b5cf6', // purple-500
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // purple-500
];

export default function DynamicChart({ type, data, config }: ChartProps) {
  console.log('🎨 DynamicChart render:', {
    type,
    dataLength: data?.length,
    config,
    sampleData: data?.[0],
    allData: data
  });

  if (!data || data.length === 0) {
    console.warn('⚠️ DynamicChart: No data provided or empty array');
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl">
        <p className="text-red-600">No data available for chart</p>
      </div>
    );
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        console.log('📊 Rendering bar chart...');

        // Limit bar chart data to top 10 items to reduce clutter
        const topBarData = data.slice(0, 10);

        // Check if this is a stacked bar chart (has multiple data keys like active/inactive)
        const isStacked = data.length > 0 && data[0].active !== undefined && data[0].inactive !== undefined;

        // Always use 'name' as xKey for consistency (our data processing uses 'name')
        const xKey = 'name';

        console.log('📊 Bar chart config:', {
          isStacked,
          xKey,
          dataLength: topBarData.length,
          firstItem: topBarData[0],
          configXKey: config.xKey,
          usingXKey: xKey
        });

        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topBarData} margin={{ bottom: 60, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey={xKey}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {isStacked ? (
                <>
                  <Bar
                    dataKey="active"
                    stackId="a"
                    fill="#10b981"
                    name="Active"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="inactive"
                    stackId="a"
                    fill="#ef4444"
                    name="Inactive"
                    radius={[8, 8, 0, 0]}
                  />
                </>
              ) : (
                <Bar
                  dataKey={config.yKey || 'value'}
                  fill={COLORS[0]}
                  radius={[8, 8, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey={config.xKey}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={config.yKey}
                stroke={COLORS[0]}
                strokeWidth={2}
                dot={{ fill: COLORS[0], r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey={config.xKey}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey={config.yKey || 'value'}
                stroke={COLORS[0]}
                fill={COLORS[0]}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // For pie charts, we need to determine the name and value keys
        const nameKey = config.xKey || Object.keys(data[0])[0];
        const valueKey = config.yKey || Object.keys(data[0])[1];

        // Sort data by value and limit to top items to reduce clutter
        const sortedData = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
        const topItems = sortedData.slice(0, 8);
        const otherItems = sortedData.slice(8);

        // Combine remaining items into "Others" category
        let chartData = topItems;
        if (otherItems.length > 0) {
          const othersValue = otherItems.reduce((sum, item) => sum + item[valueKey], 0);
          chartData = [...topItems, { [nameKey]: 'Others', [valueKey]: othersValue }];
        }

        // Custom label that only shows for slices > 5%
        const renderLabel = (entry: any) => {
          const total = chartData.reduce((sum, item) => sum + item[valueKey], 0);
          const percent = (entry[valueKey] / total) * 100;
          if (percent < 5) return ''; // Hide small labels
          return `${entry[nameKey]}: ${entry[valueKey]}`;
        };

        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={renderLabel}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-white via-slate-50/50 to-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{config.title}</h3>
        {config.description && (
          <p className="text-sm text-slate-600">{config.description}</p>
        )}
      </div>
      <div className="bg-white/50 rounded-xl p-4">
        {renderChart()}
      </div>
    </div>
  );
}

