/**
 * Heightmap-based pixel art sprite renderer.
 * Each sprite is defined by a color map + heightmap.
 * Per-pixel lighting is computed from the heightmap gradient
 * with a directional light source, giving proper shadows/highlights.
 */

// Light direction (normalized) — top-left overhead
const LIGHT_DIR = { x: -0.4, y: -0.6, z: 0.7 };

/**
 * Compute per-pixel lighting from heightmap.
 * Returns brightness multiplier [0.3 - 1.4] for each pixel.
 */
function computeLighting(heightmap, w, h) {
  const light = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (heightmap[idx] === 0) { light[idx] = 0; continue; }

      // Compute normal from heightmap gradient (Sobel-like)
      const hL = x > 0 ? heightmap[idx - 1] : heightmap[idx];
      const hR = x < w-1 ? heightmap[idx + 1] : heightmap[idx];
      const hU = y > 0 ? heightmap[idx - w] : heightmap[idx];
      const hD = y < h-1 ? heightmap[idx + w] : heightmap[idx];

      const nx = (hL - hR) * 0.5;
      const ny = (hU - hD) * 0.5;
      const nz = 1.0;
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);

      // Dot product with light direction
      const dot = (nx/len * LIGHT_DIR.x + ny/len * LIGHT_DIR.y + nz/len * LIGHT_DIR.z);
      // Ambient + diffuse
      light[idx] = Math.max(0.3, Math.min(1.4, 0.4 + dot * 1.0));
    }
  }
  return light;
}

/**
 * Apply ambient occlusion — darken pixels near edges/corners.
 */
function computeAO(heightmap, w, h) {
  const ao = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (heightmap[idx] === 0) { ao[idx] = 1; continue; }
      let occluded = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || heightmap[ny * w + nx] === 0) {
            occluded++;
          }
        }
      }
      ao[idx] = 1.0 - occluded * 0.06;
    }
  }
  return ao;
}

/**
 * Parse hex color to RGB.
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));
  return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
}

/**
 * Render a heightmap sprite to canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} sprite — { width, height, colors: string[], heightmap: number[] }
 * @param {number} px, py — canvas position
 * @param {number} scale — pixel scale (1 = 1:1)
 */
export function renderHeightmapSprite(ctx, sprite, px, py, scale = 1) {
  const { width: w, height: h, colors, heightmap } = sprite;
  const lighting = computeLighting(heightmap, w, h);
  const ao = computeAO(heightmap, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const color = colors[idx];
      if (!color || color === 'transparent') continue;

      const rgb = hexToRgb(color);
      const brightness = lighting[idx] * ao[idx];
      const lit = rgbToHex(
        rgb.r * brightness,
        rgb.g * brightness,
        rgb.b * brightness
      );
      ctx.fillStyle = lit;
      ctx.fillRect(px + x * scale, py + y * scale, scale, scale);
    }
  }
}

// --- Sprite Definitions (32x32 with heightmaps) ---

/**
 * Create a desk sprite with heightmap.
 */
export function createDesk(palette) {
  const w = 32, h = 32;
  const colors = new Array(w * h).fill(null);
  const heightmap = new Float32Array(w * h);

  // Desk surface (y: 4-14, x: 4-27)
  for (let y = 4; y < 15; y++) {
    for (let x = 4; x < 28; x++) {
      const idx = y * w + x;
      colors[idx] = palette.wood;
      heightmap[idx] = 4 + (y === 4 ? 1 : 0); // slight edge raise
    }
  }
  // Desk top highlight strip
  for (let x = 5; x < 27; x++) {
    colors[5 * w + x] = palette.woodLight;
    heightmap[5 * w + x] = 5;
  }
  // Legs
  for (let y = 15; y < 22; y++) {
    for (const lx of [5, 6, 25, 26]) {
      colors[y * w + lx] = palette.woodDark;
      heightmap[y * w + lx] = 2;
    }
  }
  // Monitor on desk
  for (let y = 1; y < 4; y++) {
    for (let x = 12; x < 20; x++) {
      colors[y * w + x] = palette.metal;
      heightmap[y * w + x] = 6;
    }
  }
  // Screen
  for (let y = 1; y < 3; y++) {
    for (let x = 13; x < 19; x++) {
      colors[y * w + x] = palette.screen;
      heightmap[y * w + x] = 6.5;
    }
  }
  // Monitor stand
  colors[4 * w + 15] = palette.metal;
  colors[4 * w + 16] = palette.metal;
  heightmap[4 * w + 15] = 5;
  heightmap[4 * w + 16] = 5;

  return { width: w, height: h, colors, heightmap };
}

export function createChair(palette) {
  const w = 32, h = 32;
  const colors = new Array(w * h).fill(null);
  const heightmap = new Float32Array(w * h);

  // Seat (y: 10-16, x: 10-22)
  for (let y = 10; y < 17; y++) {
    for (let x = 10; x < 23; x++) {
      colors[y * w + x] = palette.fabric;
      heightmap[y * w + x] = 3;
    }
  }
  // Backrest (y: 4-10, x: 12-20)
  for (let y = 4; y < 10; y++) {
    for (let x = 12; x < 21; x++) {
      colors[y * w + x] = palette.fabric;
      heightmap[y * w + x] = 5 + (10 - y) * 0.3;
    }
  }
  // Legs
  for (let y = 17; y < 22; y++) {
    for (const lx of [11, 21]) {
      colors[y * w + lx] = palette.metal;
      heightmap[y * w + lx] = 1;
    }
  }
  // Wheels
  for (const lx of [10, 12, 20, 22]) {
    colors[22 * w + lx] = palette.metalDark;
    heightmap[22 * w + lx] = 0.5;
  }

  return { width: w, height: h, colors, heightmap };
}

export function createPlant(palette) {
  const w = 32, h = 32;
  const colors = new Array(w * h).fill(null);
  const heightmap = new Float32Array(w * h);

  // Pot (y: 20-26, x: 12-20)
  for (let y = 20; y < 27; y++) {
    const inset = Math.max(0, Math.floor((y - 20) * 0.3));
    for (let x = 12 + inset; x < 20 - inset; x++) {
      colors[y * w + x] = palette.pot;
      heightmap[y * w + x] = 3 - inset * 0.5;
    }
  }
  // Pot rim
  for (let x = 11; x < 21; x++) {
    colors[20 * w + x] = palette.potRim;
    heightmap[20 * w + x] = 4;
  }
  // Stem
  for (let y = 14; y < 20; y++) {
    colors[y * w + 15] = palette.stem;
    colors[y * w + 16] = palette.stem;
    heightmap[y * w + 15] = 2;
    heightmap[y * w + 16] = 2;
  }
  // Leaves (organic blob)
  const leafCenters = [[14,10],[18,8],[12,7],[16,5],[20,9],[15,3]];
  for (const [cx, cy] of leafCenters) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx*dx + dy*dy > 5) continue;
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && py >= 0 && px < w && py < h) {
          const dist = Math.sqrt(dx*dx + dy*dy);
          colors[py * w + px] = dist < 1.5 ? palette.leafDark : palette.leaf;
          heightmap[py * w + px] = Math.max(heightmap[py * w + px], 6 - dist);
        }
      }
    }
  }

  return { width: w, height: h, colors, heightmap };
}

// Material palettes per theme
export const MATERIAL_PALETTES = {
  'retro-office': {
    wood: '#8b6914', woodLight: '#b8960b', woodDark: '#6b4e1e',
    metal: '#a0a0a0', metalDark: '#707070',
    screen: '#1a4a6a', fabric: '#4a3a6a',
    pot: '#8b5e3c', potRim: '#a07050', stem: '#3a5a2a',
    leaf: '#4a8a4a', leafDark: '#2d6a2d',
  },
  'forest-lab': {
    wood: '#5a4a28', woodLight: '#7a6a38', woodDark: '#3a2a14',
    metal: '#808080', metalDark: '#505050',
    screen: '#1a3a2a', fabric: '#3a5a3a',
    pot: '#7a4a2a', potRim: '#906040', stem: '#2a4a1a',
    leaf: '#5a9a5a', leafDark: '#3a7a3a',
  },
  'neon-hq': {
    wood: '#3a2a3a', woodLight: '#5a3a5a', woodDark: '#2a1a2a',
    metal: '#6060a0', metalDark: '#404060',
    screen: '#0a2a4a', fabric: '#4a2a5a',
    pot: '#5a3a4a', potRim: '#7a5060', stem: '#2a3a2a',
    leaf: '#3a6a5a', leafDark: '#2a5a4a',
  },
};
