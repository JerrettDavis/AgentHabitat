import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  // Create a test HTML that renders heightmap sprites
  const html = `<!DOCTYPE html>
<html><body style="background:#111;margin:0">
<canvas id="c" width="800" height="600"></canvas>
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
    l[i] = Math.max(0.3, Math.min(1.4, 0.4 + (nx/len*LIGHT.x + ny/len*LIGHT.y + nz/len*LIGHT.z)));
  }
  return l;
}

function hex2rgb(h) { return { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) }; }
function rgb2hex(r,g,b) { return '#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join(''); }

function renderSprite(ctx, spr, px, py, s) {
  const light = computeLight(spr.hm, spr.w, spr.h);
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    const i = y * spr.w + x;
    if (!spr.c[i]) continue;
    const rgb = hex2rgb(spr.c[i]);
    const b = light[i];
    ctx.fillStyle = rgb2hex(rgb.r*b, rgb.g*b, rgb.b*b);
    ctx.fillRect(px + x*s, py + y*s, s, s);
  }
}

function makeDesk() {
  const w=32,h=32,c=new Array(w*h).fill(null),hm=new Float32Array(w*h);
  for(let y=4;y<15;y++) for(let x=4;x<28;x++) { c[y*w+x]='#8b6914'; hm[y*w+x]=4+(y===4?1:0); }
  for(let x=5;x<27;x++) { c[5*w+x]='#b8960b'; hm[5*w+x]=5; }
  for(let y=15;y<22;y++) for(const lx of[5,6,25,26]) { c[y*w+lx]='#6b4e1e'; hm[y*w+lx]=2; }
  for(let y=1;y<4;y++) for(let x=12;x<20;x++) { c[y*w+x]='#a0a0a0'; hm[y*w+x]=6; }
  for(let y=1;y<3;y++) for(let x=13;x<19;x++) { c[y*w+x]='#1a4a6a'; hm[y*w+x]=6.5; }
  c[4*w+15]='#a0a0a0'; c[4*w+16]='#a0a0a0'; hm[4*w+15]=5; hm[4*w+16]=5;
  return {w,h,c,hm};
}

function makeChair() {
  const w=32,h=32,c=new Array(w*h).fill(null),hm=new Float32Array(w*h);
  for(let y=10;y<17;y++) for(let x=10;x<23;x++) { c[y*w+x]='#4a3a6a'; hm[y*w+x]=3; }
  for(let y=4;y<10;y++) for(let x=12;x<21;x++) { c[y*w+x]='#4a3a6a'; hm[y*w+x]=5+(10-y)*0.3; }
  for(let y=17;y<22;y++) for(const lx of[11,21]) { c[y*w+lx]='#a0a0a0'; hm[y*w+lx]=1; }
  return {w,h,c,hm};
}

function makePlant() {
  const w=32,h=32,c=new Array(w*h).fill(null),hm=new Float32Array(w*h);
  for(let y=20;y<27;y++) { const ins=Math.floor((y-20)*0.3); for(let x=12+ins;x<20-ins;x++) { c[y*w+x]='#8b5e3c'; hm[y*w+x]=3-ins*0.5; } }
  for(let x=11;x<21;x++) { c[20*w+x]='#a07050'; hm[20*w+x]=4; }
  for(let y=14;y<20;y++) { c[y*w+15]='#3a5a2a'; c[y*w+16]='#3a5a2a'; hm[y*w+15]=2; hm[y*w+16]=2; }
  const lc=[[14,10],[18,8],[12,7],[16,5],[20,9],[15,3]];
  for(const[cx,cy]of lc) for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
    if(dx*dx+dy*dy>5) continue;
    const px=cx+dx,py=cy+dy; if(px<0||py<0||px>=w||py>=h) continue;
    const d=Math.sqrt(dx*dx+dy*dy);
    c[py*w+px]=d<1.5?'#2d6a2d':'#4a8a4a'; hm[py*w+px]=Math.max(hm[py*w+px],6-d);
  }
  return {w,h,c,hm};
}

function makeBookshelf() {
  const w=32,h=32,c=new Array(w*h).fill(null),hm=new Float32Array(w*h);
  const bookColors = ['#cc4444','#44aa44','#4444cc','#ccaa44','#aa44aa','#44aaaa'];
  // Frame
  for(let y=1;y<19;y++) for(let x=3;x<25;x++) { c[y*w+x]='#6b4e1e'; hm[y*w+x]=2; }
  // Shelves
  for(const sy of [1,5,9,13,17]) for(let x=3;x<25;x++) { c[sy*w+x]='#8b6914'; hm[sy*w+x]=3; }
  // Books on shelves
  for(const sy of [2,6,10,14]) for(let x=4;x<24;x++) {
    const ci = (x*7+sy*13)%bookColors.length;
    for(let by=sy;by<sy+3;by++) { c[by*w+x]=bookColors[ci]; hm[by*w+x]=4+((x+sy)%3)*0.5; }
  }
  return {w,h,c,hm};
}

function makeWhiteboard() {
  const w=32,h=32,c=new Array(w*h).fill(null),hm=new Float32Array(w*h);
  for(let y=2;y<14;y++) for(let x=4;x<28;x++) { c[y*w+x]='#d0d0d0'; hm[y*w+x]=5; }
  for(let y=1;y<15;y++) { c[y*w+3]='#a0a0a0'; c[y*w+28]='#a0a0a0'; hm[y*w+3]=6; hm[y*w+28]=6; }
  for(let x=3;x<29;x++) { c[1*w+x]='#a0a0a0'; c[14*w+x]='#a0a0a0'; hm[1*w+x]=6; hm[14*w+x]=6; }
  // Scribbles
  for(let x=8;x<16;x++) { c[5*w+x]='#333'; hm[5*w+x]=5.2; }
  for(let x=10;x<22;x++) { c[8*w+x]='#e76f51'; hm[8*w+x]=5.2; }
  for(let x=6;x<14;x++) { c[11*w+x]='#3a7aba'; hm[11*w+x]=5.2; }
  // Stand
  for(let y=15;y<20;y++) { c[y*w+14]='#808080'; c[y*w+17]='#808080'; hm[y*w+14]=2; hm[y*w+17]=2; }
  for(let x=10;x<22;x++) { c[20*w+x]='#808080'; hm[20*w+x]=1; }
  return {w,h,c,hm};
}

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0,0,800,600);

// Labels
ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
ctx.fillText('Heightmap-Lit Sprites (32x32 @ 4x scale)', 20, 30);
ctx.font = '11px monospace'; ctx.fillStyle = '#888';
ctx.fillText('Per-pixel lighting from heightmap normals + ambient occlusion', 20, 50);

const sprites = [
  { name: 'Desk', fn: makeDesk },
  { name: 'Chair', fn: makeChair },
  { name: 'Plant', fn: makePlant },
  { name: 'Bookshelf', fn: makeBookshelf },
  { name: 'Whiteboard', fn: makeWhiteboard },
];

sprites.forEach((s, i) => {
  const x = 20 + (i % 3) * 250;
  const y = 70 + Math.floor(i / 3) * 260;
  ctx.fillStyle = '#666'; ctx.font = '11px monospace';
  ctx.fillText(s.name, x, y - 5);
  renderSprite(ctx, s.fn(), x, y, 4);
});
</script>
</body></html>`;

  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, 'heightmap-sprites-test.png') });
  console.log('Captured heightmap-sprites-test.png');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
