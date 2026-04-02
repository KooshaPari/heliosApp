import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const federationMode = process.env.FEDERATION_MODE === 'remote';
const parsedPort = Number.parseInt(process.env.VITE_PORT ?? '', 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 3001;

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'heliosApp',
      filename: 'remoteEntry.js',
      // Expose components and pages as remote modules
      exposes: {
        './Dashboard': './src/pages/Dashboard.tsx',
        './Components': './src/components/index.tsx',
        './Hooks': './src/hooks/index.ts',
      },
      // Share dependencies with host
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.0.0',
          strictVersion: false,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0',
          strictVersion: false,
        },
      },
    }),
  ],
  server: {
    port,
    hmr: {
      host: 'localhost',
      port,
    },
  },
  build: {
    target: 'esnext',
    outDir: federationMode ? 'dist-remote' : 'dist',
  },
});
