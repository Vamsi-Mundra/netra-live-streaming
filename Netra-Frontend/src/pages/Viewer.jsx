import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Viewer() {
  const { roomId } = useParams();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [streamReceived, setStreamReceived] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [userInteracted, setUserInteracted] = useState(false);
  const [pendingStream, setPendingStream] = useState(null);
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const navigate = useNavigate();

  // Connect to WebSocket
  useEffect(() => {
    console.log('=== VIEWER STARTING ===');
    console.log('Room ID:', roomId);
    
    if (!roomId) {
      setError('No room ID provided');
      return;
    }

    const connectWebSocket = () => {
      try {
        // Use the correct WebSocket URL
        const wsUrl = `ws://${window.location.hostname}:5001`;
        console.log('Connecting to WebSocket:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ WebSocket connected successfully');
          setIsConnected(true);
          setError('');
          setConnectionState('connected');
          
          // Join the room immediately
          const joinMessage = {
            type: 'join',
            roomId: roomId
          };
          console.log('Sending join message:', joinMessage);
          ws.send(JSON.stringify(joinMessage));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📨 Received message:', message);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          setError('WebSocket connection failed');
          setConnectionState('error');
        };

        ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          setIsConnected(false);
          setConnectionState('disconnected');
        };

      } catch (error) {
        console.error('❌ Error creating WebSocket:', error);
        setError('Failed to create WebSocket connection');
      }
    };

    connectWebSocket();

    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc, clientId) => {
        console.log('Closing peer connection for client:', clientId);
        pc.close();
      });
      peerConnectionsRef.current.clear();
    };
  }, [roomId]);

  const handleWebSocketMessage = async (message) => {
    const { type, clientId, payload } = message;
    
    switch (type) {
      case 'room-info':
        console.log('🏠 Room info received:', message);
        if (message.clients && message.clients.length > 0) {
          console.log('👥 Existing clients in room:', message.clients);
        }
        break;
        
      case 'user-joined':
        console.log('👋 New user joined:', clientId);
        break;
        
      case 'offer':
        console.log('📤 Received offer from:', clientId);
        await handleOffer(clientId, payload);
        break;
        
      case 'ice-candidate':
        console.log('🧊 Received ICE candidate from:', clientId);
        await handleIceCandidate(clientId, payload);
        break;
        
      case 'user-left':
        console.log('👋 User left:', clientId);
        closePeerConnection(clientId);
        break;
        
      default:
        console.log('❓ Unknown message type:', type);
    }
  };

  const handleOffer = async (clientId, payload) => {
    console.log('🎯 Handling offer from client:', clientId);
    
    try {
      // Create new peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      peerConnectionsRef.current.set(clientId, pc);
      console.log('🔗 Created peer connection for client:', clientId);

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('🎥 Track received:', event.track.kind);
        console.log('📊 Track details:', {
          kind: event.track.kind,
          id: event.track.id,
          enabled: event.track.enabled,
          muted: event.track.muted,
          readyState: event.track.readyState
        });
        
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          console.log('🌊 Stream received:', {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
          });
          
          if (videoRef.current) {
            console.log('📺 Setting stream to video element');
            videoRef.current.srcObject = stream;
            
            // Add event listeners to video element
            videoRef.current.onloadedmetadata = () => {
              console.log('✅ Video metadata loaded');
            };
            
            videoRef.current.oncanplay = () => {
              console.log('✅ Video can play');
            };
            
            videoRef.current.onplay = () => {
              console.log('▶️ Video started playing');
              setStreamReceived(true);
            };
            
            videoRef.current.onerror = (error) => {
              console.error('❌ Video error:', error);
            };
            
            // Store the stream for later playback if user hasn't interacted yet
            setPendingStream(stream);
            
            // Try to play the video if user has already interacted
            if (userInteracted) {
              playVideo();
            }
          } else {
            console.error('❌ Video ref not available');
          }
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate to:', clientId);
          const iceMessage = {
            type: 'ice-candidate',
            roomId: roomId,
            targetClientId: clientId,
            payload: event.candidate
          };
          wsRef.current.send(JSON.stringify(iceMessage));
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state changed:', pc.connectionState);
        setConnectionState(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', pc.iceConnectionState);
      };

      // Set remote description and create answer
      console.log('📝 Setting remote description');
      await pc.setRemoteDescription(new RTCSessionDescription(payload));
      
      console.log('📝 Creating answer');
      const answer = await pc.createAnswer();
      
      console.log('📝 Setting local description');
      await pc.setLocalDescription(answer);
      
      // Send answer back
      const answerMessage = {
        type: 'answer',
        roomId: roomId,
        targetClientId: clientId,
        payload: answer
      };
      console.log('📤 Sending answer:', answerMessage);
      wsRef.current.send(JSON.stringify(answerMessage));
      
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      setError('Failed to handle stream offer: ' + error.message);
    }
  };

  const handleIceCandidate = async (clientId, payload) => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (pc) {
      try {
        console.log('🧊 Adding ICE candidate for client:', clientId);
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    } else {
      console.warn('⚠️ No peer connection found for client:', clientId);
    }
  };

  const closePeerConnection = (clientId) => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (pc) {
      console.log('🔌 Closing peer connection for client:', clientId);
      pc.close();
      peerConnectionsRef.current.delete(clientId);
    }
  };

  const playVideo = async () => {
    if (videoRef.current && pendingStream) {
      try {
        console.log('🎬 Attempting to play video after user interaction');
        await videoRef.current.play();
        console.log('✅ Video play() successful after user interaction');
        setStreamReceived(true);
      } catch (error) {
        console.error('❌ Video play() failed after user interaction:', error);
      }
    }
  };

  const handleUserInteraction = () => {
    console.log('👆 User interaction detected');
    setUserInteracted(true);
    playVideo();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Live Stream Viewer</h1>
      <button 
        onClick={() => navigate('/')} 
        style={{ 
          marginBottom: '20px',
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Back to Stream
      </button>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Room ID:</strong> {roomId}</p>
        <p><strong>Status:</strong> {isConnected ? 'Connected' : 'Disconnected'}</p>
        <p><strong>Connection State:</strong> {connectionState}</p>
        {error && <p style={{ color: 'red' }}><strong>Error:</strong> {error}</p>}
      </div>

      <div style={{ textAlign: 'center' }}>
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          style={{ 
            width: '100%', 
            maxWidth: '600px', 
            border: '3px solid red', 
            borderRadius: '5px', 
            backgroundColor: '#000',
            minHeight: '300px'
          }}
        />
        
        {!isConnected && !error && (
          <p>🔄 Connecting to stream...</p>
        )}
        
        {isConnected && !streamReceived && (
          <p>✅ Connected! Waiting for video stream...</p>
        )}
        
        {pendingStream && !userInteracted && (
          <div style={{ marginTop: '10px' }}>
            <p>🎥 Stream ready! Click the button below to start watching:</p>
            <button 
              onClick={handleUserInteraction}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              ▶️ Start Watching
            </button>
          </div>
        )}
        
        {streamReceived && (
          <p style={{ color: 'green', fontWeight: 'bold' }}>
            🎥 ✓ Stream received and playing!
          </p>
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h3>Debug Info:</h3>
        <p>Video ref exists: {videoRef.current ? 'Yes' : 'No'}</p>
        <p>Video srcObject: {videoRef.current && videoRef.current.srcObject ? 'Set' : 'Not Set'}</p>
        <p>Video readyState: {videoRef.current ? videoRef.current.readyState : 'N/A'}</p>
        <p>Video paused: {videoRef.current ? videoRef.current.paused : 'N/A'}</p>
        <p>Peer connections: {peerConnectionsRef.current.size}</p>
        <p>Stream received: {streamReceived ? 'Yes' : 'No'}</p>
        <p>Pending stream: {pendingStream ? 'Yes' : 'No'}</p>
        <p>User interacted: {userInteracted ? 'Yes' : 'No'}</p>
        <p>WebSocket state: {wsRef.current ? wsRef.current.readyState : 'N/A'}</p>
      </div>
    </div>
  );
}

export default Viewer; 