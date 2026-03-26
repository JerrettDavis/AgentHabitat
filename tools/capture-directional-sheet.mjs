import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });

  const html = `<!DOCTYPE html>
<html><body style="background:#111;margin:0;padding:0">
<canvas id="c" width="1400" height="1200"></canvas>
<script>
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
function shade(hex,f){const{r,g,b}=hex2rgb(hex);return rgb2hex(r*f,g*f,b*f);}

function renderSprite(ctx, spr, px, py, scale) {
  const light = computeLight(spr.hm, spr.w, spr.h);
  // Outline first
  ctx.fillStyle = '#000';
  for(let y=0;y<spr.h;y++) for(let x=0;x<spr.w;x++){
    if(!spr.c[y*spr.w+x])continue;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=spr.w||ny>=spr.h||!spr.c[ny*spr.w+nx]){
        ctx.fillRect(px+x*scale,py+y*scale,scale,scale);break;
      }
    }
  }
  // Sprite on top
  for(let y=0;y<spr.h;y++) for(let x=0;x<spr.w;x++){
    const i=y*spr.w+x; if(!spr.c[i])continue;
    const rgb=hex2rgb(spr.c[i]),b=light[i];
    ctx.fillStyle=rgb2hex(rgb.r*b,rgb.g*b,rgb.b*b);
    ctx.fillRect(px+x*scale,py+y*scale,scale,scale);
  }
}

function buildAgent(color, direction, frame) {
  const w=32,h=32,c=new Array(w*h).fill(null),hm=new Float32Array(w*h);
  const cD=shade(color,0.55),cM=color,cL=shade(color,1.35);
  const sk='#ffd5a0',skS='#d4a870',skH='#ffe8c8',skB='#f0b888';

  function ap(x,y,col,d){if(x>=0&&y>=0&&x<w&&y<h){c[y*w+x]=col;hm[y*w+x]=Math.max(hm[y*w+x],d);}}
  function aE(cx,cy,rx,ry,col,d){for(let dy=-ry;dy<=ry;dy++) for(let dx=-rx;dx<=rx;dx++) if((dx*dx)/(rx*rx)+(dy*dy)/(ry*ry)<=1) ap(cx+dx,cy+dy,col,d);}
  function aR(x1,y1,w,h,col,d){for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) ap(x1+dx,y1+dy,col,d);}

  // Walk frame offset
  const walkOff = frame === 1 ? 1 : 0;
  const legSwing = frame === 1 ? 2 : 0;

  if (direction === 'front') {
    // Hair
    aE(16,4,9,5,cM,9); aE(16,3,8,4,cL,10); aE(16,5,9,5,cD,8);
    aR(10,5,12,2,cM,9.5); aE(9,7,2,4,cD,7); aE(23,7,2,4,cD,7);
    // Head
    aE(16,8,6,5,sk,8); aE(16,6,4,2,skH,8.8); aE(16,11,5,2,skS,7.5);
    aE(12,9,1,1,skB,8.2); aE(20,9,1,1,skB,8.2);
    // Eyes
    aE(13,8,2,2,'#fff',9); aE(19,8,2,2,'#fff',9);
    aE(13,8,1,2,'#4488cc',9.3); aE(19,8,1,2,'#4488cc',9.3);
    ap(13,9,'#112',9.8); ap(19,9,'#112',9.8);
    ap(14,7,'#fff',10); ap(20,7,'#fff',10);
    // Eyebrows
    ap(12,5,cD,9.5); ap(13,5,cD,9.5); ap(19,5,cD,9.5); ap(20,5,cD,9.5);
    // Nose + mouth
    ap(16,9,skS,8.8); ap(16,10,skH,9);
    ap(15,11,'#c08060',8.2); ap(16,11,'#d09070',8.3); ap(17,11,'#c08060',8.2);
    // Neck
    aR(14,13,4,1,skS,5.5);
    // Body
    aE(16,18,5,5,cM,5); aE(14,18,2,4,cD,4.5); aE(18,18,2,4,cD,4.5); aE(16,17,3,3,cL,5.5);
    ap(15,14,'#fff',5.9); ap(16,14,'#fff',5.9); ap(17,14,'#fff',5.9);
    // Arms
    aE(8,17,2,4,cM,4); aE(8,22,2,1,sk,3);
    aE(24,17,2,4,cM,4); aE(24,22,2,1,sk,3);
    // Legs
    aE(13,24-legSwing,2,3,'#2a2a40',4); aE(19,24+legSwing,2,3,'#2a2a40',4);
    // Shoes
    aE(13,28-legSwing,3,1,'#2a1a1a',2); aE(19,28+legSwing,3,1,'#2a1a1a',2);
  }
  else if (direction === 'back') {
    // Hair (full back, more volume)
    aE(16,4,9,5,cD,9); aE(16,3,8,4,cM,9.5); aE(16,2,7,3,cL,10);
    aE(9,7,2,5,cD,7); aE(23,7,2,5,cD,7);
    // Head back (skin at bottom only)
    aE(16,8,6,5,sk,7); aE(16,7,5,4,cM,8); // hair covers most
    aR(13,11,6,1,skS,7);
    // Neck
    aR(14,12,4,2,skS,5);
    // Body back
    aE(16,18,5,5,cM,5); aE(14,18,2,4,cD,4.5); aE(18,18,2,4,cD,4.5);
    aE(16,18,3,3,cL,5.3);
    // Arms back
    aE(8,17,2,4,cM,4); aE(8,22,2,1,sk,3);
    aE(24,17,2,4,cM,4); aE(24,22,2,1,sk,3);
    // Legs
    aE(13,24+legSwing,2,3,'#2a2a40',4); aE(19,24-legSwing,2,3,'#2a2a40',4);
    aE(13,28+legSwing,3,1,'#2a1a1a',2); aE(19,28-legSwing,3,1,'#2a1a1a',2);
  }
  else if (direction === 'left') {
    // Hair side (shifted left)
    aE(14,4,8,5,cM,9); aE(14,3,7,4,cL,10); aE(14,5,8,5,cD,8);
    aE(7,7,2,4,cD,7);
    // Head side
    aE(14,8,5,5,sk,8); aE(14,6,3,2,skH,8.8); aE(14,11,4,2,skS,7.5);
    // Eye (one visible, larger)
    aE(12,8,2,2,'#fff',9); aE(12,8,1,2,'#4488cc',9.3); ap(12,9,'#112',9.8); ap(13,7,'#fff',10);
    // Eyebrow
    ap(11,5,cD,9.5); ap(12,5,cD,9.5);
    // Nose (profile)
    ap(9,9,skS,9); ap(9,10,sk,8.5);
    // Mouth
    ap(10,11,'#c08060',8.2); ap(11,11,'#d09070',8.3);
    // Ear
    ap(18,8,skS,7); ap(18,9,sk,7.5);
    // Neck
    aR(13,13,3,1,skS,5.5);
    // Body side
    aE(14,18,4,5,cM,5); aE(12,18,2,4,cD,4.5); aE(16,17,2,3,cL,5.5);
    // Arm (one visible, side)
    aE(10,17,2,4,cM,4); aE(10,22,2,1,sk,3);
    // Back arm (peek)
    aE(18,17,1,3,cD,3);
    // Legs side
    aE(13,24-legSwing,2,3,'#2a2a40',4); aE(15,24+legSwing,2,3,'#1a1a30',3.5);
    aE(13,28-legSwing,3,1,'#2a1a1a',2); aE(15,28+legSwing,2,1,'#1a1010',1.8);
  }
  else { // right (mirror of left)
    aE(18,4,8,5,cM,9); aE(18,3,7,4,cL,10); aE(18,5,8,5,cD,8);
    aE(25,7,2,4,cD,7);
    aE(18,8,5,5,sk,8); aE(18,6,3,2,skH,8.8); aE(18,11,4,2,skS,7.5);
    aE(20,8,2,2,'#fff',9); aE(20,8,1,2,'#4488cc',9.3); ap(20,9,'#112',9.8); ap(19,7,'#fff',10);
    ap(20,5,cD,9.5); ap(21,5,cD,9.5);
    ap(23,9,skS,9); ap(23,10,sk,8.5);
    ap(21,11,'#c08060',8.2); ap(22,11,'#d09070',8.3);
    ap(14,8,skS,7); ap(14,9,sk,7.5);
    aR(16,13,3,1,skS,5.5);
    aE(18,18,4,5,cM,5); aE(20,18,2,4,cD,4.5); aE(16,17,2,3,cL,5.5);
    aE(22,17,2,4,cM,4); aE(22,22,2,1,sk,3);
    aE(14,17,1,3,cD,3);
    aE(19,24-legSwing,2,3,'#2a2a40',4); aE(17,24+legSwing,2,3,'#1a1a30',3.5);
    aE(19,28-legSwing,3,1,'#2a1a1a',2); aE(17,28+legSwing,2,1,'#1a1010',1.8);
  }

  return {w,h,c,hm};
}

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0,0,1400,1200);

ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui';
ctx.fillText('AgentHabitat — Full Directional Sprite Sheet (32x32 @ 6x)', 20, 30);
ctx.fillStyle = '#888'; ctx.font = '12px system-ui';
ctx.fillText('Front / Left / Right / Back × Idle + Walk frame', 20, 50);

const agents = [
  { color: '#f97316', name: 'Claude' },
  { color: '#3b82f6', name: 'Copilot' },
  { color: '#22c55e', name: 'JD.AI' },
  { color: '#a855f7', name: 'Ralph' },
];
const dirs = ['front', 'left', 'right', 'back'];
const scale = 6;
const cellW = 32 * scale + 10;
const cellH = 32 * scale + 30;

// Column headers
ctx.fillStyle = '#888'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
dirs.forEach((d, di) => {
  ['Idle', 'Walk'].forEach((f, fi) => {
    ctx.fillText(d + ' ' + f, 50 + (di * 2 + fi) * (cellW) + cellW/2, 68);
  });
});

agents.forEach((agent, ai) => {
  const baseY = 80 + ai * cellH;
  // Agent name
  ctx.fillStyle = agent.color; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(agent.name, 5, baseY + cellH/2);

  dirs.forEach((dir, di) => {
    [0, 1].forEach((frame, fi) => {
      const x = 50 + (di * 2 + fi) * cellW;
      const y = baseY;
      // Cell bg
      ctx.fillStyle = '#0d1117';
      ctx.beginPath(); ctx.roundRect(x, y, 32*scale, 32*scale, 4); ctx.fill();
      // Render
      const spr = buildAgent(agent.color, dir, frame);
      renderSprite(ctx, spr, x, y, scale);
    });
  });
});
</script>
</body></html>`;

  await page.setContent(html);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, 'directional-spritesheet.png'), fullPage: true });
  console.log('Captured directional-spritesheet.png');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
