const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 1. Full view with personal offices
  await page.screenshot({ path: `${outDir}/13-personal-offices-startup.png`, fullPage: true });
  console.log('1/3 Startup offices captured');

  // 2. Research lab preset
  const presetSelect = page.locator('select').first();
  await presetSelect.selectOption('research-lab');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/14-personal-offices-lab.png`, fullPage: true });
  console.log('2/3 Research lab offices captured');

  // 3. Corporate HQ
  await presetSelect.selectOption('corporate-hq');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/15-personal-offices-corp.png`, fullPage: true });
  console.log('3/3 Corporate offices captured');

  await browser.close();
  console.log('Done');
})();
