import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { storeApiPlugin } from './src/server/apiPlugin.ts'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [storeApiPlugin(), devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
