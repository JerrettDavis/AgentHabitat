import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:5199');
  await page.waitForTimeout(8000);

  // Check for Blazor error UI
  const errorBanner = await page.$('#blazor-error-ui');
  const errorVisible = errorBanner ? await errorBanner.isVisible() : false;

  console.log(`Blazor error banner visible: ${errorVisible}`);
  console.log(`Console errors (${errors.length}):`);
  for (const e of errors) console.log(`  ${e}`);

  // Check canvas state
  const canvas = await page.$('#world-canvas');
  console.log(`Canvas element found: ${!!canvas}`);
  if (canvas) {
    const box = await canvas.boundingBox();
    console.log(`Canvas size: ${box?.width}x${box?.height}`);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
