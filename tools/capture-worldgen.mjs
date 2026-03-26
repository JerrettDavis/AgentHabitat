import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'poc', 'worldgen');

const seeds = ['alpha-001', 'alpha-002', 'alpha-003'];
const styles = ['retro-office', 'forest-lab', 'neon-hq'];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const htmlPath = join(__dirname, 'worldgen-renderer.html');
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`);
  await page.waitForTimeout(500);

  // Capture the full grid with default settings (3 seeds × 2 styles)
  await page.screenshot({ path: join(outDir, 'worldgen-grid-overview.png'), fullPage: true });
  console.log('Captured: worldgen-grid-overview.png');

  // Now capture individual seed × style combos
  for (const seed of seeds) {
    for (const style of styles) {
      await page.fill('#seeds', seed);
      await page.evaluate((s) => {
        document.getElementById('style1').value = s;
        document.getElementById('style2').value = s;
      }, style);
      await page.click('button:has-text("Generate All")');
      await page.waitForTimeout(300);

      const canvas = page.locator('canvas').first();
      await canvas.screenshot({ path: join(outDir, `worldgen-${seed}-${style}.png`) });
      console.log(`Captured: worldgen-${seed}-${style}.png`);
    }
  }

  // Generate evidence file
  const evidence = {
    generated: new Date().toISOString(),
    seeds,
    styles,
    gridSize: '64x48',
    screenshots: [],
  };

  for (const seed of seeds) {
    for (const style of styles) {
      evidence.screenshots.push({
        file: `worldgen-${seed}-${style}.png`,
        seed,
        style,
        options: { width: 64, height: 48, corridorWidth: 1 },
      });
    }
  }

  const { writeFileSync } = await import('fs');
  writeFileSync(join(outDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log('Wrote evidence.json');

  await browser.close();
  console.log(`Done — ${seeds.length * styles.length} screenshots + 1 overview`);
}

main().catch(e => { console.error(e); process.exit(1); });
