import { chromium } from 'playwright';

// Run in non-headless mode to get real GPU rendering behavior
const browser = await chromium.launch({
  headless: false,
  args: ['--no-sandbox', '--disable-web-security']
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const blockEvents = [];
await page.addInitScript(() => {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    if (gap > 200) console.log(`WATCHDOG:${gap}`);
    lastTick = now;
  }, 100);
});

page.on('console', msg => {
  const text = msg.text();
  if (text.startsWith('WATCHDOG:')) {
    const ms = parseInt(text.slice(9));
    blockEvents.push({ t: Date.now(), ms });
    if (ms > 1000) console.log(`WATCHDOG: ${ms}ms`);
  } else if (text.includes('[handleMapClick]') || text.includes('[bodyPos]') || text.includes('ERR') || msg.type() === 'error') {
    console.log(`CONSOLE [${msg.type()}]: ${text.substring(0, 400)}`);
  }
});
page.on('pageerror', err => console.log('PAGE ERR:', err.toString()));

const port = 5177;
console.log(`Loading page at port ${port}...`);
await page.goto(`http://localhost:${port}/eclipse`, { timeout: 30000, waitUntil: 'load' });
await page.waitForTimeout(3000);
blockEvents.length = 0;

// Try to click Lunar button
console.log('Clicking Lunar...');
await page.waitForSelector('button:has-text("☽ Lunar")', { timeout: 30000 });
await page.click('button:has-text("☽ Lunar")');
await page.waitForTimeout(500);
await page.click('text=Select eclipse', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(500);
await page.click('text=Sep 7, 2025', { timeout: 5000 }).catch(async () => {
  // Try partial text match
  const link = await page.$('text=/Sep.*7.*2025/');
  if (link) await link.click();
});
console.log('Eclipse selected, waiting 10s to settle...');
await page.waitForTimeout(10000);
blockEvents.length = 0;

const url = await page.url();
console.log('Current URL:', url);

// Get canvas
const canvas = page.locator('.eclipse-map canvas').first();
const box = await canvas.boundingBox({ timeout: 5000 });
console.log('Canvas box:', JSON.stringify(box));

if (!box) { await browser.close(); process.exit(1); }

const cx = Math.round(box.width / 2);
const cy = Math.round(box.height / 2);
console.log(`Center: (${cx}, ${cy})`);

// Test clicks - same order as original crash test
const clicks = [
  { x: cx, y: cy, label: 'Center (sub-lunar)' },
  { x: cx, y: cy - 20, label: '20px N' },
  { x: cx - 20, y: cy, label: '20px W (crash location)' },
  { x: cx + 20, y: cy, label: '20px E' },
  { x: cx, y: cy + 20, label: '20px S' },
];

for (const c of clicks) {
  console.log(`\n=== ${c.label} at (${c.x}, ${c.y}) ===`);
  blockEvents.length = 0;
  const t0 = Date.now();

  try {
    await canvas.click({ position: { x: c.x, y: c.y }, force: true, timeout: 10000 });
    console.log(`Clicked in ${Date.now()-t0}ms`);
  } catch(e) {
    console.log(`Click failed: ${e.message.substring(0, 100)}`);
    continue;
  }

  // Monitor for 15s
  let maxBlock = 0;
  let panelSeen = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const elapsed = Date.now() - t0;
    const recentBlocks = blockEvents.filter(b => b.t > t0 - 100);
    if (recentBlocks.length > 0) {
      const m = Math.max(...recentBlocks.map(b => b.ms));
      if (m > maxBlock) maxBlock = m;
    }

    const state = await page.evaluate(() => ({
      hasDisc: !!document.querySelector('.sky-disc-widget'),
      place: document.querySelector('.lp-place-name')?.textContent?.trim()?.substring(0, 40),
    })).catch(() => ({ frozen: true }));

    if (state.frozen) { console.log(`FROZEN at ${elapsed}ms!`); break; }
    if (state.hasDisc && !panelSeen) {
      console.log(`Panel at ${elapsed}ms: "${state.place}"`);
      panelSeen = true;
    }
    if (elapsed > 12000) { console.log(`Timeout. Panel: ${panelSeen}`); break; }
  }
  console.log(`Max block during click: ${maxBlock}ms`);
  await page.waitForTimeout(2000);
}

console.log('\n=== Done ===');
await browser.close().catch(() => {});
