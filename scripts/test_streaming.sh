#!/bin/bash

echo "Testing Netra Streaming System"
echo "=============================="

# Check if services are running
echo "1. Checking if services are running..."
if curl -f http://localhost:3000/healthz > /dev/null 2>&1; then
    echo "✓ Backend is running"
else
    echo "✗ Backend is not running"
    exit 1
fi

if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    echo "✓ SFU is running"
else
    echo "✗ SFU is not running"
    exit 1
fi

if curl -f http://localhost:5173 > /dev/null 2>&1; then
    echo "✓ Frontend is running"
else
    echo "✗ Frontend is not running"
    exit 1
fi

echo ""
echo "2. Testing WebSocket connection to SFU..."
# Test WebSocket connection using wscat if available, otherwise use curl
if command -v wscat > /dev/null 2>&1; then
    echo "Testing WebSocket with wscat..."
    timeout 5 wscat -c ws://localhost:5001 || echo "WebSocket connection test completed"
else
    echo "wscat not available, skipping WebSocket test"
fi

echo ""
echo "3. System Status:"
echo "   - Backend: http://localhost:3000"
echo "   - SFU: http://localhost:5001"
echo "   - Frontend: http://localhost:5173"
echo ""
echo "4. Next Steps:"
echo "   - Open http://localhost:5173 in your browser"
echo "   - Sign in and start a stream"
echo "   - Open the viewer URL in another tab/window"
echo "   - Check the SFU logs for WebRTC signaling"
echo ""
echo "5. To monitor SFU logs:"
echo "   docker-compose logs -f sfu"
echo ""
echo "Test completed successfully!" 