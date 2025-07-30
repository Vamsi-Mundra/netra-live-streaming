import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function CameraTest() {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  const startCamera = async () => {
    try {
      setError('');
      console.log('Starting camera test...');
      
      const media = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        }, 
        audio: false 
      });
      
      console.log('Camera started:', media);
      console.log('Video tracks:', media.getVideoTracks());
      
      streamRef.current = media;
      
      if (videoRef.current) {
        console.log('Setting video srcObject');
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
        console.error('Video ref is null!');
      }
      
      setIsCameraOn(true);
    } catch (error) {
      console.error('Failed to start camera:', error);
      setError('Failed to start camera: ' + error.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraOn(false);
  };

  const handleBack = () => {
    stopCamera();
    navigate('/stream');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Camera Test</h2>
        <button onClick={handleBack} style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none' }}>
          Back to Stream
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        {!isCameraOn ? (
          <button 
            onClick={startCamera}
            style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            Start Camera Test
          </button>
        ) : (
          <button 
            onClick={stopCamera}
            style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            Stop Camera Test
          </button>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <p>Debug: Video ref exists: {videoRef.current ? 'Yes' : 'No'}</p>
        <p>Debug: Stream ref exists: {streamRef.current ? 'Yes' : 'No'}</p>
        <p>Debug: Video srcObject: {videoRef.current?.srcObject ? 'Set' : 'Not set'}</p>
        <p>Debug: Video readyState: {videoRef.current?.readyState || 'N/A'}</p>
        <p>Debug: Video paused: {videoRef.current?.paused !== undefined ? videoRef.current.paused : 'N/A'}</p>
        
        <div style={{ border: '3px solid green', padding: '10px', margin: '10px 0', backgroundColor: '#f0f0f0' }}>
          <p><strong>Camera Test Video Element:</strong></p>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            style={{ 
              width: '100%', 
              maxWidth: '640px', 
              border: '3px solid red', 
              borderRadius: '5px', 
              backgroundColor: '#000',
              minHeight: '400px'
            }}
          />
          <p>If you can see your camera feed above, the camera is working correctly!</p>
        </div>
      </div>
    </div>
  );
}

export default CameraTest; 