/**
 * Notification Provider Interface
 * Defines contract for notification delivery systems (Slack, Discord, Email, etc.)
 */

export type NotificationType = 
  | 'review_completed'
  | 'review_high_risk'
  | 'deployment_ready'
  | 'deployment_failed'
  | 'health_check_failed';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  url?: string;
  timestamp?: Date;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  /**
   * Send a notification
   * @param payload - Notification data
   * @returns Result of the send operation
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Provider name (e.g., 'slack', 'discord')
   */
  readonly name: string;

  /**
   * Validate provider configuration
   */
  isConfigured(): boolean;
}
