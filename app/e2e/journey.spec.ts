// The whole member journey in one run (spec §13, task T25): join, build a
// profile, add a trip, see suggestions, ask to connect, get accepted, chat
// (with a scam warning), start a group, plan together, and report and block,
// ending with the report on the review page.
import { expect, test } from '@playwright/test'
import { admin, closeGuide, emailOf, idOf, isoIn, newPhone, pickPlace, signIn } from './helpers'

test('a new member joins, connects, chats, plans with a group, and reports', async ({ browser }) => {
  const a = await newPhone(browser)
  const lewisEmail = `journey${Date.now()}@example.com`

  await test.step('join and build a profile', async () => {
    await signIn(a, lewisEmail)
    await expect(a.getByText(/Step 1 of 4/)).toBeVisible()
    await a.getByLabel('First name').fill('Lewis')
    await a.getByLabel(/born/).fill('1970')
    await a.getByRole('radio', { name: 'Man', exact: true }).check({ force: true })
    await pickPlace(a, 'Leed', 'Leeds, United Kingdom')
    await a.getByRole('button', { name: /continue/i }).click()
    await expect(a.getByText(/Step 2 of 4/)).toBeVisible()
    await a.getByRole('button', { name: /continue|skip/i }).click()
    await expect(a.getByText(/Step 3 of 4/)).toBeVisible()
    for (const name of ['Museums', 'Wine and vineyards', 'Walking and rambling', 'Photography', 'Wine', 'Walking']) {
      const chip = a.getByRole('checkbox', { name, exact: true })
      if (await chip.count()) await chip.evaluate((el: HTMLElement) => el.click())
    }
    await a.getByRole('button', { name: /continue/i }).click()
    await expect(a.getByText(/Step 4 of 4/)).toBeVisible()
    await a.getByRole('button', { name: /finish/i }).click()
    await expect(a.getByRole('heading', { name: 'Hello, Lewis' })).toBeVisible()
  })

  let other = ''
  await test.step('add a trip and ask someone going too', async () => {
    await a.getByRole('link', { name: 'Add your first trip' }).click()
    await pickPlace(a, 'Pari', /Paris, France/)
    await a.getByLabel('First day').fill(isoIn(20))
    await a.getByLabel('Last day').fill(isoIn(50))
    await a.getByRole('radio', { name: '± 1 week' }).evaluate((el: HTMLElement) => el.click())
    await a.getByRole('button', { name: 'Add trip' }).click()
    await expect(a.getByRole('heading', { name: /going too/ })).toBeVisible()
    other = await a.locator('.match-card h3').first().innerText()
    await a.getByRole('button', { name: `Ask to connect with ${other}` }).first().click()
    await a.getByLabel(/Add a note/).fill('Hello! Would you like to see the Musée d’Orsay together?')
    await a.getByRole('button', { name: 'Send request' }).click()
    await expect(a.getByText(/Request sent/)).toBeVisible()
  })

  const lewis = await idOf(lewisEmail)
  const { data: request } = await admin.from('connections').select('addressee_id').eq('requester_id', lewis).single()
  const otherEmail = await emailOf(request!.addressee_id)
  const b = await newPhone(browser)

  await test.step('they accept, and the two chat live', async () => {
    await signIn(b, otherEmail)
    await b.getByRole('link', { name: /Connections/ }).click()
    await b.getByRole('button', { name: /Accept/ }).first().click()
    await b.getByRole('link', { name: 'Message Lewis' }).click()
    await expect(b.getByRole('heading', { level: 1, name: 'Lewis' })).toBeVisible()
    await closeGuide(b)

    await a.goto('/messages')
    await a.getByRole('link', { name: new RegExp(other) }).click()
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

  await test.step('start a group and plan together', async () => {
    await a.goto('/groups/new')
    await a.getByLabel('Group name').fill('Paris in spring')
    await pickPlace(a, 'Pari', /Paris, France/)
    await a.getByLabel('First day').fill(isoIn(25))
    await a.getByLabel('Last day').fill(isoIn(28))
    await a.getByText(other, { exact: true }).click()
    await a.getByRole('button', { name: 'Start group' }).click()
    await expect(a.getByText('Your group is ready')).toBeVisible()

    await b.goto('/groups')
    await b.getByRole('button', { name: 'Join' }).click()
    await b.getByRole('link', { name: /Paris in spring/ }).click()
    await b.getByRole('link', { name: 'Open the group chat' }).click()
    await b.getByRole('link', { name: 'Plan board' }).click()
    await b.getByLabel('What’s the idea?').fill('Musée d’Orsay on the first morning')
    await b.getByLabel('Which day? (optional)').selectOption('1')
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
    await b.getByRole('button', { name: 'Send report' }).click()
    await expect(b.getByText(/Thanks for telling us/)).toBeVisible()
    await expect(b.getByRole('heading', { name: 'Messages' })).toBeVisible()
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
})
