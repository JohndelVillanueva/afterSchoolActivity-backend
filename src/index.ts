import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { routes } from './controllers/routes.js'
// import other routers as needed
// import { auth, jobPosting, routes, skill, applicant } from './controllers/routes.js'
import { serveStatic } from 'hono/serve-static'
import { promises as fs } from 'fs'
import path from 'path'

const app = new Hono()

// Add CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:5173'], // Your frontend URL
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

// Add request logging middleware
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`)
  await next()
  console.log(`Response status: ${c.res.status}`)
})

app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`)
  await next()
  console.log(`Response: ${c.res.status}`)
})

app.use('/uploads/*', serveStatic({
  root: './',
  rewriteRequestPath: (p) => p.replace(/^\/uploads/, '/uploads'),
  getContent: async (filePath) => {
    try {
      // Remove leading slash if present and ensure correct path
      const cleanPath = filePath.replace(/^\/+/, '');
      console.log('[DEBUG] Attempting to read file:', cleanPath);
      return await fs.readFile(cleanPath);
    } catch (error) {
      console.error('[DEBUG] File not found:', filePath, error);
      return null;
    }
  }
}))

// Mount all routes at root level
routes.forEach((route) => {
  app.route('', route)
})

// Add a test route
app.get('/test', (c) => {
  return c.json({ message: 'Server is working!' })
})

console.log('Starting server...')
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
