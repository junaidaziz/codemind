# CodeMind Deployment Guide

## Overview

This guide covers deploying CodeMind to production environments, including cloud platforms, containerization, and infrastructure setup. CodeMind can be deployed as a complete application or individual microservices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Containerization](#containerization)
5. [Cloud Deployment](#cloud-deployment)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Security Considerations](#security-considerations)
8. [Performance Optimization](#performance-optimization)
9. [Backup and Recovery](#backup-and-recovery)
10. [CI/CD Pipeline](#cicd-pipeline)

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 vCPUs
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 1Gbps
- **OS**: Ubuntu 20.04+ / Amazon Linux 2 / CentOS 8+

#### Recommended Requirements
- **CPU**: 4+ vCPUs
- **RAM**: 8GB+
- **Storage**: 100GB+ NVMe SSD
- **Network**: 10Gbps
- **Load Balancer**: For high availability

#### Software Dependencies
- **Node.js**: 18+ LTS
- **PostgreSQL**: 14+ with pgvector extension
- **Redis**: 6+ (for background jobs and caching)
- **Docker**: 20.10+ (for containerized deployment)
- **Nginx**: For reverse proxy and load balancing

### External Services

#### Required Services
- **Supabase**: Authentication and additional database features
- **OpenAI API**: Language model access
- **Sentry** (recommended): Error tracking and monitoring

#### Optional Services
- **GitHub/GitLab**: Repository integration
- **AWS S3/GCS**: File storage
- **CloudFlare**: CDN and DDoS protection

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file with the following configurations:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-nextauth-secret-here
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/codemind_prod
DATABASE_POOL_SIZE=10
DATABASE_SSL=true

# Authentication (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# AI Services
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.1

# Background Jobs
REDIS_URL=redis://user:password@host:6379
QUEUE_CONCURRENCY=5
JOB_TIMEOUT=300000

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=https://your-public-sentry-dsn
SENTRY_ENVIRONMENT=production

# Analytics
ENABLE_ANALYTICS=true
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_BATCH_SIZE=1000

# Security
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
API_KEY_ENCRYPTION_SECRET=your-api-key-encryption-secret

# File Storage (optional)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=codemind-files-prod
AWS_REGION=us-east-1

# Email (optional)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
FROM_EMAIL=noreply@your-domain.com
```

### Environment Validation

Create an environment validation script:

```typescript
// scripts/validate-env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
});

const env = envSchema.parse(process.env);
console.log('✅ Environment variables validated successfully');
```

## Database Setup

### PostgreSQL with pgvector

#### Installation on Ubuntu

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install pgvector extension
sudo apt install postgresql-14-pgvector

# Create database and user
sudo -u postgres psql
CREATE DATABASE codemind_prod;
CREATE USER codemind_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE codemind_prod TO codemind_user;

# Enable pgvector extension
\c codemind_prod;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### AWS RDS Setup

```bash
# Create RDS instance with PostgreSQL 14+
aws rds create-db-instance \
  --db-instance-identifier codemind-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 14.9 \
  --master-username codemind_admin \
  --master-user-password your-secure-password \
  --allocated-storage 100 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-your-security-group \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted

# Install pgvector on RDS (connect and run)
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Database Migrations

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate deploy

# Verify database setup
pnpm prisma db push --accept-data-loss
```

### Redis Setup

#### Local Redis Installation

```bash
# Ubuntu
sudo apt install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Key settings:
# bind 127.0.0.1 ::1
# requirepass your-secure-redis-password
# maxmemory 2gb
# maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
```

#### AWS ElastiCache

```bash
# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id codemind-prod \
  --description "CodeMind Production Redis" \
  --primary-cluster-id codemind-prod-001 \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 6.2 \
  --num-cache-clusters 2 \
  --security-group-ids sg-your-security-group \
  --subnet-group-name your-subnet-group
```

## Containerization

### Dockerfile

```dockerfile
# Production Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - codemind-network

  postgres:
    image: pgvector/pgvector:pg14
    environment:
      - POSTGRES_DB=codemind_prod
      - POSTGRES_USER=codemind_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - codemind-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - codemind-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - codemind-network

volumes:
  postgres_data:
  redis_data:

networks:
  codemind-network:
    driver: bridge
```

### Nginx Configuration

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=chat:10m rate=1r/s;

    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Gzip compression
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /api/chat {
            limit_req zone=chat burst=5 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 300s;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            proxy_pass http://app;
        }
    }
}
```

## Cloud Deployment

### AWS Deployment

#### Using AWS App Runner

```yaml
# apprunner.yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - echo "Installing dependencies"
      - corepack enable pnpm
      - pnpm install --frozen-lockfile
      - echo "Generating Prisma client"
      - npx prisma generate
      - echo "Building application"
      - pnpm build
run:
  runtime-version: 18
  command: pnpm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

Deploy with App Runner:

```bash
# Create App Runner service
aws apprunner create-service \
  --service-name codemind-prod \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "your-account.dkr.ecr.region.amazonaws.com/codemind:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "1024",
    "Memory": "2048"
  }'
```

#### Using ECS with Fargate

```json
{
  "family": "codemind-prod",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "codemind-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/codemind:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:region:account:parameter/codemind/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/codemind-prod",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Vercel Deployment

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "OPENAI_API_KEY": "@openai-api-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key"
  },
  "functions": {
    "src/app/api/**": {
      "maxDuration": 30
    }
  },
  "regions": ["iad1"]
}
```

Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
vercel env add OPENAI_API_KEY production
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: codemind-prod
services:
- name: web
  source_dir: /
  github:
    repo: your-username/codemind
    branch: main
    deploy_on_push: true
  run_command: pnpm start
  build_command: pnpm install && pnpm build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  routes:
  - path: /
databases:
- name: db
  engine: PG
  version: "14"
  size: basic-xs
  num_nodes: 1
```

## Monitoring and Logging

### Application Monitoring

#### Sentry Configuration

```typescript
// src/app/lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event, hint) {
    // Filter out known issues
    if (event.exception) {
      const error = hint.originalException;
      if (error?.message?.includes('Network Error')) {
        return null;
      }
    }
    return event;
  },
});
```

#### Health Check Endpoint

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    
    // Check Redis connection
    // await redis.ping();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

### Infrastructure Monitoring

#### CloudWatch (AWS)

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "CodeMind-Production" \
  --dashboard-body file://cloudwatch-dashboard.json
```

#### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - monitoring

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter
    ports:
      - "9100:9100"
    networks:
      - monitoring

volumes:
  grafana_data:

networks:
  monitoring:
```

## Security Considerations

### SSL/TLS Configuration

```bash
# Let's Encrypt with Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Security Headers

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  return response;
}
```

### Environment Secrets Management

#### AWS Systems Manager Parameter Store

```bash
# Store secrets in Parameter Store
aws ssm put-parameter \
  --name "/codemind/prod/database-url" \
  --value "postgresql://..." \
  --type "SecureString"

aws ssm put-parameter \
  --name "/codemind/prod/openai-api-key" \
  --value "sk-..." \
  --type "SecureString"
```

#### HashiCorp Vault

```bash
# Store secrets in Vault
vault kv put secret/codemind/prod \
  database_url="postgresql://..." \
  openai_api_key="sk-..."
```

## Performance Optimization

### Caching Strategy

```typescript
// src/lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  static async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
```

### Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_files_project_id ON files(project_id);
CREATE INDEX CONCURRENTLY idx_chunks_file_id ON chunks(file_id);
CREATE INDEX CONCURRENTLY idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX CONCURRENTLY idx_chat_messages_session_id ON chat_messages(session_id);

-- Vector similarity index
CREATE INDEX CONCURRENTLY idx_chunks_embedding 
ON chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### CDN Configuration

```typescript
// next.config.ts
const nextConfig = {
  images: {
    domains: ['your-cdn-domain.com'],
  },
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.your-domain.com' 
    : '',
};
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgresql"
DB_NAME="codemind_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
pg_dump $DATABASE_URL > $BACKUP_DIR/codemind_backup_$TIMESTAMP.sql

# Compress backup
gzip $BACKUP_DIR/codemind_backup_$TIMESTAMP.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/codemind_backup_$TIMESTAMP.sql.gz \
  s3://codemind-backups/database/

# Cleanup local backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: codemind_backup_$TIMESTAMP.sql.gz"
```

### Automated Backup with Cron

```bash
# Add to crontab
# Daily backup at 2 AM
0 2 * * * /opt/codemind/scripts/backup-db.sh

# Weekly full backup
0 3 * * 0 /opt/codemind/scripts/backup-full.sh
```

### Recovery Procedures

```bash
#!/bin/bash
# restore-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Download from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
  aws s3 cp $BACKUP_FILE ./restore_backup.sql.gz
  BACKUP_FILE="./restore_backup.sql.gz"
fi

# Decompress if gzipped
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip $BACKUP_FILE
  BACKUP_FILE="${BACKUP_FILE%.*}"
fi

# Restore database
psql $DATABASE_URL < $BACKUP_FILE

echo "Database restored from $BACKUP_FILE"
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run tests
        run: pnpm test
        
      - name: Run linting
        run: pnpm lint
        
      - name: Type check
        run: pnpm type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
        
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: codemind
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster codemind-prod \
            --service codemind-app \
            --force-new-deployment
            
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster codemind-prod \
            --services codemind-app
```

### Database Migrations

```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  workflow_dispatch:
  push:
    paths:
      - 'prisma/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: pnpm prisma migrate deploy
```

### Rollback Procedure

```bash
#!/bin/bash
# rollback.sh

PREVIOUS_VERSION=$1

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Usage: $0 <previous-version-tag>"
  exit 1
fi

# Update ECS service to previous version
aws ecs update-service \
  --cluster codemind-prod \
  --service codemind-app \
  --task-definition codemind-prod:$PREVIOUS_VERSION

# Wait for rollback to complete
echo "Rolling back to version $PREVIOUS_VERSION..."
aws ecs wait services-stable \
  --cluster codemind-prod \
  --services codemind-app

echo "Rollback completed successfully"
```

## Troubleshooting

### Common Production Issues

#### High Memory Usage

```bash
# Monitor memory usage
free -h
top -p $(pgrep -f "node.*server.js")

# Check Node.js heap usage
curl http://localhost:3000/api/health
```

#### Database Connection Issues

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT version();"

# Monitor connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Performance Issues

```bash
# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/health"

# Monitor request logs
tail -f /var/log/nginx/access.log | grep "POST /api/chat"
```

### Emergency Procedures

#### Scale Up Resources

```bash
# AWS ECS - Increase task count
aws ecs update-service \
  --cluster codemind-prod \
  --service codemind-app \
  --desired-count 3

# AWS RDS - Scale up instance
aws rds modify-db-instance \
  --db-instance-identifier codemind-prod \
  --db-instance-class db.t3.large \
  --apply-immediately
```

#### Circuit Breaker for External APIs

```typescript
// src/lib/circuit-breaker.ts
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 60000) { // 1 minute
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= 5) {
      this.state = 'OPEN';
    }
  }
}
```

---

This deployment guide provides comprehensive instructions for deploying CodeMind to production environments. Adjust configurations based on your specific infrastructure requirements and scaling needs.

For additional support, contact the DevOps team or refer to the infrastructure documentation.