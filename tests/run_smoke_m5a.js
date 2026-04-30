// run_smoke_m5a.js -- single-source IC verification
//
// For each of the 4 single-source IC families (circular, elliptical,
// parabolic, hyperbolic), verifies that the cluster IC matches the
// MATLAB reference values from physics_reference.json. The cluster vy
// is compared against ref.vy * M_src / (M_src + M_cluster), accounting
// for the subtractTotalCOMVelocity correction applied at IC build.
//
// Expected: 24/24 PASS (6 checks per IC * 4 ICs).
//
// Usage:
//   node run_smoke_m5a.js

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

  const ref = JSON.parse(fs.readFileSync(path.join(REPO_DIR, 'physics_reference.json'), 'utf8'));

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

  const cases = [
    { ic: 'circular',   refKey: 'single_circular' },
    { ic: 'elliptical', refKey: 'single_elliptical' },
    { ic: 'parabolic',  refKey: 'single_parabolic' },
    { ic: 'hyperbolic', refKey: 'single_hyperbolic' },
  ];

  for (const c of cases) {
    await page.evaluate((ic) => {
      const h = window.TDE_App.state().handles;
      h.ddType.value = 'single';
      h.ddType.dispatchEvent(new Event('change'));
      h.ddIC.value = ic;
      h.ddIC.dispatchEvent(new Event('change'));
      h.btnResetDefaults.click();
    }, c.ic);

    const obs = await page.evaluate(() => {
      const sim = window.TDE_App.sim();
      const cfg = window.TDE_App.cfg();
      const STRIDE = 6;
      const nP = sim.particles.length / STRIDE;
      let cx = 0, cy = 0, cvx = 0, cvy = 0;
      for (let k = 0; k < nP; k++) {
        const off = k * STRIDE;
        cx  += sim.particles[off + 0];
        cy  += sim.particles[off + 1];
        cvx += sim.particles[off + 2];
        cvy += sim.particles[off + 3];
      }
      cx /= nP; cy /= nP; cvx /= nP; cvy /= nP;
      return {
        cx, cy, cvx, cvy,
        sourceMass:    cfg.sourceMass,
        Nparticles:    cfg.Nparticles,
        particleMass:  cfg.particleMass,
        rocheR_3D:     Array.from(sim.rocheR_3D),
        bound:         TDE.Physics.boundFraction(sim.particles, [cx, cy, cvx, cvy], cfg.particleMass),
      };
    });

    const refIC = ref.cluster_ic[c.refKey];
    const M = obs.sourceMass;
    const Mc = obs.Nparticles * obs.particleMass;
    const expectedVy = refIC.vy * M / (M + Mc);

    if (Math.abs(obs.cx - refIC.x) < 1.0)
      pass(`single/${c.ic} cluster COM x = ${obs.cx.toFixed(2)} (ref ${refIC.x})`);
    else fail(`single/${c.ic} cluster x = ${obs.cx}, expected ${refIC.x}`);

    if (Math.abs(obs.cy - refIC.y) < 1.0)
      pass(`single/${c.ic} cluster COM y = ${obs.cy.toFixed(2)} (ref ${refIC.y})`);
    else fail(`single/${c.ic} cluster y = ${obs.cy}, expected ${refIC.y}`);

    if (Math.abs(obs.cvy - expectedVy) < 0.01)
      pass(`single/${c.ic} cluster vy = ${obs.cvy.toFixed(4)} (ref ${refIC.vy.toFixed(4)} * M/(M+mc) = ${expectedVy.toFixed(4)})`);
    else fail(`single/${c.ic} cluster vy = ${obs.cvy}, expected ${expectedVy}`);

    if (Math.abs(obs.rocheR_3D[0] - 82.0302) < 1e-3)
      pass(`single/${c.ic} Roche R3D = ${obs.rocheR_3D[0].toFixed(4)}`);
    else fail(`single/${c.ic} Roche R3D = ${obs.rocheR_3D[0]}`);

    if (obs.bound === 1)
      pass(`single/${c.ic} initial bound fraction = 100%`);
    else fail(`single/${c.ic} bound = ${obs.bound}`);

    await page.screenshot({ path: path.join(__dirname, `m5a_single_${c.ic}.png`), fullPage: false });
    pass(`Screenshot saved: tests/m5a_single_${c.ic}.png`);
  }

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
