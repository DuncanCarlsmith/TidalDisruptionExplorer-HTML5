// run_smoke_m6d.js -- MathJax math rendering in modals
//
// Verifies MathJax 3 loads from cdn.jsdelivr.net, typesets math in
// the Help and About modals, and re-typesets on every modal open.
// Requires network access to the CDN.
//
// Expected: 13/13 PASS.
//
// Usage:
//   node run_smoke_m6d.js

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPO_DIR = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1380, height: 880 } });
  const page = await context.newPage();

  let nPass = 0, nFail = 0;
  const log = (m) => console.log(m);
  const pass = (m) => { nPass++; log('[PASS] ' + m); };
  const fail = (m) => { nFail++; log('[FAIL] ' + m); };

  page.on('pageerror', err => fail('Page error: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') fail('Console error: ' + msg.text());
  });

  const networkLog = [];
  page.on('response', resp => {
    networkLog.push({ url: resp.url(), status: resp.status() });
  });

  // Route only tde.local; cdn.jsdelivr.net goes through the network unrouted.
  await context.route('http://tde.local/**', async (route, request) => {
    const url = new URL(request.url());
    const p = path.join(REPO_DIR, url.pathname);
    try {
      const body = fs.readFileSync(p);
      let ct = 'application/octet-stream';
      if (p.endsWith('.html')) ct = 'text/html; charset=utf-8';
      else if (p.endsWith('.js')) ct = 'application/javascript; charset=utf-8';
      await route.fulfill({ status: 200, contentType: ct, body });
    } catch (e) {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });

  await page.goto('http://tde.local/index.html');
  await page.waitForFunction(() => window.TDE_App !== undefined, null, { timeout: 5000 });

  // ---- 1. MathJax script tag exists ------------------------------------
  const tagInfo = await page.evaluate(() => {
    const tag = document.getElementById('mathjax-script');
    return tag ? { src: tag.src, async: tag.async } : null;
  });
  if (tagInfo && tagInfo.src.includes('mathjax')) pass('MathJax <script> tag present');
  else fail(`MathJax tag: ${JSON.stringify(tagInfo)}`);
  if (tagInfo && tagInfo.async) pass('MathJax loads async');
  else fail('MathJax not async');

  // ---- 2. MathJax loads from CDN --------------------------------------
  try {
    await page.waitForFunction(
      () => window.MathJax && window.MathJax.typesetPromise,
      null,
      { timeout: 10000 }
    );
    pass('MathJax loaded from CDN (window.MathJax.typesetPromise available)');
  } catch (e) {
    fail('MathJax did not load within 10s: ' + e.message);
  }

  const mjResponses = networkLog.filter(r =>
    r.url.includes('cdn.jsdelivr.net') && r.url.includes('mathjax'));
  if (mjResponses.length > 0)
    pass(`Got ${mjResponses.length} MathJax CDN responses (statuses: ${mjResponses.map(r => r.status).join(',')})`);
  else fail('No MathJax CDN responses recorded');

  // ---- 3. Open Help, verify math typeset ------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(800);

  const helpMath = await page.evaluate(() => {
    const body = document.getElementById('modal-body');
    return {
      mjxContainerCount: body.querySelectorAll('mjx-container').length,
      stillHasLatexMarkers: body.textContent.includes('\\(') || body.textContent.includes('\\['),
    };
  });

  if (helpMath.mjxContainerCount > 0) pass(`Help has ${helpMath.mjxContainerCount} typeset math elements`);
  else fail('Help has no mjx-container elements');

  if (!helpMath.stillHasLatexMarkers) pass('Help: raw \\(...\\) markers replaced (typeset succeeded)');
  else fail('Help still contains raw \\(...\\) markers');

  await page.screenshot({ path: path.join(__dirname, 'm6d_help_math.png'), fullPage: false });
  pass('Screenshot saved: tests/m6d_help_math.png');

  // ---- 4. Close, open About, verify display math ----------------------
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  await page.evaluate(() => window.TDE_App.state().handles.btnAbout.click());
  await page.waitForTimeout(800);

  const aboutMath = await page.evaluate(() => {
    const body = document.getElementById('modal-body');
    return {
      mjxContainerCount: body.querySelectorAll('mjx-container').length,
      displayMathCount:  body.querySelectorAll('mjx-container[display="true"]').length,
      stillHasLatexMarkers: body.textContent.includes('\\(') || body.textContent.includes('\\['),
    };
  });

  if (aboutMath.mjxContainerCount > 0) pass(`About has ${aboutMath.mjxContainerCount} typeset math elements`);
  else fail('About has no math');

  if (aboutMath.displayMathCount >= 3)
    pass(`About has ${aboutMath.displayMathCount} display math equations`);
  else fail(`About has only ${aboutMath.displayMathCount} display equations`);

  if (!aboutMath.stillHasLatexMarkers) pass('About: raw \\(...\\) markers replaced');
  else fail('About still contains raw \\(...\\) markers');

  await page.screenshot({ path: path.join(__dirname, 'm6d_about_math.png'), fullPage: false });
  pass('Screenshot saved: tests/m6d_about_math.png');

  // ---- 5. Reopen Help: math still typesets ----------------------------
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(800);
  const helpAgain = await page.evaluate(() =>
    document.getElementById('modal-body').querySelectorAll('mjx-container').length);
  if (helpAgain > 0)
    pass(`Reopened Help has ${helpAgain} math elements (typesets on every open)`);
  else fail('Reopened Help has no math');

  pass('Reached end of test with no page errors');

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
