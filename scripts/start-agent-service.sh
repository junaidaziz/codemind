#!/bin/bash
# Start Agent Service for Testing

echo "🚀 Starting CodeMind Agent Service"

# Check if we're in the agent-core directory
if [ ! -f "services/agent-core/package.json" ]; then
  echo "❌ Please run this script from the project root directory"
  exit 1
fi

# Navigate to agent service directory
cd services/agent-core

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Copy environment variables
if [ ! -f ".env" ]; then
  if [ -f "../../.env" ]; then
    echo "📋 Copying environment variables from main app..."
    cp ../../.env .env
    
    # Add agent-specific variables
    echo "" >> .env
    echo "# Agent Service Configuration" >> .env
    echo "PORT=3001" >> .env
    echo "NODE_ENV=development" >> .env
    echo "AGENT_SERVICE_SECRET=agent-service-secret-key-for-development-only" >> .env
    echo "ALLOWED_ORIGINS=http://localhost:3000" >> .env
    echo "RATE_LIMIT_MAX=100" >> .env
    echo "RATE_LIMIT_WINDOW_MS=900000" >> .env
    echo "LOG_LEVEL=info" >> .env
    echo "LOG_FORMAT=simple" >> .env
  else
    echo "⚠️  No .env file found. Creating from template..."
    cp env.template .env
    echo "📝 Please edit .env with your configuration"
  fi
fi

# Build the service
echo "🔨 Building agent service..."
npm run build

# Start the service
echo "▶️  Starting agent service on http://localhost:3001"
npm start