'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AcceptInvitation } from '@/components/invitations'
import { Spinner } from '@/components/ui/Spinner'

function AcceptInvitationContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="mt-2 text-gray-600">No invitation token provided</p>
        </div>
      </div>
    )
  }

  return <AcceptInvitation token={token} />
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  )
}
