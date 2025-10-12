import { NextResponse } from "next/server";
import { 
  DashboardResponse,
  ChartDataPoint,
  PieChartData,
  BarChartData,
  MetricType,
  TimePeriod,
  ProjectUsageMetric,
} from "../../../../types/analytics";
import { analyticsService } from "../../../../lib/analytics";
import { createApiError } from "../../../../types";
import { logger, withRequestTiming, createPerformanceTimer, endPerformanceTimer } from '../../../lib/logger';

// GET /api/analytics/dashboard - Get dashboard overview data
export async function GET(): Promise<NextResponse> {
  return withRequestTiming('GET', '/api/analytics/dashboard', async () => {
    const totalTimer = createPerformanceTimer('dashboard_data_fetch');
    
    try {
      logger.info('Dashboard overview requested');

      // Fetch overview data
      const overviewTimer = createPerformanceTimer('overview_fetch');
      const overview = await analyticsService.getDashboardOverview();
      endPerformanceTimer(overviewTimer);

      // Fetch chart data (parallel requests for better performance)
      const chartsTimer = createPerformanceTimer('charts_data_fetch');
      const [
        userActivityData,
        projectUsageData,
        apiRequestsData,
        performanceData,
      ] = await Promise.all([
        analyticsService.getAnalyticsData(MetricType.USER_ACTIVITY, TimePeriod.DAY),
        analyticsService.getProjectUsageMetrics(),
        analyticsService.getAnalyticsData(MetricType.API_REQUESTS, TimePeriod.DAY),
        analyticsService.getAnalyticsData(MetricType.SYSTEM_PERFORMANCE, TimePeriod.HOUR),
      ]);
      endPerformanceTimer(chartsTimer);

      // Transform data for charts
      const userActivity: ChartDataPoint[] = userActivityData.data.map((d: { timestamp: Date; value: number; label?: string }) => ({
        timestamp: d.timestamp.toISOString(),
        value: d.value,
        label: d.label,
      }));

      const projectUsage: PieChartData[] = projectUsageData.slice(0, 10).map((project: ProjectUsageMetric, index: number) => ({
        name: project.projectName,
        value: project.totalSessions,
        percentage: Math.round((project.totalSessions / Math.max(1, projectUsageData.reduce((sum: number, p: ProjectUsageMetric) => sum + p.totalSessions, 0))) * 100),
        color: `hsl(${(index * 36) % 360}, 70%, 50%)`, // Generate colors
      }));

      const apiRequests: BarChartData[] = apiRequestsData.data.slice(-7).map((d: { timestamp: Date; value: number }, index: number, arr: { timestamp: Date; value: number }[]) => {
        const prevValue = index > 0 ? arr[index - 1].value : d.value;
        const change = prevValue > 0 ? ((d.value - prevValue) / prevValue) * 100 : 0;
        
        return {
          category: d.timestamp.toLocaleDateString(),
          value: d.value,
          comparison: prevValue,
          change: Math.round(change),
        };
      });

      const performance: ChartDataPoint[] = performanceData.data.slice(-24).map((d: { timestamp: Date; value: number; label?: string }) => ({
        timestamp: d.timestamp.toISOString(),
        value: d.value,
        label: 'Response Time (ms)',
        category: 'performance',
      }));

      // Calculate trends (24h comparison)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const [
        yesterdayUsers,
        yesterdayProjects,
        yesterdaySessions,
        yesterdayErrors,
      ] = await Promise.all([
        analyticsService.getAnalyticsData(MetricType.USER_ACTIVITY, TimePeriod.DAY, yesterday, yesterday),
        // Using project usage as proxy for project activity
        Promise.resolve({ summary: { total: overview.activeProjects * 0.8 } }), // Stub
        analyticsService.getAnalyticsData(MetricType.CHAT_SESSIONS, TimePeriod.DAY, yesterday, yesterday),
        // Using API requests with errors as proxy for error count
        Promise.resolve({ summary: { total: 5 } }), // Stub
      ]);

      const trends = {
        users: { 
          current: overview.activeUsers, 
          change: Math.round(((overview.activeUsers - (yesterdayUsers.summary?.total || 0)) / Math.max(1, yesterdayUsers.summary?.total || 1)) * 100)
        },
        projects: { 
          current: overview.activeProjects, 
          change: Math.round(((overview.activeProjects - (yesterdayProjects.summary?.total || 0)) / Math.max(1, yesterdayProjects.summary?.total || 1)) * 100)
        },
        sessions: { 
          current: overview.totalSessions, 
          change: Math.round(((overview.totalSessions - (yesterdaySessions.summary?.total || 0)) / Math.max(1, yesterdaySessions.summary?.total || 1)) * 100)
        },
        errors: { 
          current: yesterdayErrors.summary?.total || 0, 
          change: 0 // Would calculate error rate change
        },
      };

      // Generate system alerts based on current status
      const alerts = [];
      
      if (overview.systemHealth === 'warning') {
        alerts.push({
          type: 'warning' as const,
          message: 'System performance is degraded',
          timestamp: new Date(),
        });
      }
      
      if (overview.systemHealth === 'critical') {
        alerts.push({
          type: 'error' as const,
          message: 'Critical system issue detected',
          timestamp: new Date(),
        });
      }
      
      if (overview.uptime < 99.5) {
        alerts.push({
          type: 'warning' as const,
          message: `System uptime is ${overview.uptime}%`,
          timestamp: new Date(),
        });
      }
      
      if (overview.avgResponseTime > 2000) {
        alerts.push({
          type: 'warning' as const,
          message: `High average response time: ${overview.avgResponseTime}ms`,
          timestamp: new Date(),
        });
      }

      const totalTime = endPerformanceTimer(totalTimer);

      const response: DashboardResponse = {
        overview,
        charts: {
          userActivity,
          projectUsage,
          apiRequests,
          performance,
        },
        trends,
        alerts,
      };

      logger.info('Dashboard overview completed', {
        processingTime: totalTime,
        dataPoints: {
          userActivity: userActivity.length,
          projectUsage: projectUsage.length,
          apiRequests: apiRequests.length,
          performance: performance.length,
        },
        alertCount: alerts.length,
      });

      return NextResponse.json(response);

    } catch (error) {
      endPerformanceTimer(totalTimer);
      logger.error('Dashboard overview failed', {}, error as Error);

      return NextResponse.json(
        createApiError("Dashboard request failed", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}