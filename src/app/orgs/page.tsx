'use client';

import { useState, useEffect } from 'react';
import type { UserOrganizations, OrganizationWithMembers } from '../../types/organization';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<UserOrganizations>({
    owned: [],
    member: [],
  });
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    slug: '',
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || { owned: [], member: [] });
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setCreateForm({ name: '', description: '', slug: '' });
        fetchOrganizations();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
      alert('Failed to create organization');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setCreateForm(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allOrganizations = [...organizations.owned, ...organizations.member];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Organizations</h1>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={() => setShowCreateForm(true)}
        >
          + New Organization
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Organization</h2>
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="name">Organization Name</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                id="name"
                value={createForm.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value)}
                placeholder="My Organization"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="slug">Slug</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                id="slug"
                value={createForm.slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="my-organization"
                pattern="^[a-z0-9-]+$"
                title="Only lowercase letters, numbers, and hyphens"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="description">Description (Optional)</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                id="description"
                value={createForm.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of your organization"
              />
            </div>
            <div className="flex gap-2">
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Organization
              </button>
              <button 
                type="button"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {allOrganizations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-12 text-center">
          <h3 className="text-lg font-medium mb-2">No Organizations</h3>
          <p className="text-gray-600 mb-4">
            Create an organization to collaborate with your team.
          </p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => setShowCreateForm(true)}
          >
            Create Your First Organization
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {organizations.owned.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Organizations You Own</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.owned.map((org) => (
                  <OrganizationCard key={org.id} organization={org} isOwner={true} />
                ))}
              </div>
            </div>
          )}

          {organizations.member.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Member Organizations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.member.map((org) => (
                  <OrganizationCard key={org.id} organization={org} isOwner={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OrganizationCardProps {
  organization: OrganizationWithMembers;
  isOwner: boolean;
}

function OrganizationCard({ organization, isOwner }: OrganizationCardProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {organization.name}
            {isOwner && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Owner</span>}
          </h3>
          <p className="text-sm text-gray-600 mt-1">@{organization.slug}</p>
        </div>
      </div>
      
      {organization.description && (
        <p className="text-sm text-gray-600 mb-4">{organization.description}</p>
      )}
      
      <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
        <span>{organization._count?.members || 0} members</span>
        <span>{organization._count?.projects || 0} projects</span>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
          👥 Members
        </button>
        {isOwner && (
          <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}