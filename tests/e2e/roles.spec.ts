import { expect, test, type Browser, type Page } from '@playwright/test'

import { E2E } from '../support/e2eData'

// Each role sees the site its own way. Doctors and staff run the platform; only students buy.

async function personAt(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/en/login')
  await page.fill('#email', email)
  await page.fill('#password', E2E.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  return page
}

const coursePage = `/en/courses/${E2E.courseSlug}`

test("a doctor looking at their own course sees 'manage', not 'buy'", async ({ browser }) => {
  const doctor = await personAt(browser, E2E.doctor)
  await doctor.goto(coursePage)
  await expect(doctor.getByRole('heading', { name: E2E.courseTitle })).toBeVisible()
  await expect(doctor.getByText('This is your course')).toBeVisible()
  await expect(doctor.getByRole('link', { name: 'Manage this course' })).toBeVisible()
  await expect(doctor.getByRole('link', { name: /Buy now|Enroll for free/ })).toHaveCount(0)
  // every lesson is open to the course's own doctor
  await expect(doctor.getByRole('link', { name: new RegExp(E2E.lockedLesson) })).toBeVisible()

  // the checkout address does nothing for them
  await doctor.goto(`/en/checkout/${E2E.courseSlug}`)
  await expect(doctor).toHaveURL(new RegExp(`${coursePage}$`))

  // learning pages are for students: the account menu has no "My courses" and "My orders"
  await doctor.getByRole('button', { name: 'Account menu' }).click()
  await expect(doctor.getByRole('menuitem', { name: 'My courses' })).toHaveCount(0)
  await expect(doctor.getByRole('menuitem', { name: 'My orders' })).toHaveCount(0)
  await expect(doctor.getByRole('menuitem', { name: 'Account' })).toBeVisible()
  await doctor.keyboard.press('Escape')
  await doctor.goto('/en/my-courses')
  await expect(doctor).toHaveURL(/\/en\/dashboard$/)
})

test('owner and manager get a staff box instead of a buy button', async ({ browser }) => {
  for (const email of [E2E.owner, E2E.manager]) {
    const staff = await personAt(browser, email)
    await staff.goto(coursePage)
    await expect(staff.getByText('Staff accounts do not buy courses')).toBeVisible()
    await expect(staff.getByRole('link', { name: 'Manage this course' })).toBeVisible()
    await expect(staff.getByRole('link', { name: /Buy now|Enroll for free/ })).toHaveCount(0)
    await staff.goto('/en')
    // one way to the dashboard (the header's), not a second button in the page
    await expect(staff.getByRole('link', { name: 'Dashboard' })).toHaveCount(1)
  }
})

test('a guest still sees the normal buy flow', async ({ page }) => {
  await page.goto(coursePage)
  await expect(page.getByRole('link', { name: 'Log in to buy' })).toBeVisible()
})

test('the role dashboards work in Arabic, right to left', async ({ browser }) => {
  const owner = await personAt(browser, E2E.owner)
  await owner.goto('/ar/dashboard')
  await expect(owner.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(owner.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible()
  await expect(owner.getByText('نصيب المنصة').first()).toBeVisible()
  await expect(owner.getByText('نصيب الأطباء').first()).toBeVisible()

  const doctor = await personAt(browser, E2E.doctor)
  await doctor.goto('/ar/dashboard')
  await expect(doctor.getByText('إجمالي الأرباح').first()).toBeVisible()

  await doctor.goto('/ar/courses/' + E2E.courseSlug)
  await expect(doctor.getByText('هذه دورتك')).toBeVisible()
})

test('the dashboard menu highlights exactly one item: the page you are on', async ({ browser }) => {
  const doctor = await personAt(browser, E2E.doctor)
  const current = doctor
    .getByRole('navigation', { name: 'Dashboard menu' })
    .locator('[aria-current=page]')

  await doctor.goto('/en/dashboard')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveText('Overview')

  for (const [path, label] of [
    ['/en/dashboard/orders', 'Sales'],
    ['/en/dashboard/earnings', 'Earnings'],
    ['/en/dashboard/courses', 'Courses'],
  ] as const) {
    await doctor.goto(path)
    await expect(current).toHaveCount(1)
    await expect(current).toHaveText(label)
  }
})

test('the master owner is marked and out of reach, even for another owner', async ({ browser }) => {
  const other = await personAt(browser, E2E.owner2)
  await other.goto('/en/dashboard/users')
  const masterRow = other.locator('tr', { hasText: E2E.owner })
  await expect(masterRow.getByText('Master owner')).toBeVisible()
  // no role dropdown and no delete button on the master's row
  await expect(masterRow.locator('select')).toHaveCount(0)
  await expect(masterRow.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  // everyone else can still be managed by this owner
  const managerRow = other.locator('tr', { hasText: E2E.manager })
  await expect(managerRow.locator('select')).toHaveCount(1)
  await expect(managerRow.getByRole('button', { name: 'Delete' })).toBeVisible()
  await expect(other.getByText('Master owner')).toHaveCount(1)
})

test('the navbar links in the middle depend on who you are, and are not repeated in the account menu', async ({
  browser,
}) => {
  const links = (page: Page) =>
    page.getByRole('navigation', { name: 'Main menu' }).getByRole('link')

  const guest = await (await browser.newContext()).newPage()
  await guest.goto('/en')
  await expect(links(guest)).toHaveText(['Courses'])

  const student = await personAt(browser, E2E.student)
  await student.goto('/en')
  await expect(links(student)).toHaveText(['Courses', 'My courses'])
  // in the account button the name comes first and the picture (initial) after it
  const trigger = student.getByRole('button', { name: 'Account menu' })
  const nameBox = await trigger.getByText('Test student').boundingBox()
  const pictureBox = await trigger.getByText('T', { exact: true }).boundingBox()
  expect(nameBox!.x).toBeLessThan(pictureBox!.x)
  await trigger.click()
  await expect(student.getByRole('menuitem', { name: 'My courses' })).toHaveCount(0)
  await expect(student.getByRole('menuitem', { name: 'My orders' })).toBeVisible()

  for (const email of [E2E.doctor, E2E.manager, E2E.owner]) {
    const worker = await personAt(browser, email)
    await worker.goto('/en')
    await expect(links(worker), email).toHaveText(['Courses', 'Dashboard'])
  }

  // the links sit in the middle of the header, not against one side
  const box = await links(guest).first().boundingBox()
  const width = guest.viewportSize()!.width
  const middle = box!.x + box!.width / 2
  expect(Math.abs(middle - width / 2)).toBeLessThan(width * 0.2)
})
