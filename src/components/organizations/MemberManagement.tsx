'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/Spinner'

interface Member {
  id: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  user: {
    id: string
    name?: string | null
    email?: string | null
  }
  joinedAt: string
}

interface MemberManagementProps {
  organizationId: string
}

export function MemberManagement({ organizationId }: MemberManagementProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/organizations/${organizationId}/members`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }

      const data = await response.json()
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!inviteEmail.trim()) {
      setError('Email is required')
      return
    }

    try {
      setInviting(true)
      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to invite member')
      }

      setInviteEmail('')
      setInviteRole('MEMBER')
      setShowInviteForm(false)
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update member role')
      }

      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800'
      case 'MEMBER':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage who has access to this organization
            </CardDescription>
          </div>
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Member
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {showInviteForm && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={inviting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      id="role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                      disabled={inviting}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowInviteForm(false)
                      setInviteEmail('')
                      setInviteRole('MEMBER')
                      setError(null)
                    }}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? 'Inviting...' : 'Send Invitation'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No members yet</p>
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border bg-white p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                    {member.user.name?.[0]?.toUpperCase() || member.user.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.user.name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={getRoleBadgeColor(member.role)}>
                    {member.role}
                  </Badge>
                  {member.role !== 'OWNER' && (
                    <>
                      <Select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER')}
                        className="h-8 w-32"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OWNER">Owner</option>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
