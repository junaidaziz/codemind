// Chart Components for Analytics Dashboard
import React from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Chart data types
interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
}

interface PieChartData {
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

// Colors for charts
const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#F97316', // orange-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
];

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => [string, string];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ 
  active, 
  payload, 
  label, 
  formatter 
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index) => {
          const [displayValue, displayName] = formatter 
            ? formatter(entry.value, entry.name)
            : [entry.value.toLocaleString(), entry.name];
          
          return (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              <span className="font-medium">{displayName}:</span> {displayValue}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

// Line Chart Component
interface LineChartComponentProps {
  data: ChartDataPoint[];
  title: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
}

export const LineChartComponent: React.FC<LineChartComponentProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS[0],
  showGrid = true,
  formatValue = (value) => value.toLocaleString(),
  formatLabel = (label) => new Date(label).toLocaleDateString(),
}) => {
  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey="timestamp" 
            tick={{ fontSize: 12 }}
            tickFormatter={formatLabel}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={formatValue}
          />
          <Tooltip 
            content={<CustomTooltip formatter={(value, name) => [formatValue(value), name]} />}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Area Chart Component
interface AreaChartComponentProps {
  data: ChartDataPoint[];
  title: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
}

export const AreaChartComponent: React.FC<AreaChartComponentProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS[1],
  showGrid = true,
  formatValue = (value) => value.toLocaleString(),
  formatLabel = (label) => new Date(label).toLocaleDateString(),
}) => {
  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey="timestamp" 
            tick={{ fontSize: 12 }}
            tickFormatter={formatLabel}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={formatValue}
          />
          <Tooltip 
            content={<CustomTooltip formatter={(value, name) => [formatValue(value), name]} />}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color}
            fillOpacity={0.3}
            fill={color}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Bar Chart Component
interface BarChartComponentProps {
  data: BarChartData[];
  title: string;
  height?: number;
  color?: string;
  showComparison?: boolean;
  formatValue?: (value: number) => string;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS[2],
  showComparison = false,
  formatValue = (value) => value.toLocaleString(),
}) => {
  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="category" 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={formatValue}
          />
          <Tooltip 
            content={<CustomTooltip formatter={(value, name) => [formatValue(value), name]} />}
          />
          <Legend />
          <Bar 
            dataKey="value" 
            fill={color}
            radius={[2, 2, 0, 0]}
            name="Current"
          />
          {showComparison && (
            <Bar 
              dataKey="comparison" 
              fill="#94a3b8"
              radius={[2, 2, 0, 0]}
              name="Previous"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Pie Chart Component
interface PieChartComponentProps {
  data: PieChartData[];
  title: string;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
}

export const PieChartComponent: React.FC<PieChartComponentProps> = ({
  data,
  title,
  height = 300,
  showLabels = true,
  showLegend = true,
}) => {
  // Transform data for Recharts compatibility
  const chartData = data.map(item => ({
    name: item.name,
    value: item.value,
    percentage: item.percentage,
    color: item.color,
  }));

  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabels}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            content={<CustomTooltip formatter={(value, name) => [`${value} (${data.find(d => d.name === name)?.percentage}%)`, name]} />}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Multi-line Chart Component for comparing multiple metrics
interface MultiLineChartComponentProps {
  data: Array<{
    timestamp: string;
    [key: string]: string | number;
  }>;
  title: string;
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
}

export const MultiLineChartComponent: React.FC<MultiLineChartComponentProps> = ({
  data,
  title,
  lines,
  height = 300,
  showGrid = true,
  formatValue = (value) => value.toLocaleString(),
  formatLabel = (label) => new Date(label).toLocaleDateString(),
}) => {
  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey="timestamp" 
            tick={{ fontSize: 12 }}
            tickFormatter={formatLabel}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={formatValue}
          />
          <Tooltip 
            content={<CustomTooltip formatter={(value, name) => [formatValue(value), name]} />}
          />
          <Legend />
          {lines.map((line) => (
            <Line 
              key={line.dataKey}
              type="monotone" 
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={{ fill: line.color, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: line.color, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Chart utilities
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

export { CHART_COLORS };