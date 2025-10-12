import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

// Mock component for testing
const AnalyticsDashboard = () => <div data-testid="analytics-dashboard">Analytics Dashboard</div>;

// Mock Recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock analytics API
const mockAnalyticsApi = {
  fetchDashboardData: jest.fn(),
  fetchUsageMetrics: jest.fn(),
  fetchPerformanceMetrics: jest.fn(),
};

jest.mock('../../lib/analytics', () => mockAnalyticsApi);

const mockDashboardData = {
  totalUsers: 1250,
  activeUsers: 890,
  totalProjects: 342,
  activeProjects: 287,
  totalQueries: 15420,
  avgResponseTime: 1.2,
  usageData: [
    { date: '2024-01-01', users: 100, queries: 500 },
    { date: '2024-01-02', users: 120, queries: 620 },
    { date: '2024-01-03', users: 110, queries: 580 },
    { date: '2024-01-04', users: 140, queries: 720 },
    { date: '2024-01-05', users: 130, queries: 650 },
  ],
  performanceData: [
    { date: '2024-01-01', responseTime: 1.1, errorRate: 0.5 },
    { date: '2024-01-02', responseTime: 1.3, errorRate: 0.3 },
    { date: '2024-01-03', responseTime: 1.0, errorRate: 0.2 },
    { date: '2024-01-04', responseTime: 1.4, errorRate: 0.8 },
    { date: '2024-01-05', responseTime: 1.2, errorRate: 0.4 },
  ],
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsApi.fetchDashboardData.mockResolvedValue(mockDashboardData);
  });

  it('renders loading state initially', () => {
    mockAnalyticsApi.fetchDashboardData.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('renders dashboard with metrics after loading', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Check metric cards
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('890')).toBeInTheDocument();
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('342')).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('287')).toBeInTheDocument();
  });

  it('renders charts correctly', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    // Check that chart components are rendered
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAnalyticsApi.fetchDashboardData.mockRejectedValue(new Error('API Error'));

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('retries fetching data when retry button is clicked', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAnalyticsApi.fetchDashboardData
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(mockDashboardData);

    render(<AnalyticsDashboard />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });

    // Click retry button
    fireEvent.click(screen.getByText('Retry'));

    // Wait for successful data load
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    expect(mockAnalyticsApi.fetchDashboardData).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('updates time range filter', async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    });

    // Change time range
    await user.selectOptions(screen.getByTestId('time-range-selector'), '30d');

    await waitFor(() => {
      expect(mockAnalyticsApi.fetchDashboardData).toHaveBeenCalledWith('30d');
    });
  });

  it('refreshes data automatically', async () => {
    jest.useFakeTimers();

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(mockAnalyticsApi.fetchDashboardData).toHaveBeenCalledTimes(1);
    });

    // Fast-forward 5 minutes (auto-refresh interval)
    jest.advanceTimersByTime(5 * 60 * 1000);

    await waitFor(() => {
      expect(mockAnalyticsApi.fetchDashboardData).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('displays metric trends correctly', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Check for trend indicators
    expect(screen.getByTestId('users-trend')).toBeInTheDocument();
    expect(screen.getByTestId('projects-trend')).toBeInTheDocument();
    expect(screen.getByTestId('queries-trend')).toBeInTheDocument();
  });

  it('formats numbers correctly', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Check number formatting
    expect(screen.getByText('1,250')).toBeInTheDocument(); // Total users
    expect(screen.getByText('15,420')).toBeInTheDocument(); // Total queries
    expect(screen.getByText('1.2s')).toBeInTheDocument(); // Response time
  });

  it('shows empty state when no data available', async () => {
    mockAnalyticsApi.fetchDashboardData.mockResolvedValue({
      ...mockDashboardData,
      usageData: [],
      performanceData: [],
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('exports analytics data', async () => {
    const user = userEvent.setup();
    
    // Mock window.open
    const mockOpen = jest.fn();
    Object.defineProperty(window, 'open', { value: mockOpen });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('export-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-button'));

    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics/export'),
      '_blank'
    );
  });

  it('handles real-time updates', async () => {
    const { rerender } = render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    // Simulate real-time update
    const updatedData = {
      ...mockDashboardData,
      totalUsers: 1300,
      activeUsers: 920,
    };
    mockAnalyticsApi.fetchDashboardData.mockResolvedValue(updatedData);

    rerender(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1,300')).toBeInTheDocument();
      expect(screen.getByText('920')).toBeInTheDocument();
    });
  });

  describe('responsive design', () => {
    it('adapts to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });

      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-dashboard')).toBeInTheDocument();
      });
    });

    it('shows desktop layout on larger screens', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      Object.defineProperty(window, 'innerHeight', { value: 800 });

      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('desktop-dashboard')).toBeInTheDocument();
      });
    });
  });
});