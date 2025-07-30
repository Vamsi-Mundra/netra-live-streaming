#!/bin/bash

echo "🧪 Testing Room Functionality"
echo "=============================="

# Test 1: Create a user account
echo "1. Creating test user account..."
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

if echo "$SIGNUP_RESPONSE" | grep -q "token"; then
  echo "✅ User created successfully"
  TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
  echo "❌ Failed to create user: $SIGNUP_RESPONSE"
  exit 1
fi

# Test 2: Create a room
echo "2. Creating a test room..."
ROOM_RESPONSE=$(curl -s -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Room","description":"A test room for video chat","maxParticipants":3}')

if echo "$ROOM_RESPONSE" | grep -q "id"; then
  echo "✅ Room created successfully"
  ROOM_ID=$(echo "$ROOM_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
else
  echo "❌ Failed to create room: $ROOM_RESPONSE"
  exit 1
fi

# Test 3: List rooms
echo "3. Listing all rooms..."
ROOMS_RESPONSE=$(curl -s -X GET http://localhost:3000/rooms \
  -H "Authorization: Bearer $TOKEN")

if echo "$ROOMS_RESPONSE" | grep -q "Test Room"; then
  echo "✅ Rooms listed successfully"
else
  echo "❌ Failed to list rooms: $ROOMS_RESPONSE"
  exit 1
fi

# Test 4: Get specific room details
echo "4. Getting room details..."
ROOM_DETAILS=$(curl -s -X GET http://localhost:3000/rooms/$ROOM_ID \
  -H "Authorization: Bearer $TOKEN")

if echo "$ROOM_DETAILS" | grep -q "Test Room"; then
  echo "✅ Room details retrieved successfully"
else
  echo "❌ Failed to get room details: $ROOM_DETAILS"
  exit 1
fi

# Test 5: Join room
echo "5. Joining the room..."
JOIN_RESPONSE=$(curl -s -X POST http://localhost:3000/rooms/$ROOM_ID/join \
  -H "Authorization: Bearer $TOKEN")

if echo "$JOIN_RESPONSE" | grep -q "Joined room successfully"; then
  echo "✅ Joined room successfully"
else
  echo "❌ Failed to join room: $JOIN_RESPONSE"
  exit 1
fi

# Test 6: Get participants
echo "6. Getting room participants..."
PARTICIPANTS_RESPONSE=$(curl -s -X GET http://localhost:3000/rooms/$ROOM_ID/participants \
  -H "Authorization: Bearer $TOKEN")

if echo "$PARTICIPANTS_RESPONSE" | grep -q "test@example.com"; then
  echo "✅ Participants retrieved successfully"
else
  echo "❌ Failed to get participants: $PARTICIPANTS_RESPONSE"
  exit 1
fi

# Test 7: Leave room
echo "7. Leaving the room..."
LEAVE_RESPONSE=$(curl -s -X POST http://localhost:3000/rooms/$ROOM_ID/leave \
  -H "Authorization: Bearer $TOKEN")

if echo "$LEAVE_RESPONSE" | grep -q "Left room successfully"; then
  echo "✅ Left room successfully"
else
  echo "❌ Failed to leave room: $LEAVE_RESPONSE"
  exit 1
fi

echo ""
echo "🎉 All room functionality tests passed!"
echo "You can now access the rooms feature at: http://localhost:5173/rooms" 