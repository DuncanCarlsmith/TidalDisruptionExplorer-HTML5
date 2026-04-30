// run_smoke_m6c.js -- help text wired into modal popups
//
// Verifies that Help and About modals contain real content from
// help_text.js: 22 params + 6 diagnostics in Help, 4 section headings
// + 24 paragraphs + 3 formula lines in About.
//
// Expected: 30/30 PASS.
//
// Usage:
//   node run_smoke_m6c.js

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

  // ---- 1. Open Help, verify content -----------------------------------
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(50);

  const helpInfo = await page.evaluate(() => {
    const body = document.getElementById('modal-body');
    return {
      title:        document.getElementById('modal-title').textContent,
      bodyText:     body.textContent,
      bodyLength:   body.textContent.length,
      sectionCount: body.querySelectorAll('.help-section').length,
      entryCount:   body.querySelectorAll('.help-entry').length,
      labelCount:   body.querySelectorAll('.help-entry .help-label').length,
      unitsCount:   body.querySelectorAll('.help-entry .help-units').length,
      descCount:    body.querySelectorAll('.help-entry .help-desc').length,
      firstLabel:   body.querySelector('.help-entry .help-label')?.textContent,
      firstDesc:    body.querySelector('.help-entry .help-desc')?.textContent,
    };
  });

  if (helpInfo.title === 'Help') pass('Help modal title');
  else fail(`Help title = "${helpInfo.title}"`);

  if (helpInfo.bodyLength > 8000)
    pass(`Help body has substantial content (${helpInfo.bodyLength} chars)`);
  else fail(`Help body too short: ${helpInfo.bodyLength} chars`);

  if (helpInfo.sectionCount === 2) pass('Help has 2 sections (NUMERIC PARAMETERS, DIAGNOSTIC READOUTS)');
  else fail(`Help section count = ${helpInfo.sectionCount}`);

  if (helpInfo.entryCount === 28) pass('Help has 28 entries (22 params + 6 diagnostics)');
  else fail(`Help entry count = ${helpInfo.entryCount}, expected 28`);

  if (helpInfo.labelCount === 28 && helpInfo.unitsCount === 28 && helpInfo.descCount === 28)
    pass('All entries have label, units, and description');
  else fail(`Counts: labels=${helpInfo.labelCount}, units=${helpInfo.unitsCount}, descs=${helpInfo.descCount}`);

  if (helpInfo.firstLabel === 'dt') pass('First entry is dt (matches PARAM_TABLE order)');
  else fail(`First entry label = "${helpInfo.firstLabel}"`);

  if (helpInfo.firstDesc && helpInfo.firstDesc.includes('Velocity-Verlet timestep'))
    pass('First entry description starts as expected');
  else fail(`First desc = "${helpInfo.firstDesc?.substring(0, 50)}..."`);

  const helpKeyTerms = [
    'Velocity-Verlet timestep', 'restitution', 'inelastic collapse',
    'hex-packed', 'periapsis', 'Lagrange', 'angular momentum',
  ];
  for (const term of helpKeyTerms) {
    if (helpInfo.bodyText.includes(term)) pass(`Help mentions "${term}"`);
    else fail(`Help missing "${term}"`);
  }

  await page.screenshot({ path: path.join(__dirname, 'm6c_help_open.png'), fullPage: false });
  pass('Screenshot saved: tests/m6c_help_open.png');

  // ---- 2. Close Help, open About --------------------------------------
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  await page.evaluate(() => window.TDE_App.state().handles.btnAbout.click());
  await page.waitForTimeout(50);

  const aboutInfo = await page.evaluate(() => {
    const body = document.getElementById('modal-body');
    return {
      title:           document.getElementById('modal-title').textContent,
      bodyLength:      body.textContent.length,
      headingCount:    body.querySelectorAll('.about-section-heading').length,
      paragraphCount:  body.querySelectorAll('.about-paragraph').length,
      formulaCount:    body.querySelectorAll('.about-formula').length,
      bodyText:        body.textContent,
    };
  });

  if (aboutInfo.title === 'About') pass('About modal title');
  else fail(`About title = "${aboutInfo.title}"`);

  if (aboutInfo.bodyLength > 4000)
    pass(`About body has substantial content (${aboutInfo.bodyLength} chars)`);
  else fail(`About body too short: ${aboutInfo.bodyLength}`);

  if (aboutInfo.headingCount === 4)
    pass('About has 4 section headings (PHYSICS, 2D vs 3D ROCHE, EXPERIMENTS, USAGE)');
  else fail(`About has ${aboutInfo.headingCount} headings, expected 4`);

  if (aboutInfo.paragraphCount >= 20)
    pass(`About has ${aboutInfo.paragraphCount} paragraphs`);
  else fail(`About has only ${aboutInfo.paragraphCount} paragraphs`);

  if (aboutInfo.formulaCount >= 2)
    pass(`About has ${aboutInfo.formulaCount} formula lines (indented)`);
  else fail(`About has ${aboutInfo.formulaCount} formula lines`);

  const aboutKeyTerms = [
    'PHYSICS', 'ROCHE', 'EXPERIMENTS', '2.44',
    'Velocity-Verlet', 'symplectic', 'Shoemaker-Levy', 'Saturn',
  ];
  for (const term of aboutKeyTerms) {
    if (aboutInfo.bodyText.includes(term)) pass(`About mentions "${term}"`);
    else fail(`About missing "${term}"`);
  }

  await page.screenshot({ path: path.join(__dirname, 'm6c_about_open.png'), fullPage: false });
  pass('Screenshot saved: tests/m6c_about_open.png');

  // ---- 3. Reopen Help -> content rebuilt fresh ------------------------
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  await page.evaluate(() => window.TDE_App.state().handles.btnHelp.click());
  await page.waitForTimeout(50);
  const reopened = await page.evaluate(() => ({
    title:   document.getElementById('modal-title').textContent,
    entries: document.getElementById('modal-body').querySelectorAll('.help-entry').length,
  }));
  if (reopened.title === 'Help' && reopened.entries === 28)
    pass('Help reopened with 28 entries (no leftover About content)');
  else fail(`Reopen check: title=${reopened.title}, entries=${reopened.entries}`);

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Harness error:', err);
  process.exit(1);
});
