import db from './db';
import { OrganizationRole } from '@prisma/client';
import { nanoid } from 'nanoid';

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  slug?: string;
  ownerId: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  avatarUrl?: string;
  plan?: string;
  maxProjects?: number;
  maxMembers?: number;
}

export interface InviteMemberInput {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  invitedBy: string;
}

export interface UpdateMemberRoleInput {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

export class OrganizationService {
  /**
   * Create a new organization
   */
  static async createOrganization(input: CreateOrganizationInput) {
    const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Check if slug already exists
    const existingOrg = await db.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      throw new Error('Organization with this slug already exists');
    }

    // Create organization and add owner as member
    const organization = await db.organization.create({
      data: {
        id: nanoid(),
        name: input.name,
        description: input.description,
        slug,
        ownerId: input.ownerId,
        OrganizationMember: {
          create: {
            id: nanoid(),
            userId: input.ownerId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        OrganizationMember: {
          include: {
            User_OrganizationMember_userIdToUser: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return organization;
  }

  /**
   * Get organization by ID
   */
  static async getOrganization(organizationId: string) {
    return await db.organization.findUnique({
      where: { id: organizationId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        OrganizationMember: {
          include: {
            User_OrganizationMember_userIdToUser: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            githubUrl: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Get organization by slug
   */
  static async getOrganizationBySlug(slug: string) {
    return await db.organization.findUnique({
      where: { slug },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        OrganizationMember: {
          include: {
            User_OrganizationMember_userIdToUser: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get all organizations for a user
   */
  static async getUserOrganizations(userId: string) {
    return await db.organization.findMany({
      where: {
        OrganizationMember: {
          some: {
            userId,
          },
        },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        OrganizationMember: {
          where: { userId },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            OrganizationMember: true,
            Project: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update organization details
   */
  static async updateOrganization(
    organizationId: string,
    input: UpdateOrganizationInput
  ) {
    return await db.organization.update({
      where: { id: organizationId },
      data: input,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }

  /**
   * Delete organization
   */
  static async deleteOrganization(organizationId: string) {
    return await db.organization.delete({
      where: { id: organizationId },
    });
  }

  /**
   * Invite a member to organization
   */
  static async inviteMember(input: InviteMemberInput) {
    // Check if user is already a member
    const existingMember = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.email, // This will need to be updated after we verify the email
        },
      },
    });

    if (existingMember) {
      throw new Error('User is already a member of this organization');
    }

    // Create invitation token
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await db.organizationInvite.create({
      data: {
        id: nanoid(),
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        token,
        expiresAt,
        invitedBy: input.invitedBy,
      },
      include: {
        Organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return invitation;
  }

  /**
   * Accept organization invitation
   */
  static async acceptInvitation(token: string, userId: string) {
    const invitation = await db.organizationInvite.findUnique({
      where: { token },
      include: {
        Organization: true,
      },
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Check if user email matches invitation email
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (user?.email !== invitation.email) {
      throw new Error('Email does not match invitation');
    }

    // Add user as organization member
    const member = await db.organizationMember.create({
      data: {
        id: nanoid(),
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        invitedAt: invitation.createdAt,
        invitedBy: invitation.invitedBy,
      },
      include: {
        Organization: true,
        User_OrganizationMember_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Delete the invitation
    await db.organizationInvite.delete({
      where: { token },
    });

    return member;
  }

  /**
   * Revoke organization invitation
   */
  static async revokeInvitation(invitationId: string) {
    return await db.organizationInvite.delete({
      where: { id: invitationId },
    });
  }

  /**
   * Get pending invitations for an organization
   */
  static async getPendingInvitations(organizationId: string) {
    return await db.organizationInvite.findMany({
      where: {
        organizationId,
        expiresAt: {
          gte: new Date(),
        },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get member role in organization
   */
  static async getMemberRole(
    organizationId: string,
    userId: string
  ): Promise<OrganizationRole | null> {
    const member = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    return member?.role || null;
  }

  /**
   * Check if user has permission
   */
  static async hasPermission(
    organizationId: string,
    userId: string,
    requiredRole: OrganizationRole
  ): Promise<boolean> {
    const role = await this.getMemberRole(organizationId, userId);
    
    if (!role) return false;

    // Permission hierarchy: OWNER > ADMIN > EDITOR > VIEWER
    const roleHierarchy = {
      [OrganizationRole.OWNER]: 4,
      [OrganizationRole.ADMIN]: 3,
      [OrganizationRole.EDITOR]: 2,
      [OrganizationRole.VIEWER]: 1,
    };

    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  }

  /**
   * Transfer organization ownership
   */
  static async transferOwnership(
    organizationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ) {
    // Verify current owner
    const org = await db.organization.findUnique({
      where: { id: organizationId },
    });

    if (org?.ownerId !== currentOwnerId) {
      throw new Error('Only the current owner can transfer ownership');
    }

    // Verify new owner is a member
    const newOwnerMember = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: newOwnerId,
        },
      },
    });

    if (!newOwnerMember) {
      throw new Error('New owner must be a member of the organization');
    }

    // Update organization owner
    await db.organization.update({
      where: { id: organizationId },
      data: {
        ownerId: newOwnerId,
      },
    });

    // Update new owner role to OWNER
    await db.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId: newOwnerId,
        },
      },
      data: {
        role: OrganizationRole.OWNER,
      },
    });

    // Downgrade previous owner to ADMIN
    await db.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentOwnerId,
        },
      },
      data: {
        role: OrganizationRole.ADMIN,
      },
    });

    return await this.getOrganization(organizationId);
  }

  /**
   * Get all members of an organization
   */
  static async getOrganizationMembers(organizationId: string) {
    return db.organizationMember.findMany({
      where: {
        organizationId,
      },
      include: {
        User_OrganizationMember_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, etc.
        { joinedAt: 'asc' },
      ],
    });
  }

  /**
   * Get a specific organization member
   */
  static async getOrganizationMember(organizationId: string, userId: string) {
    return db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        User_OrganizationMember_userIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }

  /**
   * Check if user is a member of an organization
   */
  static async isOrganizationMember(
    organizationId: string,
    userId: string
  ): Promise<boolean> {
    const member = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return !!member;
  }

  /**
   * Update organization member role
   */
  static async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: OrganizationRole,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _updatedBy: string
  ) {
    // Get the member to update
    const member = await db.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Cannot change owner role through this method
    if (member.role === OrganizationRole.OWNER) {
      throw new Error('Cannot change owner role. Use transferOwnership instead.');
    }

    // Update the role
    return db.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });
  }

  /**
   * Remove a member from an organization
   */
  static async removeMember(
    organizationId: string,
    memberId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _removedBy: string
  ) {
    // Get the member to remove
    const member = await db.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Cannot remove owner
    if (member.role === OrganizationRole.OWNER) {
      throw new Error('Cannot remove organization owner');
    }

    // Delete the member
    return db.organizationMember.delete({
      where: { id: memberId },
    });
  }
}
