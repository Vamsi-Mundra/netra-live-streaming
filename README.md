# Netra - Live Video Streaming Platform

A real-time video streaming platform built with React, Node.js, and WebRTC.

## Features

- **User Authentication**: Sign up and sign in with email/password
- **Live Streaming**: Start and stop live video streams
- **Real-time Viewing**: Watch live streams in real-time
- **Room-based Streaming**: Each stream gets a unique room ID
- **WebRTC Peer-to-Peer**: Direct browser-to-browser video streaming
- **Responsive UI**: Modern, mobile-friendly interface

## Architecture

- **Frontend**: React with Vite
- **Backend**: Fastify.js with PostgreSQL
- **Signaling Server**: Custom WebRTC signaling server
- **Database**: PostgreSQL with migrations
- **Containerization**: Docker Compose for easy deployment

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Modern web browser with camera/microphone support

### Running the Application

1. **Clone and start the services:**
   ```bash
   git clone <repository-url>
   cd Netra
   docker-compose up --build -d
   ```

2. **Wait for all services to be healthy:**
   ```bash
   docker-compose ps
   ```

3. **Run the test script to verify everything is working:**
   ```bash
   ./scripts/test_streaming.sh
   ```

4. **Open the application:**
   - Navigate to http://localhost:5173
   - Sign up with your email and password
   - Sign in to access the streaming features

## Usage

### Starting a Stream

1. Sign in to your account
2. Navigate to the Stream page
3. Click "Start Stream"
4. Allow camera and microphone permissions when prompted
5. Your stream will start and you'll see a preview
6. Share the viewer link with others to watch your stream

### Watching a Stream

1. Use the viewer link provided by the streamer (format: `/viewer/{roomId}`)
2. The stream will automatically connect and display the video
3. Multiple viewers can watch the same stream simultaneously

### Stopping a Stream

1. Click "Stop Stream" on the Stream page
2. The stream will end and all viewers will be disconnected

## API Endpoints

### Authentication
- `POST /auth/signup` - Create a new account
- `POST /auth/login` - Sign in to existing account

### Streaming
- `POST /api/streams/start` - Start a new stream (requires authentication)
- `POST /api/streams/stop` - Stop the current stream (requires authentication)

### Health Checks
- `GET /healthz` - Backend health check
- `GET /health` - SFU health check

## Development

### Project Structure

```
Netra/
├── Netra-Backend/          # Fastify.js API server
│   ├── src/
│   │   └── index.js        # Main server file
│   └── migrations/         # Database migrations
├── Netra-Frontend/         # React frontend
│   ├── src/
│   │   ├── pages/          # React components
│   │   └── App.jsx         # Main app component
│   └── nginx.conf          # Nginx configuration
├── Netra-sfu/              # WebRTC signaling server
│   └── server.js           # Signaling server
├── docker-compose.yml      # Docker services
└── scripts/                # Utility scripts
```

### Local Development

1. **Backend Development:**
   ```bash
   cd Netra-Backend
   npm install
   npm run dev
   ```

2. **Frontend Development:**
   ```bash
   cd Netra-Frontend
   npm install
   npm run dev
   ```

3. **SFU Development:**
   ```bash
   cd Netra-sfu
   npm install
   npm run dev
   ```

### Database Migrations

The backend automatically runs migrations on startup. To run migrations manually:

```bash
cd Netra-Backend
npm run migrate
```

## Troubleshooting

### Common Issues

1. **"Failed to start stream" error:**
   - Check browser console for detailed error messages
   - Ensure camera and microphone permissions are granted
   - Verify all services are running: `docker-compose ps`

2. **WebSocket connection errors:**
   - Check if the SFU server is running on port 5001
   - Verify firewall settings allow WebSocket connections
   - Check browser console for connection details

3. **Database connection issues:**
   - Ensure PostgreSQL container is healthy
   - Check backend logs: `docker-compose logs backend`
   - Verify DATABASE_URL environment variable

### Debugging

1. **View service logs:**
   ```bash
   docker-compose logs [service-name]
   ```

2. **Check service health:**
   ```bash
   docker-compose ps
   ```

3. **Test individual services:**
   ```bash
   curl http://localhost:3000/healthz  # Backend
   curl http://localhost:5001/health   # SFU
   curl http://localhost:5173          # Frontend
   ```

## Security Considerations

- JWT tokens are used for authentication
- Passwords are hashed using Argon2
- WebRTC connections use STUN servers for NAT traversal
- All API endpoints are properly validated

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

Note: WebRTC features require HTTPS in production environments.

## License

This project is licensed under the MIT License. 