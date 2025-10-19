/**
 * Activity Logger Utility
 * 
 * Helper functions to log AI activity events throughout the application.
 * Use these functions to track indexing, APR sessions, chat, auto-fixes, etc.
 */

type ActivityEventType =
  | 'INDEXING_STARTED'
  | 'INDEXING_PROGRESS'
  | 'INDEXING_COMPLETED'
  | 'INDEXING_FAILED'
  | 'APR_SESSION_CREATED'
  | 'APR_ANALYZING'
  | 'APR_CODE_GENERATION'
  | 'APR_VALIDATION'
  | 'APR_REVIEW'
  | 'APR_PR_CREATED'
  | 'APR_COMPLETED'
  | 'APR_FAILED'
  | 'CHAT_MESSAGE_SENT'
  | 'CHAT_MESSAGE_RECEIVED'
  | 'AUTO_FIX_STARTED'
  | 'AUTO_FIX_COMPLETED'
  | 'AUTO_FIX_FAILED'
  | 'CODE_SCAFFOLDING'
  | 'TEST_GENERATION';

type ActivityEventStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface LogActivityParams {
  projectId: string;
  eventType: ActivityEventType;
  entityType: string;
  entityId?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status?: ActivityEventStatus;
  duration?: number;
}

interface UpdateActivityParams {
  eventId: string;
  status?: ActivityEventStatus;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log a new activity event
 */
export async function logActivity(params: LogActivityParams): Promise<string | null> {
  try {
    const response = await fetch('/api/activity/feed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[Activity Logger] Failed to log activity:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.event.id;
  } catch (error) {
    console.error('[Activity Logger] Error logging activity:', error);
    return null;
  }
}

/**
 * Update an existing activity event (e.g., mark as completed)
 */
export async function updateActivity(params: UpdateActivityParams): Promise<boolean> {
  try {
    const response = await fetch('/api/activity/feed', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[Activity Logger] Failed to update activity:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Activity Logger] Error updating activity:', error);
    return false;
  }
}

/**
 * Convenience function for tracking APR session phases
 */
export async function logAPRPhase(
  projectId: string,
  sessionId: string,
  phase: 'CREATED' | 'ANALYZING' | 'CODE_GENERATION' | 'VALIDATION' | 'REVIEW' | 'PR_CREATED' | 'COMPLETED' | 'FAILED',
  title: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const eventTypeMap = {
    CREATED: 'APR_SESSION_CREATED',
    ANALYZING: 'APR_ANALYZING',
    CODE_GENERATION: 'APR_CODE_GENERATION',
    VALIDATION: 'APR_VALIDATION',
    REVIEW: 'APR_REVIEW',
    PR_CREATED: 'APR_PR_CREATED',
    COMPLETED: 'APR_COMPLETED',
    FAILED: 'APR_FAILED',
  } as const;

  const statusMap = {
    CREATED: 'IN_PROGRESS',
    ANALYZING: 'IN_PROGRESS',
    CODE_GENERATION: 'IN_PROGRESS',
    VALIDATION: 'IN_PROGRESS',
    REVIEW: 'IN_PROGRESS',
    PR_CREATED: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  } as const;

  return logActivity({
    projectId,
    eventType: eventTypeMap[phase] as ActivityEventType,
    entityType: 'apr_session',
    entityId: sessionId,
    title,
    metadata,
    status: statusMap[phase] as ActivityEventStatus,
  });
}

/**
 * Convenience function for tracking indexing jobs
 */
export async function logIndexingEvent(
  projectId: string,
  jobId: string,
  phase: 'STARTED' | 'PROGRESS' | 'COMPLETED' | 'FAILED',
  title: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const eventTypeMap = {
    STARTED: 'INDEXING_STARTED',
    PROGRESS: 'INDEXING_PROGRESS',
    COMPLETED: 'INDEXING_COMPLETED',
    FAILED: 'INDEXING_FAILED',
  } as const;

  const statusMap = {
    STARTED: 'IN_PROGRESS',
    PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  } as const;

  return logActivity({
    projectId,
    eventType: eventTypeMap[phase] as ActivityEventType,
    entityType: 'indexing',
    entityId: jobId,
    title,
    metadata,
    status: statusMap[phase] as ActivityEventStatus,
  });
}

/**
 * Convenience function for tracking chat interactions
 */
export async function logChatMessage(
  projectId: string,
  sessionId: string,
  messageId: string,
  direction: 'SENT' | 'RECEIVED',
  title: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return logActivity({
    projectId,
    eventType: direction === 'SENT' ? 'CHAT_MESSAGE_SENT' : 'CHAT_MESSAGE_RECEIVED',
    entityType: 'chat_message',
    entityId: messageId,
    title,
    metadata: {
      ...metadata,
      sessionId,
    },
    status: 'COMPLETED',
  });
}

/**
 * Convenience function for tracking auto-fix operations
 */
export async function logAutoFix(
  projectId: string,
  sessionId: string,
  phase: 'STARTED' | 'COMPLETED' | 'FAILED',
  title: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const eventTypeMap = {
    STARTED: 'AUTO_FIX_STARTED',
    COMPLETED: 'AUTO_FIX_COMPLETED',
    FAILED: 'AUTO_FIX_FAILED',
  } as const;

  const statusMap = {
    STARTED: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  } as const;

  return logActivity({
    projectId,
    eventType: eventTypeMap[phase] as ActivityEventType,
    entityType: 'auto_fix',
    entityId: sessionId,
    title,
    metadata,
    status: statusMap[phase] as ActivityEventStatus,
  });
}
