import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(`[${msg.type()}] ${text}`);
  if (msg.type() === 'error' || text.includes('WATCHDOG') || text.includes('[astroEngine]') || text.includes('bodyPos') || text.includes('InverseRefraction'))
    console.log(`CONSOLE: ${text.substring(0, 400)}`);
});
page.on('pageerror', err => console.log('PAGE ERR:', err.toString()));
page.on('crash', () => console.log('CRASHED!'));

// Inject a watchdog into the page
await page.addInitScript(() => {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    if (gap > 500) console.log(`WATCHDOG: event loop was blocked for ${gap}ms`);
    lastTick = now;
  }, 200);
});

const port = 5177;
await page.goto(`http://localhost:${port}/eclipse`, { timeout: 30000, waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Select Sep 7, 2025 lunar eclipse
await page.click('button:has-text("☽ Lunar")');
await page.waitForTimeout(300);
await page.click('text=Select eclipse');
await page.waitForTimeout(300);
await page.click('text=Sep 7, 2025').catch(() => {});
// Fallback: try partial match
await page.waitForTimeout(300);
const eclipseLinks = await page.$$('text=/Sep.*2025/');
if (eclipseLinks.length > 0) await eclipseLinks[0].click().catch(() => {});
await page.waitForTimeout(4000);

// Get eclipse catalog number from URL
const eclipseCat = await page.evaluate(() => new URL(window.location.href).searchParams.get('eclipse'));
console.log('Eclipse cat:', eclipseCat);

// Sub-lunar point: lat=-6.01, lng=86.86
// Test progressively closer distances
const testCases = [
  { label: 'far (2000km away)', lat: -6.01 + 18, lng: 86.86, expectedWorkingMs: 10000 },
  { label: 'medium (800km)', lat: -6.01 + 7.2, lng: 86.86, expectedWorkingMs: 10000 },
  { label: 'close (300km)', lat: -6.01 + 2.7, lng: 86.86, expectedWorkingMs: 10000 },
  { label: 'very close (100km)', lat: -6.01 + 0.9, lng: 86.86, expectedWorkingMs: 10000 },
  { label: 'near (50km)', lat: -6.01 + 0.45, lng: 86.86, expectedWorkingMs: 10000 },
  { label: 'sub-lunar (exact)', lat: -6.01, lng: 86.86, expectedWorkingMs: 10000 },
];

for (const tc of testCases) {
  console.log(`\n=== Testing: ${tc.label} (lat=${tc.lat.toFixed(3)}, lng=${tc.lng.toFixed(3)}) ===`);
  const url = `http://localhost:${port}/eclipse?eclipse=${eclipseCat}&lat=${tc.lat.toFixed(5)}&lng=${tc.lng.toFixed(5)}`;

  const startMs = Date.now();
  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
  } catch(e) {
    console.log(`NAVIGATE FAILED: ${e.message.substring(0, 100)}`);
    break;
  }
  const navMs = Date.now() - startMs;
  console.log(`Navigation took ${navMs}ms`);

  // Wait for panel to appear
  try {
    await page.waitForSelector('.sky-disc-widget', { timeout: 12000 });
    const waitMs = Date.now() - startMs;
    console.log(`Panel appeared after ${waitMs}ms`);
  } catch(e) {
    console.log(`Panel did NOT appear within 12s`);
    continue;
  }

  // Check for any issues
  const state = await page.evaluate(() => ({
    hasDisc: !!document.querySelector('.sky-disc-widget'),
    hasPlace: !!document.querySelector('.lp-place-name'),
    place: document.querySelector('.lp-place-name')?.textContent?.trim(),
  })).catch(e => ({ error: e.message }));
  console.log(`State:`, JSON.stringify(state));

  // Try to open and close sky view
  try {
    await page.click('.sky-disc-expand', { timeout: 5000 });
    await page.waitForTimeout(2000);
    const skyOpen = await page.evaluate(() => !!document.querySelector('.sky-view-panel'));
    console.log(`Sky view opened: ${skyOpen}`);
    if (skyOpen) {
      await page.click('.lp-close', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch(e) {
    console.log(`Sky view click error: ${e.message.substring(0, 100)}`);
  }
}

// Final: test with URL parameter for very close points in all 4 directions
console.log('\n=== Testing directional proximity ===');
const directions = [
  { label: 'N (218km)', lat: -6.01 + 1.957, lng: 86.86 - 1.946 },  // matches 20px N from test
  { label: 'W (approx 218km)', lat: -6.01, lng: 86.86 - 2 },
  { label: 'E (approx 218km)', lat: -6.01, lng: 86.86 + 2 },
  { label: 'S (218km)', lat: -6.01 - 1.957, lng: 86.86 + 1.946 },
];

for (const d of directions) {
  console.log(`\n--- Direction: ${d.label} ---`);
  const url = `http://localhost:${port}/eclipse?eclipse=${eclipseCat}&lat=${d.lat.toFixed(5)}&lng=${d.lng.toFixed(5)}`;
  try {
    await page.goto(url, { timeout: 20000, waitUntil: 'load' });
    await page.waitForTimeout(8000);
    const state = await page.evaluate(() => ({
      hasDisc: !!document.querySelector('.sky-disc-widget'),
      place: document.querySelector('.lp-place-name')?.textContent?.trim(),
    }));
    console.log('State:', JSON.stringify(state));
  } catch(e) {
    console.log(`FAILED: ${e.message.substring(0, 150)}`);
  }
}

console.log('\n=== Done ===');
await browser.close().catch(() => {});
