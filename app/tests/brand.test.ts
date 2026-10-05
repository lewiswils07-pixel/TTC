import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import brandJson from '../brand.json'
import { brandCss } from '../brand.plugin'
import { brand } from '../src/lib/brand'

describe('brand settings', () => {
  it('comes from brand.json', () => {
    expect(brand.name).toBe(brandJson.name)
  })
  it('turns colours into CSS variables, day mode only', () => {
    const css = brandCss()
    expect(css).toContain(`--accent:${brandJson.colors.light.accent};`)
    expect(css).toContain('color-scheme:light only')
    expect(css).not.toContain('prefers-color-scheme: dark')
  })
})

describe('phone app names', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
  it('match brand.json (run `npm run cap:sync` after a rename)', () => {
    expect(read('android/app/src/main/res/values/strings.xml')).toContain(`<string name="app_name">${brandJson.name}</string>`)
    expect(read('ios/App/App/Info.plist')).toContain(`<string>${brandJson.name}</string>`)
  })
})
