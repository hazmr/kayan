import { expect, test, type Browser, type Page } from '@playwright/test'

import { E2E } from '../support/e2eData'

// The whole purchase, as real people would do it, in a real browser:
//
//   a guest finds the course and sees only the free preview
//   -> logs in, pays by InstaPay, uploads a receipt
//   -> a manager approves it
//   -> the student now owns the course and watches the locked lesson
//   -> the doctor sees the money in their earnings
//
// Everything runs against a throwaway database (see playwright.config.ts).

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function login(page: Page, email: string) {
  await page.goto('/en/login')
  await page.fill('#email', email)
  await page.fill('#password', E2E.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
}

async function newPerson(browser: Browser, email?: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  if (email) await login(page, email)
  return page
}

test('a student buys a course, a manager approves it, the student watches and the doctor earns', async ({
  browser,
}) => {
  const student = await newPerson(browser)

  await test.step('a guest sees the course, but only the free preview is open', async () => {
    await student.goto('/en/courses')
    await student.getByRole('link', { name: new RegExp(E2E.courseTitle) }).click()
    await expect(student).toHaveURL(new RegExp(`/courses/${E2E.courseSlug}$`))
    await expect(student.getByRole('heading', { name: E2E.courseTitle })).toBeVisible()
    await expect(student.getByText('EGP 400').first()).toBeVisible()
    await expect(student.getByRole('link', { name: new RegExp(E2E.previewLesson) })).toBeVisible()
    await expect(student.getByRole('link', { name: new RegExp(E2E.lockedLesson) })).toHaveCount(0)

    await student.getByRole('link', { name: new RegExp(E2E.previewLesson) }).click()
    await expect(student.locator('iframe')).toHaveAttribute(
      'src',
      new RegExp(`youtube-nocookie\\.com/embed/${E2E.previewVideoId}`),
    )
  })

  await test.step('the guest logs in and is brought straight to checkout', async () => {
    await student.goto(`/en/courses/${E2E.courseSlug}`)
    await student.getByRole('link', { name: 'Log in to buy' }).click()
    await student.fill('#email', E2E.student)
    await student.fill('#password', E2E.password)
    await student.getByRole('button', { name: 'Log in' }).click()
    await expect(student).toHaveURL(new RegExp(`/checkout/${E2E.courseSlug}$`))
  })

  let reference = ''
  await test.step('the student chooses InstaPay and sees where to send EGP 400', async () => {
    await student.getByText('InstaPay').click()
    await student.getByRole('button', { name: 'Continue to payment' }).click()
    await expect(student).toHaveURL(/\/orders\/VT-/)
    await expect(student.getByText('Waiting for payment', { exact: true }).first()).toBeVisible()
    await expect(student.getByText('test@instapay')).toBeVisible()
    await expect(student.getByText('EGP 400').first()).toBeVisible()
    reference = (
      await student.locator('span[dir=ltr]', { hasText: /^VT-/ }).first().innerText()
    ).trim()
    expect(reference).toMatch(/^VT-[A-Z0-9]{6}$/)
  })

  await test.step('the student uploads the receipt and the order goes under review', async () => {
    await student.setInputFiles('input[type=file]', {
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await student.fill('#sender-number', '01012345678')
    await student.getByRole('button', { name: 'Send receipt' }).click()
    await expect(student.getByText('Under review', { exact: true }).first()).toBeVisible()
    await expect(student.getByText('Waiting for review')).toBeVisible()
  })

  await test.step('still locked while the payment is being checked', async () => {
    await student.goto(`/en/courses/${E2E.courseSlug}`)
    await expect(student.getByText('Your payment is under review')).toBeVisible()
    await expect(student.getByRole('link', { name: new RegExp(E2E.lockedLesson) })).toHaveCount(0)
  })

  const manager = await newPerson(browser, E2E.manager)
  await test.step("the manager's home lists the waiting receipt, oldest first, with what was paid", async () => {
    await manager.goto('/en/dashboard')
    const panel = manager.locator('section.overflow-hidden', { hasText: 'Receipts to review' })
    await expect(panel).toContainText(E2E.courseTitle)
    await expect(panel).toContainText('Test student')
    await expect(panel).toContainText('EGP 400')
    // clicking the row opens the review queue
    await panel.getByRole('link', { name: /Test student/ }).click()
    await expect(manager).toHaveURL(/\/dashboard\/payments$/)
  })

  await test.step('a manager sees the receipt in the queue and approves it', async () => {
    await manager.goto('/en/dashboard/payments')
    const card = manager.locator('article', { hasText: reference })
    await expect(card).toBeVisible()
    await expect(
      card.getByText('Buyer', { exact: false }).or(card.getByText(E2E.student)),
    ).toBeVisible()
    await expect(card.getByText('EGP 400').first()).toBeVisible()
    await expect(card.getByText('01012345678')).toBeVisible()
    // the receipt image really loads for the manager
    await expect(card.locator('img').first()).toHaveJSProperty('complete', true)
    await card.getByRole('button', { name: 'Approve' }).click()
    await manager.getByRole('dialog').getByRole('button', { name: 'Yes, approve' }).click()
    await expect(card).toHaveCount(0)
  })

  await test.step('with nothing left waiting, the manager home says so', async () => {
    await manager.goto('/en/dashboard')
    await expect(manager.getByText('You are all caught up')).toBeVisible()
  })

  await test.step('the student now owns the course', async () => {
    await student.goto(`/en/orders/${reference}`)
    await expect(student.getByText('Paid', { exact: true }).first()).toBeVisible()
    await expect(student.getByText('You own this course.', { exact: true })).toBeVisible()
  })

  await test.step('it is listed under My courses (a link in the navbar), starting at 0%', async () => {
    await student
      .getByRole('navigation', { name: 'Main menu' })
      .getByRole('link', { name: 'My courses' })
      .click()
    await expect(student).toHaveURL(/\/my-courses$/)
    await expect(student.getByRole('heading', { name: E2E.courseTitle })).toBeVisible()
    await expect(student.getByText('0 of 2 lessons')).toBeVisible()
    await student.getByRole('link', { name: 'Start learning' }).click()
    await expect(student.locator('iframe')).toHaveAttribute(
      'src',
      new RegExp(`/embed/${E2E.previewVideoId}`),
    )
  })

  await test.step('the lesson that was locked now plays', async () => {
    await student.getByRole('link', { name: /Next lesson/ }).click()
    await expect(student.locator('iframe')).toHaveAttribute(
      'src',
      new RegExp(`/embed/${E2E.lockedVideoId}`),
    )
    await expect(student.getByText('Lesson 2 of 2')).toBeVisible()
  })

  await test.step('marking a lesson complete moves the progress, and Continue picks up where they stopped', async () => {
    // lesson 2 is open: mark it complete (the student skipped lesson 1 on purpose)
    await expect(student.getByText('0 of 2 lessons')).toBeVisible()
    await student.getByRole('button', { name: 'Mark as complete' }).click()
    await expect(student.getByRole('button', { name: /Completed\. Tap to undo/ })).toBeVisible()
    await expect(student.getByText('1 of 2 lessons')).toBeVisible()

    await student.goto('/en/my-courses')
    await expect(student.getByText('1 of 2 lessons')).toBeVisible()
    await expect(student.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    // the first lesson is the one not done yet, so Continue goes back to it
    await student.getByRole('link', { name: 'Continue learning' }).click()
    await expect(student.locator('iframe')).toHaveAttribute(
      'src',
      new RegExp(`/embed/${E2E.previewVideoId}`),
    )
    await student.getByRole('button', { name: 'Mark as complete' }).click()
    await expect(student.getByText('2 of 2 lessons')).toBeVisible()

    // the course page shows it too, and offers a review now that everything is done
    await student.goto(`/en/courses/${E2E.courseSlug}`)
    await expect(student.getByText('2 of 2 lessons')).toBeVisible()
    await expect(student.getByRole('link', { name: 'Review course' })).toBeVisible()
  })

  await test.step("the student's home page leads with their own course and its progress", async () => {
    await student.goto('/en')
    await expect(student.getByRole('heading', { level: 1, name: /Welcome back/ })).toBeVisible()
    await expect(student.getByRole('heading', { name: 'Continue learning' })).toBeVisible()
    const card = student.locator('article', { hasText: E2E.courseTitle })
    await expect(card.getByText('2 of 2 lessons')).toBeVisible()
    await expect(card.getByRole('link', { name: 'Review course' })).toBeVisible()
    // the course they own is shown once, not again under "Newest courses"
    await expect(student.locator('article', { hasText: E2E.courseTitle })).toHaveCount(1)
    await expect(student.getByRole('heading', { name: 'Newest courses' })).toHaveCount(0)
    // a student already knows how buying works, and has no sign-up button
    await expect(
      student.getByRole('heading', { name: 'From choosing a course to watching it' }),
    ).toHaveCount(0)
    await expect(student.getByRole('link', { name: 'Create your account' })).toHaveCount(0)
  })

  const doctor = await newPerson(browser, E2E.doctor)
  await test.step('the doctor sees the sale and EGP 280 (70%) in their earnings', async () => {
    await doctor.goto('/en/dashboard/orders')
    await expect(doctor.locator('tbody tr')).toHaveCount(1)
    await expect(doctor.locator('tbody tr').first()).toContainText('EGP 400')
    await expect(doctor.locator('tbody tr').first()).toContainText('EGP 280')

    await doctor.goto('/en/dashboard/earnings')
    await expect(doctor.getByRole('heading', { name: 'Your earnings' })).toBeVisible()
    await expect(doctor.getByText('Total earned').locator('..')).toContainText('EGP 280')
    await expect(doctor.getByText('Balance', { exact: true }).locator('..')).toContainText(
      'EGP 280',
    )
  })

  // The same sale, seen by each role. The sale is EGP 400: EGP 280 to the doctor, EGP 120 stays
  // with the platform. Only the owner may see that split.
  await test.step('the owner sees the whole money picture: paid, platform share, doctors share', async () => {
    const owner = await newPerson(browser, E2E.owner)
    await owner.goto('/en/dashboard')
    await expect(owner.getByRole('heading', { name: 'Overview' })).toBeVisible()
    // the first match is the stat card at the top (the tables below reuse the same words)
    const card = (label: string) => owner.getByText(label, { exact: true }).first().locator('..')
    await expect(card('Paid by students')).toContainText('EGP 400')
    await expect(card('Platform share')).toContainText('EGP 120')
    await expect(card("Doctors' share")).toContainText('EGP 280')
    await expect(card('Still owed to doctors')).toContainText('EGP 280')
    await expect(owner.getByRole('link', { name: "Doctors' earnings" })).toBeVisible()
  })

  await test.step('a manager sees the work queues and no money at all', async () => {
    await manager.goto('/en/dashboard')
    await expect(manager.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(manager.getByText('Receipts to review')).toBeVisible()
    for (const label of ['Platform share', "Doctors' share", 'Paid by students']) {
      await expect(manager.getByText(label)).toHaveCount(0)
    }
    await expect(manager.getByRole('link', { name: /earnings/i })).toHaveCount(0)
    // typing the address by hand does not help either
    await manager.goto('/en/dashboard/earnings')
    await expect(manager).toHaveURL(/\/en\/dashboard$/)
    // the orders list shows what the student paid, but never the doctor's share
    await manager.goto('/en/dashboard/orders')
    await expect(manager.locator('tbody tr').first()).toContainText('EGP 400')
    await expect(manager.locator('body')).not.toContainText('EGP 280')
    await expect(manager.locator('body')).not.toContainText('EGP 120')
  })

  await test.step("the doctor's home shows only their own earnings", async () => {
    await doctor.goto('/en/dashboard')
    await expect(doctor.getByRole('heading', { name: /^Hello,/ })).toBeVisible()
    await expect(doctor.getByText('Total earned').locator('..')).toContainText('EGP 280')
    await expect(doctor.getByText('Students enrolled').locator('..')).toContainText('1')
    await expect(doctor.getByText('Platform share')).toHaveCount(0)
    await expect(doctor.getByRole('link', { name: "Doctors' earnings" })).toHaveCount(0)
  })
})
