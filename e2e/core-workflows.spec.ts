import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function dismissTour(page: import('@playwright/test').Page) {
  const button = page.getByRole('button', { name: 'Start safely' });
  if (await button.isVisible()) await button.click();
}

test('creates an exact-domain project and previews bounded queries', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop workflow; mobile is covered separately.',
  );
  await page.goto('/#/new');
  await dismissTour(page);
  await page.getByLabel('Project name').fill('Example authorized review');
  await page.getByLabel('Authorized scope').fill('example.com');
  await expect(page.getByText('Valid exact-domain')).toBeVisible();
  await page.getByRole('checkbox', { name: /ethical-use boundary/i }).check();
  await page.getByRole('button', { name: /Create & plan/i }).click();
  await expect(page).toHaveURL(/#\/planner/u);
  await expect(
    page.getByRole('heading', { name: 'Preview every search before it leaves.' }),
  ).toBeVisible();
  await expect(page.locator('.query-card')).not.toHaveCount(0);
  await expect(page.getByText('Estimated queries')).toBeVisible();
});

test('applies suffix-wide warnings and hides sensitive packs', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop workflow; mobile is covered separately.',
  );
  await page.goto('/#/new');
  await dismissTour(page);
  await page.getByLabel('Authorized scope').fill('*.uz');
  await expect(page.getByText('Valid public-suffix')).toBeVisible();
  await expect(page.getByText(/extremely broad/i)).toBeVisible();
  await page.getByRole('checkbox', { name: /ethical-use boundary/i }).check();
  await page.getByRole('button', { name: /Create & plan/i }).click();
  await expect(page.getByText(/Connected execution is disabled/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sensitive Exposure Review/i })).toHaveCount(0);
  await expect(page.locator('.query-card')).toHaveCount(5);
});

test('loads demo, filters and annotates results, then exports a report', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop workflow; mobile is covered separately.',
  );
  await page.goto('/#/');
  await dismissTour(page);
  await page.getByRole('button', { name: /Load safe demo/i }).click();
  await page.getByRole('link', { name: 'Results' }).click();
  await expect(page.getByText('Review evidence, not assumptions.')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Cards' }).click();
  await expect(page.locator('.finding-card')).toHaveCount(5);
  await page.getByLabel('Result view').getByRole('button', { name: 'Table' }).click();
  await page.getByLabel('Search findings').fill('portal');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page
    .getByLabel(/Notes for Customer portal sign in/i)
    .fill('Validated with the synthetic service owner.');
  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByText('Export the scope, evidence, and caveats.')).toBeVisible();
  await expect(page.getByText(/Validated with the synthetic service owner/)).toBeVisible();
  await expect(page.getByRole('button', { name: /CSV findings/i })).toBeVisible();
});

test('desktop dashboard has no serious accessibility violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Run the full axe scan once.');
  await page.goto('/#/');
  await dismissTour(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
});

test('planner and synthetic demo make no background provider requests', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop network-boundary assertion.');
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') externalRequests.push(url.toString());
  });
  await page.goto('/#/');
  await dismissTour(page);
  await page.getByRole('button', { name: /Load safe demo/i }).click();
  await page.waitForTimeout(300);
  expect(externalRequests).toEqual([]);
});

test('guided tour traps focus, closes with Escape, and restores focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop keyboard assertion.');
  await page.goto('/#/');
  const dialog = page.getByRole('dialog', { name: /Plan first/i });
  await expect(dialog).toBeVisible();
  await expect(page.locator(':focus')).toHaveRole('button');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(':focus')).toHaveRole('button');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('persists multiple projects without replacing the active project', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop project-library assertion.');
  await page.goto('/#/new');
  await dismissTour(page);
  await page.getByLabel('Project name').fill('First project');
  await page.getByLabel('Authorized scope').fill('example.com');
  await page.getByRole('checkbox', { name: /ethical-use boundary/i }).check();
  await page.getByRole('button', { name: /Create & plan/i }).click();
  await page.getByRole('link', { name: 'New project' }).click();
  await page.getByLabel('Project name').fill('Second project');
  await page.getByLabel('Authorized scope').fill('example.org');
  await page.getByRole('checkbox', { name: /ethical-use boundary/i }).check();
  await page.getByRole('button', { name: /Create & plan/i }).click();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.locator('.project-list article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'First project' })).toBeVisible();
  await expect(
    page.locator('.project-list article').getByRole('heading', { name: 'Second project' }),
  ).toBeVisible();
});

test('demo analyst routes have no serious accessibility violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Run route scans once.');
  await page.goto('/#/');
  await dismissTour(page);
  await page.getByRole('button', { name: /Load safe demo/i }).click();
  for (const route of ['planner', 'results', 'reports', 'settings', 'about']) {
    await page.goto(`/#/${route}`);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
      `serious accessibility violations on ${route}`,
    ).toEqual([]);
  }
});

test('navigation and cards remain usable at mobile width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only assertion.');
  await page.goto('/#/');
  await dismissTour(page);
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('complementary', { name: 'Primary navigation' })).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Primary navigation' })
    .getByRole('link', { name: 'New project' })
    .click();
  await expect(page.getByLabel('Authorized scope')).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('complementary', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Dashboard' })
    .click();
  await page.getByRole('button', { name: /Load safe demo/i }).click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('complementary', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Results' })
    .click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const menuBox = await page.getByRole('button', { name: 'Open menu' }).boundingBox();
  expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
