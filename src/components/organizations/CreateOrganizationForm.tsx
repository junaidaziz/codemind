'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateOrganizationFormProps {
  onSuccess?: (organization: { id: string; name: string; slug: string }) => void
  onCancel?: () => void
}

export function CreateOrganizationForm({ onSuccess, onCancel }: CreateOrganizationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    setFormData({ ...formData, name, slug })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError('Organization name is required')
      return
    }

    if (!formData.slug.trim()) {
      setError('Organization slug is required')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create organization')
      }

      const organization = await response.json()
      onSuccess?.(organization)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Organization</CardTitle>
        <CardDescription>
          Set up a new organization to collaborate with your team
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Acme Inc."
              value={formData.name}
              onChange={handleNameChange}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500">
              The name of your organization or team
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Organization Slug *</Label>
            <Input
              id="slug"
              type="text"
              placeholder="acme-inc"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              disabled={loading}
              required
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-gray-500">
              A unique identifier for your organization (lowercase letters, numbers, and hyphens only)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="A brief description of your organization"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
