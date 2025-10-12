// Real-time collaboration service for CodeMind
// Handles Supabase Realtime connections for chat sessions

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from './supabase';
import { logger } from './logger';
import {
  type RealtimeEvents,
  type RealtimeConfig,
  type MessageBroadcast,
  type TypingIndicator,
  type SessionParticipant,
  type ChatUserPresence,
  DEFAULT_REALTIME_CONFIG,
  createUserPresence,
  createTypingIndicator,
  MessageBroadcastSchema,
  TypingIndicatorSchema,
  SessionParticipantSchema,
  ChatUserPresenceSchema,
} from '../../types/realtime';

/**
 * Real-time collaboration manager for chat sessions
 */
export class RealtimeCollaboration {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private config: RealtimeConfig;
  private sessionId: string;
  private userId: string;
  private userName?: string;
  private userImage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private eventListeners: Map<keyof RealtimeEvents, any[]> = new Map();
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
  private typingTimer: NodeJS.Timeout | null = null;
  private presenceTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    sessionId: string,
    userId: string,
    userName?: string,
    userImage?: string,
    config: Partial<RealtimeConfig> = {}
  ) {
    this.supabase = createBrowserClient();
    this.sessionId = sessionId;
    this.userId = userId;
    this.userName = userName;
    this.userImage = userImage;
    this.config = { ...DEFAULT_REALTIME_CONFIG, ...config };

    // Initialize event listener maps
    Object.keys({} as RealtimeEvents).forEach(event => {
      this.eventListeners.set(event as keyof RealtimeEvents, []);
    });
  }

  /**
   * Connect to the realtime channel for the session
   */
  async connect(): Promise<void> {
    if (this.channel) {
      logger.warn('Already connected to realtime channel', { sessionId: this.sessionId });
      return;
    }

    try {
      this.connectionStatus = 'connecting';
      this.emit('connection:status', 'connecting');

      // Create the channel
      this.channel = this.supabase.channel(`chat-session-${this.sessionId}`, {
        config: {
          presence: { key: this.userId },
          broadcast: { self: true },
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Subscribe to the channel
      const status = await this.channel.subscribe((status) => {
        logger.info('Realtime subscription status', { 
          sessionId: this.sessionId, 
          status 
        });

        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          this.emit('connection:status', 'connected');
          this.startPresenceHeartbeat();
          
          // Send initial presence
          this.updatePresence();
        } else if (status === 'CHANNEL_ERROR') {
          this.connectionStatus = 'error';
          this.emit('connection:status', 'error');
          this.handleReconnect();
        } else if (status === 'TIMED_OUT') {
          this.connectionStatus = 'disconnected';
          this.emit('connection:status', 'disconnected');
          this.handleReconnect();
        }
      });

      logger.info('Connected to realtime collaboration', {
        sessionId: this.sessionId,
        userId: this.userId,
        status,
      });

    } catch (error) {
      logger.error('Failed to connect to realtime collaboration', {
        sessionId: this.sessionId,
        userId: this.userId,
      }, error as Error);

      this.connectionStatus = 'error';
      this.emit('connection:status', 'error');
      this.handleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from the realtime channel
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }

    if (this.channel) {
      // Send user left event
      await this.broadcastUserLeft();
      
      // Unsubscribe from the channel
      await this.channel.unsubscribe();
      this.channel = null;
    }

    this.connectionStatus = 'disconnected';
    this.emit('connection:status', 'disconnected');

    logger.info('Disconnected from realtime collaboration', {
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  /**
   * Set up event handlers for the channel
   */
  private setupEventHandlers(): void {
    if (!this.channel) return;

    // Handle message broadcasts
    this.channel.on('broadcast', { event: 'message' }, (payload) => {
      try {
        const message = MessageBroadcastSchema.parse(payload.payload);
        if (message.userId !== this.userId) { // Don't emit our own messages
          this.emit('message:created', message);
        }
      } catch (error) {
        logger.error('Invalid message broadcast payload', {}, error as Error);
      }
    });

    // Handle typing indicators
    this.channel.on('broadcast', { event: 'typing' }, (payload) => {
      try {
        const typing = TypingIndicatorSchema.parse(payload.payload);
        if (typing.userId !== this.userId) { // Don't emit our own typing
          if (typing.isTyping) {
            this.emit('user:typing:start', typing);
          } else {
            this.emit('user:typing:stop', typing);
          }
        }
      } catch (error) {
        logger.error('Invalid typing indicator payload', {}, error as Error);
      }
    });

    // Handle user join/leave
    this.channel.on('broadcast', { event: 'user_joined' }, (payload) => {
      try {
        const participant = SessionParticipantSchema.parse(payload.payload);
        if (participant.userId !== this.userId) {
          this.emit('user:joined', participant);
        }
      } catch (error) {
        logger.error('Invalid user joined payload', {}, error as Error);
      }
    });

    this.channel.on('broadcast', { event: 'user_left' }, (payload) => {
      const { userId } = payload.payload as { userId: string };
      if (userId !== this.userId) {
        this.emit('user:left', userId);
      }
    });

    // Handle presence changes
    this.channel.on('presence', { event: 'sync' }, () => {
      const presenceState = this.channel?.presenceState();
      if (presenceState) {
        const presence: ChatUserPresence[] = [];
        
        Object.entries(presenceState).forEach(([userId, presences]) => {
          if (presences && presences.length > 0) {
            try {
              const userPresence = ChatUserPresenceSchema.parse(presences[0]);
              presence.push(userPresence);
            } catch (error) {
              logger.error('Invalid presence data', { userId }, error as Error);
            }
          }
        });

        this.emit('presence:sync', presence);
      }
    });

    this.channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach((presence) => {
        try {
          const userPresence = ChatUserPresenceSchema.parse(presence);
          if (userPresence.userId !== this.userId) {
            logger.info('User joined session', {
              sessionId: this.sessionId,
              userId: userPresence.userId,
            });
          }
        } catch (error) {
          logger.error('Invalid presence join data', {}, error as Error);
        }
      });
    });

    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach((presence) => {
        try {
          const userPresence = ChatUserPresenceSchema.parse(presence);
          if (userPresence.userId !== this.userId) {
            logger.info('User left session', {
              sessionId: this.sessionId,
              userId: userPresence.userId,
            });
          }
        } catch (error) {
          logger.error('Invalid presence leave data', {}, error as Error);
        }
      });
    });
  }

  /**
   * Broadcast a new message to all participants
   */
  async broadcastMessage(message: Omit<MessageBroadcast, 'sessionId'>): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') {
      logger.warn('Cannot broadcast message: not connected', { sessionId: this.sessionId });
      return;
    }

    const messagePayload: MessageBroadcast = {
      ...message,
      sessionId: this.sessionId,
    };

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'message',
        payload: messagePayload,
      });

      logger.debug('Message broadcasted', {
        sessionId: this.sessionId,
        messageId: message.messageId,
      });
    } catch (error) {
      logger.error('Failed to broadcast message', {
        sessionId: this.sessionId,
        messageId: message.messageId,
      }, error as Error);
    }
  }

  /**
   * Start typing indicator
   */
  async startTyping(): Promise<void> {
    if (!this.config.enableTypingIndicators) return;

    const typing = createTypingIndicator(
      this.sessionId,
      this.userId,
      this.userName,
      true
    );

    await this.broadcastTyping(typing);

    // Clear existing timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    // Auto-stop typing after timeout
    this.typingTimer = setTimeout(() => {
      this.stopTyping();
    }, this.config.typingTimeout);
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(): Promise<void> {
    if (!this.config.enableTypingIndicators) return;

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    const typing = createTypingIndicator(
      this.sessionId,
      this.userId,
      this.userName,
      false
    );

    await this.broadcastTyping(typing);
  }

  /**
   * Broadcast typing indicator
   */
  private async broadcastTyping(typing: TypingIndicator): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: typing,
      });
    } catch (error) {
      logger.error('Failed to broadcast typing indicator', {
        sessionId: this.sessionId,
        userId: this.userId,
      }, error as Error);
    }
  }

  /**
   * Update user presence
   */
  async updatePresence(status: ChatUserPresence['status'] = 'online'): Promise<void> {
    if (!this.config.enablePresence || !this.channel) return;

    const presence = createUserPresence(
      this.userId,
      this.userName,
      this.userImage,
      status
    );

    try {
      await this.channel.track(presence);
    } catch (error) {
      logger.error('Failed to update presence', {
        sessionId: this.sessionId,
        userId: this.userId,
      }, error as Error);
    }
  }

  /**
   * Broadcast user joined event
   */
  async broadcastUserJoined(participant: SessionParticipant): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'user_joined',
        payload: participant,
      });
    } catch (error) {
      logger.error('Failed to broadcast user joined', {
        sessionId: this.sessionId,
        userId: participant.userId,
      }, error as Error);
    }
  }

  /**
   * Broadcast user left event
   */
  private async broadcastUserLeft(): Promise<void> {
    if (!this.channel) return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'user_left',
        payload: { userId: this.userId },
      });
    } catch (error) {
      logger.error('Failed to broadcast user left', {
        sessionId: this.sessionId,
        userId: this.userId,
      }, error as Error);
    }
  }

  /**
   * Start presence heartbeat
   */
  private startPresenceHeartbeat(): void {
    if (!this.config.enablePresence) return;

    this.presenceTimer = setInterval(() => {
      this.updatePresence();
    }, this.config.presenceHeartbeat);
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', {
        sessionId: this.sessionId,
        attempts: this.reconnectAttempts,
      });
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info('Attempting to reconnect', {
      sessionId: this.sessionId,
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.disconnect();
        await this.connect();
      } catch (error) {
        logger.error('Reconnection failed', {
          sessionId: this.sessionId,
          attempt: this.reconnectAttempts,
        }, error as Error);
      }
    }, delay);
  }

  /**
   * Add event listener
   */
  on<K extends keyof RealtimeEvents>(event: K, listener: RealtimeEvents[K]): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof RealtimeEvents>(event: K, listener: RealtimeEvents[K]): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof RealtimeEvents>(event: K, ...args: Parameters<RealtimeEvents[K]>): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        logger.error('Error in event listener', { event }, error as Error);
      }
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    return this.connectionStatus;
  }

  /**
   * Get current presence state
   */
  getPresenceState(): Record<string, ChatUserPresence[]> {
    return this.channel?.presenceState() || {};
  }

  /**
   * Get session configuration
   */
  getConfig(): RealtimeConfig {
    return { ...this.config };
  }
}

// Export convenience functions
export const createRealtimeCollaboration = (
  sessionId: string,
  userId: string,
  userName?: string,
  userImage?: string,
  config?: Partial<RealtimeConfig>
): RealtimeCollaboration => {
  return new RealtimeCollaboration(sessionId, userId, userName, userImage, config);
};

export default RealtimeCollaboration;