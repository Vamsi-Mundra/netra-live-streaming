# Railway Deployment Guide for Netra Live Streaming

## 🚀 Quick Deploy to Railway

### Option 1: Deploy from GitHub (Recommended)

1. **Fork/Clone the Repository**
   ```bash
   git clone <your-repo-url>
   cd Netra
   ```

2. **Connect to Railway**
   - Go to [Railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your Netra repository

3. **Configure Environment Variables**
   Add these environment variables in Railway dashboard:
   ```
   POSTGRES_USER=netra
   POSTGRES_PASSWORD=<strong-password>
   POSTGRES_DB=netra
   JWT_SECRET=<your-secret-key>
   NODE_ENV=production
   ```

4. **Deploy**
   - Railway will automatically detect the Docker setup
   - Click "Deploy Now"
   - Wait for build and deployment to complete

### Option 2: Deploy with Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set POSTGRES_USER=netra
   railway variables set POSTGRES_PASSWORD=<strong-password>
   railway variables set POSTGRES_DB=netra
   railway variables set JWT_SECRET=<your-secret-key>
   railway variables set NODE_ENV=production
   ```

5. **Deploy**
   ```bash
   railway up
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_USER` | PostgreSQL username | `netra` | No |
| `POSTGRES_PASSWORD` | PostgreSQL password | `netra` | **Yes** |
| `POSTGRES_DB` | PostgreSQL database name | `netra` | No |
| `JWT_SECRET` | JWT signing secret | `supersecret` | **Yes** |
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Application port | `3000` | No |

### Custom Domain Setup

1. **Add Custom Domain**
   - Go to Railway dashboard
   - Click on your project
   - Go to "Settings" → "Domains"
   - Add your custom domain

2. **Configure DNS**
   - Add CNAME record pointing to your Railway domain
   - Wait for DNS propagation (up to 24 hours)

## 📊 Monitoring & Logs

### View Logs
```bash
railway logs
```

### Monitor Performance
- Railway provides built-in monitoring
- Check "Metrics" tab in dashboard
- Monitor CPU, memory, and network usage

### Health Checks
- Backend: `https://your-domain.com/api/healthz`
- SFU: `https://your-domain.com/sfu/health`

## 🔒 Security Considerations

### Production Security Checklist

- [ ] Change default passwords
- [ ] Use strong JWT secret
- [ ] Enable HTTPS (automatic with Railway)
- [ ] Set up proper CORS headers
- [ ] Configure rate limiting
- [ ] Use environment variables for secrets

### SSL/HTTPS
Railway automatically provides SSL certificates for all deployments.

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   railway logs --service=frontend
   ```

2. **Database Connection Issues**
   ```bash
   # Verify database is running
   railway logs --service=db
   ```

3. **WebSocket Connection Issues**
   - Ensure SFU service is healthy
   - Check WebSocket URL configuration
   - Verify firewall settings

### Debug Commands

```bash
# Check service status
railway status

# View specific service logs
railway logs --service=backend

# Restart services
railway service restart backend

# SSH into container (if needed)
railway shell
```

## 📈 Scaling

### Auto-scaling
Railway automatically scales based on traffic. You can configure:
- Minimum instances
- Maximum instances
- CPU/memory limits

### Manual Scaling
```bash
# Scale specific service
railway scale backend=2
```

## 💰 Cost Optimization

### Railway Pricing
- Pay per usage
- Free tier available
- Automatic scaling

### Cost Saving Tips
1. Use development environment for testing
2. Monitor resource usage
3. Set appropriate scaling limits
4. Use Railway's free tier for small projects

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Railway
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: railway/cli@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
        run: railway up
```

## 📞 Support

- **Railway Documentation**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **GitHub Issues**: Create issue in your repository

## 🎯 Next Steps

After successful deployment:

1. **Test the Application**
   - Verify all features work
   - Test live streaming functionality
   - Check mobile responsiveness

2. **Set Up Monitoring**
   - Configure alerts
   - Set up logging
   - Monitor performance

3. **Optimize Performance**
   - Enable caching
   - Optimize images
   - Configure CDN

4. **Security Audit**
   - Review security settings
   - Test authentication
   - Verify data protection

---

**Happy Streaming! 🎥** 