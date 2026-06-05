import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Dois modos de build:
//   npm run build         -> dist/        (multi-arquivo, para hospedar / virar PWA)
//   npm run build:single  -> dist-single/ (UM index.html autossuficiente p/ enviar)
export default defineConfig(({ mode }) => ({
  base: './',
  server: { port: 5179, strictPort: true },
  preview: { port: 4178, strictPort: true },
  build: {
    outDir: mode === 'singlefile' ? 'dist-single' : 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  plugins: mode === 'singlefile' ? [viteSingleFile()] : [],
}))
