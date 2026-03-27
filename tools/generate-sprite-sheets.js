/**
 * Sprite Sheet Generator — renders raw sprites on transparent backgrounds.
 * Injects into the Blazor app and calls the world-renderer.js drawing
 * functions directly on isolated transparent canvases.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'poc', 'sprite-sheets');

const CATEGORIES = {
  'Furniture': ['desk', 'table', 'bookshelf', 'couch', 'server', 'filing', 'vending', 'coffee', 'cooler', 'coatrack', 'potted-tree', 'chair'],
  'Multi-Tile': ['lg-bookshelf', 'lg-desk', 'l-desk', 'lg-table', 'lg-whiteboard', 'lg-screen', 'lg-sofa', 'lg-server', 'lg-tree', 'lg-window', 'reception'],
  'Wall Items': ['whiteboard', 'screen', 'bulletin', 'art-frame', 'calendar', 'clock', 'window', 'fire-ext'],
  'Floor Items': ['plant', 'lamp', 'fan', 'trash', 'rug', 'mat'],
  'Small Props': ['monitor', 'keyboard', 'mug', 'papers', 'headphones', 'snack-bowl', 'globe', 'cables'],
};

const AGENTS = [
  { id: 'claude', name: 'Claude', color: '#f97316', status: 'active' },
  { id: 'copilot', name: 'Copilot', color: '#3b82f6', status: 'active' },
  { id: 'jdai', name: 'JD.AI', color: '#22c55e', status: 'idle' },
  { id: 'ralph', name: 'Ralph', color: '#a855f7', status: 'offline' },
];

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Inject a sprite rendering helper that reuses the world-renderer drawing code
  // by rendering each object type on its own transparent 32x32 canvas
  await page.evaluate(() => {
    // Helper: render a single object sprite directly onto a target context at (ox, oy)
    window._renderSpriteAt = function(ctx, type, ox, oy) {
      const tint = { r: 1.0, g: 1.0, b: 1.0 }; // neutral for sprite sheet

      // Material palette (same as renderer)
      function tintColor(hex, t) {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        const tr = Math.max(0, Math.min(255, Math.round(r * t.r)));
        const tg = Math.max(0, Math.min(255, Math.round(g * t.g)));
        const tb = Math.max(0, Math.min(255, Math.round(b * t.b)));
        return '#' + [tr, tg, tb].map(c => c.toString(16).padStart(2, '0')).join('');
      }
      function hex2rgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
      function rgb2hex(r,g,b){return'#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');}
      function drawLitRect(cx, x, y, w, h, color, depth, lightDir) {
        const rgb = hex2rgb(color);
        const brightness = 0.6 + depth * 0.08 + lightDir * 0.15;
        cx.fillStyle = rgb2hex(rgb.r * brightness, rgb.g * brightness, rgb.b * brightness);
        cx.fillRect(x, y, w, h);
      }

      const matPal = {
        wood: tintColor('#8b6914', tint), woodLight: tintColor('#b8960b', tint), woodDark: tintColor('#6b4e1e', tint),
        metal: tintColor('#a0a0a0', tint), screen: tintColor('#1a4a6a', tint), fabric: tintColor('#5a4a7a', tint),
        leaf: tintColor('#4a8a4a', tint), leafDark: tintColor('#2d6a2d', tint),
        pot: tintColor('#8b5e3c', tint), board: tintColor('#e0e0e0', tint),
      };

      const t = type;

      // === OBJECT DRAWING CODE (copied from world-renderer.js) ===
      if (t === 'desk' || t === 'monitor') {
        drawLitRect(ctx, ox+4, oy+6, 24, 12, matPal.wood, 4, 0.8);
        drawLitRect(ctx, ox+5, oy+7, 22, 2, matPal.woodLight, 5, 1.0);
        drawLitRect(ctx, ox+6, oy+18, 3, 8, matPal.woodDark, 2, 0.5);
        drawLitRect(ctx, ox+23, oy+18, 3, 8, matPal.woodDark, 2, 0.5);
        drawLitRect(ctx, ox+10, oy+1, 12, 6, matPal.metal, 6, 0.9);
        drawLitRect(ctx, ox+11, oy+2, 10, 4, matPal.screen, 6.5, 0.7);
        drawLitRect(ctx, ox+15, oy+7, 2, 2, matPal.metal, 5, 0.8);
      } else if (t === 'chair') {
        drawLitRect(ctx, ox+9, oy+10, 14, 8, matPal.fabric, 3, 0.7);
        drawLitRect(ctx, ox+11, oy+4, 10, 7, matPal.fabric, 5, 0.9);
        drawLitRect(ctx, ox+10, oy+18, 2, 6, matPal.metal, 1, 0.5);
        drawLitRect(ctx, ox+20, oy+18, 2, 6, matPal.metal, 1, 0.5);
      } else if (t === 'whiteboard') {
        drawLitRect(ctx, ox+3, oy+2, 26, 14, matPal.board, 5, 0.9);
        drawLitRect(ctx, ox+3, oy+2, 26, 2, matPal.metal, 6, 1.0);
        drawLitRect(ctx, ox+3, oy+14, 26, 2, matPal.metal, 6, 1.0);
        ctx.fillStyle = '#33333380'; ctx.fillRect(ox+8, oy+6, 10, 1);
        ctx.fillStyle = '#e76f5180'; ctx.fillRect(ox+10, oy+9, 14, 1);
        drawLitRect(ctx, ox+14, oy+16, 2, 6, matPal.metal, 2, 0.6);
        drawLitRect(ctx, ox+17, oy+16, 2, 6, matPal.metal, 2, 0.6);
      } else if (t === 'bookshelf') {
        const bookColors = ['#cc4444','#44aa44','#4444cc','#ccaa44','#aa44aa','#44aaaa'];
        drawLitRect(ctx, ox+3, oy+1, 22, 20, matPal.wood, 2, 0.7);
        for (let row = 0; row < 4; row++) {
          drawLitRect(ctx, ox+3, oy+1+row*5, 22, 1, matPal.woodLight, 3, 0.9);
          for (let bx = 0; bx < 10; bx++) {
            const bc = bookColors[(bx + row * 3) % bookColors.length];
            drawLitRect(ctx, ox+4+bx*2, oy+2+row*5, 2, 4, tintColor(bc, tint), 4, 0.8);
          }
        }
      } else if (t === 'plant') {
        drawLitRect(ctx, ox+11, oy+20, 10, 8, matPal.pot, 3, 0.7);
        drawLitRect(ctx, ox+10, oy+20, 12, 2, tintColor('#a07050', tint), 4, 0.9);
        drawLitRect(ctx, ox+15, oy+14, 2, 6, tintColor('#3a5a2a', tint), 2, 0.6);
        for (const [lx,ly] of [[13,10],[18,8],[11,7],[16,5],[20,9],[15,3]]) {
          ctx.fillStyle = matPal.leaf; ctx.beginPath(); ctx.arc(ox+lx, oy+ly, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = matPal.leafDark; ctx.beginPath(); ctx.arc(ox+lx, oy+ly, 1.5, 0, Math.PI*2); ctx.fill();
        }
      } else if (t === 'couch') {
        drawLitRect(ctx, ox+4, oy+6, 24, 14, matPal.fabric, 3, 0.7);
        drawLitRect(ctx, ox+4, oy+6, 24, 3, matPal.fabric, 5, 0.9);
        drawLitRect(ctx, ox+3, oy+6, 2, 10, matPal.fabric, 5, 0.8);
        drawLitRect(ctx, ox+27, oy+6, 2, 10, matPal.fabric, 5, 0.8);
        drawLitRect(ctx, ox+15, oy+10, 2, 8, matPal.woodDark, 2, 0.5);
      } else if (t === 'lamp') {
        ctx.fillStyle = tintColor('#e9c46a', tint);
        ctx.beginPath(); ctx.arc(ox+16, oy+6, 6, Math.PI, 0); ctx.fill();
        drawLitRect(ctx, ox+15, oy+6, 2, 14, matPal.metal, 2, 0.6);
        drawLitRect(ctx, ox+12, oy+20, 8, 3, matPal.metal, 1, 0.5);
        ctx.fillStyle = '#ffee8820'; ctx.beginPath(); ctx.arc(ox+16, oy+8, 10, 0, Math.PI*2); ctx.fill();
      } else if (t === 'coffee' || t === 'cooler' || t === 'vending') {
        drawLitRect(ctx, ox+8, oy+4, 16, 22, matPal.metal, 4, 0.8);
        drawLitRect(ctx, ox+10, oy+6, 12, 8, tintColor('#334', tint), 5, 0.6);
        drawLitRect(ctx, ox+10, oy+16, 12, 6, matPal.metal, 3, 0.5);
        if (t === 'vending') { ctx.fillStyle = tintColor('#22c55e', tint); ctx.fillRect(ox+12, oy+8, 2, 2); }
      } else if (t === 'mug') {
        drawLitRect(ctx, ox+12, oy+12, 8, 8, tintColor('#ddd', tint), 3, 0.8);
        drawLitRect(ctx, ox+20, oy+14, 3, 4, tintColor('#ccc', tint), 2, 0.6);
        ctx.fillStyle = tintColor('#654', tint); ctx.fillRect(ox+13, oy+13, 6, 5);
      } else if (t === 'cables') {
        ctx.strokeStyle = tintColor('#444', tint); ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(ox+8+i*5, oy+10); ctx.bezierCurveTo(ox+6+i*4, oy+20, ox+14+i*3, oy+22, ox+10+i*5, oy+28); ctx.stroke(); }
      } else if (t === 'clock') {
        ctx.fillStyle = tintColor('#fff', tint); ctx.beginPath(); ctx.arc(ox+16, oy+10, 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox+16, oy+10, 6, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox+16, oy+10); ctx.lineTo(ox+16, oy+6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox+16, oy+10); ctx.lineTo(ox+19, oy+10); ctx.stroke();
      } else if (t === 'screen') {
        drawLitRect(ctx, ox+4, oy+4, 24, 16, matPal.metal, 5, 0.9);
        drawLitRect(ctx, ox+6, oy+6, 20, 12, tintColor('#1a3050', tint), 5.5, 0.7);
        drawLitRect(ctx, ox+14, oy+20, 4, 4, matPal.metal, 3, 0.6);
        drawLitRect(ctx, ox+10, oy+24, 12, 2, matPal.metal, 2, 0.5);
      } else if (t === 'bulletin') {
        drawLitRect(ctx, ox+4, oy+4, 24, 18, tintColor('#8b6914', tint), 4, 0.7);
        const noteColors = ['#f87171','#60a5fa','#facc15','#34d399','#c084fc'];
        for (let i = 0; i < 5; i++) { ctx.fillStyle = tintColor(noteColors[i], tint); ctx.fillRect(ox+6+i*4, oy+6+(i%3)*4, 3, 3); }
      } else if (t === 'papers') {
        ctx.fillStyle = tintColor('#e8e0d0', tint); ctx.fillRect(ox+10, oy+12, 8, 10); ctx.fillRect(ox+12, oy+10, 8, 10);
        ctx.fillStyle = tintColor('#999', tint); for (let i = 0; i < 3; i++) ctx.fillRect(ox+12, oy+14+i*3, 6, 1);
      } else if (t === 'globe') {
        ctx.fillStyle = tintColor('#3b82f6', tint); ctx.beginPath(); ctx.arc(ox+16, oy+12, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tintColor('#22c55e', tint); ctx.fillRect(ox+12, oy+9, 4, 3); ctx.fillRect(ox+17, oy+12, 3, 2);
        drawLitRect(ctx, ox+14, oy+20, 4, 6, matPal.woodDark, 2, 0.5);
      } else if (t === 'rug') {
        const rugColor = tintColor('#8b4513', tint);
        ctx.fillStyle = rugColor + '80'; ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 14, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = rugColor + 'a0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 14, 10, 0, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 10, 7, 0, 0, Math.PI*2); ctx.stroke();
      } else if (t === 'mat') {
        ctx.fillStyle = tintColor('#555', tint) + '80'; ctx.fillRect(ox+6, oy+10, 20, 12);
      } else if (t === 'table') {
        drawLitRect(ctx, ox+6, oy+8, 20, 14, matPal.wood, 3, 0.8);
        drawLitRect(ctx, ox+7, oy+9, 18, 2, matPal.woodLight, 4, 1.0);
        drawLitRect(ctx, ox+8, oy+22, 3, 6, matPal.woodDark, 1, 0.5);
        drawLitRect(ctx, ox+21, oy+22, 3, 6, matPal.woodDark, 1, 0.5);
      } else if (t === 'trash') {
        drawLitRect(ctx, ox+10, oy+10, 12, 14, tintColor('#555', tint), 3, 0.6);
        drawLitRect(ctx, ox+11, oy+11, 10, 2, tintColor('#666', tint), 3.5, 0.7);
        ctx.fillStyle = tintColor('#888', tint); ctx.fillRect(ox+13, oy+8, 6, 3);
      } else if (t === 'coatrack') {
        drawLitRect(ctx, ox+15, oy+4, 2, 20, matPal.woodDark, 2, 0.6);
        drawLitRect(ctx, ox+10, oy+24, 12, 3, matPal.woodDark, 1, 0.5);
        ctx.fillStyle = tintColor('#4a6', tint); ctx.fillRect(ox+10, oy+6, 5, 8);
        ctx.fillStyle = matPal.metal; ctx.fillRect(ox+12, oy+5, 2, 2); ctx.fillRect(ox+18, oy+5, 2, 2);
      } else if (t === 'server') {
        drawLitRect(ctx, ox+6, oy+2, 20, 26, tintColor('#333', tint), 4, 0.6);
        drawLitRect(ctx, ox+8, oy+4, 16, 5, tintColor('#222', tint), 5, 0.5);
        drawLitRect(ctx, ox+8, oy+11, 16, 5, tintColor('#222', tint), 5, 0.5);
        drawLitRect(ctx, ox+8, oy+18, 16, 5, tintColor('#222', tint), 5, 0.5);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(ox+10, oy+5, 2, 2);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(ox+10, oy+12, 2, 2);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(ox+10, oy+19, 2, 2);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(ox+14, oy+12, 2, 2);
      } else if (t === 'filing') {
        drawLitRect(ctx, ox+8, oy+4, 16, 22, matPal.metal, 4, 0.7);
        drawLitRect(ctx, ox+9, oy+5, 14, 6, tintColor('#888', tint), 4.5, 0.6);
        drawLitRect(ctx, ox+9, oy+13, 14, 6, tintColor('#888', tint), 4.5, 0.6);
        drawLitRect(ctx, ox+9, oy+21, 14, 4, tintColor('#888', tint), 4.5, 0.6);
        ctx.fillStyle = tintColor('#ccc', tint);
        ctx.fillRect(ox+15, oy+7, 3, 1); ctx.fillRect(ox+15, oy+15, 3, 1); ctx.fillRect(ox+15, oy+23, 3, 1);
      } else if (t === 'potted-tree') {
        drawLitRect(ctx, ox+12, oy+22, 8, 6, matPal.pot, 3, 0.7);
        drawLitRect(ctx, ox+15, oy+12, 2, 10, tintColor('#5a3a1a', tint), 2, 0.6);
        for (const [lx,ly,sz] of [[12,4,5],[18,3,4],[10,8,4],[20,6,3],[15,1,5],[16,7,4]]) {
          ctx.fillStyle = matPal.leaf; ctx.beginPath(); ctx.arc(ox+lx, oy+ly, sz, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = matPal.leafDark; ctx.beginPath(); ctx.arc(ox+lx+1, oy+ly+1, sz*0.5, 0, Math.PI*2); ctx.fill();
        }
      } else if (t === 'art-frame') {
        drawLitRect(ctx, ox+6, oy+4, 20, 16, tintColor('#3a2a1a', tint), 4, 0.7);
        drawLitRect(ctx, ox+8, oy+6, 16, 12, tintColor('#87ceeb', tint), 5, 0.9);
        ctx.fillStyle = tintColor('#e76f51', tint) + '80'; ctx.fillRect(ox+10, oy+8, 6, 4);
        ctx.fillStyle = tintColor('#2a9d8f', tint) + '80'; ctx.fillRect(ox+16, oy+10, 5, 6);
        ctx.fillStyle = tintColor('#e9c46a', tint) + '60'; ctx.fillRect(ox+11, oy+13, 8, 3);
      } else if (t === 'fan') {
        ctx.fillStyle = matPal.metal; ctx.beginPath(); ctx.arc(ox+16, oy+10, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tintColor('#666', tint); ctx.beginPath(); ctx.arc(ox+16, oy+10, 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = tintColor('#bbb', tint); ctx.lineWidth = 2;
        for (let a = 0; a < 3; a++) { const angle = a * Math.PI * 2 / 3; ctx.beginPath(); ctx.moveTo(ox+16, oy+10); ctx.lineTo(ox+16+Math.cos(angle)*5, oy+10+Math.sin(angle)*5); ctx.stroke(); }
        drawLitRect(ctx, ox+14, oy+18, 4, 8, matPal.metal, 2, 0.6);
      } else if (t === 'headphones') {
        ctx.strokeStyle = tintColor('#333', tint); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox+16, oy+14, 6, Math.PI, 0); ctx.stroke();
        drawLitRect(ctx, ox+10, oy+14, 4, 6, tintColor('#444', tint), 3, 0.6);
        drawLitRect(ctx, ox+18, oy+14, 4, 6, tintColor('#444', tint), 3, 0.6);
        ctx.fillStyle = tintColor('#666', tint); ctx.fillRect(ox+10, oy+15, 4, 4); ctx.fillRect(ox+18, oy+15, 4, 4);
      } else if (t === 'keyboard') {
        drawLitRect(ctx, ox+6, oy+14, 20, 6, tintColor('#333', tint), 3, 0.7);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) { ctx.fillStyle = tintColor('#555', tint); ctx.fillRect(ox+8+col*2, oy+15+row*2, 1, 1); }
        ctx.fillStyle = tintColor('#555', tint); ctx.fillRect(ox+12, oy+19, 8, 1);
      } else if (t === 'snack-bowl') {
        ctx.fillStyle = tintColor('#ddd', tint); ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 7, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tintColor('#ccc', tint); ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 5, 3, 0, 0, Math.PI*2); ctx.fill();
        const sc = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6'];
        for (let i = 0; i < 4; i++) { ctx.fillStyle = tintColor(sc[i], tint); ctx.fillRect(ox+13+i*2, oy+15, 1, 1); }
      } else if (t === 'window') {
        drawLitRect(ctx, ox+4, oy+4, 24, 18, tintColor('#1a3050', tint), 5, 0.8);
        drawLitRect(ctx, ox+6, oy+6, 20, 14, tintColor('#87ceeb', tint), 6, 1.0);
        ctx.fillStyle = tintColor('#aaddff', tint) + '40'; ctx.fillRect(ox+6, oy+6, 9, 6); ctx.fillRect(ox+17, oy+6, 9, 6);
        ctx.fillStyle = tintColor('#555', tint); ctx.fillRect(ox+15, oy+6, 2, 14); ctx.fillRect(ox+6, oy+12, 20, 2);
      } else if (t === 'fire-ext') {
        drawLitRect(ctx, ox+13, oy+6, 6, 16, tintColor('#cc2222', tint), 4, 0.8);
        drawLitRect(ctx, ox+14, oy+4, 4, 3, tintColor('#888', tint), 5, 0.9);
        drawLitRect(ctx, ox+12, oy+4, 2, 4, tintColor('#666', tint), 3, 0.6);
        ctx.fillStyle = '#fff'; ctx.fillRect(ox+14, oy+10, 4, 3);
      } else if (t === 'calendar') {
        drawLitRect(ctx, ox+8, oy+4, 16, 18, tintColor('#fff', tint), 5, 0.9);
        drawLitRect(ctx, ox+8, oy+4, 16, 4, tintColor('#ef4444', tint), 5.5, 0.8);
        ctx.fillStyle = tintColor('#ddd', tint);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) ctx.fillRect(ox+10+col*3, oy+10+row*2, 2, 1);
      }

    };
  });

  // Generate categorized sheets with transparent sprites
  for (const [category, types] of Object.entries(CATEGORIES)) {
    const cols = Math.min(6, types.length);
    const rows = Math.ceil(types.length / cols);
    const ts = 32;
    const pad = 8;
    const labelH = 16;
    const cellW = ts + pad * 2;
    const cellH = ts + pad + labelH;
    const sheetW = cols * cellW + pad;
    const sheetH = rows * cellH + 36;

    const dataUrl = await page.evaluate(({ types, cols, cellW, cellH, sheetW, sheetH, category, ts, pad, labelH }) => {
      const sheet = document.createElement('canvas');
      sheet.width = sheetW;
      sheet.height = sheetH;
      const ctx = sheet.getContext('2d');

      // Transparent background — but add subtle checkerboard so transparency is visible
      for (let y = 0; y < sheetH; y += 8) {
        for (let x = 0; x < sheetW; x += 8) {
          ctx.fillStyle = ((x + y) / 8) % 2 === 0 ? '#18192200' : '#1c1d2800';
        }
      }

      // Title
      ctx.fillStyle = '#eaeff6';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${category} (${types.length})`, sheetW / 2, 20);

      types.forEach((type, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dx = pad / 2 + col * cellW;
        const dy = 30 + row * cellH;

        // Render sprite directly onto sheet at offset
        window._renderSpriteAt(ctx, type, dx + pad, dy);

        // Label
        ctx.fillStyle = '#b0b8cc';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(type, dx + cellW / 2, dy + ts + labelH - 2);
      });

      return sheet.toDataURL('image/png');
    }, { types, cols, cellW, cellH, sheetW, sheetH, category, ts, pad, labelH });

    const fname = `spritesheet-${category.toLowerCase().replace(/\s+/g, '-')}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, fname), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`✓ ${category}: ${types.length} sprites → ${fname}`);
  }

  // Agent sheet — render agents directly with transparent bg
  const agentDataUrl = await page.evaluate(({ agents }) => {
    const ts = 48; // larger for agent detail
    const cellW = ts + 16;
    const cellH = ts + 24;
    const canvas = document.createElement('canvas');
    canvas.width = agents.length * cellW + 8;
    canvas.height = cellH + 36;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#eaeff6';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Agents (${agents.length})`, canvas.width / 2, 18);

    function hex2rgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
    function rgb2hex(r,g,b){return'#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');}
    function shade(hex, f) { const rgb = hex2rgb(hex); return rgb2hex(rgb.r*f, rgb.g*f, rgb.b*f); }
    function drawLitRect(cx, x, y, w, h, color, depth, lightDir) {
      const rgb = hex2rgb(color); const brightness = 0.6 + depth * 0.08 + lightDir * 0.15;
      cx.fillStyle = rgb2hex(rgb.r * brightness, rgb.g * brightness, rgb.b * brightness);
      cx.fillRect(x, y, w, h);
    }

    agents.forEach((agent, i) => {
      const dx = 4 + i * cellW + cellW / 2;
      const dy = 42;
      const c = agent.color;
      const cD = shade(c, 0.55), cL = shade(c, 1.35);
      const skin = '#ffd5a0', skinS = '#d4a870', skinH = '#ffe8c8';
      const ax = dx, ay = dy;

      // Shadow
      ctx.fillStyle = '#00000030'; ctx.beginPath(); ctx.ellipse(ax, ay + 15, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Outline
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ax, ay - 6, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ax, ay + 6, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
      // Hair
      ctx.beginPath(); ctx.arc(ax, ay - 6, 10, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(ax, ay - 9, 8, Math.PI + 0.3, -0.3); ctx.fillStyle = cL; ctx.fill();
      ctx.beginPath(); ctx.arc(ax, ay - 3, 9, 0.3, Math.PI - 0.3); ctx.fillStyle = cD; ctx.fill();
      // Face
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(ax, ay - 4, 7, 0.2, Math.PI - 0.2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff'; ctx.fillRect(ax - 5, ay - 6, 4, 3); ctx.fillRect(ax + 2, ay - 6, 4, 3);
      ctx.fillStyle = '#4488cc'; ctx.fillRect(ax - 4, ay - 5, 2, 2); ctx.fillRect(ax + 3, ay - 5, 2, 2);
      ctx.fillStyle = '#111'; ctx.fillRect(ax - 4, ay - 5, 1, 1); ctx.fillRect(ax + 3, ay - 5, 1, 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(ax - 3, ay - 6, 1, 1); ctx.fillRect(ax + 4, ay - 6, 1, 1);
      // Body
      ctx.beginPath(); ctx.ellipse(ax, ay + 6, 8, 8, 0, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      drawLitRect(ctx, ax - 7, ay + 2, 4, 10, cD, 4, 0.5);
      drawLitRect(ctx, ax + 4, ay + 2, 4, 10, cD, 4, 0.5);
      drawLitRect(ctx, ax - 3, ay + 2, 6, 6, cL, 5, 1.0);
      // Collar
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - 2, ay - 1, 5, 2);
      // Arms
      drawLitRect(ctx, ax - 12, ay + 1, 5, 10, c, 4, 0.7);
      drawLitRect(ctx, ax + 8, ay + 1, 5, 10, c, 4, 0.7);
      // Hands
      drawLitRect(ctx, ax - 11, ay + 11, 4, 3, skin, 3, 0.7);
      drawLitRect(ctx, ax + 8, ay + 11, 4, 3, skin, 3, 0.7);
      // Legs
      drawLitRect(ctx, ax - 5, ay + 13, 4, 5, '#2a2a40', 4, 0.7);
      drawLitRect(ctx, ax + 2, ay + 13, 4, 5, '#2a2a40', 4, 0.7);
      // Shoes
      drawLitRect(ctx, ax - 6, ay + 18, 5, 2, '#1a1a1a', 2, 0.5);
      drawLitRect(ctx, ax + 2, ay + 18, 5, 2, '#1a1a1a', 2, 0.5);

      // Name
      ctx.fillStyle = agent.color;
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, dx, dy + 28);
    });

    return canvas.toDataURL('image/png');
  }, { agents: AGENTS });

  fs.writeFileSync(path.join(OUTPUT_DIR, 'spritesheet-agents.png'), Buffer.from(agentDataUrl.split(',')[1], 'base64'));
  console.log(`✓ Agents: ${AGENTS.length}`);

  // Door sheet (already renders directly — keep as-is from previous version)
  const doorDataUrl = await page.evaluate(() => {
    const states = ['Open', 'Closed', 'Locked'];
    const dirs = ['North', 'South', 'East', 'West'];
    const cs = 48, lh = 16;
    const canvas = document.createElement('canvas');
    canvas.width = dirs.length * cs + 60; canvas.height = states.length * (cs + lh) + 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eaeff6'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`Doors (${states.length} × ${dirs.length})`, canvas.width / 2, 20);
    dirs.forEach((d, i) => { ctx.fillStyle = '#b0b8cc'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(d, 60 + i * cs + cs / 2, 38); });
    states.forEach((state, row) => {
      const y = 44 + row * (cs + lh);
      ctx.fillStyle = state === 'Open' ? '#22c55e' : state === 'Closed' ? '#f97316' : '#ef4444';
      ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'right'; ctx.fillText(state, 52, y + cs / 2 + 4);
      dirs.forEach((dir, col) => {
        const x = 60 + col * cs;
        const dc = state === 'Open' ? '#c8956c' : '#8b5e3c', fc = '#5a3a1a';
        if (dir === 'North' || dir === 'South') {
          const fy = y + (dir === 'North' ? 8 : cs - 12);
          ctx.fillStyle = fc; ctx.fillRect(x + 8, fy, cs - 16, 6);
          ctx.fillStyle = dc; ctx.fillRect(x + 10, fy + 1, cs - 20, 4);
          ctx.fillStyle = '#d4a84a'; ctx.fillRect(x + cs / 2 + 2, fy + 2, 3, 2);
        } else {
          const fx = x + (dir === 'West' ? 8 : cs - 12);
          ctx.fillStyle = fc; ctx.fillRect(fx, y + 8, 6, cs - 16);
          ctx.fillStyle = dc; ctx.fillRect(fx + 1, y + 10, 4, cs - 20);
          ctx.fillStyle = '#d4a84a'; ctx.fillRect(fx + 2, y + cs / 2 + 2, 2, 3);
        }
        if (state === 'Locked') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x+12,y+12); ctx.lineTo(x+cs-12,y+cs-12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+cs-12,y+12); ctx.lineTo(x+12,y+cs-12); ctx.stroke(); }
        else if (state === 'Closed') { ctx.fillStyle = '#f9731640'; ctx.fillRect(x+10,y+10,cs-20,cs-20); }
        else { ctx.fillStyle = '#22c55e30'; ctx.fillRect(x+10,y+10,cs-20,cs-20); }
      });
    });
    return canvas.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'spritesheet-doors.png'), Buffer.from(doorDataUrl.split(',')[1], 'base64'));
  console.log(`✓ Doors: 3 × 4`);

  await browser.close();
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n=== Sprite Sheet Summary ===`);
  files.forEach(f => console.log(`  ${f} (${(fs.statSync(path.join(OUTPUT_DIR, f)).size / 1024).toFixed(1)} KB)`));
})();
