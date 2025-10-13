// Organization types for type-safe organization management
import { OrganizationRole } from '@prisma/client';
export { OrganizationRole } from '@prisma/client';

// Define core organization interfaces
export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  avatarUrl?: string | null;
  plan: string;
  maxProjects: number;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  invitedAt?: Date | null;
  joinedAt: Date;
  invitedBy?: string | null;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: string;
}

export interface CreateOrganizationData {
  name: string;
  description?: string;
  slug: string;
}

export interface UpdateOrganizationData {
  name?: string;
  description?: string;
  avatarUrl?: string;
}

export interface OrganizationWithMembers extends Organization {
  members: (OrganizationMember & {
    user: {
      id: string;
      email: string | null;
      name: string | null;
      image?: string | null;
    };
  })[];
  projects: {
    id: string;
    name: string;
    createdAt: Date;
    status: string;
  }[];
  _count?: {
    members: number;
    projects: number;
  };
}

export interface InviteMemberData {
  email: string;
  role: OrganizationRole;
}

export interface OrganizationPermissions {
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canDeleteOrganization: boolean;
}

export interface UserOrganizations {
  owned: OrganizationWithMembers[];
  member: OrganizationWithMembers[];
}

// Permission helpers
export function getOrganizationPermissions(role: OrganizationRole): OrganizationPermissions {
  switch (role) {
    case 'OWNER':
      return {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canManageMembers: true,
        canManageSettings: true,
        canDeleteOrganization: true,
      };
    case 'ADMIN':
      return {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canManageMembers: true,
        canManageSettings: true,
        canDeleteOrganization: false,
      };
    case 'EDITOR':
      return {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false,
        canManageMembers: false,
        canManageSettings: false,
        canDeleteOrganization: false,
      };
    case 'VIEWER':
      return {
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canManageMembers: false,
        canManageSettings: false,
        canDeleteOrganization: false,
      };
    default:
      return {
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canManageMembers: false,
        canManageSettings: false,
        canDeleteOrganization: false,
      };
  }
}

export function canAccessProject(
  project: { ownerId: string; organizationId?: string | null },
  userId: string,
  userOrgMemberships: { organizationId: string; role: OrganizationRole }[]
): boolean {
  // If user owns the project directly
  if (project.ownerId === userId) {
    return true;
  }

  // If project belongs to an organization and user is a member
  if (project.organizationId) {
    const membership = userOrgMemberships.find(
      m => m.organizationId === project.organizationId
    );
    return !!membership; // Any role in the org grants access
  }

  return false;
}