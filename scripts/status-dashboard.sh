#!/bin/bash

# Production Status Dashboard for CodeMind
# Displays real-time production status and metrics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configuration
APP_URL="${NEXT_PUBLIC_APP_URL:-https://codemind.app}"
HEALTH_ENDPOINT="$APP_URL/api/health"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-30}"

# Unicode symbols
CHECKMARK="✅"
CROSS="❌"
WARNING="⚠️ "
INFO="ℹ️ "
ROCKET="🚀"
CHART="📊"
DATABASE="🗄️ "
REDIS="📦"
OPENAI="🤖"
SSL="🔒"
PERFORMANCE="⚡"

# Clear screen function
clear_screen() {
    printf '\033[2J\033[H'
}

# Get current timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S UTC'
}

# Get system uptime
get_uptime() {
    if command -v uptime >/dev/null 2>&1; then
        uptime -p 2>/dev/null || uptime | awk '{print $3,$4}' | sed 's/,//'
    else
        echo "N/A"
    fi
}

# Get load average
get_load() {
    if command -v uptime >/dev/null 2>&1; then
        uptime | awk -F'load average:' '{print $2}' | xargs | cut -d' ' -f1
    else
        echo "N/A"
    fi
}

# Check HTTP endpoint
check_endpoint() {
    local url="$1"
    local timeout="${2:-10}"
    
    local start_time=$(date +%s.%N 2>/dev/null || date +%s)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    local end_time=$(date +%s.%N 2>/dev/null || date +%s)
    
    local response_time
    if command -v bc >/dev/null 2>&1; then
        response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        response_time=$(printf "%.3f" "$response_time" 2>/dev/null || echo "$response_time")
    else
        response_time=$(echo "$end_time - $start_time" | awk '{printf "%.3f", $1}')
    fi
    
    echo "$http_code|$response_time"
}

# Get health status
get_health_status() {
    local health_response=$(curl -s --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "{}")
    
    # Parse JSON safely
    local status="unknown"
    local database="unknown"
    local redis="unknown"
    local openai="unknown"
    local uptime="0"
    local version="unknown"
    
    if command -v jq >/dev/null 2>&1; then
        status=$(echo "$health_response" | jq -r '.status // "unknown"' 2>/dev/null)
        database=$(echo "$health_response" | jq -r '.database // "unknown"' 2>/dev/null)
        redis=$(echo "$health_response" | jq -r '.redis // "unknown"' 2>/dev/null)
        openai=$(echo "$health_response" | jq -r '.openai // "unknown"' 2>/dev/null)
        uptime=$(echo "$health_response" | jq -r '.uptime // 0' 2>/dev/null)
        version=$(echo "$health_response" | jq -r '.version // "unknown"' 2>/dev/null)
    else
        # Fallback parsing without jq
        if echo "$health_response" | grep -q '"status"'; then
            status=$(echo "$health_response" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
        fi
        if echo "$health_response" | grep -q '"database"'; then
            database=$(echo "$health_response" | sed -n 's/.*"database":"\([^"]*\)".*/\1/p')
        fi
    fi
    
    echo "$status|$database|$redis|$openai|$uptime|$version"
}

# Check SSL certificate
check_ssl_status() {
    local domain=$(echo "$APP_URL" | sed -e 's|^https\?://||' -e 's|/.*||')
    
    local expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null | \
        openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$expiry_date" ]; then
        local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        echo "$days_until_expiry"
    else
        echo "unknown"
    fi
}

# Format status indicator
format_status() {
    local status="$1"
    case "$status" in
        "healthy"|"connected"|"accessible"|"200")
            echo -e "${GREEN}${CHECKMARK} $status${NC}"
            ;;
        "degraded"|"warning")
            echo -e "${YELLOW}${WARNING}$status${NC}"
            ;;
        "unhealthy"|"disconnected"|"error"|"000"|"404"|"500"|"503")
            echo -e "${RED}${CROSS} $status${NC}"
            ;;
        *)
            echo -e "${YELLOW}${INFO}$status${NC}"
            ;;
    esac
}

# Format response time
format_response_time() {
    local time="$1"
    local time_ms=$(echo "$time * 1000" | bc -l 2>/dev/null || echo "0")
    local time_ms_int=$(echo "$time_ms" | cut -d'.' -f1)
    
    if [ "$time_ms_int" -lt 200 ]; then
        echo -e "${GREEN}${time}s${NC}"
    elif [ "$time_ms_int" -lt 1000 ]; then
        echo -e "${YELLOW}${time}s${NC}"
    else
        echo -e "${RED}${time}s${NC}"
    fi
}

# Format SSL days
format_ssl_days() {
    local days="$1"
    if [ "$days" = "unknown" ]; then
        echo -e "${YELLOW}${INFO}Unknown${NC}"
    elif [ "$days" -gt 30 ]; then
        echo -e "${GREEN}${CHECKMARK} $days days${NC}"
    elif [ "$days" -gt 7 ]; then
        echo -e "${YELLOW}${WARNING}$days days${NC}"
    else
        echo -e "${RED}${CROSS} $days days${NC}"
    fi
}

# Display header
display_header() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                         ${ROCKET} CodeMind Production Status Dashboard                         ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║ ${BLUE}URL:${NC} $APP_URL"
    printf "${WHITE}║ ${BLUE}Updated:${NC} %-66s ║${NC}\n" "$(get_timestamp)"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Display system info
display_system_info() {
    echo -e "${CYAN}┌─ ${CHART} System Information${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────${NC}"
    printf "│ %-20s %s\n" "Uptime:" "$(get_uptime)"
    printf "│ %-20s %s\n" "Load Average:" "$(get_load)"
    printf "│ %-20s %s\n" "Refresh Interval:" "${REFRESH_INTERVAL}s"
    echo -e "${CYAN}└─────────────────────────────────────────────────${NC}"
    echo ""
}

# Display application status
display_app_status() {
    echo -e "${MAGENTA}┌─ ${ROCKET} Application Status${NC}"
    echo -e "${MAGENTA}├─────────────────────────────────────────────────${NC}"
    
    # Get health status
    local health_info=$(get_health_status)
    IFS='|' read -r app_status db_status redis_status openai_status app_uptime app_version <<< "$health_info"
    
    # Main application check
    local main_check=$(check_endpoint "$APP_URL" 10)
    IFS='|' read -r main_code main_time <<< "$main_check"
    
    # Health endpoint check
    local health_check=$(check_endpoint "$HEALTH_ENDPOINT" 10)
    IFS='|' read -r health_code health_time <<< "$health_check"
    
    printf "│ %-20s %s (%s)\n" "Application:" "$(format_status "$main_code")" "$(format_response_time "$main_time")"
    printf "│ %-20s %s (%s)\n" "Health Endpoint:" "$(format_status "$health_code")" "$(format_response_time "$health_time")"
    printf "│ %-20s %s\n" "App Status:" "$(format_status "$app_status")"
    printf "│ %-20s %s\n" "App Version:" "$app_version"
    
    if [ "$app_uptime" != "0" ] && [ "$app_uptime" != "unknown" ]; then
        local uptime_hours=$(echo "$app_uptime / 3600" | bc -l 2>/dev/null || echo "0")
        printf "│ %-20s %.1fh\n" "App Uptime:" "$uptime_hours"
    fi
    
    echo -e "${MAGENTA}└─────────────────────────────────────────────────${NC}"
    echo ""
}

# Display service status
display_services_status() {
    echo -e "${BLUE}┌─ ${DATABASE}${REDIS}${OPENAI} Services Status${NC}"
    echo -e "${BLUE}├─────────────────────────────────────────────────${NC}"
    
    # Get health status
    local health_info=$(get_health_status)
    IFS='|' read -r app_status db_status redis_status openai_status app_uptime app_version <<< "$health_info"
    
    printf "│ %-20s %s\n" "${DATABASE}Database:" "$(format_status "$db_status")"
    printf "│ %-20s %s\n" "${REDIS}Redis Cache:" "$(format_status "$redis_status")"
    printf "│ %-20s %s\n" "${OPENAI}OpenAI API:" "$(format_status "$openai_status")"
    
    echo -e "${BLUE}└─────────────────────────────────────────────────${NC}"
    echo ""
}

# Display security status
display_security_status() {
    echo -e "${GREEN}┌─ ${SSL} Security Status${NC}"
    echo -e "${GREEN}├─────────────────────────────────────────────────${NC}"
    
    # SSL certificate check
    local ssl_days=$(check_ssl_status)
    printf "│ %-20s %s\n" "SSL Certificate:" "$(format_ssl_days "$ssl_days")"
    
    # HTTPS redirect check
    local http_url=$(echo "$APP_URL" | sed 's/https:/http:/')
    local redirect_check=$(check_endpoint "$http_url" 5)
    IFS='|' read -r redirect_code redirect_time <<< "$redirect_check"
    
    local https_status="Unknown"
    if [ "$redirect_code" = "301" ] || [ "$redirect_code" = "302" ] || [ "$redirect_code" = "308" ]; then
        https_status="Enforced"
    elif [ "$redirect_code" = "200" ]; then
        https_status="Not Enforced"
    fi
    
    printf "│ %-20s %s\n" "HTTPS Redirect:" "$(format_status "$https_status")"
    
    echo -e "${GREEN}└─────────────────────────────────────────────────${NC}"
    echo ""
}

# Display performance metrics
display_performance() {
    echo -e "${YELLOW}┌─ ${PERFORMANCE} Performance Metrics${NC}"
    echo -e "${YELLOW}├─────────────────────────────────────────────────${NC}"
    
    # Main page performance
    local main_check=$(check_endpoint "$APP_URL" 10)
    IFS='|' read -r main_code main_time <<< "$main_check"
    
    # API performance
    local api_check=$(check_endpoint "$HEALTH_ENDPOINT" 10)
    IFS='|' read -r api_code api_time <<< "$api_check"
    
    # Documentation page performance
    local docs_check=$(check_endpoint "$APP_URL/docs" 10)
    IFS='|' read -r docs_code docs_time <<< "$docs_check"
    
    printf "│ %-20s %s\n" "Main Page Load:" "$(format_response_time "$main_time")"
    printf "│ %-20s %s\n" "API Response:" "$(format_response_time "$api_time")"
    printf "│ %-20s %s\n" "Docs Page Load:" "$(format_response_time "$docs_time")"
    
    # Performance status
    local main_time_ms=$(echo "$main_time * 1000" | bc -l 2>/dev/null || echo "0")
    local api_time_ms=$(echo "$api_time * 1000" | bc -l 2>/dev/null || echo "0")
    
    local perf_status="Good"
    if [ "$(echo "$main_time_ms > 3000" | bc -l 2>/dev/null || echo "0")" = "1" ] || \
       [ "$(echo "$api_time_ms > 1000" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        perf_status="Poor"
    elif [ "$(echo "$main_time_ms > 2000" | bc -l 2>/dev/null || echo "0")" = "1" ] || \
         [ "$(echo "$api_time_ms > 500" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        perf_status="Fair"
    fi
    
    printf "│ %-20s %s\n" "Overall:" "$(format_status "$perf_status")"
    
    echo -e "${YELLOW}└─────────────────────────────────────────────────${NC}"
    echo ""
}

# Display footer
display_footer() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║ Press Ctrl+C to exit | Auto-refresh every ${REFRESH_INTERVAL} seconds                                   ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════════════════════╝${NC}"
}

# Display single status check
display_single_check() {
    clear_screen
    display_header
    display_system_info
    display_app_status
    display_services_status
    display_security_status
    display_performance
    display_footer
}

# Continuous monitoring mode
continuous_monitoring() {
    while true; do
        display_single_check
        sleep "$REFRESH_INTERVAL"
    done
}

# Usage information
show_usage() {
    echo "CodeMind Production Status Dashboard"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -c, --continuous    Run continuous monitoring (default)"
    echo "  -s, --single        Run single status check and exit"
    echo "  -i, --interval SEC  Set refresh interval in seconds (default: 30)"
    echo "  -u, --url URL       Set application URL"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  NEXT_PUBLIC_APP_URL  Application URL (default: https://codemind.app)"
    echo "  REFRESH_INTERVAL     Refresh interval in seconds (default: 30)"
    echo ""
    echo "Examples:"
    echo "  $0                              # Continuous monitoring"
    echo "  $0 -s                           # Single check"
    echo "  $0 -i 60                        # Refresh every 60 seconds"
    echo "  $0 -u https://staging.app       # Monitor staging environment"
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
            REFRESH_INTERVAL="$2"
            shift 2
            ;;
        -u|--url)
            APP_URL="$2"
            HEALTH_ENDPOINT="$APP_URL/api/health"
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

# Handle cleanup on exit
cleanup() {
    clear_screen
    echo "Status dashboard stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main execution
case "$MODE" in
    "continuous")
        continuous_monitoring
        ;;
    "single")
        display_single_check
        ;;
    *)
        echo "Invalid mode: $MODE"
        exit 1
        ;;
esac