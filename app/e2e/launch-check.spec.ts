// Launch check (task T32): every screen passes an accessibility audit in a
// real browser (including colour contrast, which unit tests can't check) and
// fits a small phone (320 px wide) without sideways scrolling.
import { createRequire } from 'node:module'
import { expect, test, type Page } from '@playwright/test'
import { admin, closeGuide, idOf, newPhone, pickPlace, signIn } from './helpers'

const require = createRequire(import.meta.url)
const AXE = require.resolve('axe-core/axe.min.js')
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const demo = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Accessibility problems and sideways overflow on the current screen, as readable lines. */
async function problems(page: Page, name: string): Promise<string[]> {
  await page.addScriptTag({ path: AXE })
  const found: string[] = await page.evaluate(async () => {
    // @ts-expect-error axe is added to the page above
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    return result.violations.map(
      (v: { id: string; help: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}]`,
    )
  })
  await page.setViewportSize({ width: 320, height: 640 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) found.push(`overflow: ${overflow}px wider than a 320px phone`)
  await page.setViewportSize({ width: 390, height: 844 })
  return found.map((f) => `${name} → ${f}`)
}

async function visit(page: Page, path: string, heading: RegExp | string, issues: string[]) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  issues.push(...(await problems(page, path)))
}

test('every screen is accessible and fits a small phone', async ({ browser }) => {
  test.setTimeout(180_000)
  const issues: string[] = []
  const page = await newPhone(browser)

  // Signed out
  await visit(page, '/', /./, issues)
  await visit(page, '/sign-in', 'Join the Collective', issues)
  await visit(page, '/meeting-safely', 'Meeting up safely', issues)
  for (const [path, title] of [
    ['/terms', /Terms/],
    ['/privacy', /Privacy/],
    ['/community-rules', /Community rules/],
  ] as const) {
    await visit(page, path, title, issues)
  }

  // A new member with a full profile
  const email = `launch${Date.now()}@example.com`
  await signIn(page, email)
  issues.push(...(await problems(page, '/onboarding step 1')))
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Day').selectOption('2')
  await page.getByLabel('Month').selectOption({ label: 'May' })
  await page.getByLabel('Year').fill('1962')
  await page.getByRole('radio', { name: 'Woman', exact: true }).check({ force: true })
  await pickPlace(page, 'Leed', 'Leeds, United Kingdom')
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByText(/Step 2 of 3/)).toBeVisible()
  issues.push(...(await problems(page, '/onboarding step 2')))
  await page.locator('#photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG, 'base64') })
  await expect(page.getByRole('img', { name: 'Your profile photo' })).toBeVisible()
  await page.getByRole('button', { name: /continue|skip/i }).click()
  await expect(page.getByText(/Step 3 of 3/)).toBeVisible()
  issues.push(...(await problems(page, '/onboarding step 3')))
  for (const name of ['Museums', 'Wine', 'Walking', 'Photography', 'Theatre', 'Local cuisine', 'Gardens']) {
    await page.getByRole('checkbox', { name, exact: true }).evaluate((el: HTMLElement) => el.click())
  }
  await page.getByRole('button', { name: 'Finish sign-up' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome to the Collective' })).toBeVisible()
  issues.push(...(await problems(page, '/welcome')))

  // Someone she's connected with, and someone waiting for an answer
  const me = await idOf(email)
  for (const n of [1, 2]) await admin.from('profiles').update({ photo_path: `${demo(n)}/demo.jpg` }).eq('id', demo(n))
  const { data: made } = await admin.from('connections').insert({ requester_id: demo(1), addressee_id: me, note: 'Hello!' }).select('id').single()
  await admin.from('connections').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', made!.id)
  await admin.from('connections').insert({ requester_id: demo(2), addressee_id: me, note: 'Fancy Lisbon?' })
  const { data: chat } = await admin.from('conversations').select('id').eq('connection_id', made!.id).single()
  await admin.from('profiles').update({ role: 'admin' }).eq('id', me)

  await visit(page, '/connections', 'Connections', issues)
  await visit(page, '/connections/requests', 'Connections', issues)
  await visit(page, '/trips', /./, issues)
  await visit(page, '/trips/new', /./, issues)
  await visit(page, '/messages', 'Chat', issues)
  await page.goto(`/messages/${chat!.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  issues.push(...(await problems(page, '/messages/:id (with guide)')))
  await closeGuide(page)
  await visit(page, `/messages/${chat!.id}/plan`, /./, issues)
  await visit(page, `/messages/${chat!.id}/share`, 'Tell someone you trust', issues)
  await visit(page, '/groups', 'Chat', issues)
  await visit(page, '/groups/new', 'Start a group', issues)
  await visit(page, '/profile', /Hello/, issues)
  await visit(page, '/filters', 'Filters', issues)
  await visit(page, '/account', 'Your account and data', issues)
  await visit(page, '/onboarding?step=4', 'How you travel', issues)
  await visit(page, '/admin', /./, issues)
  await visit(page, '/admin/insights', /./, issues)

  // The trusted contact's page
  await page.goto(`/messages/${chat!.id}/share`)
  await page.getByLabel('Where are you meeting?').fill('Café Nero, Leeds station')
  const soon = new Date(Date.now() + 86_400_000)
  await page.getByLabel('When?').fill(soon.toISOString().slice(0, 11) + '11:00')
  await page.getByRole('button', { name: 'Make the link' }).click()
  await expect(page.getByText('Your link is ready', { exact: false })).toBeVisible()
  issues.push(...(await problems(page, '/messages/:id/share (with a link)')))
  const { data: share } = await admin.from('meetup_shares').select('token').eq('owner_id', me).single()
  const friend = await newPhone(browser)
  await visit(friend, `/safe/${share!.token}`, /meet-up/, issues)
  await visit(friend, '/safe/not-a-real-link-000000000000000', 'This link has ended', issues)

  expect(issues, issues.join('\n')).toEqual([])
})
