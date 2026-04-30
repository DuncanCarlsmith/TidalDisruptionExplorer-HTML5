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
- [ ] **M8**: GitHub Pages deploy verified.

## Current state

**M7a + M7b done; M7c deferred.**

M7a: README.md rewritten from a stub to a full project README with: live-demo
instructions (clone + python3 -m http.server), what the canvas shows, the
scenarios+IC table, physics summary, six suggested experiments (cribbed from
the About modal), repo layout, build-state ledger, and a link back to the
MATLAB original.

M7b: cosmetic polish to index.html and help_text.js. Added an SVG favicon
inlined as a data URL (no asset file to ship): a yellow source disk plus
three blue cluster particles. Existing viewport meta tag was already in
place from M3. Fixed the wrong duncancarlsmith.github.io URL in the
About-text aboutText[3] -- it now points at the real repo URL
(github.com/DuncanCarlsmith/TidalDisruptionExplorer-HTML5).

M7c (regression smoke + screenshots) is deferred to a future turn that has
the container bash_tool available. The pattern for that turn:

1. Sync the latest Mac files into /home/claude/tde/ (curl GET each via ngrok).
2. Re-run run_smoke_m5d.js as a regression test (theme toggle in latest build).
3. Capture four documentation screenshots in container Chromium:
   - hero: single + parabolic, t~5 (mid-flyby with mild stretching)
   - disruption: single + parabolic + periapsis=30, t~14 (tidal stream)
   - lagrange L4: binary + lagrange + L4 (equilateral triangle)
   - about with math: About modal open, MathJax-rendered Roche eqs
4. Upload the screenshots to the Mac via /upload + mv to repo.
5. Add a 'Screenshots' section to README pointing at them.
6. Commit M7c.

No changes to physics, GUI, or the test pattern. M8 (GitHub Pages enable)
can be done either before or after M7c -- it's independent and only needs
the gh CLI via osascript. See ~/Documents/MATLAB/skills/github-pages/SKILL-static-app-deploy.md
for the recipe.

Next sub-milestone: M8 (offered now) or M7c (when bash_tool returns).

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
