# Tidal Disruption Explorer (HTML5 port)

A browser-based 2D N-body simulation of how a self-gravitating cluster of
particles is deformed and disrupted by tidal forces from one or two massive
sources. HTML5/JavaScript port of the MATLAB Live Script of the same name.

The simulation demonstrates the **Roche limit** -- the orbital separation
inside which tidal forces overcome a body's self-gravity and shred it into a
debris stream. Both the textbook 3D Roche radius (red dashed) and a
geometry-corrected 2D-disk Roche radius (orange dotted) are drawn around each
source, so you can watch the cluster survive a passage between the two and
disrupt at smaller periapsis.

## Live demo

GitHub Pages will be enabled in milestone M8. Until then, you can run the app
locally:

```bash
git clone https://github.com/DuncanCarlsmith/TidalDisruptionExplorer-HTML5.git
cd TidalDisruptionExplorer-HTML5
python3 -m http.server 8765
# Open http://localhost:8765/index.html in any modern browser.
```

A simple HTTP server is required because the app loads `tde_modules.js` and
`help_text.js` via `<script src=...>` -- opening `index.html` directly via
`file://` will fail with CORS errors in most browsers.

## What it shows

The canvas displays:

- **Source(s)**: a single point-mass (yellow disk) for the *single* scenario,
  or a Kepler-orbiting binary (two yellow disks) for the *binary* scenario.
- **Particles**: 19 hex-packed mutually-attracting bodies forming a
  self-gravitating cluster (light blue disks).
- **Roche radii**: red dashed circle = textbook 3D Roche limit;
  orange dotted circle = 2D thin-disk Roche limit corrected for the in-plane
  geometry of this 19-particle cluster.
- **Diagnostics bar** at the bottom: simulation time `t`, cluster-source
  separation `sep`, cluster COM speed, fraction of particles still bound to
  the cluster, total mechanical energy `E`, total angular momentum `L_z`.

## Scenarios and initial conditions

| Scenario | IC family | What it demonstrates                                                |
|----------|-----------|---------------------------------------------------------------------|
| single   | circular  | Cluster on a circular orbit at fixed periapsis                      |
| single   | elliptical| Periodic close passes; varies eccentricity 0..1                     |
| single   | parabolic | One-shot escape encounter, the canonical TDE flyby                  |
| single   | hyperbolic| Faster-than-escape flyby, more impulsive tidal kick                 |
| binary   | lagrange  | Cluster placed at L1, L2, L3, L4, or L5 of an equal-mass binary     |
| binary   | circumbinary | Cluster orbits the binary at `circumbRatio * binarySep`          |
| binary   | parabolic | Cluster on parabolic flyby past a Kepler-orbiting binary            |

All 11 scenario+IC combinations are validated in `run_smoke_m5*.js` against
MATLAB reference values; see `PROGRESS.md` for the parity-test record.

## Physics

- **Velocity-Verlet integration** with kick-drift-kick stepping (symplectic,
  second-order, bounded energy oscillation).
- **Constant-density-sphere force law** for both source-particle and
  particle-particle gravity: Newtonian point-mass exterior for `r >= R`,
  linear interior for `r < R`, smooth and finite at `r = 0`. Lets the cluster
  pass through the source without singularity.
- **Hard-disk collisions** with velocity-dependent restitution
  *e = sqrt(1 - energyLoss)*. A `vRestThreshold` "Bridges step" prevents
  inelastic collapse: collisions slower than this threshold are switched to
  perfectly elastic regardless of `energyLoss`.
- **Initial conditions**: hex-packed cluster with optional thermal noise
  (`sigma_v`) and bulk swirl (`swirlFactor`).

For the full math (Kepler period, Routh-Hurwitz threshold for L4/L5 stability,
3D vs 2D Roche scaling), open the **About** modal in the app -- it's typeset
with MathJax 3.

## Suggested experiments

The About modal lists six pedagogical experiments. Highlights:

1. **The 2D vs 3D Roche distinction**. With single + parabolic + default
   periapsis = 100, the cluster is just outside the disk-Roche radius (~68
   lu) and survives. Edit periapsis = 50 (well inside) and reset: the cluster
   shreds. Edit periapsis = 90 (between the two Roche radii ~68 and ~82) and
   the cluster will distort severely but mostly survive.
2. **Inelastic collapse**. Set IC = circular, `energyLoss = 0.5`,
   `vRestThreshold = 0`. The cluster gradually settles into permanent
   contact. Re-set `vRestThreshold = 0.05` and the elastic floor stabilizes
   it.
3. **Velocity-Verlet step-size scaling**. With `energyLoss = 0`, run with
   `dt = 0.14, 0.07, 0.035` and watch the energy drift. Symplectic integrators
   show *O(dt^2)* drift amplitude.
4. **L4 stability**. Switch to binary + lagrange + L4. With M1 = M2 the mass
   ratio mu = 0.5 puts the cluster well above the Routh-Hurwitz threshold
   (mu < 0.0385) -- it drifts away over a few binary periods. Try M2 = 50
   to test the stable regime.
5. **Comet Shoemaker-Levy 9**. Edit IC = parabolic, periapsis = 20,
   stellarRadius = 15 to recreate the 1992 perijove encounter that broke up
   SL9 into a string of fragments.
6. **Saturn ring physics**. IC = circular, periapsis = 300 (well outside
   both Roche radii), `energyLoss = 0.3`, `vRestThreshold = 0.05`,
   `swirlFactor = 0.5`. The cluster develops a flattened ring with internal
   spiral density waves.

## Repository layout

| File                       | Purpose                                                |
|----------------------------|--------------------------------------------------------|
| `index.html`               | Main app (HTML + inline CSS + inline JS for the GUI)   |
| `tde_modules.js`           | Shared physics modules: Defaults, Physics, ICs, Roche  |
| `help_text.js`             | Help and About text content (port of `parameter_help.m`) |
| `test_parity.html`         | Standalone parity test runner (browse to it directly)  |
| `physics_reference.json`   | MATLAB-generated reference values for parity tests     |
| `dump_parity_reference.m`  | MATLAB script to regenerate the reference JSON         |
| `PROGRESS.md`              | Build journal: every milestone, every test count, recovery instructions |
| `PROGRESS_*_pre_*.md`      | Timestamped pre-edit backups of `PROGRESS.md` (one per milestone) |

## Build state

This is a multi-milestone port. As of milestone M6d:

- M0..M2: Repository, MATLAB reference data, JS physics modules (parity 44/44 PASS)
- M3..M4: GUI shell, animation loop (smoke 20/20 PASS each)
- M5a..M5d: All 11 scenarios + theme toggle verified (84/84 PASS)
- M6a..M6d: Help and About modals with MathJax math (80/80 PASS)
- M7a (this commit): README expanded
- M7b: Page polish (favicon, viewport meta) -- pending
- M7c: Final regression smoke + documentation screenshots -- pending
- M8: Enable GitHub Pages -- pending

Total verified: **244 sub-checks PASS, 0 FAIL** across 8 sub-milestones.

See `PROGRESS.md` for the full ledger.

## Original MATLAB Live Script

The MATLAB original lives in
`Documents/MATLAB/Roche limit/TidalDisruptionExplorerMATLAB/` on the author's
machine and is also available on
[MATLAB File Exchange](https://www.mathworks.com/matlabcentral/fileexchange/?q=carlsmith).
The HTML5 port preserves the exact GUI layout, control names, and physics --
all 11 scenario+IC combinations match MATLAB reference values to ~1e-9 (pure
functions) and ~1e-6 (100-step trajectories).

## License

(c) Duncan Carlsmith 2026. License TBD.
