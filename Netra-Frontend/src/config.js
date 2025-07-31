// Configuration for different environments
const config = {
  development: {
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
    sfuUrl: import.meta.env.VITE_SFU_URL || 'ws://localhost:5001',
    apiBaseUrl: '/api',
    sfuHealthUrl: '/sfu/health'
  },
  production: {
    // For Railway deployment, use the same domain with different paths
    backendUrl: import.meta.env.VITE_RAILWAY_STATIC_URL ? 
      `${import.meta.env.VITE_RAILWAY_STATIC_URL}/api` : 
      (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'),
    sfuUrl: import.meta.env.VITE_RAILWAY_STATIC_URL ? 
      `wss://${import.meta.env.VITE_RAILWAY_STATIC_URL.replace('https://', '').replace('http://', '')}/sfu` : 
      (import.meta.env.VITE_SFU_URL || 'ws://localhost:5001'),
    apiBaseUrl: '/api',
    sfuHealthUrl: '/sfu/health'
  }
};

const environment = import.meta.env.MODE || 'development';
export default config[environment]; 