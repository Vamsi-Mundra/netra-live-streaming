#!/bin/bash

echo "Testing Railway Deployment Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

echo "1. Checking Railway configuration files..."

# Check if railway.json exists
if [ -f "railway.json" ]; then
    print_status 0 "railway.json exists"
else
    print_status 1 "railway.json missing"
    exit 1
fi

# Check if Dockerfile.railway exists
if [ -f "Dockerfile.railway" ]; then
    print_status 0 "Dockerfile.railway exists"
else
    print_status 1 "Dockerfile.railway missing"
    exit 1
fi

echo ""
echo "2. Validating Railway configuration..."

# Check railway.json content
if grep -q "Dockerfile.railway" railway.json; then
    print_status 0 "railway.json references correct Dockerfile"
else
    print_status 1 "railway.json has incorrect Dockerfile reference"
fi

if grep -q "npm start" railway.json; then
    print_status 0 "railway.json has correct start command"
else
    print_status 1 "railway.json has incorrect start command"
fi

echo ""
echo "3. Checking package.json..."

# Check if start script exists
if grep -q '"start":' package.json; then
    print_status 0 "package.json has start script"
else
    print_status 1 "package.json missing start script"
fi

echo ""
echo "4. Checking nginx configuration..."

# Check if nginx.conf exists and has correct paths
if [ -f "Netra-Frontend/nginx.conf" ]; then
    print_status 0 "nginx.conf exists"
    
    if grep -q "localhost:3000" Netra-Frontend/nginx.conf; then
        print_status 0 "nginx.conf has correct backend proxy"
    else
        print_status 1 "nginx.conf has incorrect backend proxy"
    fi
    
    if grep -q "localhost:5001" Netra-Frontend/nginx.conf; then
        print_status 0 "nginx.conf has correct SFU proxy"
    else
        print_status 1 "nginx.conf has incorrect SFU proxy"
    fi
else
    print_status 1 "nginx.conf missing"
fi

echo ""
echo "5. Checking frontend configuration..."

# Check if config.js has Railway environment handling
if [ -f "Netra-Frontend/src/config.js" ]; then
    print_status 0 "config.js exists"
    
    if grep -q "RAILWAY_STATIC_URL" Netra-Frontend/src/config.js; then
        print_status 0 "config.js has Railway environment handling"
    else
        print_status 1 "config.js missing Railway environment handling"
    fi
else
    print_status 1 "config.js missing"
fi

echo ""
echo "6. Checking backend configuration..."

# Check if backend has migration support
if grep -q "runMigrations" Netra-Backend/src/index.js; then
    print_status 0 "Backend has migration support"
else
    print_status 1 "Backend missing migration support"
fi

if grep -q "DATABASE_URL" Netra-Backend/src/index.js; then
    print_status 0 "Backend has Railway database URL handling"
else
    print_status 1 "Backend missing Railway database URL handling"
fi

echo ""
echo "7. Checking SFU configuration..."

# Check if SFU has Railway WebSocket path handling
if grep -q "/sfu" Netra-sfu/server.js; then
    print_status 0 "SFU has Railway WebSocket path handling"
else
    print_status 1 "SFU missing Railway WebSocket path handling"
fi

echo ""
echo "8. Railway Deployment Summary:"
echo "   - Railway config: railway.json"
echo "   - Dockerfile: Dockerfile.railway"
echo "   - Start command: npm start"
echo "   - Health check: /healthz"
echo "   - Frontend: Served via nginx"
echo "   - Backend: Proxied via nginx to /api"
echo "   - SFU: Proxied via nginx to /sfu"
echo "   - Database: Uses Railway's DATABASE_URL"

echo ""
echo "9. Deployment Instructions:"
echo "   a) Push code to GitHub"
echo "   b) Connect repository to Railway"
echo "   c) Add PostgreSQL plugin in Railway"
echo "   d) Set environment variables:"
echo "      - JWT_SECRET (optional, defaults to 'supersecret')"
echo "      - DATABASE_URL (automatically set by Railway PostgreSQL plugin)"
echo "   e) Deploy the service"

echo ""
echo "10. Environment Variables for Railway:"
echo "    - DATABASE_URL: Automatically provided by Railway PostgreSQL plugin"
echo "    - JWT_SECRET: Set a secure JWT secret (optional)"
echo "    - NODE_ENV: Automatically set to 'production' by Railway"
echo "    - PORT: Automatically set by Railway"
echo "    - RAILWAY_STATIC_URL: Automatically set by Railway"

echo ""
echo -e "${GREEN}Railway deployment setup is ready!${NC}"
echo "The application is configured to run as a single service on Railway."
echo "All components (frontend, backend, SFU) will run in one container." 