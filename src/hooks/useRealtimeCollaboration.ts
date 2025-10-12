// React hooks for real-time collaboration in CodeMind
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../app/contexts/AuthContext';
import { logger } from '../app/lib/logger';
import { RealtimeCollaboration } from '../app/lib/realtime-collaboration';
import {
  type RealtimeConfig,
  type MessageBroadcast,
  type TypingIndicator,
  type SessionParticipant,
  type ChatUserPresence,
  createSessionParticipant,
} from '../types/realtime';

interface UseRealtimeCollaborationOptions {
  sessionId: string;
  config?: Partial<RealtimeConfig>;
  autoConnect?: boolean;
}

interface UseRealtimeCollaborationReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  // Participants and presence
  participants: SessionParticipant[];
  activeUsers: ChatUserPresence[];
  typingUsers: TypingIndicator[];
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: Omit<MessageBroadcast, 'sessionId' | 'userId' | 'userName'>) => Promise<void>;
  startTyping: () => Promise<void>;
  stopTyping: () => Promise<void>;
  updatePresence: (status?: ChatUserPresence['status']) => Promise<void>;
  
  // Event handlers
  onMessage: (handler: (message: MessageBroadcast) => void) => () => void;
  onUserJoined: (handler: (user: SessionParticipant) => void) => () => void;
  onUserLeft: (handler: (userId: string) => void) => () => void;
  onTypingStart: (handler: (typing: TypingIndicator) => void) => () => void;
  onTypingStop: (handler: (typing: TypingIndicator) => void) => () => void;
  onPresenceSync: (handler: (presence: ChatUserPresence[]) => void) => () => void;
}

/**
 * Hook for real-time collaboration in chat sessions
 */
export const useRealtimeCollaboration = ({
  sessionId,
  config,
  autoConnect = true,
}: UseRealtimeCollaborationOptions): UseRealtimeCollaborationReturn => {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [activeUsers, setActiveUsers] = useState<ChatUserPresence[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  
  const collaborationRef = useRef<RealtimeCollaboration | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Initialize collaboration service
  useEffect(() => {
    if (!user?.id || !sessionId) return;

    logger.info('Initializing realtime collaboration', {
      sessionId,
      userId: user.id,
      userName: user.user_metadata?.name,
    });

    const collaboration = new RealtimeCollaboration(
      sessionId,
      user.id,
      user.user_metadata?.name || undefined,
      user.user_metadata?.avatar_url || undefined,
      config
    );

    // Set up event listeners
    const handleConnectionStatus = (status: typeof connectionStatus) => {
      setConnectionStatus(status);
    };

    const handleMessage = (message: MessageBroadcast) => {
      logger.debug('Received realtime message', {
        sessionId,
        messageId: message.messageId,
        fromUser: message.userId,
      });
    };

    const handleUserJoined = (participant: SessionParticipant) => {
      setParticipants(prev => {
        // Check if user already exists
        const existingIndex = prev.findIndex(p => p.userId === participant.userId);
        if (existingIndex >= 0) {
          // Update existing participant
          const updated = [...prev];
          updated[existingIndex] = participant;
          return updated;
        }
        // Add new participant
        return [...prev, participant];
      });

      logger.info('User joined session', {
        sessionId,
        userId: participant.userId,
        userName: participant.userName,
      });
    };

    const handleUserLeft = (userId: string) => {
      setParticipants(prev => prev.filter(p => p.userId !== userId));
      setTypingUsers(prev => prev.filter(t => t.userId !== userId));

      logger.info('User left session', {
        sessionId,
        userId,
      });
    };

    const handleTypingStart = (typing: TypingIndicator) => {
      setTypingUsers(prev => {
        // Remove existing typing indicator for this user
        const filtered = prev.filter(t => t.userId !== typing.userId);
        // Add new typing indicator
        return [...filtered, typing];
      });
    };

    const handleTypingStop = (typing: TypingIndicator) => {
      setTypingUsers(prev => prev.filter(t => t.userId !== typing.userId));
    };

    const handlePresenceSync = (presence: ChatUserPresence[]) => {
      setActiveUsers(presence);
    };

    // Register event listeners
    collaboration.on('connection:status', handleConnectionStatus);
    collaboration.on('message:created', handleMessage);
    collaboration.on('user:joined', handleUserJoined);
    collaboration.on('user:left', handleUserLeft);
    collaboration.on('user:typing:start', handleTypingStart);
    collaboration.on('user:typing:stop', handleTypingStop);
    collaboration.on('presence:sync', handlePresenceSync);

    collaborationRef.current = collaboration;

    // Auto-connect if enabled
    if (autoConnect) {
      collaboration.connect().catch((error: unknown) => {
        logger.error('Failed to auto-connect to realtime collaboration', {
          sessionId,
          userId: user.id,
        }, error as Error);
      });
    }

    // Cleanup function
    return () => {
      logger.info('Cleaning up realtime collaboration', { sessionId, userId: user.id });
      
      // Disconnect and cleanup
      collaboration.disconnect().catch((error: unknown) => {
        logger.error('Error during collaboration cleanup', { sessionId }, error as Error);
      });
      
      // Run any registered cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, [user?.id, user?.user_metadata?.name, user?.user_metadata?.avatar_url, sessionId, autoConnect, config]);

  // Add current user as participant when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && user?.id && user?.user_metadata?.name) {
      const currentUserParticipant = createSessionParticipant(
        user.id,
        user.user_metadata.name,
        user.user_metadata?.avatar_url || undefined,
        'owner' // Assume current user is owner for now
      );

      // Add to participants if not already present
      setParticipants(prev => {
        const existingIndex = prev.findIndex(p => p.userId === user.id);
        if (existingIndex >= 0) {
          return prev;
        }
        return [...prev, currentUserParticipant];
      });

      // Broadcast that we joined
      collaborationRef.current?.broadcastUserJoined(currentUserParticipant);
    }
  }, [connectionStatus, user?.id, user?.user_metadata?.name, user?.user_metadata?.avatar_url]);

  // Action functions
  const connect = useCallback(async () => {
    if (!collaborationRef.current) return;
    
    try {
      await collaborationRef.current.connect();
    } catch (error) {
      logger.error('Failed to connect to realtime collaboration', { sessionId }, error as Error);
      throw error;
    }
  }, [sessionId]);

  const disconnect = useCallback(async () => {
    if (!collaborationRef.current) return;
    
    try {
      await collaborationRef.current.disconnect();
    } catch (error) {
      logger.error('Failed to disconnect from realtime collaboration', { sessionId }, error as Error);
      throw error;
    }
  }, [sessionId]);

  const sendMessage = useCallback(async (message: Omit<MessageBroadcast, 'sessionId' | 'userId' | 'userName'>) => {
    if (!collaborationRef.current || !user?.id) return;

    const fullMessage: Omit<MessageBroadcast, 'sessionId'> = {
      ...message,
      userId: user.id,
      userName: user.user_metadata?.name || undefined,
    };

    try {
      await collaborationRef.current.broadcastMessage(fullMessage);
    } catch (error) {
      logger.error('Failed to send message', {
        sessionId,
        messageId: message.messageId,
      }, error as Error);
      throw error;
    }
  }, [sessionId, user?.id, user?.user_metadata?.name]);

  const startTyping = useCallback(async () => {
    if (!collaborationRef.current) return;
    
    try {
      await collaborationRef.current.startTyping();
    } catch (error) {
      logger.error('Failed to start typing indicator', { sessionId }, error as Error);
    }
  }, [sessionId]);

  const stopTyping = useCallback(async () => {
    if (!collaborationRef.current) return;
    
    try {
      await collaborationRef.current.stopTyping();
    } catch (error) {
      logger.error('Failed to stop typing indicator', { sessionId }, error as Error);
    }
  }, [sessionId]);

  const updatePresence = useCallback(async (status: ChatUserPresence['status'] = 'online') => {
    if (!collaborationRef.current) return;
    
    try {
      await collaborationRef.current.updatePresence(status);
    } catch (error) {
      logger.error('Failed to update presence', { sessionId, status }, error as Error);
    }
  }, [sessionId]);

  // Event handler registration functions
  const onMessage = useCallback((handler: (message: MessageBroadcast) => void) => {
    if (!collaborationRef.current) return () => {};
    
    collaborationRef.current.on('message:created', handler);
    
    const cleanup = () => {
      collaborationRef.current?.off('message:created', handler);
    };
    
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onUserJoined = useCallback((handler: (user: SessionParticipant) => void) => {
    if (!collaborationRef.current) return () => {};
    
    collaborationRef.current.on('user:joined', handler);
    
    const cleanup = () => {
      collaborationRef.current?.off('user:joined', handler);
    };
    
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onUserLeft = useCallback((handler: (userId: string) => void) => {
    if (!collaborationRef.current) return () => {};
    
    collaborationRef.current.on('user:left', handler);
    
    const cleanup = () => {
      collaborationRef.current?.off('user:left', handler);
    };
    
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onTypingStart = useCallback((handler: (typing: TypingIndicator) => void) => {
    if (!collaborationRef.current) return () => {};
    
    collaborationRef.current.on('user:typing:start', handler);
    
    const cleanup = () => {
      collaborationRef.current?.off('user:typing:start', handler);
    };
    
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onTypingStop = useCallback((handler: (typing: TypingIndicator) => void) => {
    if (!collaborationRef.current) return () => {};
    
    collaborationRef.current.on('user:typing:stop', handler);
    
    const cleanup = () => {
      collaborationRef.current?.off('user:typing:stop', handler);
    };
    
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  const onPresenceSync = useCallback((handler: (presence: ChatUserPresence[]) => void) => {
    if (!collaborationRef.current) return () => {};
    
    collaborationRef.current.on('presence:sync', handler);
    
    const cleanup = () => {
      collaborationRef.current?.off('presence:sync', handler);
    };
    
    cleanupFunctionsRef.current.push(cleanup);
    return cleanup;
  }, []);

  return {
    // Connection state
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    connectionStatus,
    
    // Participants and presence
    participants,
    activeUsers,
    typingUsers,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    startTyping,
    stopTyping,
    updatePresence,
    
    // Event handlers
    onMessage,
    onUserJoined,
    onUserLeft,
    onTypingStart,
    onTypingStop,
    onPresenceSync,
  };
};

/**
 * Hook for simpler typing indicator management
 */
export const useTypingIndicator = (
  collaboration: Pick<UseRealtimeCollaborationReturn, 'startTyping' | 'stopTyping'>,
  debounceMs: number = 1000
) => {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = useCallback(() => {
    // Start typing
    collaboration.startTyping();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      collaboration.stopTyping();
      typingTimeoutRef.current = null;
    }, debounceMs);
  }, [collaboration, debounceMs]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    collaboration.stopTyping();
  }, [collaboration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleTyping,
    stopTyping,
  };
};