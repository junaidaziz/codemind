'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { OrganizationSettings, MemberManagement } from '@/components/organizations'
import { Button } from '@/components/ui/button'

export default function OrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'settings' | 'members'>('settings')
  
  // In a real app, you'd fetch the org by slug to get the ID
  // For now, we'll use the slug as the ID (this should be improved)
  const organizationId = params.slug as string

  const handleUpdate = () => {
    // Optionally refresh data or show a success message
  }

  const handleDelete = () => {
    // Navigate back to organizations list
    router.push('/orgs')
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/orgs')}
          className="mb-4"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Organizations
        </Button>
        
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-gray-600 mt-2">Manage your organization settings and team members</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            General Settings
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Team Members
          </button>
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'settings' ? (
          <OrganizationSettings
            organizationId={organizationId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <MemberManagement organizationId={organizationId} />
        )}
      </div>
    </div>
  )
}
