// React components for real-time collaboration UI in CodeMind
'use client';

import React, { useCallback } from 'react';
import Image from 'next/image';
import { useRealtimeCollaboration } from '../hooks/useRealtimeCollaboration';
import {
  type SessionParticipant,
  type TypingIndicator,
} from '../types/realtime';

interface RealtimeCollaborationPanelProps {
  sessionId: string;
  className?: string;
  onUserSelect?: (user: SessionParticipant) => void;
  showTypingIndicators?: boolean;
  maxParticipants?: number;
}

/**
 * Main collaboration panel showing active users and connection status
 */
export const RealtimeCollaborationPanel: React.FC<RealtimeCollaborationPanelProps> = ({
  sessionId,
  className = '',
  onUserSelect,
  showTypingIndicators = true,
  maxParticipants = 10,
}) => {
  const {
    isConnected,
    isConnecting,
    connectionStatus,
    participants,
    activeUsers,
    typingUsers,
    connect,
    disconnect,
  } = useRealtimeCollaboration({
    sessionId,
    autoConnect: true,
  });

  const handleUserClick = useCallback((user: SessionParticipant) => {
    onUserSelect?.(user);
  }, [onUserSelect]);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusIcon = () => {
    if (isConnected) return '🟢';
    return '🔴';
  };

  const displayParticipants = participants.slice(0, maxParticipants);
  const overflowCount = participants.length - maxParticipants;

  return (
    <div className={`w-80 bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span>Active Users ({participants.length})</span>
          </div>
          <div className={`flex items-center gap-2 ${getConnectionStatusColor()}`}>
            <span>{getConnectionStatusIcon()}</span>
            <span className="text-xs font-normal capitalize">
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Connection Controls */}
        {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
          <button 
            onClick={connect} 
            disabled={isConnecting}
            className="w-full px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Reconnect'}
          </button>
        ) : (
          <button 
            onClick={disconnect} 
            className="w-full px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            Disconnect
          </button>
        )}

        <hr className="border-gray-200" />

        {/* Participants List */}
        <div className="h-64 overflow-y-auto">
          <div className="space-y-2">
            {displayParticipants.map((participant) => (
              <ParticipantCard
                key={participant.userId}
                participant={participant}
                isActive={activeUsers.some((u) => u.userId === participant.userId)}
                isTyping={typingUsers.some((t) => t.userId === participant.userId)}
                onClick={() => handleUserClick(participant)}
                showTypingIndicator={showTypingIndicators}
              />
            ))}
            
            {overflowCount > 0 && (
              <div className="flex items-center justify-center py-2 text-xs text-gray-500">
                +{overflowCount} more users
              </div>
            )}
            
            {participants.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
                <span className="text-4xl mb-2 opacity-50">👥</span>
                <p className="text-sm">No active users</p>
                <p className="text-xs">Join the session to collaborate</p>
              </div>
            )}
          </div>
        </div>

        {/* Typing Indicators */}
        {showTypingIndicators && typingUsers.length > 0 && (
          <>
            <hr className="border-gray-200" />
            <TypingIndicatorsList typingUsers={typingUsers} />
          </>
        )}
      </div>
    </div>
  );
};

interface ParticipantCardProps {
  participant: SessionParticipant;
  isActive: boolean;
  isTyping: boolean;
  onClick?: () => void;
  showTypingIndicator?: boolean;
}

/**
 * Individual participant card component
 */
const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isActive,
  isTyping,
  onClick,
  showTypingIndicator = true,
}) => {
  const getStatusColor = () => {
    if (isTyping) return 'bg-blue-500';
    if (isActive) return 'bg-green-500';
    return 'bg-gray-400';
  };

  const getRoleIcon = () => {
    switch (participant.role) {
      case 'owner':
        return '👑';
      case 'collaborator':
        return '✏️';
      case 'viewer':
        return '👁️';
      default:
        return null;
    }
  };

  const displayName = participant.userName || 'Anonymous';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-gray-50 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
      title={`${displayName} • ${participant.role} • ${isActive ? 'Online' : 'Offline'}`}
    >
      {/* Avatar with status indicator */}
      <div className="relative">
        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium overflow-hidden">
          {participant.userImage ? (
            <Image 
              src={participant.userImage} 
              alt={displayName} 
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span>{avatarInitial}</span>
          )}
        </div>
        
        {/* Status dot */}
        <div 
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${getStatusColor()}`}
        />
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">
            {displayName}
          </p>
          <span className="text-sm">{getRoleIcon()}</span>
        </div>
        
        {showTypingIndicator && isTyping && (
          <p className="text-xs text-blue-500 animate-pulse">
            typing...
          </p>
        )}
      </div>

      {/* Role badge */}
      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
        {participant.role}
      </span>
    </div>
  );
};

interface TypingIndicatorsListProps {
  typingUsers: TypingIndicator[];
  maxDisplay?: number;
}

/**
 * Component to display typing indicators
 */
const TypingIndicatorsList: React.FC<TypingIndicatorsListProps> = ({
  typingUsers,
  maxDisplay = 3,
}) => {
  if (typingUsers.length === 0) return null;

  const displayUsers = typingUsers.slice(0, maxDisplay);
  const overflowCount = typingUsers.length - maxDisplay;

  const getTypingText = () => {
    if (displayUsers.length === 1) {
      return `${displayUsers[0].userName || 'Someone'} is typing...`;
    }
    
    if (displayUsers.length === 2) {
      return `${displayUsers[0].userName || 'Someone'} and ${displayUsers[1].userName || 'someone'} are typing...`;
    }
    
    const names = displayUsers.map(u => u.userName || 'Someone').join(', ');
    const suffix = overflowCount > 0 ? ` and ${overflowCount} other${overflowCount > 1 ? 's' : ''}` : '';
    return `${names}${suffix} are typing...`;
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="animate-pulse">💬</span>
      <span className="animate-pulse">{getTypingText()}</span>
    </div>
  );
};

interface RealtimeStatusBadgeProps {
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  participantCount: number;
  className?: string;
}

/**
 * Compact status badge for showing connection and participant count
 */
export const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({
  connectionStatus,
  participantCount,
  className = '',
}) => {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-100 text-green-800 border-green-200';
      case 'connecting': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    if (connectionStatus === 'connected') return '🟢';
    return '🔴';
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${getStatusColor()} ${className}`}
      title={`${participantCount} active user${participantCount !== 1 ? 's' : ''} • ${connectionStatus}`}
    >
      <span>{getStatusIcon()}</span>
      <span>{participantCount}</span>
    </span>
  );
};

// Export all components
export { ParticipantCard, TypingIndicatorsList };