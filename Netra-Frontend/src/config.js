// Configuration for different environments
const config = {
  development: {
    backendUrl: 'http://localhost:3000',
    sfuUrl: 'ws://localhost:5001',
    apiBaseUrl: '/api',
    sfuHealthUrl: '/sfu/health'
  },
  production: {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    sfuUrl: process.env.SFU_URL || 'ws://localhost:5001',
    apiBaseUrl: '/api',
    sfuHealthUrl: '/sfu/health'
  }
};

const environment = process.env.NODE_ENV || 'development';
export default config[environment]; 