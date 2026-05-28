import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try with headed browser and longer wait to see if mermaid renders
async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Go directly to slide 9 (architecture diagram)
  await page.goto('http://localhost:3030/9', { waitUntil: 'networkidle', timeout: 15000 });

  // Wait longer for mermaid
  await page.waitForTimeout(5000);

  // Check for SVG content inside mermaid divs
  const result = await page.evaluate(() => {
    const mermaidDivs = document.querySelectorAll('.mermaid');
    return Array.from(mermaidDivs).map((div, i) => ({
      index: i,
      innerHTML_length: div.innerHTML.length,
      innerHTML_preview: div.innerHTML.substring(0, 500),
      childElementCount: div.childElementCount,
      children: Array.from(div.children).map(c => ({
        tagName: c.tagName,
        className: c.className?.baseVal || c.className || '',
      })),
      width: Math.round(div.getBoundingClientRect().width),
      height: Math.round(div.getBoundingClientRect().height),
      computedDisplay: getComputedStyle(div).display,
      computedVisibility: getComputedStyle(div).visibility,
    }));
  });

  console.log('Mermaid divs on slide 9 (headed):', JSON.stringify(result, null, 2));

  // Also check the slide's full HTML for mermaid-related content
  const slideHtml = await page.evaluate(() => {
    const slide = document.querySelector('.slidev-page-9') || document.querySelector('.slide-content') || document.querySelector('.slidev-slide-content');
    if (!slide) return '(no slide element found)';
    // Look for any element that might contain rendered mermaid
    const allElements = slide.querySelectorAll('*');
    const mermaidRelated = [];
    for (const el of allElements) {
      if (el.className && typeof el.className === 'string' && el.className.includes('mermaid')) {
        mermaidRelated.push({ tag: el.tagName, class: el.className, children: el.childElementCount, text: el.textContent.substring(0, 100) });
      }
      if (el.tagName === 'svg' || el.tagName === 'SVG') {
        mermaidRelated.push({ tag: 'SVG', id: el.id, class: el.className?.baseVal || '', children: el.childElementCount });
      }
    }
    return mermaidRelated;
  });
  console.log('Mermaid-related elements:', JSON.stringify(slideHtml, null, 2));

  // Take screenshot
  await page.screenshot({ path: path.join(__dirname, 'mermaid-headed-slide-9.png'), fullPage: false });

  await browser.close();
}

main();
