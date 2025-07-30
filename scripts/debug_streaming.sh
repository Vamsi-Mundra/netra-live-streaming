#!/bin/bash

echo "Netra Streaming System - Debug Mode"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}✗${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
}

echo ""
print_status "INFO" "Starting comprehensive debugging..."

# Check if services are running
echo ""
print_status "INFO" "Phase 1: Service Health Check"

if curl -f http://localhost:3000/healthz > /dev/null 2>&1; then
    print_status "SUCCESS" "Backend is running and healthy"
else
    print_status "ERROR" "Backend is not running or unhealthy"
    exit 1
fi

if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    print_status "SUCCESS" "SFU is running and healthy"
else
    print_status "ERROR" "SFU is not running or unhealthy"
    exit 1
fi

if curl -f http://localhost:5173 > /dev/null 2>&1; then
    print_status "SUCCESS" "Frontend is accessible"
else
    print_status "ERROR" "Frontend is not accessible"
    exit 1
fi

echo ""
print_status "INFO" "Phase 2: SFU Log Analysis"

# Check for recent SFU logs
echo "Checking SFU logs for the last 60 seconds..."
SFU_LOGS=$(docker-compose logs --since=60s sfu 2>/dev/null)

if [ -z "$SFU_LOGS" ]; then
    print_status "WARNING" "No recent SFU logs found - system may be idle"
else
    print_status "SUCCESS" "SFU logs are being generated"
    
    # Check for specific issues
    if echo "$SFU_LOGS" | grep -q "room null"; then
        print_status "ERROR" "Found 'room null' errors in SFU logs"
        echo "Recent problematic logs:"
        echo "$SFU_LOGS" | grep "room null" | tail -5
    else
        print_status "SUCCESS" "No 'room null' errors found in recent logs"
    fi
    
    if echo "$SFU_LOGS" | grep -q "Client.*connected"; then
        print_status "SUCCESS" "WebSocket connections are being established"
    else
        print_status "WARNING" "No recent WebSocket connections detected"
    fi
    
    if echo "$SFU_LOGS" | grep -q "CURRENT STATE"; then
        print_status "SUCCESS" "Enhanced state logging is working"
    else
        print_status "WARNING" "Enhanced state logging not detected"
    fi
fi

echo ""
print_status "INFO" "Phase 3: Real-time Monitoring Setup"

echo "To monitor SFU logs in real-time, run:"
echo "  docker-compose logs -f sfu"
echo ""
echo "To monitor all services:"
echo "  docker-compose logs -f"
echo ""
echo "To check specific service:"
echo "  docker-compose logs -f [service_name]"

echo ""
print_status "INFO" "Phase 4: Manual Testing Instructions"

echo "1. Open http://localhost:5173 in your browser"
echo "2. Open browser developer tools (F12)"
echo "3. Go to Console tab to see frontend logs"
echo "4. Sign in and start a stream"
echo "5. Note the Room ID that appears"
echo "6. Open a new tab/window and go to:"
echo "   http://localhost:5173/viewer/[ROOM_ID]"
echo "7. Check both browser consoles for detailed logs"
echo "8. Monitor SFU logs for server-side debugging"

echo ""
print_status "INFO" "Phase 5: Expected Log Patterns"

echo "When working correctly, you should see:"
echo ""
echo "SFU Logs:"
echo "  ✓ Client [ID] connected, total clients: X"
echo "  ✓ Client [ID] joining room [ROOM_ID]"
echo "  ✓ Room [ROOM_ID] now has X clients: [client list]"
echo "  ✓ handleOffer called: clientId=[ID], providedRoomId=[ROOM_ID], actualRoomId=[ROOM_ID]"
echo "  ✓ Forwarding offer from [ID] to [ID]"
echo "  ✓ No 'room null' errors"
echo ""
echo "Frontend Logs (Streamer):"
echo "  ✓ Streamer sending join message: {type: 'join', roomId: '[ROOM_ID]'}"
echo "  ✓ Streamer creating offer for viewer: [ID]"
echo "  ✓ Streamer sending offer message: {type: 'offer', roomId: '[ROOM_ID]', payload: {...}}"
echo ""
echo "Frontend Logs (Viewer):"
echo "  ✓ Viewer sending join message: {type: 'join', roomId: '[ROOM_ID]'}"
echo "  ✓ Viewer handling offer from streamer: [ID]"
echo "  ✓ Viewer sending answer message: {type: 'answer', roomId: '[ROOM_ID]', payload: {...}}"

echo ""
print_status "INFO" "Phase 6: Debugging Commands"

echo "Useful debugging commands:"
echo ""
echo "Check container status:"
echo "  docker-compose ps"
echo ""
echo "View recent logs:"
echo "  docker-compose logs --since=5m sfu"
echo "  docker-compose logs --since=5m frontend"
echo "  docker-compose logs --since=5m backend"
echo ""
echo "Restart specific service:"
echo "  docker-compose restart sfu"
echo "  docker-compose restart frontend"
echo ""
echo "Rebuild and restart:"
echo "  docker-compose down"
echo "  docker-compose build --no-cache"
echo "  docker-compose up -d"

echo ""
print_status "INFO" "Phase 7: Issue Reporting"

echo "If issues persist, collect the following information:"
echo "1. SFU logs: docker-compose logs sfu > sfu_logs.txt"
echo "2. Frontend logs: Check browser console and save"
echo "3. Backend logs: docker-compose logs backend > backend_logs.txt"
echo "4. Browser information: Version, OS, network conditions"
echo "5. Steps to reproduce the issue"

echo ""
print_status "INFO" "Debug mode ready!"
echo ""
echo "Next steps:"
echo "1. Start manual testing as described above"
echo "2. Monitor logs in real-time"
echo "3. Report any issues with detailed logs"
echo "4. Check browser console for frontend errors" 