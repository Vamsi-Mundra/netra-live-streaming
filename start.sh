#!/bin/sh
echo "Starting Netra services..."

# Start SFU server in background
cd /app/Netra-sfu && node server.js &
SFU_PID=$!
echo "SFU server started with PID: $SFU_PID"

# Wait a moment for SFU to start
sleep 2

# Start backend server
cd /app/Netra-Backend && node src/index.js &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -f http://localhost:3001/healthz > /dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  echo "Waiting for backend... ($i/30)"
  sleep 2
done

# Start nginx for frontend
echo "Starting nginx for frontend..."
nginx -g "daemon off;" &
NGINX_PID=$!
echo "Nginx started with PID: $NGINX_PID"

# Wait for all processes
wait $SFU_PID $BACKEND_PID $NGINX_PID 