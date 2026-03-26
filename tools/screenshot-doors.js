const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 1. Full page with doors visible
  await page.screenshot({ path: `${outDir}/06-doors-overview.png`, fullPage: true });
  console.log('1/3 Doors overview captured');

  // 2. Switch to research-lab preset for different room layout
  const presetSelect = page.locator('select').first();
  await presetSelect.selectOption('research-lab');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/07-doors-research-lab.png`, fullPage: true });
  console.log('2/3 Research lab doors captured');

  // 3. Corporate HQ
  await presetSelect.selectOption('corporate-hq');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/08-doors-corporate-hq.png`, fullPage: true });
  console.log('3/3 Corporate HQ doors captured');

  await browser.close();
  console.log('Done — door screenshots saved');
})();
