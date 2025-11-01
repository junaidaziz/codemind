/**
 * Slack Notification Provider
 * Sends rich formatted messages to Slack via webhook
 */

import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider';

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
}

export class SlackNotificationProvider implements NotificationProvider {
  readonly name = 'slack';
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
  }

  isConfigured(): boolean {
    return !!this.webhookUrl && this.webhookUrl.startsWith('https://hooks.slack.com/');
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Slack webhook URL not configured',
      };
    }

    try {
      const slackMessage = this.formatMessage(payload);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Slack API error: ${response.status} - ${errorText}`,
        };
      }

      return {
        success: true,
        messageId: `slack-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private formatMessage(payload: NotificationPayload) {
    const color = this.getColor(payload.severity);
    const emoji = this.getEmoji(payload.type);

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${payload.title}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: payload.message,
        },
      },
    ];

    // Add metadata fields if present
    if (payload.metadata) {
      const fields = this.formatMetadata(payload.metadata);
      if (fields.length > 0) {
        blocks.push({
          type: 'section',
          fields,
        });
      }
    }

    // Add action button if URL provided
    if (payload.url) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${payload.url}|View Details →>`,
        },
      });
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      text: {
        type: 'mrkdwn',
        text: `_${new Date(payload.timestamp || Date.now()).toLocaleString()}_`,
      },
    });

    return {
      blocks,
      attachments: [
        {
          color,
          fallback: payload.message,
        },
      ],
    };
  }

  private formatMetadata(metadata: Record<string, unknown>): Array<{ type: string; text: string }> {
    return Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${this.capitalize(key)}:*\n${String(value)}`,
      }));
  }

  private getColor(severity?: string): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'error': return '#f97316';
      case 'warning': return '#fbbf24';
      case 'info':
      default: return '#3b82f6';
    }
  }

  private getEmoji(type: string): string {
    switch (type) {
      case 'review_completed': return '✅';
      case 'review_high_risk': return '⚠️';
      case 'deployment_ready': return '🚀';
      case 'deployment_failed': return '❌';
      case 'health_check_failed': return '🔴';
      default: return '📢';
    }
  }

  private capitalize(str: string): string {
    return str.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
