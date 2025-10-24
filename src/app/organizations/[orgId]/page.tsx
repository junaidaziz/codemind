'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MemberDirectory } from '@/components/team/MemberDirectory'
import { ActivityFeed } from '@/components/team/ActivityFeed'
import { OrganizationSettings } from '@/components/team/OrganizationSettings'
import { Users, Activity, Settings, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'

interface Member {
  id: string
  userId: string
  organizationId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  joinedAt: Date
  User_OrganizationMember_userIdToUser: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

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

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: Date
}

export default function OrganizationDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const orgId = params.orgId as string

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [activities, setActivities] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('members')

  const loadOrganizationData = async () => {
    try {
      setLoading(true)

      // Load organization details
      const orgRes = await fetch(`/api/organizations/${orgId}`)
      if (!orgRes.ok) {
        throw new Error('Failed to load organization')
      }
      const orgData = await orgRes.json()
      setOrganization(orgData)

      // Load members
      const membersRes = await fetch(`/api/organizations/${orgId}/members`)
      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setMembers(membersData)
      }

      // Load activity
      const activityRes = await fetch(`/api/organizations/${orgId}/activity?limit=20`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData.activities || [])
      }
    } catch (error) {
      console.error('Error loading organization data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load organization data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && orgId) {
      loadOrganizationData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, orgId, router])

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to remove member')
      }

      toast({
        title: 'Success',
        description: 'Member removed successfully',
      })

      // Reload members
      await loadOrganizationData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      })
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        throw new Error('Failed to change member role')
      }

      toast({
        title: 'Success',
        description: 'Member role updated successfully',
      })

      // Reload members
      await loadOrganizationData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change member role',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateOrganization = async (data: { name: string; description: string }) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        throw new Error('Failed to update organization')
      }

      const updated = await res.json()
      setOrganization(updated)
    } catch (error) {
      throw error
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Organization not found</p>
      </div>
    )
  }

  const currentUserId = session?.user?.id || ''
  const currentMember = members.find((m) => m.userId === currentUserId)
  const canEditSettings = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN'

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{organization.name}</h1>
        {organization.description && (
          <p className="text-gray-600 mt-2">{organization.description}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Members</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>Activity</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <MemberDirectory
            organizationId={orgId}
            members={members}
            currentUserId={currentUserId}
            onRemoveMember={handleRemoveMember}
            onChangeRole={handleChangeRole}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityFeed activities={activities} limit={20} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <OrganizationSettings
            organization={organization}
            onUpdate={handleUpdateOrganization}
            canEdit={canEditSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
