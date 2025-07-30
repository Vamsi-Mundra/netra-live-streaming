#!/bin/bash

echo "Netra Streaming System - Fix Verification"
echo "========================================="

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
print_status "INFO" "Phase 1: Service Health Check"

# Check if services are running
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
print_status "INFO" "Phase 2: SFU Server Analysis"

# Check SFU logs for any errors
echo "Checking SFU logs for the last 30 seconds..."
SFU_LOGS=$(docker-compose logs --since=30s sfu 2>/dev/null)

if echo "$SFU_LOGS" | grep -q "room null"; then
    print_status "ERROR" "Found 'room null' errors in SFU logs - room tracking issue still exists"
    echo "Recent SFU logs:"
    echo "$SFU_LOGS" | tail -10
else
    print_status "SUCCESS" "No 'room null' errors found in recent SFU logs"
fi

if echo "$SFU_LOGS" | grep -q "Client.*connected"; then
    print_status "SUCCESS" "SFU is accepting WebSocket connections"
else
    print_status "WARNING" "No recent WebSocket connections detected"
fi

echo ""
print_status "INFO" "Phase 3: System Status"

echo "Service URLs:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend:  http://localhost:3000"
echo "  - SFU:      http://localhost:5001"
echo "  - Database: localhost:5434"

echo ""
print_status "INFO" "Phase 4: Manual Testing Instructions"

echo "To test the streaming system:"
echo ""
echo "1. Open http://localhost:5173 in your browser"
echo "2. Sign in to your account"
echo "3. Click 'Start Stream' to begin streaming"
echo "4. Note the Room ID that appears"
echo "5. Open a new tab/window and go to:"
echo "   http://localhost:5173/viewer/[ROOM_ID]"
echo "6. Check if the video stream appears"
echo ""
echo "7. Monitor SFU logs for proper signaling:"
echo "   docker-compose logs -f sfu"
echo ""
echo "Expected behavior:"
echo "  - No 'room null' errors in SFU logs"
echo "  - Clear 'Streamer' and 'Viewer' role messages"
echo "  - Proper offer/answer exchange"
echo "  - Video stream received in viewer"

echo ""
print_status "INFO" "Phase 5: Key Improvements Made"

echo "✓ Enhanced SFU server room tracking"
echo "✓ Added comprehensive message validation"
echo "✓ Established clear WebRTC roles (Streamer/Viewer)"
echo "✓ Improved error handling and logging"
echo "✓ Added connection state monitoring"
echo "✓ Fixed bidirectional offer creation issue"

echo ""
print_status "INFO" "Phase 6: Success Criteria Check"

echo "Functional Requirements:"
echo "  □ Streamer can start a stream"
echo "  □ Viewer can join and receive video"
echo "  □ No 'room null' errors in logs"
echo "  □ Clear role-based signaling"
echo "  □ Proper WebRTC connection establishment"

echo ""
print_status "INFO" "Verification Complete!"
echo ""
echo "Next steps:"
echo "1. Perform manual testing as described above"
echo "2. Monitor SFU logs during testing"
echo "3. Report any issues found"
echo "4. If issues persist, check browser console for errors" 