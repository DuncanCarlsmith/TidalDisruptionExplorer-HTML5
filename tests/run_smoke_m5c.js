// run_smoke_m5c.js -- long-running disruption case
//
// With periapsis=30 (well inside Rdisk=68), the cluster is shredded
// into a tidal stream during a parabolic flyby. Verifies that the
// simulation produces qualitatively correct disruption: cluster spread
// grows >3x, bound fraction drops below 95%, COM translates >50 lu.
//
// Pedagogically the most important test - confirms the simulation
// actually demonstrates tidal disruption as advertised.
//
// Expected: 9/9 PASS.
//
// Usage:
//   node run_smoke_m5c.js

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

  // Configure: single parabolic, periapsis=30 (deep inside Rdisk=68).
  await page.evaluate(() => {
    const h = window.TDE_App.state().handles;
    h.ddType.value = 'single';
    h.ddType.dispatchEvent(new Event('change'));
    h.ddIC.value = 'parabolic';
    h.ddIC.dispatchEvent(new Event('change'));
    h.btnResetDefaults.click();
    h.numFields.periapsis.value = 30;
    h.numFields.periapsis.dispatchEvent(new Event('change'));
  });

  function readState() {
    return page.evaluate(() => {
      const sim = window.TDE_App.sim();
      const cfg = window.TDE_App.cfg();
      const STRIDE = 6;
      const nP = sim.particles.length / STRIDE;
      let cx = 0, cy = 0, cvx = 0, cvy = 0;
      for (let k = 0; k < nP; k++) {
        const off = k * STRIDE;
        cx  += sim.particles[off];
        cy  += sim.particles[off + 1];
        cvx += sim.particles[off + 2];
        cvy += sim.particles[off + 3];
      }
      cx /= nP; cy /= nP; cvx /= nP; cvy /= nP;
      let maxR = 0;
      for (let k = 0; k < nP; k++) {
        const off = k * STRIDE;
        const dr = Math.hypot(sim.particles[off] - cx, sim.particles[off + 1] - cy);
        if (dr > maxR) maxR = dr;
      }
      return {
        t: sim.t, periapsis: cfg.periapsis,
        rocheR_disk: sim.rocheR_disk[0],
        cx, cy, maxR,
        bound: TDE.Physics.boundFraction(sim.particles, [cx, cy, cvx, cvy], cfg.particleMass),
        E: TDE.Physics.totalEnergy(sim.sources, sim.particles, cfg.particleMass, cfg.stellarRadius),
      };
    });
  }

  const t0 = await readState();
  if (Math.abs(t0.periapsis - 30) < 1e-9) pass(`Periapsis = 30 (Rdisk = ${t0.rocheR_disk.toFixed(2)})`);
  else fail(`Periapsis = ${t0.periapsis}`);
  if (t0.periapsis < t0.rocheR_disk) pass(`Periapsis (${t0.periapsis}) << Rdisk (${t0.rocheR_disk.toFixed(2)}): disruption regime`);
  else fail(`Periapsis (${t0.periapsis}) >= Rdisk: too gentle`);
  if (t0.bound === 1) pass(`Initial bound = 100% (cluster intact at t=0)`);
  else fail(`Initial bound = ${t0.bound}`);

  await page.screenshot({ path: path.join(__dirname, 'm5c_t0.png'), fullPage: false });
  pass('Screenshot saved: tests/m5c_t0.png');

  // 200 steps -> t=14
  await page.evaluate(() => window.TDE_App.stepN(200));
  const t14 = await readState();
  log(`After 200 steps (t=${t14.t.toFixed(1)}): COM=(${t14.cx.toFixed(2)}, ${t14.cy.toFixed(2)}), maxR=${t14.maxR.toFixed(2)}, bound=${(100*t14.bound).toFixed(0)}%, E=${t14.E.toFixed(2)}`);
  await page.screenshot({ path: path.join(__dirname, 'm5c_t14.png'), fullPage: false });
  pass('Screenshot saved: tests/m5c_t14.png');

  // 400 more steps -> t=42 total
  await page.evaluate(() => window.TDE_App.stepN(400));
  const t42 = await readState();
  log(`After 600 steps (t=${t42.t.toFixed(1)}): COM=(${t42.cx.toFixed(2)}, ${t42.cy.toFixed(2)}), maxR=${t42.maxR.toFixed(2)}, bound=${(100*t42.bound).toFixed(0)}%, E=${t42.E.toFixed(2)}`);
  await page.screenshot({ path: path.join(__dirname, 'm5c_t42.png'), fullPage: false });
  pass('Screenshot saved: tests/m5c_t42.png');

  // ---- Disruption assertions ------------------------------------------
  if (t42.maxR > 3 * t0.maxR)
    pass(`Cluster spread: maxR grew from ${t0.maxR.toFixed(2)} -> ${t42.maxR.toFixed(2)} (factor ${(t42.maxR/t0.maxR).toFixed(1)}x)`);
  else fail(`Cluster spread: ${t0.maxR.toFixed(2)} -> ${t42.maxR.toFixed(2)} (insufficient)`);

  if (t42.bound < 0.95)
    pass(`Bound fraction dropped: 100% -> ${(100*t42.bound).toFixed(0)}%`);
  else fail(`Bound fraction unchanged: ${(100*t42.bound).toFixed(0)}%`);

  const dCOM = Math.hypot(t42.cx - t0.cx, t42.cy - t0.cy);
  if (dCOM > 50) pass(`Cluster COM moved ${dCOM.toFixed(1)} lu from start`);
  else fail(`Cluster COM moved only ${dCOM.toFixed(1)} lu`);

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
