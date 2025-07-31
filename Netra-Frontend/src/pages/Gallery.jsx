import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

function Gallery() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchVideos = async () => {
      try {
        const response = await api.get('/videos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVideos(response.data);
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        } else {
          setError('Failed to load videos');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Video Gallery</h2>
        <div>
          <button onClick={() => navigate('/stream')} style={{ marginRight: '10px', padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none' }}>
            Start Stream
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none' }}>
            Logout
          </button>
        </div>
      </div>
      
      {videos.length === 0 ? (
        <p>No videos found. Start streaming to create your first video!</p>
      ) : (
        <div>
          {videos.map(video => (
            <div key={video.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '5px' }}>
              <h3>Video {video.id}</h3>
              <p>S3 Key: {video.s3_key || 'N/A'}</p>
              <p>Duration: {video.duration || 'N/A'} seconds</p>
              <p>Created: {new Date(video.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Gallery; 