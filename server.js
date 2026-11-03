import { createProductionApp } from './dist/server/entry.js'

const app = createProductionApp()
const PORT = Number(process.env.PORT || 5000)
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
