import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 400 } });

  const htmlPath = join(__dirname, 'worldgen-renderer.html');
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`);

  // Generate a single seed with one style, then zoom into agent area
  await page.fill('#seeds', 'alpha-001');
  await page.evaluate(() => {
    document.getElementById('style1').value = 'retro-office';
    document.getElementById('style2').value = 'retro-office';
  });
  await page.click('button:has-text("Generate All")');
  await page.waitForTimeout(300);

  // Get the canvas and take a cropped screenshot focusing on agents
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();

  // Capture full canvas at higher detail
  await canvas.screenshot({ path: join(outDir, 'agent-zoom-retro.png') });

  // Now neon
  await page.evaluate(() => {
    document.getElementById('style1').value = 'neon-hq';
    document.getElementById('style2').value = 'neon-hq';
  });
  await page.click('button:has-text("Generate All")');
  await page.waitForTimeout(300);
  await page.locator('canvas').first().screenshot({ path: join(outDir, 'agent-zoom-neon.png') });

  // Forest
  await page.evaluate(() => {
    document.getElementById('style1').value = 'forest-lab';
    document.getElementById('style2').value = 'forest-lab';
  });
  await page.click('button:has-text("Generate All")');
  await page.waitForTimeout(300);
  await page.locator('canvas').first().screenshot({ path: join(outDir, 'agent-zoom-forest.png') });

  await browser.close();
  console.log('Captured 3 agent zoom shots');
}

main().catch(e => { console.error(e); process.exit(1); });
