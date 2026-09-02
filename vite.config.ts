import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// На GitHub Pages сайт живёт в подкаталоге /<repo>/, локально — в корне.
// Базовый путь задаётся переменной BASE_PATH (см. .github/workflows/deploy.yml).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
