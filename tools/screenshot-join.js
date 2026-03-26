const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 1. Before — 4 agents, 8 rooms
  await page.screenshot({ path: `${outDir}/16-before-join.png`, fullPage: true });
  console.log('1/3 Before join (4 agents)');

  // 2. Click "+ Agent" button to add agent 1
  const addBtn = page.locator('button:has-text("+ Agent")');
  await addBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/17-after-join-1.png`, fullPage: true });
  console.log('2/3 After first join (5 agents)');

  // 3. Click "+ Agent" again for agent 2
  await addBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/18-after-join-2.png`, fullPage: true });
  console.log('3/3 After second join (6 agents)');

  // Extract mapping
  const data = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    if (!c || !c._worldData) return null;
    return {
      rooms: c._worldData.rooms.length,
      agents: c._worldData.agents.map(a => ({ id: a.id, name: a.name })),
      objects: c._worldData.objects.length,
      doors: c._worldData.doors.length
    };
  });
  if (data) {
    console.log(`\nFinal state: ${data.rooms} rooms, ${data.agents.length} agents, ${data.objects.length} objects, ${data.doors} doors`);
    console.log('Agents:', data.agents.map(a => `${a.name} (${a.id})`).join(', '));
  }

  await browser.close();
})();
