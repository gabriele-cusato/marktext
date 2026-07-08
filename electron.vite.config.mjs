import { resolve, dirname } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'
import postcssPresetEnv from 'postcss-preset-env'
import packageJson from './package.json' with { type: 'json' }
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin locale: rende la CSP di index.html dipendente dall'ambiente.
// In dev (serve) mantiene 'unsafe-eval' e ws:/wss: richiesti da Vite/HMR;
// in build di produzione li rimuove per eliminare il warning "Insecure CSP".
const cspEnvPlugin = () => {
  let isServe = false
  return {
    name: 'mt-csp-env',
    config(_, { command }) {
      isServe = command === 'serve'
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('__CSP_UNSAFE_EVAL__', isServe ? "'unsafe-eval'" : '')
        .replaceAll('__CSP_WS__', isServe ? 'ws: wss:' : '')
    }
  }
}

export default defineConfig({
  main: {
    // --> Bundled as CommonJS
    // externalizeDepsPlugin() basically externises all the dependencies from being bundled during build - treating them as runtime dependencies
    // electron-vite still builds the main and preload processes into commonJS
    // hence, we need to "exclude" (in order to NOT externalise) ESonly modules so that they can be converted to commonJS and can be required() afterwards correctly
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      },
      externalizeDeps: {
        exclude: ['electron-store']
      }
    },
    define: {
      MARKTEXT_VERSION: JSON.stringify(packageJson.version),
      MARKTEXT_VERSION_STRING: JSON.stringify(`v${packageJson.version}`)
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        common: resolve(__dirname, 'src/common'),
        muya: resolve(__dirname, 'src/muya'),
        main_renderer: resolve(__dirname, 'src/main')
      },
      extensions: ['.mjs', '.js', '.json']
    }
  },
  preload: {
    // --> Bundled as CommonJS
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          // .cjs (non .js): package.json ha "type":"module", quindi con contextIsolation:true
          // Electron carica il preload col loader Node standard che tratterebbe un .js come ESM
          // (require non definito). Coerente col main, anch'esso emesso come .cjs.
          entryFileNames: '[name].cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        common: resolve(__dirname, 'src/common'),
        muya: resolve(__dirname, 'src/muya'),
        main_renderer: resolve(__dirname, 'src/main')
      },
      extensions: ['.mjs', '.js', '.json']
    }
  },
  renderer: {
    // --> Bundled as ES Modules
    assetsInclude: ['**/*.md'],
    // PATCH MarkText DESIGN-FIX-8: no-store su dev server per evitare cache browser
    // di chunk pre-bundled obsoleti dopo patch a node_modules (es. codemirror).
    server: {
      headers: { 'Cache-Control': 'no-store' }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        common: resolve(__dirname, 'src/common'),
        muya: resolve(__dirname, 'src/muya'),
        main_renderer: resolve(__dirname, 'src/main'),
        path: 'path-browserify' // solo renderer: shim browser-JS per fuzzaldrin (usa solo path.sep)
      },
      extensions: ['.mjs', '.js', '.json', '.vue']
    },
    // electron-localshortcut legge process.platform (solo stringa, nessun accesso al sistema):
    // sostituito col letterale a build-time della piattaforma target.
    define: {
      'process.platform': JSON.stringify(process.platform)
    },
    plugins: [
      vue(),
      svgLoader(),
      cspEnvPlugin()
    ],
    css: {
      postcss: {
        plugins: [
          postcssPresetEnv({
            stage: 0,
            features: { 'nesting-rules': true }
          })
        ]
      }
    }
  }
})
