// Real-time collaboration types for CodeMind
import { z } from 'zod';

// Presence types for active users in chat sessions
export const ChatUserPresenceSchema = z.object({
  userId: z.string(),
  userName: z.string().optional(),
  userImage: z.string().optional(),
  isTyping: z.boolean().default(false),
  lastSeen: z.string().datetime(),
  status: z.enum(['online', 'away', 'busy']).default('online'),
});

export type ChatUserPresence = z.infer<typeof ChatUserPresenceSchema>;

// Real-time message events
export const RealtimeMessageEventSchema = z.object({
  type: z.enum([
    'message_created',
    'user_typing_start',
    'user_typing_stop',
    'user_joined',
    'user_left',
    'session_updated'
  ]),
  sessionId: z.string(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type RealtimeMessageEvent = z.infer<typeof RealtimeMessageEventSchema>;

// Typing indicator
export const TypingIndicatorSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  userName: z.string().optional(),
  isTyping: z.boolean(),
  timestamp: z.string().datetime(),
});

export type TypingIndicator = z.infer<typeof TypingIndicatorSchema>;

// Message broadcast payload
export const MessageBroadcastSchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  userId: z.string(),
  userName: z.string().optional(),
  createdAt: z.string().datetime(),
  tokenCount: z.number().optional(),
  latencyMs: z.number().optional(),
});

export type MessageBroadcast = z.infer<typeof MessageBroadcastSchema>;

// Session participant
export const SessionParticipantSchema = z.object({
  userId: z.string(),
  userName: z.string().optional(),
  userImage: z.string().optional(),
  role: z.enum(['owner', 'collaborator', 'viewer']).default('viewer'),
  joinedAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  permissions: z.object({
    canSendMessages: z.boolean().default(true),
    canViewHistory: z.boolean().default(true),
    canManageSession: z.boolean().default(false),
  }).default({
    canSendMessages: true,
    canViewHistory: true,
    canManageSession: false,
  }),
});

export type SessionParticipant = z.infer<typeof SessionParticipantSchema>;

// Realtime session state
export const RealtimeSessionStateSchema = z.object({
  sessionId: z.string(),
  participants: z.array(SessionParticipantSchema),
  activeUsers: z.array(ChatUserPresenceSchema),
  typingUsers: z.array(TypingIndicatorSchema),
  lastActivity: z.string().datetime(),
  messageCount: z.number().default(0),
});

export type RealtimeSessionState = z.infer<typeof RealtimeSessionStateSchema>;

// Realtime configuration
export const RealtimeConfigSchema = z.object({
  enablePresence: z.boolean().default(true),
  enableTypingIndicators: z.boolean().default(true),
  enableMessageSync: z.boolean().default(true),
  maxParticipants: z.number().default(10),
  typingTimeout: z.number().default(3000), // ms
  presenceHeartbeat: z.number().default(30000), // ms
  reconnectDelay: z.number().default(1000), // ms
  maxReconnectAttempts: z.number().default(5),
});

export type RealtimeConfig = z.infer<typeof RealtimeConfigSchema>;

// Collaboration permissions
export const CollaborationPermissionsSchema = z.object({
  canSendMessages: z.boolean().default(true),
  canViewHistory: z.boolean().default(true),
  canInviteUsers: z.boolean().default(false),
  canManagePermissions: z.boolean().default(false),
  canDeleteMessages: z.boolean().default(false),
  canExportChat: z.boolean().default(true),
});

export type CollaborationPermissions = z.infer<typeof CollaborationPermissionsSchema>;

// Realtime events for the client
export interface RealtimeEvents {
  'message:created': (message: MessageBroadcast) => void;
  'user:joined': (user: SessionParticipant) => void;
  'user:left': (userId: string) => void;
  'user:typing:start': (typing: TypingIndicator) => void;
  'user:typing:stop': (typing: TypingIndicator) => void;
  'presence:sync': (presence: ChatUserPresence[]) => void;
  'session:updated': (session: Partial<RealtimeSessionState>) => void;
  'connection:status': (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
}

// Export default config
export const DEFAULT_REALTIME_CONFIG: RealtimeConfig = {
  enablePresence: true,
  enableTypingIndicators: true,
  enableMessageSync: true,
  maxParticipants: 10,
  typingTimeout: 3000,
  presenceHeartbeat: 30000,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
};

// Helper function to create session participant
export const createSessionParticipant = (
  userId: string,
  userName?: string,
  userImage?: string,
  role: SessionParticipant['role'] = 'viewer'
): SessionParticipant => {
  const now = new Date().toISOString();
  return {
    userId,
    userName,
    userImage,
    role,
    joinedAt: now,
    lastActiveAt: now,
    permissions: {
      canSendMessages: role !== 'viewer',
      canViewHistory: true,
      canManageSession: role === 'owner',
    },
  };
};

// Helper function to create typing indicator
export const createTypingIndicator = (
  sessionId: string,
  userId: string,
  userName?: string,
  isTyping: boolean = true
): TypingIndicator => ({
  sessionId,
  userId,
  userName,
  isTyping,
  timestamp: new Date().toISOString(),
});

// Helper function to create presence
export const createUserPresence = (
  userId: string,
  userName?: string,
  userImage?: string,
  status: ChatUserPresence['status'] = 'online'
): ChatUserPresence => ({
  userId,
  userName,
  userImage,
  isTyping: false,
  lastSeen: new Date().toISOString(),
  status,
});