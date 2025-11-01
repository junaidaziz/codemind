/**
 * Notification Factory
 * Creates and manages notification provider instances
 */

import { NotificationProvider } from './notification-provider';
import { SlackNotificationProvider } from './slack-provider';
import { DiscordNotificationProvider } from './discord-provider';

type ProviderType = 'slack' | 'discord';

export class NotificationFactory {
  private providers: Map<ProviderType, NotificationProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Slack provider
    const slackProvider = new SlackNotificationProvider();
    if (slackProvider.isConfigured()) {
      this.providers.set('slack', slackProvider);
    }

    // Initialize Discord provider
    const discordProvider = new DiscordNotificationProvider();
    if (discordProvider.isConfigured()) {
      this.providers.set('discord', discordProvider);
    }
  }

  getProvider(type: ProviderType): NotificationProvider | undefined {
    return this.providers.get(type);
  }

  getAllProviders(): NotificationProvider[] {
    return Array.from(this.providers.values());
  }

  getConfiguredProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  isAnyProviderConfigured(): boolean {
    return this.providers.size > 0;
  }
}

// Singleton instance
let factoryInstance: NotificationFactory | null = null;

export function getNotificationFactory(): NotificationFactory {
  if (!factoryInstance) {
    factoryInstance = new NotificationFactory();
  }
  return factoryInstance;
}

export function resetNotificationFactory(): void {
  factoryInstance = null;
}
