#!/bin/bash

# CI/CD Pipeline Validation Script
# This script validates the CI/CD pipeline configuration and runs local checks

set -e

echo "🔍 CodeMind CI/CD Pipeline Validation"
echo "======================================"

# Check if required tools are installed
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed"
        return 1
    else
        echo "✅ $1 is installed"
        return 0
    fi
}

echo "🛠️  Checking required tools..."
check_tool node
check_tool npm
check_tool docker

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js version: $NODE_VERSION"

if [[ "$NODE_VERSION" < "v18" ]]; then
    echo "⚠️  Warning: Node.js version should be 18 or higher for CI/CD pipeline"
fi

# Validate package.json scripts
echo "📋 Validating package.json scripts..."
if npm run -s | grep -q "test:"; then
    echo "✅ Test scripts found"
else
    echo "❌ Test scripts missing"
fi

if npm run -s | grep -q "lint"; then
    echo "✅ Lint script found"
else
    echo "❌ Lint script missing"
fi

if npm run -s | grep -q "build"; then
    echo "✅ Build script found"
else
    echo "❌ Build script missing"
fi

# Check CI/CD configuration files
echo "🔧 Checking CI/CD configuration files..."

if [ -f ".github/workflows/ci-cd.yml" ]; then
    echo "✅ GitHub Actions workflow found"
else
    echo "❌ GitHub Actions workflow missing"
fi

if [ -f "Dockerfile" ]; then
    echo "✅ Dockerfile found"
else
    echo "❌ Dockerfile missing"
fi

if [ -f "docker-compose.yml" ]; then
    echo "✅ Docker Compose configuration found"
else
    echo "❌ Docker Compose configuration missing"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run quality checks (similar to CI pipeline)
echo "🎯 Running quality checks..."

echo "  🔍 Running ESLint..."
if npm run lint; then
    echo "  ✅ ESLint passed"
else
    echo "  ❌ ESLint failed"
    FAILED_CHECKS="lint $FAILED_CHECKS"
fi

echo "  🏗️  Running TypeScript type check..."
if npx tsc --noEmit; then
    echo "  ✅ TypeScript check passed"
else
    echo "  ❌ TypeScript check failed"
    FAILED_CHECKS="typecheck $FAILED_CHECKS"
fi

echo "  🧪 Running unit tests..."
if npm test -- --passWithNoTests; then
    echo "  ✅ Unit tests passed"
else
    echo "  ❌ Unit tests failed"
    FAILED_CHECKS="tests $FAILED_CHECKS"
fi

echo "  🏗️  Testing build..."
if npm run build; then
    echo "  ✅ Build succeeded"
else
    echo "  ❌ Build failed"
    FAILED_CHECKS="build $FAILED_CHECKS"
fi

# Check environment configuration
echo "🌍 Checking environment configuration..."
if [ -f ".env.example" ] || [ -f "env.production.template" ]; then
    echo "✅ Environment template found"
else
    echo "⚠️  Environment template not found"
fi

# Docker build test
echo "🐳 Testing Docker build..."
if docker build -t codemind-test . > /dev/null 2>&1; then
    echo "✅ Docker build succeeded"
    docker rmi codemind-test > /dev/null 2>&1
else
    echo "❌ Docker build failed"
    FAILED_CHECKS="docker $FAILED_CHECKS"
fi

# Security checks
echo "🔒 Running security checks..."
if npm audit --audit-level high > /dev/null 2>&1; then
    echo "✅ No high-severity security vulnerabilities found"
else
    echo "⚠️  Security vulnerabilities detected - run 'npm audit' for details"
fi

# Final summary
echo ""
echo "📊 Validation Summary"
echo "===================="

if [ -z "$FAILED_CHECKS" ]; then
    echo "🎉 All checks passed! CI/CD pipeline is ready."
    echo ""
    echo "Next steps:"
    echo "1. Push to GitHub to trigger the pipeline"
    echo "2. Set up repository secrets for deployment"
    echo "3. Configure environment-specific variables"
    echo ""
    exit 0
else
    echo "❌ The following checks failed: $FAILED_CHECKS"
    echo ""
    echo "Please fix the issues above before deploying."
    echo ""
    exit 1
fi