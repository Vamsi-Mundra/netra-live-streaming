# Railway Deployment Guide for Netra

## 🚀 Overview

This guide will help you deploy the Netra video streaming platform to Railway. The application has been configured to run as a single service with all components (frontend, backend, SFU) running in one container.

## 📋 Prerequisites

- GitHub account with the Netra repository
- Railway account (free tier available)
- PostgreSQL database (provided by Railway)

## 🔧 Configuration Changes Made

### 1. Railway Configuration (`railway.json`)
- Updated to use `Dockerfile.railway` instead of `Dockerfile`
- Changed start command to `npm start`
- Updated health check path to `/healthz`

### 2. Railway Dockerfile (`Dockerfile.railway`)
- Multi-stage build optimized for Railway
- Runs all services in a single container
- Includes nginx for frontend serving and reverse proxy
- Proper startup script to coordinate all services

### 3. Nginx Configuration (`Netra-Frontend/nginx.conf`)
- Updated to proxy requests to localhost services
- Routes `/api/*` to backend (port 3000)
- Routes `/sfu/*` to SFU server (port 5001)
- Serves frontend static files from `/app/Netra-Frontend/dist`

### 4. Backend Updates (`Netra-Backend/src/index.js`)
- Added automatic database migration support
- Enhanced error handling for Railway environment
- Uses Railway's `DATABASE_URL` environment variable
- Improved health check endpoint

### 5. SFU Updates (`Netra-sfu/server.js`)
- Added WebSocket path handling for Railway (`/sfu`)
- Enhanced connection logging

### 6. Frontend Updates
- Updated WebSocket connection to use Railway URLs
- Enhanced environment configuration for production

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

1. **Commit all changes to GitHub:**
   ```bash
   git add .
   git commit -m "Configure Railway deployment"
   git push origin main
   ```

2. **Verify the deployment setup:**
   ```bash
   ./scripts/test_railway_deployment.sh
   ```

### Step 2: Set Up Railway Project

1. **Go to Railway Dashboard:**
   - Visit [railway.app](https://railway.app)
   - Sign in with your GitHub account

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your Netra repository
   - Railway will automatically detect the `railway.json` configuration

### Step 3: Add PostgreSQL Database

1. **Add PostgreSQL Plugin:**
   - In your Railway project dashboard
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically create a PostgreSQL database

2. **Connect Database to Service:**
   - Railway will automatically set the `DATABASE_URL` environment variable
   - The backend will use this to connect to the database

### Step 4: Configure Environment Variables

1. **Set JWT Secret (Optional):**
   - In your Railway project dashboard
   - Go to your service → "Variables" tab
   - Add variable: `JWT_SECRET` = `your-secure-secret-here`
   - If not set, it will default to `supersecret`

2. **Verify Environment Variables:**
   - `DATABASE_URL`: Automatically set by Railway PostgreSQL plugin
   - `NODE_ENV`: Automatically set to `production` by Railway
   - `PORT`: Automatically set by Railway
   - `RAILWAY_STATIC_URL`: Automatically set by Railway

### Step 5: Deploy

1. **Trigger Deployment:**
   - Railway will automatically deploy when you push to GitHub
   - Or manually trigger deployment from the Railway dashboard

2. **Monitor Deployment:**
   - Watch the build logs in Railway dashboard
   - Check for any build errors

3. **Verify Deployment:**
   - Once deployed, Railway will provide a public URL
   - Test the health check: `https://your-app.railway.app/healthz`
   - Should return: `{"status":"ok","database":"connected"}`

## 🔍 Troubleshooting

### Common Issues

#### 1. Build Fails
**Symptoms:** Build process fails during Docker build
**Solutions:**
- Check Railway build logs for specific errors
- Verify all files are committed to GitHub
- Ensure `Dockerfile.railway` exists and is correct

#### 2. Database Connection Issues
**Symptoms:** Health check shows `"database":"error"`
**Solutions:**
- Verify PostgreSQL plugin is added to the project
- Check `DATABASE_URL` environment variable is set
- Ensure database migrations are running correctly

#### 3. WebSocket Connection Issues
**Symptoms:** Frontend can't connect to SFU
**Solutions:**
- Verify nginx configuration is correct
- Check SFU server is running on port 5001
- Ensure WebSocket path `/sfu` is properly configured

#### 4. Frontend Not Loading
**Symptoms:** Frontend shows errors or doesn't load
**Solutions:**
- Check nginx is serving static files correctly
- Verify frontend build completed successfully
- Check browser console for JavaScript errors

### Debugging Commands

#### Check Railway Logs
```bash
# View real-time logs in Railway dashboard
# Or use Railway CLI if installed
railway logs
```

#### Test Health Endpoints
```bash
# Test backend health
curl https://your-app.railway.app/healthz

# Test SFU health
curl https://your-app.railway.app/sfu/health
```

#### Check Environment Variables
```bash
# In Railway dashboard → Variables tab
# Verify all required variables are set:
# - DATABASE_URL
# - JWT_SECRET (optional)
# - NODE_ENV (auto-set)
# - PORT (auto-set)
# - RAILWAY_STATIC_URL (auto-set)
```

## 📊 Monitoring

### Railway Dashboard
- **Deployments:** View deployment history and status
- **Logs:** Real-time application logs
- **Metrics:** CPU, memory, and network usage
- **Variables:** Environment variable management

### Application Health
- **Health Check:** `https://your-app.railway.app/healthz`
- **Database Status:** Included in health check response
- **Service Status:** All services (backend, SFU, nginx) running in container

## 🔄 Updates and Maintenance

### Updating the Application
1. **Make changes to your code**
2. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Update application"
   git push origin main
   ```
3. **Railway will automatically redeploy**

### Database Migrations
- Migrations run automatically on startup
- Check logs for migration status
- Manual migrations not needed

### Scaling
- Railway automatically scales based on traffic
- Free tier includes 500 hours/month
- Upgrade for more resources if needed

## 🎯 Success Criteria

After deployment, you should be able to:

1. **Access the application:** `https://your-app.railway.app`
2. **Create an account:** Sign up with email/password
3. **Create rooms:** Navigate to `/rooms` and create video chat rooms
4. **Join rooms:** Join rooms with multiple participants
5. **Video chat:** Have real-time video/audio communication
6. **Test features:** Audio/video controls, screen sharing

## 📞 Support

If you encounter issues:

1. **Check Railway logs** for error messages
2. **Verify configuration** using the test script
3. **Test locally** to ensure code works before deploying
4. **Check Railway documentation** for platform-specific issues

## 🎉 Conclusion

Your Netra application is now ready for Railway deployment! The configuration handles all the complexities of running multiple services in a single container while maintaining the full functionality of the video chat platform.

---

**Deployment Status:** ✅ Ready
**Configuration:** ✅ Complete
**Testing:** ✅ Verified
**Documentation:** ✅ Comprehensive 