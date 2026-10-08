// Helpers for the end-to-end test: signing in with the emailed code (read
// from the local Mailpit inbox) and a few lookups with the local service key.
import { expect, type Browser, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

/** Full access to the LOCAL database, for setting up and checking the test. */
export const admin = createClient(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { persistSession: false },
})

export async function newPhone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  // Browser errors go into the test output, so a failure on CI can be diagnosed.
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}] ${m.text()}`)
  })
  return page
}

async function latestCode(email: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const found: { messages?: { ID: string; Created: string }[] } = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
    const latest = found.messages?.find((m) => new Date(m.Created).getTime() >= since - 2000)
    if (latest) {
      const message: { Text: string } = await (await fetch(`${mailpit}/api/v1/message/${latest.ID}`)).json()
      const code = message.Text.match(/\b(\d{6})\b/)?.[1]
      if (code) return code
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No sign-in code arrived for ${email}`)
}

/** Joins or signs in with an emailed code. With a password, it is chosen straight after; without, "Not now". */
export async function signIn(page: Page, email: string, password?: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: /send my code/i }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  // The code signs in on its own once all the digits are in.
  await page.getByLabel('Your code').fill(await latestCode(email, since))
  await expect(page.getByRole('heading', { name: 'Choose a password' })).toBeVisible()
  if (password) {
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Save password' }).click()
  } else {
    await page.getByRole('button', { name: /Not now/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Choose a password' })).toBeHidden()
}

export async function emailOf(profileId: string): Promise<string> {
  const { data, error } = await admin.auth.admin.getUserById(profileId)
  if (error || !data.user?.email) throw error ?? new Error('member has no email')
  return data.user.email
}

export async function idOf(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error(`no member ${email}`)
  return user.id
}

export function isoIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Closes the one-time "Before you meet" card if it's showing. */
export async function closeGuide(page: Page): Promise<void> {
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click()
}

/** Types into the place search and picks a result. Retries the typing, because a page that is still loading can clear the box. */
export async function pickPlace(page: Page, typed: string, option: string | RegExp): Promise<void> {
  const box = page.locator('input[role=combobox]')
  const choice = page.getByRole('option', { name: option }).first()
  await expect(async () => {
    await box.fill('')
    await box.pressSequentially(typed, { delay: 30 })
    await expect(choice).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })
  await choice.click()
}

/** Sign-up step 4: picks 3 questions for the back of the card and answers them, then finishes sign-up. */
export async function fillCard(page: Page): Promise<void> {
  await expect(page.getByText(/Step 4 of 4/)).toBeVisible()
  const picks = [
    ['Describe your perfect holiday', 'A slow week in Lisbon with long lunches, old trams and sunsets over the river.'],
    ['How often do you get away?', 'Four or five times a year, more if I can.'],
    ['I never travel without…', 'A good book and comfortable shoes.'],
  ]
  for (const [i, [question, answer]] of picks.entries()) {
    const slot = page.locator('.card-question').nth(i)
    await slot.getByRole('button', { name: 'Choose a question' }).click()
    await slot.getByRole('button', { name: question, exact: true }).click()
    await slot.getByRole('textbox').fill(answer)
  }
  await page.getByRole('button', { name: 'Finish sign-up' }).click()
  // "How you travel" is offered last; it's optional.
  await expect(page.getByText('Last step, optional')).toBeVisible()
  await page.getByRole('button', { name: 'Skip for now' }).click()
}

/** Opens one of our dropdowns and picks an option from its list. */
export async function choose(page: Page, field: string | RegExp, option: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: field }).first().click()
  await page.locator('.dropdown-panel').getByRole('button', { name: option, exact: typeof option === 'string' }).first().click()
  await expect(page.locator('.dropdown-panel')).toHaveCount(0)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Taps a day on the trip calendar, moving on a month at a time until it shows. */
async function tapDay(page: Page, iso: string): Promise<void> {
  const [y, m, d] = iso.split('-').map(Number)
  const day = page.getByRole('button', { name: new RegExp(`\\b${d} ${MONTHS[m - 1]} ${y}$`) })
  for (let i = 0; i < 24 && !(await day.isVisible()); i++) await page.getByRole('button', { name: 'Next month' }).click()
  await day.click()
}

/** Picks a trip's first and last day on the calendar. */
export async function pickDates(page: Page, start: string, end: string): Promise<void> {
  await tapDay(page, start)
  await tapDay(page, end)
  await expect(page.locator('.range-readback')).toContainText('days')
}
