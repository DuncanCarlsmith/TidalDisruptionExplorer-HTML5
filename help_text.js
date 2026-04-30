// =============================================================================
// Tidal Disruption Explorer — help text (port of parameter_help.m)
// =============================================================================
// Pure data: TDE_HelpText.params{<key>} = {label, units, description}
//            TDE_HelpText.diagnostics   = same shape
//            TDE_HelpText.aboutText     = array of paragraph strings
//            TDE_HelpText.helpHeader    = string
//
// Math expressions are currently in plaintext form (e.g. "R^(1/3)").
// In M6d these will be wrapped as LaTeX so MathJax can render them.
//
// Author: Duncan Carlsmith / Claude.ai port helper, 2026.

const TDE_HelpText = (function () {
  'use strict';

  // helper to build an entry from a list of paragraph strings
  const mk = (label, units, paragraphs) => ({
    label: label,
    units: units,
    description: paragraphs.filter(p => p !== null).join('\n\n'),
  });

  const helpHeader =
    'All parameter values are in code units (lu = length unit, tu = time unit, ' +
    'mu = mass unit). The gravitational constant G = 1 by convention. Cluster ' +
    'mass and source mass are expressed in the same mass units. Velocities are ' +
    'in lu/tu.\n\n' +
    'Changes to numeric parameters always trigger a Reset. To switch parameters ' +
    'mid-evolution, pause first, edit, then press Reset to start fresh, or ' +
    'Resume to keep going (some edits like dt and energyLoss take effect on ' +
    'resume; geometry edits require Reset). Parameters not used by the current ' +
    'IC family are grayed out.';

  const params = {};

  params.dt = mk('dt', 'tu', [
    'Velocity-Verlet timestep. Each animation tick advances physics by dt sim-time.',
    'Stability requires dt smaller than the shortest dynamical timescale present, ' +
    'set by the strongest local acceleration (close passes to a source) or by ' +
    'the highest collision frequency. The default 0.07 was tuned for periapsis ' +
    '~ 100; for larger orbits or binary scenarios where motion is slower, ' +
    'dt = 0.15-0.25 runs visually faster with no loss of accuracy. For very deep ' +
    'encounters (periapsis comparable to stellarRadius) reduce to 0.02-0.03.',
  ]);

  params.energyLoss = mk('energyLoss', 'dimensionless', [
    'Fraction of normal-direction kinetic energy lost per dissipative collision.',
    'Coefficient of restitution: e = sqrt(1 - energyLoss). Range 0 (perfectly ' +
    'elastic, KE-conserving) to 1 (perfectly inelastic, normal velocity zeroed). ' +
    'Tangential velocity is never affected. Higher values give more cohesive ' +
    'cluster behavior post-impact; 0.3 is a typical icy-particle value.',
  ]);

  params.vRestThreshold = mk('vRestThreshold', 'lu/tu', [
    'Below this normal-impact speed |v_n|, collisions are switched to perfectly ' +
    'elastic regardless of energyLoss.',
    'This "Bridges step" prevents inelastic collapse: in a tightly-packed ' +
    'cluster, micro-contacts among neighbors would otherwise drain kinetic ' +
    'energy infinitely fast in finite time. Set comparable to the random thermal ' +
    'jitter (sigma_v) but small relative to genuine impact speeds. Default 0.05 ' +
    'works for most setups. Setting to 0 disables the elastic-floor and lets ' +
    'collapse happen - a useful pedagogical demo.',
  ]);

  params.timerPeriod = mk('timerPeriod', 's (wall clock)', [
    'Wall-clock interval between animation frames in seconds.',
    'Default 0.04 s gives 25 fps. Sim time advances dt per frame, so visual ' +
    'speed in sim-time-per-wall-second equals dt/timerPeriod. Decrease to push ' +
    'the frame rate up; increase to slow down playback. The actual achievable ' +
    'rate is capped by how fast each Verlet step computes.',
  ]);

  params.Nparticles = mk('Nparticles', 'integer count', [
    'Number of particles in the cluster.',
    'Particles are placed in a hex-packed disk filling inward-out around the ' +
    'cluster center. Cluster radius scales as Rc ~ (particleRadius + edgeGap/2) ' +
    '* sqrt(N). The vectorized core handles 100-500 particles in real time on a ' +
    'modern Mac; rendering cost grows linearly above N ~ 300.',
  ]);

  params.particleMass = mk('particleMass', 'mu (mass units)', [
    'Mass of each particle in the cluster (all particles have equal mass).',
    'Total cluster mass is Nparticles * particleMass. Affects internal ' +
    'self-gravity strength, the cluster bulk density that goes into the ' +
    'Roche-limit calculation, and the timescale for inelastic collapse. Note: ' +
    'large particleMass relative to sourceMass shifts the barycenter toward the ' +
    'cluster and breaks the "test mass orbiting a fixed source" approximation - ' +
    'the source itself recoils visibly.',
  ]);

  params.particleRadius = mk('particleRadius', 'lu', [
    'Hard-disk collision radius. Two particles whose centers come within 2*r_p ' +
    'collide.',
    'Also sets the constant-density-sphere interior scale: gravity transitions ' +
    'from Newtonian exterior to linear interior at r = 2*r_p. Larger radii mean ' +
    'a flatter "puck" geometry (h/r_s larger, where h = 2*r_p is the puck ' +
    'thickness), which moves the disk Roche limit closer to the textbook 3D value.',
  ]);

  params.edgeGap = mk('edgeGap', 'lu', [
    'Initial spacing between adjacent particles in the hex pack.',
    'Set to 0 for touching-disks initial state; positive for breathing room. ' +
    'Affects only the initial conditions, not the dynamics afterward. Bigger ' +
    'edgeGap means a more diffuse cluster with lower bulk density and a smaller ' +
    'Roche limit.',
  ]);

  params.sourceMass = mk('sourceMass', 'mu', [
    'Mass of the single source (used when scenario = single).',
    'Sets the orbital timescale via Kepler: T = 2*pi*sqrt(a^3 / (G*M)). Doubling ' +
    'sourceMass roughly halves the period at fixed orbital radius. The scenario ' +
    'also auto-uses max(M1, M2) as the source mass for binary Roche-limit ' +
    'calculations.',
  ]);

  params.stellarRadius = mk('stellarRadius', 'lu', [
    'Source physical radius.',
    'Defines the boundary between the exterior point-mass and interior ' +
    'linear-gravity regimes. The cluster can pass through the source without ' +
    'singularity. Also enters the Roche limit through rho_M = M / (4*pi*R^3/3). ' +
    'Reducing stellarRadius increases the source bulk density and thus pushes ' +
    'both Roche limits outward.',
  ]);

  params.periapsis = mk('periapsis', 'lu', [
    'Distance of closest approach for the cluster orbit.',
    'For circular IC this is just the orbital radius. For elliptical and ' +
    'hyperbolic ICs it is the perihelion distance. Cluster always starts at ' +
    'periapsis, with periapsis along +x axis and motion in +y direction. Setting ' +
    'periapsis < stellarRadius makes the cluster start inside the source; ' +
    'setting periapsis between the disk and 3D Roche radii puts it in the ' +
    'geometrically interesting regime.',
  ]);

  params.eccentricity = mk('eccentricity', 'dimensionless', [
    'Orbital eccentricity for the elliptical IC family. Only used when ' +
    'scenario = single, IC = elliptical.',
    'e = 0 is circular; 0 < e < 1 is bound (cluster returns to periapsis); e = 1 ' +
    'is parabolic (escape with zero excess speed); e > 1 is hyperbolic. Higher e ' +
    'means deeper periapsis penetration and a faster, more impulsive close ' +
    'encounter.',
  ]);

  params.vInfinity = mk('vInfinity', 'lu/tu', [
    'Hyperbolic excess velocity (speed at infinity) for hyperbolic IC. Only used ' +
    'when scenario = single, IC = hyperbolic.',
    'Larger vInfinity gives a faster, deeper hyperbolic flyby with less time ' +
    'spent near periapsis - so the tidal impulse is more sudden and less ' +
    'time-extended. vInfinity = 0 reduces to the parabolic case.',
  ]);

  params.impactAngle = mk('impactAngle', 'degrees', [
    'Rotation of the orbital geometry.',
    '0 means the standard +x periapsis with motion in +y. Nonzero rotates the ' +
    'entire orbit by this angle (counterclockwise) about the source. Useful for ' +
    'off-axis encounters with a binary.',
  ]);

  params.M1 = mk('M1', 'mu', [
    'Mass of the first star in the binary scenario.',
    'M1 is placed on the +x side of the binary at t=0 (modulo binStartPhase). ' +
    'For unequal-mass binaries the heavier star sits closer to the barycenter.',
  ]);

  params.M2 = mk('M2', 'mu', [
    'Mass of the second star in the binary scenario.',
    'Mass ratio mu = M2 / (M1 + M2) controls Lagrange-point geometry and ' +
    'stability. L4/L5 are linearly stable only for mu < 0.0385 (the Routh-Hurwitz ' +
    'threshold).',
  ]);

  params.binarySep = mk('binarySep', 'lu', [
    'Semi-major axis of the binary orbit (separation between stars in circular ' +
    'case).',
    'Sets the binary orbital period: T_binary = 2*pi*sqrt(sep^3 / (G*(M1+M2))). ' +
    'T scales as sep^1.5. The default 150 lu with M1=M2=1250 gives T ~ 230 tu. ' +
    'Shrink to ~80-100 to make the binary spin visibly fast; expand to ~250-300 ' +
    'for slower stately orbits where L4/L5 librations are easier to see.',
  ]);

  params.binaryEcc = mk('binaryEcc', 'dimensionless', [
    'Eccentricity of the binary orbit itself.',
    '0 = circular binary (the two stars orbit at constant separation). Nonzero ' +
    'binaries DO NOT have stable Lagrange points - the rotating frame is not an ' +
    'inertial frame at constant rate, and the L4/L5 stability analysis fails. ' +
    'This parameter is meaningful for IC = circumbinary and IC = parabolic.',
  ]);

  params.binaryStartPhase = mk('binStartPhase', 'radians', [
    'Starting angular phase of the binary along its orbit at t=0.',
    '0 means M1 starts on the +x axis. pi/2 starts it on the +y axis. Lets you ' +
    'choose where in their mutual orbit the two stars begin, useful when ' +
    'arranging a specific cluster encounter.',
  ]);

  params.circumbinaryRatio = mk('circumbRatio', 'dimensionless', [
    'Cluster orbital radius as a multiple of binarySep, for IC = circumbinary.',
    'Should be >= 2.5 or so for orbital stability around a binary - inside that, ' +
    'the circumbinary orbit is chaotic and short-lived. The default 1.25 puts ' +
    'the cluster INSIDE the stable circumbinary zone, which is pedagogically ' +
    'interesting (it gets yanked around and disrupted) but not physically ' +
    'realizable as a long-lived orbit.',
  ]);

  params.swirlFactor = mk('swirlFactor', 'dimensionless', [
    'Magnitude of initial tangential rotation imparted to particles relative to ' +
    'the cluster COM.',
    'Adds bulk angular momentum to the cluster at t=0. 0 means no internal ' +
    'rotation; default 0.04 gives mild prograde swirl. Larger values produce a ' +
    'self-supporting rotating cluster with centrifugal stabilization. Negative ' +
    'values give retrograde rotation.',
  ]);

  params.sigma_v = mk('sigma_v', 'lu/tu', [
    'Standard deviation of random Gaussian velocity noise added to each particle ' +
    'initial condition.',
    'Applied ONCE at IC construction (or Reset), never afterwards. Each particle ' +
    'gets v_x += sigma_v*randn(), v_y += sigma_v*randn() independently. 1D rms ' +
    'speed is sigma_v; 2D rms speed is sigma_v * sqrt(2). Two purposes: (1) ' +
    'symmetry breaking - with sigma_v=0 the hex-packed cluster evolves as a ' +
    'perfectly rigid body until tidally stressed; (2) initial "thermal" energy ' +
    'reservoir that dissipative collisions will drain. There is no continuous ' +
    'thermostat - once t > 0, no energy is re-injected.',
  ]);

  // ---- Diagnostic readouts -------------------------------------------------
  const diagnostics = {};

  diagnostics.t = mk('t', 'tu', [
    'Simulation time elapsed since the last Reset, in code time units.',
    'Advances by dt per timer tick. Accumulates monotonically; pause and resume ' +
    'do not reset it.',
  ]);

  diagnostics.sep = mk('sep', 'lu', [
    'Distance between the cluster center-of-mass and the source barycenter.',
    'For binary scenarios this is the cluster-COM-to-binary-barycenter distance, ' +
    'NOT the distance to the nearest star. Use the visual to gauge proximity to ' +
    'either individual star. Sep = 0 means the cluster has reached the source ' +
    'center; for periapsis-skimming orbits sep oscillates between periapsis and ' +
    'apoapsis.',
  ]);

  diagnostics.COM_v = mk('COM v', 'lu/tu', [
    'Cluster center-of-mass speed relative to the source barycenter.',
    "Goes through a maximum at periapsis (Kepler's second law). For circular " +
    'orbits it is nearly constant. For deeply-bound orbits it ranges from ' +
    'v_peri (largest) to v_apo (smallest).',
  ]);

  diagnostics.bound = mk('bound', 'percent', [
    'Fraction of cluster particles that are gravitationally bound to the cluster.',
    'A particle is bound when its kinetic energy relative to the cluster COM is ' +
    'less than its negative potential energy in the cluster monopole field: ' +
    '0.5*v_rel^2 - G*M_cluster/r_to_COM < 0. Drops as tidal stripping unbinds ' +
    'particles during a close encounter. Updated every 4th frame to save ' +
    'computation.',
  ]);

  diagnostics.E = mk('E', 'mu * (lu/tu)^2', [
    'Total mechanical energy of the system (sources + cluster particles).',
    'Includes kinetic energies and all gravitational potentials (source-source, ' +
    'source-particle, particle-particle), with the constant-density-sphere force ' +
    'law. Should be conserved by velocity-Verlet to symplectic precision (~1e-7 ' +
    'drift over an orbit) when energyLoss = 0. With nonzero energyLoss, E ' +
    'decreases monotonically as collisions dissipate. Updated every 4th frame.',
  ]);

  diagnostics.L_z = mk('L_z', 'mu * lu^2 / tu', [
    'z-component of total angular momentum about the origin.',
    'Sum of m_i * (x_i * vy_i - y_i * vx_i) over all bodies (sources and ' +
    'particles). Conserved exactly by velocity-Verlet for any energyLoss because ' +
    'collision impulses are along the contact normal (central forces), conserving ' +
    'angular momentum about any point. Drift here means a numerical bug; should ' +
    'stay flat to ~1e-12 relative.',
  ]);

  // ---- About text ----------------------------------------------------------
  const aboutText = [
    'Tidal Disruption Explorer (HTML5 port)',
    '(c) Duncan Carlsmith 2026',
    '',
    'A pedagogical 2D N-body simulation of how a self-gravitating cluster of ' +
    'particles is deformed and disrupted by tidal forces from one or two massive ' +
    'sources. HTML5/JavaScript port of the MATLAB Live Script of the same name.',
    '',
    'PHYSICS',
    '',
    'Three competing effects govern cluster evolution:',
    '  (1) Tidal stretching from the source(s).',
    '  (2) Self-gravity holding the cluster together.',
    '  (3) Hard-disk collisions with velocity-dependent restitution.',
    '',
    'When tidal forces dominate, the cluster disrupts. The threshold separation ' +
    'is the Roche limit. For a fluid satellite of density rho_s orbiting a ' +
    'primary of density rho_M and radius R_M:',
    '    d_Roche_fluid = 2.44 * R_M * (rho_M / rho_s)^(1/3).',
    'For a rigid satellite (no internal flow) the prefactor changes:',
    '    d_Roche_rigid = R_M * (2 * rho_M / rho_s)^(1/3).',
    'The cluster in this simulator is somewhere between these limits because ' +
    'hard-disk collisions provide partial cohesion but the cluster has no ' +
    'internal tensile strength.',
    '',
    'The simulation uses a constant-density-sphere force law for both ' +
    'source-particle and particle-particle gravity: Newtonian point-mass exterior ' +
    'for r >= R, linear interior for r < R, vanishing at r = 0. This avoids the ' +
    'singularity at zero separation and lets the cluster pass through the source ' +
    'without numerical pathology. The contact distance R is the source ' +
    'stellarRadius (for source-particle interactions) or 2 * particleRadius ' +
    '(for particle-particle interactions).',
    '',
    'Velocity-Verlet integration with kick-drift-kick stepping is symplectic ' +
    '(conserves energy with bounded oscillation) and second-order accurate in dt. ' +
    'Hard-disk collisions are inserted as instantaneous velocity impulses at the ' +
    'end of each step.',
    '',
    '2D vs 3D ROCHE LIMIT',
    '',
    'The cluster in this simulator is NOT a 3D sphere - it is a single layer of ' +
    'particles, geometrically a thin cylindrical puck of radius r_s and thickness ' +
    'h = 2*r_p. The in-plane self-gravity at the rim of such a puck is given by ' +
    'an integral over its volume that, for finite h/r_s, is STRONGER than the ' +
    'equivalent sphere surface gravity by a factor that ranges from ~1.6 ' +
    '(h/r_s = 0.5) to ~3.0 (h/r_s = 0.05).',
    '',
    'This is because in a puck, all of the mass sits in the same plane as the ' +
    'test point on the rim, whereas in a sphere, only ~3/4 of the mass is at ' +
    'favorable angles. The disk Roche radius is therefore SMALLER than the ' +
    'textbook 3D value:',
    '    d_disk = d_3D * (g_sphere / g_disk)^(1/3) ~ 0.76 * d_3D',
    'for typical h/r_s ~ 0.16. A flat cluster is HARDER to disrupt than its ' +
    '3D-sphere equivalent.',
    '',
    'Both Roche limits are drawn around each source: red dashed = textbook 3D, ' +
    'orange dotted = this simulator 2D-puck geometry. The cluster will visibly ' +
    'survive a periapsis between the two circles in many cases.',
    '',
    'EXPERIMENTS TO TRY',
    '',
    '1. The 2D vs 3D Roche distinction. With scenario = single, IC = parabolic ' +
    '(default periapsis = 100), the cluster is just outside the disk Roche radius ' +
    '(~68 lu). Edit periapsis to 50 (well inside Rdisk = 68) and Reset. The ' +
    'cluster shreds. Try periapsis = 90 (between the two Roche radii, ~68 and ~82): ' +
    'the cluster will distort severely but mostly survive. Try periapsis = 130 ' +
    '(outside both): only mild stretching.',
    '',
    '2. Velocity-dependent restitution and inelastic collapse. Set IC = circular ' +
    '(default periapsis = 100), then edit energyLoss = 0.5, vRestThreshold = 0. ' +
    'The cluster will gradually settle into permanent contact - inelastic collapse. ' +
    'Now set vRestThreshold = 0.05 and Reset. The elastic floor at low |v_n| ' +
    'stabilizes the cluster against runaway dissipation.',
    '',
    '3. Verlet step-size scaling. With IC = circular, energyLoss = 0, run with ' +
    'dt = 0.14, 0.07, 0.035 in turn and watch the energy drift in the bottom bar. ' +
    'Velocity-Verlet predicts O(dt^2) drift amplitude.',
    '',
    '4. Lagrange L4 stability. Switch to scenario = binary, IC = lagrange, ' +
    'Lagrange pt = L4. With M1 = M2 the cluster is at the equilateral point but ' +
    'the mass ratio mu = 0.5 puts it well above the Routh-Hurwitz stability ' +
    'threshold (mu < 0.0385) - the cluster will drift away from L4 over a few ' +
    'binary periods. Try M2 = 50 to test the stable regime.',
    '',
    '5. Comet Shoemaker-Levy 9. The 1992 perijove encounter that broke up SL9 ' +
    'had Jupiter at periapsis ~ 1.3 R_Jupiter. Edit IC = parabolic, periapsis = 20, ' +
    'stellarRadius = 15. The cluster fragments into a string of clumps, similar ' +
    'to the 21 fragments observed.',
    '',
    '6. Saturn ring physics. Set IC = circular, periapsis = 300 (well outside ' +
    'both Roche radii), energyLoss = 0.3, vRestThreshold = 0.05. Add some ' +
    'swirlFactor = 0.5 for shear. Watch the cluster develop a flattened ring-like ' +
    'shape with internal spiral density waves.',
    '',
    'USAGE',
    '',
    'Edits to numeric parameters trigger a Reset. Parameters not used by the ' +
    'current IC family are grayed out. The "Reset defaults" button below Reset ' +
    'restores canonical per-IC defaults for the current scenario+IC combination ' +
    'and is enabled only when the simulation is paused.',
  ];

  return {
    helpHeader: helpHeader,
    params: params,
    diagnostics: diagnostics,
    aboutText: aboutText,
    version: '0.1.0',
  };
})();

// Export for both browser and node usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TDE_HelpText;
}
if (typeof window !== 'undefined') {
  window.TDE_HelpText = TDE_HelpText;
}
