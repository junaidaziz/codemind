'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  GitPullRequest,
  Users,
  Shield,
  Key,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  Activity as ActivityIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface ActivityFeedProps {
  activities: AuditLog[]
  limit?: number
}

export function ActivityFeed({ activities, limit = 20 }: ActivityFeedProps) {
  const displayedActivities = limit ? activities.slice(0, limit) : activities

  const getActionIcon = (action: string, entityType: string) => {
    const iconClass = 'w-4 h-4'

    if (action.includes('CREATE')) {
      if (entityType === 'PROJECT') return <FileText className={iconClass} />
      if (entityType === 'INVITATION') return <Users className={iconClass} />
      if (entityType === 'API_KEY') return <Key className={iconClass} />
      return <CheckCircle className={iconClass} />
    }

    if (action.includes('UPDATE')) return <Settings className={iconClass} />
    if (action.includes('DELETE') || action.includes('REVOKE')) return <Trash2 className={iconClass} />
    if (action.includes('MEMBER')) return <Users className={iconClass} />
    if (action.includes('ROLE')) return <Shield className={iconClass} />
    if (action.includes('PR') || action.includes('PULL')) return <GitPullRequest className={iconClass} />
    if (action.includes('ACCEPT')) return <CheckCircle className={iconClass} />
    if (action.includes('REJECT') || action.includes('DECLINE')) return <XCircle className={iconClass} />

    return <ActivityIcon className={iconClass} />
  }

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('ACCEPT')) return 'text-green-600 bg-green-50'
    if (action.includes('DELETE') || action.includes('REVOKE') || action.includes('REJECT'))
      return 'text-red-600 bg-red-50'
    if (action.includes('UPDATE') || action.includes('ROLE')) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Helper to safely render metadata
  const renderMetadata = (metadata: Record<string, unknown>) => {
    const elements: React.ReactElement[] = []
    
    if (metadata.scopes && Array.isArray(metadata.scopes)) {
      elements.push(
        <div key="scopes">
          Scopes: {(metadata.scopes as string[]).join(', ')}
        </div>
      )
    }
    
    if (metadata.role) {
      elements.push(
        <div key="role">
          Role: {String(metadata.role)}
        </div>
      )
    }
    
    return elements.length > 0 ? elements : null
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Recent Activity</h2>
        <p className="text-gray-600 mt-1">Team actions and changes</p>
      </div>

      <Card className="divide-y">
        {displayedActivities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ActivityIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No recent activity to display</p>
          </div>
        ) : (
          displayedActivities.map((activity) => (
            <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                {/* User Avatar */}
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage
                    src={activity.user.image || undefined}
                    alt={activity.user.name || 'User'}
                  />
                  <AvatarFallback>{getInitials(activity.user.name)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {/* User Name and Action */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {activity.user.name || 'Unknown User'}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${getActionColor(activity.action)} flex items-center gap-1`}
                    >
                      {getActionIcon(activity.action, activity.entityType)}
                      {formatAction(activity.action)}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-700 mt-1">{activity.description}</p>

                  {/* Metadata (if relevant) */}
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      {renderMetadata(activity.metadata)}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-gray-500 mt-2">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      {activities.length > limit && (
        <div className="text-center">
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all activity →
          </button>
        </div>
      )}
    </div>
  )
}
