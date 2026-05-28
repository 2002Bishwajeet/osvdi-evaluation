import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check the specific mermaid slides in depth
const SLIDES = [9, 38, 48];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const slideNum of SLIDES) {
    await page.goto(`http://localhost:3030/${slideNum}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000); // extra wait for mermaid rendering

    console.log(`\n=== Slide ${slideNum} ===`);

    // Get the title
    const title = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent.trim() : '(no h1 found)';
    });
    console.log(`Title: ${title}`);

    // Check for ANY SVG on the page
    const svgInfo = await page.evaluate(() => {
      const allSvgs = document.querySelectorAll('svg');
      return {
        svgCount: allSvgs.length,
        svgDetails: Array.from(allSvgs).slice(0, 5).map(svg => ({
          id: svg.id || '(no id)',
          className: svg.className?.baseVal || svg.className || '(no class)',
          width: Math.round(svg.getBoundingClientRect().width),
          height: Math.round(svg.getBoundingClientRect().height),
          childCount: svg.children.length,
          parentClass: svg.parentElement?.className || '(no parent class)',
        })),
      };
    });
    console.log(`SVGs found: ${svgInfo.svgCount}`);
    console.log(`SVG details:`, JSON.stringify(svgInfo.svgDetails, null, 2));

    // Check for mermaid containers
    const mermaidInfo = await page.evaluate(() => {
      const containers = document.querySelectorAll('.mermaid, [class*="mermaid"], pre code.language-mermaid');
      return Array.from(containers).map(el => ({
        tagName: el.tagName,
        className: el.className,
        innerHTML_length: el.innerHTML.length,
        innerHTML_preview: el.innerHTML.substring(0, 200),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));
    });
    console.log(`Mermaid containers:`, JSON.stringify(mermaidInfo, null, 2));

    // Screenshot
    const outPath = path.join(__dirname, `mermaid-detail-slide-${slideNum}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Screenshot saved: ${outPath}`);
  }

  await browser.close();
}

main();
