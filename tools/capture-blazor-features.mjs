import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:5199');
  await page.waitForTimeout(6000);

  // 1. Default view with minimap
  await page.screenshot({ path: join(outDir, 'blazor-full-features.png'), fullPage: true });
  console.log('1. Full features view');

  // 2. Try different style
  await page.selectOption('select', 'neon-hq');
  await page.click('button:has-text("Generate")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'blazor-neon-style.png'), fullPage: true });
  console.log('2. Neon HQ style');

  // 3. Forest style
  await page.selectOption('select', 'forest-lab');
  await page.click('button:has-text("Generate")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'blazor-forest-style.png'), fullPage: true });
  console.log('3. Forest Lab style');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
