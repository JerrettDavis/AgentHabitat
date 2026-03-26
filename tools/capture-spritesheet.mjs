import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });

  const html = `<!DOCTYPE html>
<html><body style="background:#1a1a2e;margin:0;padding:20px">
<canvas id="c" width="1200" height="560"></canvas>
<script>
const LIGHT = { x: -0.4, y: -0.6, z: 0.7 };

function computeLight(hm, w, h) {
  const l = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!hm[i]) continue;
    const hL = x > 0 ? hm[i-1] : hm[i], hR = x < w-1 ? hm[i+1] : hm[i];
    const hU = y > 0 ? hm[i-w] : hm[i], hD = y < h-1 ? hm[i+w] : hm[i];
    const nx = (hL-hR)*0.5, ny = (hU-hD)*0.5, nz = 1;
    const len = Math.sqrt(nx*nx+ny*ny+nz*nz);
    l[i] = Math.max(0.25, Math.min(1.5, 0.35 + (nx/len*LIGHT.x + ny/len*LIGHT.y + nz/len*LIGHT.z) * 1.3));
  }
  return l;
}
function hex2rgb(h) { return {r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}; }
function rgb2hex(r,g,b) { return '#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join(''); }
function shade(hex, f) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return rgb2hex(r*f,g*f,b*f);
}

function renderSprite(ctx, spr, px, py, scale) {
  const light = computeLight(spr.hm, spr.w, spr.h);
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    const i = y * spr.w + x;
    if (!spr.c[i]) continue;
    const rgb = hex2rgb(spr.c[i]);
    const b = light[i];
    ctx.fillStyle = rgb2hex(rgb.r*b, rgb.g*b, rgb.b*b);
    ctx.fillRect(px + x*scale, py + y*scale, scale, scale);
  }
  // Outline
  ctx.fillStyle = '#000';
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    if (!spr.c[y*spr.w+x]) continue;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy;
      if (nx<0||ny<0||nx>=spr.w||ny>=spr.h||!spr.c[ny*spr.w+nx]) {
        ctx.fillRect(px+x*scale, py+y*scale, scale, scale);
        break;
      }
    }
  }
  // Redraw sprite on top of outline
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    const i = y * spr.w + x;
    if (!spr.c[i]) continue;
    const rgb = hex2rgb(spr.c[i]);
    const b = light[i];
    ctx.fillStyle = rgb2hex(rgb.r*b, rgb.g*b, rgb.b*b);
    ctx.fillRect(px + x*scale, py + y*scale, scale, scale);
  }
}

function buildAgent(color, name) {
  const w=32, h=32, c=new Array(w*h).fill(null), hm=new Float32Array(w*h);
  const cD=shade(color,0.55), cM=color, cL=shade(color,1.35);
  const sk='#ffd5a0', skS='#d4a870', skH='#ffe8c8', skB='#f0b888';

  function ap(x,y,col,d) { if(x>=0&&y>=0&&x<w&&y<h){c[y*w+x]=col;hm[y*w+x]=Math.max(hm[y*w+x],d);} }
  function aE(cx,cy,rx,ry,col,d) { for(let dy=-ry;dy<=ry;dy++) for(let dx=-rx;dx<=rx;dx++) if((dx*dx)/(rx*rx)+(dy*dy)/(ry*ry)<=1) ap(cx+dx,cy+dy,col,d); }
  function aR(x1,y1,w,h,col,d) { for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) ap(x1+dx,y1+dy,col,d); }

  // Hair dome
  aE(16,4,9,5,cM,9); aE(16,3,8,4,cL,10); aE(16,5,9,5,cD,8);
  aR(10,5,12,2,cM,9.5); ap(14,5,cL,10); ap(15,5,cL,10);
  aE(9,7,2,4,cD,7); aE(23,7,2,4,cD,7);

  // Head
  aE(16,8,6,5,sk,8); aE(16,6,4,2,skH,8.8); aE(16,11,5,2,skS,7.5);
  aE(12,9,1,1,skB,8.2); aE(20,9,1,1,skB,8.2);

  // Eyes
  aE(13,8,2,2,'#fff',9); aE(19,8,2,2,'#fff',9);
  aE(13,8,1,2,'#4488cc',9.3); aE(19,8,1,2,'#4488cc',9.3);
  ap(13,9,'#112',9.8); ap(19,9,'#112',9.8);
  ap(14,7,'#fff',10); ap(20,7,'#fff',10);
  ap(12,8,'#ddeeff',9.5); ap(18,8,'#ddeeff',9.5);
  // Eyebrows
  ap(12,5,cD,9.5); ap(13,5,cD,9.5); ap(14,6,cD,9.2);
  ap(18,6,cD,9.2); ap(19,5,cD,9.5); ap(20,5,cD,9.5);

  // Nose + mouth
  ap(16,9,skS,8.8); ap(16,10,skH,9);
  ap(15,11,'#c08060',8.2); ap(16,11,'#d09070',8.3); ap(17,11,'#c08060',8.2);

  // Neck
  aR(14,13,4,1,skS,5.5);

  // Body
  aE(16,18,5,5,cM,5); aE(14,18,2,4,cD,4.5); aE(18,18,2,4,cD,4.5);
  aE(16,17,3,3,cL,5.5);
  ap(14,14,sk,5.8); ap(15,14,'#fff',5.9); ap(16,14,'#fff',5.9); ap(17,14,'#fff',5.9); ap(18,14,sk,5.8);
  ap(16,16,cD,5.3); ap(16,18,cD,5.3); ap(16,20,cD,5.3);

  // Arms
  aE(8,17,2,4,cM,4); ap(7,17,cD,3.5); ap(7,18,cD,3.5);
  aE(8,22,2,1,sk,3);
  aE(24,17,2,4,cM,4); ap(25,17,cD,3.5); ap(25,18,cD,3.5);
  aE(24,22,2,1,sk,3);

  // Legs
  aE(13,24,2,3,'#2a2a40',4); ap(12,24,'#1a1a30',3.5); ap(14,24,'#3a3a50',4.3);
  aE(19,24,2,3,'#2a2a40',4); ap(20,24,'#1a1a30',3.5); ap(18,24,'#3a3a50',4.3);

  // Shoes
  aE(13,28,3,1,'#2a1a1a',2); ap(13,27,'#3a2a2a',2.5);
  aE(19,28,3,1,'#2a1a1a',2); ap(19,27,'#3a2a2a',2.5);

  return {w,h,c,hm,name};
}

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0,0,1200,560);

// Title
ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui';
ctx.fillText('AgentHabitat — Avatar Sprite Sheet (32x32 @ 8x scale)', 20, 30);
ctx.fillStyle = '#888'; ctx.font = '12px system-ui';
ctx.fillText('Chibi style — heightmap lit — per-pixel anti-aliased', 20, 50);

const agents = [
  buildAgent('#f97316', 'Claude'),
  buildAgent('#3b82f6', 'Copilot'),
  buildAgent('#22c55e', 'JD.AI'),
  buildAgent('#a855f7', 'Ralph'),
];

const scale = 8;
agents.forEach((spr, i) => {
  const x = 30 + i * 280;
  const y = 80;
  // Background card
  ctx.fillStyle = '#0d1117';
  ctx.beginPath(); ctx.roundRect(x - 10, y - 10, 32*scale + 20, 32*scale + 50, 8); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - 10, y - 10, 32*scale + 20, 32*scale + 50, 8); ctx.stroke();
  // Render
  renderSprite(ctx, spr, x, y, scale);
  // Label
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(spr.name, x + 16*scale, y + 32*scale + 25);
  ctx.textAlign = 'left';
});
</script>
</body></html>`;

  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, 'avatar-spritesheet.png') });
  console.log('Captured avatar-spritesheet.png');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
