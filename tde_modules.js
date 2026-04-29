// =============================================================================
// Tidal Disruption Explorer — JavaScript port
// =============================================================================
// Ports:
//   physics_core.m            -> TDE.Physics
//   cluster_ic.m              -> TDE.ICs.cluster_ic
//   binary_ic.m               -> TDE.ICs.binary_ic
//   lagrange_point.m          -> TDE.ICs.lagrange_point
//   computeRocheRadii (local) -> TDE.Roche.computeRocheRadii
//   scenarioDefaults (local)  -> TDE.Defaults.scenarioDefaults
//   relevantFields   (local)  -> TDE.Defaults.relevantFields
//   icListForType    (local)  -> TDE.Defaults.icListForType
//
// Numeric conventions:
//   - Sources are plain objects {x, y, vx, vy, ax, ay, m} (mirrors MATLAB struct).
//   - Particles are stored as a Float64Array of length N*6, packed
//     [x0,y0,vx0,vy0,ax0,ay0, x1,y1,vx1,vy1,ax1,ay1, ...].
//     This matches MATLAB's particles(:, 1:6) where columns are
//     [x, y, vx, vy, ax, ay].
//   - MATLAB columns 1..6 are JS offsets 0..5 within each 6-tuple.
//
// Author: Duncan Carlsmith (port assisted by Claude.ai), 2026.

const TDE = (function () {
  'use strict';

  // ===========================================================================
  // Defaults: scenarioDefaults, relevantFields, icListForType
  // ===========================================================================
  const Defaults = {};

  Defaults.scenarioDefaults = function (typeStr, icStr) {
    const cfg = {
      scenarioType:      typeStr,
      clusterIC:         icStr,
      sourceMass:        1250,
      M1:                1250,
      M2:                1250,
      stellarRadius:     15,
      Nparticles:        19,
      particleMass:      1.0,
      particleRadius:    3.2,
      edgeGap:           1.0,
      lagrangePoint:     "L4",
      impactAngle:       0,
      binarySep:         50,
      binaryEcc:         0.0,
      binaryStartPhase:  0,
      circumbinaryRatio: 1.25,
      dt:                0.07,
      energyLoss:        0.30,
      vRestThreshold:    0.05,
      swirlFactor:       0.04,
      sigma_v:           0.003,
      themeMode:         "dark",
      timerPeriod:       0.04,
    };

    if (typeStr === "single") {
      switch (icStr) {
        case "circular":
          cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5; break;
        case "elliptical":
          cfg.periapsis = 100; cfg.eccentricity = 0.5; cfg.vInfinity = 0.5; break;
        case "parabolic":
          cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5; break;
        case "hyperbolic":
          cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5; break;
        default:
          cfg.periapsis = 100; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
      }
    } else { // binary
      cfg.M1 = 150;
      cfg.M2 = 150;
      switch (icStr) {
        case "lagrange":
          cfg.periapsis = 60;  cfg.eccentricity = 0.0; cfg.vInfinity = 0.5; break;
        case "circumbinary":
          cfg.periapsis = 60;  cfg.eccentricity = 0.0; cfg.vInfinity = 0.5; break;
        case "parabolic":
          cfg.periapsis = 200; cfg.eccentricity = 0.0; cfg.vInfinity = 0.5; break;
        default:
          cfg.periapsis = 60;  cfg.eccentricity = 0.0; cfg.vInfinity = 0.5;
      }
    }
    return cfg;
  };

  Defaults.relevantFields = function (typeStr, icStr) {
    if (typeStr === "single") {
      switch (icStr) {
        case "circular":   return ['sourceMass', 'stellarRadius', 'periapsis'];
        case "elliptical": return ['sourceMass', 'stellarRadius', 'periapsis', 'eccentricity'];
        case "parabolic":  return ['sourceMass', 'stellarRadius', 'periapsis'];
        case "hyperbolic": return ['sourceMass', 'stellarRadius', 'periapsis', 'vInfinity'];
        default:           return ['sourceMass', 'stellarRadius', 'periapsis'];
      }
    } else {
      const binCommon = ['M1', 'M2', 'stellarRadius', 'binarySep', 'binaryEcc', 'binaryStartPhase'];
      switch (icStr) {
        case "lagrange":     return binCommon.slice();
        case "circumbinary": return binCommon.concat(['circumbinaryRatio']);
        case "parabolic":    return binCommon.concat(['periapsis', 'impactAngle']);
        default:             return binCommon.slice();
      }
    }
  };

  Defaults.icListForType = function (typeName) {
    switch (typeName) {
      case "single": return ['circular', 'elliptical', 'parabolic', 'hyperbolic'];
      case "binary": return ['lagrange', 'circumbinary', 'parabolic'];
      default:       return ['circular'];
    }
  };

  // ===========================================================================
  // Physics: port of physics_core.m
  // ===========================================================================
  const Physics = {};

  // Particle layout in Float64Array: 6 doubles per particle.
  // Offsets within each particle's slice:
  const P_X  = 0, P_Y  = 1, P_VX = 2, P_VY = 3, P_AX = 4, P_AY = 5;
  const P_STRIDE = 6;
  Physics.P_STRIDE = P_STRIDE;
  Physics.P_X = P_X; Physics.P_Y = P_Y; Physics.P_VX = P_VX;
  Physics.P_VY = P_VY; Physics.P_AX = P_AX; Physics.P_AY = P_AY;

  // Helper: create a freshly-zeroed Float64Array for nP particles.
  Physics.allocParticles = function (nP) {
    return new Float64Array(nP * P_STRIDE);
  };

  // ---- hexPackedOffsets ----------------------------------------------------
  Physics.hexPackedOffsets = function (N, particleRadius, edgeGap) {
    const spacing = 2 * particleRadius + edgeGap;
    const dy = spacing * Math.sqrt(3) / 2;

    let offsets = [[0, 0]];
    let ring = 1;
    while (offsets.length < N && ring <= 80) {
      const rows = ring;
      const cols = rows + 1;
      for (let j = -rows; j <= rows; j++) {
        const yy = j * dy;
        const shift = ((j % 2) + 2) % 2 === 0 ? 0 : spacing / 2;
        // MATLAB's mod(j, 2) returns 0 for even and 1 for odd including negatives.
        // Implementing as ((j%2)+2)%2 to match.
        for (let i = -cols; i <= cols; i++) {
          const xx = i * spacing + shift;
          const rr = Math.hypot(xx, yy);
          if (rr > 0 && rr <= ring * spacing * 1.06) {
            offsets.push([xx, yy]);
          }
        }
      }
      // Dedupe using the same key trick MATLAB uses: round to 1e-6.
      const seen = new Set();
      const keep = [];
      for (const o of offsets) {
        const kx = Math.round(o[0] * 1e6) / 1e6;
        const ky = Math.round(o[1] * 1e6) / 1e6;
        const k = kx + ',' + ky;
        if (!seen.has(k)) {
          seen.add(k);
          keep.push(o);
        }
      }
      offsets = keep;
      ring++;
    }

    // Sort by radius (stable, mirroring MATLAB sort behavior).
    const indexed = offsets.map((o, idx) => ({
      o: o, r: Math.hypot(o[0], o[1]), idx: idx
    }));
    indexed.sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      return a.idx - b.idx;       // stable
    });
    let result = indexed.map(item => item.o);

    if (result.length > N) {
      result = result.slice(0, N);
    }
    return result;  // array of [x, y]
  };

  // ---- subtractTotalCOMVelocity -------------------------------------------
  // Operates IN-PLACE on sources (array of objects) and particles (Float64Array).
  Physics.subtractTotalCOMVelocity = function (sources, particles, particleMass) {
    const nP = particles.length / P_STRIDE;
    let Ms = 0, vxsum = 0, vysum = 0;
    for (const s of sources) {
      Ms    += s.m;
      vxsum += s.m * s.vx;
      vysum += s.m * s.vy;
    }
    if (nP > 0) {
      let psumvx = 0, psumvy = 0;
      for (let k = 0; k < nP; k++) {
        psumvx += particles[k * P_STRIDE + P_VX];
        psumvy += particles[k * P_STRIDE + P_VY];
      }
      vxsum += particleMass * psumvx;
      vysum += particleMass * psumvy;
    }
    const Mtot = Ms + (nP > 0 ? particleMass * nP : 0);
    if (Mtot <= 0) return;
    const vx0 = vxsum / Mtot;
    const vy0 = vysum / Mtot;
    for (const s of sources) {
      s.vx -= vx0;
      s.vy -= vy0;
    }
    for (let k = 0; k < nP; k++) {
      particles[k * P_STRIDE + P_VX] -= vx0;
      particles[k * P_STRIDE + P_VY] -= vy0;
    }
  };

  // ---- computeAccelerations -----------------------------------------------
  // In-place. Same physics as MATLAB physics_core_v6.
  Physics.computeAccelerations = function (sources, particles,
                                           particleMass, stellarRadius,
                                           particleRadius) {
    const G = 1;
    const Rs = Math.max(stellarRadius, 1e-6);
    const Rp = Math.max(2 * particleRadius, 1e-6);
    const Rs3 = Rs * Rs * Rs;
    const Rp3 = Rp * Rp * Rp;
    const nS = sources.length;
    const nP = particles.length / P_STRIDE;

    // Zero all accelerations
    for (let k = 0; k < nS; k++) {
      sources[k].ax = 0;
      sources[k].ay = 0;
    }
    for (let k = 0; k < nP; k++) {
      particles[k * P_STRIDE + P_AX] = 0;
      particles[k * P_STRIDE + P_AY] = 0;
    }

    // Source-source (uniform-density sphere, R = stellarRadius)
    for (let i = 0; i < nS; i++) {
      for (let j = i + 1; j < nS; j++) {
        const dx = sources[j].x - sources[i].x;
        const dy = sources[j].y - sources[i].y;
        const r2 = Math.max(dx * dx + dy * dy, 1e-9);
        const r  = Math.sqrt(r2);
        let f;
        if (r >= Rs) {
          f = -G * sources[i].m / Math.max(r2 * r, 1e-9);
        } else {
          f = -G * sources[i].m / Rs3;
        }
        const ajx = f * dx, ajy = f * dy;
        const aix = -ajx * (sources[j].m / sources[i].m);
        const aiy = -ajy * (sources[j].m / sources[i].m);
        sources[j].ax += ajx;
        sources[j].ay += ajy;
        sources[i].ax += aix;
        sources[i].ay += aiy;
      }
    }

    // Source-particle (uniform-density sphere, R = stellarRadius)
    if (nP > 0) {
      for (let k = 0; k < nS; k++) {
        const sx = sources[k].x, sy = sources[k].y, sm = sources[k].m;
        let sumApx = 0, sumApy = 0;
        for (let p = 0; p < nP; p++) {
          const off = p * P_STRIDE;
          const dx = particles[off + P_X] - sx;
          const dy = particles[off + P_Y] - sy;
          const r2 = Math.max(dx * dx + dy * dy, 1e-9);
          const r  = Math.sqrt(r2);
          let factor;
          if (r >= Rs) {
            factor = -G * sm / Math.max(r2 * r, 1e-9);
          } else {
            factor = -G * sm / Rs3;
          }
          const apx = factor * dx;
          const apy = factor * dy;
          particles[off + P_AX] += apx;
          particles[off + P_AY] += apy;
          sumApx += apx;
          sumApy += apy;
        }
        if (sm > 0) {
          sources[k].ax -= particleMass * sumApx / sm;
          sources[k].ay -= particleMass * sumApy / sm;
        }
      }
    }

    // Particle-particle (uniform-density sphere, R = 2*particleRadius)
    if (nP > 1) {
      // For each particle i, accumulate sum_j F(i,j) * (xj - xi).
      // O(N^2) with double loop over upper triangle, applying both i and j.
      for (let i = 0; i < nP; i++) {
        const ix = particles[i * P_STRIDE + P_X];
        const iy = particles[i * P_STRIDE + P_Y];
        for (let j = i + 1; j < nP; j++) {
          const dx = particles[j * P_STRIDE + P_X] - ix;
          const dy = particles[j * P_STRIDE + P_Y] - iy;
          const r2 = dx * dx + dy * dy;
          if (r2 < 1e-30) continue;
          const r = Math.sqrt(r2);
          let F;
          if (r >= Rp) {
            F = G * particleMass / (r2 * r);
          } else {
            F = G * particleMass / Rp3;
          }
          // a_i = +F*(rj - ri); a_j = -F*(rj - ri) by Newton's third
          const fx = F * dx, fy = F * dy;
          particles[i * P_STRIDE + P_AX] += fx;
          particles[i * P_STRIDE + P_AY] += fy;
          particles[j * P_STRIDE + P_AX] -= fx;
          particles[j * P_STRIDE + P_AY] -= fy;
        }
      }
    }
  };

  // ---- verletStep ---------------------------------------------------------
  // Drift-kick-drift velocity-Verlet. In-place.
  Physics.verletStep = function (sources, particles,
                                  particleMass, stellarRadius,
                                  energyLoss, particleRadius, dt,
                                  vRestThreshold) {
    if (typeof vRestThreshold === 'undefined') vRestThreshold = 0;

    const nS = sources.length;
    const nP = particles.length / P_STRIDE;

    // First half-kick + drift
    for (let k = 0; k < nS; k++) {
      const s = sources[k];
      s.vx += 0.5 * s.ax * dt;
      s.vy += 0.5 * s.ay * dt;
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
    }
    for (let k = 0; k < nP; k++) {
      const off = k * P_STRIDE;
      particles[off + P_VX] += 0.5 * particles[off + P_AX] * dt;
      particles[off + P_VY] += 0.5 * particles[off + P_AY] * dt;
      particles[off + P_X]  += particles[off + P_VX] * dt;
      particles[off + P_Y]  += particles[off + P_VY] * dt;
    }

    // Recompute accelerations
    Physics.computeAccelerations(sources, particles,
                                  particleMass, stellarRadius,
                                  particleRadius);

    // Second half-kick
    for (let k = 0; k < nS; k++) {
      const s = sources[k];
      s.vx += 0.5 * s.ax * dt;
      s.vy += 0.5 * s.ay * dt;
    }
    for (let k = 0; k < nP; k++) {
      const off = k * P_STRIDE;
      particles[off + P_VX] += 0.5 * particles[off + P_AX] * dt;
      particles[off + P_VY] += 0.5 * particles[off + P_AY] * dt;
    }

    // Collision resolution
    if (nP > 1 && particleRadius > 0) {
      Physics.resolveCollisions(particles, particleRadius, energyLoss, vRestThreshold);
    }
  };

  // ---- resolveCollisions --------------------------------------------------
  Physics.resolveCollisions = function (particles, particleRadius,
                                         energyLoss, vRestThreshold) {
    if (typeof vRestThreshold === 'undefined') vRestThreshold = 0;
    const nP = particles.length / P_STRIDE;
    if (nP < 2) return;

    const minD2 = (2 * particleRadius) * (2 * particleRadius);
    const e_nominal = Math.sqrt(Math.max(0, 1 - energyLoss));

    // Build list of overlapping (i,j) pairs in upper triangle (i<j),
    // serial application matches MATLAB's order dependence.
    const pairs = [];
    for (let i = 0; i < nP; i++) {
      const ix = particles[i * P_STRIDE + P_X];
      const iy = particles[i * P_STRIDE + P_Y];
      for (let j = i + 1; j < nP; j++) {
        const dx = particles[j * P_STRIDE + P_X] - ix;
        const dy = particles[j * P_STRIDE + P_Y] - iy;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD2) pairs.push([i, j]);
      }
    }

    for (const pair of pairs) {
      const i = pair[0], j = pair[1];
      let dx = particles[j * P_STRIDE + P_X] - particles[i * P_STRIDE + P_X];
      let dy = particles[j * P_STRIDE + P_Y] - particles[i * P_STRIDE + P_Y];
      let d2 = dx * dx + dy * dy;
      if (d2 < 1e-12) {
        dx = 1e-3; dy = 0; d2 = dx * dx;
      }
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const rvx = particles[j * P_STRIDE + P_VX] - particles[i * P_STRIDE + P_VX];
      const rvy = particles[j * P_STRIDE + P_VY] - particles[i * P_STRIDE + P_VY];
      const vn = rvx * nx + rvy * ny;
      if (vn >= 0)         continue;
      if (Math.abs(vn) < 1e-9) continue;

      const e = (Math.abs(vn) <= vRestThreshold) ? 1 : e_nominal;
      const J = -(1 + e) * vn / 2;
      particles[i * P_STRIDE + P_VX] -= J * nx;
      particles[i * P_STRIDE + P_VY] -= J * ny;
      particles[j * P_STRIDE + P_VX] += J * nx;
      particles[j * P_STRIDE + P_VY] += J * ny;
    }
  };

  // ---- Diagnostics --------------------------------------------------------
  Physics.barycenterOfSources = function (sources) {
    let Ms = 0;
    for (const s of sources) Ms += s.m;
    if (Ms <= 0) return { x: 0, y: 0, vx: 0, vy: 0, m: 0 };
    let x = 0, y = 0, vx = 0, vy = 0;
    for (const s of sources) {
      x  += s.m * s.x;
      y  += s.m * s.y;
      vx += s.m * s.vx;
      vy += s.m * s.vy;
    }
    return { m: Ms, x: x / Ms, y: y / Ms, vx: vx / Ms, vy: vy / Ms };
  };

  Physics.barycenterOfAll = function (sources, particles, particleMass) {
    const nP = particles.length / P_STRIDE;
    let Ms = 0;
    for (const s of sources) Ms += s.m;
    const Mp = particleMass * nP;
    const M = Ms + Mp;
    if (M <= 0) return { x: 0, y: 0, vx: 0, vy: 0, m: 0 };
    let xs = 0, ys = 0, vxs = 0, vys = 0;
    for (const s of sources) {
      xs  += s.m * s.x;
      ys  += s.m * s.y;
      vxs += s.m * s.vx;
      vys += s.m * s.vy;
    }
    let xp = 0, yp = 0, vxp = 0, vyp = 0;
    for (let k = 0; k < nP; k++) {
      const off = k * P_STRIDE;
      xp  += particles[off + P_X];
      yp  += particles[off + P_Y];
      vxp += particles[off + P_VX];
      vyp += particles[off + P_VY];
    }
    return {
      m: M,
      x:  (xs  + particleMass * xp ) / M,
      y:  (ys  + particleMass * yp ) / M,
      vx: (vxs + particleMass * vxp) / M,
      vy: (vys + particleMass * vyp) / M,
    };
  };

  Physics.totalEnergy = function (sources, particles, particleMass, stellarRadius) {
    const G = 1;
    const Rs = Math.max(stellarRadius, 1e-6);
    const Rs2 = Rs * Rs, Rs3 = Rs * Rs * Rs;
    const nS = sources.length;
    const nP = particles.length / P_STRIDE;
    let E = 0;

    for (const s of sources) {
      E += 0.5 * s.m * (s.vx * s.vx + s.vy * s.vy);
    }
    for (let i = 0; i < nS; i++) {
      for (let j = i + 1; j < nS; j++) {
        const dx = sources[j].x - sources[i].x;
        const dy = sources[j].y - sources[i].y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r >= Rs) {
          E -= G * sources[i].m * sources[j].m / Math.max(r, 1e-9);
        } else {
          E -= G * sources[i].m * sources[j].m * (3 * Rs2 - r * r) / (2 * Rs3);
        }
      }
    }
    if (nP > 0) {
      for (let k = 0; k < nP; k++) {
        const off = k * P_STRIDE;
        const vx = particles[off + P_VX], vy = particles[off + P_VY];
        E += 0.5 * particleMass * (vx * vx + vy * vy);
      }
      for (let k = 0; k < nS; k++) {
        const sx = sources[k].x, sy = sources[k].y, sm = sources[k].m;
        let phi_total = 0;
        for (let p = 0; p < nP; p++) {
          const off = p * P_STRIDE;
          const dx = particles[off + P_X] - sx;
          const dy = particles[off + P_Y] - sy;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r >= Rs) {
            phi_total += -G * sm / Math.max(r, 1e-9);
          } else {
            phi_total += -G * sm * (3 * Rs2 - r * r) / (2 * Rs3);
          }
        }
        E += particleMass * phi_total;
      }
      // particle-particle potential, point-mass form, upper triangle only
      if (nP > 1) {
        let invSum = 0;
        for (let i = 0; i < nP; i++) {
          const ix = particles[i * P_STRIDE + P_X];
          const iy = particles[i * P_STRIDE + P_Y];
          for (let j = i + 1; j < nP; j++) {
            const dx = particles[j * P_STRIDE + P_X] - ix;
            const dy = particles[j * P_STRIDE + P_Y] - iy;
            const r = Math.sqrt(dx * dx + dy * dy);
            invSum += 1 / Math.max(r, 1e-9);
          }
        }
        E -= G * particleMass * particleMass * invSum;
      }
    }
    return E;
  };

  Physics.angularMomentum = function (sources, particles, particleMass) {
    let L = 0;
    for (const s of sources) {
      L += s.m * (s.x * s.vy - s.y * s.vx);
    }
    const nP = particles.length / P_STRIDE;
    for (let k = 0; k < nP; k++) {
      const off = k * P_STRIDE;
      L += particleMass * (particles[off + P_X] * particles[off + P_VY]
                          - particles[off + P_Y] * particles[off + P_VX]);
    }
    return L;
  };

  Physics.boundFraction = function (particles, clusterCOM, particleMass) {
    const G = 1;
    const nP = particles.length / P_STRIDE;
    if (nP === 0) return 0;
    const Mc = particleMass * nP;
    const cx = clusterCOM[0], cy = clusterCOM[1], cvx = clusterCOM[2], cvy = clusterCOM[3];
    let bound = 0;
    for (let k = 0; k < nP; k++) {
      const off = k * P_STRIDE;
      const rx = particles[off + P_X] - cx;
      const ry = particles[off + P_Y] - cy;
      const vx = particles[off + P_VX] - cvx;
      const vy = particles[off + P_VY] - cvy;
      const r = Math.sqrt(rx * rx + ry * ry);
      const ekin = 0.5 * (vx * vx + vy * vy);
      const epot = -G * Mc / Math.max(r, 1e-9);
      if (ekin + epot < 0) bound++;
    }
    return bound / nP;
  };

  Physics.externalPotentialAt = function (x, y, sources, stellarRadius) {
    const G = 1;
    const R = Math.max(stellarRadius, 1e-6);
    const R2 = R * R, R3 = R * R * R;
    let phi = 0;
    for (const s of sources) {
      const dx = x - s.x, dy = y - s.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= R) {
        phi += -G * s.m / Math.max(r, 1e-9);
      } else {
        phi += -G * s.m * (3 * R2 - r * r) / (2 * R3);
      }
    }
    return phi;
  };

  // ===========================================================================
  // ICs: cluster_ic, binary_ic, lagrange_point
  // ===========================================================================
  const ICs = {};

  ICs.binary_ic = function (M1, M2, a, e, phase) {
    const G = 1;
    if (e < 0 || e >= 1) {
      throw new Error('binary_ic: eccentricity must be in [0, 1).');
    }
    const Mt = M1 + M2;
    const mu = G * Mt;
    const semilatus = a * (1 - e * e);
    const r_rel_mag = semilatus / (1 + e * Math.cos(phase));
    const rx_rel = r_rel_mag * Math.cos(phase);
    const ry_rel = r_rel_mag * Math.sin(phase);
    const pref = Math.sqrt(mu / semilatus);
    const vx_rel = pref * (-Math.sin(phase));
    const vy_rel = pref * (e + Math.cos(phase));
    const f1 = M2 / Mt;
    const f2 = -M1 / Mt;
    return [
      { x: f1 * rx_rel, y: f1 * ry_rel, vx: f1 * vx_rel, vy: f1 * vy_rel,
        ax: 0, ay: 0, m: M1 },
      { x: f2 * rx_rel, y: f2 * ry_rel, vx: f2 * vx_rel, vy: f2 * vy_rel,
        ax: 0, ay: 0, m: M2 },
    ];
  };

  // 1D root-finder (Brent's method) — replacement for MATLAB fzero on a bracket.
  function brentRoot(f, a, b, tol) {
    if (typeof tol === 'undefined') tol = 1e-12;
    let fa = f(a), fb = f(b);
    if (fa * fb > 0) {
      throw new Error('brentRoot: function does not change sign on [' + a + ', ' + b + ']');
    }
    if (Math.abs(fa) < Math.abs(fb)) {
      let t = a; a = b; b = t;
      t = fa; fa = fb; fb = t;
    }
    let c = a, fc = fa, d = b - a, e = d;
    let mflag = true;
    for (let iter = 0; iter < 200; iter++) {
      if (fb === 0 || Math.abs(b - a) < tol) return b;
      let s;
      if (fa !== fc && fb !== fc) {
        // inverse quadratic interpolation
        s = a * fb * fc / ((fa - fb) * (fa - fc))
          + b * fa * fc / ((fb - fa) * (fb - fc))
          + c * fa * fb / ((fc - fa) * (fc - fb));
      } else {
        // secant
        s = b - fb * (b - a) / (fb - fa);
      }
      const cond1 = !(s > Math.min((3 * a + b) / 4, b) && s < Math.max((3 * a + b) / 4, b));
      const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
      const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
      const cond4 = mflag && Math.abs(b - c) < tol;
      const cond5 = !mflag && Math.abs(c - d) < tol;
      if (cond1 || cond2 || cond3 || cond4 || cond5) {
        s = (a + b) / 2;
        mflag = true;
      } else {
        mflag = false;
      }
      const fs = f(s);
      d = c; c = b; fc = fb;
      if (fa * fs < 0) {
        b = s; fb = fs;
      } else {
        a = s; fa = fs;
      }
      if (Math.abs(fa) < Math.abs(fb)) {
        let t = a; a = b; b = t;
        t = fa; fa = fb; fb = t;
      }
    }
    return b;
  }

  ICs.lagrange_point = function (M1, M2, a, point) {
    const Mt = M1 + M2;
    const x1 = +a * M2 / Mt;     // M1 position
    const x2 = -a * M1 / Mt;     // M2 position
    const G  = 1;
    const omega2 = G * Mt / (a * a * a);
    const f = function (x) {
      // Sign convention from MATLAB: omega2*x is the centripetal pseudo-force
      // term; gravity terms are subtracted with sign of (x - x_i).
      // Note: MATLAB uses (x - x1)/|x - x1|^3 which is +1/(x-x1)^2 for x>x1
      // and -1/(x1-x)^2 for x<x1. We replicate exactly.
      const dx1 = x - x1;
      const dx2 = x - x2;
      const t1 = -G * M1 * dx1 / Math.pow(Math.abs(dx1), 3);
      const t2 = -G * M2 * dx2 / Math.pow(Math.abs(dx2), 3);
      return omega2 * x + t1 + t2;
    };

    const p = String(point).toUpperCase();
    let xs, ys = 0;
    switch (p) {
      case "L1":
        xs = brentRoot(f, x2 + 1e-3 * a, x1 - 1e-3 * a);
        break;
      case "L2":
        xs = brentRoot(f, x1 + 1e-3 * a, x1 + 2.0 * a);
        break;
      case "L3":
        xs = brentRoot(f, x2 - 2.0 * a, x2 - 1e-3 * a);
        break;
      case "L4":
        xs = (x1 + x2) / 2;
        ys = +a * Math.sqrt(3) / 2;
        break;
      case "L5":
        xs = (x1 + x2) / 2;
        ys = -a * Math.sqrt(3) / 2;
        break;
      default:
        throw new Error('lagrange_point: point must be one of "L1".."L5".');
    }
    return { x: xs, y: ys };
  };

  // cluster_ic: returns {x, y, vx, vy} object (matches MATLAB return signature)
  ICs.cluster_ic = function (scenario, params) {
    const G = 1;
    const type = scenario.type;
    const ic = scenario.ic;

    if (type === "single") {
      const M = params.sourceMass;
      const mc = params.clusterMass;
      switch (ic) {
        case "circular": {
          const rp = params.periapsis;
          return { x: rp, y: 0, vx: 0, vy: Math.sqrt(G * (M + mc) / rp) };
        }
        case "elliptical": {
          const rp = params.periapsis;
          const e = params.eccentricity;
          if (e < 0 || e >= 1) throw new Error('cluster_ic: elliptical eccentricity in [0, 1).');
          return { x: rp, y: 0, vx: 0, vy: Math.sqrt(G * (M + mc) * (1 + e) / rp) };
        }
        case "parabolic": {
          const rp = params.periapsis;
          return { x: rp, y: 0, vx: 0, vy: Math.sqrt(2 * G * (M + mc) / rp) };
        }
        case "hyperbolic": {
          const rp = params.periapsis;
          const vInf = params.vInfinity;
          if (vInf < 0) throw new Error('cluster_ic: hyperbolic vInfinity must be >= 0.');
          return { x: rp, y: 0, vx: 0, vy: Math.sqrt(vInf * vInf + 2 * G * (M + mc) / rp) };
        }
        default:
          throw new Error('cluster_ic: unknown single-source IC: ' + ic);
      }
    } else if (type === "binary") {
      const M1 = params.M1, M2 = params.M2;
      const Mt = M1 + M2;
      const mc = params.clusterMass;
      switch (ic) {
        case "lagrange": {
          const a = params.binarySep;
          const pt = params.lagrangePoint;
          const L = ICs.lagrange_point(M1, M2, a, pt);
          const omega = Math.sqrt(G * Mt / (a * a * a));
          return { x: L.x, y: L.y, vx: -omega * L.y, vy: +omega * L.x };
        }
        case "circumbinary": {
          const a = params.binarySep;
          const ratio = params.circumbinaryRatio;
          const rOrb = ratio * a;
          return { x: rOrb, y: 0, vx: 0, vy: Math.sqrt(G * (Mt + mc) / rOrb) };
        }
        case "parabolic": {
          const rp = params.periapsis;
          const theta = params.impactAngle;
          const vmag = Math.sqrt(2 * G * (Mt + mc) / rp);
          return {
            x: rp * Math.cos(theta),
            y: rp * Math.sin(theta),
            vx: -vmag * Math.sin(theta),
            vy:  vmag * Math.cos(theta),
          };
        }
        default:
          throw new Error('cluster_ic: unknown binary-source IC: ' + ic);
      }
    } else {
      throw new Error('cluster_ic: scenario.type must be "single" or "binary".');
    }
  };

  // ===========================================================================
  // Roche: per-star Roche radii
  // ===========================================================================
  const Roche = {};

  Roche.computeRocheRadii = function (cfg) {
    const Mc = cfg.particleMass * cfg.Nparticles;
    const Rc = (cfg.particleRadius + cfg.edgeGap / 2) * Math.sqrt(cfg.Nparticles);

    let masses;
    if (cfg.scenarioType === "binary") {
      masses = [cfg.M1, cfg.M2];
    } else {
      masses = [cfg.sourceMass];
    }
    const nS = masses.length;
    const R3D   = new Array(nS).fill(0);
    const Rdisk = new Array(nS).fill(0);

    const R = cfg.stellarRadius;
    if (Mc <= 0 || Rc <= 0 || R <= 0) {
      return { R3D: R3D, Rdisk: Rdisk };
    }
    const rho_s = Mc / ((4 / 3) * Math.PI * Rc * Rc * Rc);
    if (rho_s <= 0) return { R3D: R3D, Rdisk: Rdisk };

    const h = 2 * cfg.particleRadius;
    let useDisk = (h > 0 && Rc > 0);
    let g_ratio = 1;
    if (useDisk) {
      let hr = h / Rc;
      hr = Math.max(0.02, Math.min(0.5, hr));
      // log10(hr) -> g_ratio interpolation
      const hrTab = [0.02, 0.05, 0.10, 0.20, 0.50];
      const gTab  = [3.62, 3.04, 2.60, 2.16, 1.58];
      const lg = Math.log10(hr);
      const lgTab = hrTab.map(Math.log10);
      // linear interp
      let idx = 0;
      for (let k = 0; k < lgTab.length - 1; k++) {
        if (lg >= lgTab[k] && lg <= lgTab[k + 1]) { idx = k; break; }
        if (lg <= lgTab[0]) { idx = 0; break; }
        if (lg >= lgTab[lgTab.length - 1]) { idx = lgTab.length - 2; break; }
      }
      const t = (lg - lgTab[idx]) / (lgTab[idx + 1] - lgTab[idx]);
      g_ratio = gTab[idx] + t * (gTab[idx + 1] - gTab[idx]);
    }

    for (let k = 0; k < nS; k++) {
      const M = masses[k];
      if (M <= 0) continue;
      const rho_M = M / ((4 / 3) * Math.PI * R * R * R);
      R3D[k] = R * Math.cbrt(2 * rho_M / rho_s);
      if (useDisk) {
        Rdisk[k] = R3D[k] * Math.cbrt(1 / g_ratio);
      } else {
        Rdisk[k] = R3D[k];
      }
    }
    return { R3D: R3D, Rdisk: Rdisk };
  };

  // ===========================================================================
  // Helpers to convert between 2-D matrix forms and Float64Array
  // ===========================================================================
  const Util = {};

  // Convert MATLAB's nP x 6 matrix (array of arrays) into a packed Float64Array.
  Util.matToParticles = function (mat) {
    const nP = mat.length;
    const out = new Float64Array(nP * P_STRIDE);
    for (let k = 0; k < nP; k++) {
      out[k * P_STRIDE + 0] = mat[k][0];
      out[k * P_STRIDE + 1] = mat[k][1];
      out[k * P_STRIDE + 2] = mat[k][2];
      out[k * P_STRIDE + 3] = mat[k][3];
      out[k * P_STRIDE + 4] = mat[k][4];
      out[k * P_STRIDE + 5] = mat[k][5];
    }
    return out;
  };

  // Convert Float64Array of particles back into MATLAB-style nP x 6 array of arrays.
  Util.particlesToMat = function (particles) {
    const nP = particles.length / P_STRIDE;
    const out = [];
    for (let k = 0; k < nP; k++) {
      const off = k * P_STRIDE;
      out.push([
        particles[off + 0],
        particles[off + 1],
        particles[off + 2],
        particles[off + 3],
        particles[off + 4],
        particles[off + 5],
      ]);
    }
    return out;
  };

  // Convert source array to a [n x 7] matrix [x, y, vx, vy, ax, ay, m].
  Util.sourcesToMat = function (sources) {
    return sources.map(s => [s.x, s.y, s.vx, s.vy, s.ax, s.ay, s.m]);
  };

  // Convert source matrix [n x 7] back to source array.
  Util.matToSources = function (mat) {
    return mat.map(r => ({ x: r[0], y: r[1], vx: r[2], vy: r[3], ax: r[4], ay: r[5], m: r[6] }));
  };

  return { Defaults, Physics, ICs, Roche, Util, version: '0.1.0' };
})();

// Export for both browser and node usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TDE;
}
if (typeof window !== 'undefined') {
  window.TDE = TDE;
}
