// run_smoke_m6b.js -- modal popup component
//
// Verifies the Modal namespace: Modal.show/hide, X close button, click
// outside to close, Escape key to close, Modal.show accepts DOM node,
// auto-pause on open, auto-resume on close.
//
// Expected: 19/19 PASS.
//
// Usage:
//   node run_smoke_m6b.js

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

  // ---- 1. Initial state: modal hidden ----------------------------------
  const init = await page.evaluate(() => {
    const ov = document.getElementById('modal-overlay');
    return {
      modalExists: ov !== null,
      hasOverlay:  ov ? ov.classList.contains('modal-overlay') : false,
      isVisible:   ov ? ov.classList.contains('visible') : null,
      ariaHidden:  ov ? ov.getAttribute('aria-hidden') : null,
      isOpenAPI:   window.TDE_App.Modal.isOpen,
    };
  });
  if (init.modalExists)        pass('Modal element exists in DOM'); else fail('Modal element not found');
  if (init.hasOverlay)         pass('Modal has .modal-overlay class'); else fail('missing .modal-overlay');
  if (init.isVisible === false) pass('Modal initially not .visible');  else fail(`visible=${init.isVisible}`);
  if (init.ariaHidden === 'true') pass('Modal initial aria-hidden=true'); else fail(`aria-hidden=${init.ariaHidden}`);
  if (init.isOpenAPI === false) pass('Modal.isOpen = false initially'); else fail(`isOpen=${init.isOpenAPI}`);

  // ---- 2. Click Help: modal opens with title "Help" -------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(50);
  const afterHelp = await page.evaluate(() => {
    const ov = document.getElementById('modal-overlay');
    return {
      isVisible:  ov.classList.contains('visible'),
      title:      document.getElementById('modal-title').textContent,
      bodyLen:    document.getElementById('modal-body').textContent.length,
      ariaHidden: ov.getAttribute('aria-hidden'),
      isOpenAPI:  window.TDE_App.Modal.isOpen,
    };
  });
  if (afterHelp.isVisible) pass('Modal visible after Help click'); else fail('Modal not visible');
  if (afterHelp.title === 'Help') pass(`Modal title = "Help"`); else fail(`title="${afterHelp.title}"`);
  if (afterHelp.bodyLen > 5) pass(`Modal body has content (${afterHelp.bodyLen} chars)`);
  else fail(`Modal body empty: ${afterHelp.bodyLen}`);
  if (afterHelp.ariaHidden === 'false') pass('aria-hidden=false when open');
  else fail(`aria-hidden=${afterHelp.ariaHidden}`);
  if (afterHelp.isOpenAPI === true) pass('Modal.isOpen = true');
  else fail(`Modal.isOpen=${afterHelp.isOpenAPI}`);

  await page.screenshot({ path: path.join(__dirname, 'm6b_help_open.png'), fullPage: false });
  pass('Screenshot saved: tests/m6b_help_open.png');

  // ---- 3. Click X close ----------------------------------------------
  await page.evaluate(() => document.getElementById('modal-close').click());
  await page.waitForTimeout(50);
  const afterClose = await page.evaluate(() => ({
    isVisible: document.getElementById('modal-overlay').classList.contains('visible'),
    isOpenAPI: window.TDE_App.Modal.isOpen,
  }));
  if (!afterClose.isVisible) pass('Modal hidden after X click');
  else fail('Modal still visible');
  if (afterClose.isOpenAPI === false) pass('Modal.isOpen = false after close');
  else fail(`isOpen=${afterClose.isOpenAPI}`);

  // ---- 4. Click About -----------------------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnAbout.click());
  await page.waitForTimeout(50);
  const afterAbout = await page.evaluate(() => ({
    isVisible: document.getElementById('modal-overlay').classList.contains('visible'),
    title:     document.getElementById('modal-title').textContent,
  }));
  if (afterAbout.isVisible && afterAbout.title === 'About')
    pass('About button opens modal with title "About"');
  else fail(`About: visible=${afterAbout.isVisible}, title="${afterAbout.title}"`);

  // ---- 5. Click on overlay to close --------------------------------
  await page.evaluate(() => {
    const ov = document.getElementById('modal-overlay');
    const evt = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: ov });
    ov.dispatchEvent(evt);
  });
  await page.waitForTimeout(50);
  const afterOverlayClick = await page.evaluate(() =>
    document.getElementById('modal-overlay').classList.contains('visible'));
  if (!afterOverlayClick) pass('Click on overlay closes modal');
  else fail('Modal stayed open after overlay click');

  // ---- 6. Escape key closes ----------------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(50);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  const afterEsc = await page.evaluate(() =>
    document.getElementById('modal-overlay').classList.contains('visible'));
  if (!afterEsc) pass('Escape key closes modal');
  else fail('Modal stayed open after Escape');

  // ---- 7. Modal.show with DOM node ---------------------------------
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Custom <strong>HTML</strong> content</p>';
    window.TDE_App.Modal.show('Custom Test', div);
  });
  await page.waitForTimeout(50);
  const customCheck = await page.evaluate(() => ({
    title:     document.getElementById('modal-title').textContent,
    hasStrong: document.querySelectorAll('#modal-body strong').length > 0,
    visible:   document.getElementById('modal-overlay').classList.contains('visible'),
  }));
  if (customCheck.title === 'Custom Test' && customCheck.hasStrong && customCheck.visible)
    pass('Modal.show accepts DOM node content (HTML rendered)');
  else fail(`Custom content: ${JSON.stringify(customCheck)}`);
  await page.evaluate(() => window.TDE_App.Modal.hide());
  await page.waitForTimeout(50);

  // ---- 8. Animation pauses while modal open ------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnStart.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(50);
  const tModalOpen = await page.evaluate(() => window.TDE_App.sim().t);
  await page.waitForTimeout(300);
  const tStillOpen = await page.evaluate(() => window.TDE_App.sim().t);
  if (Math.abs(tModalOpen - tStillOpen) < 1e-9)
    pass(`Animation paused while modal open: t = ${tModalOpen.toFixed(2)} (frozen for 300ms)`);
  else fail(`t advanced ${tModalOpen} -> ${tStillOpen} while modal open`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const tResumed = await page.evaluate(() => window.TDE_App.sim().t);
  if (tResumed > tStillOpen + 0.05)
    pass(`Animation resumed after close: ${tStillOpen.toFixed(2)} -> ${tResumed.toFixed(2)}`);
  else fail(`Animation did not resume: ${tStillOpen} -> ${tResumed}`);

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
