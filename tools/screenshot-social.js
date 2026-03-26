const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const outDir = 'C:/git/AgentHabitat/docs/poc/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:5000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000); // Wait for idle animation to start

  // Capture with social behaviors visible
  await page.screenshot({ path: `${outDir}/20-social-behaviors-startup.png`, fullPage: true });
  console.log('1/3 Social behaviors startup');

  // Wait a few seconds for animation cycle change
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/21-social-behaviors-animated.png`, fullPage: true });
  console.log('2/3 Social behaviors animated');

  // Research lab
  const presetSelect = page.locator('select').first();
  await presetSelect.selectOption('research-lab');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${outDir}/22-social-behaviors-lab.png`, fullPage: true });
  console.log('3/3 Social behaviors lab');

  await browser.close();
  console.log('Done');
})();
