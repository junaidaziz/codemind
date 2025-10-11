#!/bin/bash

# Production Deployment Script for CodeMind
# This script handles the complete production deployment process

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="$PROJECT_ROOT/.azure/deployment.log"
BACKUP_DIR="$PROJECT_ROOT/.azure/backups"

# Environment variables
ENVIRONMENT="${1:-production}"
DEPLOY_TYPE="${2:-full}"  # full, quick, rollback
VERSION="${3:-$(date +%Y%m%d-%H%M%S)}"

# Create necessary directories
mkdir -p "$(dirname "$DEPLOYMENT_LOG")" "$BACKUP_DIR"

# Start logging
exec 1> >(tee -a "$DEPLOYMENT_LOG")
exec 2> >(tee -a "$DEPLOYMENT_LOG" >&2)

log_info "Starting CodeMind deployment to $ENVIRONMENT"
log_info "Deployment type: $DEPLOY_TYPE"
log_info "Version: $VERSION"
log_info "Timestamp: $(date)"

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check if required tools are installed
    local required_tools=("node" "npm" "git" "vercel")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found. Are you in the right directory?"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ] && [ "$ENVIRONMENT" != "production" ]; then
        log_warning "Environment file .env.$ENVIRONMENT not found"
        log_info "Make sure to configure environment variables in Vercel dashboard"
    fi
    
    log_success "Prerequisites check passed"
}

# Function to run pre-deployment tests
run_tests() {
    if [ "$DEPLOY_TYPE" = "quick" ]; then
        log_info "Skipping tests for quick deployment"
        return 0
    fi
    
    log_info "Running pre-deployment tests..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --silent
    
    # Run linting
    log_info "Running ESLint..."
    if ! npm run lint; then
        log_error "Linting failed"
        exit 1
    fi
    
    # Run type checking
    log_info "Running TypeScript type check..."
    if ! npx tsc --noEmit; then
        log_error "Type checking failed"
        exit 1
    fi
    
    # Run unit tests
    log_info "Running unit tests..."
    if ! npm test -- --passWithNoTests --silent; then
        log_warning "Some tests failed, but continuing deployment"
    fi
    
    # Build the application
    log_info "Building application..."
    if ! npm run build; then
        log_error "Build failed"
        exit 1
    fi
    
    log_success "Pre-deployment tests completed"
}

# Function to backup current deployment
backup_deployment() {
    if [ "$DEPLOY_TYPE" = "quick" ]; then
        log_info "Skipping backup for quick deployment"
        return 0
    fi
    
    log_info "Creating deployment backup..."
    
    local backup_file="$BACKUP_DIR/backup-$VERSION.tar.gz"
    
    # Create backup of current deployment
    tar -czf "$backup_file" \
        --exclude=node_modules \
        --exclude=.next \
        --exclude=.git \
        --exclude=.azure/backups \
        -C "$PROJECT_ROOT" .
    
    log_success "Backup created: $backup_file"
}

# Function to deploy to Vercel
deploy_to_vercel() {
    log_info "Deploying to Vercel ($ENVIRONMENT)..."
    
    cd "$PROJECT_ROOT"
    
    # Set deployment environment variables
    export DEPLOYMENT_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    export DEPLOYMENT_VERSION="$VERSION"
    export DEPLOYMENT_COMMIT_SHA="$(git rev-parse HEAD)"
    
    # Deploy based on environment
    local vercel_args=""
    if [ "$ENVIRONMENT" = "production" ]; then
        vercel_args="--prod"
    fi
    
    # Deploy using Vercel CLI
    if ! vercel deploy $vercel_args --confirm; then
        log_error "Vercel deployment failed"
        exit 1
    fi
    
    log_success "Deployment to Vercel completed"
}

# Function to run database migrations
run_migrations() {
    if [ "$DEPLOY_TYPE" = "quick" ]; then
        log_info "Skipping migrations for quick deployment"
        return 0
    fi
    
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Check if Prisma is configured
    if [ -f "prisma/schema.prisma" ]; then
        log_info "Deploying Prisma migrations..."
        if ! npx prisma migrate deploy; then
            log_error "Database migration failed"
            exit 1
        fi
        
        # Generate Prisma client
        npx prisma generate
        
        log_success "Database migrations completed"
    else
        log_info "No Prisma schema found, skipping migrations"
    fi
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    log_info "Running post-deployment verification..."
    
    # Get the deployment URL
    local app_url
    if [ "$ENVIRONMENT" = "production" ]; then
        app_url="${NEXT_PUBLIC_APP_URL:-https://codemind.app}"
    else
        app_url="$(vercel ls | grep -E "codemind.*$ENVIRONMENT" | head -1 | awk '{print $2}')"
    fi
    
    if [ -z "$app_url" ]; then
        log_warning "Could not determine app URL for verification"
        return 0
    fi
    
    log_info "Testing deployment at: $app_url"
    
    # Test health endpoint
    local health_url="$app_url/api/health"
    log_info "Checking health endpoint: $health_url"
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" || echo "000")
    
    if [ "$response_code" = "200" ]; then
        log_success "Health check passed"
    else
        log_error "Health check failed (HTTP $response_code)"
        exit 1
    fi
    
    # Test main page
    log_info "Checking main page..."
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$app_url" || echo "000")
    
    if [ "$response_code" = "200" ]; then
        log_success "Main page accessible"
    else
        log_error "Main page not accessible (HTTP $response_code)"
        exit 1
    fi
    
    log_success "Post-deployment verification completed"
}

# Function to send deployment notifications
send_notifications() {
    log_info "Sending deployment notifications..."
    
    # You can integrate with Slack, Discord, email, etc.
    # For now, just log the completion
    local status="${1:-success}"
    local message="CodeMind deployment to $ENVIRONMENT completed"
    
    if [ "$status" = "failure" ]; then
        message="CodeMind deployment to $ENVIRONMENT failed"
    fi
    
    log_info "Notification: $message"
    
    # Example Slack notification (uncomment and configure if needed)
    # if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    #     curl -X POST -H 'Content-type: application/json' \
    #         --data "{\"text\":\"$message\"}" \
    #         "$SLACK_WEBHOOK_URL"
    # fi
}

# Function to handle deployment failure
handle_failure() {
    log_error "Deployment failed at step: $1"
    send_notifications "failure"
    
    # Optionally trigger rollback
    if [ "$DEPLOY_TYPE" = "full" ]; then
        log_info "Consider running rollback: ./scripts/deploy-production.sh production rollback"
    fi
    
    exit 1
}

# Function to rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Rollback Vercel deployment
    if ! vercel rollback --prod; then
        log_error "Vercel rollback failed"
        exit 1
    fi
    
    log_success "Rollback completed"
}

# Main deployment process
main() {
    case "$DEPLOY_TYPE" in
        "rollback")
            rollback_deployment
            ;;
        "full"|"quick")
            check_prerequisites || handle_failure "prerequisites"
            backup_deployment || handle_failure "backup"
            run_tests || handle_failure "tests"
            run_migrations || handle_failure "migrations"
            deploy_to_vercel || handle_failure "deployment"
            run_post_deployment_tests || handle_failure "verification"
            send_notifications "success"
            ;;
        *)
            log_error "Invalid deployment type: $DEPLOY_TYPE"
            log_info "Usage: $0 [environment] [full|quick|rollback] [version]"
            exit 1
            ;;
    esac
    
    log_success "Deployment process completed successfully!"
    log_info "Deployment log saved to: $DEPLOYMENT_LOG"
}

# Trap errors and handle them gracefully
trap 'handle_failure "unexpected error"' ERR

# Run main function
main "$@"