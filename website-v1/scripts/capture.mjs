import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = new URL('../.qa/', import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
const issues = [];

async function capture(name, path, viewport, locale = 'ko', fullPage = true) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript((selectedLocale) => {
    localStorage.setItem('shc-locale', selectedLocale);
  }, locale);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('net::ERR_CONNECTION_REFUSED')) {
      issues.push(`${name} console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => issues.push(`${name} page: ${error.message}`));
  await page.goto(`http://localhost:5173${path}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: new URL(`${name}.png`, output).pathname.slice(1), fullPage });
  const heading = await page.locator('h1').first().textContent();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const unlabeledButtons = await page.locator('button:not([aria-label])').evaluateAll((buttons) =>
    buttons.filter((button) => !(button.textContent ?? '').trim()).length,
  );
  console.log(JSON.stringify({ name, heading: heading?.trim(), horizontalOverflow, unlabeledButtons }));
  await context.close();
}

await capture('home-desktop', '/', { width: 1440, height: 1000 });
await capture('home-mobile', '/', { width: 390, height: 844 });
await capture('home-mobile-fold', '/', { width: 390, height: 844 }, 'ko', false);
await capture('booking-desktop', '/book', { width: 1440, height: 1000 });
await capture('booking-mobile', '/book', { width: 390, height: 844 });
await capture('booking-mobile-fold', '/book', { width: 390, height: 844 }, 'ko', false);
await capture('services-english', '/services', { width: 1280, height: 900 }, 'en');

await browser.close();
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
}
