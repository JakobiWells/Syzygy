import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

let crashed = false;
const errors = [];
page.on('console', msg => {
  const text = `[${msg.type()}] ${msg.text()}`;
  if (msg.type() === 'error') { errors.push(text); console.log('ERR:', text.substring(0, 300)); }
  if (msg.text().includes('[astroEngine]')) console.log('ASTRO:', text.substring(0, 300));
});
page.on('pageerror', err => { errors.push(`PAGE ERR: ${err.toString()}`); console.log('PAGE ERR:', err.toString()); });
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

// Inject map click at specific lat/lng coordinates
// The sub-lunar point is at lat=-6.01, lng=86.86
// Let's trigger handleLocationSelect directly via map click events

// Use mapboxgl's map click events to trigger handleLocationSelect
const result = await page.evaluate(() => {
  const mapContainer = document.querySelector('.eclipse-map');
  if (!mapContainer || !mapContainer._mapboxgl_map) {
    // Try to find the map object via canvas
    const canvas = mapContainer?.querySelector('canvas.mapboxgl-canvas');
    if (!canvas) return 'No canvas';
    
    // Project using the container's _map property if available
    const map = mapContainer._map;
    if (!map) return 'No _map property';
    
    return { zoom: map.getZoom(), center: map.getCenter() };
  }
  return 'success';
});
console.log('Map check:', JSON.stringify(result));

// Simpler approach: fire a click event programmatically on the map
// by finding where specific lat/lng coordinates appear on screen
const screenPos = await page.evaluate(() => {
  const mapContainer = document.querySelector('.eclipse-map');
  if (!mapContainer) return null;
  
  // Try to find the map via mapboxgl containers (look for a property)
  let map = null;
  for (const key of Object.keys(mapContainer)) {
    if (key.includes('mapbox') || key.includes('_map')) {
      map = mapContainer[key];
      if (map && typeof map.project === 'function') break;
    }
  }
  
  if (!map) {
    // Try window._mapboxgl or any global
    return { error: 'Map not found', containerKeys: Object.keys(mapContainer).filter(k => !k.startsWith('__')).slice(0, 20) };
  }
  
  const pt = map.project([86.86, -3.0]);  // lng, lat (1000km from sub-lunar)
  return { x: Math.round(pt.x), y: Math.round(pt.y), zoom: map.getZoom() };
});
console.log('Screen position for lat=-3, lng=86.86:', JSON.stringify(screenPos));

// Since we can't easily access the Mapbox map object via JS,
// let's use the URL parameter approach to load the eclipse with a specific location
// Navigate directly with eclipse+lat+lng URL params
console.log('\nTesting via URL with lat/lng params...');
const eclipseCat = await page.evaluate(() => new URL(window.location.href).searchParams.get('eclipse'));
console.log('Eclipse cat:', eclipseCat);

// Navigate to the eclipse with location pre-set
await page.goto(`http://localhost:5180/eclipse?eclipse=${eclipseCat}&lat=-3.0&lng=86.86`, {
  timeout: 30000, waitUntil: 'networkidle'
});
await page.waitForTimeout(8000);

const panelState = await page.evaluate(() => ({
  placeName: document.querySelector('.lp-place-name')?.textContent,
  outOfPath: document.querySelector('.lp-out-of-path')?.textContent,
  hasSkyDisc: !!document.querySelector('.sky-disc-widget'),
}));
console.log('Panel state (1000km from sub-lunar):', JSON.stringify(panelState));

// Test with even closer location
await page.goto(`http://localhost:5180/eclipse?eclipse=${eclipseCat}&lat=-5.0&lng=86.86`, {
  timeout: 30000, waitUntil: 'networkidle'
});
await page.waitForTimeout(8000);

const panelState2 = await page.evaluate(() => ({
  placeName: document.querySelector('.lp-place-name')?.textContent,
  outOfPath: document.querySelector('.lp-out-of-path')?.textContent,
  hasSkyDisc: !!document.querySelector('.sky-disc-widget'),
}));
console.log('Panel state (100km from sub-lunar):', JSON.stringify(panelState2));

// Test with exact sub-lunar point
await page.goto(`http://localhost:5180/eclipse?eclipse=${eclipseCat}&lat=-6.01&lng=86.86`, {
  timeout: 30000, waitUntil: 'networkidle'
});
await page.waitForTimeout(8000);

const panelState3 = await page.evaluate(() => ({
  placeName: document.querySelector('.lp-place-name')?.textContent,
  hasSkyDisc: !!document.querySelector('.sky-disc-widget'),
}));
console.log('Panel state (EXACT sub-lunar point):', JSON.stringify(panelState3));

console.log('\nCrashed:', crashed);
console.log('Errors:', errors.length, errors);

await page.screenshot({ path: '/tmp/sublunary-test.png' });
await browser.close();
console.log('Done');
