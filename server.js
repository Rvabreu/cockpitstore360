import { createApiRouter } from './src/server/index.js'
import express from 'express'
import path from 'node:path'

const app = express()
app.use(express.json())
app.use('/api', createApiRouter())

const clientDist = path.resolve(process.cwd(), 'dist/client')
app.use(express.static(clientDist))

// Fallback to index.html for SPA routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
