'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrganizationList, CreateOrganizationForm } from '@/components/organizations'

export default function OrganizationsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const router = useRouter()

  const handleCreateSuccess = (organization: { id: string; name: string; slug: string }) => {
    setShowCreateForm(false)
    // Refresh the organization list by navigating to the new org
    router.push(`/orgs/${organization.slug}`)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {showCreateForm ? (
        <CreateOrganizationForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : (
        <OrganizationList onCreateClick={() => setShowCreateForm(true)} />
      )}
    </div>
  )
}