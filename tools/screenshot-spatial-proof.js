const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const canvas = page.locator('#world-canvas');
  const box = await canvas.boundingBox();
  if (!box) { await browser.close(); return; }

  // Get world data to find agent + target positions
  const wd = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    if (!c || !c._worldData) return null;
    return {
      agents: c._worldData.agents,
      rooms: c._worldData.rooms,
      objects: c._worldData.objects?.length || 0
    };
  });

  if (!wd) { await browser.close(); return; }
  const ts = 32;

  // 1. Click first agent to select
  const agent = wd.agents[0];
  await page.mouse.click(box.x + agent.x * ts + ts/2, box.y + agent.y * ts + ts/2);
  await page.waitForTimeout(500);

  // 2. Right-click on a different room to trigger pathfinding (should route around furniture)
  const targetRoom = wd.rooms.find(r => r.archetype !== 'PrivateOffice' && r.id !== `office-${agent.id}`);
  if (targetRoom) {
    const tx = targetRoom.x + Math.floor(targetRoom.width / 2);
    const ty = targetRoom.y + Math.floor(targetRoom.height / 2);
    await page.mouse.click(box.x + tx * ts + ts/2, box.y + ty * ts + ts/2, { button: 'right' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outDir}/19-pathfinding-around-solids.png`, fullPage: true });
    console.log('1/1 Pathfinding around solids captured');
  }

  // Report solid object stats
  const solidCount = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    if (!c || !c._worldData) return 0;
    let count = 0;
    for (const obj of (c._worldData.objects || [])) {
      const props = OBJ_PROPS[obj.type];
      if (props && props.solid) count++;
    }
    return count;
  });
  console.log(`Solid objects blocking pathfinding: ${solidCount}`);
  console.log(`Total objects: ${wd.objects}`);

  await browser.close();
})();
