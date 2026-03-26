import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

// Read the character generator source to inline it
const charGenSrc = readFileSync(join(__dirname, 'character-generator.js'), 'utf8')
  .replace(/^export /gm, '')
  .replace(/^import .*/gm, '');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const html = `<!DOCTYPE html>
<html><body style="background:#111;margin:0">
<canvas id="c" width="1400" height="880"></canvas>
<script>
${charGenSrc}

// Lighting
const LIGHT = { x: -0.4, y: -0.6, z: 0.7 };
function computeLight(hm, w, h) {
  const l = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=y*w+x; if(!hm[i])continue;
    const hL=x>0?hm[i-1]:hm[i],hR=x<w-1?hm[i+1]:hm[i];
    const hU=y>0?hm[i-w]:hm[i],hD=y<h-1?hm[i+w]:hm[i];
    const nx=(hL-hR)*0.5,ny=(hU-hD)*0.5,nz=1,len=Math.sqrt(nx*nx+ny*ny+nz*nz);
    l[i]=Math.max(0.25,Math.min(1.5,0.35+(nx/len*LIGHT.x+ny/len*LIGHT.y+nz/len*LIGHT.z)*1.3));
  }
  return l;
}
function hex2rgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
function rgb2hex(r,g,b){return'#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');}

function renderSprite(ctx, spr, px, py, scale) {
  const light = computeLight(spr.hm, spr.w, spr.h);
  // Outline
  ctx.fillStyle = '#000';
  for(let y=0;y<spr.h;y++) for(let x=0;x<spr.w;x++){
    if(!spr.c[y*spr.w+x])continue;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=spr.w||ny>=spr.h||!spr.c[ny*spr.w+nx]){ctx.fillRect(px+x*scale,py+y*scale,scale,scale);break;}
    }
  }
  // Sprite
  for(let y=0;y<spr.h;y++) for(let x=0;x<spr.w;x++){
    const i=y*spr.w+x; if(!spr.c[i])continue;
    const rgb=hex2rgb(spr.c[i]),b=light[i];
    ctx.fillStyle=rgb2hex(rgb.r*b,rgb.g*b,rgb.b*b);
    ctx.fillRect(px+x*scale,py+y*scale,scale,scale);
  }
}

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0,0,1400,880);

ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui';
ctx.fillText('AgentHabitat — Character Generator Sprite Sheet (32x32 @ 6x)', 20, 28);
ctx.fillStyle = '#888'; ctx.font = '12px system-ui';
ctx.fillText('4 agents × 4 directions × 2 frames | Configurable: skin, hair, eyes, outfit, accessory, body type', 20, 48);

const agents = Object.entries(AGENT_PRESETS);
const dirs = ['front', 'left', 'right', 'back'];
const scale = 6;
const cellW = 32 * scale + 8;
const cellH = 32 * scale + 8;

// Column headers
ctx.fillStyle = '#666'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
dirs.forEach((d, di) => {
  ['idle_A', 'idle_B'].forEach((f, fi) => {
    ctx.fillText(d + ' ' + f, 80 + (di * 2 + fi) * cellW + cellW/2, 64);
  });
});

agents.forEach(([id, config], ai) => {
  const baseY = 72 + ai * (cellH + 20);

  // Agent label
  ctx.fillStyle = config.outfitColor; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(id.charAt(0).toUpperCase() + id.slice(1), 8, baseY + cellH/2);
  ctx.fillStyle = '#555'; ctx.font = '9px system-ui';
  ctx.fillText(config.hairStyle + '/' + config.outfit, 8, baseY + cellH/2 + 14);
  ctx.fillText(config.accessory !== 'none' ? config.accessory : '', 8, baseY + cellH/2 + 26);

  dirs.forEach((dir, di) => {
    [0, 1].forEach((frame, fi) => {
      const x = 80 + (di * 2 + fi) * cellW;
      const y = baseY;
      // Cell bg
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath(); ctx.roundRect(x, y, 32*scale, 32*scale, 4); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x, y, 32*scale, 32*scale, 4); ctx.stroke();
      // Render
      const spr = generateCharacter(config, dir, frame);
      renderSprite(ctx, spr, x, y, scale);
    });
  });
});
</script>
</body></html>`;

  await page.setContent(html);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, 'chargen-spritesheet.png'), fullPage: true });
  console.log('Captured chargen-spritesheet.png');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
