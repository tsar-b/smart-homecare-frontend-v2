import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => localStorage.setItem('shc-locale', 'ko'));
const page = await context.newPage();
const unexpectedErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('net::ERR_CONNECTION_REFUSED')) {
    unexpectedErrors.push(message.text());
  }
});
page.on('pageerror', (error) => unexpectedErrors.push(error.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '메뉴 열기' }).click();
if ((await page.getByRole('button', { name: '메뉴 닫기' }).getAttribute('aria-expanded')) !== 'true') {
  throw new Error('Mobile navigation did not expose its expanded state.');
}
await page.locator('#mobile-navigation').getByRole('link', { name: '서비스', exact: true }).click();
await page.waitForURL('**/services');
await page.getByRole('button', { name: 'Switch to English' }).click();
await page.getByRole('heading', { level: 1, name: /Find the work you need/ }).waitFor();

await page.goto('http://localhost:5173/book', { waitUntil: 'networkidle' });
const submit = page.getByRole('button', { name: /Submit booking request|예약 요청 제출/ });
if (!(await submit.isDisabled())) throw new Error('Preview booking submission must stay disabled.');
await page.locator('input[type=file]').setInputFiles({
  name: 'unit-condition.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('safe-local-smoke-test'),
});
await page.getByText('unit-condition.jpg').waitFor();

await page.goto('http://localhost:5173/no-such-route');
await page.getByRole('heading', { level: 1, name: /could not be found|찾을 수 없습니다/ }).waitFor();

await browser.close();
if (unexpectedErrors.length) throw new Error(unexpectedErrors.join('\n'));
console.log('Browser smoke checks passed: mobile navigation, locale switch, fail-closed booking, media selection, and 404 route.');
