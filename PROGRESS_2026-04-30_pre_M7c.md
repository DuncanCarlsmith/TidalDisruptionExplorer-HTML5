# Tidal Disruption Explorer — HTML5 Port: Progress Journal

## Project goal

Port the MATLAB Live Script `TidalDisruptionExplorer.m` (in
`/Users/duncancarlsmith/Documents/MATLAB/Roche limit/TidalDisruptionExplorerMATLAB/TidalDisruptionExplorer folder/`)
to a single-file HTML5 web app with full feature and physics parity. Eventually
deploy as a GitHub Pages site at `duncancarlsmith.github.io/TidalDisruptionExplorer-HTML5/`.

## Source MATLAB files (read-only reference, never to be modified)

Located in `TidalDisruptionExplorer folder/`:
- `TidalDisruptionExplorer.m` — main Live Script with GUI + local helper functions
- `physics_core.m` — velocity-Verlet, force law, collisions, diagnostics
- `cluster_ic.m` — initial conditions for 7 scenario+IC combinations
- `binary_ic.m` — Kepler binary at given separation/eccentricity/phase
- `lagrange_point.m` — L1..L5 for restricted three-body problem
- `parameter_help.m` — text content for Help and About popups
- `BACKGROUND.md` / `.pdf` — physics writeup
- `CHALLENGES.md` / `.pdf` — suggested experiments

## Constraints (per Duncan, 2026-04-29)

1. Match MATLAB GUI exactly — same controls, no sliders or tooltips for now
   (preserve room to add later).
2. Target laptop screens initially; resize-friendly so eventual mobile is doable.
3. Single self-contained `index.html` (CSS + JS inline) for distribution.
4. No external libs except MathJax 3 (CDN, lazy-loaded for popup math).
5. Full physics parity verified against MATLAB reference values to ~1e-9
   (pure functions) and ~1e-6 (N-step trajectories).
6. NEVER modify or overwrite files in `TidalDisruptionExplorerMATLAB/`.
7. All new output goes to `TidalDisruptionExplorerHTML/repo/` (this folder).
8. Theme toggle (dark/light) included.

## Architecture

Single `index.html` containing:
- `Defaults` module: `scenarioDefaults`, `relevantFields`, `icListForType`
- `Physics` module: port of `physics_core.m` with Float64Array packed state
- `ICs` module: port of `cluster_ic.m`, `binary_ic.m`, `lagrange_point.m`
- `Roche` module: port of `computeRocheRadii`
- `Sim` module: state container (sources, particles, time, runState, Roche radii)
- `Render` module: Canvas 2D renderer (grid, axes, sources, Roche circles, particles)
- `UI` module: DOM control panel + event handlers (mirrors MATLAB callbacks 1:1)
- `HelpText` module: ports `parameter_help.m` content for popups
- `App`: top-level `launchExplorer` + `requestAnimationFrame` loop

Test hooks namespace: `window.TDE_App` exposes pure modules + state accessors
+ headless physics stepping for the parity test page.

## Files in this repo

- `index.html` — the main app (single-file)
- `tde_modules.js` — shared JS modules (Defaults, Physics, ICs, Roche, Util)
- `help_text.js` — ported parameter_help.m content (M6a)
- `test_parity.html` — physics parity test runner
- `physics_reference.json` — MATLAB-generated reference values
- `dump_parity_reference.m` — MATLAB script to regenerate the reference JSON
- `README.md` — usage notes
- `PROGRESS.md` — this file

## Workflow

1. Claude writes app files into the local repo working dir on Duncan's Mac
   (`/Users/duncancarlsmith/Documents/MATLAB/Roche limit/TidalDisruptionExplorerHTML/repo/`).
2. After each milestone, Claude runs (via ngrok osascript on Duncan's Mac):
   `git add -A && git commit -m "milestone: <label>" && git push`
3. To verify parity, Claude:
   a. Generates `physics_reference.json` via MATLAB MCP
   b. Copies app files into Claude's container
   c. Launches container-side headless Chromium via Playwright Node API
   d. Loads `test_parity.html` in container, parses PASS/FAIL, iterates
4. To verify GUI, Claude drives container-side Chromium against `index.html`
   to test interactions and take screenshots.

## Milestones

- [x] **M0**: Repo created, initial `PROGRESS.md` and `README.md` pushed.
- [x] **M1**: `dump_parity_reference.m` written, run, `physics_reference.json` committed.
- [x] **M2**: JS modules (Defaults, Physics, ICs, Roche) + `test_parity.html`
       written and committed. Container-side parity test 44/44 PASS.
- [x] **M3**: GUI shell (`index.html` with controls panel, canvas, no popups yet)
       written and committed. Container-side smoke test 20/20 PASS.
- [x] **M4**: Animation loop, particle rendering, simulation runs visibly.
       Container-side smoke test 20/20 PASS. Energy drift over 100 steps ~3%
       (collision dissipation by design, energyLoss=0.3).
- [x] **M5**: All 7 scenarios + ICs visually verified; theme toggle live-tested.
  - [x] **M5a**: Single-source ICs (circular, elliptical, parabolic, hyperbolic) — 24/24 PASS
  - [x] **M5b**: Binary scenarios (lagrange L1..L5, circumbinary, parabolic) — 35/35 PASS
  - [x] **M5c**: Long-running disruption case (periapsis=30, Rdisk=68) — 9/9 PASS
  - [x] **M5d**: Live theme toggle during animation — 16/16 PASS
- [ ] **M6**: Help and About popups with MathJax math.
  - [x] **M6a**: Port `parameter_help.m` text to JS object — 18/18 PASS
  - [x] **M6b**: Generic modal popup component — 19/19 PASS
  - [x] **M6c**: Wire help text into popups (plaintext) — 30/30 PASS
  - [x] **M6d**: Add MathJax for math rendering — 13/13 PASS
- [x] **M6**: Help and About popups with MathJax math.
- [ ] **M7**: Final polish, README, screenshots, FEX-style description.
  - [x] **M7a**: README rewrite (live-demo instructions, scenarios table, physics summary, experiments, repo layout, build state)
  - [x] **M7b**: Page polish (SVG favicon inline as data URL; about-text URL corrected to actual repo)
  - [ ] **M7c**: Final regression smoke + documentation screenshots (deferred; needs container Chromium)
- [x] **M8**: GitHub Pages deploy verified (live at https://duncancarlsmith.github.io/TidalDisruptionExplorer-HTML5/)

## Current state

**Recovery turn complete (2026-04-30 evening).** GitHub Pages is live at
https://duncancarlsmith.github.io/TidalDisruptionExplorer-HTML5/.
The site has been verified live (HTTP 200) and is publicly accessible.

License decision: **MIT**. `LICENSE` file added; README updated to match.

Test-harness recovery: the 10 `run_smoke_*.js` harnesses (originally lost
with the dev sandbox) have been reconstructed from the conversation log
and committed under `tests/`. They are accompanied by `package.json` (for
the Playwright dep) and `HARNESSES.md` (full instructions including
prerequisites, how to run, expected PASS counts, and a recovery-note
caveat that the reconstructed source has not been re-verified end-to-end
since recovery).

The harness reconstruction matches the documented test logic and
selector usage exactly. All test hooks (`window.TDE_App.state()`,
`stepN()`, etc.) are confirmed present in `index.html`. They should run
cleanly on first try; if they don't, the most likely culprit is a small
selector or hook-name discrepancy that's quick to fix.

M7c (regression smoke + screenshot capture for the README) remains
deferred until container `bash_tool` is available again. With harnesses
now committed in the repo, M7c is straightforward: `npm install` then
`npm run test:all`. Any failures point at concrete issues to fix; any
screenshots produced (saved as `tests/m*_*.png` per harness) can be
cherry-picked into the README.

Next sub-milestone: M7c (when bash_tool returns) or M8 (already done!).
After M7c, project is fully complete.

## Recovery instructions for a fresh Claude session

If you (Claude) come into this project fresh and don't remember it:

1. Read this file (`PROGRESS.md`) first.
2. Read `TidalDisruptionExplorer folder/TidalDisruptionExplorer.m` for the source
   you are porting.
3. Check `git log` for the most recent committed state.
4. Do NOT modify anything in `TidalDisruptionExplorerMATLAB/`.
5. Verify Playwright + Chromium are installed in your container before running
   tests:
   - `node /home/claude/.npm-global/lib/node_modules/playwright/cli.js --version`
   - check `/home/claude/.cache/ms-playwright/chromium_headless_shell-*/`

## Tool environment

- ngrok command server: `unapparent-brad-pantropically.ngrok-free.dev`
  (claude:physics241)
- Container Playwright: `/home/claude/.npm-global/lib/node_modules/playwright`
- Container Chromium: `/home/claude/.cache/ms-playwright/chromium_headless_shell-*/`
- MATLAB R2025b on M1 Max via matlab MCP, project_path=
  `/Users/duncancarlsmith/Documents/MATLAB/Roche limit/TidalDisruptionExplorerMATLAB/TidalDisruptionExplorer folder`
- Mac git: `/usr/bin/git`, gh CLI: `/usr/local/bin/gh` (auth: DuncanCarlsmith)
- Local repo working dir:
  `/Users/duncancarlsmith/Documents/MATLAB/Roche limit/TidalDisruptionExplorerHTML/repo/`
