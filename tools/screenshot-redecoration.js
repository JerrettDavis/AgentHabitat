const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';

  // Ensure output dir
  const fs = require('fs');
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  // Wait for Blazor WASM to load and canvas to render
  await page.waitForTimeout(5000);

  // 1. Full page — normal mode with generated world
  await page.screenshot({ path: `${outDir}/01-world-overview.png`, fullPage: true });
  console.log('1/5 World overview captured');

  // 2. Click Edit Mode button
  const editBtn = page.locator('button:has-text("Edit Mode")');
  await editBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/02-edit-mode.png`, fullPage: true });
  console.log('2/5 Edit mode captured');

  // 3. Click "+ plant" to start add action, hover over canvas to show preview
  const plantBtn = page.locator('button.habitat-tag:has-text("+ plant")');
  await plantBtn.click();
  await page.waitForTimeout(500);
  // Hover over the canvas center to trigger placement preview
  const canvas = page.locator('#world-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // Hover over a room area (roughly center)
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/03-placement-preview-valid.png`, fullPage: true });
    console.log('3/5 Valid placement preview captured');

    // Hover over edge/wall area (top-left corner which is likely void)
    await page.mouse.move(box.x + 10, box.y + 30);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/04-placement-preview-invalid.png`, fullPage: true });
    console.log('4/5 Invalid placement preview captured');

    // Click on valid tile to place, then capture invariant banner
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(300);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/05-invariant-pass-banner.png`, fullPage: true });
    console.log('5/5 Invariant pass banner captured');
  }

  await browser.close();
  console.log('Done — screenshots saved to', outDir);
})();
