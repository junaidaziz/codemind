#!/bin/bash

# Production Monitoring Script for CodeMind
# This script continuously monitors the production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITOR_LOG="$PROJECT_ROOT/.azure/monitoring.log"

# App configuration
APP_URL="${NEXT_PUBLIC_APP_URL:-https://codemind.app}"
HEALTH_ENDPOINT="$APP_URL/api/health"
CHECK_INTERVAL="${CHECK_INTERVAL:-300}"  # 5 minutes
ALERT_THRESHOLD="${ALERT_THRESHOLD:-3}"   # Number of failed checks before alert

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$MONITOR_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$MONITOR_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$MONITOR_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$MONITOR_LOG"
}

# Initialize monitoring
init_monitoring() {
    mkdir -p "$(dirname "$MONITOR_LOG")"
    log_info "Starting CodeMind production monitoring"
    log_info "App URL: $APP_URL"
    log_info "Check interval: ${CHECK_INTERVAL}s"
    log_info "Alert threshold: $ALERT_THRESHOLD failed checks"
}

# Health check function
check_health() {
    local response_time
    local http_code
    local health_data
    
    # Measure response time and get HTTP status
    local start_time=$(date +%s.%N)
    
    http_code=$(curl -s -o /tmp/health_response.json -w "%{http_code}" \
        --max-time 30 \
        --connect-timeout 10 \
        "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
    
    local end_time=$(date +%s.%N)
    response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    # Parse health response
    if [ -f "/tmp/health_response.json" ]; then
        health_data=$(cat /tmp/health_response.json 2>/dev/null || echo "{}")
        rm -f /tmp/health_response.json
    else
        health_data="{}"
    fi
    
    # Check if health endpoint is accessible
    if [ "$http_code" = "200" ]; then
        local status=$(echo "$health_data" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        local db_status=$(echo "$health_data" | jq -r '.database // "unknown"' 2>/dev/null || echo "unknown")
        local redis_status=$(echo "$health_data" | jq -r '.redis // "unknown"' 2>/dev/null || echo "unknown")
        
        log_success "Health check passed (${response_time}s) - Status: $status, DB: $db_status, Redis: $redis_status"
        return 0
    else
        log_error "Health check failed - HTTP $http_code (${response_time}s)"
        return 1
    fi
}

# Performance check function
check_performance() {
    local start_time=$(date +%s.%N)
    
    # Test main page load time
    local main_page_code=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 30 \
        --connect-timeout 10 \
        "$APP_URL" 2>/dev/null || echo "000")
    
    local end_time=$(date +%s.%N)
    local load_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    if [ "$main_page_code" = "200" ]; then
        # Check if load time is acceptable (< 5 seconds)
        local load_time_int=$(echo "$load_time" | cut -d'.' -f1)
        if [ "$load_time_int" -lt 5 ]; then
            log_success "Performance check passed - Main page load: ${load_time}s"
            return 0
        else
            log_warning "Performance degraded - Main page load: ${load_time}s (>5s threshold)"
            return 1
        fi
    else
        log_error "Performance check failed - Main page HTTP $main_page_code"
        return 1
    fi
}

# SSL certificate check
check_ssl() {
    local domain=$(echo "$APP_URL" | sed -e 's|^https\?://||' -e 's|/.*||')
    local expiry_date
    
    # Get SSL certificate expiry date
    expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null | \
        openssl x509 -noout -enddate 2>/dev/null | \
        cut -d= -f2)
    
    if [ -n "$expiry_date" ]; then
        local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ "$days_until_expiry" -gt 30 ]; then
            log_success "SSL certificate valid - Expires in $days_until_expiry days"
            return 0
        elif [ "$days_until_expiry" -gt 7 ]; then
            log_warning "SSL certificate expires soon - $days_until_expiry days remaining"
            return 1
        else
            log_error "SSL certificate expires very soon - $days_until_expiry days remaining"
            return 1
        fi
    else
        log_error "SSL certificate check failed - Could not retrieve certificate info"
        return 1
    fi
}

# Database connectivity check
check_database() {
    # This is a basic check via the health endpoint
    # In a real scenario, you might want to connect directly to the database
    local health_response=$(curl -s --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "{}")
    local db_status=$(echo "$health_response" | jq -r '.database // "unknown"' 2>/dev/null || echo "unknown")
    
    if [ "$db_status" = "connected" ] || [ "$db_status" = "healthy" ]; then
        log_success "Database connectivity check passed"
        return 0
    else
        log_error "Database connectivity check failed - Status: $db_status"
        return 1
    fi
}

# External API check
check_external_apis() {
    # Check OpenAI API accessibility (without making actual requests)
    local openai_status="unknown"
    
    # This is a simplified check - in production you might want more sophisticated checks
    if curl -s --max-time 10 "https://api.openai.com/v1/models" -H "Authorization: Bearer invalid" 2>/dev/null | grep -q "Invalid"; then
        openai_status="accessible"
        log_success "External APIs check passed - OpenAI: accessible"
        return 0
    else
        log_warning "External APIs check failed - OpenAI may not be accessible"
        return 1
    fi
}

# Send alert function
send_alert() {
    local alert_message="$1"
    local severity="${2:-warning}"
    
    log_error "ALERT: $alert_message"
    
    # Example Slack notification (configure SLACK_WEBHOOK_URL)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local slack_payload=$(cat <<EOF
{
    "text": "🚨 CodeMind Production Alert",
    "attachments": [
        {
            "color": "danger",
            "fields": [
                {
                    "title": "Alert",
                    "value": "$alert_message",
                    "short": false
                },
                {
                    "title": "Timestamp",
                    "value": "$(date '+%Y-%m-%d %H:%M:%S UTC')",
                    "short": true
                },
                {
                    "title": "Severity",
                    "value": "$severity",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$slack_payload" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Example email alert (configure if needed)
    if [ -n "${ALERT_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
        echo "$alert_message" | mail -s "CodeMind Production Alert" "$ALERT_EMAIL" || true
    fi
}

# Main monitoring loop
run_monitoring() {
    local failed_checks=0
    local consecutive_failures=0
    
    while true; do
        log_info "Running health checks..."
        
        local checks_passed=0
        local total_checks=5
        
        # Run all checks
        check_health && ((checks_passed++)) || true
        check_performance && ((checks_passed++)) || true
        check_ssl && ((checks_passed++)) || true
        check_database && ((checks_passed++)) || true
        check_external_apis && ((checks_passed++)) || true
        
        # Calculate health score
        local health_score=$((checks_passed * 100 / total_checks))
        
        if [ "$checks_passed" -eq "$total_checks" ]; then
            log_success "All checks passed (Health: $health_score%)"
            consecutive_failures=0
        else
            ((consecutive_failures++))
            log_warning "$checks_passed/$total_checks checks passed (Health: $health_score%)"
            
            # Send alert if threshold reached
            if [ "$consecutive_failures" -ge "$ALERT_THRESHOLD" ]; then
                send_alert "CodeMind health degraded: $checks_passed/$total_checks checks passing for $consecutive_failures consecutive intervals" "critical"
                consecutive_failures=0  # Reset to avoid spam
            fi
        fi
        
        # Log system metrics
        log_info "System metrics - Load: $(uptime | awk -F'load average:' '{print $2}' | xargs) | Memory: $(free -h 2>/dev/null | grep '^Mem:' | awk '{print $3"/"$2}' || echo 'N/A')"
        
        # Wait for next check
        log_info "Next check in ${CHECK_INTERVAL} seconds..."
        sleep "$CHECK_INTERVAL"
    done
}

# One-time health check
run_single_check() {
    log_info "Running single health check..."
    
    local checks_passed=0
    local total_checks=5
    
    check_health && ((checks_passed++)) || true
    check_performance && ((checks_passed++)) || true
    check_ssl && ((checks_passed++)) || true
    check_database && ((checks_passed++)) || true
    check_external_apis && ((checks_passed++)) || true
    
    local health_score=$((checks_passed * 100 / total_checks))
    
    log_info "Health check completed: $checks_passed/$total_checks checks passed (Health: $health_score%)"
    
    if [ "$checks_passed" -eq "$total_checks" ]; then
        exit 0
    else
        exit 1
    fi
}

# Usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -c, --continuous    Run continuous monitoring (default)"
    echo "  -s, --single        Run single health check and exit"
    echo "  -i, --interval      Set check interval in seconds (default: 300)"
    echo "  -t, --threshold     Set alert threshold (default: 3)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  NEXT_PUBLIC_APP_URL  Application URL (default: https://codemind.app)"
    echo "  CHECK_INTERVAL       Check interval in seconds (default: 300)"
    echo "  ALERT_THRESHOLD      Alert threshold (default: 3)"
    echo "  SLACK_WEBHOOK_URL    Slack webhook URL for alerts"
    echo "  ALERT_EMAIL          Email address for alerts"
}

# Parse command line arguments
MODE="continuous"
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--continuous)
            MODE="continuous"
            shift
            ;;
        -s|--single)
            MODE="single"
            shift
            ;;
        -i|--interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        -t|--threshold)
            ALERT_THRESHOLD="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    init_monitoring
    
    case "$MODE" in
        "continuous")
            run_monitoring
            ;;
        "single")
            run_single_check
            ;;
        *)
            echo "Invalid mode: $MODE"
            exit 1
            ;;
    esac
}

# Handle cleanup on exit
cleanup() {
    log_info "Monitoring stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Run main function
main "$@"