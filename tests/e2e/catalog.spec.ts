import { expect, test } from '@playwright/test'

import { E2E } from '../support/e2eData'

// The course catalog: search, price filter, sorting, and clearing the filters.

test('search finds a course, and a search with no match says so and can be cleared', async ({
  page,
}) => {
  await page.goto('/en/courses')
  await expect(page.getByRole('link', { name: new RegExp(E2E.courseTitle) })).toBeVisible()

  await page.getByRole('searchbox').fill('e2e')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/q=e2e/)
  await expect(page.getByText('1 course found')).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(E2E.courseTitle) })).toBeVisible()

  await page.getByRole('searchbox').fill('zzz nothing like this')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('No courses match your search')).toBeVisible()
  await page.getByRole('link', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL(/\/en\/courses$/)
  await expect(page.getByRole('link', { name: new RegExp(E2E.courseTitle) })).toBeVisible()
})

test('the price filter and sorting live in the address, so a view can be shared', async ({
  page,
}) => {
  await page.goto('/en/courses')
  await page.getByLabel('Price').selectOption('free')
  await page.getByLabel('Sort by').selectOption('priceAsc')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/price=free/)
  await expect(page).toHaveURL(/sort=priceAsc/)
  // the only course costs EGP 400, so "free only" shows none
  await expect(page.getByText('No courses match your search')).toBeVisible()

  // the same view opened from the address alone
  await page.goto('/en/courses?price=paid&sort=priceDesc')
  await expect(page.getByLabel('Price')).toHaveValue('paid')
  await expect(page.getByLabel('Sort by')).toHaveValue('priceDesc')
  await expect(page.getByRole('link', { name: new RegExp(E2E.courseTitle) })).toBeVisible()
})

test('nonsense in the address never breaks the page', async ({ page }) => {
  await page.goto('/en/courses?sort=hacked&price=<script>&page=-5&q=%25%25')
  await expect(page.getByRole('heading', { name: 'Courses', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(E2E.courseTitle) })).toBeVisible()
})

test('the Arabic catalog has the same controls', async ({ page }) => {
  await page.goto('/ar/courses')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.getByRole('button', { name: 'بحث' })).toBeVisible()
})
