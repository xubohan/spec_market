import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './styles/globals.css'
import { makeRouter } from './app/routes'   // 👈 改这里：引入工厂函数

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, gcTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
})

// 与 Vite base 一致：/ai/specfront/（由 Vite 注入）
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
const router = makeRouter(basename)          // 👈 用基准路径创建 router

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
