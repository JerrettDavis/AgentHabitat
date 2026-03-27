/**
 * Sprite Sheet Generator — extracts visual assets from rendered world canvas.
 * Takes a screenshot of the full canvas, then crops individual sprite regions.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'poc', 'sprite-sheets');

const CATEGORIES = {
  'Furniture': ['desk', 'table', 'bookshelf', 'couch', 'server', 'filing', 'vending', 'coffee', 'cooler', 'coatrack', 'potted-tree', 'chair'],
  'Wall Items': ['whiteboard', 'screen', 'bulletin', 'art-frame', 'calendar', 'clock', 'window', 'fire-ext'],
  'Floor Items': ['plant', 'lamp', 'fan', 'trash', 'rug', 'mat'],
  'Small Props': ['monitor', 'keyboard', 'mug', 'papers', 'headphones', 'snack-bowl', 'globe', 'cables'],
};

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Step 1: Get world data (object positions + agent positions)
  const worldInfo = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    if (!c || !c._worldData) return null;
    const wd = c._worldData;
    return {
      tileSize: c._tileSize || 32,
      canvasWidth: c.width,
      canvasHeight: c.height,
      objects: (wd.objects || []).map(o => ({ type: o.type, x: o.x, y: o.y })),
      agents: (wd.agents || []).map(a => ({ id: a.id, name: a.name, color: a.color, status: a.status, x: a.x, y: a.y })),
      doors: (wd.doors || []).map(d => ({ id: d.id, x: d.x, y: d.y, state: d.state, direction: d.direction })),
    };
  });

  if (!worldInfo) { console.log('ERROR: No world data'); await browser.close(); return; }
  const ts = worldInfo.tileSize;

  // Step 2: Screenshot the canvas element directly
  const canvasEl = page.locator('#world-canvas');
  const canvasScreenshot = await canvasEl.screenshot();
  const canvasImgPath = path.join(OUTPUT_DIR, '_canvas-full.png');
  fs.writeFileSync(canvasImgPath, canvasScreenshot);
  console.log(`Canvas captured: ${worldInfo.canvasWidth}×${worldInfo.canvasHeight}`);

  // Step 3: Use a new page context to compose sprite sheets from the screenshot
  const composePage = await browser.newPage();

  for (const [category, types] of Object.entries(CATEGORIES)) {
    const cols = Math.min(6, types.length);
    const rows = Math.ceil(types.length / cols);
    const cellSize = ts + 16;
    const labelH = 18;
    const sheetW = cols * cellSize + 16;
    const sheetH = rows * (cellSize + labelH) + 44;

    const dataUrl = await composePage.evaluate(async ({ types, cols, cellSize, labelH, sheetW, sheetH, category, ts, objects, canvasW, canvasH, imgBase64 }) => {
      const sheet = document.createElement('canvas');
      sheet.width = sheetW;
      sheet.height = sheetH;
      const ctx = sheet.getContext('2d');

      ctx.fillStyle = '#111520';
      ctx.fillRect(0, 0, sheetW, sheetH);
      ctx.fillStyle = '#eaeff6';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${category} (${types.length})`, sheetW / 2, 28);

      // Load the canvas screenshot as an image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgBase64;
      });

      types.forEach((type, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dx = 8 + col * cellSize;
        const dy = 44 + row * (cellSize + labelH);

        ctx.fillStyle = '#1c2235';
        ctx.fillRect(dx, dy, cellSize - 4, cellSize - 4);
        ctx.strokeStyle = '#2a3150';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx, dy, cellSize - 4, cellSize - 4);

        // Find first instance of this type
        const obj = objects.find(o => o.type === type);
        if (obj) {
          const sx = obj.x * ts;
          const sy = obj.y * ts;
          // Crop from screenshot
          ctx.drawImage(img, sx, sy, ts, ts, dx + 8, dy + 4, ts, ts);
        } else {
          ctx.fillStyle = '#525c74';
          ctx.font = '8px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('N/A', dx + cellSize / 2 - 2, dy + cellSize / 2);
        }

        ctx.fillStyle = '#b0b8cc';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(type, dx + cellSize / 2 - 2, dy + cellSize + 10);
      });

      return sheet.toDataURL('image/png');
    }, {
      types, cols, cellSize, labelH, sheetW, sheetH, category, ts,
      objects: worldInfo.objects,
      canvasW: worldInfo.canvasWidth,
      canvasH: worldInfo.canvasHeight,
      imgBase64: 'data:image/png;base64,' + canvasScreenshot.toString('base64'),
    });

    const fname = `spritesheet-${category.toLowerCase().replace(/\s+/g, '-')}.png`;
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUTPUT_DIR, fname), buf);
    console.log(`✓ ${category}: ${types.length} sprites → ${fname}`);
  }

  // Agent sprite sheet
  const agentDataUrl = await composePage.evaluate(async ({ agents, ts, imgBase64 }) => {
    const cellW = ts + 24;
    const cellH = ts + 32;
    const canvas = document.createElement('canvas');
    canvas.width = agents.length * cellW + 16;
    canvas.height = cellH + 50;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111520';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eaeff6';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Agents (${agents.length})`, canvas.width / 2, 22);

    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = imgBase64; });

    agents.forEach((agent, i) => {
      const dx = 8 + i * cellW;
      const dy = 34;

      ctx.fillStyle = '#1c2235';
      ctx.fillRect(dx, dy, cellW - 4, cellH - 4);

      // Extract agent region (agents render from center, so offset)
      const sx = agent.x * ts - 12;
      const sy = agent.y * ts - 20;
      ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), ts + 24, ts + 32, dx + 4, dy + 2, cellW - 8, cellH - 8);

      ctx.fillStyle = agent.color;
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, dx + cellW / 2 - 2, dy + cellH + 10);

      const sc = agent.status === 'active' ? '#22c55e' : agent.status === 'idle' ? '#eab308' : '#666';
      ctx.fillStyle = sc;
      ctx.font = '8px system-ui';
      ctx.fillText(agent.status, dx + cellW / 2 - 2, dy + cellH + 20);
    });

    return canvas.toDataURL('image/png');
  }, { agents: worldInfo.agents, ts, imgBase64: 'data:image/png;base64,' + canvasScreenshot.toString('base64') });

  const agentBuf = Buffer.from(agentDataUrl.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'spritesheet-agents.png'), agentBuf);
  console.log(`✓ Agents: ${worldInfo.agents.length}`);

  // Door sprite sheet (direct render — works perfectly)
  const doorDataUrl = await composePage.evaluate(({ states, dirs }) => {
    const cellSize = 48;
    const labelH = 16;
    const cols = dirs.length;
    const rows = states.length;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellSize + 60;
    canvas.height = rows * (cellSize + labelH) + 50;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111520';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eaeff6';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Doors (${states.length} × ${dirs.length})`, canvas.width / 2, 24);

    dirs.forEach((d, i) => { ctx.fillStyle = '#b0b8cc'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(d, 60 + i * cellSize + cellSize / 2, 42); });

    states.forEach((state, row) => {
      const y = 48 + row * (cellSize + labelH);
      ctx.fillStyle = state === 'Open' ? '#22c55e' : state === 'Closed' ? '#f97316' : '#ef4444';
      ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(state, 52, y + cellSize / 2 + 4);

      dirs.forEach((dir, col) => {
        const x = 60 + col * cellSize;
        ctx.fillStyle = '#1c2235'; ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        const dc = state === 'Open' ? '#c8956c' : '#8b5e3c';
        const fc = '#5a3a1a';

        if (dir === 'North' || dir === 'South') {
          const fy = y + (dir === 'North' ? 8 : cellSize - 12);
          ctx.fillStyle = fc; ctx.fillRect(x + 8, fy, cellSize - 16, 6);
          ctx.fillStyle = dc; ctx.fillRect(x + 10, fy + 1, cellSize - 20, 4);
          ctx.fillStyle = '#d4a84a'; ctx.fillRect(x + cellSize / 2 + 2, fy + 2, 3, 2);
        } else {
          const fx = x + (dir === 'West' ? 8 : cellSize - 12);
          ctx.fillStyle = fc; ctx.fillRect(fx, y + 8, 6, cellSize - 16);
          ctx.fillStyle = dc; ctx.fillRect(fx + 1, y + 10, 4, cellSize - 20);
          ctx.fillStyle = '#d4a84a'; ctx.fillRect(fx + 2, y + cellSize / 2 + 2, 2, 3);
        }
        if (state === 'Locked') {
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + 12, y + 12); ctx.lineTo(x + cellSize - 12, y + cellSize - 12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + cellSize - 12, y + 12); ctx.lineTo(x + 12, y + cellSize - 12); ctx.stroke();
        } else if (state === 'Closed') { ctx.fillStyle = '#f9731640'; ctx.fillRect(x + 10, y + 10, cellSize - 20, cellSize - 20); }
        else { ctx.fillStyle = '#22c55e30'; ctx.fillRect(x + 10, y + 10, cellSize - 20, cellSize - 20); }
      });
    });
    return canvas.toDataURL('image/png');
  }, { states: ['Open', 'Closed', 'Locked'], dirs: ['North', 'South', 'East', 'West'] });

  fs.writeFileSync(path.join(OUTPUT_DIR, 'spritesheet-doors.png'), Buffer.from(doorDataUrl.split(',')[1], 'base64'));
  console.log(`✓ Doors: 3 × 4`);

  // Cleanup temp file
  fs.unlinkSync(canvasImgPath);

  await composePage.close();
  await browser.close();

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n=== Sprite Sheet Summary ===`);
  files.forEach(f => console.log(`  ${f} (${(fs.statSync(path.join(OUTPUT_DIR, f)).size / 1024).toFixed(1)} KB)`));
  console.log(`Total: ${files.length} sheets`);
})();
