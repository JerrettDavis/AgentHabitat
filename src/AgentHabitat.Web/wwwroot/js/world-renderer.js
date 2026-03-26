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
    rooms: { CodingRoom: '#1e3a5f', ReviewRoom: '#2d4a2e', Library: '#4a3728', Lounge: '#3d2c4a' },
    wall: '#16213e', accent: '#e76f51', label: '#8ecae6',
  },
  'forest-lab': {
    void: '#081a0a', corridor: '#1a3820', roomFloor: '#2d5a32',
    rooms: { CodingRoom: '#1e5a35', ReviewRoom: '#2a6a3a', Library: '#5a4020', Lounge: '#3a5a2a' },
    wall: '#1a3a1e', accent: '#ee6c4d', label: '#c0e8d0',
  },
  'neon-hq': {
    void: '#05050f', corridor: '#1a1038', roomFloor: '#2a1a4e',
    rooms: { CodingRoom: '#3a1a6f', ReviewRoom: '#1a3a6f', Library: '#5a2a1f', Lounge: '#2a4a5f' },
    wall: '#1a0a2e', accent: '#f472b6', label: '#c084fc',
  },
};

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

        if (tile === 0) {
          ctx.fillStyle = tintColor(pal.void, litTint);
        } else if (tile === 1) {
          ctx.fillStyle = tintColor(pal.corridor, litTint);
        } else {
          const room = worldData.rooms.find(r =>
            x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
          );
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
      const labelText = room.archetype.replace('Room', ' Room');
      const tm = ctx.measureText(labelText);
      const lx = rx + rw / 2, ly = ry + 14;
      ctx.fillStyle = '#00000070';
      ctx.beginPath();
      ctx.roundRect(lx - tm.width / 2 - 6, ly - 10, tm.width + 12, 18, 4);
      ctx.fill();
      ctx.fillStyle = pal.label;
      ctx.fillText(labelText, lx, ly + 2);
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
      } else {
        // Fallback dot
        ctx.fillStyle = pal.accent + '40';
        ctx.beginPath(); ctx.arc(ox+16, oy+16, 8, 0, Math.PI*2); ctx.fill();
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

    // Store world data for click handler
    canvas._worldData = worldData;
    canvas._tileSize = tileSize;
    canvas._pal = pal;

    // Click + right-click handlers (only add once)
    if (!canvas._clickHandlerSet) {
      canvas._clickHandlerSet = true;
      canvas.style.cursor = 'pointer';

      // Hover tooltip
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wd = canvas._worldData;
        const ts = canvas._tileSize;
        if (!wd) return;

        const tx = Math.floor(mx / ts);
        const ty = Math.floor(my / ts);

        const hovAgent = (wd.agents || []).find(a => a.x === tx && a.y === ty);
        const hovRoom = wd.rooms.find(r =>
          tx >= r.x && tx < r.x + r.width && ty >= r.y && ty < r.y + r.height
        );

        if (hovAgent) {
          canvas.title = `${hovAgent.name || hovAgent.id} (${hovAgent.role || 'agent'}) — ${hovAgent.status}`;
          canvas.style.cursor = 'pointer';
        } else if (hovRoom) {
          canvas.title = `${hovRoom.archetype.replace('Room', ' Room')} [${hovRoom.id}]`;
          canvas.style.cursor = 'pointer';
        } else {
          canvas.title = '';
          canvas.style.cursor = 'default';
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
        if (wd.tiles[ty * wd.width + tx] > 0) {
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
        const clickedAgent = (wd.agents || []).find(a => a.x === tx && a.y === ty);
        if (clickedAgent) {
          canvas._selectedAgentId = clickedAgent.id;
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

  // Movement prototype — move an agent toward a target tile
  moveAgent: function (canvasId, agentId, targetX, targetY) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._worldData) return;
    const wd = canvas._worldData;
    const agent = (wd.agents || []).find(a => a.id === agentId);
    if (!agent) return;

    // Simple BFS pathfinding on walkable grid
    const W = wd.width, H = wd.height;
    const isWalkable = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      return wd.tiles[y * W + x] > 0;
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
        if (isWalkable(nx, ny) && !visited.has(key)) {
          visited.add(key);
          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
        }
      }
    }

    if (!foundPath || foundPath.length === 0) return;

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
        WorldRenderer.render(canvasId, wd);
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

  // Start idle animation loop (agents sway slightly)
  startIdleAnimation: function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas._idleAnimRunning) return;
    canvas._idleAnimRunning = true;
    let frame = 0;
    setInterval(() => {
      if (!canvas._worldData) return;
      frame++;
      // Every 2 seconds, toggle idle frame for visual life
      if (frame % 10 === 0) {
        canvas._idleFrame = (canvas._idleFrame || 0) === 0 ? 1 : 0;
        WorldRenderer.render(canvasId, canvas._worldData);
      }
    }, 200);
  }
};
