import { chromium } from 'playwright-chromium';
import { readFileSync } from 'fs';

const BASE = 'http://localhost:3030';
const VIEWPORT = { width: 980, height: 552 };

// Count slides from markdown
const md = readFileSync('slides.md', 'utf-8');
const TOTAL = md.split(/\n---/).length;

async function checkSlide(page, num) {
  await page.goto(`${BASE}/${num}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  return await page.evaluate(() => {
    // Find the active/visible slidev-layout
    const layouts = document.querySelectorAll('.slidev-layout');
    let slide = null;
    for (const l of layouts) {
      if (l.clientHeight > 0) { slide = l; break; }
    }
    if (!slide) return { error: 'no visible layout', overflows: false };

    const title = slide.querySelector('h1')?.textContent?.trim()
      || slide.querySelector('h2')?.textContent?.trim()
      || '(untitled)';

    const scrollH = slide.scrollHeight;
    const clientH = slide.clientHeight;
    const scrollW = slide.scrollWidth;
    const clientW = slide.clientWidth;
    const overflowY = scrollH > clientH + 4;
    const overflowX = scrollW > clientW + 4;

    return {
      title,
      overflows: overflowY || overflowX,
      overflowY,
      overflowX,
      scrollH, clientH, scrollW, clientW,
      excessY: Math.max(0, scrollH - clientH),
      excessX: Math.max(0, scrollW - clientW),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  console.log(`Detected ${TOTAL} slides from markdown. Checking each...\n`);

  const issues = [];

  for (let i = 1; i <= TOTAL; i++) {
    const r = await checkSlide(page, i);
    r.slide = i;
    if (r.error) {
      console.log(`  Slide ${String(i).padStart(2)}: SKIP     (${r.error})`);
      continue;
    }
    const status = r.overflows ? 'OVERFLOW' : 'OK';
    const detail = r.overflows
      ? ` [+${r.excessY}px Y, +${r.excessX}px X]`
      : '';
    console.log(`  Slide ${String(i).padStart(2)}: ${status.padEnd(8)} "${r.title}"${detail}`);
    if (r.overflows) issues.push(r);
  }

  console.log(`\n${'='.repeat(60)}`);
  if (issues.length === 0) {
    console.log('All slides fit within the viewport!');
  } else {
    console.log(`\n${issues.length} / ${TOTAL} slide(s) overflow:\n`);
    for (const r of issues) {
      console.log(`  Slide ${r.slide}: "${r.title}"`);
      if (r.overflowY) console.log(`    Vertical: ${r.scrollH}px > ${r.clientH}px (+${r.excessY}px excess)`);
      if (r.overflowX) console.log(`    Horizontal: ${r.scrollW}px > ${r.clientW}px (+${r.excessX}px excess)`);
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
