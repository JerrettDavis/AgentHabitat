/**
 * Canvas-based world renderer for Blazor JS interop.
 * Receives WorldRenderData from C# and draws to a canvas element.
 */

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
    const tileSize = 32;
    const W = worldData.width, H = worldData.height;

    canvas.width = W * tileSize;
    canvas.height = H * tileSize;

    // Draw tiles
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = worldData.tiles[y * W + x];
        const px = x * tileSize, py = y * tileSize;

        if (tile === 0) {
          ctx.fillStyle = pal.void;
        } else if (tile === 1) {
          ctx.fillStyle = pal.corridor;
        } else {
          // Find which room this belongs to
          const room = worldData.rooms.find(r =>
            x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
          );
          ctx.fillStyle = room ? (pal.rooms[room.archetype] || pal.roomFloor) : pal.roomFloor;
        }
        ctx.fillRect(px, py, tileSize, tileSize);

        // Grid dots
        if (tile > 0) {
          ctx.fillStyle = '#ffffff04';
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    // Room borders
    for (const room of worldData.rooms) {
      const rx = room.x * tileSize, ry = room.y * tileSize;
      const rw = room.width * tileSize, rh = room.height * tileSize;

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
      ctx.strokeStyle = pal.wall;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 3, ry + 3, rw - 6, rh - 6);

      // Label
      ctx.fillStyle = pal.label;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        room.archetype.replace('Room', ' Room'),
        rx + rw / 2,
        ry + 16
      );
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
  }
};
