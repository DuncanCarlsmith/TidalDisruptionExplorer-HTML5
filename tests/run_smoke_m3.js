// run_smoke_m3.js -- GUI shell smoke test
//
// Verifies that index.html renders the controls panel, canvas, and
// diagnostic strip without errors, and that the basic UI elements are
// present and responsive. This is the M3 milestone test.
//
// Usage:
//   node run_smoke_m3.js
//
// Prerequisites: see HARNESSES.md (Playwright + Chromium, repo files
// served at http://tde.local/ via in-process route interception).

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

  // Serve repo files at http://tde.local/
  await context.route('http://tde.local/**', async (route, request) => {
    const url = new URL(request.url());
    const p = path.join(REPO_DIR, url.pathname);
    try {
      const body = fs.readFileSync(p);
      let ct = 'application/octet-stream';
      if (p.endsWith('.html')) ct = 'text/html; charset=utf-8';
      else if (p.endsWith('.js')) ct = 'application/javascript; charset=utf-8';
      else if (p.endsWith('.json')) ct = 'application/json; charset=utf-8';
      await route.fulfill({ status: 200, contentType: ct, body });
    } catch (e) {
      await route.fulfill({ status: 404, body: 'Not found: ' + p });
    }
  });

  await page.goto('http://tde.local/index.html');
  await page.waitForFunction(() => window.TDE_App !== undefined, null, { timeout: 5000 });

  // ---- Structural checks ------------------------------------------------
  const dom = await page.evaluate(() => {
    const h = window.TDE_App.state().handles;
    return {
      hasControls:  !!document.getElementById('controls-panel'),
      hasCanvas:    !!document.getElementById('sim-canvas'),
      hasDiagStrip: !!document.getElementById('diag-strip'),
      hasStart:     !!h.btnStart,
      hasPause:     !!h.btnPause,
      hasReset:     !!h.btnReset,
      hasResetDefaults: !!h.btnResetDefaults,
      hasHelp:      !!h.btnHelp,
      hasAbout:     !!h.btnAbout,
      hasTheme:     !!h.btnTheme,
      hasDdType:    !!h.ddType,
      hasDdIC:      !!h.ddIC,
      hasDdLagrange:!!h.ddLagrange,
      handlesKeys:  Object.keys(h).length,
      numFieldKeys: Object.keys(h.numFields || {}).length,
      cfgKeys:      Object.keys(window.TDE_App.cfg()).length,
      appVersion:   window.TDE_App.version,
    };
  });

  if (dom.hasControls)  pass('controls panel present');           else fail('no controls panel');
  if (dom.hasCanvas)    pass('simulation canvas present');        else fail('no canvas');
  if (dom.hasDiagStrip) pass('diagnostic strip present');         else fail('no diag strip');
  if (dom.hasStart)     pass('Start button present');             else fail('no Start');
  if (dom.hasPause)     pass('Pause button present');             else fail('no Pause');
  if (dom.hasReset)     pass('Reset button present');             else fail('no Reset');
  if (dom.hasResetDefaults) pass('Reset defaults button present'); else fail('no Reset defaults');
  if (dom.hasHelp)      pass('Help button present');              else fail('no Help');
  if (dom.hasAbout)     pass('About button present');             else fail('no About');
  if (dom.hasTheme)     pass('Toggle theme button present');      else fail('no Theme toggle');
  if (dom.hasDdType)    pass('scenario dropdown present');        else fail('no scenario dd');
  if (dom.hasDdIC)      pass('IC dropdown present');              else fail('no IC dd');
  if (dom.hasDdLagrange) pass('Lagrange dropdown present');       else fail('no Lagrange dd');
  if (dom.numFieldKeys === 22) pass(`numFields has 22 entries`);
  else fail(`numFields has ${dom.numFieldKeys} entries, expected 22`);
  if (dom.cfgKeys >= 22) pass(`cfg has ${dom.cfgKeys} keys`);
  else fail(`only ${dom.cfgKeys} cfg keys`);
  if (dom.appVersion) pass(`TDE_App.version = ${dom.appVersion}`);
  else fail('no TDE_App.version');

  // ---- Initial state ---------------------------------------------------
  const initial = await page.evaluate(() => {
    const sim = window.TDE_App.sim();
    return {
      t: sim.t,
      runState: window.TDE_App.state().runState,
      nSources: sim.sources.length,
      nParticles: sim.particles.length / 6,
      hasRoche: sim.rocheR_3D && sim.rocheR_3D.length > 0,
    };
  });
  if (initial.t === 0) pass('initial t = 0'); else fail(`initial t = ${initial.t}`);
  if (initial.runState === 'paused' || initial.runState === 'idle') pass(`initial state = ${initial.runState}`);
  else fail(`unexpected initial runState = ${initial.runState}`);
  if (initial.nSources >= 1) pass(`${initial.nSources} source(s) built`);
  else fail('no sources');
  if (initial.nParticles >= 1) pass(`${initial.nParticles} particles built`);
  else fail('no particles');
  if (initial.hasRoche) pass('Roche radii populated');
  else fail('Roche radii missing');

  // ---- Theme toggle works (without animating) --------------------------
  const themeBefore = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => window.TDE_App.onTheme());
  const themeAfter = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  if (themeBefore !== themeAfter)
    pass(`theme toggled ${themeBefore} -> ${themeAfter}`);
  else fail('theme did not change on toggle');
  // toggle back
  await page.evaluate(() => window.TDE_App.onTheme());

  // ---- Reset returns to t=0 -------------------------------------------
  await page.evaluate(() => window.TDE_App.stepN(5));
  const tAfterStep = await page.evaluate(() => window.TDE_App.sim().t);
  await page.evaluate(() => window.TDE_App.onReset());
  const tAfterReset = await page.evaluate(() => window.TDE_App.sim().t);
  if (tAfterStep > 0) pass(`stepN(5) advanced t to ${tAfterStep.toFixed(2)}`);
  else fail(`stepN failed: t = ${tAfterStep}`);
  if (tAfterReset === 0) pass('Reset returns t to 0');
  else fail(`Reset failed: t = ${tAfterReset}`);

  // Take a screenshot for visual confirmation
  await page.screenshot({ path: path.join(__dirname, 'm3_smoke.png'), fullPage: false });
  pass('Screenshot saved: tests/m3_smoke.png');

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
