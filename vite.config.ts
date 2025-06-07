import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        // Proxy API requests to Tailscale
        '/api/v2': {
          target: 'https://api.tailscale.com',
          changeOrigin: true,
          secure: true,
          configure: (proxy, options) => {
            // Add error handling and logging
            proxy.on('error', (err, req, res) => {
              console.error('Proxy error:', err);
            });
            
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Proxying request:', req.method, req.url);
              
              // Add Authorization header dynamically
              if (env.VITE_TAILSCALE_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.VITE_TAILSCALE_API_KEY}`);
              }
              
              // Ensure proper headers
              proxyReq.setHeader('Accept', 'application/json');
              proxyReq.setHeader('User-Agent', 'TSFlow-Dev/1.0');
            });
            
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('Proxy response:', proxyRes.statusCode, req.url);
            });
          }
        }
      }
    },
  }
}) 