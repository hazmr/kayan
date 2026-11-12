import { expect, test } from '@playwright/test'

import { E2E } from '../support/e2eData'

// The home page: the pictures load, the sections are there, and the scroll animation never
// leaves content stuck invisible.

for (const [locale, hero, stepsTitle] of [
  ['en', 'Learn veterinary medicine with Dr. Test', 'From choosing a course to watching it'],
  ['ar', 'تعلّم الطب البيطري مع د. تجربة', 'من اختيار الدورة إلى مشاهدتها'],
] as const) {
  test(`the home page in ${locale}: hero, steps, reasons, courses, call to action`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`)
    await expect(page.getByRole('heading', { level: 1, name: hero })).toBeVisible()

    // the one picture really loaded (not broken)
    const pictures = page.locator('main img')
    await expect(pictures).toHaveCount(1)
    for (const picture of await pictures.all()) {
      await picture.evaluate((img) => img.scrollIntoView())
      await expect(picture).toHaveJSProperty('complete', true)
      expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    }

    // scrolling to each section reveals it: nothing stays hidden
    await page.getByRole('heading', { name: stepsTitle }).evaluate((el) => el.scrollIntoView())
    await expect(page.getByRole('listitem').filter({ hasText: '1' }).first()).toBeVisible()
    await page
      .getByText(E2E.courseTitle)
      .first()
      .evaluate((el) => el.scrollIntoView())
    await expect(page.getByText(E2E.courseTitle).first()).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('[data-reveal="hidden"]')).toHaveCount(0)
  })
}

test('the home page fits a phone, with no sideways scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } })
  const page = await context.newPage()
  await page.goto('/en')
  await expect(page.getByRole('link', { name: 'Create your account' }).first()).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('with reduced motion nothing is animated or hidden', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/en')
  await expect(page.locator('[data-reveal]')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'From choosing a course to watching it' }),
  ).toBeVisible()
})

test("the hero shows the doctor's photo with a name card, and live course counts", async ({
  page,
}) => {
  await page.goto('/en')
  const photo = page.getByRole('img', { name: 'Dr. Test' })
  await expect(photo).toBeVisible()
  await expect(photo).toHaveJSProperty('complete', true)
  expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('figcaption')).toContainText('Dr. Test')
  await expect(page.locator('figcaption')).toContainText('Test title')
  // the seed has one published course with two lessons
  await expect(page.getByText('courses', { exact: true }).locator('..')).toContainText('1')
  await expect(page.getByText('video lessons', { exact: true }).locator('..')).toContainText('2')
})
