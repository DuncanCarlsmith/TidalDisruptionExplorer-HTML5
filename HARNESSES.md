# Test Harnesses

This repo includes 10 test harnesses in the `tests/` directory that
verify the milestones M3 through M6d of the HTML5 port. Each is a
standalone Node.js script using [Playwright](https://playwright.dev/)
to drive a headless Chromium browser against `index.html` and check
behaviors programmatically.

The M2 physics-parity test is separate -- it lives in `test_parity.html`
and runs in any browser (no Node required).

## What each harness tests

| File                  | Milestone | What it checks                                                | Expected |
|-----------------------|-----------|---------------------------------------------------------------|----------|
| `run_smoke_m3.js`     | M3        | GUI shell: panel, canvas, buttons, dropdowns, theme toggle, Reset | --       |
| `run_smoke_m4.js`     | M4        | Animation loop, Pause/Resume/Reset, diagnostic strip, L_z conservation | -- |
| `run_smoke_m5a.js`    | M5a       | All 4 single-source IC families match MATLAB reference        | 24/24    |
| `run_smoke_m5b.js`    | M5b       | All 7 binary scenarios incl. L1..L5 placements                | 35/35    |
| `run_smoke_m5c.js`    | M5c       | Disruption case (periapsis=30): cluster shreds 12x, bound drops to 11% | 9/9 |
| `run_smoke_m5d.js`    | M5d       | Theme toggle during animation; persists across Reset          | 16/16    |
| `run_smoke_m6a.js`    | M6a       | help_text.js data structure validation (Node-only, no browser) | 18/18   |
| `run_smoke_m6b.js`    | M6b       | Modal popup component (X / overlay / Escape close, auto-pause) | 19/19    |
| `run_smoke_m6c.js`    | M6c       | Help and About modals contain real help_text.js content       | 30/30    |
| `run_smoke_m6d.js`    | M6d       | MathJax loads from CDN, typesets math in modals               | 13/13    |

PASS counts above are the historical results; see PROGRESS.md commit
log for when each was first verified.

## Recovery note

These harness files are reconstructions, not the originals. The
harnesses were originally written and run inside an ephemeral Linux
sandbox during development sessions. The PASS counts in the table above
were observed in that environment but the source files were lost when
the sandbox shut down. The reconstructed source here matches the
documented test logic and selector usage from the conversation log; it
should run cleanly but has not been re-verified end-to-end since
recovery. If a harness fails on first run, the most likely culprit is a
selector or test-hook name -- those should be checked against the
current `index.html`.

## Prerequisites

- **Node.js 18+** (for `node` interpreter)
- **Playwright** with a headless Chromium browser

Install Playwright once in this repo:

```bash
cd /path/to/TidalDisruptionExplorer-HTML5
npm install                  # reads package.json devDependencies
npx playwright install chromium   # downloads the browser binary
```

## Running

From the repo root:

```bash
# Run a single harness:
node tests/run_smoke_m5c.js

# Or via npm scripts (defined in package.json):
npm run test:m5c

# Run all of them sequentially (M6a first since it's the only one that
# doesn't need a browser, so the cheapest sanity check):
npm run test:all
```

Each harness prints `[PASS] ...` and `[FAIL] ...` lines, then a final
summary like `=== 35 PASS, 0 FAIL ===`. Exit code is 0 on success,
non-zero on failure.

## How the harnesses load index.html

The harnesses use Playwright's route-interception feature to serve the
repo files at the URL `http://tde.local/index.html`. This avoids needing
to start a separate HTTP server: the test harness intercepts requests
to `tde.local` and reads files directly from the repo directory on
disk.

The one exception is `run_smoke_m6d.js`, which lets requests to
`cdn.jsdelivr.net` go through to the real network in order to verify
that MathJax loads from its CDN.

If you'd prefer to run the harness against a live HTTP server instead
(e.g. `python3 -m http.server 8765`), edit each harness to change the
`page.goto('http://tde.local/index.html')` line to point at your
server's URL and remove the `context.route(...)` block.

## Test hooks in index.html

The harnesses depend on the `window.TDE_App` namespace exposed by the
GUI. This namespace is set by `init()` in `index.html`:

```js
window.TDE_App = {
  state:   () => state,            // entire state object inc. handles
  cfg:     () => state.cfg,        // current config (numeric params)
  sim:     () => state.sim,        // current sim state (sources, particles, t)
  onReset, onTheme, onScenarioChange,
  Modal: Modal,                    // modal popup namespace
  stepN: (n) => { ... },           // headless physics advance, no RAF
  version: '0.1.0',
};
```

`stepN(N)` is the most useful test hook: it advances physics N times
without RAF or rendering, returns synchronously, and is deterministic.
Harnesses use it instead of waiting for the animation loop wherever
possible.

## Screenshots

Several harnesses save screenshots to the `tests/` directory as
`m5a_single_circular.png`, `m5c_t14.png`, etc. These are regenerable
on every run and are gitignored (`tests/.gitignore`).

## Adding new harnesses

The harness boilerplate is roughly 40 lines:

```js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPO_DIR = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1380, height: 880 } });
  const page = await context.newPage();

  let nPass = 0, nFail = 0;
  const pass = (m) => { nPass++; console.log('[PASS] ' + m); };
  const fail = (m) => { nFail++; console.log('[FAIL] ' + m); };

  page.on('pageerror', err => fail('Page error: ' + err.message));

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

  // ... your test logic here ...

  console.log(`\n=== ${nPass} PASS, ${nFail} FAIL ===`);
  await browser.close();
  process.exit(nFail > 0 ? 1 : 0);
})();
```

## Reproducing the original PASS counts

Run them in this order (M6a first because it's pure Node, so the
fastest way to confirm `help_text.js` is intact):

```bash
node tests/run_smoke_m6a.js   # 18/18
node tests/run_smoke_m3.js    # GUI shell smoke
node tests/run_smoke_m4.js    # animation loop smoke
node tests/run_smoke_m5a.js   # 24/24
node tests/run_smoke_m5b.js   # 35/35
node tests/run_smoke_m5c.js   # 9/9
node tests/run_smoke_m5d.js   # 16/16
node tests/run_smoke_m6b.js   # 19/19
node tests/run_smoke_m6c.js   # 30/30
node tests/run_smoke_m6d.js   # 13/13   (requires CDN access)
```

Cumulative expected: **164 sub-checks PASS, 0 FAIL** across the 8
harnesses with documented counts (M3 and M4 don't have a fixed total).
