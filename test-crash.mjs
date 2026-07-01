import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

let crashed = false;
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(`ERR: ${msg.text().substring(0, 300)}`);
    console.log('ERR:', msg.text().substring(0, 300));
  }
});
page.on('pageerror', err => {
  errors.push(`PAGE ERR: ${err.toString()}`);
  console.log('PAGE ERR:', err.toString());
});
page.on('crash', () => { crashed = true; console.log('PAGE CRASHED!'); });

await page.goto('http://localhost:5180/eclipse', { timeout: 30000, waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Select Sep 7, 2025 lunar eclipse
await page.click('button:has-text("☽ Lunar")');
await page.waitForTimeout(300);
await page.click('text=Select eclipse');
await page.waitForTimeout(300);
await page.click('text=Sep 7, 2025');
await page.waitForTimeout(3000);
console.log('Eclipse selected');

// Use the search box to navigate to specific coordinates near sub-lunar point
// Or directly use Playwright to inject a call to handleLocationSelect
// Sub-lunar peak: lat=-6.01, lng=86.86

// Try clicking at various positions on the map, avoiding the MoonIndicator at center
const mapCanvas = page.locator('.eclipse-map canvas').first();
const box = await mapCanvas.boundingBox();
console.log('Map bounds:', JSON.stringify(box));

// First, fly to the sub-lunar area if the map isn't already there
// The eclipse should have auto-flown to the sub-lunar point

// Test locations: try different percentages of the map
const testPositions = [
  { x: 0.6, y: 0.4, desc: 'N of center' },
  { x: 0.65, y: 0.4, desc: 'NE of center' },
  { x: 0.55, y: 0.4, desc: 'N slightly W' },
  { x: 0.6, y: 0.35, desc: 'far N' },
  { x: 0.4, y: 0.4, desc: 'NW of center' },
  { x: 0.35, y: 0.5, desc: 'W of center' },
];

for (const pos of testPositions) {
  if (crashed) break;
  
  console.log(`\nClicking at ${pos.desc}...`);
  try {
    await mapCanvas.click({ position: { x: box.width * pos.x, y: box.height * pos.y }, force: true });
    await page.waitForTimeout(4000);  // wait for async fetches
    
    const result = await page.evaluate(() => {
      const place = document.querySelector('.lp-place-name')?.textContent;
      const outOfPath = document.querySelector('.lp-out-of-path')?.textContent;
      const error = document.querySelector('[class*="error-boundary"], .sky-view-panel');
      return { place, outOfPath, hasError: !!error };
    });
    console.log(`Result for ${pos.desc}:`, JSON.stringify(result));
    
    // Also expand sky view to test that code path
    const hasSkyDisc = await page.evaluate(() => !!document.querySelector('.sky-disc-expand'));
    if (hasSkyDisc) {
      console.log('  Opening sky view...');
      await page.click('.sky-disc-expand', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const skyOpen = await page.evaluate(() => !!document.querySelector('.sky-view-panel'));
      console.log('  Sky view opened:', skyOpen);
      if (skyOpen) {
        await page.click('.lp-close', { timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  } catch (e) {
    if (!crashed) console.log('Error at', pos.desc, ':', e.message.substring(0, 100));
  }
}

console.log('\n=== Summary ===');
console.log('Crashed:', crashed);
console.log('Errors:', errors.length);
errors.forEach(e => console.log(e));

await page.screenshot({ path: '/tmp/final-test.png' });
await browser.close();
console.log('Done - screenshot at /tmp/final-test.png');
