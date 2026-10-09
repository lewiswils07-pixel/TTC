// The whole member journey in one run (spec §13, task T25): join, build a
// profile, add a trip, see suggestions, ask to connect, get accepted, chat
// (with a scam warning), start a group, plan together, and report and block,
// ending with the report on the review page.
import { expect, test } from '@playwright/test'
import { admin, closeGuide, emailOf, idOf, isoIn, newPhone, pickPlace, signIn, fillCard, choose, pickDates } from './helpers'

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test('a new member joins, connects, chats, plans with a group, and reports', async ({ browser }) => {
  const a = await newPhone(browser)
  const lewisEmail = `journey${Date.now()}@example.com`
  const password = 'paris in the spring'

  await test.step('join and build a profile', async () => {
    await signIn(a, lewisEmail, password)
    await expect(a.getByText(/Step 1 of 4/)).toBeVisible()
    await a.getByLabel('First name').fill('Lewis')
    await choose(a, /^Day/, '14')
    await choose(a, /^Month/, 'November')
    await a.getByLabel('Year').fill('1970')
    await a.getByRole('radio', { name: 'Man', exact: true }).check({ force: true })
    await pickPlace(a, 'Leed', 'Leeds, United Kingdom')
    await a.getByRole('button', { name: /continue/i }).click()
    await expect(a.getByText(/Step 2 of 4/)).toBeVisible()
    // A photo is needed to ask to connect (a 1×1 PNG is enough here).
    await a.locator('#photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG, 'base64') })
    await expect(a.getByRole('img', { name: 'Your profile photo' })).toBeVisible()
    await a.getByRole('button', { name: /continue|skip/i }).click()
    await expect(a.getByText(/Step 3 of 4/)).toBeVisible()
    for (const name of ['Museums', 'Wine', 'Walking', 'Photography', 'Theatre', 'Local cuisine', 'Gardens', 'Architecture']) {
      await a.getByRole('checkbox', { name, exact: true }).evaluate((el: HTMLElement) => el.click())
    }
    await a.getByRole('button', { name: 'Continue' }).click()
    await fillCard(a)
    await expect(a.getByRole('heading', { name: 'Welcome to the Collective' })).toBeVisible()
    await expect(a.getByRole('heading', { name: /is on us for/ })).toBeVisible()
    await a.getByRole('link', { name: 'Start meeting people' }).click()
    // The tour opens first; look at the first step, then skip it.
    await expect(a.getByRole('heading', { name: 'Meet people one at a time' })).toBeVisible()
    await a.getByRole('button', { name: 'Skip', exact: true }).click()
    // Then, once, the privacy choices.
    await expect(a.getByRole('heading', { name: 'We value your privacy' })).toBeVisible()
    await a.getByRole('button', { name: 'Accept all' }).click()
    await expect(a.getByRole('heading', { name: 'We value your privacy' })).toBeHidden()
    await expect(a.getByRole('heading', { level: 1, name: 'Connect' })).toBeVisible()
    await expect(a.locator('.person-feed-card')).toBeVisible()
  })

  let other = ''
  await test.step('add a trip and ask someone going too', async () => {
    await a.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Trips' }).click()
    await a.getByRole('link', { name: 'Add your first trip' }).click()
    await pickPlace(a, 'Pari', /Paris, France/)
    await pickDates(a, isoIn(20), isoIn(50))
    await a.getByRole('radio', { name: '1 week either way' }).evaluate((el: HTMLElement) => el.click())
    await a.getByRole('button', { name: 'Add trip' }).click()
    await expect(a.getByRole('heading', { name: /going too/ })).toBeVisible()
    other = await a.locator('.match-card h3').first().innerText()
    await a.getByRole('button', { name: `Ask to connect with ${other}` }).first().click()
    await a.getByLabel(/Add a note/).fill('Hello! Would you like to see the Musée d’Orsay together?')
    await a.getByRole('button', { name: 'Send request' }).click()
    await expect(a.getByText(/Request sent/)).toBeVisible()
    // The Connect tab now leads with people going to Paris too, their trip first on the card.
    await a.goto('/connections')
    await expect(a.locator('.person-feed-card .feed-trip').first()).toContainText('Paris ·')
  })

  const lewis = await idOf(lewisEmail)
  const { data: choices } = await admin.from('privacy_choices').select('measuring, marketing').eq('profile_id', lewis).single()
  expect(choices).toEqual({ measuring: true, marketing: true })
  const { data: request } = await admin.from('connections').select('addressee_id').eq('requester_id', lewis).single()
  const otherEmail = await emailOf(request!.addressee_id)
  const b = await newPhone(browser)

  await test.step('they accept, and the two chat live', async () => {
    await signIn(b, otherEmail)
    await b.getByRole('button', { name: 'Only what’s needed' }).click()
    // Requests wait under Chat, with their number on the Requests tab.
    await b.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Chat/ }).click()
    await b.getByRole('navigation', { name: 'Chat' }).getByRole('link', { name: /Requests/ }).click()
    await b.getByRole('button', { name: /Accept/ }).first().click()
    // Until they talk, Lewis waits under Other connections on Chats.
    await b.getByRole('navigation', { name: 'Chat' }).getByRole('link', { name: 'Chats' }).click()
    await b.getByRole('link', { name: 'Say hello to Lewis' }).click()
    await expect(b.getByRole('heading', { level: 1, name: 'Lewis' })).toBeVisible()
    await closeGuide(b)

    await a.goto('/messages')
    await a.getByRole('link', { name: `Say hello to ${other}` }).click()
    await closeGuide(a)
    await b.getByLabel('Message Lewis').fill('Hello Lewis! Yes, I’d love that.')
    await b.keyboard.press('Enter')
    await expect(a.getByText('Yes, I’d love that.')).toBeVisible()
  })

  await test.step('a risky message shows the reader a warning', async () => {
    await a.getByLabel(`Message ${other}`).fill('Could you send me some money for the tickets? Easier on WhatsApp.')
    await a.getByRole('button', { name: 'Send' }).click()
    await expect(b.getByText('Easier on WhatsApp.')).toBeVisible()
    await expect(b.locator('.scam-warning')).toBeVisible()
    await expect(a.locator('.scam-warning')).toHaveCount(0)
  })

  await test.step('share the meet-up with someone they trust, then check in', async () => {
    await a.getByRole('button', { name: 'More options' }).click()
    await a.getByRole('link', { name: 'Tell someone you trust' }).click()
    await a.getByRole('button', { name: 'Make the link' }).click()
    await expect(a.getByText('Please say where you’re meeting', { exact: false })).toBeVisible()
    await a.getByLabel('Where are you meeting?').fill('Café de Flore, Paris')
    await a.getByLabel('When?').fill(`${isoIn(26)}T11:00`)
    await a.getByLabel('Anything else? (optional)').fill('I’ll text you by 3pm')
    await a.getByRole('button', { name: 'Make the link' }).click()
    await expect(a.getByText('Your link is ready', { exact: false })).toBeVisible()

    const { data: share } = await admin.from('meetup_shares').select('token').eq('owner_id', lewis).single()
    const friend = await newPhone(browser)
    await friend.goto(`/safe/${share!.token}`)
    await expect(friend.getByRole('heading', { name: 'Lewis’s meet-up' })).toBeVisible()
    await expect(friend.getByText('Café de Flore, Paris')).toBeVisible()
    await expect(friend.getByText(new RegExp(`^${other}, \\d+, from`))).toBeVisible()
    await expect(friend.getByText('hasn’t checked in yet', { exact: false })).toBeVisible()

    await a.getByRole('button', { name: 'I’m back safe' }).click()
    await expect(a.getByText('You’ve said you’re back safe', { exact: false })).toBeVisible()
    await friend.reload()
    await expect(friend.getByText('Lewis is back safe.')).toBeVisible()

    await a.getByRole('button', { name: 'Stop sharing this link' }).click()
    await friend.reload()
    await expect(friend.getByRole('heading', { name: 'This link has ended' })).toBeVisible()
    await friend.close()
  })

  await test.step('start a group and plan together', async () => {
    await a.goto('/groups/new')
    await a.getByLabel('Group name').fill('Paris in spring')
    await pickPlace(a, 'Pari', /Paris, France/)
    await pickDates(a, isoIn(25), isoIn(28))
    await a.getByText(other, { exact: true }).click()
    await a.getByRole('button', { name: 'Start group' }).click()
    await expect(a.getByText('Your group is ready')).toBeVisible()

    await b.goto('/groups')
    await b.getByRole('button', { name: 'Join' }).click()
    await b.getByRole('link', { name: /Paris in spring/ }).click()
    await b.getByRole('link', { name: 'Open the group chat' }).click()
    await b.getByRole('link', { name: 'Plan board' }).click()
    await b.getByLabel('What’s the idea?').fill('Musée d’Orsay on the first morning')
    await choose(b, 'Which day? (optional)', /^Day 1/)
    await b.getByRole('button', { name: 'Add to the plan' }).click()
    await expect(b.locator('.idea')).toHaveCount(1)

    await a.getByRole('link', { name: 'Open the group chat' }).click()
    await a.getByRole('link', { name: 'Plan board' }).click()
    await a.getByRole('button', { name: /Vote for Musée d’Orsay/ }).click()
    await expect(a.getByRole('button', { name: /Vote for Musée d’Orsay.*1 vote/ })).toBeVisible()
  })

  await test.step('report the message and block', async () => {
    await b.goto('/messages')
    await b.getByRole('link', { name: /^Lewis/ }).click()
    await b.getByRole('button', { name: 'Report this message' }).click()
    await b.getByRole('button', { name: 'Report and block Lewis' }).click()
    await expect(b.getByText(/Thanks for telling us/)).toBeVisible()
    await expect(b.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible()
    const { data: blocks } = await admin.from('blocks').select('blocked_id').eq('blocked_id', lewis)
    expect(blocks).toHaveLength(1)
  })

  await test.step('the report reaches the review page', async () => {
    const reviewer = `reviewer${Date.now()}@example.com`
    const r = await newPhone(browser)
    await signIn(r, reviewer)
    await expect(r.getByText(/Step 1 of 4/)).toBeVisible()
    await admin.from('profiles').update({ role: 'admin' }).eq('id', await idOf(reviewer))
    await r.goto('/admin')
    await expect(r.getByRole('heading', { name: /To review/ })).toBeVisible()
    await expect(r.locator('.queue-card', { hasText: 'Reported by' })).toContainText('Lewis')
    await expect(r.locator('.queue-card', { hasText: 'Flagged message' })).toContainText('send me some money')
  })

  await test.step('Lewis signs out, then back in with his password', async () => {
    await a.goto('/profile')
    await a.getByRole('link', { name: 'Settings' }).click()
    await a.getByRole('button', { name: 'Sign out' }).click()
    await a.goto('/sign-in')
    await expect(a.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await a.getByLabel('Email address').fill(lewisEmail)
    await a.getByLabel('Password', { exact: true }).fill('not my password')
    await a.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(a.getByText('That email and password don’t match', { exact: false })).toBeVisible()
    await a.getByLabel('Password', { exact: true }).fill(password)
    await a.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(a).toHaveURL(/\/connections/)
    await a.reload()
    await expect(a).toHaveURL(/\/connections/)
  })
})
