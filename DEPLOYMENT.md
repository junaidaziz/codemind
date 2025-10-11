# 🚀 Deployment Guide

This guide covers deploying CodeMind to Vercel with Supabase and proper environment configuration.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
3. **OpenAI API Key**: Get one from [platform.openai.com](https://platform.openai.com)

## 🛠️ Environment Setup

### 1. Copy Environment Template
```bash
cp env.production.template .env.production
```

### 2. Configure Environment Variables

Fill in your production values in `.env.production`:

```env
# Database - Use your Supabase database URL
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Supabase - Get these from your Supabase project settings
SUPABASE_URL="https://[project-id].supabase.co"
SUPABASE_ANON_KEY="[your-anon-key]"
NEXT_PUBLIC_SUPABASE_URL="https://[project-id].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[your-anon-key]"

# OpenAI - Get from OpenAI platform
OPENAI_API_KEY="sk-[your-openai-key]"

# App Configuration
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-app-domain.vercel.app"
```

## 🗄️ Database Setup

### 1. Run Migrations
```bash
# Apply database schema
npx prisma db push

# Or run migrations
npx prisma migrate deploy
```

### 2. Enable pgvector Extension
In your Supabase SQL editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## ☁️ Vercel Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 3. Configure Environment Variables in Vercel
Go to your Vercel dashboard → Project Settings → Environment Variables

Add all variables from your `.env.production` file.

## 🔧 Build Configuration

The project includes:

- **vercel.json**: Deployment configuration
- **Type-safe environment variables**: Validated with Zod
- **Optimized build settings**: For production performance

## 📊 Monitoring

### Optional: Add Sentry for Error Tracking
1. Create Sentry project
2. Add `SENTRY_DSN` to environment variables
3. Uncomment Sentry configuration in code

## 🧪 Testing Deployment

1. **Health Check**: Visit `/api/health` (if you create one)
2. **Database Connection**: Test user registration/login
3. **AI Features**: Try creating a project and chatting
4. **Environment Variables**: Check all features work correctly

## 🛡️ Security Checklist

- ✅ Environment variables are properly configured
- ✅ Database credentials are secure
- ✅ API keys are not exposed in client code
- ✅ CORS is properly configured
- ✅ Authentication is working correctly

## 🚨 Troubleshooting

### Common Issues:

1. **Environment Variable Errors**
   - Check Zod validation messages in build logs
   - Ensure all required variables are set

2. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check Supabase project is not paused

3. **OpenAI API Errors**
   - Verify API key is active
   - Check rate limits and billing

## 📈 Post-Deployment

1. **Monitor Performance**: Use Vercel Analytics
2. **Set up Alerts**: For errors and downtime
3. **Regular Backups**: Database backup strategy
4. **Updates**: Keep dependencies updated

## 🔄 CI/CD Pipeline

The project is configured for automatic deployments:
- Push to `main` branch triggers production deployment
- Environment-specific configurations are handled automatically
- Build optimizations are applied for production

---

For more help, check the [Next.js deployment docs](https://nextjs.org/docs/deployment) and [Vercel docs](https://vercel.com/docs).