import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();

  // 1. Normal viewport (1400x900)
  const page1 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page1.goto('http://localhost:5199');
  await page1.waitForTimeout(6000);
  await page1.screenshot({ path: join(outDir, 'demo-normal-viewport.png'), fullPage: true });
  console.log('1. Normal viewport');
  await page1.close();

  // 2. Narrow viewport (768x1024 tablet)
  const page2 = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page2.goto('http://localhost:5199');
  await page2.waitForTimeout(6000);
  await page2.screenshot({ path: join(outDir, 'demo-narrow-viewport.png'), fullPage: true });
  console.log('2. Narrow viewport');
  await page2.close();

  // 3. Mobile viewport (375x812)
  const page3 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page3.goto('http://localhost:5199');
  await page3.waitForTimeout(6000);
  await page3.screenshot({ path: join(outDir, 'demo-mobile-viewport.png'), fullPage: true });
  console.log('3. Mobile viewport');
  await page3.close();

  // 4. Neon style normal viewport
  const page4 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page4.goto('http://localhost:5199');
  await page4.waitForTimeout(6000);
  await page4.selectOption('select', 'neon-hq');
  await page4.click('button:has-text("Generate")');
  await page4.waitForTimeout(2000);
  await page4.screenshot({ path: join(outDir, 'demo-neon-normal.png'), fullPage: true });
  console.log('4. Neon style');
  await page4.close();

  await browser.close();
  console.log('Demo proof set captured');
}

main().catch(e => { console.error(e); process.exit(1); });
