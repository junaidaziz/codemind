// Reusable Chart Components for Analytics Dashboard
// Using Chart.js for consistent theming and enhanced functionality
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  TooltipItem,
  LegendItem,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Chart data types
interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
}

interface DoughnutChartData {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

interface BarChartData {
  category: string;
  value: number;
  comparison?: number;
  change?: number;
}

// Consistent color scheme for charts (Blue/Green theme)
export const CHART_COLORS = {
  primary: '#3B82F6',    // blue-500
  secondary: '#10B981',  // emerald-500
  accent: '#06B6D4',     // cyan-500
  success: '#22C55E',    // green-500
  warning: '#F59E0B',    // amber-500
  error: '#EF4444',      // red-500
  info: '#8B5CF6',       // violet-500
  neutral: '#6B7280',    // gray-500
};

export const CHART_COLOR_ARRAY = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.info,
  CHART_COLORS.neutral,
];

// Common chart options with dark mode support
const getBaseChartOptions = (title?: string, isDarkMode?: boolean) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: isDarkMode ? '#F3F4F6' : '#374151', // gray-100 : gray-700
        font: {
          size: 12,
        },
      },
    },
    title: {
      display: !!title,
      text: title,
      color: isDarkMode ? '#F9FAFB' : '#111827', // gray-50 : gray-900
      font: {
        size: 14,
        weight: 'bold' as const,
      },
    },
    tooltip: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', // gray-700 : white
      titleColor: isDarkMode ? '#F3F4F6' : '#111827', // gray-100 : gray-900
      bodyColor: isDarkMode ? '#D1D5DB' : '#374151', // gray-300 : gray-700
      borderColor: isDarkMode ? '#4B5563' : '#E5E7EB', // gray-600 : gray-200
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: {
        color: isDarkMode ? '#9CA3AF' : '#6B7280', // gray-400 : gray-500
        font: {
          size: 11,
        },
      },
      grid: {
        color: isDarkMode ? '#374151' : '#F3F4F6', // gray-700 : gray-100
      },
    },
    y: {
      ticks: {
        color: isDarkMode ? '#9CA3AF' : '#6B7280', // gray-400 : gray-500
        font: {
          size: 11,
        },
      },
      grid: {
        color: isDarkMode ? '#374151' : '#F3F4F6', // gray-700 : gray-100
      },
    },
  },
});

// Line Chart Component
interface LineChartComponentProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  color?: string;
  isDarkMode?: boolean;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
  className?: string;
}

export const LineChartComponent: React.FC<LineChartComponentProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS.primary,
  isDarkMode = false,
  // showGrid = true, // Unused parameter
  formatValue = (value) => value.toLocaleString(),
  formatLabel = (label) => new Date(label).toLocaleDateString(),
  className = '',
}) => {
  const chartData = {
    labels: data.map(item => formatLabel(item.timestamp)),
    datasets: [
      {
        label: 'Value',
        data: data.map(item => item.value),
        borderColor: color,
        backgroundColor: `${color}20`, // 20% opacity
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    ...getBaseChartOptions(title, isDarkMode),
    scales: {
      ...getBaseChartOptions(title, isDarkMode).scales,
      y: {
        ...getBaseChartOptions(title, isDarkMode).scales?.y,
        ticks: {
          ...getBaseChartOptions(title, isDarkMode).scales?.y?.ticks,
          callback: (value: unknown) => formatValue(value as number),
        },
      },
    },
    plugins: {
      ...getBaseChartOptions(title, isDarkMode).plugins,
      tooltip: {
        ...getBaseChartOptions(title, isDarkMode).plugins?.tooltip,
        callbacks: {
          label: (tooltipItem: TooltipItem<'line'>) => `Value: ${formatValue(tooltipItem.parsed.y || 0)}`,
        },
      },
    },
  };

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Area Chart Component (using Line chart with fill)
interface AreaChartComponentProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  color?: string;
  isDarkMode?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
  className?: string;
}

export const AreaChartComponent: React.FC<AreaChartComponentProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS.secondary,
  isDarkMode = false,
  formatValue = (value) => value.toLocaleString(),
  formatLabel = (label) => new Date(label).toLocaleDateString(),
  className = '',
}) => {
  const chartData = {
    labels: data.map(item => formatLabel(item.timestamp)),
    datasets: [
      {
        label: 'Value',
        data: data.map(item => item.value),
        borderColor: color,
        backgroundColor: `${color}30`, // 30% opacity for fill
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    ...getBaseChartOptions(title, isDarkMode),
    scales: {
      ...getBaseChartOptions(title, isDarkMode).scales,
      y: {
        ...getBaseChartOptions(title, isDarkMode).scales?.y,
        ticks: {
          ...getBaseChartOptions(title, isDarkMode).scales?.y?.ticks,
          callback: (value: unknown) => formatValue(value as number),
        },
      },
    },
    plugins: {
      ...getBaseChartOptions(title, isDarkMode).plugins,
      tooltip: {
        ...getBaseChartOptions(title, isDarkMode).plugins?.tooltip,
        callbacks: {
          label: (tooltipItem: TooltipItem<'line'>) => `Value: ${formatValue(tooltipItem.parsed.y || 0)}`,
        },
      },
    },
  };

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Bar Chart Component
interface BarChartComponentProps {
  data: BarChartData[];
  title?: string;
  height?: number;
  color?: string;
  isDarkMode?: boolean;
  showComparison?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS.accent,
  isDarkMode = false,
  showComparison = false,
  formatValue = (value) => value.toLocaleString(),
  className = '',
}) => {
  const datasets = [
    {
      label: 'Current',
      data: data.map(item => item.value),
      backgroundColor: `${color}80`, // 80% opacity
      borderColor: color,
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    },
  ];

  if (showComparison) {
    datasets.push({
      label: 'Previous',
      data: data.map(item => item.comparison || 0),
      backgroundColor: `${CHART_COLORS.neutral}60`, // 60% opacity
      borderColor: CHART_COLORS.neutral,
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    });
  }

  const chartData = {
    labels: data.map(item => item.category),
    datasets,
  };

  const options = {
    ...getBaseChartOptions(title, isDarkMode),
    scales: {
      ...getBaseChartOptions(title, isDarkMode).scales,
      y: {
        ...getBaseChartOptions(title, isDarkMode).scales?.y,
        ticks: {
          ...getBaseChartOptions(title, isDarkMode).scales?.y?.ticks,
          callback: (value: unknown) => formatValue(value as number),
        },
      },
    },
    plugins: {
      ...getBaseChartOptions(title, isDarkMode).plugins,
      tooltip: {
        ...getBaseChartOptions(title, isDarkMode).plugins?.tooltip,
        callbacks: {
          label: (tooltipItem: TooltipItem<'bar'>) => 
            `${tooltipItem.dataset.label || 'Value'}: ${formatValue(tooltipItem.parsed.y || 0)}`,
        },
      },
    },
  };

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

// Doughnut Chart Component
interface DoughnutChartComponentProps {
  data: DoughnutChartData[];
  title?: string;
  height?: number;
  isDarkMode?: boolean;
  showLabels?: boolean;
  className?: string;
}

export const DoughnutChartComponent: React.FC<DoughnutChartComponentProps> = ({
  data,
  title,
  height = 300,
  isDarkMode = false,
  showLabels = true,
  className = '',
}) => {
  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        data: data.map(item => item.value),
        backgroundColor: data.map((item, index) => 
          item.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]
        ),
        borderColor: isDarkMode ? '#374151' : '#FFFFFF',
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: isDarkMode ? '#F3F4F6' : '#374151',
          font: {
            size: 12,
          },
          generateLabels: (chart: ChartJS) => {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original.call(this, chart) as LegendItem[];
            
            labels.forEach((label: LegendItem, index: number) => {
              if (showLabels && data[index] && label.text) {
                label.text = `${label.text} (${data[index].percentage.toFixed(1)}%)`;
              }
            });
            
            return labels;
          },
        },
      },
      title: {
        display: !!title,
        text: title,
        color: isDarkMode ? '#F9FAFB' : '#111827',
        font: {
          size: 14,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
        titleColor: isDarkMode ? '#F3F4F6' : '#111827',
        bodyColor: isDarkMode ? '#D1D5DB' : '#374151',
        borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
        borderWidth: 1,
        callbacks: {
          label: (tooltipItem: TooltipItem<'doughnut'>) => {
            const item = data[tooltipItem.dataIndex];
            return `${item.name}: ${item.value.toLocaleString()} (${item.percentage.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

// Multi-line Chart Component for comparing multiple metrics
interface MultiLineChartComponentProps {
  data: Array<{
    timestamp: string;
    [key: string]: string | number;
  }>;
  title?: string;
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  isDarkMode?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
  className?: string;
}

export const MultiLineChartComponent: React.FC<MultiLineChartComponentProps> = ({
  data,
  title,
  lines,
  height = 300,
  isDarkMode = false,
  formatValue = (value) => value.toLocaleString(),
  formatLabel = (label) => new Date(label).toLocaleDateString(),
  className = '',
}) => {
  const chartData = {
    labels: data.map(item => formatLabel(item.timestamp)),
    datasets: lines.map(line => ({
      label: line.name,
      data: data.map(item => item[line.dataKey] as number),
      borderColor: line.color,
      backgroundColor: `${line.color}20`,
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointBackgroundColor: line.color,
      pointBorderColor: line.color,
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    })),
  };

  const options = {
    ...getBaseChartOptions(title, isDarkMode),
    scales: {
      ...getBaseChartOptions(title, isDarkMode).scales,
      y: {
        ...getBaseChartOptions(title, isDarkMode).scales?.y,
        ticks: {
          ...getBaseChartOptions(title, isDarkMode).scales?.y?.ticks,
          callback: (value: unknown) => formatValue(value as number),
        },
      },
    },
    plugins: {
      ...getBaseChartOptions(title, isDarkMode).plugins,
      tooltip: {
        ...getBaseChartOptions(title, isDarkMode).plugins?.tooltip,
        callbacks: {
          label: (tooltipItem: TooltipItem<'line'>) => 
            `${tooltipItem.dataset.label || 'Value'}: ${formatValue(tooltipItem.parsed.y || 0)}`,
        },
      },
    },
  };

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Chart utility formatters
export const formatters = {
  number: (value: number) => value.toLocaleString(),
  currency: (value: number) => `$${value.toLocaleString()}`,
  percentage: (value: number) => `${value.toFixed(1)}%`,
  duration: (value: number) => `${value}ms`,
  bytes: (value: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  },
  date: (timestamp: string) => new Date(timestamp).toLocaleDateString(),
  time: (timestamp: string) => new Date(timestamp).toLocaleTimeString(),
  datetime: (timestamp: string) => new Date(timestamp).toLocaleString(),
};

// Export chart colors for consistency
export { CHART_COLORS as ChartColors };

// Chart wrapper component for consistent styling
interface ChartWrapperProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  isDarkMode?: boolean;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  description,
  children,
  className = '',
  isDarkMode = false,
}) => {
  return (
    <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h3>
          )}
          {description && (
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};