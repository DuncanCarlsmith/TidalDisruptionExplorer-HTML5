// run_smoke_m4.js -- animation loop smoke test
//
// Verifies that Start/Pause/Resume/Reset semantics work, the
// requestAnimationFrame loop advances physics, and diagnostic readouts
// update. M4 milestone test.
//
// Usage:
//   node run_smoke_m4.js

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
      await route.fulfill({ status: 404, body: 'Not found: ' + p });
    }
  });

  await page.goto('http://tde.local/index.html');
  await page.waitForFunction(() => window.TDE_App !== undefined, null, { timeout: 5000 });

  // ---- Initial state ---------------------------------------------------
  const t0 = await page.evaluate(() => window.TDE_App.sim().t);
  if (t0 === 0) pass('initial t = 0'); else fail(`t = ${t0}`);

  // ---- stepN advances physics deterministically ------------------------
  await page.evaluate(() => window.TDE_App.stepN(50));
  const tStep = await page.evaluate(() => window.TDE_App.sim().t);
  if (tStep > 0) pass(`stepN(50) -> t = ${tStep.toFixed(3)}`);
  else fail(`stepN failed: t = ${tStep}`);

  // ---- Reset returns to t=0 -------------------------------------------
  await page.evaluate(() => window.TDE_App.onReset());
  const tReset = await page.evaluate(() => window.TDE_App.sim().t);
  if (tReset === 0) pass('Reset returns to t=0');
  else fail(`Reset failed: t = ${tReset}`);

  // ---- Start button kicks off the animation loop ----------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnStart.click());
  await page.waitForTimeout(500);
  const tRun = await page.evaluate(() => window.TDE_App.sim().t);
  if (tRun > 0) pass(`Start advanced t to ${tRun.toFixed(3)} after 500ms`);
  else fail(`animation did not advance: t = ${tRun}`);

  // ---- Pause stops advancement ----------------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnPause.click());
  const tPaused = await page.evaluate(() => window.TDE_App.sim().t);
  await page.waitForTimeout(300);
  const tStillPaused = await page.evaluate(() => window.TDE_App.sim().t);
  if (Math.abs(tStillPaused - tPaused) < 1e-9)
    pass(`Pause halts advancement: t = ${tPaused.toFixed(3)} stayed frozen`);
  else fail(`pause failed: ${tPaused} -> ${tStillPaused}`);

  // ---- Resume continues from pause ------------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnPause.click());
  await page.waitForTimeout(300);
  const tResumed = await page.evaluate(() => window.TDE_App.sim().t);
  if (tResumed > tPaused + 0.05) pass(`Resume continues: ${tPaused.toFixed(3)} -> ${tResumed.toFixed(3)}`);
  else fail(`resume failed: ${tPaused} -> ${tResumed}`);

  // ---- Reset works mid-animation --------------------------------------
  await page.evaluate(() => window.TDE_App.onReset());
  const tFinalReset = await page.evaluate(() => window.TDE_App.sim().t);
  if (tFinalReset === 0) pass('mid-animation Reset returns t=0');
  else fail(`mid-animation Reset failed: t = ${tFinalReset}`);

  // ---- Diagnostic strip updates ---------------------------------------
  await page.evaluate(() => window.TDE_App.stepN(50));
  const diag = await page.evaluate(() => ({
    t:     document.getElementById('diag-t').textContent,
    sep:   document.getElementById('diag-sep').textContent,
    speed: document.getElementById('diag-speed').textContent,
    bound: document.getElementById('diag-bound').textContent,
    E:     document.getElementById('diag-E').textContent,
    L:     document.getElementById('diag-L').textContent,
  }));
  for (const k of Object.keys(diag)) {
    if (diag[k].length > 4) pass(`diag-${k} populated: "${diag[k]}"`);
    else fail(`diag-${k} empty: "${diag[k]}"`);
  }

  // ---- Conservation: angular momentum exact in elastic mode -----------
  // (energyLoss=0.3 by default so E drifts, but L_z is conserved exactly
  // regardless because contact normals are central.)
  await page.evaluate(() => window.TDE_App.onReset());
  const Lstart = await page.evaluate(() => {
    const sim = window.TDE_App.sim();
    const cfg = window.TDE_App.cfg();
    return TDE.Physics.totalAngularMomentum(sim.sources, sim.particles, cfg.particleMass);
  });
  await page.evaluate(() => window.TDE_App.stepN(100));
  const Lend = await page.evaluate(() => {
    const sim = window.TDE_App.sim();
    const cfg = window.TDE_App.cfg();
    return TDE.Physics.totalAngularMomentum(sim.sources, sim.particles, cfg.particleMass);
  });
  const Ldrift = Math.abs(Lend - Lstart) / Math.abs(Lstart);
  if (Ldrift < 1e-9) pass(`L_z conservation: drift = ${Ldrift.toExponential(2)} over 100 steps`);
  else fail(`L_z drift = ${Ldrift.toExponential(2)} (too large)`);

  await page.screenshot({ path: path.join(__dirname, 'm4_smoke.png'), fullPage: false });
  pass('Screenshot saved: tests/m4_smoke.png');

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
