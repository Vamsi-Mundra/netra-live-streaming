#!/bin/bash

# Netra Live Streaming - Railway Deployment Script
# This script helps deploy the application to Railway

set -e

echo "🚀 Starting Netra Live Streaming deployment to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Installing..."
    npm install -g @railway/cli
fi

# Check if user is logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway..."
    railway login
fi

# Initialize Railway project if not already done
if [ ! -f ".railway" ]; then
    echo "📁 Initializing Railway project..."
    railway init
fi

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set POSTGRES_USER=netra
railway variables set POSTGRES_DB=netra

# Generate secure password if not set
if [ -z "$POSTGRES_PASSWORD" ]; then
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    echo "🔑 Generated secure PostgreSQL password"
fi

railway variables set POSTGRES_PASSWORD="$POSTGRES_PASSWORD"

# Generate JWT secret if not set
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 64)
    echo "🔐 Generated secure JWT secret"
fi

railway variables set JWT_SECRET="$JWT_SECRET"

# Deploy the application
echo "🚀 Deploying to Railway..."
railway up

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Check deployment status
echo "📊 Checking deployment status..."
railway status

# Get the deployment URL
DEPLOYMENT_URL=$(railway domain)
echo "✅ Deployment completed!"
echo "🌐 Your application is available at: https://$DEPLOYMENT_URL"
echo ""
echo "🔧 Environment variables set:"
echo "   - POSTGRES_USER: netra"
echo "   - POSTGRES_PASSWORD: [secure]"
echo "   - POSTGRES_DB: netra"
echo "   - JWT_SECRET: [secure]"
echo "   - NODE_ENV: production"
echo ""
echo "📋 Next steps:"
echo "   1. Test your application at https://$DEPLOYMENT_URL"
echo "   2. Set up a custom domain in Railway dashboard"
echo "   3. Configure monitoring and alerts"
echo "   4. Test live streaming functionality"
echo ""
echo "🎉 Happy streaming!" 