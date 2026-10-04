import type { CapacitorConfig } from '@capacitor/cli'
import brand from './brand.json' with { type: 'json' }

// The phone apps wrap the same web build (dist/). Name and store id come
// from brand.json. After changing either, run `npx cap sync`.
const config: CapacitorConfig = {
  appId: brand.appId,
  appName: brand.name,
  webDir: 'dist',
  plugins: {
    // Android: report notch and gesture-bar sizes to the page as CSS
    // variables (--safe-area-inset-*), used in src/styles/tokens.css.
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    // Shrink the page above the on-screen keyboard so fields stay visible.
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
  },
}

export default config
