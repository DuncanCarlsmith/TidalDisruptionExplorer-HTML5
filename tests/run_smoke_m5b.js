// run_smoke_m5b.js -- binary scenarios verification
//
// Verifies all 7 binary scenario+IC combinations:
//   - 5 Lagrange placements (L1..L5) at exact equilibrium positions
//   - circumbinary cluster orbital placement
//   - binary parabolic cluster placement
//
// Expected: 35/35 PASS.
//
// Usage:
//   node run_smoke_m5b.js

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

  async function setBinaryScenario(ic, lagrangePoint) {
    await page.evaluate((cfg) => {
      const h = window.TDE_App.state().handles;
      h.ddType.value = 'binary';
      h.ddType.dispatchEvent(new Event('change'));
      h.ddIC.value = cfg.ic;
      h.ddIC.dispatchEvent(new Event('change'));
      h.btnResetDefaults.click();
      if (cfg.lagrangePoint) {
        h.ddLagrange.value = cfg.lagrangePoint;
        h.ddLagrange.dispatchEvent(new Event('change'));
      }
    }, { ic, lagrangePoint });
  }

  async function readSimState() {
    return page.evaluate(() => {
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
        ic: cfg.clusterIC,
        M1: cfg.M1, M2: cfg.M2,
        rocheR_3D: Array.from(sim.rocheR_3D),
        cx, cy, cvx, cvy,
        bound: TDE.Physics.boundFraction(sim.particles, [cx, cy, cvx, cvy], cfg.particleMass),
      };
    });
  }

  // ---- 1. Lagrange L1..L5 ----------------------------------------------
  const lagrangeCases = ['L1','L2','L3','L4','L5'];
  const expectedLag = ref.lagrange_eq.xy;

  for (let i = 0; i < lagrangeCases.length; i++) {
    const pt = lagrangeCases[i];
    await setBinaryScenario('lagrange', pt);
    const obs = await readSimState();
    const [xExp, yExp] = expectedLag[i];

    if (Math.abs(obs.cx - xExp) < 0.5)
      pass(`binary/lagrange/${pt} cluster x = ${obs.cx.toFixed(2)} (ref ${xExp})`);
    else fail(`binary/lagrange/${pt} cluster x = ${obs.cx}, expected ${xExp}`);

    if (Math.abs(obs.cy - yExp) < 0.5)
      pass(`binary/lagrange/${pt} cluster y = ${obs.cy.toFixed(2)} (ref ${yExp.toFixed(2)})`);
    else fail(`binary/lagrange/${pt} cluster y = ${obs.cy}, expected ${yExp}`);

    if (obs.rocheR_3D.length === 2 && Math.abs(obs.rocheR_3D[0] - 40.4608) < 1e-3
                                    && Math.abs(obs.rocheR_3D[1] - 40.4608) < 1e-3)
      pass(`binary/lagrange/${pt} Roche R3D = [${obs.rocheR_3D.map(x => x.toFixed(3)).join(', ')}]`);
    else fail(`binary/lagrange/${pt} Roche R3D = ${JSON.stringify(obs.rocheR_3D)}`);

    if (obs.bound === 1)
      pass(`binary/lagrange/${pt} initial bound = 100%`);
    else fail(`binary/lagrange/${pt} bound = ${obs.bound}`);

    await page.screenshot({ path: path.join(__dirname, `m5b_lagrange_${pt}.png`), fullPage: false });
    pass(`Screenshot saved: tests/m5b_lagrange_${pt}.png`);
  }

  // ---- 2. Circumbinary -------------------------------------------------
  await setBinaryScenario('circumbinary', null);
  const obsCB = await readSimState();
  const refCB = ref.cluster_ic.binary_circumbinary;
  const Mt = 300;  // M1+M2 default = 150+150
  const Mc = 19;   // 19 * 1
  const expectedVyCB = refCB.vy * Mt / (Mt + Mc);

  if (Math.abs(obsCB.cx - refCB.x) < 0.5)
    pass(`binary/circumbinary cluster x = ${obsCB.cx.toFixed(2)} (ref ${refCB.x})`);
  else fail(`binary/circumbinary cluster x = ${obsCB.cx}, expected ${refCB.x}`);

  if (Math.abs(obsCB.cy - refCB.y) < 0.5)
    pass(`binary/circumbinary cluster y = ${obsCB.cy.toFixed(2)} (ref ${refCB.y})`);
  else fail(`binary/circumbinary cluster y = ${obsCB.cy}, expected ${refCB.y}`);

  if (Math.abs(obsCB.cvy - expectedVyCB) < 0.05)
    pass(`binary/circumbinary cluster vy = ${obsCB.cvy.toFixed(4)} (ref ${refCB.vy.toFixed(4)} * Mt/(Mt+mc) = ${expectedVyCB.toFixed(4)})`);
  else fail(`binary/circumbinary cluster vy = ${obsCB.cvy}, expected ~${expectedVyCB}`);

  if (obsCB.bound === 1) pass('binary/circumbinary bound = 100%');
  else fail(`binary/circumbinary bound = ${obsCB.bound}`);

  await page.screenshot({ path: path.join(__dirname, 'm5b_circumbinary.png'), fullPage: false });
  pass('Screenshot saved: tests/m5b_circumbinary.png');

  // ---- 3. Binary parabolic --------------------------------------------
  await setBinaryScenario('parabolic', null);
  const obsBP = await readSimState();
  const refBP = ref.cluster_ic.binary_parabolic;
  const expectedVyBP = refBP.vy * Mt / (Mt + Mc);

  if (Math.abs(obsBP.cx - refBP.x) < 0.5)
    pass(`binary/parabolic cluster x = ${obsBP.cx.toFixed(2)} (ref ${refBP.x})`);
  else fail(`binary/parabolic cluster x = ${obsBP.cx}, expected ${refBP.x}`);

  if (Math.abs(obsBP.cy - refBP.y) < 0.5)
    pass(`binary/parabolic cluster y = ${obsBP.cy.toFixed(2)} (ref ${refBP.y})`);
  else fail(`binary/parabolic cluster y = ${obsBP.cy}, expected ${refBP.y}`);

  if (Math.abs(obsBP.cvy - expectedVyBP) < 0.05)
    pass(`binary/parabolic cluster vy = ${obsBP.cvy.toFixed(4)} (ref ${refBP.vy.toFixed(4)} * Mt/(Mt+mc) = ${expectedVyBP.toFixed(4)})`);
  else fail(`binary/parabolic cluster vy = ${obsBP.cvy}, expected ~${expectedVyBP}`);

  if (obsBP.bound === 1) pass('binary/parabolic bound = 100%');
  else fail(`binary/parabolic bound = ${obsBP.bound}`);

  await page.screenshot({ path: path.join(__dirname, 'm5b_binary_parabolic.png'), fullPage: false });
  pass('Screenshot saved: tests/m5b_binary_parabolic.png');

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
