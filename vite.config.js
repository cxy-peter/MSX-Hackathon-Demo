import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        wealth: resolve(__dirname, 'wealth.html'),
        paperTrading: resolve(__dirname, 'paper-trading.html'),
        chartHoverDemo: resolve(__dirname, 'chart-hover-demo.html')
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 4173
  }
});
