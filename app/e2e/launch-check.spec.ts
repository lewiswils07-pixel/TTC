// Launch check (task T32): every screen passes an accessibility audit in a
// real browser (including colour contrast, which unit tests can't check) and
// fits a small phone (320 px wide) and a laptop without sideways scrolling.
import { createRequire } from 'node:module'
import { expect, test, type Page } from '@playwright/test'
import { admin, closeGuide, idOf, isoIn, newPhone, pickPlace, signIn, fillCard, choose } from './helpers'

const require = createRequire(import.meta.url)
const AXE = require.resolve('axe-core/axe.min.js')
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const demo = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Accessibility problems and sideways overflow on the current screen, as readable lines. */
async function problems(page: Page, name: string): Promise<string[]> {
  // Let the screen finish fading in, so colours are checked as members see them.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  )
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
  await page.setViewportSize({ width: 1280, height: 800 })
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (wide > 0) found.push(`overflow: ${wide}px wider than a laptop screen`)
  await page.setViewportSize({ width: 390, height: 844 })
  return found.map((f) => `${name} → ${f}`)
}

async function visit(page: Page, path: string, heading: RegExp | string, issues: string[]) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  issues.push(...(await problems(page, path)))
}

test('every screen is accessible and fits a small phone and a laptop', async ({ browser }) => {
  test.setTimeout(180_000)
  const issues: string[] = []
  const page = await newPhone(browser)

  // Signed out
  await visit(page, '/', /./, issues)
  await visit(page, '/sign-in', 'Join the Collective', issues)
  await visit(page, '/meeting-safely', 'Meeting up safely', issues)
  await visit(page, '/help', /Help/, issues)
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
  await page.getByRole('button', { name: /^Day/ }).click()
  issues.push(...(await problems(page, '/onboarding step 1 (day list open)')))
  await page.keyboard.press('Escape')
  await choose(page, /^Day/, '2')
  await choose(page, /^Month/, 'May')
  await page.getByLabel('Year').fill('1962')
  await page.getByRole('radio', { name: 'Woman', exact: true }).check({ force: true })
  await pickPlace(page, 'Leed', 'Leeds, United Kingdom')
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByText(/Step 2 of 4/)).toBeVisible()
  issues.push(...(await problems(page, '/onboarding step 2')))
  await page.locator('#photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG, 'base64') })
  await expect(page.getByRole('img', { name: 'Your profile photo' })).toBeVisible()
  await page.getByRole('button', { name: /continue|skip/i }).click()
  await expect(page.getByText(/Step 3 of 4/)).toBeVisible()
  issues.push(...(await problems(page, '/onboarding step 3')))
  for (const name of ['Museums', 'Wine', 'Walking', 'Photography', 'Theatre', 'Local cuisine', 'Gardens', 'Architecture']) {
    await page.getByRole('checkbox', { name, exact: true }).evaluate((el: HTMLElement) => el.click())
  }
  // At the limit: a notice, and a nudge when trying to pick a ninth.
  await expect(page.getByText(/That’s all 8 picked/)).toBeVisible()
  await page.getByRole('checkbox', { name: 'Art galleries', exact: true }).evaluate((el: HTMLElement) => el.click())
  await expect(page.getByRole('alert').filter({ hasText: 'You’ve already picked 8' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Art galleries', exact: true })).not.toBeChecked()
  issues.push(...(await problems(page, '/onboarding step 3 (at the limit)')))
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/Step 4 of 4/)).toBeVisible()
  issues.push(...(await problems(page, '/onboarding step 4')))
  await page.getByRole('button', { name: 'Choose a question' }).first().click()
  issues.push(...(await problems(page, '/onboarding step 4 (question list open)')))
  await page.keyboard.press('Escape')
  await fillCard(page)
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

  await visit(page, '/connections', 'Connect', issues)
  // The privacy box shows once, after sign-up; she chooses for herself.
  await expect(page.getByRole('heading', { name: 'We value your privacy' })).toBeVisible()
  issues.push(...(await problems(page, '/connections (privacy box)')))
  await page.getByRole('link', { name: 'Choose for myself' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy choices' })).toBeVisible()
  issues.push(...(await problems(page, '/settings/privacy')))
  await page.getByRole('switch', { name: /Measuring how the app is used/ }).evaluate((el: HTMLElement) => el.click())
  await page.getByRole('button', { name: 'Save choices' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  issues.push(...(await problems(page, '/settings')))
  // The tour, then the back of a card.
  await page.goto('/connections?tour=1')
  await expect(page.getByRole('heading', { name: 'Meet people one at a time' })).toBeVisible()
  issues.push(...(await problems(page, '/connections (tour)')))
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: /card over$/ }).click()
  await expect(page.locator('.feed-back')).toBeVisible()
  await page.waitForTimeout(700)
  issues.push(...(await problems(page, '/connections (card flipped)')))
  await page.getByRole('button', { name: /back to the front$/ }).click()
  await visit(page, '/requests', 'Chat', issues)
  await visit(page, '/messages', 'Chat', issues)
  // A connection's full profile, from Other connections on Chats.
  await page.getByRole('link', { name: /^View .+’s profile$/ }).first().click()
  await expect(page.getByRole('heading', { name: 'In their own words' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  issues.push(...(await problems(page, '/connections/people/:id')))
  await visit(page, '/trips', /./, issues)
  await visit(page, '/trips/new', /./, issues)
  const { data: trip } = await admin.from('trips').insert({ owner_id: me, city_id: 2267057, start_date: isoIn(30), end_date: isoIn(34) }).select('id').single()
  await admin.from('city_reviews').insert({ profile_id: demo(2), city_id: 2267057, rating: 5, body: 'Take the tram early, before the crowds.' })
  await visit(page, `/trips/${trip!.id}`, /Lisbon/, issues)
  // Your own plan: add one of our picks and an idea of your own.
  await page.getByRole('tab', { name: 'My plan' }).click()
  await expect(page.getByRole('heading', { name: 'Things to do in Lisbon' })).toBeVisible()
  await page.getByRole('button', { name: /^Add to the plan: / }).first().click()
  await expect(page.getByText('✓ On the plan')).toBeVisible()
  await page.getByLabel('Add something to do').fill('Sunset at a miradouro')
  await choose(page, /^Day/, /^Day 2/)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Sunset at a miradouro' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Sunset at a miradouro' }).check()
  await expect(page.getByText('1 of 2 done')).toBeVisible()
  issues.push(...(await problems(page, '/trips/:id?tab=plan')))
  // Reviews: someone else's, then her own.
  await page.getByRole('tab', { name: 'Reviews' }).click()
  await expect(page.getByText('Take the tram early, before the crowds.')).toBeVisible()
  await expect(page.getByText(/You can add your own review once your trip starts/)).toBeVisible()
  // Once the trip has started, she can add her own.
  await admin.from('trips').update({ start_date: isoIn(0) }).eq('id', trip!.id)
  await page.reload()
  await page.getByRole('tab', { name: 'Reviews' }).click()
  await page.getByRole('button', { name: 'Post review' }).click()
  await expect(page.getByText('Please choose how many stars.')).toBeVisible()
  await page.getByRole('radio', { name: '4 stars' }).check({ force: true })
  await page.getByLabel('A few words (optional)').fill('Lovely light and kind people.')
  await page.getByRole('button', { name: 'Post review' }).click()
  await expect(page.getByText('Your review', { exact: true })).toBeVisible()
  await expect(page.locator('.review-average')).toHaveText('4.5')
  issues.push(...(await problems(page, '/trips/:id?tab=reviews')))
  // Someone going to Lisbon at the same time shows in the "Trips in common" tile.
  await admin.from('profiles').update({ photo_path: `${demo(3)}/demo.jpg`, last_active_at: new Date().toISOString() }).eq('id', demo(3))
  await admin.from('trips').insert({ owner_id: demo(3), city_id: 2267057, start_date: isoIn(31), end_date: isoIn(33) })
  await visit(page, '/connections', 'Connect', issues)
  await page.getByRole('link', { name: /Trips in common/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Trips in common' })).toBeVisible()
  await expect(page.locator('.plus-person').filter({ hasText: 'Lisbon' }).first()).toBeVisible()
  issues.push(...(await problems(page, '/connections/same-time')))
  await visit(page, '/messages', 'Chat', issues)
  await page.goto(`/messages/${chat!.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  issues.push(...(await problems(page, '/messages/:id (with guide)')))
  await closeGuide(page)
  await page.getByRole('button', { name: 'More options' }).click()
  issues.push(...(await problems(page, '/messages/:id (menu open)')))
  await visit(page, `/messages/${chat!.id}/plan`, /./, issues)
  await choose(page, 'See our picks for a city', 'Lisbon')
  await page.getByRole('button', { name: /^Add to the plan: / }).first().click()
  await expect(page.getByText('✓ On the plan')).toBeVisible()
  issues.push(...(await problems(page, '/messages/:id/plan (with city picks)')))
  await visit(page, `/messages/${chat!.id}/share`, 'Tell someone you trust', issues)
  await visit(page, `/plan-together/${demo(1)}`, /Plan a trip with/, issues)
  await page.getByRole('radio', { name: /Somewhere new/ }).check()
  issues.push(...(await problems(page, '/plan-together/:id (somewhere new)')))
  await visit(page, '/profile/preview', /./, issues)
  await visit(page, '/groups', 'Chat', issues)
  await visit(page, '/groups/new', 'Start a group', issues)
  await visit(page, '/profile', /./, issues)
  await visit(page, '/profile?tab=safety', /./, issues)
  await expect(page.getByRole('heading', { name: 'If you need help now' })).toBeVisible()
  await visit(page, '/profile?tab=plus', /./, issues)
  await expect(page.getByRole('heading', { name: /Sodalis\+/ })).toBeVisible()
  await visit(page, '/filters', 'Filters', issues)
  await visit(page, '/account', 'Your account and data', issues)
  await visit(page, '/onboarding?step=4', 'The back of your card', issues)
  await visit(page, '/onboarding?step=5', 'How you travel', issues)
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
