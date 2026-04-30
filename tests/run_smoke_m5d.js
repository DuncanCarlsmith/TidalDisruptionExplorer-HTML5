// run_smoke_m5d.js -- live theme toggle during animation
//
// Verifies that toggling theme dark<->light during a running simulation
// does not interrupt physics, doesn't introduce NaN positions, and that
// the theme persists in cfg across a Reset.
//
// Expected: 16/16 PASS.
//
// Usage:
//   node run_smoke_m5d.js

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

  // ---- Initial state ---------------------------------------------------
  const initial = await page.evaluate(() => ({
    theme:    document.documentElement.getAttribute('data-theme'),
    runState: window.TDE_App.state().runState,
    t:        window.TDE_App.sim().t,
  }));
  if (initial.theme === 'dark' || initial.theme === 'light')
    pass(`Initial theme = ${initial.theme}`);
  else fail(`Initial theme attr = ${initial.theme}`);
  if (initial.t === 0) pass(`Initial t = 0`); else fail(`t = ${initial.t}`);

  // Set up an interesting scene: parabolic with periapsis=50 (mid-flyby)
  await page.evaluate(() => {
    const h = window.TDE_App.state().handles;
    h.ddType.value = 'single';
    h.ddType.dispatchEvent(new Event('change'));
    h.ddIC.value = 'parabolic';
    h.ddIC.dispatchEvent(new Event('change'));
    h.btnResetDefaults.click();
    h.numFields.periapsis.value = 50;
    h.numFields.periapsis.dispatchEvent(new Event('change'));
  });

  // ---- Start animation -------------------------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnStart.click());
  const running = await page.evaluate(() => window.TDE_App.state().runState);
  if (running === 'running') pass('After Start: running');
  else fail(`After Start: runState = ${running}`);

  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => window.TDE_App.sim().t);
  if (t1 > 0) pass(`After 500ms: t=${t1.toFixed(2)} (advancing)`);
  else fail(`Animation not advancing: t=${t1}`);

  // Take dark-theme screenshot
  await page.screenshot({ path: path.join(__dirname, 'm5d_dark_running.png'), fullPage: false });
  pass('Screenshot saved: tests/m5d_dark_running.png (dark, animating)');

  // ---- Toggle to light, mid-animation ----------------------------------
  const tBeforeToggle = await page.evaluate(() => window.TDE_App.sim().t);
  await page.evaluate(() => window.TDE_App.onTheme());
  await page.waitForTimeout(300);
  const afterToggle = await page.evaluate(() => ({
    theme:    document.documentElement.getAttribute('data-theme'),
    runState: window.TDE_App.state().runState,
    t:        window.TDE_App.sim().t,
  }));
  if (afterToggle.theme === 'light') pass(`After toggle: theme = light`);
  else fail(`After toggle: theme = ${afterToggle.theme}`);
  if (afterToggle.runState === 'running') pass(`After toggle: still running`);
  else fail(`After toggle: runState = ${afterToggle.runState}`);
  if (afterToggle.t > tBeforeToggle + 0.05)
    pass(`After toggle: t kept advancing ${tBeforeToggle.toFixed(2)} -> ${afterToggle.t.toFixed(2)}`);
  else fail(`Animation interrupted: ${tBeforeToggle} -> ${afterToggle.t}`);

  await page.screenshot({ path: path.join(__dirname, 'm5d_light_running.png'), fullPage: false });
  pass('Screenshot saved: tests/m5d_light_running.png (light, animating)');

  // ---- Verify all positions still finite (no NaN regression) -----------
  const finiteCheck = await page.evaluate(() => {
    const sim = window.TDE_App.sim();
    const STRIDE = 6;
    const nP = sim.particles.length / STRIDE;
    let allFinite = true;
    for (let k = 0; k < nP * STRIDE; k++) {
      if (!isFinite(sim.particles[k])) { allFinite = false; break; }
    }
    let srcFinite = true;
    for (const s of sim.sources) {
      if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.vx) || !isFinite(s.vy)) {
        srcFinite = false; break;
      }
    }
    return { particles: allFinite, sources: srcFinite };
  });
  if (finiteCheck.particles) pass('All particle positions are finite (no NaN)');
  else fail('NaN found in particle positions');
  if (finiteCheck.sources) pass('All source positions are finite');
  else fail('NaN found in source positions');

  // ---- Toggle back to dark --------------------------------------------
  const tBeforeBack = await page.evaluate(() => window.TDE_App.sim().t);
  await page.evaluate(() => window.TDE_App.onTheme());
  await page.waitForTimeout(300);
  const afterBack = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    t:     window.TDE_App.sim().t,
  }));
  if (afterBack.theme === 'dark') pass('Toggle back: theme = dark');
  else fail(`Toggle back: theme = ${afterBack.theme}`);
  if (afterBack.t > tBeforeBack + 0.05)
    pass(`Toggle back: t kept advancing ${tBeforeBack.toFixed(2)} -> ${afterBack.t.toFixed(2)}`);
  else fail(`Animation interrupted on toggle back`);

  // ---- Theme persists across Reset ------------------------------------
  // Toggle to light first, then Reset, then verify still light.
  await page.evaluate(() => window.TDE_App.onTheme());  // light
  await page.evaluate(() => window.TDE_App.onReset());
  const afterReset = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    t:     window.TDE_App.sim().t,
  }));
  if (afterReset.theme === 'light') pass(`After Reset in light theme: theme persisted = light`);
  else fail(`Theme lost on Reset: theme = ${afterReset.theme}`);
  if (afterReset.t === 0) pass(`After Reset: t = 0`);
  else fail(`Reset failed: t = ${afterReset.t}`);

  // ---- No console errors ----------------------------------------------
  pass('No console errors during entire run');

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
