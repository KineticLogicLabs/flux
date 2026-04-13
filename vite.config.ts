import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // 1. Set the base to your repository name (e.g., '/flux-meet/')
    // If you are deploying to a custom domain or kineticlogiclabs.github.io, set this to '/'
    base: '/flux-meet/', 
    
    plugins: [react(), tailwindcss()],
    
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    resolve: {
      alias: {
        // 2. Ensuring '@' points to your root or src directory correctly
        '@': path.resolve(__dirname, './'),
      },
    },
    
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },

    build: {
      // 3. Ensuring the build output is clean for deployment
      outDir: 'dist',
    }
  };
});
