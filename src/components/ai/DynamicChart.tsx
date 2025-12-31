'use client';

import React, { useRef } from 'react';
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
import { Bar, Line, Pie } from 'react-chartjs-2';

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
  'rgba(139, 92, 246, 0.8)',   // purple-500
  'rgba(59, 130, 246, 0.8)',   // blue-500
  'rgba(16, 185, 129, 0.8)',   // green-500
  'rgba(245, 158, 11, 0.8)',   // amber-500
  'rgba(239, 68, 68, 0.8)',    // red-500
  'rgba(236, 72, 153, 0.8)',   // pink-500
  'rgba(6, 182, 212, 0.8)',    // cyan-500
  'rgba(139, 92, 246, 0.8)',   // purple-500
];

const BORDER_COLORS = [
  'rgb(139, 92, 246)',   // purple-500
  'rgb(59, 130, 246)',   // blue-500
  'rgb(16, 185, 129)',   // green-500
  'rgb(245, 158, 11)',   // amber-500
  'rgb(239, 68, 68)',    // red-500
  'rgb(236, 72, 153)',   // pink-500
  'rgb(6, 182, 212)',    // cyan-500
  'rgb(139, 92, 246)',   // purple-500
];

export default function DynamicChart({ type, data, config }: ChartProps) {
  const chartRef = useRef<any>(null);

  console.log('DynamicChart render:', {
    type,
    dataLength: data?.length,
    config,
    sampleData: data?.[0],
    allData: data
  });

  if (!data || data.length === 0) {
    console.warn('DynamicChart: No data provided or empty array');
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl">
        <p className="text-red-600 dark:text-red-400">No data available for chart</p>
      </div>
    );
  }

  // Determine keys
  const xKey = config.xKey || 'name';
  const yKey = config.yKey || 'value';

  // Check if this is a stacked bar chart
  const isStacked = data.length > 0 && data[0].active !== undefined && data[0].inactive !== undefined;

  // Limit data
  const topData = data.slice(0, 10);

  // Extract labels
  const labels = topData.map(item => String(item[xKey] || item.name || ''));

  const baseOptions = {
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
      },
    },
    scales: type !== 'pie' ? {
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
        ticks: { color: 'rgb(148, 163, 184)' },
        ...(isStacked && { stacked: true }),
      },
    } : undefined,
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        console.log('Rendering bar chart...');

        if (isStacked) {
          const chartData = {
            labels,
            datasets: [
              {
                label: 'Active',
                data: topData.map(item => Number(item.active) || 0),
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1,
                borderRadius: 0,
              },
              {
                label: 'Inactive',
                data: topData.map(item => Number(item.inactive) || 0),
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 1,
                borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
              },
            ],
          };

          return (
            <Bar
              ref={chartRef}
              data={chartData}
              options={{
                ...baseOptions,
                scales: {
                  ...baseOptions.scales,
                  x: { ...baseOptions.scales?.x, stacked: true },
                  y: { ...baseOptions.scales?.y, stacked: true },
                },
              }}
            />
          );
        }

        const barChartData = {
          labels,
          datasets: [{
            label: yKey.charAt(0).toUpperCase() + yKey.slice(1).replace(/_/g, ' '),
            data: topData.map(item => Number(item[yKey]) || Number(item.value) || 0),
            backgroundColor: COLORS[0],
            borderColor: BORDER_COLORS[0],
            borderWidth: 1,
            borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
          }],
        };

        return <Bar ref={chartRef} data={barChartData} options={baseOptions} />;

      case 'line':
        const lineChartData = {
          labels,
          datasets: [{
            label: yKey.charAt(0).toUpperCase() + yKey.slice(1).replace(/_/g, ' '),
            data: topData.map(item => Number(item[yKey]) || Number(item.value) || 0),
            backgroundColor: COLORS[0],
            borderColor: BORDER_COLORS[0],
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        };

        return <Line ref={chartRef} data={lineChartData} options={baseOptions} />;

      case 'area':
        const areaChartData = {
          labels,
          datasets: [{
            label: yKey.charAt(0).toUpperCase() + yKey.slice(1).replace(/_/g, ' '),
            data: topData.map(item => Number(item[yKey]) || Number(item.value) || 0),
            backgroundColor: COLORS[0].replace('0.8', '0.3'),
            borderColor: BORDER_COLORS[0],
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          }],
        };

        return <Line ref={chartRef} data={areaChartData} options={baseOptions} />;

      case 'pie':
        // For pie charts, determine the name and value keys
        const nameKey = config.xKey || Object.keys(data[0])[0];
        const valueKey = config.yKey || Object.keys(data[0])[1];

        // Sort data by value and limit to top items
        const sortedData = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
        const topItems = sortedData.slice(0, 8);
        const otherItems = sortedData.slice(8);

        // Combine remaining items into "Others" category
        let pieData = topItems;
        if (otherItems.length > 0) {
          const othersValue = otherItems.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
          pieData = [...topItems, { [nameKey]: 'Others', [valueKey]: othersValue }];
        }

        const pieChartData = {
          labels: pieData.map(item => String(item[nameKey])),
          datasets: [{
            data: pieData.map(item => Number(item[valueKey]) || 0),
            backgroundColor: pieData.map((_, i) => COLORS[i % COLORS.length]),
            borderColor: pieData.map((_, i) => BORDER_COLORS[i % BORDER_COLORS.length]),
            borderWidth: 2,
          }],
        };

        const pieOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom' as const,
              labels: {
                color: 'rgb(148, 163, 184)',
                font: { size: 12 },
                padding: 16,
              },
            },
            tooltip: {
              backgroundColor: 'rgb(30, 41, 59)',
              titleColor: 'rgb(248, 250, 252)',
              bodyColor: 'rgb(226, 232, 240)',
              borderColor: 'rgb(71, 85, 105)',
              borderWidth: 1,
              cornerRadius: 8,
            },
          },
        };

        return <Pie ref={chartRef} data={pieChartData} options={pieOptions} />;

      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{config.title}</h3>
        {config.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{config.description}</p>
        )}
      </div>
      <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4" style={{ height: '400px' }}>
        {renderChart()}
      </div>
    </div>
  );
}
