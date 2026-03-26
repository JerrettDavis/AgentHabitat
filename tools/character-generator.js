/**
 * AgentHabitat — Procedural RPG Character Generator
 *
 * Generates consistent 32x32 pixel art character sprites from a config.
 * Same config = same output every time (deterministic).
 *
 * Supports: 4 directions × 2 frames (idle A/B) = 8 poses per character.
 */

// --- Skin tone palettes (base, shadow, highlight, blush) ---
export const SKIN_TONES = {
  light:  { base: '#ffd5a0', shadow: '#d4a870', highlight: '#ffe8c8', blush: '#f0b888' },
  medium: { base: '#d4a06a', shadow: '#b08050', highlight: '#e8c090', blush: '#c89060' },
  tan:    { base: '#c08850', shadow: '#9a6838', highlight: '#d8a870', blush: '#b07848' },
  dark:   { base: '#8a5a30', shadow: '#6a4020', highlight: '#a07040', blush: '#7a4a28' },
  deep:   { base: '#5a3520', shadow: '#3a2010', highlight: '#704828', blush: '#4a2a18' },
};

// --- Hair style definitions (front view offsets for 32x32 grid) ---
// Each style defines: topShape, sideShape, backLength, fringePattern
export const HAIR_STYLES = {
  curly:    { topRx: 9, topRy: 6, sideRx: 2, sideRy: 4, fringeY: 2, bangs: 'wavy',   backLen: 3 },
  straight: { topRx: 8, topRy: 5, sideRx: 2, sideRy: 3, fringeY: 1, bangs: 'flat',   backLen: 2 },
  spiky:    { topRx: 9, topRy: 7, sideRx: 1, sideRy: 2, fringeY: 0, bangs: 'spikes', backLen: 1 },
  bob:      { topRx: 8, topRy: 5, sideRx: 3, sideRy: 5, fringeY: 2, bangs: 'flat',   backLen: 4 },
  long:     { topRx: 8, topRy: 5, sideRx: 2, sideRy: 7, fringeY: 2, bangs: 'part',   backLen: 8 },
  buzz:     { topRx: 6, topRy: 3, sideRx: 1, sideRy: 2, fringeY: 0, bangs: 'none',   backLen: 1 },
};

// --- Outfit templates ---
export const OUTFITS = {
  tshirt:  { collarH: 1, sleeveLen: 3, hemY: 22, hasButtons: false, hasLapels: false },
  hoodie:  { collarH: 2, sleeveLen: 5, hemY: 23, hasButtons: false, hasLapels: false },
  suit:    { collarH: 2, sleeveLen: 4, hemY: 22, hasButtons: true,  hasLapels: true },
  labcoat: { collarH: 1, sleeveLen: 5, hemY: 24, hasButtons: true,  hasLapels: true },
  casual:  { collarH: 1, sleeveLen: 3, hemY: 21, hasButtons: false, hasLapels: false },
};

// --- Accessory definitions ---
export const ACCESSORIES = {
  none:    null,
  glasses: { type: 'face', drawFn: 'drawGlasses' },
  headset: { type: 'head', drawFn: 'drawHeadset' },
  hat:     { type: 'head', drawFn: 'drawHat' },
  scarf:   { type: 'neck', drawFn: 'drawScarf' },
};

/**
 * @typedef {Object} CharacterConfig
 * @property {string} skinTone - 'light'|'medium'|'tan'|'dark'|'deep'
 * @property {string} hairStyle - 'curly'|'straight'|'spiky'|'bob'|'long'|'buzz'
 * @property {string} hairColor - hex color
 * @property {string} eyeColor - hex color
 * @property {string} outfit - 'tshirt'|'hoodie'|'suit'|'labcoat'|'casual'
 * @property {string} outfitColor - hex color
 * @property {string} outfitAccent - hex color
 * @property {string} accessory - 'none'|'glasses'|'headset'|'hat'|'scarf'
 * @property {string} bodyType - 'slim'|'average'|'broad'
 */

/**
 * Generate a character sprite.
 * @param {CharacterConfig} config
 * @param {'front'|'back'|'left'|'right'} direction
 * @param {0|1} frame - animation frame
 * @returns {{ w: number, h: number, c: (string|null)[], hm: Float32Array }}
 */
export function generateCharacter(config, direction = 'front', frame = 0) {
  const w = 32, h = 32;
  const c = new Array(w * h).fill(null);
  const hm = new Float32Array(w * h);

  const skin = SKIN_TONES[config.skinTone] || SKIN_TONES.light;
  const hair = HAIR_STYLES[config.hairStyle] || HAIR_STYLES.straight;
  const outfit = OUTFITS[config.outfit] || OUTFITS.tshirt;
  const bodyW = config.bodyType === 'slim' ? 4 : config.bodyType === 'broad' ? 6 : 5;

  const hcD = shade(config.hairColor, 0.55);
  const hcM = config.hairColor;
  const hcL = shade(config.hairColor, 1.35);
  const ocD = shade(config.outfitColor, 0.55);
  const ocM = config.outfitColor;
  const ocL = shade(config.outfitColor, 1.35);

  // Helpers
  function ap(x, y, col, d) {
    if (x >= 0 && y >= 0 && x < w && y < h) {
      c[y * w + x] = col;
      hm[y * w + x] = Math.max(hm[y * w + x], d);
    }
  }
  function aE(cx, cy, rx, ry, col, d) {
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++)
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1)
          ap(cx + dx, cy + dy, col, d);
  }
  function aR(x1, y1, rw, rh, col, d) {
    for (let dy = 0; dy < rh; dy++)
      for (let dx = 0; dx < rw; dx++)
        ap(x1 + dx, y1 + dy, col, d);
  }

  const legSwing = frame === 1 ? 3 : 0;
  const armSwing = frame === 1 ? 1 : 0;
  const cx = 16; // center x

  if (direction === 'front') {
    // --- HAIR ---
    aE(cx, 4, hair.topRx, hair.topRy, hcM, 9);
    aE(cx, 3, hair.topRx - 1, hair.topRy - 1, hcL, 10);
    aE(cx, 5, hair.topRx, hair.topRy, hcD, 8);
    if (hair.bangs === 'wavy') { aE(cx - 4, 5, 3, 2, hcL, 10); aE(cx + 4, 5, 3, 2, hcM, 9.5); }
    if (hair.bangs === 'spikes') { for (let i = -3; i <= 3; i += 2) ap(cx + i, 0, hcL, 11); }
    if (hair.bangs === 'part') { aR(cx - 5, 5, 4, 2, hcL, 10); aR(cx + 1, 5, 5, 2, hcD, 9); }
    aE(cx - 7, 8, hair.sideRx, hair.sideRy, hcD, 7);
    aE(cx + 7, 8, hair.sideRx, hair.sideRy, hcD, 7);

    // --- HEAD (precise pixel placement for clean face) ---
    // Face outline — rounded rectangle, not ellipse
    //   Row 6:     ..xxxx..   (forehead top, 4px wide)
    //   Row 7:    .xxxxxx.   (forehead, 6px)
    //   Row 8-11:  xxxxxxxx   (full face, 8px)
    //   Row 12:   .xxxxxx.   (jaw taper)
    //   Row 13:    ..xxxx..   (chin)
    const faceRows = {
      6:  [cx-2, cx+2],  // 4px
      7:  [cx-3, cx+3],  // 6px
      8:  [cx-4, cx+4],  // 8px
      9:  [cx-4, cx+4],
      10: [cx-4, cx+4],
      11: [cx-4, cx+4],
      12: [cx-3, cx+3],  // jaw taper
      13: [cx-2, cx+2],  // chin
    };
    for (const [row, [l, r]] of Object.entries(faceRows)) {
      const y = parseInt(row);
      for (let x = l; x <= r; x++) {
        const isEdge = (x === l || x === r);
        const isTop = (y <= 7);
        const isBottom = (y >= 12);
        const col = isTop ? skin.highlight : isBottom ? skin.shadow : isEdge ? skin.shadow : skin.base;
        const d = isEdge ? 7.5 : 8;
        ap(x, y, col, d);
      }
    }
    // Cheek blush (single pixels, precise)
    ap(cx - 3, 10, skin.blush, 8.1);
    ap(cx + 3, 10, skin.blush, 8.1);

    // --- EYES (precise, 3x2 each, clear definition) ---
    // Left eye: 3 wide × 2 tall at (cx-4, 8)
    ap(cx-4, 8, '#fff', 9);  ap(cx-3, 8, '#fff', 9);  ap(cx-2, 8, '#fff', 9);
    ap(cx-4, 9, '#fff', 9);  ap(cx-3, 9, config.eyeColor, 9.3); ap(cx-2, 9, config.eyeColor, 9.3);
    ap(cx-3, 9, '#111', 9.6); // pupil (on top of iris)
    ap(cx-4, 8, '#fff', 10);  // sparkle top-left

    // Right eye: 3 wide × 2 tall at (cx+2, 8)
    ap(cx+2, 8, '#fff', 9);  ap(cx+3, 8, '#fff', 9);  ap(cx+4, 8, '#fff', 9);
    ap(cx+2, 9, config.eyeColor, 9.3); ap(cx+3, 9, config.eyeColor, 9.3); ap(cx+4, 9, '#fff', 9);
    ap(cx+3, 9, '#111', 9.6); // pupil
    ap(cx+4, 8, '#fff', 10);  // sparkle top-right

    // --- EYEBROWS (2px each, slight arch) ---
    ap(cx-4, 7, hcD, 9.5); ap(cx-3, 7, hcD, 9.5);
    ap(cx+3, 7, hcD, 9.5); ap(cx+4, 7, hcD, 9.5);

    // --- NOSE (1px wide, 2px tall, centered) ---
    ap(cx, 10, skin.shadow, 8.5);
    ap(cx, 11, skin.base, 8.2);

    // --- MOUTH (3px wide, clear shape) ---
    ap(cx-1, 12, '#b06848', 8.3);
    ap(cx,   12, '#c87858', 8.4);
    ap(cx+1, 12, '#b06848', 8.3);

    // --- GLASSES (occlusion-aware — drawn over face, reserves pixels) ---
    if (config.accessory === 'glasses') {
      // Frame outline
      ap(cx-5, 8, '#222', 10); ap(cx-5, 9, '#222', 10); ap(cx-5, 10, '#222', 10);
      ap(cx-1, 8, '#222', 10); ap(cx-1, 9, '#222', 10); ap(cx-1, 10, '#222', 10);
      ap(cx-4, 8, '#222', 10); ap(cx-2, 8, '#222', 10); // top
      ap(cx-4, 10, '#222', 10); ap(cx-2, 10, '#222', 10); // bottom
      // Right lens
      ap(cx+1, 8, '#222', 10); ap(cx+1, 9, '#222', 10); ap(cx+1, 10, '#222', 10);
      ap(cx+5, 8, '#222', 10); ap(cx+5, 9, '#222', 10); ap(cx+5, 10, '#222', 10);
      ap(cx+2, 8, '#222', 10); ap(cx+4, 8, '#222', 10);
      ap(cx+2, 10, '#222', 10); ap(cx+4, 10, '#222', 10);
      // Bridge
      ap(cx, 9, '#222', 10);
      // Lens tint
      ap(cx-4, 9, '#88bbdd', 9.8); ap(cx-3, 9, '#88bbdd', 9.8);
      ap(cx+3, 9, '#88bbdd', 9.8); ap(cx+4, 9, '#88bbdd', 9.8);
    }

    // --- HEADSET (if accessory) ---
    if (config.accessory === 'headset') {
      // Headband arc over hair
      ap(cx-6, 5, '#333', 10); ap(cx-6, 6, '#333', 10); ap(cx-6, 7, '#333', 10);
      ap(cx-6, 8, '#444', 10); ap(cx-6, 9, '#555', 10.5); // earpiece
      ap(cx-7, 8, '#555', 10); ap(cx-7, 9, '#666', 10.5);
      // Mic arm
      ap(cx-7, 10, '#444', 9); ap(cx-7, 11, '#444', 9); ap(cx-6, 12, '#555', 9.5);
    }

    // --- NECK ---
    ap(cx-1, 14, skin.shadow, 5.5);
    ap(cx, 14, skin.base, 5.5);
    ap(cx+1, 14, skin.shadow, 5.5);

    // --- BODY ---
    aE(cx, 19, bodyW, 6, ocM, 5);
    aE(cx - 2, 19, 2, 5, ocD, 4.5);
    aE(cx + 2, 19, 2, 5, ocD, 4.5);
    aE(cx, 18, 3, 3, ocL, 5.5);

    // Collar
    if (outfit.hasLapels) {
      ap(cx - 2, 15, ocD, 5.8); ap(cx - 1, 15, '#fff', 6);
      ap(cx + 1, 15, '#fff', 6); ap(cx + 2, 15, ocD, 5.8);
    } else {
      aR(cx - 2, 15, 5, outfit.collarH, config.outfitAccent || '#fff', 5.9);
    }
    // Buttons
    if (outfit.hasButtons) {
      ap(cx, 17, ocD, 5.3); ap(cx, 19, ocD, 5.3); ap(cx, 21, ocD, 5.3);
    }

    // --- ARMS ---
    aE(cx - 8 - armSwing, 18, 2, 4, ocM, 4);
    aE(cx - 8 - armSwing, 23, 2, 1, skin.base, 3);
    aE(cx + 8 + armSwing, 18, 2, 4, ocM, 4);
    aE(cx + 8 + armSwing, 23, 2, 1, skin.base, 3);

    // --- LEGS ---
    aE(cx - 3, 25 - legSwing, 2, 3, '#2a2a40', 4);
    aE(cx + 3, 25 + legSwing, 2, 3, '#2a2a40', 4);

    // --- SHOES ---
    aE(cx - 3, 29 - legSwing, 3, 1, '#2a1a1a', 2);
    aE(cx + 3, 29 + legSwing, 3, 1, '#2a1a1a', 2);

    // --- HEADSET ---
    if (config.accessory === 'headset') {
      ap(cx - 6, 7, '#333', 9); ap(cx - 6, 8, '#333', 9); ap(cx - 6, 9, '#555', 9.5);
      aR(cx - 7, 7, 1, 4, '#444', 8);
    }
  }
  else if (direction === 'back') {
    // Hair back (dominant)
    aE(cx, 4, hair.topRx, hair.topRy, hcD, 9);
    aE(cx, 3, hair.topRx - 1, hair.topRy - 1, hcM, 9.5);
    aE(cx, 2, hair.topRx - 2, hair.topRy - 2, hcL, 10);
    aE(cx - 7, 8, hair.sideRx, hair.sideRy + 1, hcD, 7);
    aE(cx + 7, 8, hair.sideRx, hair.sideRy + 1, hcD, 7);
    // Back hair length
    if (hair.backLen > 2) aR(cx - 3, 10, 6, hair.backLen, hcD, 6);
    // Head back (minimal skin)
    aE(cx, 9, 5, 5, skin.base, 7);
    aE(cx, 7, 4, 4, hcM, 8);
    aR(cx - 3, 12, 6, 1, skin.shadow, 7);
    // Neck
    aR(cx - 2, 13, 4, 2, skin.shadow, 5);
    // Body back
    aE(cx, 19, bodyW, 6, ocM, 5);
    aE(cx - 2, 19, 2, 5, ocD, 4.5);
    aE(cx + 2, 19, 2, 5, ocD, 4.5);
    if (outfit.hasButtons) aR(cx - 1, 16, 3, 8, ocL, 5.2); // back panel
    // Arms
    aE(cx - 8 + armSwing, 18, 2, 4, ocM, 4); aE(cx - 8 + armSwing, 23, 2, 1, skin.base, 3);
    aE(cx + 8 - armSwing, 18, 2, 4, ocM, 4); aE(cx + 8 - armSwing, 23, 2, 1, skin.base, 3);
    // Legs + shoes
    aE(cx - 3, 25 + legSwing, 2, 3, '#2a2a40', 4); aE(cx + 3, 25 - legSwing, 2, 3, '#2a2a40', 4);
    aE(cx - 3, 29 + legSwing, 3, 1, '#2a1a1a', 2); aE(cx + 3, 29 - legSwing, 3, 1, '#2a1a1a', 2);
  }
  else if (direction === 'left') {
    // Hair side
    aE(cx - 2, 4, hair.topRx - 1, hair.topRy, hcM, 9);
    aE(cx - 2, 3, hair.topRx - 2, hair.topRy - 1, hcL, 10);
    aE(cx - 8, 8, hair.sideRx, hair.sideRy, hcD, 7);
    if (hair.backLen > 2) aR(cx + 2, 8, 2, hair.backLen, hcD, 6);
    // Head
    aE(cx - 2, 9, 5, 5, skin.base, 8);
    aE(cx - 2, 7, 3, 2, skin.highlight, 8.8);
    // One eye
    aE(cx - 4, 9, 2, 2, '#fff', 9); aE(cx - 4, 9, 1, 2, config.eyeColor, 9.3);
    ap(cx - 4, 10, '#112', 9.8); ap(cx - 3, 8, '#fff', 10);
    // Nose profile
    ap(cx - 7, 10, skin.shadow, 9); ap(cx - 7, 11, skin.base, 8.5);
    // Mouth
    ap(cx - 6, 12, '#c08060', 8.2); ap(cx - 5, 12, '#d09070', 8.3);
    // Ear
    ap(cx + 2, 9, skin.shadow, 7); ap(cx + 2, 10, skin.base, 7.5);
    // Neck
    aR(cx - 3, 14, 3, 1, skin.shadow, 5.5);
    // Body
    aE(cx - 2, 19, bodyW - 1, 6, ocM, 5); aE(cx - 4, 19, 2, 5, ocD, 4.5);
    aE(cx - 1, 18, 2, 3, ocL, 5.5);
    // Front arm
    aE(cx - 6 - armSwing, 18, 2, 4, ocM, 4); aE(cx - 6 - armSwing, 23, 2, 1, skin.base, 3);
    // Back arm peek
    aE(cx + 2, 18, 1, 3, ocD, 3);
    // Legs
    aE(cx - 3, 25 - legSwing, 2, 3, '#2a2a40', 4); aE(cx - 1, 25 + legSwing, 2, 3, '#1a1a30', 3.5);
    aE(cx - 3, 29 - legSwing, 3, 1, '#2a1a1a', 2); aE(cx - 1, 29 + legSwing, 2, 1, '#1a1010', 1.8);
    // Glasses side
    if (config.accessory === 'glasses') { aR(cx - 6, 9, 3, 2, '#333', 9.5); ap(cx - 3, 9, '#333', 9.3); }
  }
  else { // right — mirror of left
    aE(cx + 2, 4, hair.topRx - 1, hair.topRy, hcM, 9);
    aE(cx + 2, 3, hair.topRx - 2, hair.topRy - 1, hcL, 10);
    aE(cx + 8, 8, hair.sideRx, hair.sideRy, hcD, 7);
    if (hair.backLen > 2) aR(cx - 4, 8, 2, hair.backLen, hcD, 6);
    aE(cx + 2, 9, 5, 5, skin.base, 8);
    aE(cx + 2, 7, 3, 2, skin.highlight, 8.8);
    aE(cx + 4, 9, 2, 2, '#fff', 9); aE(cx + 4, 9, 1, 2, config.eyeColor, 9.3);
    ap(cx + 4, 10, '#112', 9.8); ap(cx + 3, 8, '#fff', 10);
    ap(cx + 7, 10, skin.shadow, 9); ap(cx + 7, 11, skin.base, 8.5);
    ap(cx + 6, 12, '#c08060', 8.2); ap(cx + 5, 12, '#d09070', 8.3);
    ap(cx - 2, 9, skin.shadow, 7); ap(cx - 2, 10, skin.base, 7.5);
    aR(cx, 14, 3, 1, skin.shadow, 5.5);
    aE(cx + 2, 19, bodyW - 1, 6, ocM, 5); aE(cx + 4, 19, 2, 5, ocD, 4.5);
    aE(cx + 1, 18, 2, 3, ocL, 5.5);
    aE(cx + 6 + armSwing, 18, 2, 4, ocM, 4); aE(cx + 6 + armSwing, 23, 2, 1, skin.base, 3);
    aE(cx - 2, 18, 1, 3, ocD, 3);
    aE(cx + 3, 25 - legSwing, 2, 3, '#2a2a40', 4); aE(cx + 1, 25 + legSwing, 2, 3, '#1a1a30', 3.5);
    aE(cx + 3, 29 - legSwing, 3, 1, '#2a1a1a', 2); aE(cx + 1, 29 + legSwing, 2, 1, '#1a1010', 1.8);
    if (config.accessory === 'glasses') { aR(cx + 3, 9, 3, 2, '#333', 9.5); ap(cx + 3, 9, '#333', 9.3); }
  }

  return { w, h, c, hm };
}

function shade(hex, factor) {
  const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * factor)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// --- Preset characters for our agents ---
export const AGENT_PRESETS = {
  claude: {
    skinTone: 'light', hairStyle: 'curly', hairColor: '#f97316',
    eyeColor: '#4488cc', outfit: 'tshirt', outfitColor: '#f97316',
    outfitAccent: '#fff', accessory: 'none', bodyType: 'average',
  },
  copilot: {
    skinTone: 'medium', hairStyle: 'straight', hairColor: '#3b82f6',
    eyeColor: '#2266aa', outfit: 'hoodie', outfitColor: '#3b82f6',
    outfitAccent: '#ddd', accessory: 'headset', bodyType: 'average',
  },
  jdai: {
    skinTone: 'light', hairStyle: 'spiky', hairColor: '#22c55e',
    eyeColor: '#22aa44', outfit: 'casual', outfitColor: '#22c55e',
    outfitAccent: '#333', accessory: 'glasses', bodyType: 'slim',
  },
  ralph: {
    skinTone: 'tan', hairStyle: 'bob', hairColor: '#a855f7',
    eyeColor: '#8844cc', outfit: 'suit', outfitColor: '#a855f7',
    outfitAccent: '#fff', accessory: 'none', bodyType: 'broad',
  },
};
