// Turns brand.json into what the build needs: CSS colour variables and the
// values swapped into index.html. Used by vite.config.ts only.
import type { Plugin } from 'vite'
import brand from './brand.json' with { type: 'json' }

type Palette = Record<string, string>

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
const vars = (p: Palette) =>
  Object.entries(p)
    .map(([k, v]) => `--${kebab(k)}:${v};`)
    .join('')

export function brandCss(): string {
  // Day mode only (Lewis, 5 Oct): phones set to dark mode still see the light colours.
  return `:root{${vars(brand.colors.light)}color-scheme:light only}`
}

const VIRTUAL = 'virtual:brand.css'
const RESOLVED = '\0' + VIRTUAL

export function brandPlugin(): Plugin {
  return {
    name: 'brand',
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED
    },
    load(id) {
      if (id === RESOLVED) return brandCss()
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('%BRAND_NAME%', brand.name)
        .replaceAll('%BRAND_TAGLINE%', brand.tagline)
        .replaceAll('%BRAND_THEME_LIGHT%', brand.colors.light.paper)
    },
  }
}
