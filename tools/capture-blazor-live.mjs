import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  await page.goto('http://localhost:5199');
  // Wait for Blazor WASM to load
  await page.waitForTimeout(5000);

  // Should auto-generate on load. Capture the page.
  await page.screenshot({ path: join(outDir, 'parity-blazor-live.png'), fullPage: true });
  console.log('Captured live Blazor app');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
