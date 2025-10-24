'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/Spinner'

interface AcceptInvitationProps {
  token: string
}

interface InvitationDetails {
  id: string
  email: string
  role: string
  projectId: string
  expiresAt: string
  status: string
  User: {
    name?: string | null
    email?: string | null
  }
}

export function AcceptInvitation({ token }: AcceptInvitationProps) {
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchInvitation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const fetchInvitation = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/invitations/${token}`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load invitation')
      }

      const data = await response.json()
      setInvitation(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    try {
      setAccepting(true)
      setError(null)
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to accept invitation')
      }

      const data = await response.json()
      setSuccess(true)

      // Redirect to project after short delay
      setTimeout(() => {
        router.push(`/projects/${data.projectId}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAccepting(false)
    }
  }

  const handleDecline = () => {
    router.push('/projects')
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800'
      case 'EDITOR':
        return 'bg-blue-100 text-blue-800'
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date)
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Spinner />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error || 'This invitation link is invalid or has expired'}
                  </h3>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Button onClick={() => router.push('/projects')} className="w-full">
                Go to Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Invitation Accepted!</h3>
            <p className="mt-2 text-sm text-gray-500">
              Redirecting you to the project...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const expired = isExpired(invitation.expiresAt)
  const alreadyAccepted = invitation.status !== 'PENDING'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Project Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {(expired || alreadyAccepted) && (
            <div className="rounded-md bg-yellow-50 p-4">
              <p className="text-sm text-yellow-700">
                {expired ? 'This invitation has expired.' : `This invitation has already been ${invitation.status.toLowerCase()}.`}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-base font-medium">{invitation.email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Role</p>
              <div className="mt-1">
                <Badge className={getRoleBadgeColor(invitation.role)}>
                  {invitation.role}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600">Invited By</p>
              <p className="text-base font-medium">
                {invitation.User?.name || invitation.User?.email || 'Unknown'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Expires</p>
              <p className="text-base font-medium">{formatDate(invitation.expiresAt)}</p>
            </div>
          </div>

          {!expired && !alreadyAccepted && (
            <div className="flex gap-3">
              <Button
                onClick={handleDecline}
                variant="outline"
                className="flex-1"
                disabled={accepting}
              >
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                className="flex-1"
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </div>
          )}

          {(expired || alreadyAccepted) && (
            <Button onClick={() => router.push('/projects')} className="w-full">
              Go to Projects
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
