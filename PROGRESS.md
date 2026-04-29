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

Test hooks namespace: `window.TDE` exposes pure modules + state accessors
+ headless physics stepping for the parity test page.

## Files in this repo (planned)

- `index.html` — the main app (single-file)
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
       written and committed. Container-side parity test PASS.
- [x] **M3**: GUI shell (`index.html` with controls panel, canvas, no popups yet)
       written and committed. Container-side smoke test PASS.
- [ ] **M4**: Animation loop, particle rendering, simulation runs visibly.
- [ ] **M5**: All 7 scenarios + ICs working. Theme toggle wired up.
- [ ] **M6**: Help and About popups with MathJax math.
- [ ] **M7**: Final polish, README, screenshots, FEX-style description.
- [ ] **M8**: GitHub Pages deploy verified.

## Current state

**M3 done.** Static GUI renders correctly in container Chromium:
- 22 numeric fields populated from scenarioDefaults, displayed values match cfg
- Scenario dropdown (single/binary), IC family dropdown, Lagrange dropdown all wired
- Field enable/disable per relevantFields() rule (greyed-out fields match MATLAB)
- Roche circles render per-star: equal-mass binary shows identical circles, unequal
  binary (M1=1000, M2=250) shows ratio 1.587 = 4^(1/3) exactly
- Theme toggle works (dark <-> light)
- L4 cluster placement verified at (0, 43.30) for equal-mass binary
- Smoke test: 20/20 PASS in headless Chromium

No animation yet. Buttons Start/Pause/Help/About are stubs. Next:

M4: animation loop (requestAnimationFrame), Start/Pause/Reset semantics,
    diagnostic strip live updates.

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
