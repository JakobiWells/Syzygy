import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleLogs = [];
await page.addInitScript(() => {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    if (gap > 400) console.log(`WATCHDOG:${gap}`);
    lastTick = now;
  }, 100);
});

page.on('console', msg => {
  const text = msg.text();
  consoleLogs.push(`[${msg.type()}] ${text}`);
  if (text.startsWith('WATCHDOG:') || text.includes('[handleMapClick]') || text.includes('[bodyPos]') || msg.type() === 'error')
    console.log(`CONSOLE: ${text.substring(0, 400)}`);
});
page.on('pageerror', err => console.log('PAGE ERR:', err.toString()));
page.on('crash', () => { console.log('CRASHED!'); process.exit(1); });

const port = 5177;
console.log(`Loading page at port ${port}...`);

// Load page and wait for it to be interactive
await page.goto(`http://localhost:${port}/eclipse`, { timeout: 60000, waitUntil: 'networkidle' });

// Try to click Lunar button with a longer timeout
try {
  await page.waitForSelector('button:has-text("☽ Lunar")', { timeout: 60000 });
  await page.click('button:has-text("☽ Lunar")');
  console.log('Clicked Lunar button');
} catch(e) {
  console.log('Could not click Lunar button:', e.message.substring(0, 100));
  // Try finding by text
  const btn = await page.$('text=Lunar');
  if (btn) { await btn.click(); console.log('Clicked via text selector'); }
}

await page.waitForTimeout(1000);

// Click "Select eclipse"
try {
  await page.click('text=Select eclipse', { timeout: 10000 });
  console.log('Clicked Select eclipse');
} catch(e) {
  console.log('Select eclipse not found:', e.message.substring(0, 100));
}

await page.waitForTimeout(500);

// Look for the Sep 7, 2025 eclipse
try {
  // Try multiple selectors
  const selectors = [
    'text=Sep 7, 2025',
    'text=/Sep.*7.*2025/',
    'text=/2025.*Sep.*7/',
    '[data-cat="59660"]',
  ];
  let clicked = false;
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 3000 });
      console.log(`Clicked eclipse via: ${sel}`);
      clicked = true;
      break;
    } catch {}
  }
  if (!clicked) {
    // List all visible eclipse options
    const items = await page.$$eval('[class*="eclipse-item"], [class*="browser-item"], li', els =>
      els.slice(0, 20).map(el => el.textContent?.trim().substring(0, 60)));
    console.log('Visible items:', JSON.stringify(items));
    // Click first one that has 2025
    const link = await page.$('text=/2025/');
    if (link) { await link.click(); console.log('Clicked 2025 item'); }
  }
} catch(e) {
  console.log('Eclipse select error:', e.message.substring(0, 100));
}

console.log('\nWaiting 20s for eclipse to settle (buildLunarZones, WebGL, etc.)...');
await page.waitForTimeout(20000);

const eclipseCat = await page.evaluate(() => new URL(window.location.href).searchParams.get('eclipse'));
console.log('Eclipse cat from URL:', eclipseCat);

// Get canvas
const canvas = page.locator('.eclipse-map canvas').first();
let box;
try {
  box = await canvas.boundingBox({ timeout: 10000 });
} catch(e) {
  console.log('No canvas found, page may be frozen');
  await browser.close().catch(() => {});
  process.exit(1);
}
console.log('Canvas box:', JSON.stringify(box));

const cx = Math.round(box.width / 2);
const cy = Math.round(box.height / 2);
console.log(`Canvas center: (${cx}, ${cy})`);

// Now test clicks. Important: stay on same page (no navigation).
const testClicks = [
  // First establish baseline - click something far from sub-lunar
  { x: cx - 200, y: cy - 200, label: 'far NW (baseline, far from sub-lunar)' },
  // Wait for panel, then proceed
  { x: cx, y: cy - 20, label: '20px N of center' },
  { x: cx - 20, y: cy, label: '20px W of center (THE CRASH LOCATION)' },
  { x: cx + 20, y: cy, label: '20px E of center' },
  { x: cx, y: cy + 20, label: '20px S of center' },
];

for (const tc of testClicks) {
  console.log(`\n=== Clicking: ${tc.label} at (${tc.x}, ${tc.y}) ===`);

  const t0 = Date.now();
  const blocksBefore = consoleLogs.filter(l => l.includes('WATCHDOG')).length;

  // Click the canvas
  try {
    await canvas.click({ position: { x: tc.x, y: tc.y }, force: true, timeout: 5000 });
    console.log(`Click dispatched in ${Date.now()-t0}ms`);
  } catch(e) {
    console.log(`Click failed: ${e.message.substring(0, 100)}`);
    continue;
  }

  // Monitor for 15 seconds
  let maxBlock = 0;
  let panelSeen = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const elapsed = Date.now() - t0;

    // Check responsiveness
    const evalResult = await page.evaluate(() => ({
      hasDisc: !!document.querySelector('.sky-disc-widget'),
      place: document.querySelector('.lp-place-name')?.textContent?.trim()?.substring(0, 40),
      hasMoonInd: !!document.querySelector('.moon-ind'),
    })).catch(() => ({ frozen: true }));

    if (evalResult.frozen) {
      console.log(`  PAGE FROZEN at ${elapsed}ms`);
      break;
    }

    if (evalResult.hasDisc && !panelSeen) {
      console.log(`  Panel appeared at ${elapsed}ms: "${evalResult.place}"`);
      panelSeen = true;
    }

    if (elapsed > 12000) {
      console.log(`  Stopping after ${elapsed}ms. Panel seen: ${panelSeen}`);
      break;
    }
  }

  // Count new watchdog blocks
  const blocksAfter = consoleLogs.filter(l => l.includes('WATCHDOG')).length;
  console.log(`  New watchdog blocks: ${blocksAfter - blocksBefore}`);

  // Wait between clicks
  await page.waitForTimeout(2000);
}

console.log('\n=== All click tests done ===');
console.log('Total watchdog blocks:', consoleLogs.filter(l => l.includes('WATCHDOG')).length);
await browser.close().catch(() => {});
