/**
 * Discord Notification Provider
 * Sends rich embedded messages to Discord via webhook
 */

import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  url?: string;
  timestamp?: string;
  footer?: { text: string };
}

export class DiscordNotificationProvider implements NotificationProvider {
  readonly name = 'discord';
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
  }

  isConfigured(): boolean {
    return !!this.webhookUrl && this.webhookUrl.includes('discord.com/api/webhooks/');
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Discord webhook URL not configured',
      };
    }

    try {
      const discordMessage = this.formatMessage(payload);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordMessage),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Discord API error: ${response.status} - ${errorText}`,
        };
      }

      return {
        success: true,
        messageId: `discord-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private formatMessage(payload: NotificationPayload) {
    const embed: DiscordEmbed = {
      title: `${this.getEmoji(payload.type)} ${payload.title}`,
      description: payload.message,
      color: this.getColor(payload.severity),
      timestamp: (payload.timestamp || new Date()).toISOString(),
      footer: {
        text: 'CodeMind',
      },
    };

    // Add URL if provided
    if (payload.url) {
      embed.url = payload.url;
    }

    // Add metadata fields if present
    if (payload.metadata) {
      embed.fields = this.formatMetadata(payload.metadata);
    }

    return {
      embeds: [embed],
    };
  }

  private formatMetadata(metadata: Record<string, unknown>): Array<{ name: string; value: string; inline: boolean }> {
    return Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({
        name: this.capitalize(key),
        value: String(value),
        inline: true,
      }));
  }

  private getColor(severity?: string): number {
    switch (severity) {
      case 'critical': return 0xdc2626; // red-600
      case 'error': return 0xf97316; // orange-500
      case 'warning': return 0xfbbf24; // yellow-400
      case 'info':
      default: return 0x3b82f6; // blue-500
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
