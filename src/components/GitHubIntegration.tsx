'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Bot, 
  ExternalLink, 
  GitPullRequest, 
  MessageSquare, 
  RefreshCw, 
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
  Brain
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface Label {
  name: string;
  color?: string;
}

interface Issue {
  id: string;
  githubId: number;
  number: number;
  title: string;
  body?: string;
  state: 'OPEN' | 'CLOSED';
  htmlUrl: string;
  author: string;
  authorAvatar?: string;
  labels: Label[];
  assignees: any[];
  aiAnalyzed: boolean;
  aiSummary?: string;
  aiFixAttempt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PullRequest {
  id: string;
  githubId: number;
  number: number;
  title: string;
  body?: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  htmlUrl: string;
  author: string;
  authorAvatar?: string;
  baseBranch: string;
  headBranch: string;
  merged: boolean;
  aiAnalyzed: boolean;
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}

interface GitHubIntegrationProps {
  projectId: string;
}

export function GitHubIntegration({ projectId }: GitHubIntegrationProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [processingIssues, setProcessingIssues] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadIssues();
    loadPullRequests();
  }, [projectId]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/github/issues?projectId=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load issues');
      }

      const data = await response.json();
      setIssues(data.data?.issues || []);
    } catch (error) {
      console.error('Error loading issues:', error);
      toast({
        title: 'Error',
        description: 'Failed to load GitHub issues',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPullRequests = async () => {
    try {
      const response = await fetch(`/api/github/pull-requests?projectId=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load pull requests');
      }

      const data = await response.json();
      setPullRequests(data.data?.pullRequests || []);
    } catch (error) {
      console.error('Error loading pull requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load GitHub pull requests',
        variant: 'destructive',
      });
    }
  };

  const syncGitHubData = async (type: 'issues' | 'pull-requests') => {
    setSyncing(true);
    try {
      const endpoint = `/api/github/${type}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ projectId, sync: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync ${type}`);
      }

      const data = await response.json();
      toast({
        title: 'Sync Completed',
        description: data.data?.message || `${type} synced successfully`,
      });

      // Reload data after sync
      if (type === 'issues') {
        await loadIssues();
      } else {
        await loadPullRequests();
      }
    } catch (error) {
      console.error(`Error syncing ${type}:`, error);
      toast({
        title: 'Sync Failed',
        description: `Failed to sync GitHub ${type}`,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const analyzeIssueWithAI = async (issueId: string) => {
    setProcessingIssues(prev => new Set(prev).add(issueId));
    try {
      const response = await fetch('/api/github/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ issueId, action: 'analyze' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze issue');
      }

      const data = await response.json();
      toast({
        title: 'Analysis Complete',
        description: 'Issue analyzed successfully with AI',
      });

      // Reload issues to show updated AI analysis
      await loadIssues();
    } catch (error) {
      console.error('Error analyzing issue:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze issue with AI',
        variant: 'destructive',
      });
    } finally {
      setProcessingIssues(prev => {
        const newSet = new Set(prev);
        newSet.delete(issueId);
        return newSet;
      });
    }
  };

  const generateAIFix = async (issueId: string) => {
    setProcessingIssues(prev => new Set(prev).add(issueId));
    try {
      const response = await fetch('/api/github/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ issueId, action: 'fix' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate fix');
      }

      const data = await response.json();
      toast({
        title: 'AI Fix Generated',
        description: 'Pull request created with AI-generated fix',
      });

      // Reload both issues and PRs
      await Promise.all([loadIssues(), loadPullRequests()]);
    } catch (error) {
      console.error('Error generating AI fix:', error);
      toast({
        title: 'Fix Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate AI fix',
        variant: 'destructive',
      });
    } finally {
      setProcessingIssues(prev => {
        const newSet = new Set(prev);
        newSet.delete(issueId);
        return newSet;
      });
    }
  };

  const getStateIcon = (state: string, merged?: boolean) => {
    if (state === 'MERGED' || merged) return <CheckCircle2 className="w-4 h-4 text-purple-500" />;
    if (state === 'CLOSED') return <CheckCircle2 className="w-4 h-4 text-gray-500" />;
    if (state === 'OPEN') return <AlertCircle className="w-4 h-4 text-green-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStateColor = (state: string, merged?: boolean) => {
    if (state === 'MERGED' || merged) return 'bg-purple-100 text-purple-800';
    if (state === 'CLOSED') return 'bg-gray-100 text-gray-800';
    if (state === 'OPEN') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">GitHub Integration</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncGitHubData('issues')} 
            disabled={syncing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Issues
          </Button>
          <Button 
            onClick={() => syncGitHubData('pull-requests')} 
            disabled={syncing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync PRs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="issues" className="w-full">
        <TabsList>
          <TabsTrigger value="issues" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Issues ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="pull-requests" className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4" />
            Pull Requests ({pullRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="mt-6">
          <div className="grid gap-4">
            {loading ? (
              <div className="text-center py-8">Loading issues...</div>
            ) : issues.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No issues found. Sync with GitHub to load issues.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              issues.map((issue) => {
                const isProcessing = processingIssues.has(issue.id);
                return (
                  <Card key={issue.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getStateIcon(issue.state)}
                          <div>
                            <CardTitle className="text-base mb-1">
                              <a 
                                href={issue.htmlUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline flex items-center gap-2"
                              >
                                #{issue.number} {issue.title}
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </CardTitle>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span>by {issue.author}</span>
                              <Badge className={getStateColor(issue.state)}>
                                {issue.state.toLowerCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {issue.aiAnalyzed && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Brain className="w-3 h-3" />
                              AI Analyzed
                            </Badge>
                          )}
                          {issue.aiFixAttempt && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <GitPullRequest className="w-3 h-3" />
                              Fix Generated
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {issue.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {issue.labels.map((label, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {label.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {issue.body && (
                        <CardDescription className="mb-4 line-clamp-3">
                          {issue.body}
                        </CardDescription>
                      )}

                      {issue.aiSummary && (
                        <div className="bg-blue-50 border-l-4 border-blue-200 p-3 mb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">AI Analysis</span>
                          </div>
                          <p className="text-sm text-blue-700">{issue.aiSummary}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {!issue.aiAnalyzed && (
                          <Button 
                            onClick={() => analyzeIssueWithAI(issue.id)}
                            disabled={isProcessing || issue.state === 'CLOSED'}
                            size="sm"
                            variant="outline"
                          >
                            <Brain className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
                            Analyze with AI
                          </Button>
                        )}
                        
                        {issue.aiAnalyzed && !issue.aiFixAttempt && issue.state === 'OPEN' && (
                          <Button 
                            onClick={() => generateAIFix(issue.id)}
                            disabled={isProcessing}
                            size="sm"
                          >
                            <Zap className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
                            Generate Fix
                          </Button>
                        )}

                        {issue.aiFixAttempt && (
                          <Button 
                            onClick={() => window.open(issue.aiFixAttempt, '_blank')}
                            size="sm"
                            variant="outline"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Fix PR
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="pull-requests" className="mt-6">
          <div className="grid gap-4">
            {pullRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    <GitPullRequest className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No pull requests found. Sync with GitHub to load PRs.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pullRequests.map((pr) => (
                <Card key={pr.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getStateIcon(pr.state, pr.merged)}
                        <div>
                          <CardTitle className="text-base mb-1">
                            <a 
                              href={pr.htmlUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center gap-2"
                            >
                              #{pr.number} {pr.title}
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>by {pr.author}</span>
                            <Badge className={getStateColor(pr.state, pr.merged)}>
                              {pr.merged ? 'merged' : pr.state.toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {pr.aiAnalyzed && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Brain className="w-3 h-3" />
                          AI Analyzed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <span>{pr.headBranch} → {pr.baseBranch}</span>
                    </div>
                    
                    {pr.body && (
                      <CardDescription className="mb-4 line-clamp-3">
                        {pr.body}
                      </CardDescription>
                    )}

                    {pr.aiSummary && (
                      <div className="bg-blue-50 border-l-4 border-blue-200 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Bot className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">AI Summary</span>
                        </div>
                        <p className="text-sm text-blue-700">{pr.aiSummary}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}