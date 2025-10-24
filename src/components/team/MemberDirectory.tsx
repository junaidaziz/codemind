'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Mail, Shield, UserMinus, UserPlus } from 'lucide-react'
import { useProjectPermission } from '@/hooks/usePermissions'
import { Permission } from '@/lib/permissions'

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

interface MemberDirectoryProps {
  organizationId: string
  members: Member[]
  currentUserId: string
  onInviteMember?: () => void
  onRemoveMember?: (memberId: string) => void
  onChangeRole?: (memberId: string, newRole: string) => void
}

export function MemberDirectory({
  organizationId,
  members,
  currentUserId,
  onInviteMember,
  onRemoveMember,
  onChangeRole,
}: MemberDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const canManageMembers = useProjectPermission(organizationId, Permission.MEMBER_REMOVE)

  // Transform members to have simpler user property
  const transformedMembers = members.map(member => ({
    ...member,
    user: member.User_OrganizationMember_userIdToUser
  }))

  // Filter members based on search
  const filteredMembers = transformedMembers.filter(
    (member) =>
      member.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'MEMBER':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Members</h2>
          <p className="text-gray-600 mt-1">{transformedMembers.length} member{transformedMembers.length !== 1 ? 's' : ''}</p>
        </div>
        {canManageMembers && onInviteMember && (
          <Button onClick={onInviteMember} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search members by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Members List */}
      <div className="grid gap-4">
        {filteredMembers.map((member) => (
          <Card key={member.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar className="h-12 w-12">
                  <AvatarImage src={member.user.image || undefined} alt={member.user.name || 'User'} />
                  <AvatarFallback>{getInitials(member.user.name)}</AvatarFallback>
                </Avatar>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {member.user.name || 'Unknown User'}
                    </h3>
                    {member.userId === currentUserId && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-3 h-3 text-gray-400" />
                    <p className="text-sm text-gray-600">{member.user.email}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Role & Actions */}
              <div className="flex items-center gap-3">
                <Badge className={getRoleBadgeColor(member.role)}>
                  <Shield className="w-3 h-3 mr-1" />
                  {member.role}
                </Badge>

                {canManageMembers && member.userId !== currentUserId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.role !== 'OWNER' && onChangeRole && (
                        <>
                          {member.role !== 'ADMIN' && (
                            <DropdownMenuItem
                              onClick={() => onChangeRole(member.id, 'ADMIN')}
                            >
                              Promote to Admin
                            </DropdownMenuItem>
                          )}
                          {member.role !== 'MEMBER' && (
                            <DropdownMenuItem
                              onClick={() => onChangeRole(member.id, 'MEMBER')}
                            >
                              Change to Member
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      {onRemoveMember && member.role !== 'OWNER' && (
                        <DropdownMenuItem
                          onClick={() => onRemoveMember(member.id)}
                          className="text-red-600"
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </Card>
        ))}

        {filteredMembers.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No members found matching your search.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
