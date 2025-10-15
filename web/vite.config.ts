// import { defineConfig } from 'vitest/config';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 5173,
//     proxy: {
//     '/specmarket': {
//       target: 'http://localhost:8000',
//       changeOrigin: true
//       }
//     }
//   },
//   test: {
//     environment: 'jsdom',
//   },
// });


// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // 读取 .env.*（只接收以 VITE_ 开头的变量）
  const env = loadEnv(mode, process.cwd(), '')

  const target = env.VITE_BACKEND_TARGET || 'http://localhost:8000'  // 后端地址（端口可改）
  const devPort = Number(env.VITE_PORT || 5173)

  return {
    plugins: [react()],
    server: {
      port: devPort,
      proxy: {
        // 保持与后端路由前缀一致：/specmarket/v1/...
        '/specmarket': {
          target,
          changeOrigin: true,
          // 不要 rewrite；你的后端本来就有 /specmarket/v1
          // 如果后端是自签名 HTTPS，可加 secure: false
          // secure: false,
        }
      }
    },
    // 方便预览时也代理（可选）
    preview: {
      port: devPort,
      proxy: {
        '/specmarket': { target, changeOrigin: true /* secure: false */ }
      }
    },
    test: {
      environment: 'jsdom',
    },
  }
})

