import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('captures reviewed portfolio screenshots', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Canonical screenshots use desktop Chromium.',
  );
  const target = resolve('docs/screenshots');
  await mkdir(target, { recursive: true });
  await page.goto('/#/');
  const tour = page.getByRole('button', { name: 'Start safely' });
  if (await tour.isVisible()) await tour.click();
  await expect(
    page.getByRole('heading', { name: 'Search intelligence, shaped for review.' }),
  ).toBeVisible();
  await page.screenshot({ path: resolve(target, 'dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: /Load safe demo/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Preview every search before it leaves.' }),
  ).toBeVisible();
  await page.screenshot({ path: resolve(target, 'planner.png'), fullPage: false });
  await page.getByRole('link', { name: 'Results' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.screenshot({ path: resolve(target, 'results.png'), fullPage: true });
  await page.getByRole('link', { name: 'Reports' }).click();
  await page.screenshot({ path: resolve(target, 'reports.png'), fullPage: true });
});

test('captures mobile results workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile screenshot only.');
  const target = resolve('docs/screenshots');
  await mkdir(target, { recursive: true });
  await page.goto('/#/');
  const tour = page.getByRole('button', { name: 'Start safely' });
  if (await tour.isVisible()) await tour.click();
  await page.getByRole('button', { name: /Load safe demo/i }).click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('complementary', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Results' })
    .click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.screenshot({ path: resolve(target, 'mobile-results.png'), fullPage: true });
});
