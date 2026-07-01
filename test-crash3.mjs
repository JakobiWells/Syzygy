import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

let crashed = false;
const errors = [];
page.on('console', msg => {
  const text = `[${msg.type()}] ${msg.text()}`;
  if (msg.type() === 'error') { errors.push(text); console.log('ERR:', text.substring(0, 300)); }
  if (msg.text().includes('[astroEngine]')) console.log('ASTRO:', text);
});
page.on('pageerror', err => { errors.push(`${err}`); console.log('PAGE ERR:', err.toString()); });
page.on('crash', () => { crashed = true; console.log('CRASHED!'); });

await page.goto('http://localhost:5180/eclipse', { timeout: 30000, waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.click('button:has-text("☽ Lunar")');
await page.waitForTimeout(300);
await page.click('text=Select eclipse');
await page.waitForTimeout(300);
await page.click('text=Sep 7, 2025');
await page.waitForTimeout(4000);
console.log('Eclipse selected');

// Inject a click on the map at specific lat/lng using Mapbox's event system
// Find the mapboxgl map instance through the canvas
const clickedLocation = await page.evaluate(() => {
  // Mapbox GL attaches the map to map._container in some versions
  // Let's try to find it through the React component tree
  const canvas = document.querySelector('.eclipse-map canvas.mapboxgl-canvas');
  if (!canvas) return { error: 'No canvas' };
  
  // Look for mapboxgl map instances attached to any element
  // Modern mapboxgl stores map reference on the container
  const mapContainer = document.querySelector('.eclipse-map');
  
  // Try all properties of the container
  const mapKeys = Object.getOwnPropertyNames(mapContainer).filter(k => !k.startsWith('__'));
  
  // Check window._mapboxgl or similar globals
  const windowKeys = Object.keys(window).filter(k => k.toLowerCase().includes('mapbox') || k.toLowerCase().includes('_map'));
  
  return { mapKeys, windowKeys: windowKeys.slice(0, 10) };
});
console.log('Map instance search:', JSON.stringify(clickedLocation));

// The key insight: we need to trigger handleMapClick via map.fire('click', ...)
// or find a way to inject the event
// Let's try a different approach: expose a test API via the page

// Actually let's just use `force: true` to click through the MoonIndicator overlay
// and test locations very close to the sub-lunar peak

// First, let's take a screenshot to see the current map state
await page.screenshot({ path: '/tmp/map-state.png' });

// The map is centered on the sub-lunar point (Indian Ocean, lat=-6.01, lng=86.86)
// The map canvas is 1280x720
// The MoonIndicator is positioned at the screen center
// We need to click slightly off-center to avoid the MoonIndicator

// Force-click at the map center (directly on sub-lunar point, through MoonIndicator)
console.log('\nForce-clicking at center (sub-lunar point)...');
await page.click('.eclipse-map canvas', {
  position: { x: 640, y: 360 },
  force: true,  // bypass overlays
});
await page.waitForTimeout(6000);

let state = await page.evaluate(() => ({
  place: document.querySelector('.lp-place-name')?.textContent?.trim(),
  hasDisc: !!document.querySelector('.sky-disc-widget'),
  hasSkyView: !!document.querySelector('.sky-view-panel'),
}));
console.log('At center (sub-lunar):', JSON.stringify(state));

// Try at various positions close to center
const positions = [
  [630, 350, '10px from center (very close to sub-lunar)'],
  [640, 340, '20px N of center'],
  [620, 360, '20px W of center'],
  [640, 380, '20px S of center'],
];

for (const [x, y, desc] of positions) {
  if (crashed) break;
  console.log(`\nClicking ${desc}...`);
  try {
    await page.click('.eclipse-map canvas', { position: { x, y }, force: true });
    await page.waitForTimeout(6000);
    state = await page.evaluate(() => ({
      place: document.querySelector('.lp-place-name')?.textContent?.trim(),
      hasDisc: !!document.querySelector('.sky-disc-widget'),
    }));
    console.log(desc + ':', JSON.stringify(state));
  } catch (e) {
    console.log('Error:', e.message.substring(0, 100));
  }
}

console.log('\nCrashed:', crashed, 'Errors:', errors.length);
await browser.close();
