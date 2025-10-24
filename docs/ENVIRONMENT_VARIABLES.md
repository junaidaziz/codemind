# Environment Variables Configuration

This document describes all environment variables needed to run CodeMind.

## Required Variables

### Database
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/codemind"
```

### NextAuth Configuration
```bash
# Base URL of your application
NEXTAUTH_URL="http://localhost:3000"

# Generate a secret key using: openssl rand -base64 32
NEXTAUTH_SECRET="generate-a-secret-key-using-openssl-rand-base64-32"
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the credentials:

```bash
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Homepage URL: `http://localhost:3000`
4. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
5. Copy the credentials:

```bash
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### AI API Keys

```bash
# OpenAI API Key (required for GPT models)
OPENAI_API_KEY="sk-your-openai-api-key"

# Anthropic API Key (required for Claude models)
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key"
```

### GitHub Integration

```bash
# GitHub Personal Access Token for repository operations
# Scopes needed: repo, read:org, read:user
GITHUB_TOKEN="ghp_your-github-personal-access-token"
```

## Optional Variables

### Notifications

```bash
# Slack webhook for notifications
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Discord webhook for notifications
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
```

### Error Tracking

```bash
# Sentry DSN for error tracking
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
```

### Application Settings

```bash
NODE_ENV="development"
PORT="3000"
```

### Redis Cache

```bash
# Redis connection for caching (optional)
REDIS_URL="redis://localhost:6379"
```

### Rate Limiting

```bash
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="900000"
```

### Session Settings

```bash
# Session expiration time in seconds (default: 30 days)
SESSION_MAX_AGE="2592000"
```

### Email Configuration

```bash
# SMTP settings for email invitations
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="noreply@codemind.dev"
```

### Feature Flags

```bash
ENABLE_GITHUB_INTEGRATION="true"
ENABLE_SSO="true"
ENABLE_TEAMS="true"
ENABLE_ANALYTICS="true"
```

## Setup Instructions

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required variables (marked as required above)

3. Set up OAuth providers:
   - Follow the Google OAuth Setup section
   - Follow the GitHub OAuth Setup section

4. Generate NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```

5. Test your configuration:
   ```bash
   pnpm dev
   ```

## Production Deployment

For production deployments (Vercel, etc.), make sure to:

1. Set `NEXTAUTH_URL` to your production domain
2. Update OAuth redirect URIs in Google/GitHub settings
3. Use strong secrets (generate new ones, don't reuse development secrets)
4. Enable HTTPS (required for OAuth)
5. Set `NODE_ENV="production"`

## Security Notes

- Never commit `.env.local` or `.env` files to version control
- Keep your secrets secure and rotate them regularly
- Use different credentials for development, staging, and production
- Restrict API key permissions to minimum required scopes
- Enable 2FA on all service accounts
