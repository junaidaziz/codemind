import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  GitCommitIcon, 
  GitPullRequestIcon, 
  CalendarIcon, 
  TrendingUpIcon,
  FileIcon,
  ClockIcon,
  ExternalLinkIcon,
  ActivityIcon,
  CodeIcon
} from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface ContributorDetailModalProps {
  contributor: {
    login: string;
    avatarUrl?: string;
    htmlUrl?: string;
    totalContributions: number;
    commitsInPeriod: number;
    pullRequestsInPeriod: number;
    lastActivity: string | null;
  };
  projectId: string;
  children: React.ReactNode;
}

interface ContributorDetail {
  id: string;
  username: string;
  githubId?: string;
  avatarUrl?: string;
  email?: string;
  name?: string;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalPRs: number;
  lastActiveAt?: string;
  joinedAt: string;
  commits: {
    id: string;
    sha: string;
    message: string;
    date: string;
    additions?: number;
    deletions?: number;
    filesChanged: string[];
    url?: string;
  }[];
  pullRequests: {
    id: string;
    number: number;
    title: string;
    state: string;
    createdAt: string;
    mergedAt?: string;
    url: string;
  }[];
  activityTrend: {
    date: string;
    commits: number;
    additions: number;
    deletions: number;
  }[];
  topFiles: {
    filename: string;
    commits: number;
    additions: number;
    deletions: number;
  }[];
}

export function ContributorDetailModal({ contributor, projectId, children }: ContributorDetailModalProps) {
  const [contributorDetail, setContributorDetail] = useState<ContributorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContributorDetail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/projects/${projectId}/contributors/${contributor.login}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch contributor details');
      }
      
      const data = await response.json();
      setContributorDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching contributor details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog>
      <DialogTrigger onClick={fetchContributorDetail} className="cursor-pointer">
        {children}
      </DialogTrigger>
      <DialogContent align="center" className="max-w-5xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20">
              <AvatarImage src={contributor.avatarUrl} alt={contributor.login} />
              <AvatarFallback>{getInitials(contributor.login)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-lg font-semibold cursor-pointer group">
                <a 
                  href={contributor.htmlUrl || `https://github.com/${contributor.login}`}
                  target="_blank" rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {contributor.login}
                </a>
                <ExternalLinkIcon className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {contributor.lastActivity && (
                  <span className="inline-flex items-center gap-1"><ClockIcon className="h-3 w-3" />Last active: {formatTimeAgo(contributor.lastActivity)}</span>
                )}
                <span className="inline-flex items-center gap-1"><GitCommitIcon className="h-3 w-3" />{contributor.commitsInPeriod} commits (period)</span>
                <span className="inline-flex items-center gap-1"><GitPullRequestIcon className="h-3 w-3" />{contributor.pullRequestsInPeriod} PRs (period)</span>
                <span className="inline-flex items-center gap-1"><ActivityIcon className="h-3 w-3" />{contributor.totalContributions} total</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading contributor details...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">Error: {error}</p>
            <Button onClick={fetchContributorDetail} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {contributorDetail && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Commits</p>
                      <p className="text-2xl font-bold">{contributorDetail.totalCommits}</p>
                    </div>
                    <GitCommitIcon className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pull Requests</p>
                      <p className="text-2xl font-bold">{contributorDetail.totalPRs}</p>
                    </div>
                    <GitPullRequestIcon className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Lines Added</p>
                      <p className="text-2xl font-bold text-green-600">+{contributorDetail.totalAdditions}</p>
                    </div>
                    <TrendingUpIcon className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Lines Removed</p>
                      <p className="text-2xl font-bold text-red-600">-{contributorDetail.totalDeletions}</p>
                    </div>
                    <CodeIcon className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="activity" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="commits">Commits</TabsTrigger>
                <TabsTrigger value="pullrequests">Pull Requests</TabsTrigger>
                <TabsTrigger value="files">Top Files</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ActivityIcon className="h-5 w-5" />
                      Activity Trend (Last 30 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contributorDetail.activityTrend && contributorDetail.activityTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={contributorDetail.activityTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="commits" 
                            stroke="#3b82f6" 
                            name="Commits"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="additions" 
                            stroke="#10b981" 
                            name="Lines Added"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="deletions" 
                            stroke="#ef4444" 
                            name="Lines Deleted"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No activity data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="commits" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitCommitIcon className="h-5 w-5" />
                      Recent Commits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {contributorDetail.commits && contributorDetail.commits.length > 0 ? (
                        contributorDetail.commits.slice(0, 20).map((commit) => (
                          <div key={commit.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium truncate">{commit.message}</p>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    {formatDate(commit.date)}
                                  </span>
                                  {commit.additions !== undefined && (
                                    <span className="text-green-600">+{commit.additions}</span>
                                  )}
                                  {commit.deletions !== undefined && (
                                    <span className="text-red-600">-{commit.deletions}</span>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {commit.sha.slice(0, 7)}
                                  </Badge>
                                </div>
                              </div>
                              {commit.url && (
                                <a
                                  href={commit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-6 w-6 p-0 ml-2 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                                >
                                  <ExternalLinkIcon className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No commits found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pullrequests" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitPullRequestIcon className="h-5 w-5" />
                      Pull Requests
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {contributorDetail.pullRequests && contributorDetail.pullRequests.length > 0 ? (
                        contributorDetail.pullRequests.map((pr) => (
                          <div key={pr.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">#{pr.number}: {pr.title}</p>
                                  <Badge 
                                    variant={pr.state === 'MERGED' ? 'default' : pr.state === 'OPEN' ? 'secondary' : 'outline'}
                                  >
                                    {pr.state.toLowerCase()}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    Created {formatDate(pr.createdAt)}
                                  </span>
                                  {pr.mergedAt && (
                                    <span className="flex items-center gap-1">
                                      <ClockIcon className="h-3 w-3" />
                                      Merged {formatDate(pr.mergedAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <a
                                href={pr.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-6 w-6 p-0 ml-2 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                              >
                                <ExternalLinkIcon className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No pull requests found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileIcon className="h-5 w-5" />
                      Most Edited Files
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contributorDetail.topFiles && contributorDetail.topFiles.length > 0 ? (
                        contributorDetail.topFiles.slice(0, 10).map((file, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium truncate">{file.filename}</p>
                              <Badge variant="secondary">{file.commits} commits</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="text-green-600">+{file.additions}</span>
                              <span className="text-red-600">-{file.deletions}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No file data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}