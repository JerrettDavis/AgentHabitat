const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 1. Normal view with all doors open
  await page.screenshot({ path: `${outDir}/09-doors-all-open.png`, fullPage: true });
  console.log('1/4 All doors open');

  const canvas = page.locator('#world-canvas');
  const box = await canvas.boundingBox();
  if (!box) { console.log('No canvas found'); await browser.close(); return; }

  // 2. Click an agent to select it, then right-click to move (traversal through open door)
  // First, let's get the world data to find agent and door positions
  const worldData = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    return c?._worldData ? {
      agents: c._worldData.agents,
      doors: c._worldData.doors,
      rooms: c._worldData.rooms
    } : null;
  });

  if (worldData && worldData.agents.length > 0 && worldData.doors.length > 0) {
    const agent = worldData.agents[0];
    const ts = 32; // tileSize

    // Click the agent to select
    await page.mouse.click(box.x + agent.x * ts + ts/2, box.y + agent.y * ts + ts/2);
    await page.waitForTimeout(500);

    // Find a door and click it to close it
    const door = worldData.doors[0];
    console.log(`Toggling door at (${door.x}, ${door.y}) state: ${door.state}`);
    await page.mouse.click(box.x + door.x * ts + ts/2, box.y + door.y * ts + ts/2);
    await page.waitForTimeout(500);

    // Screenshot with door toggled (should now be Closed)
    await page.screenshot({ path: `${outDir}/10-door-closed.png`, fullPage: true });
    console.log('2/4 Door closed state');

    // Toggle again to Locked
    await page.mouse.click(box.x + door.x * ts + ts/2, box.y + door.y * ts + ts/2);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/11-door-locked.png`, fullPage: true });
    console.log('3/4 Door locked state');

    // Try to move agent - select agent first
    await page.mouse.click(box.x + agent.x * ts + ts/2, box.y + agent.y * ts + ts/2);
    await page.waitForTimeout(500);

    // Find a target in a different room (try to traverse through locked door)
    const otherRoom = worldData.rooms.find(r => r.id !== worldData.doors[0].roomId);
    if (otherRoom) {
      const targetX = otherRoom.x + Math.floor(otherRoom.width / 2);
      const targetY = otherRoom.y + Math.floor(otherRoom.height / 2);
      // Right-click to attempt movement
      await page.mouse.click(box.x + targetX * ts + ts/2, box.y + targetY * ts + ts/2, { button: 'right' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${outDir}/12-traversal-blocked.png`, fullPage: true });
      console.log('4/4 Traversal blocked proof');
    }
  }

  await browser.close();
  console.log('Done — traversal proof screenshots saved');
})();
