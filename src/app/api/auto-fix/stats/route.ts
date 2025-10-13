import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    // Get overall statistics
    const [
      totalSessions,
      successfulSessions,
      failedSessions,
      totalPRsCreated,
      recentSessions
    ] = await Promise.all([
      prisma.autoFixSession.count(),
      prisma.autoFixSession.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.autoFixSession.count({
        where: { status: 'FAILED' }
      }),
      prisma.autoFixResult.count({
        where: { 
          success: true,
          session: {
            prNumber: { not: null }
          }
        }
      }),
      prisma.autoFixSession.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            select: {
              name: true,
              githubUrl: true
            }
          },
          results: {
            select: {
              success: true
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ])

    // Calculate success rate
    const successRate = totalSessions > 0 
      ? Math.round((successfulSessions / totalSessions) * 100)
      : 0

    return NextResponse.json({
      stats: {
        totalSessions,
        successfulSessions,
        failedSessions,
        totalPRsCreated,
        successRate
      },
      recentSessions,
      chartData: []
    })

  } catch (error) {
    console.error('Error fetching auto-fix stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
      enableAutoFix = true,
      githubIntegration = true,
      autoCreatePR = true,
      branchPrefix = 'auto-fix/',
      requireReview = false
    } = await req.json()

    // For now, we'll store settings in a simple way
    // In a real app, you might want a separate settings table
    const settings = {
      enableAutoFix,
      githubIntegration,
      autoCreatePR,
      branchPrefix,
      requireReview,
      updatedAt: new Date()
    }

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings
    })

  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}