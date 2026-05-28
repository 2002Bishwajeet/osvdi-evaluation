import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Remaining slides that need to be re-captured at 1x scale
const SLIDES = [
  33, 35, 36, 37,
  39, 40, 41, 42, 43,
  44, 45, 46, 47, 48,
  49, 50, 51
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const slideNum of SLIDES) {
    const url = `http://localhost:3030/${slideNum}`;
    console.log(`Capturing slide ${slideNum}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      const outPath = path.join(__dirname, `review-slide-${slideNum}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  -> saved ${outPath}`);
    } catch (err) {
      console.error(`  ERROR on slide ${slideNum}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('Done!');
}

main();
