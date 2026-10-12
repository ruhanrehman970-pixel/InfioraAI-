import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: page('./index.html'),
        account: page('./account.html'),
        dashboard: page('./dashboard.html'),
      },
    },
  },
})
