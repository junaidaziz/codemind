#!/bin/bash
# Validate Agent Service Deployment

echo "🧪 Validating Agent Service Deployment"

# Default service URL
SERVICE_URL=${1:-"http://localhost:3001"}

echo "📡 Testing service at: $SERVICE_URL"

# Compile and run the validation script
echo "📦 Compiling validation script..."
npx ts-node scripts/validate-agent-deployment.ts "$SERVICE_URL"