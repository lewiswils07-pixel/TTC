// Download my data and delete my account (task T19).
import { expect, test } from '@playwright/test'
import { admin, newPhone, pickPlace, signIn } from './helpers'

test('a member downloads their data, then deletes their account', async ({ browser }) => {
  const page = await newPhone(browser)
  const email = `leaving${Date.now()}@example.com`
  await signIn(page, email)
  await page.getByLabel('First name').fill('Dora')
  await page.getByLabel('Day').selectOption('3')
  await page.getByLabel('Month').selectOption({ label: 'March' })
  await page.getByLabel('Year').fill('1958')
  await page.getByRole('radio', { name: 'Woman', exact: true }).check({ force: true })
  await pickPlace(page, 'Leed', 'Leeds, United Kingdom')
  await page.getByRole('button', { name: /continue/i }).click()
  await page.getByRole('button', { name: /continue|skip/i }).click()
  for (const name of ['Museums', 'Wine', 'Walking', 'Photography', 'Theatre', 'Local cuisine', 'Gardens']) {
    await page.getByRole('checkbox', { name, exact: true }).evaluate((el: HTMLElement) => el.click())
  }
  await page.getByRole('button', { name: 'Finish sign-up' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome to the Collective' })).toBeVisible()

  await page.goto('/profile')
  await page.getByRole('link', { name: 'Your account and data' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data' }).click()
  const file = await download
  const data = JSON.parse(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()))
  expect(data.profile.display_name).toBe('Dora')
  expect(data.interests).toHaveLength(7)

  await page.getByRole('button', { name: 'Delete my account' }).click()
  const deleteButton = page.getByRole('button', { name: 'Delete for good' })
  await expect(deleteButton).toBeDisabled()
  await page.getByLabel(/Type DELETE/).fill('delete')
  await deleteButton.click()
  await expect(page.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible()
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  expect(users.users.some((u) => u.email === email)).toBe(false)
})
