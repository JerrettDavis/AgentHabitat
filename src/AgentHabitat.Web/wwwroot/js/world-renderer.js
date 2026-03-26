/**
 * Canvas-based world renderer for Blazor JS interop.
 * Receives WorldRenderData from C# and draws to a canvas element.
 * Includes theme-specific lighting and interactive room click.
 */

// Theme lighting tints
// Theme lighting tints
const THEME_TINTS = {
  'retro-office': { r: 1.1, g: 1.0, b: 0.9 },
  'forest-lab':   { r: 0.9, g: 1.1, b: 0.95 },
  'neon-hq':      { r: 0.9, g: 0.9, b: 1.15 },
};

// Apply theme tint to a hex color
function tintColor(hex, tint) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const tr = Math.max(0, Math.min(255, Math.round(r * tint.r)));
  const tg = Math.max(0, Math.min(255, Math.round(g * tint.g)));
  const tb = Math.max(0, Math.min(255, Math.round(b * tint.b)));
  return '#' + [tr, tg, tb].map(c => c.toString(16).padStart(2, '0')).join('');
}

// Simple per-tile lighting based on position (simulates directional light)
function tileLighting(x, y, w, h) {
  // Top-left is brighter, bottom-right is darker
  const nx = x / w, ny = y / h;
  return 0.85 + (1 - nx) * 0.15 + (1 - ny) * 0.1;
}

const PALETTES = {
  'retro-office': {
    void: '#0d1117', corridor: '#1a2332', roomFloor: '#243447',
    rooms: { CodingRoom: '#1e3a5f', ReviewRoom: '#2d4a2e', Library: '#4a3728', Lounge: '#3d2c4a', PrivateOffice: '#2a3a4a' },
    wall: '#16213e', accent: '#e76f51', label: '#8ecae6',
  },
  'forest-lab': {
    void: '#081a0a', corridor: '#1a3820', roomFloor: '#2d5a32',
    rooms: { CodingRoom: '#1e5a35', ReviewRoom: '#2a6a3a', Library: '#5a4020', Lounge: '#3a5a2a', PrivateOffice: '#2a4a30' },
    wall: '#1a3a1e', accent: '#ee6c4d', label: '#c0e8d0',
  },
  'neon-hq': {
    void: '#05050f', corridor: '#1a1038', roomFloor: '#2a1a4e',
    rooms: { CodingRoom: '#3a1a6f', ReviewRoom: '#1a3a6f', Library: '#5a2a1f', Lounge: '#2a4a5f', PrivateOffice: '#2a2a4f' },
    wall: '#1a0a2e', accent: '#f472b6', label: '#c084fc',
  },
};

// Object property registry — defines physical behavior per type
const OBJ_PROPS = {
  // Solid furniture (blocks walking)
  'desk':       { solid: true,  surface: true,  wallMount: false, placement: 'floor' },
  'table':      { solid: true,  surface: true,  wallMount: false, placement: 'floor' },
  'bookshelf':  { solid: true,  surface: false, wallMount: true,  placement: 'wall' },
  'couch':      { solid: true,  surface: false, wallMount: false, placement: 'floor' },
  'server':     { solid: true,  surface: false, wallMount: true,  placement: 'wall' },
  'filing':     { solid: true,  surface: false, wallMount: true,  placement: 'wall' },
  'vending':    { solid: true,  surface: false, wallMount: true,  placement: 'wall' },
  'coffee':     { solid: true,  surface: true,  wallMount: false, placement: 'floor' },
  'cooler':     { solid: true,  surface: false, wallMount: false, placement: 'floor' },
  'coatrack':   { solid: true,  surface: false, wallMount: false, placement: 'floor' },

  // Wall-mounted (blocks walking, must be on wall)
  'whiteboard': { solid: true,  surface: false, wallMount: true,  placement: 'wall' },
  'screen':     { solid: true,  surface: false, wallMount: true,  placement: 'wall' },
  'bulletin':   { solid: false, surface: false, wallMount: true,  placement: 'wall' },
  'art-frame':  { solid: false, surface: false, wallMount: true,  placement: 'wall' },
  'calendar':   { solid: false, surface: false, wallMount: true,  placement: 'wall' },
  'clock':      { solid: false, surface: false, wallMount: true,  placement: 'wall' },
  'window':     { solid: false, surface: false, wallMount: true,  placement: 'wall' },
  'fire-ext':   { solid: false, surface: false, wallMount: true,  placement: 'wall' },

  // Small props (can be placed on surfaces)
  'monitor':    { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'keyboard':   { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'mug':        { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'papers':     { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'headphones': { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'snack-bowl': { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'globe':      { solid: false, surface: false, wallMount: false, placement: 'surface' },
  'cables':     { solid: false, surface: false, wallMount: false, placement: 'floor' },

  // Seating (solid but walkable-adjacent)
  'chair':      { solid: true,  surface: false, wallMount: false, placement: 'floor' },

  // Floor items (freestanding, don't block)
  'plant':      { solid: false, surface: false, wallMount: false, placement: 'floor' },
  'potted-tree':{ solid: true,  surface: false, wallMount: false, placement: 'floor' },
  'lamp':       { solid: false, surface: false, wallMount: false, placement: 'floor' },
  'fan':        { solid: false, surface: false, wallMount: false, placement: 'floor' },
  'trash':      { solid: false, surface: false, wallMount: false, placement: 'floor' },
  'rug':        { solid: false, surface: false, wallMount: false, placement: 'floor' },
  'mat':        { solid: false, surface: false, wallMount: false, placement: 'floor' },
};

function getObjProps(type) {
  return OBJ_PROPS[type] || { solid: false, surface: false, wallMount: false, placement: 'floor' };
}

window.WorldRenderer = {
  render: function (canvasId, worldData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pal = PALETTES[worldData.style] || PALETTES['retro-office'];
    const tint = THEME_TINTS[worldData.style] || THEME_TINTS['retro-office'];
    const tileSize = 32;
    const W = worldData.width, H = worldData.height;

    canvas.width = W * tileSize;
    canvas.height = H * tileSize;

    // Draw tiles with theme-tinted lighting
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = worldData.tiles[y * W + x];
        const px = x * tileSize, py = y * tileSize;
        const light = tileLighting(x, y, W, H);
        const litTint = { r: tint.r * light, g: tint.g * light, b: tint.b * light };

        const room = tile === 2 ? worldData.rooms.find(r =>
          x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
        ) : null;

        if (tile === 0) {
          ctx.fillStyle = tintColor(pal.void, litTint);
        } else if (tile === 1) {
          ctx.fillStyle = tintColor(pal.corridor, litTint);
        } else {
          const baseColor = room ? (pal.rooms[room.archetype] || pal.roomFloor) : pal.roomFloor;
          ctx.fillStyle = tintColor(baseColor, litTint);
        }
        ctx.fillRect(px, py, tileSize, tileSize);

        // Floor patterns per archetype
        if (tile === 2 && room) {
          if (room.archetype === 'CodingRoom') {
            ctx.fillStyle = '#ffffff05';
            ctx.fillRect(px + 1, py + 1, tileSize - 2, 1);
            ctx.fillRect(px + 1, py + 1, 1, tileSize - 2);
          } else if (room.archetype === 'ReviewRoom') {
            if ((x + y) % 2 === 0) { ctx.fillStyle = '#ffffff04'; ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4); }
          } else if (room.archetype === 'Library') {
            ctx.fillStyle = '#ffffff06';
            ctx.fillRect(px, py + (y % 3) * 10, tileSize, 2);
          } else {
            if ((x * 3 + y * 7) % 5 === 0) { ctx.fillStyle = '#ffffff03'; ctx.fillRect(px + 6, py + 6, 4, 4); }
          }
        } else if (tile > 0) {
          ctx.fillStyle = '#ffffff04';
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    // Room drop shadows (drawn first, behind everything)
    for (const room of worldData.rooms) {
      const rx = room.x * tileSize, ry = room.y * tileSize;
      const rw = room.width * tileSize, rh = room.height * tileSize;
      ctx.fillStyle = '#00000040';
      ctx.fillRect(rx + 5, ry + 5, rw, rh);
    }

    // Room borders (strong walls with inner highlight)
    for (const room of worldData.rooms) {
      const rx = room.x * tileSize, ry = room.y * tileSize;
      const rw = room.width * tileSize, rh = room.height * tileSize;

      // Outer black wall
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
      // Inner wall color
      ctx.strokeStyle = pal.wall;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 3, ry + 3, rw - 6, rh - 6);
      // Inner accent glow
      ctx.strokeStyle = pal.accent + '15';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 5, ry + 5, rw - 10, rh - 10);

      // Corner accents
      const cs = 5;
      ctx.fillStyle = pal.accent + '40';
      ctx.fillRect(rx + 2, ry + 2, cs, cs);
      ctx.fillRect(rx + rw - cs - 2, ry + 2, cs, cs);
      ctx.fillRect(rx + 2, ry + rh - cs - 2, cs, cs);
      ctx.fillRect(rx + rw - cs - 2, ry + rh - cs - 2, cs, cs);

      // Label with background pill
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      // Private offices show agent name, shared rooms show archetype
      const isOffice = room.archetype === 'PrivateOffice';
      const officeOwner = isOffice ? (worldData.agents || []).find(a => room.id === `office-${a.id}`) : null;
      const labelText = officeOwner ? `${officeOwner.name}'s Office` : room.archetype.replace('Room', ' Room');
      const tm = ctx.measureText(labelText);
      const lx = rx + rw / 2, ly = ry + 14;
      ctx.fillStyle = '#00000070';
      ctx.beginPath();
      ctx.roundRect(lx - tm.width / 2 - 6, ly - 10, tm.width + 12, 18, 4);
      ctx.fill();
      ctx.fillStyle = pal.label;
      ctx.fillText(labelText, lx, ly + 2);
    }

    // Doors (rendered as openings in walls with door frame)
    for (const door of (worldData.doors || [])) {
      const dx = door.x * tileSize, dy = door.y * tileSize;
      const isOpen = (door.state || 'Open') === 'Open';
      const doorColor = isOpen ? tintColor('#c8956c', tint) : tintColor('#8b5e3c', tint);
      const frameColor = tintColor('#5a3a1a', tint);

      // Clear the wall segment where the door sits
      const room = worldData.rooms.find(r => r.id === door.roomId);
      if (room) {
        const baseColor = pal.rooms[room.archetype] || pal.roomFloor;
        const light = tileLighting(door.x, door.y, W, H);
        const litTint = { r: tint.r * light, g: tint.g * light, b: tint.b * light };
        ctx.fillStyle = tintColor(baseColor, litTint);
        ctx.fillRect(dx, dy, tileSize, tileSize);
      }

      if (door.direction === 'North' || door.direction === 'South') {
        // Horizontal door — spans tile width
        const frameY = door.direction === 'North' ? dy : dy + tileSize - 4;
        // Door frame (top/bottom rail)
        ctx.fillStyle = frameColor;
        ctx.fillRect(dx + 4, frameY, tileSize - 8, 4);
        // Door panel
        ctx.fillStyle = doorColor;
        ctx.fillRect(dx + 6, frameY + 1, tileSize - 12, 2);
        // Handle
        ctx.fillStyle = tintColor('#d4a84a', tint);
        ctx.fillRect(dx + tileSize / 2 + 2, frameY + 1, 2, 2);
        // Open indicator
        if (isOpen) {
          ctx.fillStyle = '#22c55e40';
          ctx.fillRect(dx + 8, frameY, tileSize - 16, 4);
        }
      } else {
        // Vertical door — spans tile height
        const frameX = door.direction === 'West' ? dx : dx + tileSize - 4;
        // Door frame (left/right rail)
        ctx.fillStyle = frameColor;
        ctx.fillRect(frameX, dy + 4, 4, tileSize - 8);
        // Door panel
        ctx.fillStyle = doorColor;
        ctx.fillRect(frameX + 1, dy + 6, 2, tileSize - 12);
        // Handle
        ctx.fillStyle = tintColor('#d4a84a', tint);
        ctx.fillRect(frameX + 1, dy + tileSize / 2 + 2, 2, 2);
        // Open indicator
        if (isOpen) {
          ctx.fillStyle = '#22c55e40';
          ctx.fillRect(frameX, dy + 8, 4, tileSize - 16);
        }
      }

      // Closed/locked visual (crossbar for locked, solid fill for closed)
      if (door.state === 'Locked') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        if (door.direction === 'North' || door.direction === 'South') {
          const fy = door.direction === 'North' ? dy : dy + tileSize - 4;
          ctx.beginPath(); ctx.moveTo(dx + 8, fy); ctx.lineTo(dx + tileSize - 8, fy + 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx + tileSize - 8, fy); ctx.lineTo(dx + 8, fy + 4); ctx.stroke();
        } else {
          const fx = door.direction === 'West' ? dx : dx + tileSize - 4;
          ctx.beginPath(); ctx.moveTo(fx, dy + 8); ctx.lineTo(fx + 4, dy + tileSize - 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(fx + 4, dy + 8); ctx.lineTo(fx, dy + tileSize - 8); ctx.stroke();
        }
      } else if (door.state === 'Closed') {
        ctx.fillStyle = '#f9731640';
        if (door.direction === 'North' || door.direction === 'South') {
          const fy = door.direction === 'North' ? dy : dy + tileSize - 4;
          ctx.fillRect(dx + 6, fy, tileSize - 12, 4);
        } else {
          const fx = door.direction === 'West' ? dx : dx + tileSize - 4;
          ctx.fillRect(fx, dy + 6, 4, tileSize - 12);
        }
      }
    }

    // Corridor edges
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (worldData.tiles[y * W + x] !== 1) continue;
        const px = x * tileSize, py = y * tileSize;
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || worldData.tiles[ny * W + nx] === 0) {
            ctx.fillStyle = '#00000040';
            if (dx === -1) ctx.fillRect(px, py, 2, tileSize);
            if (dx === 1) ctx.fillRect(px + tileSize - 2, py, 2, tileSize);
            if (dy === -1) ctx.fillRect(px, py, tileSize, 2);
            if (dy === 1) ctx.fillRect(px, py + tileSize - 2, tileSize, 2);
          }
        }
      }
    }

    // Objects as pixel art (heightmap-lit)
    function hex2rgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
    function rgb2hex(r,g,b){return'#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');}

    function drawLitRect(cx, x, y, w, h, color, depth, lightDir) {
      const rgb = hex2rgb(color);
      // Simple directional shading based on depth
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

    for (const obj of (worldData.objects || [])) {
      const ox = obj.x * tileSize, oy = obj.y * tileSize;
      const t = obj.type;

      if (t === 'desk' || t === 'monitor') {
        // Desk surface
        drawLitRect(ctx, ox+4, oy+6, 24, 12, matPal.wood, 4, 0.8);
        drawLitRect(ctx, ox+5, oy+7, 22, 2, matPal.woodLight, 5, 1.0);
        // Legs
        drawLitRect(ctx, ox+6, oy+18, 3, 8, matPal.woodDark, 2, 0.5);
        drawLitRect(ctx, ox+23, oy+18, 3, 8, matPal.woodDark, 2, 0.5);
        // Monitor
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
        // Scribbles
        ctx.fillStyle = '#33333380'; ctx.fillRect(ox+8, oy+6, 10, 1);
        ctx.fillStyle = '#e76f5180'; ctx.fillRect(ox+10, oy+9, 14, 1);
        // Stand
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
        // Pot
        drawLitRect(ctx, ox+11, oy+20, 10, 8, matPal.pot, 3, 0.7);
        drawLitRect(ctx, ox+10, oy+20, 12, 2, tintColor('#a07050', tint), 4, 0.9);
        // Stem
        drawLitRect(ctx, ox+15, oy+14, 2, 6, tintColor('#3a5a2a', tint), 2, 0.6);
        // Leaves
        for (const [lx,ly] of [[13,10],[18,8],[11,7],[16,5],[20,9],[15,3]]) {
          ctx.fillStyle = matPal.leaf;
          ctx.beginPath(); ctx.arc(ox+lx, oy+ly, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = matPal.leafDark;
          ctx.beginPath(); ctx.arc(ox+lx, oy+ly, 1.5, 0, Math.PI*2); ctx.fill();
        }
      } else if (t === 'couch') {
        drawLitRect(ctx, ox+4, oy+6, 24, 14, matPal.fabric, 3, 0.7);
        drawLitRect(ctx, ox+4, oy+6, 24, 3, matPal.fabric, 5, 0.9); // backrest
        drawLitRect(ctx, ox+3, oy+6, 2, 10, matPal.fabric, 5, 0.8); // left arm
        drawLitRect(ctx, ox+27, oy+6, 2, 10, matPal.fabric, 5, 0.8); // right arm
        drawLitRect(ctx, ox+15, oy+10, 2, 8, matPal.woodDark, 2, 0.5); // center division
      } else if (t === 'lamp') {
        // Shade
        ctx.fillStyle = tintColor('#e9c46a', tint);
        ctx.beginPath(); ctx.arc(ox+16, oy+6, 6, Math.PI, 0); ctx.fill();
        // Pole
        drawLitRect(ctx, ox+15, oy+6, 2, 14, matPal.metal, 2, 0.6);
        // Base
        drawLitRect(ctx, ox+12, oy+20, 8, 3, matPal.metal, 1, 0.5);
        // Glow
        ctx.fillStyle = '#ffee8820';
        ctx.beginPath(); ctx.arc(ox+16, oy+8, 10, 0, Math.PI*2); ctx.fill();
      } else if (t === 'coffee' || t === 'cooler' || t === 'vending') {
        // Tall appliance
        drawLitRect(ctx, ox+8, oy+4, 16, 22, matPal.metal, 4, 0.8);
        drawLitRect(ctx, ox+10, oy+6, 12, 8, tintColor('#334', tint), 5, 0.6);
        drawLitRect(ctx, ox+10, oy+16, 12, 6, matPal.metal, 3, 0.5);
        if (t === 'vending') { ctx.fillStyle = tintColor('#22c55e', tint); ctx.fillRect(ox+12, oy+8, 2, 2); }
      } else if (t === 'mug') {
        drawLitRect(ctx, ox+12, oy+12, 8, 8, tintColor('#ddd', tint), 3, 0.8);
        drawLitRect(ctx, ox+20, oy+14, 3, 4, tintColor('#ccc', tint), 2, 0.6);
        ctx.fillStyle = tintColor('#654', tint); ctx.fillRect(ox+13, oy+13, 6, 5); // coffee
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
        ctx.fillStyle = tintColor('#e8e0d0', tint);
        ctx.fillRect(ox+10, oy+12, 8, 10); ctx.fillRect(ox+12, oy+10, 8, 10);
        ctx.fillStyle = tintColor('#999', tint);
        for (let i = 0; i < 3; i++) ctx.fillRect(ox+12, oy+14+i*3, 6, 1);
      } else if (t === 'globe') {
        ctx.fillStyle = tintColor('#3b82f6', tint); ctx.beginPath(); ctx.arc(ox+16, oy+12, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tintColor('#22c55e', tint); ctx.fillRect(ox+12, oy+9, 4, 3); ctx.fillRect(ox+17, oy+12, 3, 2);
        drawLitRect(ctx, ox+14, oy+20, 4, 6, matPal.woodDark, 2, 0.5);
      } else if (t === 'rug') {
        const rugColor = tintColor('#8b4513', tint);
        ctx.fillStyle = rugColor + '40';
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 14, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = rugColor + '60'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 14, 10, 0, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 10, 7, 0, 0, Math.PI*2); ctx.stroke();
      } else if (t === 'mat') {
        ctx.fillStyle = tintColor('#555', tint) + '50';
        ctx.fillRect(ox+6, oy+10, 20, 12);
      } else if (t === 'table') {
        drawLitRect(ctx, ox+6, oy+8, 20, 14, matPal.wood, 3, 0.8);
        drawLitRect(ctx, ox+7, oy+9, 18, 2, matPal.woodLight, 4, 1.0);
        drawLitRect(ctx, ox+8, oy+22, 3, 6, matPal.woodDark, 1, 0.5);
        drawLitRect(ctx, ox+21, oy+22, 3, 6, matPal.woodDark, 1, 0.5);
      } else if (t === 'trash') {
        drawLitRect(ctx, ox+10, oy+10, 12, 14, tintColor('#555', tint), 3, 0.6);
        drawLitRect(ctx, ox+11, oy+11, 10, 2, tintColor('#666', tint), 3.5, 0.7);
        ctx.fillStyle = tintColor('#888', tint); ctx.fillRect(ox+13, oy+8, 6, 3); // crumpled paper
      } else if (t === 'coatrack') {
        drawLitRect(ctx, ox+15, oy+4, 2, 20, matPal.woodDark, 2, 0.6);
        drawLitRect(ctx, ox+10, oy+24, 12, 3, matPal.woodDark, 1, 0.5);
        // Hooks + coat
        ctx.fillStyle = tintColor('#4a6', tint); ctx.fillRect(ox+10, oy+6, 5, 8); // jacket
        ctx.fillStyle = matPal.metal; ctx.fillRect(ox+12, oy+5, 2, 2); ctx.fillRect(ox+18, oy+5, 2, 2);
      } else if (t === 'server') {
        // Server rack
        drawLitRect(ctx, ox+6, oy+2, 20, 26, tintColor('#333', tint), 4, 0.6);
        drawLitRect(ctx, ox+8, oy+4, 16, 5, tintColor('#222', tint), 5, 0.5);
        drawLitRect(ctx, ox+8, oy+11, 16, 5, tintColor('#222', tint), 5, 0.5);
        drawLitRect(ctx, ox+8, oy+18, 16, 5, tintColor('#222', tint), 5, 0.5);
        // LED indicators
        ctx.fillStyle = '#22c55e'; ctx.fillRect(ox+10, oy+5, 2, 2);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(ox+10, oy+12, 2, 2);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(ox+10, oy+19, 2, 2);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(ox+14, oy+12, 2, 2);
      } else if (t === 'filing') {
        // Filing cabinet
        drawLitRect(ctx, ox+8, oy+4, 16, 22, matPal.metal, 4, 0.7);
        drawLitRect(ctx, ox+9, oy+5, 14, 6, tintColor('#888', tint), 4.5, 0.6);
        drawLitRect(ctx, ox+9, oy+13, 14, 6, tintColor('#888', tint), 4.5, 0.6);
        drawLitRect(ctx, ox+9, oy+21, 14, 4, tintColor('#888', tint), 4.5, 0.6);
        // Handles
        ctx.fillStyle = tintColor('#ccc', tint);
        ctx.fillRect(ox+15, oy+7, 3, 1); ctx.fillRect(ox+15, oy+15, 3, 1); ctx.fillRect(ox+15, oy+23, 3, 1);
      } else if (t === 'potted-tree') {
        // Large potted tree
        drawLitRect(ctx, ox+12, oy+22, 8, 6, matPal.pot, 3, 0.7);
        drawLitRect(ctx, ox+15, oy+12, 2, 10, tintColor('#5a3a1a', tint), 2, 0.6);
        for (const [lx,ly,sz] of [[12,4,5],[18,3,4],[10,8,4],[20,6,3],[15,1,5],[16,7,4]]) {
          ctx.fillStyle = matPal.leaf;
          ctx.beginPath(); ctx.arc(ox+lx, oy+ly, sz, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = matPal.leafDark;
          ctx.beginPath(); ctx.arc(ox+lx+1, oy+ly+1, sz*0.5, 0, Math.PI*2); ctx.fill();
        }
      } else if (t === 'art-frame') {
        // Wall art / framed picture
        drawLitRect(ctx, ox+6, oy+4, 20, 16, tintColor('#3a2a1a', tint), 4, 0.7);
        drawLitRect(ctx, ox+8, oy+6, 16, 12, tintColor('#87ceeb', tint), 5, 0.9);
        // Abstract art stripes
        ctx.fillStyle = tintColor('#e76f51', tint) + '80'; ctx.fillRect(ox+10, oy+8, 6, 4);
        ctx.fillStyle = tintColor('#2a9d8f', tint) + '80'; ctx.fillRect(ox+16, oy+10, 5, 6);
        ctx.fillStyle = tintColor('#e9c46a', tint) + '60'; ctx.fillRect(ox+11, oy+13, 8, 3);
      } else if (t === 'fan') {
        // Desk fan
        ctx.fillStyle = matPal.metal;
        ctx.beginPath(); ctx.arc(ox+16, oy+10, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tintColor('#666', tint);
        ctx.beginPath(); ctx.arc(ox+16, oy+10, 6, 0, Math.PI*2); ctx.fill();
        // Blades
        ctx.strokeStyle = tintColor('#bbb', tint); ctx.lineWidth = 2;
        for (let a = 0; a < 3; a++) {
          const angle = (a * Math.PI * 2 / 3) + (Date.now() * 0.01 % (Math.PI * 2));
          ctx.beginPath(); ctx.moveTo(ox+16, oy+10);
          ctx.lineTo(ox+16+Math.cos(angle)*5, oy+10+Math.sin(angle)*5); ctx.stroke();
        }
        drawLitRect(ctx, ox+14, oy+18, 4, 8, matPal.metal, 2, 0.6);
      } else if (t === 'headphones') {
        // Headphones on desk
        ctx.strokeStyle = tintColor('#333', tint); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox+16, oy+14, 6, Math.PI, 0); ctx.stroke();
        drawLitRect(ctx, ox+10, oy+14, 4, 6, tintColor('#444', tint), 3, 0.6);
        drawLitRect(ctx, ox+18, oy+14, 4, 6, tintColor('#444', tint), 3, 0.6);
        // Ear cushions
        ctx.fillStyle = tintColor('#666', tint);
        ctx.fillRect(ox+10, oy+15, 4, 4); ctx.fillRect(ox+18, oy+15, 4, 4);
      } else if (t === 'keyboard') {
        // Keyboard
        drawLitRect(ctx, ox+6, oy+14, 20, 6, tintColor('#333', tint), 3, 0.7);
        // Key rows
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 8; col++) {
            ctx.fillStyle = tintColor('#555', tint);
            ctx.fillRect(ox+8+col*2, oy+15+row*2, 1, 1);
          }
        }
        // Space bar
        ctx.fillStyle = tintColor('#555', tint); ctx.fillRect(ox+12, oy+19, 8, 1);
      } else if (t === 'snack-bowl') {
        // Snack bowl
        ctx.fillStyle = tintColor('#ddd', tint);
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 7, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tintColor('#ccc', tint);
        ctx.beginPath(); ctx.ellipse(ox+16, oy+16, 5, 3, 0, 0, Math.PI*2); ctx.fill();
        // Snacks
        const snackColors = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = tintColor(snackColors[i], tint);
          ctx.fillRect(ox+13+i*2, oy+15, 1, 1);
        }
      } else if (t === 'window') {
        // Window (wall decoration)
        drawLitRect(ctx, ox+4, oy+4, 24, 18, tintColor('#1a3050', tint), 5, 0.8);
        drawLitRect(ctx, ox+6, oy+6, 20, 14, tintColor('#87ceeb', tint), 6, 1.0);
        // Window panes
        ctx.fillStyle = tintColor('#aaddff', tint) + '40';
        ctx.fillRect(ox+6, oy+6, 9, 6); ctx.fillRect(ox+17, oy+6, 9, 6);
        // Frame dividers
        ctx.fillStyle = tintColor('#555', tint);
        ctx.fillRect(ox+15, oy+6, 2, 14); ctx.fillRect(ox+6, oy+12, 20, 2);
        // Glow
        ctx.fillStyle = '#87ceeb10';
        ctx.fillRect(ox+2, oy+2, 28, 24);
      } else if (t === 'fire-ext') {
        // Fire extinguisher
        drawLitRect(ctx, ox+13, oy+6, 6, 16, tintColor('#cc2222', tint), 4, 0.8);
        drawLitRect(ctx, ox+14, oy+4, 4, 3, tintColor('#888', tint), 5, 0.9);
        drawLitRect(ctx, ox+12, oy+4, 2, 4, tintColor('#666', tint), 3, 0.6);
        // Label
        ctx.fillStyle = '#fff'; ctx.fillRect(ox+14, oy+10, 4, 3);
      } else if (t === 'calendar') {
        // Wall calendar
        drawLitRect(ctx, ox+8, oy+4, 16, 18, tintColor('#fff', tint), 5, 0.9);
        drawLitRect(ctx, ox+8, oy+4, 16, 4, tintColor('#ef4444', tint), 5.5, 0.8);
        // Grid lines
        ctx.fillStyle = tintColor('#ddd', tint);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
          ctx.fillRect(ox+10+col*3, oy+10+row*2, 2, 1);
        }
      } else {
        // Fallback dot
        ctx.fillStyle = pal.accent + '40';
        ctx.beginPath(); ctx.arc(ox+16, oy+16, 6, 0, Math.PI*2); ctx.fill();
      }
    }

    // Agents (heightmap-lit chibi style)
    function shade(hex, f) { const rgb = hex2rgb(hex); return rgb2hex(rgb.r*f, rgb.g*f, rgb.b*f); }

    for (const agent of (worldData.agents || [])) {
      const ax = agent.x * tileSize + tileSize / 2;
      const ay = agent.y * tileSize + tileSize / 2;
      const sc = agent.status === 'active' ? '#22c55e' : agent.status === 'idle' ? '#eab308' : '#666';
      const c = agent.color;
      const cD = shade(c, 0.55), cL = shade(c, 1.35);
      const skin = '#ffd5a0', skinS = '#d4a870', skinH = '#ffe8c8';

      // Shadow
      ctx.fillStyle = '#00000030';
      ctx.beginPath();
      ctx.ellipse(ax, ay + 15, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 1px outline (draw body shapes slightly larger in black first)
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(ax, ay - 6, 11, 0, Math.PI * 2); ctx.fill(); // head outline
      ctx.beginPath(); ctx.ellipse(ax, ay + 6, 9, 9, 0, 0, Math.PI * 2); ctx.fill(); // body outline

      // Hair dome (full round, colored)
      ctx.beginPath(); ctx.arc(ax, ay - 6, 10, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      // Hair highlight
      ctx.beginPath(); ctx.arc(ax, ay - 9, 8, Math.PI + 0.3, -0.3);
      ctx.fillStyle = cL; ctx.fill();
      // Hair shadow (bottom)
      ctx.beginPath(); ctx.arc(ax, ay - 3, 9, 0.3, Math.PI - 0.3);
      ctx.fillStyle = cD; ctx.fill();

      // Face (lower part of head circle)
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(ax, ay - 4, 7, 0.2, Math.PI - 0.2); ctx.fill();
      // Forehead highlight
      drawLitRect(ctx, ax - 4, ay - 8, 8, 2, skinH, 9, 1.0);
      // Jaw shadow
      drawLitRect(ctx, ax - 5, ay - 1, 10, 2, skinS, 7, 0.6);

      // Eyes (precise pixel placement)
      ctx.fillStyle = '#fff';
      ctx.fillRect(ax - 5, ay - 6, 4, 3);
      ctx.fillRect(ax + 2, ay - 6, 4, 3);
      // Iris
      ctx.fillStyle = '#4488cc';
      ctx.fillRect(ax - 4, ay - 5, 2, 2);
      ctx.fillRect(ax + 3, ay - 5, 2, 2);
      // Pupil
      ctx.fillStyle = '#111';
      ctx.fillRect(ax - 4, ay - 5, 1, 1);
      ctx.fillRect(ax + 3, ay - 5, 1, 1);
      // Sparkle
      ctx.fillStyle = '#fff';
      ctx.fillRect(ax - 3, ay - 6, 1, 1);
      ctx.fillRect(ax + 4, ay - 6, 1, 1);
      // Eyebrows
      ctx.fillStyle = cD;
      ctx.fillRect(ax - 5, ay - 8, 3, 1);
      ctx.fillRect(ax + 3, ay - 8, 3, 1);

      // Nose
      ctx.fillStyle = skinS;
      ctx.fillRect(ax, ay - 3, 1, 1);
      ctx.fillStyle = skinH;
      ctx.fillRect(ax, ay - 2, 1, 1);

      // Mouth
      ctx.fillStyle = '#c08060';
      ctx.fillRect(ax - 2, ay - 1, 4, 1);

      // Body/shirt (ellipse with shading)
      ctx.beginPath(); ctx.ellipse(ax, ay + 6, 8, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      // Shirt shading
      drawLitRect(ctx, ax - 7, ay + 2, 4, 10, cD, 4, 0.5); // left shadow
      drawLitRect(ctx, ax + 4, ay + 2, 4, 10, cD, 4, 0.5); // right shadow
      drawLitRect(ctx, ax - 3, ay + 2, 6, 6, cL, 5, 1.0); // center highlight
      // Collar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ax - 2, ay - 1, 5, 2);

      // Arms
      drawLitRect(ctx, ax - 12, ay + 1, 5, 10, c, 4, 0.7);
      drawLitRect(ctx, ax + 8, ay + 1, 5, 10, c, 4, 0.7);
      drawLitRect(ctx, ax - 12, ay + 1, 2, 10, cD, 3, 0.5); // arm shadow
      drawLitRect(ctx, ax + 11, ay + 1, 2, 10, cD, 3, 0.5);
      // Hands
      drawLitRect(ctx, ax - 11, ay + 11, 4, 3, skin, 3, 0.7);
      drawLitRect(ctx, ax + 8, ay + 11, 4, 3, skin, 3, 0.7);

      // Legs
      drawLitRect(ctx, ax - 5, ay + 13, 4, 5, '#2a2a40', 4, 0.7);
      drawLitRect(ctx, ax + 2, ay + 13, 4, 5, '#2a2a40', 4, 0.7);
      drawLitRect(ctx, ax - 1, ay + 14, 2, 4, '#151520', 3, 0.4); // leg gap

      // Shoes
      drawLitRect(ctx, ax - 6, ay + 18, 5, 2, '#1a1a1a', 2, 0.5);
      drawLitRect(ctx, ax + 2, ay + 18, 5, 2, '#1a1a1a', 2, 0.5);

      // Status dot
      ctx.beginPath();
      ctx.arc(ax + 10, ay - 10, 4, 0, Math.PI * 2);
      ctx.fillStyle = sc;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Name label
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      const nm = ctx.measureText(agent.name);
      ctx.fillStyle = '#000000cc';
      ctx.beginPath();
      ctx.roundRect(ax - nm.width / 2 - 4, ay - 26, nm.width + 8, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(agent.name, ax, ay - 15);
    }

    // === Social Behaviors Layer ===
    const time = Date.now();
    const idleFrame = canvas._idleFrame || 0;

    // 1. Proximity lines — draw subtle connection lines between nearby agents
    const proxRadius = 5; // tiles
    for (let i = 0; i < (worldData.agents || []).length; i++) {
      for (let j = i + 1; j < (worldData.agents || []).length; j++) {
        const a1 = worldData.agents[i], a2 = worldData.agents[j];
        const dist = Math.abs(a1.x - a2.x) + Math.abs(a1.y - a2.y);
        if (dist <= proxRadius && a1.status !== 'offline' && a2.status !== 'offline') {
          const x1 = a1.x * tileSize + tileSize / 2, y1 = a1.y * tileSize + tileSize / 2;
          const x2 = a2.x * tileSize + tileSize / 2, y2 = a2.y * tileSize + tileSize / 2;
          const alpha = Math.max(0.08, 0.25 - dist * 0.03);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.setLineDash([]);
          // Proximity spark at midpoint
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
          ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // 2. Status bubbles + idle animations per agent
    const statusEmotes = {
      'active': ['💻', '⌨️', '📝', '🔧', '💡', '📊'],
      'idle': ['☕', '💭', '📖', '🎵'],
      'offline': [],
    };

    for (const agent of (worldData.agents || [])) {
      const ax = agent.x * tileSize + tileSize / 2;
      const ay = agent.y * tileSize + tileSize / 2;

      if (agent.status === 'active') {
        // Thought bubble with activity emote
        const emoteIdx = Math.abs(agent.x * 7 + agent.y * 13 + Math.floor(time / 8000)) % statusEmotes.active.length;
        const emote = statusEmotes.active[emoteIdx];
        const bubbleY = ay - 38;
        // Bubble background
        ctx.fillStyle = '#ffffffdd';
        ctx.beginPath();
        ctx.roundRect(ax + 8, bubbleY - 8, 20, 16, 4);
        ctx.fill();
        // Bubble tail
        ctx.fillStyle = '#ffffffdd';
        ctx.beginPath();
        ctx.moveTo(ax + 10, bubbleY + 8);
        ctx.lineTo(ax + 6, bubbleY + 12);
        ctx.lineTo(ax + 14, bubbleY + 8);
        ctx.fill();
        // Emote
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(emote, ax + 18, bubbleY + 4);

        // Active pulse ring
        const pulse = 0.3 + Math.sin(time / 600) * 0.15;
        ctx.strokeStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ax, ay, 20 + Math.sin(time / 400) * 2, 0, Math.PI * 2); ctx.stroke();

      } else if (agent.status === 'idle') {
        // Zzz animation (floating z's)
        const zAlpha = 0.3 + Math.sin(time / 1000) * 0.2;
        ctx.fillStyle = `rgba(234, 179, 8, ${zAlpha})`;
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'left';
        const zOffset = (time / 800) % 3;
        ctx.fillText('z', ax + 12, ay - 30 - zOffset * 3);
        ctx.fillStyle = `rgba(234, 179, 8, ${zAlpha * 0.7})`;
        ctx.font = 'bold 6px system-ui';
        ctx.fillText('z', ax + 16, ay - 34 - zOffset * 2);
        ctx.fillStyle = `rgba(234, 179, 8, ${zAlpha * 0.4})`;
        ctx.font = 'bold 5px system-ui';
        ctx.fillText('z', ax + 19, ay - 37 - zOffset);

        // Idle thought bubble (occasional)
        if (Math.floor(time / 12000) % 3 === (Math.abs(agent.x + agent.y) % 3)) {
          const emote = statusEmotes.idle[Math.abs(agent.x * 3 + agent.y * 5) % statusEmotes.idle.length];
          ctx.fillStyle = '#ffffff99';
          ctx.beginPath();
          ctx.roundRect(ax + 8, ay - 42, 18, 14, 3);
          ctx.fill();
          ctx.font = '9px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000';
          ctx.fillText(emote, ax + 17, ay - 33);
        }

      } else if (agent.status === 'offline') {
        // Dim overlay
        ctx.fillStyle = '#00000040';
        ctx.beginPath(); ctx.arc(ax, ay, 16, 0, Math.PI * 2); ctx.fill();
        // Offline indicator
        ctx.fillStyle = '#666';
        ctx.font = '7px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('AWAY', ax, ay + 26);
      }
    }

    // Info overlay
    ctx.fillStyle = '#00000080';
    ctx.fillRect(0, 0, canvas.width, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(
      `AgentHabitat | seed: ${worldData.seed} | style: ${worldData.style} | rooms: ${worldData.rooms.length} | hash: ${worldData.topologyHash.slice(0, 12)}...`,
      6, 14
    );

    // Minimap (bottom-right corner, toggleable)
    if (canvas._showMinimap === undefined) canvas._showMinimap = true;
    if (!canvas._showMinimap) { /* skip minimap */ } else {
    const mmScale = 4;
    const mmW = W * mmScale, mmH = H * mmScale;
    const mmX = canvas.width - mmW - 10, mmY = canvas.height - mmH - 10;
    // Background
    ctx.fillStyle = '#000000cc';
    ctx.beginPath();
    ctx.roundRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6, 4);
    ctx.fill();
    // Tiles
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = worldData.tiles[y * W + x];
        if (tile === 0) continue;
        const room = tile === 2 ? worldData.rooms.find(r =>
          x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
        ) : null;
        ctx.fillStyle = room ? (pal.rooms[room.archetype] || pal.roomFloor) : pal.corridor;
        ctx.fillRect(mmX + x * mmScale, mmY + y * mmScale, mmScale, mmScale);
      }
    }
    // Room borders on minimap
    for (const room of worldData.rooms) {
      ctx.strokeStyle = pal.wall;
      ctx.lineWidth = 1;
      ctx.strokeRect(mmX + room.x * mmScale, mmY + room.y * mmScale,
        room.width * mmScale, room.height * mmScale);
    }
    // Agent dots on minimap
    for (const agent of (worldData.agents || [])) {
      ctx.fillStyle = agent.color;
      ctx.beginPath();
      ctx.arc(mmX + agent.x * mmScale + mmScale/2, mmY + agent.y * mmScale + mmScale/2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // Minimap label
    ctx.fillStyle = '#888';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('MAP', mmX + mmW, mmY - 5);
    } // end minimap toggle

    // Edit mode overlay
    if (canvas._editMode) {
      // Edit mode indicator
      ctx.fillStyle = '#f9731640';
      ctx.fillRect(0, canvas.height - 24, canvas.width, 24);
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      const changeCount = WorldRenderer.getChangeCount(canvasId);
      const changeLabel = changeCount > 0 ? ` · ${changeCount} unsaved change${changeCount > 1 ? 's' : ''}` : '';
      ctx.fillText(`EDIT MODE — Click objects to select · Actions in panel${changeLabel}`, canvas.width / 2, canvas.height - 8);

      // Highlight selected object
      if (canvas._editSelectedObj) {
        const selObj = (worldData.objects || []).find(o => o.id === canvas._editSelectedObj);
        if (selObj) {
          const sox = selObj.x * tileSize, soy = selObj.y * tileSize;
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(sox + 1, soy + 1, tileSize - 2, tileSize - 2);
          ctx.setLineDash([]);
          // Label
          ctx.fillStyle = '#f97316';
          ctx.font = '8px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(selObj.type, sox + tileSize / 2, soy - 3);
        }
      }

      // Placement preview ghost (during add/move actions)
      if (canvas._editPreview) {
        const { tx: ptx, ty: pty, valid } = canvas._editPreview;
        const ppx = ptx * tileSize, ppy = pty * tileSize;
        // Ghost tile highlight
        ctx.fillStyle = valid ? '#22c55e30' : '#ef444440';
        ctx.fillRect(ppx, ppy, tileSize, tileSize);
        ctx.strokeStyle = valid ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(ppx + 1, ppy + 1, tileSize - 2, tileSize - 2);
        // Icon
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = valid ? '#22c55e' : '#ef4444';
        ctx.fillText(valid ? '✓' : '✗', ppx + tileSize / 2, ppy + tileSize / 2 + 4);
        // Reason label for invalid
        if (!valid && canvas._editPreview.reason) {
          const reasonMap = {
            'out-of-bounds': 'Out of bounds',
            'unwalkable': 'Not walkable',
            'object-overlap': 'Object here',
            'agent-overlap': 'Agent here',
          };
          const label = reasonMap[canvas._editPreview.reason] || canvas._editPreview.reason;
          ctx.fillStyle = '#ef4444';
          ctx.font = '8px system-ui';
          ctx.fillText(label, ppx + tileSize / 2, ppy - 4);
        }
      }

      // Validation result banner (brief flash after action)
      if (canvas._validationResult) {
        const vr = canvas._validationResult;
        const bannerY = canvas.height - 48;
        ctx.fillStyle = vr.pass ? '#22c55e30' : '#ef444440';
        ctx.fillRect(0, bannerY, canvas.width, 22);
        ctx.fillStyle = vr.pass ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(
          vr.pass ? '✓ All invariants pass' : `✗ ${vr.errors[0]}`,
          canvas.width / 2, bannerY + 15
        );
      }
    }

    // Persistent selection highlights (normal mode)
    if (!canvas._editMode && canvas._selectedAgentId) {
      const selAgent = (worldData.agents || []).find(a => a.id === canvas._selectedAgentId);
      if (selAgent) {
        const sax = selAgent.x * tileSize + tileSize / 2;
        const say = selAgent.y * tileSize + tileSize / 2;
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(sax, say, 18, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // "Selected" label
        ctx.fillStyle = '#ffffffcc';
        ctx.font = '8px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('SELECTED', sax, say + 24);
      }
    }
    if (!canvas._editMode && canvas._selectedRoomId) {
      const selRoom = worldData.rooms.find(r => r.id === canvas._selectedRoomId);
      if (selRoom) {
        const srx = selRoom.x * tileSize, sry = selRoom.y * tileSize;
        const srw = selRoom.width * tileSize, srh = selRoom.height * tileSize;
        ctx.strokeStyle = '#3b82f6aa';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(srx + 2, sry + 2, srw - 4, srh - 4);
        ctx.setLineDash([]);
      }
    }

    // Movement destination marker
    if (canvas._moveDestination) {
      const { x: dx, y: dy } = canvas._moveDestination;
      const dpx = dx * tileSize + tileSize / 2;
      const dpy = dy * tileSize + tileSize / 2;
      // Pulsing dot effect
      const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.3;
      ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
      ctx.beginPath(); ctx.arc(dpx, dpy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(dpx, dpy, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.font = '7px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('DEST', dpx, dpy + 16);
    }

    // Moving indicator on agent
    for (const agent of (worldData.agents || [])) {
      if (agent._moving) {
        const max = agent.x * tileSize + tileSize / 2;
        const may = agent.y * tileSize + tileSize / 2;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Moving...', max, may - 22);
      }
    }

    // Store world data for click handler
    canvas._worldData = worldData;
    canvas._tileSize = tileSize;
    canvas._pal = pal;
    // Snapshot base objects on first render (for override layer)
    if (!canvas._baseObjects) {
      canvas._baseObjects = JSON.parse(JSON.stringify(worldData.objects || []));
    }

    // Click + right-click handlers (only add once)
    if (!canvas._clickHandlerSet) {
      canvas._clickHandlerSet = true;
      canvas.style.cursor = 'pointer';

      // Hover tooltip + placement preview
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wd = canvas._worldData;
        const ts = canvas._tileSize;
        if (!wd) return;

        const tx = Math.floor(mx / ts);
        const ty = Math.floor(my / ts);

        // Edit mode: show placement preview during add/move
        if (canvas._editMode && (canvas._editAction === 'add' || canvas._editAction === 'move')) {
          const excludeId = canvas._editAction === 'move' ? canvas._editSelectedObj : null;
          const result = WorldRenderer.validatePlacement(canvasId, tx, ty, excludeId);
          const prev = canvas._editPreview;
          if (!prev || prev.tx !== tx || prev.ty !== ty) {
            canvas._editPreview = { tx, ty, valid: result.valid, reason: result.reason };
            canvas.style.cursor = result.valid ? 'copy' : 'not-allowed';
            WorldRenderer.render(canvasId, wd);
          }
          return;
        }

        // Clear preview when not in add/move
        if (canvas._editPreview) {
          canvas._editPreview = null;
          WorldRenderer.render(canvasId, wd);
        }

        const hovDoor = (wd.doors || []).find(d => d.x === tx && d.y === ty);
        const hovAgent = (wd.agents || []).find(a => a.x === tx && a.y === ty);
        const hovRoom = wd.rooms.find(r =>
          tx >= r.x && tx < r.x + r.width && ty >= r.y && ty < r.y + r.height
        );

        if (hovDoor) {
          canvas.title = `Door [${hovDoor.state}] — click to toggle · ${hovDoor.direction} · ${hovDoor.connectsTo || 'corridor'}`;
          canvas.style.cursor = 'pointer';
        } else if (hovAgent) {
          canvas.title = `${hovAgent.name || hovAgent.id} (${hovAgent.role || 'agent'}) — ${hovAgent.status}`;
          canvas.style.cursor = 'pointer';
        } else if (hovRoom) {
          canvas.title = `${hovRoom.archetype.replace('Room', ' Room')} [${hovRoom.id}]`;
          canvas.style.cursor = 'pointer';
        } else {
          canvas.title = '';
          canvas.style.cursor = canvas._editMode ? 'crosshair' : 'default';
        }
      });

      // Right-click: move last selected agent to clicked tile
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wd = canvas._worldData;
        const ts = canvas._tileSize;
        if (!wd || !canvas._selectedAgentId) return;

        const tx = Math.floor(mx / ts);
        const ty = Math.floor(my / ts);
        const movingAgent = (wd.agents || []).some(a => a._moving);
        if (!movingAgent && wd.tiles[ty * wd.width + tx] > 0) {
          WorldRenderer.moveAgent(canvasId, canvas._selectedAgentId, tx, ty);
        }
      });
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wd = canvas._worldData;
        const ts = canvas._tileSize;
        if (!wd) return;

        const tx = Math.floor(mx / ts);
        const ty = Math.floor(my / ts);

        // Check if an agent was clicked (priority over room)
        // Edit mode interactions
        if (canvas._editMode) {
          const action = canvas._editAction;

          if (action === 'add' && canvas._editAddType) {
            // Validate before adding
            const addCheck = WorldRenderer.validatePlacement(canvasId, tx, ty, null);
            if (!addCheck.valid) {
              // Flash invalid indicator
              canvas._editPreview = { tx, ty, valid: false, reason: addCheck.reason };
              WorldRenderer.render(canvasId, wd);
              setTimeout(() => { canvas._editPreview = null; WorldRenderer.render(canvasId, wd); }, 800);
              return;
            }
            const newObj = {
              id: `edit-${Date.now()}`,
              type: canvas._editAddType,
              x: tx, y: ty,
              roomId: 'user-placed'
            };
            wd.objects = wd.objects || [];
            wd.objects.push(newObj);
            WorldRenderer.getOverrides(canvasId).added.push(newObj);
            canvas._editAction = null;
            canvas._editPreview = null;
            // Post-edit invariant check
            const postAdd = WorldRenderer.validateInvariants(canvasId);
            canvas._validationResult = postAdd;
            WorldRenderer.render(canvasId, wd);
            setTimeout(() => { canvas._validationResult = null; WorldRenderer.render(canvasId, wd); }, 2000);
            if (window._blazorEditCallback) window._blazorEditCallback('added', newObj);
            return;
          }

          // Select or move object
          const clickedObj = (wd.objects || []).find(o => o.x === tx && o.y === ty);

          if (canvas._editSelectedObj && action === 'move') {
            // Validate before moving
            const moveCheck = WorldRenderer.validatePlacement(canvasId, tx, ty, canvas._editSelectedObj);
            if (!moveCheck.valid) {
              canvas._editPreview = { tx, ty, valid: false, reason: moveCheck.reason };
              WorldRenderer.render(canvasId, wd);
              setTimeout(() => { canvas._editPreview = null; WorldRenderer.render(canvasId, wd); }, 800);
              return;
            }
            const obj = (wd.objects || []).find(o => o.id === canvas._editSelectedObj);
            if (obj) {
              obj.x = tx;
              obj.y = ty;
              WorldRenderer.getOverrides(canvasId).moved[obj.id] = { x: tx, y: ty };
              canvas._editAction = null;
              canvas._editPreview = null;
              // Post-edit invariant check
              const postMove = WorldRenderer.validateInvariants(canvasId);
              canvas._validationResult = postMove;
              WorldRenderer.render(canvasId, wd);
              setTimeout(() => { canvas._validationResult = null; WorldRenderer.render(canvasId, wd); }, 2000);
              if (window._blazorEditCallback) window._blazorEditCallback('moved', obj);
            }
            return;
          }

          if (clickedObj) {
            canvas._editSelectedObj = clickedObj.id;
            canvas._editAction = null;
            WorldRenderer.render(canvasId, wd);
            if (window._blazorEditCallback) window._blazorEditCallback('selected', clickedObj);
          } else {
            canvas._editSelectedObj = null;
            WorldRenderer.render(canvasId, wd);
            if (window._blazorEditCallback) window._blazorEditCallback('deselected', null);
          }
          return;
        }

        // Normal mode: check if any agent is moving — block clicks during movement
        const anyMoving = (wd.agents || []).some(a => a._moving);
        if (anyMoving) return;

        // Check if a door was clicked — toggle state
        const clickedDoor = (wd.doors || []).find(d => d.x === tx && d.y === ty);
        if (clickedDoor) {
          WorldRenderer.toggleDoor(canvasId, clickedDoor.id);
          if (window._blazorDoorClickCallback) window._blazorDoorClickCallback(clickedDoor);
          return;
        }

        const clickedAgent = (wd.agents || []).find(a => a.x === tx && a.y === ty);
        if (clickedAgent) {
          canvas._selectedAgentId = clickedAgent.id;
          canvas._selectedRoomId = null; // clear room selection
          if (window._blazorAgentClickCallback) window._blazorAgentClickCallback(clickedAgent);
          // Visual: highlight agent with ring
          const ctx2 = canvas.getContext('2d');
          const aax = clickedAgent.x * ts + ts / 2;
          const aay = clickedAgent.y * ts + ts / 2;
          ctx2.strokeStyle = '#ffffff';
          ctx2.lineWidth = 2;
          ctx2.setLineDash([4, 3]);
          ctx2.beginPath(); ctx2.arc(aax, aay, 18, 0, Math.PI * 2); ctx2.stroke();
          ctx2.setLineDash([]);
          setTimeout(() => { if (canvas._worldData) WorldRenderer.render(canvasId, canvas._worldData); }, 2000);
          return;
        }

        // Find clicked room
        const room = wd.rooms.find(r =>
          tx >= r.x && tx < r.x + r.width && ty >= r.y && ty < r.y + r.height
        );

        // Find agents in room
        const roomAgents = room ? (wd.agents || []).filter(a =>
          a.x >= room.x && a.x < room.x + room.width &&
          a.y >= room.y && a.y < room.y + room.height
        ) : [];

        // Find objects in room
        const roomObjs = room ? (wd.objects || []).filter(o => o.roomId === room.id) : [];

        if (room) {
          canvas._selectedRoomId = room.id;
          canvas._selectedAgentId = null; // clear agent selection
        } else {
          // Click on empty space → deselect all
          canvas._selectedRoomId = null;
          canvas._selectedAgentId = null;
          canvas._moveDestination = null;
        }

        // Dispatch to Blazor
        if (window._blazorRoomClickCallback) {
          window._blazorRoomClickCallback(room ? {
            id: room.id,
            archetype: room.archetype,
            x: room.x, y: room.y,
            width: room.width, height: room.height,
            agents: roomAgents.map(a => a.name || a.id),
            objects: roomObjs.map(o => o.type),
          } : null);
        }

        // Re-render with selection state
        WorldRenderer.render(canvasId, wd);

        // Visual feedback: highlight clicked room
        if (room) {
          const ctx2 = canvas.getContext('2d');
          const rx = room.x * ts, ry = room.y * ts;
          const rw = room.width * ts, rh = room.height * ts;
          ctx2.strokeStyle = '#ffffff80';
          ctx2.lineWidth = 3;
          ctx2.setLineDash([6, 4]);
          ctx2.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);
          ctx2.setLineDash([]);
          // Auto-clear highlight after 2s by re-rendering
          setTimeout(() => {
            if (canvas._worldData) WorldRenderer.render(canvasId, canvas._worldData);
          }, 2000);
        }
      });
    }
  },

  // Register Blazor callback for room clicks
  onRoomClick: function (callback) {
    window._blazorRoomClickCallback = callback;
  },

  // Register Blazor callback for agent clicks
  onAgentClick: function (callback) {
    window._blazorAgentClickCallback = callback;
  },

  // Build solid-object set from world data (tiles blocked by furniture)
  _buildSolidSet: function (wd) {
    const set = new Set();
    for (const obj of (wd.objects || [])) {
      const props = getObjProps(obj.type);
      if (props.solid) set.add(`${obj.x},${obj.y}`);
    }
    return set;
  },

  // Build door lookup map from world data (position → door object)
  _buildDoorMap: function (wd) {
    const map = new Map();
    for (const door of (wd.doors || [])) {
      map.set(`${door.x},${door.y}`, door);
    }
    return map;
  },

  // Check which room a tile belongs to (null if corridor/void)
  _findRoom: function (x, y, rooms) {
    return rooms.find(r =>
      x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
    ) || null;
  },

  // Movement prototype — move an agent toward a target tile (door-aware)
  moveAgent: function (canvasId, agentId, targetX, targetY) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return;
    const wd = canvas._worldData;
    const agent = (wd.agents || []).find(a => a.id === agentId);
    if (!agent) return;

    // Door-aware + solid-object-aware BFS pathfinding
    const W = wd.width, H = wd.height;
    const doorMap = this._buildDoorMap(wd);
    const solidSet = this._buildSolidSet(wd);

    const isWalkable = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      return wd.tiles[y * W + x] > 0;
    };

    // Check if movement from (fx,fy) to (tx,ty) is allowed considering doors + solid objects
    const canTraverse = (fx, fy, tx, ty) => {
      if (!isWalkable(tx, ty)) return false;

      // Solid objects block movement (unless it's the target tile — allow clicking destination)
      if (solidSet.has(`${tx},${ty}`) && !(tx === targetX && ty === targetY))
        return false;

      const fromRoom = this._findRoom(fx, fy, wd.rooms);
      const toRoom = this._findRoom(tx, ty, wd.rooms);

      // Same zone (both in same room or both in corridor) — always OK
      if (fromRoom === toRoom) return true;
      if (!fromRoom && !toRoom) return true; // corridor to corridor

      // Crossing a room boundary — need a door
      // Check the room-side tile for a door
      const roomSideX = fromRoom ? fx : tx;
      const roomSideY = fromRoom ? fy : ty;
      const doorKey = `${roomSideX},${roomSideY}`;
      const door = doorMap.get(doorKey);

      if (!door) return false; // no door = no passage
      return door.state === 'Open'; // only open doors allow traversal
    };

    const visited = new Set();
    const queue = [{ x: agent.x, y: agent.y, path: [] }];
    visited.add(`${agent.x},${agent.y}`);
    let foundPath = null;

    while (queue.length > 0 && !foundPath) {
      const { x, y, path } = queue.shift();
      if (x === targetX && y === targetY) { foundPath = path; break; }
      for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nx = x + dx, ny = y + dy;
        const key = `${nx},${ny}`;
        if (canTraverse(x, y, nx, ny) && !visited.has(key)) {
          visited.add(key);
          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
        }
      }
    }

    if (!foundPath || foundPath.length === 0) {
      // Visual feedback: path blocked (red flash at destination)
      const ts = canvas._tileSize;
      const blockCtx = canvas.getContext('2d');
      blockCtx.fillStyle = '#ef444460';
      blockCtx.beginPath();
      blockCtx.arc(targetX * ts + ts/2, targetY * ts + ts/2, 14, 0, Math.PI * 2);
      blockCtx.fill();
      blockCtx.fillStyle = '#ef4444';
      blockCtx.font = 'bold 9px system-ui';
      blockCtx.textAlign = 'center';
      blockCtx.fillText('BLOCKED', targetX * ts + ts/2, targetY * ts + ts/2 + 20);
      setTimeout(() => WorldRenderer.render(canvasId, wd), 1200);
      return;
    }

    // Set destination marker
    canvas._moveDestination = { x: targetX, y: targetY };

    // Show path preview (fading dots along route)
    const ts = canvas._tileSize;
    const previewCtx = canvas.getContext('2d');
    for (let i = 0; i < foundPath.length; i++) {
      const alpha = Math.max(0.05, 0.3 - i * 0.01);
      previewCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      previewCtx.beginPath();
      previewCtx.arc(foundPath[i].x * ts + ts/2, foundPath[i].y * ts + ts/2, 3, 0, Math.PI * 2);
      previewCtx.fill();
    }

    // Animate along path (one step every 150ms, faster pace)
    let step = 0;
    agent._moving = true;
    const interval = setInterval(() => {
      if (step >= foundPath.length) {
        clearInterval(interval);
        agent._moving = false;
        canvas._moveDestination = null;
        WorldRenderer.render(canvasId, wd);
        // Flash green at destination
        const dCtx = canvas.getContext('2d');
        dCtx.fillStyle = '#22c55e40';
        dCtx.beginPath();
        dCtx.arc(agent.x * ts + ts/2, agent.y * ts + ts/2, 16, 0, Math.PI * 2);
        dCtx.fill();
        setTimeout(() => WorldRenderer.render(canvasId, wd), 500);
        return;
      }
      const prev = step > 0 ? foundPath[step - 1] : { x: agent.x, y: agent.y };
      const next = foundPath[step];

      // Trail effect: faint dot at previous position
      const trailCtx = canvas.getContext('2d');
      trailCtx.fillStyle = (agent.color || '#fff') + '20';
      trailCtx.beginPath();
      trailCtx.arc(agent.x * ts + ts/2, agent.y * ts + ts/2, 4, 0, Math.PI * 2);
      trailCtx.fill();

      agent.x = next.x;
      agent.y = next.y;
      step++;
      WorldRenderer.render(canvasId, wd);
    }, 150);
  },

  // Placement validation — returns { valid, reason }
  validatePlacement: function (canvasId, tx, ty, excludeObjId, objType) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return { valid: false, reason: 'no-world' };
    const wd = canvas._worldData;
    const W = wd.width, H = wd.height;

    // Bounds check
    if (tx < 0 || ty < 0 || tx >= W || ty >= H)
      return { valid: false, reason: 'out-of-bounds' };

    // Must be walkable tile (room floor or corridor)
    if (wd.tiles[ty * W + tx] <= 0)
      return { valid: false, reason: 'unwalkable' };

    // No overlap with agents
    const agentHere = (wd.agents || []).some(a => a.x === tx && a.y === ty);
    if (agentHere)
      return { valid: false, reason: 'agent-overlap' };

    // Check object property rules
    const props = objType ? getObjProps(objType) : null;
    const objectsHere = (wd.objects || []).filter(o =>
      o.x === tx && o.y === ty && o.id !== excludeObjId
    );

    if (props && props.placement === 'surface') {
      // Surface items MUST be placed on a tile with a surface object
      const hasSurface = objectsHere.some(o => getObjProps(o.type).surface);
      if (!hasSurface)
        return { valid: false, reason: 'needs-surface' };
    } else if (props && props.solid) {
      // Solid objects can't overlap other solid objects
      const hasSolid = objectsHere.some(o => getObjProps(o.type).solid);
      if (hasSolid)
        return { valid: false, reason: 'object-overlap' };
    } else {
      // Non-surface, non-solid items: check for solid overlap
      const hasSolid = objectsHere.some(o => getObjProps(o.type).solid && !getObjProps(o.type).surface);
      if (hasSolid && !(props && props.placement === 'wall'))
        return { valid: false, reason: 'object-overlap' };
    }

    return { valid: true, reason: null };
  },

  // Post-edit invariant check — validates all current objects
  validateInvariants: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return { pass: false, errors: ['no-world'] };
    const wd = canvas._worldData;
    const W = wd.width, H = wd.height;
    const errors = [];

    for (const obj of (wd.objects || [])) {
      // Bounds
      if (obj.x < 0 || obj.y < 0 || obj.x >= W || obj.y >= H)
        errors.push(`${obj.id} out-of-bounds at (${obj.x},${obj.y})`);
      // Walkable
      else if (wd.tiles[obj.y * W + obj.x] <= 0)
        errors.push(`${obj.id} on unwalkable tile (${obj.x},${obj.y})`);
    }

    // Check for duplicate positions
    const posMap = new Map();
    for (const obj of (wd.objects || [])) {
      const key = `${obj.x},${obj.y}`;
      if (posMap.has(key))
        errors.push(`overlap: ${posMap.get(key)} and ${obj.id} at (${obj.x},${obj.y})`);
      posMap.set(key, obj.id);
    }

    // Verify corridor reachability — BFS from first walkable tile must reach all walkable tiles
    // (objects don't block walkability in tile grid, so just verify grid integrity)
    let startX = -1, startY = -1;
    const walkableCount = { total: 0 };
    for (let y = 0; y < H && startX < 0; y++) {
      for (let x = 0; x < W && startX < 0; x++) {
        if (wd.tiles[y * W + x] > 0) { startX = x; startY = y; }
      }
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (wd.tiles[y * W + x] > 0) walkableCount.total++;

    if (startX >= 0) {
      const visited = new Set();
      const q = [{ x: startX, y: startY }];
      visited.add(`${startX},${startY}`);
      while (q.length > 0) {
        const { x, y } = q.shift();
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nx = x + dx, ny = y + dy;
          const k = `${nx},${ny}`;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && !visited.has(k) && wd.tiles[ny * W + nx] > 0) {
            visited.add(k);
            q.push({ x: nx, y: ny });
          }
        }
      }
      if (visited.size !== walkableCount.total)
        errors.push(`reachability: ${visited.size}/${walkableCount.total} tiles connected`);
    }

    return { pass: errors.length === 0, errors };
  },

  // Override layer persistence
  _overrides: {}, // canvasId → { added: [], moved: {id→{x,y}}, removed: Set }

  getOverrides: function (canvasId) {
    if (!this._overrides[canvasId]) {
      this._overrides[canvasId] = { added: [], moved: {}, removed: new Set() };
    }
    return this._overrides[canvasId];
  },

  getChangeCount: function (canvasId) {
    const ov = this.getOverrides(canvasId);
    return ov.added.length + Object.keys(ov.moved).length + ov.removed.size;
  },

  saveOverrides: function (canvasId) {
    const ov = this.getOverrides(canvasId);
    const canvas = document.getElementById(canvasId);
    const invariants = this.validateInvariants(canvasId);
    return JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      invariantsPass: invariants.pass,
      added: ov.added,
      moved: ov.moved,
      removed: [...ov.removed],
    });
  },

  loadOverrides: function (canvasId, json) {
    try {
      const data = JSON.parse(json);
      const canvas = document.getElementById(canvasId);
      if (!canvas || !canvas._worldData) return false;
      this._overrides[canvasId] = {
        added: data.added || [],
        moved: data.moved || {},
        removed: new Set(data.removed || []),
      };
      this._applyOverrides(canvasId);
      return true;
    } catch { return false; }
  },

  resetOverrides: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData || !canvas._baseObjects) return;
    // Restore base objects
    canvas._worldData.objects = JSON.parse(JSON.stringify(canvas._baseObjects));
    this._overrides[canvasId] = { added: [], moved: {}, removed: new Set() };
    canvas._editSelectedObj = null;
    WorldRenderer.render(canvasId, canvas._worldData);
  },

  _applyOverrides: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData || !canvas._baseObjects) return;
    const ov = this.getOverrides(canvasId);

    // Start from base
    let objects = JSON.parse(JSON.stringify(canvas._baseObjects));

    // Apply removals
    objects = objects.filter(o => !ov.removed.has(o.id));

    // Apply moves
    for (const obj of objects) {
      if (ov.moved[obj.id]) {
        obj.x = ov.moved[obj.id].x;
        obj.y = ov.moved[obj.id].y;
      }
    }

    // Apply additions
    objects.push(...ov.added);

    canvas._worldData.objects = objects;
    WorldRenderer.render(canvasId, canvas._worldData);
  },

  // Edit mode API
  setEditMode: function (canvasId, enabled) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      canvas._editMode = enabled;
      canvas._editAction = null; // 'select' | 'move' | 'add' | null
      canvas._editSelectedObj = null;
      canvas._editAddType = null;
      if (canvas._worldData) WorldRenderer.render(canvasId, canvas._worldData);
    }
  },

  setEditAction: function (canvasId, action, addType) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      canvas._editAction = action;
      canvas._editAddType = addType || null;
    }
  },

  removeSelectedObject: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData || !canvas._editSelectedObj) return null;
    const wd = canvas._worldData;
    const idx = (wd.objects || []).findIndex(o => o.id === canvas._editSelectedObj);
    if (idx >= 0) {
      const removed = wd.objects.splice(idx, 1)[0];
      WorldRenderer.getOverrides(canvasId).removed.add(removed.id);
      canvas._editSelectedObj = null;
      // Post-edit invariant check
      const postRemove = WorldRenderer.validateInvariants(canvasId);
      canvas._validationResult = postRemove;
      WorldRenderer.render(canvasId, wd);
      setTimeout(() => { canvas._validationResult = null; WorldRenderer.render(canvasId, wd); }, 2000);
      return removed;
    }
    return null;
  },

  getObjects: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    return canvas?._worldData?.objects || [];
  },

  // Toggle door state: Open → Closed → Locked → Open
  toggleDoor: function (canvasId, doorId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return null;
    const door = (canvas._worldData.doors || []).find(d => d.id === doorId);
    if (!door) return null;
    const cycle = { 'Open': 'Closed', 'Closed': 'Locked', 'Locked': 'Open' };
    door.state = cycle[door.state] || 'Open';
    WorldRenderer.render(canvasId, canvas._worldData);
    return { id: door.id, state: door.state };
  },

  // Set specific door state
  setDoorState: function (canvasId, doorId, state) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return null;
    const door = (canvas._worldData.doors || []).find(d => d.id === doorId);
    if (!door) return null;
    door.state = state;
    WorldRenderer.render(canvasId, canvas._worldData);
    return { id: door.id, state: door.state };
  },

  // Find door at tile position
  findDoorAt: function (canvasId, tx, ty) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return null;
    return (canvas._worldData.doors || []).find(d => d.x === tx && d.y === ty) || null;
  },

  // Get object properties for a type
  getObjectProps: function (type) {
    return getObjProps(type);
  },

  // Get all object property definitions
  getObjectRegistry: function () {
    return OBJ_PROPS;
  },

  // Start idle animation loop (social behaviors + agent life)
  startIdleAnimation: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas._idleAnimRunning) return;
    canvas._idleAnimRunning = true;
    let frame = 0;
    setInterval(() => {
      if (!canvas._worldData) return;
      frame++;
      // Re-render every ~2s for social behavior animations (bubbles, proximity, zzz)
      if (frame % 6 === 0) {
        canvas._idleFrame = (canvas._idleFrame || 0) === 0 ? 1 : 0;
        WorldRenderer.render(canvasId, canvas._worldData);
      }
    }, 300);
  }
};
