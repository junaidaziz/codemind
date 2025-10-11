// Analytics Dashboard Components for CodeMind
import React, { useState, useEffect } from 'react';
import { 
  DashboardResponse, 
  TimePeriod,
} from '../types/analytics';
import { logger } from '../app/lib/logger';
import { 
  LineChartComponent, 
  AreaChartComponent, 
  BarChartComponent, 
  PieChartComponent 
} from './ChartComponents';

// SystemAlert type based on the DashboardResponse alerts array
type SystemAlert = {
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
};

// Dashboard Overview Stats Component
interface StatsCardProps {
  title: string;
  value: number | string;
  change?: number;
  unit?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error';
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  change, 
  unit = '', 
  icon,
  variant = 'primary' 
}) => {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toString();
    }
    return val;
  };

  const getVariantStyles = (variant: StatsCardProps['variant']): string => {
    const base = "bg-white rounded-lg shadow-sm border p-6 transition-colors hover:shadow-md";
    switch (variant) {
      case 'success': return `${base} border-green-200 hover:border-green-300`;
      case 'warning': return `${base} border-yellow-200 hover:border-yellow-300`;
      case 'error': return `${base} border-red-200 hover:border-red-300`;
      default: return `${base} border-gray-200 hover:border-gray-300`;
    }
  };

  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className={getVariantStyles(variant)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">
              {formatValue(value)}{unit}
            </p>
            {change !== undefined && (
              <p className={`text-sm font-medium ${getChangeColor(change)}`}>
                {change > 0 ? '+' : ''}{change}%
              </p>
            )}
          </div>
        </div>
        {icon && (
          <div className="flex-shrink-0 text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// System Health Status Component
interface HealthStatusProps {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  responseTime: number;
}

const HealthStatus: React.FC<HealthStatusProps> = ({ status, uptime, responseTime }) => {
  const getStatusConfig = (status: HealthStatusProps['status']) => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          label: 'Healthy'
        };
      case 'warning':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          label: 'Warning'
        };
      case 'critical':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          label: 'Critical'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`${config.bgColor} rounded-lg p-4 border border-opacity-20`}>
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
        <div className="flex-1">
          <p className={`font-medium ${config.textColor}`}>System {config.label}</p>
          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
            <span>Uptime: {uptime.toFixed(2)}%</span>
            <span>Avg Response: {responseTime}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// System Alerts Component
interface AlertsListProps {
  alerts: SystemAlert[];
  maxVisible?: number;
}

const AlertsList: React.FC<AlertsListProps> = ({ alerts, maxVisible = 5 }) => {
  const getAlertConfig = (type: SystemAlert['type']) => {
    switch (type) {
      case 'info':
        return {
          icon: 'ℹ️',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200'
        };
      case 'warning':
        return {
          icon: '⚠️',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200'
        };
      case 'error':
        return {
          icon: '❌',
          bgColor: 'bg-red-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200'
        };
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const visibleAlerts = alerts.slice(0, maxVisible);

  if (visibleAlerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-700 font-medium">✅ No active alerts</p>
        <p className="text-green-600 text-sm mt-1">All systems are running normally</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleAlerts.map((alert, index) => {
        const config = getAlertConfig(alert.type);
        if (!config) return null;
        
        return (
          <div 
            key={index}
            className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3`}
          >
            <div className="flex items-start space-x-3">
              <span className="text-lg">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${config.textColor}`}>
                  {alert.message}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {formatTimestamp(alert.timestamp)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {alerts.length > maxVisible && (
        <div className="text-center">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View {alerts.length - maxVisible} more alerts
          </button>
        </div>
      )}
    </div>
  );
};

// Time Period Selector Component
interface TimePeriodSelectorProps {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
  disabled?: boolean;
}

const TimePeriodSelector: React.FC<TimePeriodSelectorProps> = ({ 
  selected, 
  onChange, 
  disabled = false 
}) => {
  const periods = [
    { value: TimePeriod.HOUR, label: 'Last 24 Hours' },
    { value: TimePeriod.DAY, label: 'Last 7 Days' },
    { value: TimePeriod.WEEK, label: 'Last 4 Weeks' },
    { value: TimePeriod.MONTH, label: 'Last 12 Months' },
  ];

  return (
    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          disabled={disabled}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selected === period.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

// Main Analytics Dashboard Component
interface AnalyticsDashboardProps {
  initialData?: DashboardResponse;
  refreshInterval?: number; // milliseconds
  onError?: (error: Error) => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  initialData,
  refreshInterval = 30000, // 30 seconds
  onError
}) => {
  const [data, setData] = useState<DashboardResponse | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(TimePeriod.DAY);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/analytics/dashboard');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const dashboardData: DashboardResponse = await response.json();
      setData(dashboardData);
      setLastUpdated(new Date());
      
      logger.info('Dashboard data updated', {
        timestamp: new Date().toISOString(),
        alertCount: dashboardData.alerts.length,
      });
      
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      logger.error('Failed to fetch dashboard data', {}, error);
      
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh data
  useEffect(() => {
    if (!initialData) {
      fetchDashboardData();
    }

    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state
  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-300 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-300 h-64 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load dashboard
          </h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, trends, alerts } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <TimePeriodSelector
            selected={selectedPeriod}
            onChange={setSelectedPeriod}
            disabled={loading}
          />
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* System Health */}
      <HealthStatus
        status={overview.systemHealth}
        uptime={overview.uptime}
        responseTime={overview.avgResponseTime}
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active Users"
          value={overview.activeUsers}
          change={trends.users.change}
          icon={<span className="text-2xl">👥</span>}
        />
        <StatsCard
          title="Active Projects"
          value={overview.activeProjects}
          change={trends.projects.change}
          icon={<span className="text-2xl">📁</span>}
        />
        <StatsCard
          title="Chat Sessions"
          value={overview.totalSessions}
          change={trends.sessions.change}
          icon={<span className="text-2xl">💬</span>}
        />
        <StatsCard
          title="Avg Response Time"
          value={overview.avgResponseTime}
          unit="ms"
          icon={<span className="text-2xl">⚡</span>}
          variant={overview.avgResponseTime > 1000 ? 'warning' : 'success'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <AreaChartComponent
            data={data.charts.userActivity}
            title="User Activity Over Time"
            height={300}
            color="#3B82F6"
            formatValue={(value: number) => `${value} users`}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <PieChartComponent
            data={data.charts.projectUsage}
            title="Project Usage Distribution"
            height={300}
            showLabels={false}
            showLegend={true}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <BarChartComponent
            data={data.charts.apiRequests}
            title="API Requests Comparison"
            height={300}
            color="#10B981"
            showComparison={true}
            formatValue={(value: number) => `${value} requests`}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <LineChartComponent
            data={data.charts.performance}
            title="System Performance"
            height={300}
            color="#F59E0B"
            formatValue={(value: number) => `${value}ms`}
          />
        </div>
      </div>

      {/* System Alerts */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Alerts</h3>
        <AlertsList alerts={alerts} />
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
export { StatsCard, HealthStatus, AlertsList, TimePeriodSelector };