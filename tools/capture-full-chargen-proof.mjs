import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

const charGenSrc = readFileSync(join(__dirname, 'character-generator.js'), 'utf8')
  .replace(/^export /gm, '')
  .replace(/^import .*/gm, '');

const sixCharacters = [
  { name: 'Claude', config: { skinTone:'light', hairStyle:'curly', hairColor:'#f97316', eyeColor:'#4488cc', outfit:'tshirt', outfitColor:'#f97316', outfitAccent:'#fff', accessory:'none', bodyType:'average' }},
  { name: 'Copilot', config: { skinTone:'medium', hairStyle:'straight', hairColor:'#3b82f6', eyeColor:'#2266aa', outfit:'hoodie', outfitColor:'#3b82f6', outfitAccent:'#ddd', accessory:'headset', bodyType:'average' }},
  { name: 'JD.AI', config: { skinTone:'light', hairStyle:'spiky', hairColor:'#22c55e', eyeColor:'#22aa44', outfit:'casual', outfitColor:'#22c55e', outfitAccent:'#333', accessory:'glasses', bodyType:'slim' }},
  { name: 'Ralph', config: { skinTone:'tan', hairStyle:'bob', hairColor:'#a855f7', eyeColor:'#8844cc', outfit:'suit', outfitColor:'#a855f7', outfitAccent:'#fff', accessory:'none', bodyType:'broad' }},
  { name: 'Dr. Kim', config: { skinTone:'dark', hairStyle:'long', hairColor:'#1a1a2a', eyeColor:'#886622', outfit:'labcoat', outfitColor:'#e8e8e8', outfitAccent:'#3388cc', accessory:'glasses', bodyType:'slim' }},
  { name: 'Sgt. Rex', config: { skinTone:'deep', hairStyle:'buzz', hairColor:'#333333', eyeColor:'#44aa44', outfit:'casual', outfitColor:'#556b2f', outfitAccent:'#8b7355', accessory:'hat', bodyType:'broad' }},
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } });

  const html = `<!DOCTYPE html>
<html><body style="background:#0a0a12;margin:0">
<canvas id="c" width="1600" height="1550"></canvas>
<script>
${charGenSrc}

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
  ctx.fillStyle='#000';
  for(let y=0;y<spr.h;y++) for(let x=0;x<spr.w;x++){
    if(!spr.c[y*spr.w+x])continue;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=spr.w||ny>=spr.h||!spr.c[ny*spr.w+nx]){ctx.fillRect(px+x*scale,py+y*scale,scale,scale);break;}
    }
  }
  for(let y=0;y<spr.h;y++) for(let x=0;x<spr.w;x++){
    const i=y*spr.w+x; if(!spr.c[i])continue;
    const rgb=hex2rgb(spr.c[i]),b=light[i];
    ctx.fillStyle=rgb2hex(rgb.r*b,rgb.g*b,rgb.b*b);
    ctx.fillRect(px+x*scale,py+y*scale,scale,scale);
  }
}

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle='#0a0a12'; ctx.fillRect(0,0,1600,1550);

// Title
ctx.fillStyle='#fff'; ctx.font='bold 20px system-ui';
ctx.fillText('AgentHabitat — Character Generator Full Proof Package', 20, 28);
ctx.fillStyle='#888'; ctx.font='12px system-ui';
ctx.fillText('6 characters × 4 directions × 2 frames = 48 poses | Parametric: skin, hair, eyes, outfit, accessory, body', 20, 48);

const chars = ${JSON.stringify(sixCharacters)};
const dirs = ['front', 'left', 'right', 'back'];
const scale = 5;
const cellW = 32 * scale + 6;
const cellH = 32 * scale + 6;

// Section 1: Full directional sheet
ctx.fillStyle='#aaa'; ctx.font='bold 14px system-ui';
ctx.fillText('SECTION 1: Full Directional Sheet (all 6 characters)', 20, 72);

// Col headers
ctx.fillStyle='#555'; ctx.font='9px system-ui'; ctx.textAlign='center';
dirs.forEach((d,di) => {
  ['A','B'].forEach((f,fi) => {
    ctx.fillText(d+'_'+f, 90+(di*2+fi)*cellW+cellW/2, 88);
  });
});

chars.forEach((ch, ai) => {
  const baseY = 94 + ai * (cellH + 8);
  ctx.fillStyle=ch.config.outfitColor; ctx.font='bold 11px system-ui'; ctx.textAlign='left';
  ctx.fillText(ch.name, 4, baseY+cellH/2-6);
  ctx.fillStyle='#444'; ctx.font='8px system-ui';
  ctx.fillText(ch.config.skinTone+'/'+ch.config.hairStyle, 4, baseY+cellH/2+6);
  ctx.fillText(ch.config.outfit+(ch.config.accessory!=='none'?'+'+ch.config.accessory:''), 4, baseY+cellH/2+16);

  dirs.forEach((dir, di) => {
    [0,1].forEach((frame, fi) => {
      const x = 90 + (di*2+fi) * cellW;
      const y = baseY;
      ctx.fillStyle='#08080f';
      ctx.beginPath(); ctx.roundRect(x,y,32*scale,32*scale,3); ctx.fill();
      renderSprite(ctx, generateCharacter(ch.config, dir, frame), x, y, scale);
    });
  });
});

// Section 2: Face close-ups (front only, 10x)
const faceY = 94 + 6 * (cellH + 8) + 20;
ctx.fillStyle='#aaa'; ctx.font='bold 14px system-ui'; ctx.textAlign='left';
ctx.fillText('SECTION 2: Face Close-ups (front, 10x scale — head region only)', 20, faceY);

const faceScale = 10;
chars.forEach((ch, i) => {
  const fx = 20 + i * (16*faceScale + 20);
  const fy = faceY + 20;
  ctx.fillStyle='#08080f';
  ctx.beginPath(); ctx.roundRect(fx-4,fy-4,16*faceScale+8,16*faceScale+8,4); ctx.fill();
  // Render full sprite then we only show top 16 rows
  const spr = generateCharacter(ch.config, 'front', 0);
  const light = computeLight(spr.hm, spr.w, spr.h);
  // Outline
  ctx.fillStyle='#000';
  for(let y=0;y<16;y++) for(let x=8;x<24;x++){
    if(!spr.c[y*32+x])continue;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=32||ny>=32||!spr.c[ny*32+nx]){ctx.fillRect(fx+(x-8)*faceScale,fy+y*faceScale,faceScale,faceScale);break;}
    }
  }
  for(let y=0;y<16;y++) for(let x=8;x<24;x++){
    const idx=y*32+x; if(!spr.c[idx])continue;
    const rgb=hex2rgb(spr.c[idx]),b=light[idx];
    ctx.fillStyle=rgb2hex(rgb.r*b,rgb.g*b,rgb.b*b);
    ctx.fillRect(fx+(x-8)*faceScale,fy+y*faceScale,faceScale,faceScale);
  }
  ctx.fillStyle=ch.config.outfitColor; ctx.font='bold 10px system-ui'; ctx.textAlign='center';
  ctx.fillText(ch.name, fx+8*faceScale, fy+16*faceScale+16);
  ctx.textAlign='left';
});

// Section 3: Config breakdown
const cfgY = faceY + 16*faceScale + 60;
ctx.fillStyle='#aaa'; ctx.font='bold 14px system-ui';
ctx.fillText('SECTION 3: Character Configs (JSON)', 20, cfgY);
ctx.fillStyle='#666'; ctx.font='10px monospace';
chars.forEach((ch, i) => {
  const x = 20 + (i % 3) * 520;
  const y = cfgY + 18 + Math.floor(i / 3) * 80;
  ctx.fillStyle=ch.config.outfitColor; ctx.font='bold 10px monospace';
  ctx.fillText(ch.name + ':', x, y);
  ctx.fillStyle='#555'; ctx.font='9px monospace';
  const keys = Object.entries(ch.config);
  keys.forEach(([k,v], ki) => {
    ctx.fillText(k+': '+v, x+10, y+12+ki*11);
  });
});
</script>
</body></html>`;

  await page.setContent(html);
  await page.waitForTimeout(1000);

  // Capture main proof sheet
  await page.screenshot({ path: join(outDir, 'chargen-full-proof.png'), fullPage: true });
  console.log('Captured chargen-full-proof.png');

  // Determinism proof — capture twice, hash comparison
  const img1 = await page.screenshot();
  const hash1 = createHash('sha256').update(img1).digest('hex');
  // Re-render
  await page.reload();
  await page.waitForTimeout(1000);
  const img2 = await page.screenshot();
  const hash2 = createHash('sha256').update(img2).digest('hex');

  const proof = {
    timestamp: new Date().toISOString(),
    characters: sixCharacters.length,
    directions: 4,
    frames: 2,
    totalPoses: sixCharacters.length * 4 * 2,
    determinism: { run1: hash1, run2: hash2, equal: hash1 === hash2 },
  };
  writeFileSync(join(outDir, 'chargen-proof.json'), JSON.stringify(proof, null, 2));
  console.log(`Determinism: ${hash1 === hash2 ? 'PASS' : 'FAIL'} (${hash1.slice(0,16)}...)`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
