import { db } from './db'
import { randomBytes } from 'crypto'
import { InvitationStatus, ProjectRole } from '@prisma/client'

export interface CreateInvitationParams {
  projectId: string
  email: string
  role: ProjectRole
  invitedBy: string
  expiresInDays?: number
}

export interface AcceptInvitationParams {
  token: string
  userId: string
}

export class InvitationService {
  /**
   * Create a new project invitation
   */
  static async createInvitation({
    projectId,
    email,
    role,
    invitedBy,
    expiresInDays = 7,
  }: CreateInvitationParams) {
    // Check if invitation already exists for this email and project
    const existingInvitation = await db.projectInvitation.findFirst({
      where: {
        projectId,
        email: email.toLowerCase(),
        status: InvitationStatus.PENDING,
      },
    })

    if (existingInvitation) {
      throw new Error('An invitation already exists for this email')
    }

    // Check if user is already a member
    const existingMember = await db.projectMember.findFirst({
      where: {
        projectId,
        User: {
          email: email.toLowerCase(),
        },
      },
    })

    if (existingMember) {
      throw new Error('This user is already a member of the project')
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const invitation = await db.projectInvitation.create({
      data: {
        projectId,
        email: email.toLowerCase(),
        role,
        token,
        expiresAt,
        invitedBy,
        status: InvitationStatus.PENDING,
      },
    })

    return invitation
  }

  /**
   * Get invitation by token
   */
  static async getInvitationByToken(token: string) {
    const invitation = await db.projectInvitation.findUnique({
      where: { token },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!invitation) {
      throw new Error('Invitation not found')
    }

    // Check if expired
    if (invitation.expiresAt < new Date() && invitation.status === InvitationStatus.PENDING) {
      await db.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      })
      throw new Error('Invitation has expired')
    }

    return invitation
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation({ token, userId }: AcceptInvitationParams) {
    const invitation = await this.getInvitationByToken(token)

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error(`Invitation is ${invitation.status.toLowerCase()}`)
    }

    // Check if user's email matches invitation email
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user || user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('This invitation is for a different email address')
    }

    // Check if already a member
    const existingMember = await db.projectMember.findFirst({
      where: {
        projectId: invitation.projectId,
        userId,
      },
    })

    if (existingMember) {
      // Update invitation status even if already member
      await db.projectInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      })
      throw new Error('You are already a member of this project')
    }

    // Add user as project member and update invitation
    await db.$transaction([
      db.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: invitation.role,
          addedBy: invitation.invitedBy,
        },
      }),
      db.projectInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      }),
    ])

    return { success: true, projectId: invitation.projectId, role: invitation.role }
  }

  /**
   * Revoke an invitation
   */
  static async revokeInvitation(invitationId: string, userId: string) {
    const invitation = await db.projectInvitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      throw new Error('Invitation not found')
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Only pending invitations can be revoked')
    }

    // Check if user has permission to revoke (must be the inviter or project owner)
    const projectMember = await db.projectMember.findFirst({
      where: {
        projectId: invitation.projectId,
        userId,
        role: { in: [ProjectRole.OWNER, ProjectRole.EDITOR] },
      },
    })

    if (!projectMember && invitation.invitedBy !== userId) {
      throw new Error('You do not have permission to revoke this invitation')
    }

    await db.projectInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    })

    return { success: true }
  }

  /**
   * Get all pending invitations for a project
   */
  static async getProjectInvitations(projectId: string) {
    const invitations = await db.projectInvitation.findMany({
      where: {
        projectId,
        status: InvitationStatus.PENDING,
        expiresAt: { gte: new Date() },
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
      orderBy: { createdAt: 'desc' },
    })

    return invitations
  }

  /**
   * Get all invitations for a user (by email)
   */
  static async getUserInvitations(email: string) {
    const invitations = await db.projectInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        status: InvitationStatus.PENDING,
        expiresAt: { gte: new Date() },
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
      orderBy: { createdAt: 'desc' },
    })

    return invitations
  }

  /**
   * Resend an invitation (creates a new token)
   */
  static async resendInvitation(invitationId: string, expiresInDays = 7) {
    const invitation = await db.projectInvitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      throw new Error('Invitation not found')
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Only pending invitations can be resent')
    }

    const newToken = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const updatedInvitation = await db.projectInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt,
      },
    })

    return updatedInvitation
  }

  /**
   * Clean up expired invitations
   */
  static async cleanupExpiredInvitations() {
    const result = await db.projectInvitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    })

    return { count: result.count }
  }

  /**
   * Get invitation statistics for a project
   */
  static async getInvitationStats(projectId: string) {
    const [pending, accepted, expired, revoked] = await Promise.all([
      db.projectInvitation.count({
        where: { projectId, status: InvitationStatus.PENDING },
      }),
      db.projectInvitation.count({
        where: { projectId, status: InvitationStatus.ACCEPTED },
      }),
      db.projectInvitation.count({
        where: { projectId, status: InvitationStatus.EXPIRED },
      }),
      db.projectInvitation.count({
        where: { projectId, status: InvitationStatus.REVOKED },
      }),
    ])

    return {
      pending,
      accepted,
      expired,
      revoked,
      total: pending + accepted + expired + revoked,
    }
  }
}
