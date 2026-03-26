const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Extract world data
  const data = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    if (!c || !c._worldData) return null;
    const wd = c._worldData;
    return {
      seed: wd.seed,
      style: wd.style,
      rooms: wd.rooms.map(r => ({ id: r.id, archetype: r.archetype, x: r.x, y: r.y, w: r.width, h: r.height })),
      agents: wd.agents.map(a => ({ id: a.id, name: a.name, role: a.role, x: a.x, y: a.y })),
      doors: wd.doors.length,
      hash: wd.topologyHash
    };
  });

  if (data) {
    console.log('=== Actor → Office Mapping ===');
    console.log(`Seed: ${data.seed} | Style: ${data.style} | Hash: ${data.hash.slice(0,16)}...`);
    console.log(`Rooms: ${data.rooms.length} | Doors: ${data.doors} | Agents: ${data.agents.length}`);
    console.log('');
    console.log('| Agent | Role | Office Room ID | Position | Room Size |');
    console.log('|-------|------|---------------|----------|-----------|');
    for (const agent of data.agents) {
      const office = data.rooms.find(r => r.id === `office-${agent.id}`);
      if (office) {
        console.log(`| ${agent.name} | ${agent.role} | ${office.id} | (${agent.x},${agent.y}) in (${office.x},${office.y}) | ${office.w}×${office.h} |`);
      } else {
        console.log(`| ${agent.name} | ${agent.role} | NO OFFICE | (${agent.x},${agent.y}) | N/A |`);
      }
    }
    console.log('');

    // Check for duplicates
    const officeIds = data.agents.map(a => `office-${a.id}`);
    const dupes = officeIds.filter((id, i) => officeIds.indexOf(id) !== i);
    console.log(`Duplicate office assignments: ${dupes.length === 0 ? 'NONE ✅' : dupes.join(', ')}`);

    // List shared rooms
    console.log('');
    console.log('Shared rooms:');
    for (const r of data.rooms.filter(r => r.archetype !== 'PrivateOffice')) {
      console.log(`  ${r.id}: ${r.archetype} at (${r.x},${r.y}) ${r.w}×${r.h}`);
    }
  }

  // Determinism check: reload and compare
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  const data2 = await page.evaluate(() => {
    const c = document.getElementById('world-canvas');
    return c?._worldData?.topologyHash || 'NONE';
  });

  console.log('');
  console.log(`=== Determinism Check ===`);
  console.log(`Run 1 hash: ${data?.hash.slice(0,16)}...`);
  console.log(`Run 2 hash: ${data2.slice(0,16)}...`);
  console.log(`Match: ${data?.hash === data2 ? 'YES ✅' : 'NO ❌'}`);

  await browser.close();
})();
