// Configuration for different environments
const config = {
  development: {
    backendUrl: 'http://localhost:3000',
    sfuUrl: 'ws://localhost:5001',
    apiBaseUrl: '/api',
    sfuHealthUrl: '/sfu/health'
  },
  production: {
    // For Railway deployment, use the same domain with different paths
    backendUrl: process.env.RAILWAY_STATIC_URL ? 
      `${process.env.RAILWAY_STATIC_URL}/api` : 
      (process.env.BACKEND_URL || 'http://localhost:3000'),
    sfuUrl: process.env.RAILWAY_STATIC_URL ? 
      `wss://${process.env.RAILWAY_STATIC_URL.replace('https://', '').replace('http://', '')}/sfu` : 
      (process.env.SFU_URL || 'ws://localhost:5001'),
    apiBaseUrl: '/api',
    sfuHealthUrl: '/sfu/health'
  }
};

const environment = process.env.NODE_ENV || 'development';
export default config[environment]; 