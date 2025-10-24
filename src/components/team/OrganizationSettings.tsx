'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, Save, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: Date
}

interface OrganizationSettingsProps {
  organization: Organization
  onUpdate?: (data: { name: string; description: string }) => Promise<void>
  canEdit?: boolean
}

export function OrganizationSettings({
  organization,
  onUpdate,
  canEdit = false,
}: OrganizationSettingsProps) {
  const [name, setName] = useState(organization.name)
  const [description, setDescription] = useState(organization.description || '')
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  const handleNameChange = (value: string) => {
    setName(value)
    setHasChanges(true)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!onUpdate) return

    setIsLoading(true)
    try {
      await onUpdate({ name, description })
      setHasChanges(false)
      toast({
        title: 'Settings saved',
        description: 'Organization settings have been updated successfully.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update settings',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setName(organization.name)
    setDescription(organization.description || '')
    setHasChanges(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Organization Settings</h2>
        <p className="text-gray-600 mt-1">Manage your organization details and preferences</p>
      </div>

      {/* Basic Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold">Basic Information</h3>
        </div>

        <div className="space-y-4">
          {/* Organization Name */}
          <div>
            <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <Input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={!canEdit || isLoading}
              placeholder="Enter organization name"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              This name will be visible to all members and in shared resources.
            </p>
          </div>

          {/* Organization Slug (Read-only) */}
          <div>
            <label htmlFor="org-slug" className="block text-sm font-medium text-gray-700 mb-1">
              Organization Slug
            </label>
            <Input
              id="org-slug"
              type="text"
              value={organization.slug}
              disabled
              className="w-full bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              The slug is used in URLs and cannot be changed.
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="org-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="org-description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              disabled={!canEdit || isLoading}
              placeholder="Enter a description for your organization"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional description to help members understand the organization&apos;s purpose.
            </p>
          </div>

          {/* Save/Reset Buttons */}
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isLoading}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              {hasChanges && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={isLoading}
                >
                  Reset
                </Button>
              )}
            </div>
          )}

          {!canEdit && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                You don&apos;t have permission to edit organization settings.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Organization Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Organization Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Organization ID:</span>
            <span className="font-mono text-gray-900">{organization.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Created:</span>
            <span className="text-gray-900">
              {new Date(organization.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
