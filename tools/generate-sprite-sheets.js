/**
 * Sprite Sheet Generator — renders every visual asset into categorized PNG sheets.
 * Uses a headless canvas to draw each sprite from the world-renderer.js engine.
 *
 * Categories:
 *   1. Furniture (solid objects: desk, table, bookshelf, couch, etc.)
 *   2. Wall Items (wall-mounted: whiteboard, screen, art-frame, calendar, etc.)
 *   3. Floor Items (freestanding: plant, lamp, fan, trash, rug, etc.)
 *   4. Small Props (surface items: mug, keyboard, headphones, papers, etc.)
 *   5. Agents (all states: active, idle, offline × 4 agent colors)
 *   6. Doors (all states: open, closed, locked × 4 directions)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'poc', 'sprite-sheets');

// Categories based on OBJ_PROPS
const CATEGORIES = {
  'Furniture': ['desk', 'table', 'bookshelf', 'couch', 'server', 'filing', 'vending', 'coffee', 'cooler', 'coatrack', 'potted-tree', 'chair'],
  'Wall Items': ['whiteboard', 'screen', 'bulletin', 'art-frame', 'calendar', 'clock', 'window', 'fire-ext'],
  'Floor Items': ['plant', 'lamp', 'fan', 'trash', 'rug', 'mat'],
  'Small Props': ['monitor', 'keyboard', 'mug', 'papers', 'headphones', 'snack-bowl', 'globe', 'cables'],
};

const AGENT_COLORS = [
  { id: 'claude', name: 'Claude', color: '#f97316' },
  { id: 'copilot', name: 'Copilot', color: '#3b82f6' },
  { id: 'jdai', name: 'JD.AI', color: '#22c55e' },
  { id: 'ralph', name: 'Ralph', color: '#a855f7' },
];

const AGENT_STATUSES = ['active', 'idle', 'offline'];
const DOOR_STATES = ['Open', 'Closed', 'Locked'];
const DOOR_DIRS = ['North', 'South', 'East', 'West'];

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Load the world renderer JS
  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Generate object sprite sheets by category
  for (const [category, types] of Object.entries(CATEGORIES)) {
    const cols = 4;
    const rows = Math.ceil(types.length / cols);
    const cellSize = 64; // 32px sprite + 32px label area
    const labelHeight = 20;
    const sheetW = cols * cellSize;
    const sheetH = rows * (cellSize + labelHeight) + 40; // +40 for title

    const dataUrl = await page.evaluate(({ types, cols, cellSize, labelHeight, sheetW, sheetH, category }) => {
      const canvas = document.createElement('canvas');
      canvas.width = sheetW;
      canvas.height = sheetH;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#111520';
      ctx.fillRect(0, 0, sheetW, sheetH);

      // Title
      ctx.fillStyle = '#eaeff6';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${category} Sprites (${types.length})`, sheetW / 2, 24);

      // Get renderer references
      const mainCanvas = document.getElementById('world-canvas');
      const wd = mainCanvas?._worldData;
      const tint = { r: 1.0, g: 1.0, b: 1.0 }; // neutral tint for sprite sheet

      // Draw each sprite
      types.forEach((type, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellSize;
        const y = 40 + row * (cellSize + labelHeight);

        // Cell background
        ctx.fillStyle = '#1c2235';
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

        // Find an object of this type in the world to get its render
        // Or render it by positioning at (0,0) offset
        const obj = wd?.objects?.find(o => o.type === type);
        if (obj && mainCanvas) {
          // Copy the sprite from the main canvas
          const ts = mainCanvas._tileSize || 32;
          const sx = obj.x * ts, sy = obj.y * ts;
          try {
            const mainCtx = mainCanvas.getContext('2d');
            const imgData = mainCtx.getImageData(sx, sy, ts, ts);
            ctx.putImageData(imgData, x + 16, y + 8);
          } catch (e) {
            // Fallback: colored dot
            ctx.fillStyle = '#f97316';
            ctx.beginPath(); ctx.arc(x + cellSize/2, y + cellSize/2 - 4, 10, 0, Math.PI*2); ctx.fill();
          }
        } else {
          // No instance found — draw placeholder
          ctx.fillStyle = '#525c74';
          ctx.beginPath(); ctx.arc(x + cellSize/2, y + cellSize/2 - 4, 10, 0, Math.PI*2); ctx.fill();
        }

        // Label
        ctx.fillStyle = '#b0b8cc';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(type, x + cellSize / 2, y + cellSize + 12);
      });

      return canvas.toDataURL('image/png');
    }, { types, cols, cellSize, labelHeight, sheetW, sheetH, category });

    const fname = `spritesheet-${category.toLowerCase().replace(/\s+/g, '-')}.png`;
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUTPUT_DIR, fname), buf);
    console.log(`✓ ${category}: ${types.length} sprites → ${fname}`);
  }

  // Generate agent sprite sheet
  const agentDataUrl = await page.evaluate(({ agents, statuses }) => {
    const canvas = document.createElement('canvas');
    const cols = statuses.length;
    const rows = agents.length;
    const cellSize = 64;
    const labelH = 20;
    canvas.width = cols * cellSize + 80; // +80 for row labels
    canvas.height = rows * (cellSize + labelH) + 60;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111520';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eaeff6';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Agent Sprites (${agents.length} × ${statuses.length} states)`, canvas.width / 2, 24);

    // Column headers
    statuses.forEach((s, i) => {
      ctx.fillStyle = '#b0b8cc';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(s, 80 + i * cellSize + cellSize/2, 44);
    });

    // Copy agent sprites from main canvas
    const mainCanvas = document.getElementById('world-canvas');
    const wd = mainCanvas?._worldData;
    const ts = mainCanvas?._tileSize || 32;

    agents.forEach((agent, row) => {
      const y = 52 + row * (cellSize + labelH);
      // Row label
      ctx.fillStyle = agent.color;
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(agent.name, 72, y + cellSize/2 + 4);

      // Find this agent in world data
      const wdAgent = wd?.agents?.find(a => a.id === agent.id);
      statuses.forEach((status, col) => {
        const x = 80 + col * cellSize;
        ctx.fillStyle = '#1c2235';
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

        if (wdAgent && mainCanvas) {
          try {
            const mainCtx = mainCanvas.getContext('2d');
            const sx = wdAgent.x * ts - ts/2, sy = wdAgent.y * ts - ts/2;
            const imgData = mainCtx.getImageData(sx + 2, sy - 10, ts + 12, ts + 20);
            ctx.putImageData(imgData, x + 6, y + 2);
          } catch (e) {
            ctx.fillStyle = agent.color;
            ctx.beginPath(); ctx.arc(x + cellSize/2, y + cellSize/2, 12, 0, Math.PI*2); ctx.fill();
          }
        }

        // Status label
        ctx.fillStyle = status === 'active' ? '#22c55e' : status === 'idle' ? '#eab308' : '#666';
        ctx.font = '8px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(status, x + cellSize/2, y + cellSize + 12);
      });
    });

    return canvas.toDataURL('image/png');
  }, { agents: AGENT_COLORS, statuses: AGENT_STATUSES });

  const agentBuf = Buffer.from(agentDataUrl.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'spritesheet-agents.png'), agentBuf);
  console.log(`✓ Agents: ${AGENT_COLORS.length} × ${AGENT_STATUSES.length} states`);

  // Generate door sprite sheet
  const doorDataUrl = await page.evaluate(({ states, dirs }) => {
    const canvas = document.createElement('canvas');
    const cols = dirs.length;
    const rows = states.length;
    const cellSize = 48;
    const labelH = 16;
    canvas.width = cols * cellSize + 60;
    canvas.height = rows * (cellSize + labelH) + 50;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111520';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eaeff6';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Door Sprites (${states.length} states × ${dirs.length} dirs)`, canvas.width / 2, 24);

    // Column headers
    dirs.forEach((d, i) => {
      ctx.fillStyle = '#b0b8cc';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d, 60 + i * cellSize + cellSize/2, 42);
    });

    states.forEach((state, row) => {
      const y = 48 + row * (cellSize + labelH);
      ctx.fillStyle = state === 'Open' ? '#22c55e' : state === 'Closed' ? '#f97316' : '#ef4444';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(state, 52, y + cellSize/2 + 4);

      dirs.forEach((dir, col) => {
        const x = 60 + col * cellSize;
        ctx.fillStyle = '#1c2235';
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

        // Draw door representation
        const doorColor = state === 'Open' ? '#c8956c' : '#8b5e3c';
        const frameColor = '#5a3a1a';

        if (dir === 'North' || dir === 'South') {
          const fy = y + (dir === 'North' ? 6 : cellSize - 10);
          ctx.fillStyle = frameColor;
          ctx.fillRect(x + 8, fy, cellSize - 16, 6);
          ctx.fillStyle = doorColor;
          ctx.fillRect(x + 10, fy + 1, cellSize - 20, 4);
          ctx.fillStyle = '#d4a84a';
          ctx.fillRect(x + cellSize/2 + 2, fy + 2, 3, 2);
        } else {
          const fx = x + (dir === 'West' ? 6 : cellSize - 10);
          ctx.fillStyle = frameColor;
          ctx.fillRect(fx, y + 8, 6, cellSize - 16);
          ctx.fillStyle = doorColor;
          ctx.fillRect(fx + 1, y + 10, 4, cellSize - 20);
          ctx.fillStyle = '#d4a84a';
          ctx.fillRect(fx + 2, y + cellSize/2 + 2, 2, 3);
        }

        if (state === 'Locked') {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 10, y + 10);
          ctx.lineTo(x + cellSize - 10, y + cellSize - 10);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + cellSize - 10, y + 10);
          ctx.lineTo(x + 10, y + cellSize - 10);
          ctx.stroke();
        } else if (state === 'Closed') {
          ctx.fillStyle = '#f9731640';
          ctx.fillRect(x + 8, y + 8, cellSize - 16, cellSize - 16);
        }
      });
    });

    return canvas.toDataURL('image/png');
  }, { states: DOOR_STATES, dirs: DOOR_DIRS });

  const doorBuf = Buffer.from(doorDataUrl.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'spritesheet-doors.png'), doorBuf);
  console.log(`✓ Doors: ${DOOR_STATES.length} states × ${DOOR_DIRS.length} directions`);

  await browser.close();

  // Summary
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n=== Sprite Sheet Summary ===`);
  files.forEach(f => {
    const size = fs.statSync(path.join(OUTPUT_DIR, f)).size;
    console.log(`  ${f} (${(size / 1024).toFixed(1)} KB)`);
  });
  console.log(`Total: ${files.length} sheets`);
})();
