#!/bin/bash

# CodeMind Testing and Deployment Scripts Runner
# Usage: ./scripts/run-tests.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Available commands
show_help() {
    echo "CodeMind Testing and Deployment Scripts"
    echo ""
    echo "Usage: ./scripts/run-tests.sh [command]"
    echo ""
    echo "Available commands:"
    echo "  multi-project    - Run multi-project analytics testing"
    echo "  verify-local     - Verify local development deployment"
    echo "  verify-staging   - Verify staging deployment"
    echo "  verify-prod      - Verify production deployment"
    echo "  github-integration - Test GitHub integration"
    echo "  webhook-pipeline - Validate webhook pipeline"
    echo "  all-tests       - Run all available tests"
    echo "  help            - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/run-tests.sh multi-project"
    echo "  ./scripts/run-tests.sh verify-staging"
    echo "  ./scripts/run-tests.sh all-tests"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check if tsx is available (for TypeScript execution)
    if ! command -v tsx &> /dev/null && ! npm list -g tsx &> /dev/null; then
        log_warning "tsx not found globally, installing locally..."
        npm install tsx --save-dev
    fi
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        log_warning ".env file not found, some tests may fail"
    fi
    
    # Ensure logs directory exists
    mkdir -p logs
    
    log_success "Prerequisites check completed"
}

# Run multi-project analytics testing
run_multi_project_test() {
    log_info "Running multi-project analytics testing..."
    
    if command -v tsx &> /dev/null; then
        tsx scripts/test-multi-project-analytics.ts
    else
        npx tsx scripts/test-multi-project-analytics.ts
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Multi-project testing completed successfully"
    else
        log_error "Multi-project testing failed"
        exit 1
    fi
}

# Run deployment verification
run_deployment_verification() {
    local env=${1:-local}
    log_info "Running deployment verification for: $env"
    
    node scripts/deployment-verification.mjs $env
    
    if [ $? -eq 0 ]; then
        log_success "Deployment verification passed for $env"
    else
        log_error "Deployment verification failed for $env"
        exit 1
    fi
}

# Run GitHub integration test
run_github_integration_test() {
    log_info "Running GitHub integration test..."
    
    if command -v tsx &> /dev/null; then
        tsx scripts/test-github-integration.ts
    else
        npx tsx scripts/test-github-integration.ts
    fi
    
    if [ $? -eq 0 ]; then
        log_success "GitHub integration test completed successfully"
    else
        log_error "GitHub integration test failed"
        exit 1
    fi
}

# Run webhook pipeline validation
run_webhook_pipeline_test() {
    log_info "Running webhook pipeline validation..."
    
    if command -v tsx &> /dev/null; then
        tsx scripts/validate-webhook-pipeline.ts
    else
        npx tsx scripts/validate-webhook-pipeline.ts
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Webhook pipeline validation completed successfully"
    else
        log_error "Webhook pipeline validation failed"
        exit 1
    fi
}

# Run all tests
run_all_tests() {
    log_info "Running all CodeMind tests..."
    
    local start_time=$(date +%s)
    local failed_tests=()
    
    # Run GitHub integration test
    log_info "1/4 - GitHub Integration Test"
    if ! run_github_integration_test; then
        failed_tests+=("GitHub Integration")
    fi
    
    # Run webhook pipeline validation
    log_info "2/4 - Webhook Pipeline Validation"
    if ! run_webhook_pipeline_test; then
        failed_tests+=("Webhook Pipeline")
    fi
    
    # Run multi-project testing
    log_info "3/4 - Multi-Project Analytics Testing"
    if ! run_multi_project_test; then
        failed_tests+=("Multi-Project Analytics")
    fi
    
    # Run local deployment verification
    log_info "4/4 - Local Deployment Verification"
    if ! run_deployment_verification "local"; then
        failed_tests+=("Local Deployment")
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "==============================================="
    echo "All Tests Summary"
    echo "==============================================="
    echo "Total execution time: ${duration}s"
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        log_success "All tests passed! ✅"
        echo ""
        echo "Your CodeMind application is ready for deployment!"
    else
        log_error "Some tests failed: ${failed_tests[*]}"
        echo ""
        echo "Please check the logs above and fix the failing tests."
        exit 1
    fi
}

# Generate test report
generate_report() {
    log_info "Generating comprehensive test report..."
    
    local report_file="logs/test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# CodeMind Testing Report

**Generated:** $(date)
**Environment:** $(node --version)

## Test Results Summary

EOF

    # Add recent test results if available
    if [ -f "logs/multi-project-test-report.json" ]; then
        echo "### Multi-Project Analytics Test" >> "$report_file"
        echo "✅ Completed - See logs/multi-project-test-report.json for details" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if ls logs/deployment-verification-*.json &> /dev/null; then
        echo "### Deployment Verification" >> "$report_file"
        echo "✅ Completed - See logs/deployment-verification-*.json for details" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    echo "### System Information" >> "$report_file"
    echo "- Node.js: $(node --version)" >> "$report_file"
    echo "- npm: $(npm --version)" >> "$report_file"
    echo "- OS: $(uname -s)" >> "$report_file"
    echo "" >> "$report_file"
    
    log_success "Report generated: $report_file"
}

# Main command handler
main() {
    local command=${1:-help}
    
    case $command in
        "multi-project")
            check_prerequisites
            run_multi_project_test
            ;;
        "verify-local")
            check_prerequisites
            run_deployment_verification "local"
            ;;
        "verify-staging")
            check_prerequisites
            run_deployment_verification "staging"
            ;;
        "verify-prod")
            check_prerequisites
            run_deployment_verification "production"
            ;;
        "github-integration")
            check_prerequisites
            run_github_integration_test
            ;;
        "webhook-pipeline")
            check_prerequisites
            run_webhook_pipeline_test
            ;;
        "all-tests")
            check_prerequisites
            run_all_tests
            ;;
        "report")
            generate_report
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Execute main function with all arguments
main "$@"