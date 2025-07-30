const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('ok');
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active connections and rooms
const rooms = new Map();
const clients = new Map();
const clientRooms = new Map(); // Track which room each client is in
const clientStates = new Map(); // Track client connection state

// Debug function to log current state
function logCurrentState() {
  console.log('=== CURRENT STATE ===');
  console.log('Total clients:', clients.size);
  console.log('Total rooms:', rooms.size);
  console.log('Client rooms:', Object.fromEntries(clientRooms));
  console.log('Client states:', Object.fromEntries(clientStates));
  console.log('Rooms:', Array.from(rooms.entries()).map(([roomId, clients]) => 
    `${roomId}: ${clients.size} clients (${Array.from(clients)})`
  ));
  console.log('=====================');
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('WebSocket client connected to SFU');
  const clientId = uuidv4();
  clients.set(clientId, ws);
  clientStates.set(clientId, { connected: true, roomId: null });
  
  console.log(`Client ${clientId} connected, total clients: ${clients.size}`);
  logCurrentState();
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${clientId}:`, { type: data.type, roomId: data.roomId, payload: data.payload ? 'present' : 'missing' });
      handleMessage(clientId, data);
    } catch (error) {
      console.error('Error parsing message from client', clientId, ':', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected:', clientId);
    handleClientDisconnect(clientId);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error for client', clientId, ':', error);
    handleClientDisconnect(clientId);
  });
});

function handleMessage(clientId, data) {
  const { type, roomId, payload } = data;
  
  console.log(`Processing message: type=${type}, roomId=${roomId}, clientId=${clientId}`);
  console.log(`Client ${clientId} current room:`, clientRooms.get(clientId));
  
  // Validate message structure
  if (!type) {
    console.error('Message missing type from client', clientId);
    return;
  }
  
  switch (type) {
    case 'join':
      if (!roomId) {
        console.error('Join message missing roomId from client', clientId);
        return;
      }
      handleJoin(clientId, roomId);
      break;
    case 'offer':
      handleOffer(clientId, roomId, payload);
      break;
    case 'answer':
      handleAnswer(clientId, roomId, payload);
      break;
    case 'ice-candidate':
      handleIceCandidate(clientId, roomId, payload);
      break;
    case 'leave':
      handleLeave(clientId, roomId);
      break;
    default:
      console.log('Unknown message type:', type, 'from client', clientId);
  }
}

function handleJoin(clientId, roomId) {
  console.log(`Client ${clientId} joining room ${roomId}`);
  
  // Remove client from any existing room first
  const existingRoom = clientRooms.get(clientId);
  if (existingRoom && existingRoom !== roomId) {
    console.log(`Client ${clientId} leaving existing room ${existingRoom} to join ${roomId}`);
    handleLeave(clientId, existingRoom);
  }
  
  if (!rooms.has(roomId)) {
    console.log(`Creating new room ${roomId}`);
    rooms.set(roomId, new Set());
  }
  
  const room = rooms.get(roomId);
  room.add(clientId);
  clientRooms.set(clientId, roomId);
  clientStates.set(clientId, { connected: true, roomId: roomId });
  
  console.log(`Room ${roomId} now has ${room.size} clients:`, Array.from(room));
  console.log(`Client ${clientId} successfully joined room ${roomId}`);
  logCurrentState();
  
  // Notify other clients in the room
  room.forEach(id => {
    if (id !== clientId) {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        console.log(`Notifying client ${id} about new user ${clientId}`);
        client.send(JSON.stringify({
          type: 'user-joined',
          clientId: clientId
        }));
      }
    }
  });
  
  // Send room info to the joining client
  const client = clients.get(clientId);
  if (client && client.readyState === WebSocket.OPEN) {
    const existingClients = Array.from(room).filter(id => id !== clientId);
    console.log(`Sending room info to ${clientId}, existing clients:`, existingClients);
    client.send(JSON.stringify({
      type: 'room-info',
      roomId: roomId,
      clients: existingClients
    }));
  }
}

function handleOffer(clientId, roomId, payload) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleOffer called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}`);
  console.log(`Client ${clientId} tracked room:`, clientRooms.get(clientId));
  
  if (!actualRoomId) {
    console.error(`Client ${clientId} sending offer without roomId and not in any room`);
    console.error(`Client rooms map:`, Object.fromEntries(clientRooms));
    console.error(`Client states map:`, Object.fromEntries(clientStates));
    return;
  }
  
  console.log(`Client ${clientId} sending offer in room ${actualRoomId}`);
  
  const room = rooms.get(actualRoomId);
  if (!room) {
    console.error(`Room ${actualRoomId} not found for client ${clientId}`);
    console.error(`Available rooms:`, Array.from(rooms.keys()));
    return;
  }
  
  if (!room.has(clientId)) {
    console.error(`Client ${clientId} not in room ${actualRoomId}`);
    console.error(`Room ${actualRoomId} clients:`, Array.from(room));
    return;
  }
  
  room.forEach(id => {
    if (id !== clientId) {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        console.log(`Forwarding offer from ${clientId} to ${id}`);
        client.send(JSON.stringify({
          type: 'offer',
          clientId: clientId,
          payload: payload
        }));
      } else {
        console.warn(`Client ${id} not available for offer forwarding`);
      }
    }
  });
}

function handleAnswer(clientId, roomId, payload) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleAnswer called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}`);
  console.log(`Client ${clientId} tracked room:`, clientRooms.get(clientId));
  
  if (!actualRoomId) {
    console.error(`Client ${clientId} sending answer without roomId and not in any room`);
    console.error(`Client rooms map:`, Object.fromEntries(clientRooms));
    console.error(`Client states map:`, Object.fromEntries(clientStates));
    return;
  }
  
  console.log(`Client ${clientId} sending answer in room ${actualRoomId}`);
  
  const room = rooms.get(actualRoomId);
  if (!room) {
    console.error(`Room ${actualRoomId} not found for client ${clientId}`);
    console.error(`Available rooms:`, Array.from(rooms.keys()));
    return;
  }
  
  if (!room.has(clientId)) {
    console.error(`Client ${clientId} not in room ${actualRoomId}`);
    console.error(`Room ${actualRoomId} clients:`, Array.from(room));
    return;
  }
  
  room.forEach(id => {
    if (id !== clientId) {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        console.log(`Forwarding answer from ${clientId} to ${id}`);
        client.send(JSON.stringify({
          type: 'answer',
          clientId: clientId,
          payload: payload
        }));
      } else {
        console.warn(`Client ${id} not available for answer forwarding`);
      }
    }
  });
}

function handleIceCandidate(clientId, roomId, payload) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleIceCandidate called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}`);
  
  if (!actualRoomId) {
    console.error(`Client ${clientId} sending ICE candidate without roomId and not in any room`);
    return;
  }
  
  const room = rooms.get(actualRoomId);
  if (!room) {
    console.error(`Room ${actualRoomId} not found for client ${clientId}`);
    return;
  }
  
  if (!room.has(clientId)) {
    console.error(`Client ${clientId} not in room ${actualRoomId}`);
    return;
  }
  
  room.forEach(id => {
    if (id !== clientId) {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'ice-candidate',
          clientId: clientId,
          payload: payload
        }));
      } else {
        console.warn(`Client ${id} not available for ICE candidate forwarding`);
      }
    }
  });
}

function handleLeave(clientId, roomId) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleLeave called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}`);
  
  if (!actualRoomId) {
    console.warn(`Client ${clientId} leaving but not in any room`);
    return;
  }
  
  console.log(`Client ${clientId} leaving room ${actualRoomId}`);
  
  const room = rooms.get(actualRoomId);
  if (room) {
    room.delete(clientId);
    clientRooms.delete(clientId);
    clientStates.set(clientId, { connected: true, roomId: null });
    
    console.log(`Room ${actualRoomId} now has ${room.size} clients:`, Array.from(room));
    
    // Notify other clients
    room.forEach(id => {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'user-left',
          clientId: clientId
        }));
      }
    });
    
    // Remove room if empty
    if (room.size === 0) {
      console.log(`Removing empty room ${actualRoomId}`);
      rooms.delete(actualRoomId);
    }
  } else {
    console.warn(`Room ${actualRoomId} not found when client ${clientId} tried to leave`);
  }
  
  logCurrentState();
}

function handleClientDisconnect(clientId) {
  console.log(`Handling disconnect for client ${clientId}`);
  
  // Remove client from their room
  const roomId = clientRooms.get(clientId);
  if (roomId) {
    console.log(`Client ${clientId} was in room ${roomId}, removing`);
    handleLeave(clientId, roomId);
  }
  
  // Remove client from tracking maps
  clients.delete(clientId);
  clientRooms.delete(clientId);
  clientStates.delete(clientId);
  
  console.log(`Client ${clientId} disconnected, total clients: ${clients.size}`);
  logCurrentState();
}

// Add periodic cleanup and status logging
setInterval(() => {
  console.log('=== SFU Status ===');
  console.log(`Total clients: ${clients.size}`);
  console.log(`Total rooms: ${rooms.size}`);
  console.log('Rooms:', Array.from(rooms.entries()).map(([roomId, clients]) => 
    `${roomId}: ${clients.size} clients`
  ));
  console.log('==================');
}, 30000); // Log every 30 seconds

const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SFU Server running on port ${PORT}`);
}); 