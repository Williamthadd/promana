/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env files and populate process.env
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
Object.assign(process.env, env)

const hasFirebaseEnv = process.env.VITE_FIREBASE_API_KEY && process.env.VITE_FIREBASE_API_KEY !== 'placeholder'

function devApiPlugin() {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
          const apiPath = url.pathname
          
          const filePath = path.resolve(__dirname, `.${apiPath}.js`)
          if (fs.existsSync(filePath)) {
            try {
              let body = ''
              if (req.method === 'POST') {
                body = await new Promise((resolve) => {
                  let chunkData = ''
                  req.on('data', chunk => chunkData += chunk)
                  req.on('end', () => resolve(chunkData))
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
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
  resolve: {
    alias: !hasFirebaseEnv ? {
      'firebase/app': path.resolve(__dirname, './src/mockFirebase.js'),
      'firebase/auth': path.resolve(__dirname, './src/mockFirebase.js'),
      'firebase/firestore': path.resolve(__dirname, './src/mockFirebase.js'),
    } : {}
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all'
  },
  build: {
    sourcemap: false,
  },
})
