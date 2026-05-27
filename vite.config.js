import path from 'path';
import {defineConfig} from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      legacy({
        targets: ['firefox >= 48'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
