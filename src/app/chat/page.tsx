'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '../../components/ui';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { QuickFeedback } from '../../components/AgentFeedback';
import { FeedbackSummary } from '../../components/FeedbackAnalytics';
import { RealtimeCollaborationPanel, RealtimeStatusBadge } from '../../components/RealtimeCollaboration';
import { useRealtimeCollaboration, useTypingIndicator } from '../../hooks/useRealtimeCollaboration';
import { CommandParser, getCommandRegistry, initializeCommandHandlers } from '@/lib/command-handlers';
import type { CommandResult } from '@/lib/command-handlers/types';
import type { Command } from '@/lib/command-parser';

interface Project {
  id: string;
  name: string;
  status: string;
  lastIndexedAt: string | null;
  githubUrl?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'command';
  content: string;
  createdAt: string;
  commandResult?: CommandResult;
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isRestoringSession] = useState(false); // Keep for UI consistency, always false since restore function is disabled
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize command handlers on mount
  useEffect(() => {
    initializeCommandHandlers();
  }, []);

  // Realtime collaboration
  const collaboration = useRealtimeCollaboration({
    sessionId: currentSessionId,
    autoConnect: !!currentSessionId && !!user?.id,
  });

  // Typing indicator management
  const { handleTyping, stopTyping } = useTypingIndicator(collaboration, 1500);

  // Handle incoming collaboration messages
  useEffect(() => {
    if (!currentSessionId || !collaboration.isConnected) return;

    const unsubscribeMessage = collaboration.onMessage((message) => {
      // Don't add our own messages (already added locally)
      if (message.userId === user?.id) return;
      
      const newMessage: Message = {
        id: message.messageId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      };

      setMessages(prev => {
        // Check if message already exists
        const exists = prev.some(msg => msg.id === message.messageId);
        if (exists) return prev;
        
        // Add message in chronological order
        const updated = [...prev, newMessage].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return updated;
      });
    });

    return () => {
      unsubscribeMessage();
    };
  }, [currentSessionId, collaboration, user?.id]);

  // Session persistence utilities
  const getStorageKey = useCallback((projectId: string) => `codemind_chat_session_${projectId}`, []);
  
  const saveSessionToStorage = useCallback((projectId: string, sessionId: string, messages: Message[]) => {
    try {
      const sessionData = {
        sessionId,
        messages,
        lastUpdated: Date.now(),
        projectId
      };
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error);
    }
  }, [getStorageKey]);

  const loadSessionFromStorage = useCallback((projectId: string) => {
    try {
      const stored = localStorage.getItem(getStorageKey(projectId));
      if (stored) {
        const sessionData = JSON.parse(stored);
        // Only restore sessions from the last 24 hours
        if (Date.now() - sessionData.lastUpdated < 24 * 60 * 60 * 1000) {
          return sessionData;
        }
      }
    } catch (error) {
      console.warn('Failed to load session from localStorage:', error);
    }
    return null;
  }, [getStorageKey]);

  // Unused function - commented out to fix linting warnings
  // const restoreSessionFromAPI = useCallback(async (sessionId: string) => {
  //   try {
  //     setIsRestoringSession(true);
  //     const response = await fetch(`/api/chat/sessions/${sessionId}`);
  //     if (response.ok) {
  //       const result = await response.json();
  //       if (result.success && result.data.messages) {
  //         const apiMessages: Message[] = result.data.messages.map((msg: { id: string; role: string; content: string; createdAt: string }) => ({
  //           id: msg.id,
  //           role: msg.role,
  //           content: msg.content,
  //           createdAt: msg.createdAt
  //         }));
  //         return apiMessages;
  //       }
  //     }
  //   } catch (error) {
  //     console.warn('Failed to restore session from API:', error);
  //   } finally {
  //     setIsRestoringSession(false);
  //   }
  //   return null;
  // }, []);

  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Set project from URL parameter
  useEffect(() => {
    const projectParam = searchParams.get('project');
    if (projectParam && projects.length > 0) {
      const projectExists = projects.find(p => p.id === projectParam);
      if (projectExists) {
        setSelectedProjectId(projectParam);
      }
    }
  }, [searchParams, projects]);

  // Generate session ID when project changes and restore previous session
  useEffect(() => {
    if (selectedProjectId) {
      // Try to restore previous session first
      const storedSession = loadSessionFromStorage(selectedProjectId);
      
      if (storedSession && storedSession.sessionId && storedSession.messages) {
        // Restore from localStorage
        setCurrentSessionId(storedSession.sessionId);
        setMessages(storedSession.messages);
        console.log(`Restored chat session from localStorage for project ${selectedProjectId}`);
      } else {
        // Create new session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setCurrentSessionId(sessionId);
        setMessages([]);
        console.log(`Created new chat session for project ${selectedProjectId}`);
      }
    }
  }, [selectedProjectId, loadSessionFromStorage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save session to localStorage whenever messages change
  useEffect(() => {
    if (selectedProjectId && currentSessionId && messages.length > 0) {
      saveSessionToStorage(selectedProjectId, currentSessionId, messages);
    }
  }, [selectedProjectId, currentSessionId, messages, saveSessionToStorage]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const apiResponse = await response.json();
        if (apiResponse.success) {
          const projectsData = apiResponse.data;
          setProjects(projectsData);
          if (projectsData.length > 0) {
            setSelectedProjectId(projectsData[0].id);
          }
        } else {
          console.error('Failed to fetch projects:', apiResponse.error);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCommandExecution = async (command: Command, originalInput: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: originalInput,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Find the selected project to get workspace info
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      
      // Derive workspace path from project name (or use a default)
      // In a real scenario, this might come from project settings or local config
      const workspacePath = selectedProject?.githubUrl 
        ? `/tmp/codemind-projects/${selectedProject.name.toLowerCase().replace(/\s+/g, '-')}`
        : undefined;

      const registry = getCommandRegistry();
      const result = await registry.execute(command, {
        userId: user?.id || 'unknown',
        projectId: selectedProjectId,
        sessionId: currentSessionId,
        workspacePath,
      });

      // Add command result as assistant message
      const commandMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'command',
        content: result.message || 'Command executed',
        createdAt: new Date().toISOString(),
        commandResult: result
      };

      setMessages(prev => [...prev, commandMessage]);

      // Broadcast command result if in a session (as assistant role for compatibility)
      if (currentSessionId) {
        collaboration.sendMessage({
          messageId: commandMessage.id,
          role: 'assistant',
          content: commandMessage.content,
          createdAt: commandMessage.createdAt,
        }).catch(error => {
          console.warn('Failed to broadcast command result:', error);
        });
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Command error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedProjectId || isStreaming) return;

    // Check for slash commands first
    const parsed = CommandParser.parse(inputMessage);
    if (parsed.hasCommand && parsed.command) {
      await handleCommandExecution(parsed.command, inputMessage);
      return; // Don't send to chat API
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);

    // Stop typing indicator and broadcast user message
    if (currentSessionId) {
      stopTyping();
      collaboration.sendMessage({
        messageId: userMessage.id,
        role: userMessage.role as 'user',
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      }).catch(error => {
        console.warn('Failed to broadcast user message:', error);
      });
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          message: inputMessage,
          userId: user?.id
        })
      });

      if (!response.ok) {
        // Handle specific error responses
        let errorMessage = 'Failed to send message';
        
        try {
          const errorData = await response.json();
          
          if (errorData.error === 'QUOTA_EXCEEDED') {
            errorMessage = '🚫 OpenAI quota exceeded. Please check your billing and usage limits at https://platform.openai.com/usage';
          } else if (errorData.error === 'RATE_LIMIT_EXCEEDED') {
            errorMessage = '⏳ Rate limit reached. Please wait 30 seconds before sending another message.';
          } else if (errorData.error === 'EXTERNAL_SERVICE_ERROR') {
            errorMessage = '⚠️ OpenAI service temporarily unavailable. Please try again in a few minutes.';
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Fallback to generic error
        }
        
        throw new Error(errorMessage);
      }

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                setIsStreaming(false);
                
                // Broadcast final assistant message to collaborators
                if (currentSessionId) {
                  // Get the final message content
                  setMessages(prevMessages => {
                    const finalMessage = prevMessages.find(msg => msg.id === assistantMessage.id);
                    if (finalMessage && finalMessage.content && finalMessage.role !== 'command') {
                      collaboration.sendMessage({
                        messageId: finalMessage.id,
                        role: finalMessage.role,
                        content: finalMessage.content,
                        createdAt: finalMessage.createdAt,
                      }).catch(error => {
                        console.warn('Failed to broadcast assistant message:', error);
                      });
                    }
                    return prevMessages;
                  });
                }
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: msg.content + parsed.content }
                        : msg
                    )
                  );
                }
              } catch {
                // Ignore JSON parsing errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      setIsStreaming(false);
      
      // Add error message with specific error details
      const errorContent = error instanceof Error ? error.message : 'Sorry, I encountered an error processing your message. Please try again.';
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: errorContent,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Simple code block detection and formatting
    const parts = content.split('```');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a code block
        const lines = part.split('\n');
        const language = lines[0] || '';
        const code = lines.slice(1).join('\n');
        
        return (
          <pre key={index} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 my-2 overflow-x-auto">
            {language && (
              <div className="text-xs text-gray-500 mb-2 font-mono">{language}</div>
            )}
            <code className="text-sm font-mono">{code}</code>
          </pre>
        );
      } else {
        // Regular text
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white dark:bg-gray-900">
      {/* Chat Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-end">
          <div className="flex items-center gap-4">
            {/* Collaboration Status */}
            {currentSessionId && (
              <RealtimeStatusBadge
                connectionStatus={collaboration.connectionStatus}
                participantCount={collaboration.participants.length}
              />
            )}
            
            {/* Feedback Summary */}
            {selectedProjectId && (
              <FeedbackSummary projectId={selectedProjectId} />
            )}
            
            {/* Project Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="project-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Project:
              </label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => {
                  const projectId = e.target.value;
                  setSelectedProjectId(projectId);
                  
                  // Create or load session for the selected project
                  if (projectId) {
                    // Check for existing session in localStorage
                    const existingSession = loadSessionFromStorage(projectId);
                    if (existingSession && existingSession.sessionId) {
                      setCurrentSessionId(existingSession.sessionId);
                    } else {
                      // Create new session ID for collaboration
                      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                      setCurrentSessionId(newSessionId);
                    }
                  } else {
                    setCurrentSessionId('');
                  }
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.status})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Collaboration Toggle */}
            {currentSessionId && (
              <button
                onClick={() => setShowCollaborationPanel(!showCollaborationPanel)}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                title="Toggle collaboration panel"
              >
                👥
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {isRestoringSession ? (
                <div className="flex items-center justify-center space-x-2">
                  <Spinner size="sm" />
                  <p>Restoring chat history...</p>
                </div>
              ) : (
                <>
                  <p className="text-lg mb-2">👋 Welcome to CodeMind!</p>
                  <p>Select a project and start asking questions about your code.</p>
                </>
              )}
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white ml-8'
                      : message.role === 'command'
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 text-gray-900 dark:text-white mr-8'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white mr-8'
                  }`}
                >
                  {/* Command Result Display */}
                  {message.commandResult ? (
                    <div className="space-y-3">
                      {/* Command Status */}
                      <div className="flex items-center gap-2 pb-2 border-b border-purple-200 dark:border-purple-800">
                        <span className="text-lg">
                          {message.commandResult.success ? '✅' : '❌'}
                        </span>
                        <span className="font-semibold text-purple-700 dark:text-purple-300">
                          Command Result
                        </span>
                      </div>

                      {/* Message */}
                      {message.commandResult.message && (
                        <div className="text-sm">
                          {String(message.commandResult.message)}
                        </div>
                      )}

                      {/* Data Display */}
                      {message.commandResult.data !== undefined && (
                        <div className="bg-white dark:bg-gray-900 rounded p-3 border border-purple-200 dark:border-purple-700">
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                            {typeof message.commandResult.data === 'string'
                              ? message.commandResult.data
                              : String(JSON.stringify(message.commandResult.data, null, 2))}
                          </pre>
                        </div>
                      )}

                      {/* Code Changes */}
                      {message.commandResult.changes && message.commandResult.changes.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-semibold text-sm text-purple-700 dark:text-purple-300">
                            Proposed Changes:
                          </div>
                          {message.commandResult.changes.map((change, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-900 rounded p-3 border border-purple-200 dark:border-purple-700">
                              <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                {change.filePath}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                {change.description}
                              </div>
                              <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                {change.newContent}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {message.commandResult.actions && message.commandResult.actions.length > 0 && (
                        <div className="flex gap-2 pt-2">
                          {message.commandResult.actions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                console.log('Action clicked:', action.type);
                                action.handler().catch(err => {
                                  console.error('Action handler error:', err);
                                });
                              }}
                              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                action.type === 'accept'
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : action.type === 'reject'
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : action.type === 'modify'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-600 text-white hover:bg-gray-700'
                              }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm">
                      {formatMessage(message.content)}
                    </div>
                  )}

                  {message.role === 'assistant' && isStreaming && message.content === '' && (
                    <div className="flex items-center space-x-1 text-gray-500">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  )}
                  
                  {/* Feedback for assistant messages */}
                  {message.role === 'assistant' && message.content && !isStreaming && selectedProjectId && currentSessionId && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <QuickFeedback
                        messageId={message.id}
                        sessionId={currentSessionId}
                        projectId={selectedProjectId}
                        onFeedback={(rating, type) => {
                          console.log('Feedback submitted:', { messageId: message.id, rating, type });
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Typing Indicators */}
          {collaboration.typingUsers.length > 0 && (
            <div className="flex justify-start">
              <div className="max-w-3xl rounded-lg p-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white mr-8">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>
                    {collaboration.typingUsers.length === 1
                      ? `${collaboration.typingUsers[0].userName || 'Someone'} is typing...`
                      : `${collaboration.typingUsers.length} people are typing...`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Collaboration Panel */}
        {showCollaborationPanel && currentSessionId && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <RealtimeCollaborationPanel
              sessionId={currentSessionId}
              onUserSelect={(user) => {
                console.log('Selected user:', user);
              }}
              maxParticipants={10}
            />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                if (e.target.value.trim() && currentSessionId) {
                  handleTyping();
                } else if (!e.target.value.trim() && currentSessionId) {
                  stopTyping();
                }
              }}
              onKeyPress={handleKeyPress}
              onBlur={() => {
                if (currentSessionId) {
                  stopTyping();
                }
              }}
              placeholder={selectedProjectId ? "Ask a question about your code..." : "Please select a project first"}
              disabled={!selectedProjectId || isStreaming}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !selectedProjectId || isStreaming}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading || isStreaming ? (
                <Spinner size="sm" color="white" />
              ) : (
                'Send'
              )}
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatPageContent />
    </ProtectedRoute>
  );
}