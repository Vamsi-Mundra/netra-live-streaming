import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

function Stream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const navigate = useNavigate();

  // Add callback ref to ensure video element is properly set up
  const setVideoRef = (element) => {
    videoRef.current = element;
    console.log('Video ref set:', element);
    
    // If we have a stream and the video element is available, set it up
    if (element && streamRef.current) {
      console.log('Setting up video element with existing stream');
      element.srcObject = streamRef.current;
    }
  };

  // Add logging for component lifecycle
  console.log('Stream component rendered, isStreaming:', isStreaming, 'videoRef:', videoRef.current);

  useEffect(() => {
    console.log('Stream component mounted, videoRef:', videoRef.current);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Add effect to monitor video ref changes
  useEffect(() => {
    console.log('Video ref changed:', videoRef.current);
  }, [videoRef.current]);

  // Add effect to ensure video element is properly set up when streaming starts
  useEffect(() => {
    if (isStreaming && videoRef.current && streamRef.current) {
      console.log('Setting up video element for streaming');
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isStreaming, videoRef.current, streamRef.current]);

  const startStream = async () => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      const authCfg = { headers: { Authorization: `Bearer ${token}` } };
      
      // Start stream and get room ID
      const { data } = await api.post('/streams/start', {}, authCfg);
      setRoomId(data.roomId);
      
      // Get user media first
      console.log('Requesting user media...');
      const media = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      });
      console.log('User media obtained:', media);
      console.log('Video tracks:', media.getVideoTracks());
      console.log('Audio tracks:', media.getAudioTracks());
      streamRef.current = media;
      
      // Set video preview
      if (videoRef.current) {
        console.log('Setting video srcObject for preview');
        videoRef.current.srcObject = media;
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
        };
        videoRef.current.onplay = () => {
          console.log('Video started playing');
        };
        videoRef.current.onerror = (error) => {
          console.error('Video error:', error);
        };
      } else {
        console.error('Video ref is not available');
        // Try to set up the video element when it becomes available
        setTimeout(() => {
          if (videoRef.current) {
            console.log('Setting video srcObject after delay');
            videoRef.current.srcObject = media;
          }
        }, 100);
      }
      
      // Connect to signaling server
      const signalUrl = `ws://${window.location.hostname}:5001`;
      console.log('Connecting to signal server:', signalUrl);
      
      const ws = new WebSocket(signalUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('Connected to signaling server');
        // Join the room
        const joinMessage = {
          type: 'join',
          roomId: data.roomId
        };
        console.log('Streamer sending join message:', joinMessage);
        ws.send(JSON.stringify(joinMessage));
      };
      
      ws.onmessage = async (event) => {
        console.log('Streamer received message:', event.data);
        const message = JSON.parse(event.data);
        console.log('Streamer parsed message:', message);
        await handleSignalingMessage(message, media);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error: ' + error.message);
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        if (!event.wasClean) {
          setError('WebSocket connection was closed unexpectedly');
        }
      };
      
    } catch (error) {
      console.error('Failed to start stream:', error);
      setError('Failed to start stream: ' + (error.message || 'Unknown error'));
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const handleSignalingMessage = async (message, media) => {
    const { type, clientId, payload } = message;
    console.log('Streamer handling signaling message:', { type, clientId, payload });
    
    switch (type) {
      case 'room-info':
        console.log('Streamer joined room, existing clients:', message.clients);
        setIsStreaming(true);
        // Ensure video preview is set up for the broadcaster
        if (videoRef.current && streamRef.current) {
          console.log('Setting up video preview for broadcaster');
          videoRef.current.srcObject = streamRef.current;
        }
        break;
        
      case 'user-joined':
        console.log('New viewer joined:', clientId);
        // Create peer connection for new viewer and send offer
        await createPeerConnectionForViewer(clientId, media);
        break;
        
      case 'offer':
        console.log('Received offer from viewer:', clientId);
        // Viewers shouldn't send offers to streamer, but handle it gracefully
        await handleOfferFromViewer(clientId, payload);
        break;
        
      case 'answer':
        console.log('Received answer from viewer:', clientId);
        await handleAnswer(clientId, payload);
        break;
        
      case 'ice-candidate':
        console.log('Received ICE candidate from viewer:', clientId);
        await handleIceCandidate(clientId, payload);
        break;
        
      case 'user-left':
        console.log('Viewer left:', clientId);
        closePeerConnection(clientId);
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
  };

  const createPeerConnectionForViewer = async (clientId, media) => {
    console.log('🎥 Streamer creating peer connection for viewer:', clientId);
    console.log('📊 Media stream details:', {
      id: media.id,
      active: media.active,
      tracks: media.getTracks().map(t => ({ 
        kind: t.kind, 
        enabled: t.enabled, 
        muted: t.muted,
        readyState: t.readyState,
        id: t.id
      }))
    });
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    peerConnectionsRef.current.set(clientId, pc);
    
    // Add local tracks
    media.getTracks().forEach(track => {
      console.log('🎬 Streamer adding track to peer connection:', track.kind, 'track details:', {
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      });
      pc.addTrack(track, media);
    });
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Streamer sending ICE candidate to viewer:', clientId);
        const iceMessage = {
          type: 'ice-candidate',
          roomId: roomId,
          targetClientId: clientId,
          payload: event.candidate
        };
        console.log('🧊 Streamer ICE message:', iceMessage);
        wsRef.current.send(JSON.stringify(iceMessage));
      }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔗 Streamer peer connection state changed for viewer', clientId, ':', pc.connectionState);
    };
    
    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 Streamer ICE connection state changed for viewer', clientId, ':', pc.iceConnectionState);
    };
    
    // Create and send offer to the viewer
    try {
      console.log('📤 Streamer creating offer for viewer:', clientId);
      const offer = await pc.createOffer();
      console.log('📤 Streamer offer created:', offer);
      await pc.setLocalDescription(offer);
      
      const offerMessage = {
        type: 'offer',
        roomId: roomId,
        targetClientId: clientId,
        payload: offer
      };
      console.log('📤 Streamer sending offer message:', offerMessage);
      wsRef.current.send(JSON.stringify(offerMessage));
    } catch (error) {
      console.error('❌ Error creating offer for viewer:', error);
    }
  };

  const handleOfferFromViewer = async (clientId, payload) => {
    console.log('Streamer handling offer from viewer:', clientId);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    peerConnectionsRef.current.set(clientId, pc);
    
    // Add local tracks if we have them
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Streamer adding track to peer connection from viewer offer:', track.kind);
        pc.addTrack(track, streamRef.current);
      });
    }
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Streamer sending ICE candidate from viewer offer to:', clientId);
        const iceMessage = {
          type: 'ice-candidate',
          roomId: roomId,
          payload: {
            candidate: event.candidate
          }
        };
        console.log('Streamer ICE message from viewer offer:', iceMessage);
        wsRef.current.send(JSON.stringify(iceMessage));
      }
    };
    
    try {
      console.log('Streamer setting remote description and creating answer for viewer:', clientId);
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      const answerMessage = {
        type: 'answer',
        roomId: roomId,
        payload: {
          sdp: answer
        }
      };
      console.log('Streamer sending answer message:', answerMessage);
      wsRef.current.send(JSON.stringify(answerMessage));
    } catch (error) {
      console.error('Error handling offer from viewer:', error);
    }
  };

  const handleAnswer = async (clientId, payload) => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (pc) {
      try {
        console.log('📥 Streamer handling answer from viewer:', clientId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } catch (error) {
        console.error('❌ Error handling answer:', error);
      }
    } else {
      console.warn('⚠️ No peer connection found for client:', clientId);
    }
  };

  const handleIceCandidate = async (clientId, payload) => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (pc) {
      try {
        console.log('🧊 Streamer adding ICE candidate from viewer:', clientId);
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
      pc.close();
      peerConnectionsRef.current.delete(clientId);
    }
  };

  const stopStream = async () => {
    try {
      const token = localStorage.getItem('token');
      const authCfg = { headers: { Authorization: `Bearer ${token}` } };
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc, clientId) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();
      
      // Stop stream on backend
              await api.post('/streams/stop', {}, authCfg);
      
      setIsStreaming(false);
      setRoomId(null);
      
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error('Failed to stop stream:', error);
      setError('Failed to stop stream');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Add simple camera test function
  const testCamera = async () => {
    try {
      console.log('Testing camera...');
      const media = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      console.log('Camera test successful:', media);
      alert('Camera is working! Video tracks: ' + media.getVideoTracks().length);
      media.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Camera test failed:', error);
      alert('Camera test failed: ' + error.message);
    }
  };

  console.log('Rendering Stream component, isStreaming:', isStreaming);

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Live Stream</h2>
        <div>
          <button onClick={() => navigate('/videos')} style={{ marginRight: '10px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none' }}>
            Gallery
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none' }}>
            Logout
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        {!isStreaming ? (
          <div>
            <button 
              onClick={startStream}
              style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', marginRight: '10px' }}
            >
              Start Stream
            </button>
            <button 
              onClick={testCamera}
              style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '5px', marginRight: '10px' }}
            >
              Test Camera
            </button>
            <button 
              onClick={() => navigate('/camera-test')}
              style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px' }}
            >
              Full Camera Test
            </button>
          </div>
        ) : (
          <button 
            onClick={stopStream}
            style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            Stop Stream
          </button>
        )}
      </div>

      {isStreaming && (
        <div>
          <p>Room ID: {roomId}</p>
          <p>Share this link to view: <a href={`/viewer/${roomId}`} target="_blank" rel="noopener noreferrer">View Stream</a></p>
          <p>Debug: Video ref exists: {videoRef.current ? 'Yes' : 'No'}</p>
          <p>Debug: Stream ref exists: {streamRef.current ? 'Yes' : 'No'}</p>
          <p>Debug: Video srcObject: {videoRef.current?.srcObject ? 'Set' : 'Not set'}</p>
          <p>Debug: Video readyState: {videoRef.current?.readyState || 'N/A'}</p>
          <p>Debug: Video paused: {videoRef.current?.paused !== undefined ? videoRef.current.paused : 'N/A'}</p>
          <p>Debug: Component render count: {Date.now()}</p>
        </div>
      )}

      {/* Single video element that's always present */}
      <div style={{ border: '2px solid green', padding: '10px', margin: '10px 0', backgroundColor: '#f0f0f0' }}>
        <p><strong>Video Element:</strong></p>
        <p>Debug: Video ref exists: {videoRef.current ? 'Yes' : 'No'}</p>
        <p>Debug: Stream ref exists: {streamRef.current ? 'Yes' : 'No'}</p>
        <p>Debug: Video srcObject: {videoRef.current?.srcObject ? 'Set' : 'Not set'}</p>
        <video 
          ref={setVideoRef} 
          autoPlay 
          muted 
          playsInline
          style={{ 
            width: '100%', 
            maxWidth: '600px', 
            border: '2px solid purple', 
            borderRadius: '5px', 
            backgroundColor: '#000',
            minHeight: '300px',
            display: isStreaming ? 'block' : 'none'
          }}
        />
        <p>If you see this text but no video, there might be a camera permission issue.</p>
      </div>
    </div>
  );
}

export default Stream; 