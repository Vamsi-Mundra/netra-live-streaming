import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import config from '../config';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState(new Map());
  const [ws, setWs] = useState(null);
  const [localUserId, setLocalUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  const localVideoRef = useRef();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    fetchRoomDetails();
    setupWebRTC();
    
    return () => {
      cleanup();
    };
  }, [roomId, token]);

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`${config.backendUrl}/rooms/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Room not found');
      }

      const roomData = await response.json();
      setRoom(roomData);
    } catch (err) {
      setError(err.message);
    }
  };

  const setupWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect to SFU
      connectToSFU();
    } catch (err) {
      setError('Failed to access camera/microphone: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectToSFU = () => {
    // Use the correct WebSocket URL based on environment
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `wss://${window.location.host}/sfu`
      : `ws://${window.location.hostname}:5001`;
    
    console.log('Connecting to SFU at:', wsUrl);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Connected to SFU');
      setConnectionStatus('connected');
      // Send join room message
      websocket.send(JSON.stringify({
        type: 'join',
        roomId: roomId
      }));
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleSFUMessage(message);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection to SFU failed');
      setConnectionStatus('error');
    };

    websocket.onclose = () => {
      console.log('Disconnected from SFU');
      setConnectionStatus('disconnected');
    };

    setWs(websocket);
  };

  const handleSFUMessage = (message) => {
    console.log('Received SFU message:', message);
    
    switch (message.type) {
      case 'room-info':
        handleRoomInfo(message);
        break;
      case 'participant-joined':
        handleParticipantJoined(message);
        break;
      case 'participant-left':
        handleParticipantLeft(message);
        break;
      case 'offer':
        handleOffer(message);
        break;
      case 'answer':
        handleAnswer(message);
        break;
      case 'ice-candidate':
        handleIceCandidate(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleRoomInfo = (message) => {
    console.log('Received room info:', message);
    setLocalUserId(message.participants.length > 0 ? message.participants[0] : 'local');
    setUserRole(message.role);
    
    // If we're the host and there are existing participants, create offers for them
    if (message.role === 'host' && message.participants.length > 0) {
      console.log('Host: Creating offers for existing participants');
      message.participants.forEach(participantId => {
        createPeerConnection(participantId, true); // true = create offer
      });
    }
  };

  const handleParticipantJoined = (message) => {
    console.log('Participant joined:', message.participantId);
    
    // If we're the host, create an offer for the new participant
    if (userRole === 'host') {
      console.log('Host: Creating offer for new participant');
      createPeerConnection(message.participantId, true); // true = create offer
    } else {
      // If we're a participant, just create a peer connection (will receive offer)
      console.log('Participant: Creating peer connection for new participant');
      createPeerConnection(message.participantId, false); // false = don't create offer
    }
  };

  const handleParticipantLeft = (message) => {
    console.log('Participant left:', message.participantId);
    // Remove peer connection
    const peerConnection = peers.get(message.participantId);
    if (peerConnection) {
      peerConnection.close();
      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.delete(message.participantId);
        return newPeers;
      });
    }
    
    // Remove from participants list
    setParticipants(prev => prev.filter(p => p.userId !== message.participantId));
  };

  const createPeerConnection = (participantId, shouldCreateOffer = false) => {
    console.log(`Creating peer connection for ${participantId}, shouldCreateOffer: ${shouldCreateOffer}`);
    
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`Adding track to peer connection: ${track.kind}`);
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${participantId}`);
        ws.send(JSON.stringify({
          type: 'ice-candidate',
          roomId: roomId,
          targetUserId: participantId,
          payload: event.candidate
        }));
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        console.log(`Successfully connected to ${participantId}`);
      } else if (peerConnection.connectionState === 'failed') {
        console.error(`Connection failed with ${participantId}`);
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', participantId);
      setParticipants(prev => {
        const existing = prev.find(p => p.userId === participantId);
        if (!existing) {
          return [...prev, { userId: participantId, stream: event.streams[0] }];
        }
        return prev;
      });
    };

    setPeers(prev => new Map(prev).set(participantId, peerConnection));

    // Create offer if needed
    if (shouldCreateOffer) {
      console.log(`Creating offer for ${participantId}`);
      peerConnection.createOffer()
        .then(offer => {
          console.log(`Offer created for ${participantId}:`, offer);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          console.log(`Sending offer to ${participantId}`);
          ws.send(JSON.stringify({
            type: 'offer',
            roomId: roomId,
            targetUserId: participantId,
            payload: peerConnection.localDescription
          }));
        })
        .catch(err => {
          console.error('Error creating offer:', err);
          // Remove failed peer connection
          setPeers(prev => {
            const newPeers = new Map(prev);
            newPeers.delete(participantId);
            return newPeers;
          });
        });
    }
  };

  const handleOffer = async (message) => {
    const { fromUserId, payload } = message;
    console.log(`Received offer from ${fromUserId}`);
    
    // Check if we already have a peer connection for this user
    let peerConnection = peers.get(fromUserId);
    
    if (!peerConnection) {
      console.log(`Creating new peer connection for offer from ${fromUserId}`);
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          console.log(`Adding track to peer connection: ${track.kind}`);
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`Sending ICE candidate to ${fromUserId}`);
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            roomId: roomId,
            targetUserId: fromUserId,
            payload: event.candidate
          }));
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${fromUserId}: ${peerConnection.connectionState}`);
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream from:', fromUserId);
        setParticipants(prev => {
          const existing = prev.find(p => p.userId === fromUserId);
          if (!existing) {
            return [...prev, { userId: fromUserId, stream: event.streams[0] }];
          }
          return prev;
        });
      };

      setPeers(prev => new Map(prev).set(fromUserId, peerConnection));
    }

    try {
      // Set remote description and create answer
      console.log(`Setting remote description for ${fromUserId}`);
      await peerConnection.setRemoteDescription(payload);
      
      console.log(`Creating answer for ${fromUserId}`);
      const answer = await peerConnection.createAnswer();
      
      console.log(`Setting local description for ${fromUserId}`);
      await peerConnection.setLocalDescription(answer);

      console.log(`Sending answer to ${fromUserId}`);
      ws.send(JSON.stringify({
        type: 'answer',
        roomId: roomId,
        targetUserId: fromUserId,
        payload: peerConnection.localDescription
      }));
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (message) => {
    const { fromUserId, payload } = message;
    console.log(`Received answer from ${fromUserId}`);
    
    const peerConnection = peers.get(fromUserId);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(payload);
        console.log(`Successfully set remote description for ${fromUserId}`);
      } catch (err) {
        console.error('Error setting remote description:', err);
      }
    } else {
      console.error(`No peer connection found for ${fromUserId}`);
    }
  };

  const handleIceCandidate = async (message) => {
    const { fromUserId, payload } = message;
    console.log(`Received ICE candidate from ${fromUserId}`);
    
    const peerConnection = peers.get(fromUserId);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(payload);
        console.log(`Successfully added ICE candidate from ${fromUserId}`);
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    } else {
      console.error(`No peer connection found for ${fromUserId}`);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        // Replace video track for all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        peers.forEach((peerConnection, participantId) => {
          const sender = peerConnection.getSenders()
            .find(s => s.track?.kind === 'video');
          
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        setIsScreenSharing(true);
      } else {
        // Switch back to camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        
        const videoTrack = cameraStream.getVideoTracks()[0];
        peers.forEach((peerConnection, participantId) => {
          const sender = peerConnection.getSenders()
            .find(s => s.track?.kind === 'video');
          
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  const leaveRoom = async () => {
    try {
      // Leave room via API
      await fetch(`${config.backendUrl}/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('Error leaving room:', err);
    }
    
    cleanup();
    navigate('/rooms');
  };

  const cleanup = () => {
    // Close WebSocket
    if (ws) {
      ws.close();
    }
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connections
    peers.forEach(peer => peer.close());
    setPeers(new Map());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">Error</h3>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-xl font-semibold text-white">{room?.name}</h1>
              <p className="text-gray-400 text-sm">
                {participants.length + 1} participant{(participants.length + 1) !== 1 ? 's' : ''} • {userRole}
              </p>
              <p className="text-gray-500 text-xs">
                Connection: {connectionStatus}
              </p>
            </div>
            <button
              onClick={leaveRoom}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              You ({userRole})
            </div>
          </div>

          {/* Remote Videos */}
          {participants.map((participant) => (
            <div key={participant.userId} className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
              <video
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && participant.stream) {
                    el.srcObject = participant.stream;
                  }
                }}
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                Participant
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full transition-colors ${
                isAudioEnabled 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {isAudioEnabled ? '🔊' : '🔇'}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-colors ${
                isVideoEnabled 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {isVideoEnabled ? '📹' : '🚫'}
            </button>
            
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full transition-colors ${
                isScreenSharing 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
              {isScreenSharing ? '🖥️' : '📺'}
            </button>
            
            <button
              onClick={leaveRoom}
              className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              📞
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room; 