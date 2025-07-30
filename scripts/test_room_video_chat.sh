#!/bin/bash

echo "Testing Netra Room-Based Video Chat Feature"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to check if a service is running
check_service() {
    local service=$1
    local url=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$response" = "200" ] || [ "$response" = "ok" ]; then
        return 0
    else
        return 1
    fi
}

echo "1. Checking if all services are running..."

# Check backend
if check_service "backend" "http://localhost:3000/healthz"; then
    print_status 0 "Backend is running"
else
    print_status 1 "Backend is not running"
    exit 1
fi

# Check SFU
if check_service "sfu" "http://localhost:5001/health"; then
    print_status 0 "SFU is running"
else
    print_status 1 "SFU is not running"
    exit 1
fi

# Check frontend
if check_service "frontend" "http://localhost:5173"; then
    print_status 0 "Frontend is running"
else
    print_status 1 "Frontend is not running"
    exit 1
fi

echo ""
echo "2. Testing database connectivity..."

# Test database connection by checking if we can create a user
DB_TEST=$(curl -s -X POST http://localhost:3000/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpass123"}' 2>/dev/null)

if echo "$DB_TEST" | grep -q "token"; then
    print_status 0 "Database is accessible and working"
else
    print_status 1 "Database connection failed"
    echo "Response: $DB_TEST"
fi

echo ""
echo "3. Testing room creation..."

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpass123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    print_status 1 "Failed to get authentication token"
    exit 1
fi

print_status 0 "Authentication successful"

# Create a test room
ROOM_RESPONSE=$(curl -s -X POST http://localhost:3000/rooms \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Test Video Chat Room","description":"Testing room functionality","maxParticipants":5}')

if echo "$ROOM_RESPONSE" | grep -q "id"; then
    ROOM_ID=$(echo "$ROOM_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_status 0 "Room created successfully (ID: $ROOM_ID)"
else
    print_status 1 "Failed to create room"
    echo "Response: $ROOM_RESPONSE"
    exit 1
fi

echo ""
echo "4. Testing room joining..."

# Join the room
JOIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/rooms/$ROOM_ID/join" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}')

if echo "$JOIN_RESPONSE" | grep -q "Joined room successfully"; then
    print_status 0 "Successfully joined room"
else
    print_status 1 "Failed to join room"
    echo "Response: $JOIN_RESPONSE"
fi

echo ""
echo "5. Testing room listing..."

# List rooms
ROOMS_LIST=$(curl -s -X GET http://localhost:3000/rooms \
    -H "Authorization: Bearer $TOKEN")

if echo "$ROOMS_LIST" | grep -q "Test Video Chat Room"; then
    print_status 0 "Room appears in room list"
else
    print_status 1 "Room not found in room list"
fi

echo ""
echo "6. Testing WebSocket connection..."

# Test WebSocket connection to SFU
WS_TEST=$(timeout 5 bash -c 'echo "{\"type\":\"join\",\"roomId\":\"test-room\"}" | websocat ws://localhost:5001' 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status 0 "WebSocket connection to SFU successful"
else
    print_status 1 "WebSocket connection to SFU failed"
fi

echo ""
echo "7. Checking SFU logs for any errors..."

# Check recent SFU logs for errors
SFU_ERRORS=$(docker-compose logs --since=2m sfu 2>/dev/null | grep -i "error\|failed\|exception" | wc -l)

if [ "$SFU_ERRORS" -eq 0 ]; then
    print_status 0 "No errors found in SFU logs"
else
    print_status 1 "Found $SFU_ERRORS errors in SFU logs"
    echo -e "${YELLOW}Recent SFU logs:${NC}"
    docker-compose logs --since=2m sfu | tail -10
fi

echo ""
echo "8. System Status Summary:"
echo "   - Backend: http://localhost:3000"
echo "   - SFU: http://localhost:5001"
echo "   - Frontend: http://localhost:5173"
echo "   - Test Room ID: $ROOM_ID"

echo ""
echo "9. Manual Testing Instructions:"
echo "   a) Open http://localhost:5173 in your browser"
echo "   b) Sign in with: test@example.com / testpass123"
echo "   c) Navigate to /rooms to see the test room"
echo "   d) Join the room to start video chat"
echo "   e) Open multiple browser tabs/windows to test multi-participant chat"
echo "   f) Test audio/video controls and screen sharing"

echo ""
echo "10. Monitoring Commands:"
echo "    - Monitor SFU logs: docker-compose logs -f sfu"
echo "    - Monitor all services: docker-compose logs -f"
echo "    - Check service health: docker-compose ps"

echo ""
echo -e "${GREEN}Test completed!${NC}"
echo "The rooms feature should now be working correctly."
echo "Please perform manual testing to verify video chat functionality." 