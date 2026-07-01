import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

// Watchdog + timing instrumentation
const blockEvents = [];
await page.addInitScript(() => {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    if (gap > 300) console.log(`WATCHDOG:${gap}`);
    lastTick = now;
  }, 100);
});

page.on('console', msg => {
  const text = msg.text();
  if (text.startsWith('WATCHDOG:')) {
    const ms = parseInt(text.slice(9));
    blockEvents.push(ms);
  } else if (msg.type() === 'error') {
    console.log(`ERR: ${text.substring(0, 300)}`);
  }
});
page.on('pageerror', err => console.log('PAGE ERR:', err.toString()));

const port = 5177;
await page.goto(`http://localhost:${port}/eclipse`, { timeout: 30000, waitUntil: 'load' });
await page.waitForTimeout(3000);
blockEvents.length = 0; // clear initial load blocks

// Select lunar eclipse
await page.click('button:has-text("☽ Lunar")');
await page.waitForTimeout(500);
await page.click('text=Select eclipse');
await page.waitForTimeout(500);
// Try to click Sep 7, 2025
const links = await page.$$('text=/2025/');
let found = false;
for (const link of links) {
  const txt = await link.textContent();
  if (txt?.includes('Sep') || txt?.includes('7')) { await link.click(); found = true; break; }
}
if (!found) {
  // Try clicking any link with Sep
  await page.getByText(/Sep.*2025|2025.*Sep/).first().click().catch(() => {});
}

console.log('Waiting 15s for eclipse to load and buildLunarZones to complete...');
await page.waitForTimeout(15000);
const blocksAfterSelect = blockEvents.filter(ms => ms > 500);
console.log(`Blocks >500ms after eclipse selection: ${blocksAfterSelect.length} (max: ${Math.max(...blocksAfterSelect, 0)}ms)`);
blockEvents.length = 0;

// Check the eclipse was selected
const eclipseCat = await page.evaluate(() => new URL(window.location.href).searchParams.get('eclipse'));
console.log('Eclipse cat:', eclipseCat, '(expected non-null for Sep 7 2025 lunar)');

// Get canvas bounding box
const canvas = page.locator('.eclipse-map canvas').first();
const box = await canvas.boundingBox();
console.log('Canvas bounds:', JSON.stringify(box));

if (!box) {
  console.log('No canvas found! Cannot proceed.');
  await browser.close();
  process.exit(1);
}

// The sub-lunar point should be near center of visible globe
// Map canvas center:
const cx = box.width / 2, cy = box.height / 2;
console.log(`Canvas center: (${cx}, ${cy})`);

// Test locations to click
const clickPositions = [
  { dx: 0, dy: -100, label: '100px N (far)' },
  { dx: 0, dy: -60,  label: '60px N (mid)' },
  { dx: 0, dy: -40,  label: '40px N' },
  { dx: 0, dy: -20,  label: '20px N' },
  { dx: -20, dy: 0,  label: '20px W' },
  { dx: -40, dy: 0,  label: '40px W' },
  { dx: 20, dy: 0,   label: '20px E' },
  { dx: 0, dy: 20,   label: '20px S' },
];

for (const pos of clickPositions) {
  const px = cx + pos.dx;
  const py = cy + pos.dy;

  console.log(`\n--- Clicking ${pos.label} at (${px}, ${py}) ---`);
  blockEvents.length = 0;
  const t0 = Date.now();

  // Click the canvas
  await canvas.click({ position: { x: px, y: py }, force: true });

  // Wait up to 10 seconds, checking every 500ms for responsiveness
  let panelAppeared = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const elapsed = Date.now() - t0;
    const recent = blockEvents.filter(ms => ms > 500);
    if (recent.length > 0) {
      console.log(`  At ${elapsed}ms: blocks detected: ${recent.join(', ')}ms`);
    }

    const state = await page.evaluate(() => ({
      hasDisc: !!document.querySelector('.sky-disc-widget'),
      place: document.querySelector('.lp-place-name')?.textContent?.trim()?.substring(0, 40),
    })).catch(() => ({ hasDisc: false, place: null, frozen: true }));

    if (state.frozen) {
      console.log(`  FROZEN at ${elapsed}ms!`);
      break;
    }
    if (state.hasDisc) {
      console.log(`  Panel appeared at ${elapsed}ms: ${state.place}`);
      panelAppeared = true;
      break;
    }
    if (elapsed > 8000) {
      console.log(`  Timeout after ${elapsed}ms (no panel). Latest blocks: ${blockEvents.slice(-5).join(',')}ms`);
      break;
    }
  }

  const maxBlock = Math.max(...blockEvents, 0);
  console.log(`  Max event loop block during this click: ${maxBlock}ms`);

  if (maxBlock > 5000) {
    console.log(`  *** POTENTIAL CRASH: event loop blocked ${maxBlock}ms after this click ***`);
  }

  blockEvents.length = 0;

  // Small wait between clicks to let things settle
  await page.waitForTimeout(1000);
}

console.log('\n=== Test complete ===');
await browser.close().catch(() => {});
