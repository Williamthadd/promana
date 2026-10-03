/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'
import { pwaAppShellPlugin } from './scripts/pwa-app-shell-plugin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env files and populate process.env
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
Object.assign(process.env, env)

const hasFirebaseEnv = process.env.VITE_FIREBASE_API_KEY && process.env.VITE_FIREBASE_API_KEY !== 'placeholder'

function devApiPlugin() {
  // Dev-only emulation of Vercel's /api routing. Route names are strictly
  // allowlisted to single path segments so crafted URLs cannot traverse out
  // of api/ (e.g. /api/../vite.config) and cause arbitrary files to be
  // imported as route handlers.
  const apiDir = path.resolve(__dirname, 'api')
  const routePattern = /^\/api\/([A-Za-z0-9-]+)$/

  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
          const routeMatch = url.pathname.match(routePattern)

          if (!routeMatch) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Not found' }))
            return
          }

          const filePath = path.resolve(apiDir, `${routeMatch[1]}.js`)

          if (!filePath.startsWith(`${apiDir}${path.sep}`) || !fs.existsSync(filePath)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Not found' }))
            return
          }

          try {
              let body = ''
              if (req.method === 'POST') {
                body = await new Promise((resolve, reject) => {
                  let chunkData = ''
                  req.on('data', chunk => {
                    chunkData += chunk

                    if (chunkData.length > 1_048_576) {
                      reject(new Error('Dev request body is too large.'))
                    }
                  })
                  req.on('end', () => resolve(chunkData))
                  req.on('error', reject)
                })
              }
              
              const vercelReq = req
              try {
                vercelReq.body = body ? JSON.parse(body) : {}
              } catch {
                vercelReq.body = body
              }
              
              const vercelRes = {
                status(code) {
                  res.statusCode = code
                  return this
                },
                setHeader(name, value) {
                  res.setHeader(name, value)
                  return this
                },
                json(data) {
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(data))
                },
                send(data) {
                  res.end(data)
                },
                end(data) {
                  res.end(data)
                }
              }
              
              const module = await import(`${pathToFileURL(filePath).href}?update=${Date.now()}`)
              await module.default(vercelReq, vercelRes)
              return
            } catch (err) {
              console.error('Error running dev API route:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
              return
            }
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin(), pwaAppShellPlugin()],
  resolve: {
    alias: !hasFirebaseEnv ? {
      'firebase/app': path.resolve(__dirname, './src/mockFirebase.js'),
      'firebase/auth': path.resolve(__dirname, './src/mockFirebase.js'),
      'firebase/firestore': path.resolve(__dirname, './src/mockFirebase.js'),
    } : {}
  },
  server: {
    // Bind loopback only by default so a dev session is not reachable from
    // the local network. Set VITE_DEV_HOST=0.0.0.0 explicitly if LAN testing
    // is required, and never forward the dev server to the public internet.
    host: process.env.VITE_DEV_HOST || '127.0.0.1',
    port: 3000,
  },
  build: {
    sourcemap: false,
  },
})
