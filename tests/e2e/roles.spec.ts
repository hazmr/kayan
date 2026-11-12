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

test('the Admin and an instructor who does not teach it get a staff box instead of a buy button', async ({
  browser,
}) => {
  for (const email of [E2E.owner, E2E.son]) {
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
  await expect(owner.getByText('نصيب الأكاديمية').first()).toBeVisible()
  await expect(owner.getByText('نصيب مسؤول النظام').first()).toBeVisible()

  const doctor = await personAt(browser, E2E.doctor)
  await doctor.goto('/ar/dashboard')
  await expect(doctor.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible()
  await expect(doctor.getByText('إيصالات للمراجعة').first()).toBeVisible()

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
    ['/en/dashboard/orders', 'Orders'],
    ['/en/dashboard/earnings', "Admin's share"],
    ['/en/dashboard/courses', 'Courses'],
  ] as const) {
    await doctor.goto(path)
    await expect(current).toHaveCount(1)
    await expect(current).toHaveText(label)
  }
})

test('the Users page is for the Admin only, and the Admin row has no controls', async ({
  browser,
}) => {
  const admin = await personAt(browser, E2E.owner)
  await admin.goto('/en/dashboard/users')
  const adminRow = admin.locator('tr', { hasText: E2E.owner })
  await expect(adminRow.locator('select')).toHaveCount(0)
  await expect(adminRow.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  // an instructor can be managed, but only made an instructor or a student, never Admin
  const sonRow = admin.locator('tr', { hasText: E2E.son })
  await expect(sonRow.locator('select option')).toHaveText(['Instructor', 'Student'])
  await expect(sonRow.getByRole('button', { name: 'Delete' })).toBeVisible()

  // an instructor does not even get the page
  const son = await personAt(browser, E2E.son)
  await expect(
    son.getByRole('navigation', { name: 'Dashboard menu' }).getByRole('link', { name: 'Users' }),
  ).toHaveCount(0)
  await son.goto('/en/dashboard/users')
  await expect(son).toHaveURL(/\/en\/dashboard$/)
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

  for (const email of [E2E.doctor, E2E.son, E2E.owner]) {
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
