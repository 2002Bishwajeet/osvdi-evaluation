import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check all slides from 1-53 for mermaid content, and capture the ones that have it
async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const mermaidSlides = [];

  for (let i = 1; i <= 53; i++) {
    await page.goto(`http://localhost:3030/${i}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Check if there's a mermaid diagram on this slide
    const hasMermaid = await page.evaluate(() => {
      return document.querySelectorAll('.mermaid, svg[id^="mermaid"], [data-mermaid]').length > 0;
    });

    if (hasMermaid) {
      console.log(`Slide ${i}: HAS MERMAID`);
      mermaidSlides.push(i);
      const outPath = path.join(__dirname, `mermaid-slide-${i}.png`);
      await page.screenshot({ path: outPath, fullPage: false });

      // Also check if the SVG rendered (has actual content, not empty)
      const svgInfo = await page.evaluate(() => {
        const svgs = document.querySelectorAll('.mermaid svg, svg[id^="mermaid"]');
        return Array.from(svgs).map(svg => ({
          width: svg.getBoundingClientRect().width,
          height: svg.getBoundingClientRect().height,
          childCount: svg.children.length,
          hasText: svg.querySelectorAll('text').length > 0,
        }));
      });
      console.log(`  SVG info:`, JSON.stringify(svgInfo));
    }
  }

  console.log(`\nMermaid slides found: ${mermaidSlides.join(', ')}`);
  await browser.close();
}

main();
