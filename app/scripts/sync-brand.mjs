// Copies the app name from brand.json into the iPhone and Android projects,
// which keep their own copy. Run by `npm run cap:sync`.
import { readFileSync, writeFileSync } from 'node:fs'

const brand = JSON.parse(readFileSync(new URL('../brand.json', import.meta.url), 'utf8'))
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'")

function edit(path, pattern, replacement) {
  const url = new URL(`../${path}`, import.meta.url)
  const before = readFileSync(url, 'utf8')
  const after = before.replace(pattern, replacement)
  if (after !== before) {
    writeFileSync(url, after)
    console.log(`Updated ${path}`)
  }
}

const name = xmlEscape(brand.name)
edit('android/app/src/main/res/values/strings.xml', /(<string name="(?:app_name|title_activity_main)">)[^<]*(<\/string>)/g, `$1${name}$2`)
edit('ios/App/App/Info.plist', /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${name}$2`)
