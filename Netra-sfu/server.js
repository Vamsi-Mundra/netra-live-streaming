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
const clientRoles = new Map(); // Track client roles (host/participant)

// Debug function to log current state
function logCurrentState() {
  console.log('=== CURRENT STATE ===');
  console.log('Total clients:', clients.size);
  console.log('Total rooms:', rooms.size);
  console.log('Client rooms:', Object.fromEntries(clientRooms));
  console.log('Client roles:', Object.fromEntries(clientRoles));
  console.log('Rooms:', Array.from(rooms.entries()).map(([roomId, clients]) => 
    `${roomId}: ${clients.size} clients (${Array.from(clients)})`
  ));
  console.log('=====================');
}

// Validate room state
function validateRoomState(roomId, clientId) {
  if (!roomId) {
    console.error(`Client ${clientId} has no roomId`);
    return false;
  }
  
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} does not exist`);
    return false;
  }
  
  const room = rooms.get(roomId);
  if (!room.has(clientId)) {
    console.error(`Client ${clientId} not in room ${roomId}`);
    return false;
  }
  
  return true;
}

// Get client's room with validation
function getClientRoom(clientId) {
  const roomId = clientRooms.get(clientId);
  if (!roomId) {
    console.error(`Client ${clientId} not in any room`);
    return null;
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    console.error(`Room ${roomId} not found for client ${clientId}`);
    clientRooms.delete(clientId);
    return null;
  }
  
  return { roomId, room };
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
  const { type, roomId, payload, targetUserId } = data;
  
  console.log(`Processing message: type=${type}, roomId=${roomId}, clientId=${clientId}, targetUserId=${targetUserId}`);
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
      handleOffer(clientId, roomId, payload, targetUserId);
      break;
    case 'answer':
      handleAnswer(clientId, roomId, payload, targetUserId);
      break;
    case 'ice-candidate':
      handleIceCandidate(clientId, roomId, payload, targetUserId);
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
  const isFirstParticipant = room.size === 0;
  
  room.add(clientId);
  clientRooms.set(clientId, roomId);
  clientStates.set(clientId, { connected: true, roomId: roomId });
  
  // Set role based on whether this is the first participant
  clientRoles.set(clientId, isFirstParticipant ? 'host' : 'participant');
  
  console.log(`Room ${roomId} now has ${room.size} clients:`, Array.from(room));
  console.log(`Client ${clientId} successfully joined room ${roomId} as ${isFirstParticipant ? 'host' : 'participant'}`);
  logCurrentState();
  
  // Notify other clients in the room about the new participant
  room.forEach(id => {
    if (id !== clientId) {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        console.log(`Notifying client ${id} about new participant ${clientId}`);
        client.send(JSON.stringify({
          type: 'participant-joined',
          roomId: roomId,
          participantId: clientId,
          role: isFirstParticipant ? 'host' : 'participant'
        }));
      }
    }
  });
  
  // Send room info to the joining client
  const client = clients.get(clientId);
  if (client && client.readyState === WebSocket.OPEN) {
    const existingParticipants = Array.from(room).filter(id => id !== clientId);
    console.log(`Sending room info to ${clientId}, existing participants:`, existingParticipants);
    client.send(JSON.stringify({
      type: 'room-info',
      roomId: roomId,
      participants: existingParticipants,
      role: isFirstParticipant ? 'host' : 'participant'
    }));
  }
}

function handleOffer(clientId, roomId, payload, targetUserId) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleOffer called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}, targetUserId=${targetUserId}`);
  
  if (!validateRoomState(actualRoomId, clientId)) {
    console.error(`Invalid room state for client ${clientId} in room ${actualRoomId}`);
    return;
  }
  
  const room = rooms.get(actualRoomId);
  
  // If targetUserId is specified, send only to that user
  if (targetUserId) {
    if (room.has(targetUserId)) {
      const targetClient = clients.get(targetUserId);
      if (targetClient && targetClient.readyState === WebSocket.OPEN) {
        console.log(`Forwarding offer from ${clientId} to ${targetUserId}`);
        targetClient.send(JSON.stringify({
          type: 'offer',
          roomId: actualRoomId,
          fromUserId: clientId,
          payload: payload
        }));
      } else {
        console.warn(`Target client ${targetUserId} not available for offer forwarding`);
      }
    } else {
      console.error(`Target user ${targetUserId} not in room ${actualRoomId}`);
    }
  } else {
    // Send to all other participants in the room
    room.forEach(id => {
      if (id !== clientId) {
        const client = clients.get(id);
        if (client && client.readyState === WebSocket.OPEN) {
          console.log(`Forwarding offer from ${clientId} to ${id}`);
          client.send(JSON.stringify({
            type: 'offer',
            roomId: actualRoomId,
            fromUserId: clientId,
            payload: payload
          }));
        } else {
          console.warn(`Client ${id} not available for offer forwarding`);
        }
      }
    });
  }
}

function handleAnswer(clientId, roomId, payload, targetUserId) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleAnswer called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}, targetUserId=${targetUserId}`);
  
  if (!validateRoomState(actualRoomId, clientId)) {
    console.error(`Invalid room state for client ${clientId} in room ${actualRoomId}`);
    return;
  }
  
  const room = rooms.get(actualRoomId);
  
  // If targetUserId is specified, send only to that user
  if (targetUserId) {
    if (room.has(targetUserId)) {
      const targetClient = clients.get(targetUserId);
      if (targetClient && targetClient.readyState === WebSocket.OPEN) {
        console.log(`Forwarding answer from ${clientId} to ${targetUserId}`);
        targetClient.send(JSON.stringify({
          type: 'answer',
          roomId: actualRoomId,
          fromUserId: clientId,
          payload: payload
        }));
      } else {
        console.warn(`Target client ${targetUserId} not available for answer forwarding`);
      }
    } else {
      console.error(`Target user ${targetUserId} not in room ${actualRoomId}`);
    }
  } else {
    // Send to all other participants in the room
    room.forEach(id => {
      if (id !== clientId) {
        const client = clients.get(id);
        if (client && client.readyState === WebSocket.OPEN) {
          console.log(`Forwarding answer from ${clientId} to ${id}`);
          client.send(JSON.stringify({
            type: 'answer',
            roomId: actualRoomId,
            fromUserId: clientId,
            payload: payload
          }));
        } else {
          console.warn(`Client ${id} not available for answer forwarding`);
        }
      }
    });
  }
}

function handleIceCandidate(clientId, roomId, payload, targetUserId) {
  // Use the tracked room if roomId is not provided
  const actualRoomId = roomId || clientRooms.get(clientId);
  
  console.log(`handleIceCandidate called: clientId=${clientId}, providedRoomId=${roomId}, actualRoomId=${actualRoomId}, targetUserId=${targetUserId}`);
  
  if (!validateRoomState(actualRoomId, clientId)) {
    console.error(`Invalid room state for client ${clientId} in room ${actualRoomId}`);
    return;
  }
  
  const room = rooms.get(actualRoomId);
  
  // If targetUserId is specified, send only to that user
  if (targetUserId) {
    if (room.has(targetUserId)) {
      const targetClient = clients.get(targetUserId);
      if (targetClient && targetClient.readyState === WebSocket.OPEN) {
        console.log(`Forwarding ICE candidate from ${clientId} to ${targetUserId}`);
        targetClient.send(JSON.stringify({
          type: 'ice-candidate',
          roomId: actualRoomId,
          fromUserId: clientId,
          payload: payload
        }));
      } else {
        console.warn(`Target client ${targetUserId} not available for ICE candidate forwarding`);
      }
    } else {
      console.error(`Target user ${targetUserId} not in room ${actualRoomId}`);
    }
  } else {
    // Send to all other participants in the room
    room.forEach(id => {
      if (id !== clientId) {
        const client = clients.get(id);
        if (client && client.readyState === WebSocket.OPEN) {
          console.log(`Forwarding ICE candidate from ${clientId} to ${id}`);
          client.send(JSON.stringify({
            type: 'ice-candidate',
            roomId: actualRoomId,
            fromUserId: clientId,
            payload: payload
          }));
        } else {
          console.warn(`Client ${id} not available for ICE candidate forwarding`);
        }
      }
    });
  }
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
    clientRoles.delete(clientId);
    clientStates.set(clientId, { connected: true, roomId: null });
    
    console.log(`Room ${actualRoomId} now has ${room.size} clients:`, Array.from(room));
    
    // Notify other clients about the participant leaving
    room.forEach(id => {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'participant-left',
          roomId: actualRoomId,
          participantId: clientId
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
  clientRoles.delete(clientId);
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