import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Blazor app
  await page.goto('http://localhost:5199');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(outDir, 'blazor-showcase-default.png'), fullPage: true });
  console.log('Captured Blazor default');

  // Also capture the standalone JS renderer for comparison
  const page2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const htmlPath = join(__dirname, 'worldgen-renderer.html');
  await page2.goto(`file://${htmlPath.replace(/\\/g, '/')}`);
  await page2.fill('#seeds', 'alpha-001');
  await page2.evaluate(() => {
    document.getElementById('style1').value = 'retro-office';
    document.getElementById('style2').value = 'neon-hq';
  });
  await page2.click('button:has-text("Generate All")');
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: join(outDir, 'standalone-showcase.png'), fullPage: true });
  console.log('Captured standalone renderer');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
