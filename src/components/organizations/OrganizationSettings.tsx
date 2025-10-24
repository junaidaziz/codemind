'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'

interface Organization {
  id: string
  name: string
  slug: string
  description?: string | null
}

interface OrganizationSettingsProps {
  organizationId: string
  onUpdate?: (organization: Organization) => void
  onDelete?: () => void
}

export function OrganizationSettings({ organizationId, onUpdate, onDelete }: OrganizationSettingsProps) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganization = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/organizations/${organizationId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch organization')
      }

      const data = await response.json()
      setOrganization(data)
      setFormData({
        name: data.name,
        description: data.description || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError('Organization name is required')
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update organization')
      }

      const updatedOrg = await response.json()
      setOrganization(updatedOrg)
      onUpdate?.(updatedOrg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete organization')
      }

      onDelete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">Organization not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update your organization&apos;s basic information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="slug">Organization Slug</Label>
              <Input
                id="slug"
                type="text"
                value={organization.slug}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">
                The slug cannot be changed after creation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Acme Inc."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={saving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="A brief description of your organization"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that will permanently affect your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showDeleteConfirm ? (
            <div className="space-y-4">
              <div className="rounded-md bg-red-50 p-4">
                <h4 className="text-sm font-medium text-red-800">
                  Are you sure you want to delete this organization?
                </h4>
                <p className="mt-2 text-sm text-red-700">
                  This action cannot be undone. All projects, members, and data associated with this
                  organization will be permanently deleted.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete Organization'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Delete Organization</h4>
                <p className="text-sm text-gray-500">
                  Permanently delete this organization and all associated data
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                Delete Organization
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
