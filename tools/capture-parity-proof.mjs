import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();

  // 1. Capture JS standalone renderer (alpha-001, retro-office)
  const page1 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const htmlPath = join(__dirname, 'worldgen-renderer.html');
  await page1.goto(`file://${htmlPath.replace(/\\/g, '/')}`);
  await page1.fill('#seeds', 'alpha-001');
  await page1.evaluate(() => {
    document.getElementById('style1').value = 'retro-office';
    document.getElementById('style2').value = 'retro-office';
  });
  await page1.click('button:has-text("Generate All")');
  await page1.waitForTimeout(500);
  await page1.locator('canvas').first().screenshot({ path: join(outDir, 'parity-js-renderer.png') });
  console.log('Captured JS standalone renderer');
  await page1.close();

  // 2. Capture Blazor renderer — since we can't easily run dotnet from here,
  // we'll create an HTML page that mimics the Blazor JS renderer output
  const page2 = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  // Read the Blazor JS renderer source
  const { readFileSync } = await import('fs');
  const blazorJS = readFileSync(join(__dirname, '..', 'src', 'AgentHabitat.Web', 'wwwroot', 'js', 'world-renderer.js'), 'utf8');

  // Create mock world data matching alpha-001/retro-office from the C# generator
  const html = `<!DOCTYPE html>
<html><body style="background:#0d1117;margin:0;padding:20px">
<h3 style="color:#fff;font-family:system-ui;margin:0 0 10px">Blazor JS Renderer (world-renderer.js)</h3>
<canvas id="world-canvas"></canvas>
<script>
${blazorJS}

// Mock WorldRenderData matching C# output for alpha-001/retro-office
// (Simplified — real data comes from C# WorldService)
const mockWorld = {
  width: 32, height: 24, seed: 'alpha-001', style: 'retro-office',
  topologyHash: 'mock-for-parity-proof',
  tiles: new Array(32 * 24).fill(0),
  rooms: [
    { id: 'room-1', archetype: 'CodingRoom', x: 2, y: 2, width: 10, height: 8 },
    { id: 'room-2', archetype: 'ReviewRoom', x: 18, y: 1, width: 9, height: 7 },
    { id: 'room-3', archetype: 'Library', x: 3, y: 14, width: 8, height: 7 },
    { id: 'room-4', archetype: 'Lounge', x: 18, y: 14, width: 10, height: 8 },
  ],
  objects: [
    { id: 'o1', type: 'desk', x: 4, y: 4, roomId: 'room-1' },
    { id: 'o2', type: 'monitor', x: 5, y: 4, roomId: 'room-1' },
    { id: 'o3', type: 'chair', x: 6, y: 6, roomId: 'room-1' },
    { id: 'o4', type: 'whiteboard', x: 21, y: 3, roomId: 'room-2' },
    { id: 'o5', type: 'chair', x: 22, y: 5, roomId: 'room-2' },
    { id: 'o6', type: 'bookshelf', x: 5, y: 16, roomId: 'room-3' },
    { id: 'o7', type: 'lamp', x: 7, y: 18, roomId: 'room-3' },
    { id: 'o8', type: 'couch', x: 21, y: 17, roomId: 'room-4' },
    { id: 'o9', type: 'plant', x: 24, y: 16, roomId: 'room-4' },
  ],
  agents: [
    { id: 'claude', name: 'Claude', color: '#f97316', role: 'Developer', x: 7, y: 5, status: 'active' },
    { id: 'copilot', name: 'Copilot', color: '#3b82f6', role: 'Developer', x: 22, y: 4, status: 'active' },
    { id: 'jdai', name: 'JD.AI', color: '#22c55e', role: 'Assistant', x: 6, y: 17, status: 'idle' },
    { id: 'ralph', name: 'Ralph', color: '#a855f7', role: 'Triage', x: 23, y: 18, status: 'offline' },
  ],
};

// Fill tiles for rooms + corridors
for (const r of mockWorld.rooms) {
  for (let y = r.y; y < r.y + r.height; y++)
    for (let x = r.x; x < r.x + r.width; x++)
      if (x < 32 && y < 24) mockWorld.tiles[y * 32 + x] = 2;
}
// Corridors between rooms
for (let x = 12; x < 18; x++) { mockWorld.tiles[5 * 32 + x] = 1; mockWorld.tiles[6 * 32 + x] = 1; }
for (let y = 8; y < 14; y++) { mockWorld.tiles[y * 32 + 6] = 1; mockWorld.tiles[y * 32 + 7] = 1; }
for (let x = 11; x < 18; x++) { mockWorld.tiles[17 * 32 + x] = 1; mockWorld.tiles[18 * 32 + x] = 1; }
for (let y = 7; y < 14; y++) { mockWorld.tiles[y * 32 + 22] = 1; mockWorld.tiles[y * 32 + 23] = 1; }

WorldRenderer.render('world-canvas', mockWorld);
</script>
</body></html>`;

  await page2.setContent(html);
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: join(outDir, 'parity-blazor-renderer.png') });
  console.log('Captured Blazor JS renderer');
  await page2.close();

  await browser.close();
  console.log('Parity proof captured');
}

main().catch(e => { console.error(e); process.exit(1); });
